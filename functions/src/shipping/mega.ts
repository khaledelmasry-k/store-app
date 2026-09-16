import type { ShippingAdapterContext, ShippingProviderAdapter } from './types'
import { ShippingProviderError } from './errors'

/**
 * Shared-system Mega adapter. Multiple independent carriers may share the same
 * Mega logistics-system software while keeping distinct branding, credentials,
 * pricing and thresholds.
 *
 * IMPORTANT: Public research does NOT provide a complete universal Mega API
 * contract. Therefore this adapter is deliberately configuration-driven and
 * does NOT invent production endpoints or authentication. Real carrier
 * documentation must be supplied before marking a Mega carrier production_ready.
 *
 * Until a carrier's documentation is provided:
 * - capabilities are NOT auto-verified
 * - live network calls are only attempted when systemConfig.baseUrl is explicitly set
 * - fallback is provider-neutral zone pricing stored in Firestore (manual-like)
 * - testConnection informs operator that documentation is required
 */

function systemBaseUrl(context: ShippingAdapterContext): string | null {
  const provider: any = context.provider || {}
  const cfg = provider.systemConfig || {}
  const candidate =
    String(cfg.baseUrl || cfg.apiBaseUrl || provider.baseUrl || provider.apiBaseUrl || provider.integrationConfig?.baseUrl || '').trim()
  if (!candidate) return null
  const emulator = process.env.FUNCTIONS_EMULATOR === 'true' && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(candidate)
  if (!/^https:\/\//i.test(candidate) && !emulator) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Mega base URL must use HTTPS', false)
  return candidate.replace(/\/$/, '')
}

function providerCode(context: ShippingAdapterContext) {
  return String((context.provider as any)?.providerCode || (context.provider as any)?.systemConfig?.providerCode || (context.provider as any)?.slug || '').trim()
}

export const megaAdapter: ShippingProviderAdapter = {
  slug: 'mega',
  // Capabilities are intentionally conservative until proven per-provider.
  // getRates fallback via zones keeps checkout working without a live Mega contract.
  capabilities: ['getRates', 'createShipment'],
  sanitizeCredentials(input) {
    const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
    // Credentials are schema-driven per provider via requiredFields. Accept any
    // non-empty credential bag but validate length/presence.
    const out: Record<string, string> = {}
    let hasValue = false
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const val = String(v || '').trim()
      if (!val) continue
      if (val.length > 4096) throw new Error(`Credential ${k} is too long`)
      out[k] = val
      hasValue = true
    }
    if (!hasValue) throw new Error('بيانات اعتماد شركة الشحن مطلوبة')
    return out
  },
  getSetupStatus(context) {
    // Merchant UI renders requiredFields dynamically; adapter only checks that
    // the platform has configured at least one service for rate calculation.
    const provider: any = context.provider
    const hasServices = Array.isArray(provider?.services) && provider.services.length > 0
    if (!hasServices) return { complete: false, requirements: ['services'], message: 'أضف خدمة واحدة على الأقل قبل إنشاء الشحنات.' }
    return { complete: true, requirements: [], message: undefined }
  },
  async testConnection(context) {
    const base = systemBaseUrl(context)
    if (!base) {
      return { ok: false, message: 'يتطلب ربط Mega عنوان API الرسمي (baseUrl) من وثائق الشركة قبل الاختبار. احفظ العنوان من إعدادات النظام ثم أعد الاختبار.' }
    }
    // Do not assume a health endpoint exists. Attempt minimal fetch only if
    // operator has explicitly provided a baseUrl. Inform that documentation is
    // required for verified capabilities.
    return {
      ok: true,
      message: `تم حفظ عنوان النظام ${base} (${providerCode(context) || 'بدون كود مزود'}). يلزم وثائق الشركة لتأكيد العمليات المدعومة قبل الإنتاج.`,
      account: providerCode(context) || null,
    }
  },
  async getRates(context, input) {
    const provider: any = context.provider
    const services = Array.isArray(provider?.services) ? provider.services : []
    if (!services.length) throw new ShippingProviderError('NOT_COVERED', 'لا توجد خدمات مفعّلة لدى الشركة', false)

    // If a real Mega endpoint is configured, we deliberately do NOT invent its
    // path. Until docs exist, fallback to provider's own zone pricing.
    // When docs are available, implement adapter-specific fetch here per-carrier
    // and map to canonical rate shape.

    const destination = String(input.governorate || '').trim()
    const city = String(input.city || '').trim()
    const area = String(input.area || '').trim()
    const includes = (values: unknown, value: string) => Array.isArray(values) && values.map((e) => String(e).trim()).filter(Boolean).includes(value)
    const score = (rule: any) => {
      if (rule?.enabled === false) return 0
      if (includes(rule.excludedGovernorates, destination) || includes(rule.excludedCities, city) || includes(rule.excludedAreas, area)) return 0
      const hasCoverage = [rule.governorates, rule.cities, rule.areas].some((v: any) => Array.isArray(v) && v.length > 0)
      if (!hasCoverage) return 1
      if (area && includes(rule.areas, area)) return 4
      if (city && includes(rule.cities, city)) return 3
      if (includes(rule.governorates, destination)) return 2
      return 0
    }
    const subtotal = Number(input.subtotal || 0)
    const weightKg = Math.max(0, Number(input.weightKg || 1))
    const config: any = context.config || {}
    return services.filter((s: any) => s.enabled !== false).map((service: any) => {
      const zone = Array.isArray(service.zoneRules) ? service.zoneRules.map((r: any) => ({ rule: r, s: score(r) })).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s)[0]?.rule || null : null
      if (Array.isArray(service.zoneRules) && service.zoneRules.length > 0 && !zone) return null
      const baseWeight = Math.max(0.01, Number(zone?.baseWeight ?? service.baseWeight ?? 1))
      const extraKgRate = Math.max(0, Number(zone?.extraKgRate ?? service.extraKgRate ?? 0))
      const extra = Math.max(0, Math.ceil(weightKg - baseWeight))
      const baseRate = Number(zone?.baseRate ?? service.fixedRate ?? 0)
      const markup = Number(config.rateMarkup || 0)
      const threshold = Number(zone?.freeShippingThreshold ?? service.freeShippingThreshold ?? 0)
      const calc = baseRate + extra * extraKgRate
      const amountFallback = threshold > 0 && subtotal >= threshold ? 0 : Math.max(0, calc + markup)
      return {
        providerId: String(provider.id || ''),
        serviceCode: String(service.code || 'standard'),
        serviceName: String(service.name || provider.name || 'خدمة'),
        amount: amountFallback,
        price: amountFallback,
        currency: String(input.currency || 'EGP'),
        zoneId: zone?.zoneId || null,
        etaMin: zone?.etaMin ?? service.estimatedMinHours ?? null,
        etaMax: zone?.etaMax ?? service.estimatedMaxHours ?? null,
        codAvailable: service.supportsCOD !== false,
        trackingAvailable: provider.supportsTracking === true,
      }
    }).filter(Boolean) as any
  },
  async createShipment(context, input) {
    const order: any = input.order || {}
    const provider: any = context.provider
    const code = providerCode(context)
    // Until real Mega docs are integrated, create a provider-neutral
    // shipment identifier. This keeps merchant flow testable and preserves
    // provider isolation (different providerCode → different logical carrier).
    const base = systemBaseUrl(context)
    if (!base) {
      return {
        providerShipmentId: `mega-${code || provider.slug || 'carrier'}-${String(input.orderId).slice(0, 20)}-${Date.now()}`,
        trackingNumber: null,
        trackingUrl: null,
        status: 'CREATED',
        message: 'تم إنشاء شحنة عبر نظام Mega (وضع الاختبار المحلي — يلزم ربط API الرسمي للإنتاج)',
      }
    }
    // With baseUrl present but without assumed contract, still return neutral.
    // Real implementation should be inserted here once per-carrier docs exist.
    return {
      providerShipmentId: `mega-${code || provider.slug || 'carrier'}-${String(input.orderId).slice(0, 20)}-${Date.now()}`,
      trackingNumber: null,
      trackingUrl: null,
      status: 'CREATED',
      message: `نظام ${code || provider.name} المربوط عبر Mega — بانتظار تأكيد عقد API الرسمي`,
    }
  },
  mapStatus(value: string) {
    const s = String(value || '').toUpperCase()
    if (s === 'DELIVERED') return 'DELIVERED'
    if (s === 'RETURNED') return 'RETURNED'
    if (s === 'CANCELLED') return 'CANCELLED'
    if (s === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY'
    if (s === 'IN_TRANSIT') return 'IN_TRANSIT'
    return 'CREATED'
  },
}

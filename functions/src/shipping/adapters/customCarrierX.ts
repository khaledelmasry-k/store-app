import type { ShippingAdapterContext, ShippingProviderAdapter } from '../types'
import { ShippingProviderError } from '../errors'

/**
 * Example custom / proprietary carrier adapter.
 * Each carrier with a bespoke API gets its own file under
 * functions/src/shipping/adapters/ and implements the generic contract.
 * No carrier-specific fields leak into checkout or merchant generic UI.
 */

function systemBaseUrl(context: ShippingAdapterContext): string | null {
  const provider: any = context.provider || {}
  const cfg = provider.systemConfig || {}
  const candidate = String(cfg.baseUrl || provider.baseUrl || provider.integrationConfig?.baseUrl || '').trim()
  if (!candidate) return null
  const emulator = process.env.FUNCTIONS_EMULATOR === 'true' && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(candidate)
  if (!/^https:\/\//i.test(candidate) && !emulator) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Custom base URL must use HTTPS', false)
  return candidate.replace(/\/$/, '')
}

export const customCarrierXAdapter: ShippingProviderAdapter = {
  slug: 'custom-carrier-x',
  capabilities: ['getRates', 'createShipment', 'trackShipment'],
  sanitizeCredentials(input) {
    const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const val = String(v || '').trim()
      if (!val) continue
      if (val.length > 4096) throw new Error(`Credential ${k} is too long`)
      out[k] = val
    }
    if (!Object.keys(out).length) throw new Error('بيانات اعتماد الشركة المخصصة مطلوبة')
    return out
  },
  getSetupStatus(context) {
    const provider: any = context.provider
    const hasServices = Array.isArray(provider?.services) && provider.services.length > 0
    if (!hasServices) return { complete: false, requirements: ['services'], message: 'أضف خدمة واحدة على الأقل.' }
    return { complete: true, requirements: [] }
  },
  async testConnection(context) {
    const base = systemBaseUrl(context)
    if (!base) return { ok: false, message: 'يتطلب ربط الشركة المخصصة عنوان API الرسمي قبل الاختبار.' }
    return { ok: true, message: `تم حفظ عنوان النظام ${base}. يلزم وثائق الشركة لتأكيد العمليات قبل الإنتاج.`, account: String((context.provider as any)?.providerCode || (context.provider as any)?.slug || '') || null }
  },
  async getRates(context, input) {
    const provider: any = context.provider
    const services = Array.isArray(provider?.services) ? provider.services : []
    if (!services.length) throw new ShippingProviderError('NOT_COVERED', 'لا توجد خدمات', false)
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
      const amount = threshold > 0 && subtotal >= threshold ? 0 : Math.max(0, calc + markup)
      return {
        providerId: String(provider.id || ''),
        serviceCode: String(service.code || 'custom'),
        serviceName: String(service.name || provider.name || 'خدمة'),
        amount,
        price: amount,
        currency: String(input.currency || 'EGP'),
        zoneId: zone?.zoneId || null,
      }
    }).filter(Boolean) as any
  },
  async createShipment(context, input) {
    const provider: any = context.provider
    return {
      providerShipmentId: `custom-${provider.slug || 'carrier'}-${String(input.orderId).slice(0, 20)}-${Date.now()}`,
      trackingNumber: null,
      trackingUrl: null,
      status: 'CREATED',
      message: `تم إنشاء شحنة عبر ${provider.name || 'الشركة المخصصة'} (وضع الاختبار)`,
    }
  },
  mapStatus(value: string) {
    const s = String(value || '').toUpperCase()
    if (s === 'DELIVERED') return 'DELIVERED'
    if (s === 'RETURNED') return 'RETURNED'
    if (s === 'CANCELLED') return 'CANCELLED'
    return 'CREATED'
  },
}
export default customCarrierXAdapter

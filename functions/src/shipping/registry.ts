import type { ShippingAdapterContext, ShippingProviderAdapter, CanonicalShipmentStatus } from './types'
import { bostaAdapter } from './bosta'
import { waslaAdapter } from './wasla'

const manualAdapter: ShippingProviderAdapter = {
  slug: 'manual',
  capabilities: ['services', 'zones', 'rates', 'eta', 'manualTracking', 'manualStatus'],
  async testConnection(_context: ShippingAdapterContext) {
    return { ok: true, message: 'التكامل اليدوي جاهز للاستخدام' }
  },
  async getServices(context) {
    const provider = context.provider as any
    const config = context.config || {}
    const configured = Array.isArray(provider.services) ? provider.services : []
    if (configured.length) return configured.filter((service: any) => service && service.enabled !== false).map((service: any) => ({ ...service, code: String(service.code || 'manual'), name: String(service.name || provider.name || 'شحن يدوي') }))
    return [{
      code: String(config.serviceCode || provider.defaultServiceCodes?.[0] || 'manual'),
      name: String(provider.name || 'شحن يدوي'),
      enabled: true,
      serviceType: 'standard',
      estimatedMinHours: Number(config.etaMinHours || 48),
      estimatedMaxHours: Number(config.etaMaxHours || 120),
      supportsCOD: provider.supportsCOD !== false && config.codEnabled !== false,
      supportsReturns: provider.supportsReturns === true && config.returnEnabled === true,
      supportsPickup: provider.supportsPickup === true,
      rateMode: 'fixed',
      fixedRate: Number(config.fixedRate || 0),
      freeShippingThreshold: Number(config.freeShippingThreshold || 0),
    }]
  },
  async getZones(context) {
    const services = await manualAdapter.getServices?.(context)
    return (services || []).flatMap((service: any) => (Array.isArray(service.zoneRules) ? service.zoneRules : []).map((zone: any) => ({ serviceCode: service.code, ...zone })))
  },
  async getRates(context, input) {
    const config = context.config || {}
    const provider = context.provider as any
    const subtotal = Number(input.subtotal || 0)
    const requestedServiceCode = String(input.serviceCode || config.serviceCode || '').trim()
    const destination = String(input.governorate || '').trim()
    const city = String(input.city || '').trim()
    const area = String(input.area || '').trim()
    const weightKg = Math.max(0, Number(input.weightKg || config.defaultPackageWeight || 1))
    const includes = (values: unknown, value: string) => Array.isArray(values) && values.map((entry) => String(entry).trim()).filter(Boolean).includes(value)
    const coverageScore = (rule: any) => {
      if (rule?.enabled === false) return 0
      if (includes(rule.excludedGovernorates, destination) || includes(rule.excludedCities, city) || includes(rule.excludedAreas, area)) return 0
      const hasCoverage = [rule.governorates, rule.cities, rule.areas].some((values) => Array.isArray(values) && values.length > 0)
      if (!hasCoverage) return 1
      if (area && includes(rule.areas, area)) return 4
      if (city && includes(rule.cities, city)) return 3
      if (includes(rule.governorates, destination)) return 2
      return 0
    }
    const services = (await manualAdapter.getServices?.(context)) || []
    return services
      .filter((service: any) => !requestedServiceCode || service.code === requestedServiceCode)
      .map((service: any): Record<string, unknown> | null => {
        const mode = config.rateMode || service.rateMode || 'fixed'
        // المناطق الأدق أولاً: الحي ثم المدينة ثم المحافظة ثم القاعدة العامة.
        // هذا يمنع قاعدة «كل مصر» من ابتلاع سعر القاهرة المخصص بسبب ترتيب الحفظ.
        const zone = Array.isArray(service.zoneRules)
          ? service.zoneRules
            .map((rule: any) => ({ rule, score: coverageScore(rule) }))
            .filter(({ score }: { score: number }) => score > 0)
            .sort((left: { score: number }, right: { score: number }) => right.score - left.score)[0]?.rule || null
          : null
        if (Array.isArray(service.zoneRules) && service.zoneRules.length > 0 && !zone) return null
        const baseWeight = Math.max(0.01, Number(zone?.baseWeight ?? service.baseWeight ?? config.defaultPackageWeight ?? 1))
        const extraKgRate = Math.max(0, Number(zone?.extraKgRate ?? service.extraKgRate ?? 0))
        const extraWeight = Math.max(0, Math.ceil(weightKg - baseWeight))
        const serviceBase = Number(zone?.baseRate ?? service.fixedRate ?? 0)
        const overrideRate = config.rateMode === 'fixed' && Number.isFinite(Number(config.fixedRate)) ? Number(config.fixedRate) : null
        const baseRate = overrideRate != null ? overrideRate : serviceBase
        const configuredThreshold = Number(config.freeShippingThreshold || 0)
        const threshold = configuredThreshold > 0 ? configuredThreshold : Number(zone?.freeShippingThreshold ?? service.freeShippingThreshold ?? 0)
        const markup = Number(config.rateMarkup || 0)
        const calculated = mode === 'weight' || mode === 'hybrid' || mode === 'zone' || zone ? baseRate + extraWeight * extraKgRate : baseRate
        const amount = threshold > 0 && subtotal >= threshold ? 0 : Math.max(0, calculated + markup)
        const etaMin = Number(zone?.etaMin ?? service.estimatedMinHours ?? config.etaMinHours ?? 0) || null
        const etaMax = Number(zone?.etaMax ?? service.estimatedMaxHours ?? config.etaMaxHours ?? 0) || null
        return {
          providerId: String(provider.id || ''),
          serviceCode: String(service.code || 'manual'),
          serviceName: String(service.name || provider.name || 'شحن يدوي'),
          name: String(service.name || provider.name || 'شحن يدوي'),
          amount,
          price: amount,
          currency: String(input.currency || 'EGP'),
          zoneId: zone?.zoneId || null,
          zoneName: zone?.zoneName || null,
          codFee: Math.max(0, Number(zone?.codFee || 0)),
          returnFee: Math.max(0, Number(zone?.returnFee || 0)),
          weightKg,
          etaMin,
          etaMax,
          etaUnit: zone?.etaUnit || 'hours',
          estimatedDays: String(config.estimatedDays || ''),
          codAvailable: service.supportsCOD !== false && config.codEnabled !== false,
          trackingAvailable: provider.supportsTracking === true,
        }
      })
      .filter((rate): rate is Record<string, unknown> => Boolean(rate))
  },
  async createShipment(context, input) {
    const orderId = String(input.orderId || '')
    return {
      providerShipmentId: `manual-${orderId}-${Date.now()}`,
      trackingNumber: String(input.trackingNumber || ''),
      trackingUrl: null,
      status: 'CREATED',
      message: 'تم إنشاء شحنة يدوية؛ أضف رقم التتبع عند توفره',
      providerId: String((context.provider as any).id || ''),
    }
  },
  mapStatus(externalStatus: string): CanonicalShipmentStatus {
    const status = String(externalStatus || '').toUpperCase()
    if (status === 'DELIVERED') return 'DELIVERED'
    if (status === 'IN_TRANSIT') return 'IN_TRANSIT'
    if (status === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY'
    if (status === 'RETURNED') return 'RETURNED'
    if (status === 'CANCELLED') return 'CANCELLED'
    return 'CREATED'
  },
}

const adapters: Record<string, ShippingProviderAdapter> = { manual: manualAdapter, bosta: bostaAdapter, wasla: waslaAdapter }

export function getShippingAdapter(slug: string | undefined | null, integrationType?: string): ShippingProviderAdapter | null {
  const normalizedSlug = String(slug || '').trim().toLowerCase()
  if (integrationType === 'manual') return manualAdapter
  return adapters[normalizedSlug] || null
}

/**
 * Quoting can safely use the platform's configured service/zones even before a
 * carrier has a live API adapter. Shipment creation continues to use
 * getShippingAdapter and therefore never pretends that an unimplemented API
 * integration can create a label or tracking number.
 */
export function getShippingRateAdapter(slug: string | undefined | null, integrationType?: string): ShippingProviderAdapter {
  return getShippingAdapter(slug, integrationType) || manualAdapter
}

export function listShippingAdapters() {
  return Object.values(adapters).map((adapter) => ({ slug: adapter.slug, capabilities: adapter.capabilities }))
}

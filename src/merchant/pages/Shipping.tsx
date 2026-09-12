import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Toggle } from '../../shared/components/ui/Toggle'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { Loading } from '../../shared/components/ui/Loading'
import { Tabs } from '../../shared/components/ui/Tabs'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { shippingService } from '../../shared/services/billing'
import { storesService } from '../../shared/services/stores'
import { formatCurrency } from '../../shared/utils/format'
import { GOVER_EG } from '../../shared/utils/constants'
import { getMerchantShippingProvidersCallable, getWaslaLocationsCallable, recordShippingSettlementCallable, saveIntegrationCredentialsCallable, saveMerchantShippingProfileCallable, saveShippingAutomationSettingsCallable, saveStoreShippingProviderCallable, testShippingConnectionCallable } from '../../shared/services/auth'
import type { Shipment, ShippingEligibility, ShippingProviderDefinition, ShippingSettlement, ShippingZone, StoreShippingProviderConfig } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './Shipping.css'

type ZoneDraft = {
  id?: string
  name: string
  governorates: string[]
  fee: string
  freeAbove: string
  estimatedDays: string
  providerId: string
  active: boolean
}

type WaslaLocation = { id: number; name: string; pickupSupported?: boolean; deliverySupported?: boolean; cities: Array<{ id: number; name: string }> }
type SettlementLine = {
  providerId: string
  providerName: string
  feesRecorded: number
  pendingCount: number
  pendingGross: number
  pendingFees: number
  pendingNet: number
  settledCount: number
  settledNet: number
}

const connectionStatusLabel = (status?: string, enabled?: boolean) => {
  if (!enabled) return 'غير مفعلة'
  switch (status) {
    case 'CONNECTED': return 'متصلة'
    case 'CONFIGURED': return 'بانتظار اختبار الاتصال'
    case 'INVALID_CREDENTIALS': return 'مفتاح API غير صالح'
    case 'PROVIDER_UNAVAILABLE': return 'خدمة الشركة غير متاحة مؤقتًا'
    case 'ERROR': return 'تعذر التحقق من الاتصال'
    case 'DISABLED': return 'موقوفة'
    case 'NOT_CONFIGURED': return 'بيانات الربط غير محفوظة'
    default: return 'تحتاج إعداد'
  }
}

const connectionFailureTitle = (status?: string) => {
  if (status === 'INVALID_CREDENTIALS') return 'مفتاح API غير صالح'
  if (status === 'PROVIDER_UNAVAILABLE') return 'خدمة شركة الشحن غير متاحة مؤقتًا'
  if (status === 'NOT_CONFIGURED') return 'بيانات الربط غير محفوظة'
  return 'تعذر اختبار الاتصال'
}

export const MerchantShipping: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const shippingRes = useCollection<ShippingZone>('shipping', { storeId })
  const shipmentsRes = useCollection<Shipment>('shipments', { storeId }, Boolean(storeId))
  const settlementsRes = useCollection<ShippingSettlement>('shippingSettlements', { storeId }, Boolean(storeId))
  const zones = shippingRes.data
  const toast = useToast()
  const [tab, setTab] = useState('settings')
  const [savingCfg, setSavingCfg] = useState(false)
  const [zoneOpen, setZoneOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'zone'; id: string } | null>(null)
  const [zoneForm, setZoneForm] = useState<ZoneDraft>({ name: '', governorates: [], fee: '', freeAbove: '', estimatedDays: '', providerId: '', active: true })
  const [platformProviders, setPlatformProviders] = useState<Array<{ provider: ShippingProviderDefinition; config: StoreShippingProviderConfig | null; eligibility?: ShippingEligibility }>>([])
  const [platformLoading, setPlatformLoading] = useState(false)
  const [platformSaving, setPlatformSaving] = useState('')
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [expectedVolume, setExpectedVolume] = useState('')
  const [targetGovernorates, setTargetGovernorates] = useState<string[]>([])
  const [platformDrafts, setPlatformDrafts] = useState<Record<string, { fixedRate: string; defaultPackageWeight: string; codEnabled: boolean; serviceCode: string; rateMarkup: string; freeShippingThreshold: string; waslaPickupLocationName: string; waslaPickupContactPhone: string; waslaPickupAddressLine1: string; waslaPickupGovernorateId: string; waslaPickupCityId: string }>>({})
  const [credentialDrafts, setCredentialDrafts] = useState<Record<string, { apiKey: string; webhookSecret: string }>>({})
  const [waslaLocations, setWaslaLocations] = useState<Record<string, WaslaLocation[]>>({})
  const [waslaLocationsLoading, setWaslaLocationsLoading] = useState<Record<string, boolean>>({})
  const [automaticShipmentCreation, setAutomaticShipmentCreation] = useState<'MANUAL' | 'AFTER_CONFIRMATION' | 'IMMEDIATELY_AFTER_CHECKOUT'>('AFTER_CONFIRMATION')
  const [settlementTarget, setSettlementTarget] = useState<SettlementLine | null>(null)
  const [settlementReference, setSettlementReference] = useState('')
  const [settlementNote, setSettlementNote] = useState('')
  const [settlementSaving, setSettlementSaving] = useState(false)

  const cfg = store?.shipping || { enabled: false, model: 'flat' as const, flatFee: 0, freeAbove: 0, refusedPolicy: '', providers: [] }
  const providers = cfg.providers || []
  const isProviderLive = (provider: ShippingProviderDefinition) => provider.integrationType === 'manual' || provider.adapterConfigured === true
  const isProviderReadyForAutomation = (provider: ShippingProviderDefinition, config: StoreShippingProviderConfig | null) => {
    if (!config?.enabled) return false
    if (provider.integrationType === 'manual') return true
    if (provider.adapterConfigured !== true || config.configurationStatus !== 'CONNECTED') return false
    if (provider.slug !== 'wasla') return true
    return Boolean(
      config.waslaPickupLocationName && config.waslaPickupAddressLine1
      && Number(config.waslaPickupGovernorateId) > 0 && Number(config.waslaPickupCityId) > 0,
    )
  }
  const hasEnabledLiveProvider = platformProviders.some(({ provider, config }) => isProviderReadyForAutomation(provider, config))

  const loadPlatformProviders = async () => {
    if (!storeId) return
    setPlatformLoading(true)
    try {
      const result = await getMerchantShippingProvidersCallable({ storeId })
      setPlatformProviders(((result.data as any)?.providers || []) as Array<{ provider: ShippingProviderDefinition; config: StoreShippingProviderConfig | null; eligibility?: ShippingEligibility }>)
      setAutomaticShipmentCreation((result.data as any)?.settings?.automaticShipmentCreation || 'AFTER_CONFIRMATION')
    } catch (err: any) {
      toast.push('تعذر تحميل شركات المنصة', err?.message || 'حاول مرة أخرى', 'error')
    } finally { setPlatformLoading(false) }
  }

  useEffect(() => { void loadPlatformProviders() }, [storeId])
  useEffect(() => { setExpectedVolume(String(store?.shippingProfile?.expectedMonthlyShipments || '')) }, [store?.shippingProfile?.expectedMonthlyShipments])
  useEffect(() => { setTargetGovernorates(store?.shippingProfile?.targetGovernorates || []) }, [store?.shippingProfile?.targetGovernorates])

  const saveShippingProfile = async () => {
    if (!storeId) return
    try { await saveMerchantShippingProfileCallable({ storeId, expectedMonthlyShipments: Number(expectedVolume || 0), targetGovernorates }); toast.push('تم حفظ احتياجات الشحن') }
    catch (err: any) { toast.push('تعذر حفظ احتياجات الشحن', err?.message || 'حاول مرة أخرى', 'error') }
  }

  const togglePlatformProvider = async (provider: ShippingProviderDefinition, config: StoreShippingProviderConfig | null) => {
    if (config?.enabled !== true && !isProviderLive(provider)) {
      toast.push('هذا الربط قيد التطوير', `يمكنك الاطلاع على خدمات ${provider.name} وأسعاره الآن، لكن إنشاء الشحنات عبر API غير جاهز بعد.`, 'error')
      return
    }
    setPlatformSaving(provider.id)
    try {
      const result = await saveStoreShippingProviderCallable({ storeId, providerId: provider.id, config: { ...(config || {}), enabled: config?.enabled !== true } })
      const saved = (result.data as any)?.config as StoreShippingProviderConfig | undefined
      if (saved) setPlatformProviders((current) => current.map((entry) => entry.provider.id === provider.id ? { ...entry, config: { ...(entry.config || {}), ...saved } } : entry))
      toast.push(config?.enabled ? 'تم إيقاف شركة الشحن' : 'تم تفعيل شركة الشحن')
    } catch (err: any) { toast.push('تعذر تحديث شركة الشحن', err?.message || 'تحقق من الصلاحيات', 'error') }
    finally { setPlatformSaving('') }
  }

  const testPlatformProvider = async (provider: ShippingProviderDefinition, config: StoreShippingProviderConfig | null) => {
    if (!config?.enabled) return
    if (provider.integrationType === 'manual') {
      toast.push('المزود اليدوي لا يحتاج اختبار API', 'تحقق من الخدمة والمناطق والأسعار المحفوظة.', 'success')
      return
    }
    if (!provider.adapterConfigured) {
      toast.push('هذا الربط يحتاج محولاً خاصًا بالشركة', 'يمكنك تفعيل الشركة وضبط خدماتها وأسعارها الآن. اختبار API سيصبح متاحًا بعد إضافة محول الشركة من إدارة المنصة.', 'error')
      return
    }
    try {
      const result = await testShippingConnectionCallable({ providerId: provider.id, storeId })
      const data = result.data as any
      toast.push(data?.ok ? 'تم التحقق من الاتصال' : connectionFailureTitle(data?.status), data?.message, data?.ok ? 'success' : 'error')
    } catch (err: any) { toast.push('تعذر اختبار الاتصال', err?.message || 'حاول مرة أخرى', 'error') }
  }

  const savePlatformConfig = async (provider: ShippingProviderDefinition, config: StoreShippingProviderConfig | null, changes: Record<string, unknown>) => {
    setPlatformSaving(provider.id)
    try {
      const result = await saveStoreShippingProviderCallable({ storeId, providerId: provider.id, config: { ...(config || {}), enabled: true, ...changes } })
      const saved = (result.data as any)?.config as StoreShippingProviderConfig | undefined
      if (saved) setPlatformProviders((current) => current.map((entry) => entry.provider.id === provider.id ? { ...entry, config: { ...(entry.config || {}), ...saved } } : entry))
      toast.push('تم حفظ إعدادات شركة الشحن')
    } catch (err: any) { toast.push('تعذر حفظ إعدادات شركة الشحن', err?.message || 'تحقق من البيانات', 'error') }
    finally { setPlatformSaving('') }
  }

  const loadWaslaLocations = async (provider: ShippingProviderDefinition) => {
    setWaslaLocationsLoading((current) => ({ ...current, [provider.id]: true }))
    try {
      const result = await getWaslaLocationsCallable({ storeId, providerId: provider.id })
      const locations = ((result.data as any)?.locations || []) as WaslaLocation[]
      setWaslaLocations((current) => ({ ...current, [provider.id]: locations }))
      toast.push('تم تحميل مناطق وصلة', `ظهرت ${locations.length} محافظة متاحة لحسابك.`, 'success')
    } catch (err: any) { toast.push('تعذر تحميل مناطق وصلة', err?.message || 'احفظ المفتاح واختبره أولاً', 'error') }
    finally { setWaslaLocationsLoading((current) => ({ ...current, [provider.id]: false })) }
  }

  // The live Wasla location catalogue is needed for the branch selectors.
  // Keep it available after every page refresh instead of requiring the merchant
  // to press "تحميل مناطق وصلة" again before the dropdowns can be used.
  useEffect(() => {
    const wasla = platformProviders.find(({ provider, config }) => provider.slug === 'wasla' && config?.enabled && config.configurationStatus === 'CONNECTED')
    if (wasla && !waslaLocations[wasla.provider.id]) void loadWaslaLocations(wasla.provider)
  }, [platformProviders, storeId])

  const saveAutomationMode = async (mode: 'MANUAL' | 'AFTER_CONFIRMATION' | 'IMMEDIATELY_AFTER_CHECKOUT') => {
    setAutomaticShipmentCreation(mode)
    try {
      await saveShippingAutomationSettingsCallable({ storeId, automaticShipmentCreation: mode })
      toast.push('تم حفظ توقيت إنشاء الشحنة')
    } catch (err: any) { toast.push('تعذر حفظ إعداد التشغيل', err?.message || 'حاول مرة أخرى', 'error') }
  }

  const saveCredentials = async (provider: ShippingProviderDefinition) => {
    if (!provider.adapterConfigured) {
      toast.push('ربط API قيد التطوير', 'لن نطلب منك مفتاحًا أو نحفظه قبل أن يكتمل محول هذه الشركة واختبار الاتصال الحقيقي.', 'error')
      return
    }
    if (!['bosta', 'wasla'].includes(provider.slug)) {
      toast.push('بيانات API لهذه الشركة لا تُحفظ من هذا النموذج', 'لكل شركة طريقة مصادقة وحقول مختلفة؛ لا نستخدم حقول Bosta مع مزود آخر.', 'error')
      return
    }
    const draft = credentialDrafts[provider.id] || { apiKey: '', webhookSecret: '' }
    if (!draft.apiKey.trim()) { toast.push('أدخل مفتاح API', undefined, 'error'); return }
    if (provider.slug === 'bosta' && !draft.webhookSecret.trim()) { toast.push('أدخل Webhook Authorization Key مستقلة لهذا المتجر', undefined, 'error'); return }
    setPlatformSaving(provider.id)
    try {
      const result = await saveIntegrationCredentialsCallable({ storeId, providerId: provider.id, credentials: draft })
      const saved = result.data as { status?: StoreShippingProviderConfig['configurationStatus']; maskedCredentials?: Record<string, string | null> }
      setCredentialDrafts((current) => ({ ...current, [provider.id]: { apiKey: '', webhookSecret: '' } }))
      // Do not reload the whole providers workspace after saving one key. Besides
      // being visually disruptive, that reset every card while the merchant was
      // still completing the pickup-address fields.
      setPlatformProviders((current) => current.map((entry) => entry.provider.id === provider.id && entry.config
        ? {
            ...entry,
            config: {
              ...entry.config,
              configurationStatus: saved.status || 'CONFIGURED',
              credential: {
                status: saved.status || 'CONFIGURED',
                maskedCredentials: saved.maskedCredentials || entry.config.credential?.maskedCredentials,
                lastValidatedAt: null,
                lastValidationStatus: null,
              },
            },
          }
        : entry))
      toast.push('تم حفظ بيانات الاعتماد مشفرة')
    } catch (err: any) { toast.push('تعذر حفظ بيانات الاعتماد', err?.message || 'تحقق من البيانات', 'error') }
    finally { setPlatformSaving('') }
  }

  const toggleGovernorate = (g: string) => {
    const has = zoneForm.governorates.includes(g)
    setZoneForm({ ...zoneForm, governorates: has ? zoneForm.governorates.filter((x) => x !== g) : [...zoneForm.governorates, g] })
  }

  const saveConfig = async () => {
    if (!store) return
    setSavingCfg(true)
    try {
      const next = {
        ...cfg,
        enabled: cfg.enabled,
        model: cfg.model,
        flatFee: Number(cfg.flatFee || 0),
        freeAbove: cfg.freeAbove ? Number(cfg.freeAbove) : undefined,
        refusedPolicy: cfg.refusedPolicy || '',
      }
      await storesService.update(store.id, { shipping: next })
      toast.push('تم حفظ إعدادات الشحن')
    } catch (err: any) {
      toast.push('فشل حفظ الإعدادات', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setSavingCfg(false)
    }
  }

  // Auto-save for the inline settings controls. Guards against an unloaded
  // store (would otherwise write to an empty document id) and surfaces errors.
  const persistShipping = async (next: any) => {
    if (!store?.id) {
      toast.push('بيانات المتجر لم تُحمّل بعد', 'حاول مرة أخرى', 'error')
      return
    }
    try {
      await storesService.update(store.id, { shipping: { ...cfg, ...next } })
    } catch (err: any) {
      toast.push('تعذر حفظ إعدادات الشحن', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }


  const formatPolicy = (before: string, after: string) => {
    const el = document.getElementById('shipping-policy-textarea') as HTMLTextAreaElement | null
    if (!el) return
    const { selectionStart: st, selectionEnd: en, value } = el
    const sel = value.slice(st, en)
    const next = value.slice(0, st) + before + sel + after + value.slice(en)
    persistShipping({ refusedPolicy: next })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(st + before.length, en + before.length) })
  }

  const formatList = (prefix: string) => {
    const el = document.getElementById('shipping-policy-textarea') as HTMLTextAreaElement | null
    if (!el) return
    const { selectionStart: st, selectionEnd: en, value } = el
    const lines = value.slice(st, en).split('\n')
    const next = value.slice(0, st) + lines.map((l, i) => (prefix ? `${prefix}${l}` : `${i + 1}. ${l}`)).join('\n') + value.slice(en)
    persistShipping({ refusedPolicy: next })
    requestAnimationFrame(() => el.focus())
  }

  const submitZone = async () => {
    if (!storeId) return
    if (!zoneForm.name) {
      toast.push('أدخل اسم المنطقة', undefined, 'error')
      return
    }
    const data = {
      name: zoneForm.name.trim(),
      governorates: zoneForm.governorates,
      fee: Number(zoneForm.fee || 0),
      freeAbove: zoneForm.freeAbove ? Number(zoneForm.freeAbove) : undefined,
      estimatedDays: zoneForm.estimatedDays || '',
      providerId: zoneForm.providerId || '',
      active: zoneForm.active ?? true,
    }
    try {
      if (zoneForm.id) {
        await shippingService.update(zoneForm.id, data)
        toast.push('تم تحديث المنطقة')
      } else {
        await shippingService.create(storeId, data)
        toast.push('تم إضافة المنطقة')
      }
      setZoneOpen(false)
      setZoneForm({ name: '', governorates: [], fee: '', freeAbove: '', estimatedDays: '', providerId: '', active: true })
    } catch (err: any) {
      toast.push('فشل حفظ المنطقة', err?.message, 'error')
    }
  }

  const removeTarget = async () => {
    if (!deleteTarget) return
    try {
      await shippingService.remove(deleteTarget.id)
      toast.push('تم حذف المنطقة')
    } catch (err: any) {
      toast.push('تعذر الحذف', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setDeleteTarget(null)
  }

  const registeredCarrierFee = (shipment: Shipment) => Math.max(0, Number(
    shipment.carrierShippingCost ?? shipment.shippingCost ?? shipment.priceSnapshot?.deliveryPrice ?? 0,
  ))
  const settlementLines = Object.values(shipmentsRes.data.reduce<Record<string, SettlementLine>>((result, shipment) => {
    const providerId = shipment.providerId || shipment.shippingCompanyId || 'manual'
    const providerName = shipment.providerName || shipment.shippingCompanyName || shipment.provider || (providerId === 'manual' ? 'شحن يدوي' : 'شركة شحن')
    const line = result[providerId] || {
      providerId, providerName, feesRecorded: 0, pendingCount: 0, pendingGross: 0, pendingFees: 0, pendingNet: 0, settledCount: 0, settledNet: 0,
    }
    const status = String(shipment.status || shipment.currentStatus || '').toUpperCase()
    if (status !== 'CANCELLED') line.feesRecorded += registeredCarrierFee(shipment)
    if (status === 'DELIVERED' && Number(shipment.codAmount || 0) > 0) {
      const gross = Math.max(0, Number(shipment.codAmount || 0))
      const fee = registeredCarrierFee(shipment)
      if (shipment.settlementId) {
        line.settledCount += 1
        line.settledNet += Math.max(0, gross - fee)
      } else {
        line.pendingCount += 1
        line.pendingGross += gross
        line.pendingFees += fee
        line.pendingNet += Math.max(0, gross - fee)
      }
    }
    result[providerId] = line
    return result
  }, {})).sort((a, b) => b.pendingNet - a.pendingNet || a.providerName.localeCompare(b.providerName, 'ar'))
  const totalPendingNet = settlementLines.reduce((sum, line) => sum + line.pendingNet, 0)
  const totalPendingOrders = settlementLines.reduce((sum, line) => sum + line.pendingCount, 0)
  const totalSettledNet = settlementLines.reduce((sum, line) => sum + line.settledNet, 0)
  const totalCarrierFees = settlementLines.reduce((sum, line) => sum + line.feesRecorded, 0)

  const recordSettlement = async () => {
    if (!settlementTarget || !storeId) return
    setSettlementSaving(true)
    try {
      const result = await recordShippingSettlementCallable({
        storeId,
        providerId: settlementTarget.providerId,
        reference: settlementReference,
        note: settlementNote,
      })
      const data = result.data as any
      setSettlementTarget(null)
      setSettlementReference('')
      setSettlementNote('')
      toast.push('تم تسجيل التسوية', `تمت تسوية ${data?.shipmentCount || 0} شحنة بقيمة صافية ${formatCurrency(data?.netMerchantDue || 0)}.`, 'success')
      if (data?.hasMore) toast.push('توجد شحنات إضافية', 'تمت تسوية أول 400 شحنة فقط للحفاظ على سلامة السجل. سجّل تسوية أخرى للباقي.', 'success')
    } catch (err: any) {
      toast.push('تعذر تسجيل التسوية', err?.message || 'حاول مرة أخرى', 'error')
    } finally { setSettlementSaving(false) }
  }

  if (shippingRes.loading) return <Loading />

  const zoneCount = zones.length
  const activeZones = zones.filter((z) => z.active).length
  const activeProviders = platformProviders.filter((entry) => entry.config?.enabled).length
  const enabledServiceCount = platformProviders.reduce((total, entry) => total + (entry.config?.enabled ? (entry.provider.services || []).filter((service) => service.enabled !== false).length : 0), 0)
  const modernCoverageCount = platformProviders.reduce((total, entry) => total + (entry.config?.enabled ? (entry.provider.services || []).reduce((count, service) => count + (service.zoneRules?.filter((zone) => zone.enabled !== false).length || 0), 0) : 0), 0)
  const legacyHasData = zones.length > 0 || providers.length > 0 || Number(cfg.flatFee || 0) > 0 || Number(cfg.freeAbove || 0) > 0 || cfg.model === 'zones'
  const legacyMode = !platformLoading && activeProviders === 0 && legacyHasData
  const visibleTab = tab === 'overview' ? 'settings' : tab === 'zones' && !legacyMode ? 'settings' : tab
  return (
    <div data-tour="shipping-workspace" className="merchant-operations merchant-shipping-page shipping-page--stitch">
      <PageHeader title="الشحن والتوصيل" subtitle="إعدادات الشحن والمناطق وشركات التوصيل" />
      <Tabs tabs={[{ key: 'overview', label: 'نظرة عامة' }, { key: 'companies', label: 'شركات الشحن' }, { key: 'settlements', label: 'التسويات' }]} active={tab} onChange={setTab} />
      <Card title="احتياجات الشحن لمتجرك" className="mt-2" subtitle="تُستخدم هذه البيانات لاقتراح الشركات المناسبة عند إضافة اتصال جديد.">
        <div className="grid grid-2">
          <div><Input label="حجم الشحن الشهري المتوقع" type="number" value={expectedVolume} onChange={setExpectedVolume} /><Button size="sm" onClick={() => void saveShippingProfile()}>حفظ الاحتياجات</Button></div>
          <div><span className="field-label">المحافظات المستهدفة</span><div className="shipping-governorate-picker">{GOVER_EG.map((governorate) => <label key={governorate}><input type="checkbox" checked={targetGovernorates.includes(governorate)} onChange={() => setTargetGovernorates((current) => current.includes(governorate) ? current.filter((value) => value !== governorate) : [...current, governorate])} /> {governorate}</label>)}</div></div>
          <div className="shipping-secure-note"><Icon name="info" ariaHidden /><span>الحجم الفعلي آخر 30 يوم: {platformProviders[0]?.eligibility?.merchantMonthlyVolume ?? shipmentsRes.data.length} شحنة · المتوقع: {expectedVolume || 0}</span></div>
        </div>
      </Card>
      <div className="shipping-page-context">
        <span className="shipping-page-context-icon"><Icon name="compare_arrows" ariaHidden /></span>
        <div><strong>أدر خدمات الشحن من مصدر واحد</strong><span>الشركات اليدوية تُضبط أسعارها هنا؛ شركات API تستخدم السعر الذي تعيده الشركة بعد توفير واجهة تسعير رسمية.</span></div>
      </div>

      {tab === 'overview' && <>
      <Card title="إعدادات التشغيل" className="mt-2" subtitle="الطلب يبقى محفوظًا حتى إذا تعذر الاتصال بشركة الشحن. في شحنات API الشركة وحدها تحدد مراحل الشحنة بعد إنشائها.">
        {!hasEnabledLiveProvider && <div className="shipping-secure-note"><Icon name="schedule" ariaHidden /><span>لا توجد شركة شحن متصلة وجاهزة حاليًا. اختر «يدوي» إلى أن يكتمل ربط شركة API أو تُفعّل شركة جاهزة.</span></div>}
        <label className="field"><span className="field-label">توقيت إنشاء الشحنة</span><select className="input" value={automaticShipmentCreation} onChange={(event) => void saveAutomationMode((event.target as HTMLSelectElement).value as typeof automaticShipmentCreation)}>
          <option value="MANUAL">يدوي — من داخل الطلب فقط</option>
          <option value="AFTER_CONFIRMATION" disabled={!hasEnabledLiveProvider}>بعد التأكيد — عند انتقال الطلب إلى قيد التجهيز، ينشئ الشحنة لدى شركة API{!hasEnabledLiveProvider ? ' (قريبًا)' : ''}</option>
          <option value="IMMEDIATELY_AFTER_CHECKOUT" disabled={!hasEnabledLiveProvider}>فور إتمام العميل للطلب — ينشئ الشحنة تلقائيًا لدى شركة API المختارة{!hasEnabledLiveProvider ? ' (قريبًا)' : ''}</option>
        </select></label>
      </Card>
      </>}

      {tab === 'settlements' && <Card title="كشف تسويات شركات الشحن" className="mt-2" titleIcon="account_balance_wallet" subtitle="رصيدك يُحتسب من شحنات الدفع عند الاستلام التي وصلت للعميل: قيمة التحصيل ناقص رسوم الشحن المسجّلة. لا تسجّل شركات الشحن التحويل البنكي داخل API، لذلك تُؤكَّد التسوية هنا بعد استلامك التحويل فعليًا.">
        <div className="shipping-settlement-stats">
          <StatsCard title="رصيدك غير المسوّى" value={totalPendingNet} currency icon="account_balance_wallet" tone="primary" changeLabel={`${totalPendingOrders} شحنة COD مسلّمة`} />
          <StatsCard title="ما تمّت تسويته" value={totalSettledNet} currency icon="check_circle" tone="green" changeLabel={`${settlementsRes.data.length} تسوية مسجلة`} />
          <StatsCard title="رسوم الشركات المسجلة" value={totalCarrierFees} currency icon="local_shipping" tone="amber" changeLabel="تُراجع مع كشف الشركة" />
        </div>
        <div className="shipping-secure-note shipping-settlement-note"><Icon name="info" ariaHidden /><span>هذه شاشة كشف ومراجعة وليست بوابة تحويل أموال: اضغط «تأكيد استلام التسوية» فقط بعد أن يحوّل لك مزود الشحن المبلغ أو يرسل كشف تسوية مطابقًا.</span></div>
        {shipmentsRes.loading ? <Loading /> : settlementLines.length === 0 ? <p className="muted">لا توجد شحنات مسجلة بعد. ستظهر الأرصدة بعد تسليم شحنات الدفع عند الاستلام.</p> : (
          <div className="shipping-settlement-table" role="region" aria-label="كشف تسويات شركات الشحن">
            <div className="shipping-settlement-row shipping-settlement-row--head"><span>شركة الشحن</span><span>رسوم مسجلة</span><span>غير مسوّى</span><span>تمّت تسويته</span><span /></div>
            {settlementLines.map((line) => <div key={line.providerId} className="shipping-settlement-row">
              <span><strong>{line.providerName}</strong><small>{line.pendingCount} شحنة بانتظار التسوية</small></span>
              <span>{formatCurrency(line.feesRecorded)}</span>
              <span><strong>{formatCurrency(line.pendingNet)}</strong><small>تحصيل {formatCurrency(line.pendingGross)} − رسوم {formatCurrency(line.pendingFees)}</small></span>
              <span>{formatCurrency(line.settledNet)} <small>({line.settledCount} شحنة)</small></span>
              <Button size="sm" variant="outline" icon="payments" disabled={!line.pendingCount} onClick={() => setSettlementTarget(line)}>تأكيد استلام التسوية</Button>
            </div>)}
          </div>
        )}
        {settlementsRes.data.length > 0 && <p className="shipping-settlement-history muted small">آخر تسوية: {settlementsRes.data[0]?.providerName || 'شركة الشحن'} — {formatCurrency(settlementsRes.data[0]?.netMerchantDue || 0)} ({settlementsRes.data[0]?.shipmentCount || 0} شحنة).</p>}
      </Card>}

      {tab === 'companies' && <Card title="شركات الشحن المتاحة من المنصة" className="mt-2">
        {platformLoading ? <Loading /> : platformProviders.length === 0 ? <p className="muted">لم تُفعّل إدارة المنصة أي شركة شحن بعد.</p> : <div className="card-grid shipping-providers-grid">
          {platformProviders.map(({ provider, config, eligibility }) => <Card key={provider.id} className="shipping-provider-card" title={provider.name} actions={<Badge tone={eligibility?.grandfathered || config?.enabled ? 'green' : eligibility?.eligible ? 'blue' : 'amber'}>{eligibility?.grandfathered ? 'اتصال حالي محفوظ' : eligibility?.eligible ? 'متاحة لمتجرك' : 'غير مناسبة حاليًا'}</Badge>}>
            <div className="shipping-provider-intro">
              <div><strong>{provider.integrationType === 'api' ? 'ربط مباشر مع شركة الشحن' : 'شحن يدوي من لوحة المتجر'}</strong><p className="muted small">{provider.description || 'شركة شحن مُدارة من منصة متجري'}</p></div>
              <span className={`shipping-provider-connection ${isProviderReadyForAutomation(provider, config) ? 'is-ready' : config?.enabled ? 'is-pending' : ''}`}><Icon name={isProviderReadyForAutomation(provider, config) ? 'check_circle' : 'schedule'} ariaHidden />{isProviderReadyForAutomation(provider, config) ? 'جاهزة لإنشاء الشحنات' : config?.enabled ? 'تحتاج إكمال الإعداد' : 'غير مفعلة'}</span>
            </div>
            <div className="shipping-provider-summary"><span>{provider.supportsCOD ? 'الدفع عند الاستلام' : 'بدون COD'}</span><span>{provider.supportsTracking ? 'تتبع' : 'تتبع يدوي'}</span><span>{connectionStatusLabel(config?.configurationStatus, config?.enabled)}</span>{config?.isDefault && <span>الافتراضية</span>}</div>
            {eligibility && <div className="shipping-secure-note"><Icon name={eligibility.eligible ? 'check_circle' : 'warning'} ariaHidden /><span>{eligibility.grandfathered ? 'اتصالك الحالي محفوظ' : eligibility.eligible ? 'متاحة لمتجرك' : eligibility.reasons.map((reason: any) => reason.message || reason).join(' · ') || 'شركة الشحن غير جاهزة للربط بعد'}{eligibility.minimumMonthlyShipments > 0 && <>{' · '}الحد الأدنى {eligibility.minimumMonthlyShipments} شحنة شهريًا</>}</span></div>}
            <Button size="sm" variant="outline" onClick={() => setExpandedProvider((current) => current === provider.id ? null : provider.id)}>{expandedProvider === provider.id ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</Button>
            {provider.integrationType === 'manual' && <div className="shipping-secure-note"><Icon name="local_shipping" ariaHidden /><span>هذا الخيار لا يحتاج API أو حسابًا لدى شركة شحن. فعّله واضبط السعر، ثم سجّل بيانات التتبع يدويًا عند إرسال الشحنة.</span></div>}
            {provider.integrationType === 'api' && !isProviderLive(provider) && <div className="shipping-secure-note"><Icon name="schedule" ariaHidden /><span><strong>قريبًا:</strong> نعمل على محول API الرسمي لـ{provider.name}. الأسعار والمناطق قد تظهر في المتجر، لكن لا تُدخل مفتاح API ولا تعتمد الإنشاء التلقائي قبل أن تصبح الحالة «متصلة».</span></div>}
            {provider.slug === 'bosta' && <p className="muted small">أدخل مفاتيح Bosta الخاصة بهذا المتجر فقط، ثم اختبر الاتصال. عنوان Webhook سيظهر بعد نجاح الحفظ.</p>}
            {provider.slug === 'wasla' && <div className="shipping-secure-note"><Icon name="info" ariaHidden /><span><strong>إعداد مرة واحدة:</strong> وصلة تتطلب عنوان الفرع الذي ستستلم منه الشحنات عند إنشاء الطلب. احفظ عنوان استلام وصلة أدناه مرة واحدة للتاجر؛ لا يراه العميل ولا تعيد إدخاله في كل طلب. الأسعار والتغطية تأتيان من وصلة مباشرة.</span></div>}
            {provider.slug === 'wasla' && <div className="shipping-secure-note"><Icon name="sync" ariaHidden /><span><strong>تحديث الحالة:</strong> العقد الحالي يدعم إنشاء الشحنة وجلب التتبع والحالات من وصلة، لكنه لا يوفر Webhook موثقًا أو إلغاء/AWB/مرتجع عبر API. لن يظهر رابط Webhook وهمي؛ استخدم «تحديث من الشركة» من تفاصيل الطلب لجلب آخر حالة.</span></div>}
            {provider.slug === 'wasla' && config?.enabled && !isProviderReadyForAutomation(provider, config) && <div className="shipping-secure-note"><Icon name="schedule" ariaHidden /><span><strong>ينقص الإعداد:</strong> اختر عنوان استلام وصلة واحفظه. بعد ذلك تنشئ المنصة الشحنات تلقائيًا من هذا الفرع.</span></div>}
            {expandedProvider === provider.id && config?.enabled && (() => {
              const draft = platformDrafts[provider.id] || { fixedRate: String(config.fixedRate ?? ''), defaultPackageWeight: String(config.defaultPackageWeight ?? ''), codEnabled: config.codEnabled !== false, serviceCode: config.serviceCode || provider.services?.[0]?.code || '', rateMarkup: String(config.rateMarkup ?? ''), freeShippingThreshold: String(config.freeShippingThreshold ?? ''), waslaPickupLocationName: config.waslaPickupLocationName || '', waslaPickupContactPhone: config.waslaPickupContactPhone || '', waslaPickupAddressLine1: config.waslaPickupAddressLine1 || '', waslaPickupGovernorateId: String(config.waslaPickupGovernorateId || ''), waslaPickupCityId: String(config.waslaPickupCityId || '') }
              return <div className="shipping-provider-config grid grid-2 mt-1">
                {provider.services && provider.services.length > 0 && <label className="field"><span className="field-label">الخدمة</span><select className="input" value={draft.serviceCode} onChange={(e) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), serviceCode: (e.target as HTMLSelectElement).value } }))}>{provider.services.filter((service) => service.enabled !== false).map((service) => <option value={service.code} key={service.code}>{service.name}{service.estimatedMinHours || service.estimatedMaxHours ? ` · ${service.estimatedMinHours || '?'}–${service.estimatedMaxHours || '?'} ساعة` : ''}</option>)}</select></label>}
                {provider.slug !== 'wasla' && provider.allowMerchantRateOverride && <Input label="السعر الثابت (ج.م)" type="number" value={draft.fixedRate} onChange={(value) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), fixedRate: value } }))} />}
                <Input label="وزن الطرد الافتراضي (كجم)" type="number" value={draft.defaultPackageWeight} onChange={(value) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), defaultPackageWeight: value } }))} />
                {provider.slug !== 'wasla' && <Input label="هامش السعر (ج.م)" type="number" value={draft.rateMarkup} onChange={(value) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), rateMarkup: value } }))} />}
                {provider.slug !== 'wasla' && <Input label="حد الشحن المجاني (ج.م)" type="number" value={draft.freeShippingThreshold} onChange={(value) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), freeShippingThreshold: value } }))} />}
                {provider.supportsCOD && <Toggle checked={draft.codEnabled} onChange={(value) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), codEnabled: value } }))} label="الدفع عند الاستلام" />}
                <Toggle checked={config.isDefault === true} onChange={(value) => void savePlatformConfig(provider, config, { ...config, isDefault: value })} label="شركة الشحن الافتراضية" />
                {provider.slug === 'bosta' && <div className="grid grid-2" style={{ gridColumn: '1 / -1' }}>
                  <Input label="Bosta API Key" type="password" value={credentialDrafts[provider.id]?.apiKey || ''} placeholder={config.credential?.maskedCredentials?.apiKey || 'أدخل مفتاح API'} onChange={(value) => setCredentialDrafts((current) => ({ ...current, [provider.id]: { apiKey: value, webhookSecret: current[provider.id]?.webhookSecret || '' } }))} />
                  <Input label="Webhook Authorization Key" type="password" value={credentialDrafts[provider.id]?.webhookSecret || ''} placeholder={config.credential?.maskedCredentials?.webhookSecret || 'مطلوب لتأمين Webhook'} onChange={(value) => setCredentialDrafts((current) => ({ ...current, [provider.id]: { apiKey: current[provider.id]?.apiKey || '', webhookSecret: value } }))} />
                  <Button size="sm" variant="outline" loading={platformSaving === provider.id} onClick={() => saveCredentials(provider)}>حفظ بيانات الربط بأمان</Button>
                </div>}
                {provider.slug === 'wasla' && <div className="shipping-wasla-connection grid grid-2" style={{ gridColumn: '1 / -1' }}>
                  <Input label="مفتاح API الخاص بحساب وصلة" type="password" value={credentialDrafts[provider.id]?.apiKey || ''} placeholder={config.credential?.maskedCredentials?.apiKey || 'أدخل مفتاح وصلة الخاص بمتجرك'} onChange={(value) => setCredentialDrafts((current) => ({ ...current, [provider.id]: { apiKey: value, webhookSecret: '' } }))} />
                  <div className="shipping-provider-actions"><Button size="sm" variant="outline" loading={platformSaving === provider.id} onClick={() => saveCredentials(provider)}>حفظ المفتاح</Button><Button size="sm" variant="outline" loading={waslaLocationsLoading[provider.id] === true} onClick={() => loadWaslaLocations(provider)}>{waslaLocations[provider.id]?.length ? `تحديث مناطق وصلة (${waslaLocations[provider.id].length})` : 'تحميل مناطق وصلة'}</Button></div>
                  <div className="shipping-provider-zone-summary" style={{ gridColumn: '1 / -1' }}><strong>عنوان استلام وصلة</strong><span className="muted small">عنوان الفرع/المخزن الذي تستلم منه وصلة الشحنات. يُحفظ للتاجر مرة واحدة ويُرسل تلقائيًا مع كل شحنة.</span></div>
                  <Input label="اسم الفرع أو المخزن" value={draft.waslaPickupLocationName} placeholder="مثال: الفرع الرئيسي" onChange={(value) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), waslaPickupLocationName: value } }))} />
                  <Input label="هاتف مسؤول الاستلام" value={draft.waslaPickupContactPhone} placeholder="01xxxxxxxxx" onChange={(value) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), waslaPickupContactPhone: value } }))} />
                  <Input label="عنوان الفرع أو المخزن" value={draft.waslaPickupAddressLine1} placeholder="العنوان الذي تستلم منه وصلة الشحنات" onChange={(value) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), waslaPickupAddressLine1: value } }))} />
                  {(() => {
                    const locations = waslaLocations[provider.id] || []
                    const selectedGovernorate = locations.find((location) => String(location.id) === draft.waslaPickupGovernorateId)
                    return <>
                      <label className="field"><span className="field-label">محافظة الفرع</span><select className="input" value={draft.waslaPickupGovernorateId} disabled={!locations.length} onChange={(e) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), waslaPickupGovernorateId: (e.target as HTMLSelectElement).value, waslaPickupCityId: '' } }))}><option value="">{locations.length ? 'اختر محافظة الفرع' : 'اضغط تحميل المناطق أولاً'}</option>{locations.filter((location) => location.pickupSupported !== false).map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
                      <label className="field"><span className="field-label">مدينة الفرع</span><select className="input" value={draft.waslaPickupCityId} disabled={!selectedGovernorate} onChange={(e) => setPlatformDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || draft), waslaPickupCityId: (e.target as HTMLSelectElement).value } }))}><option value="">{selectedGovernorate ? 'اختر مدينة الفرع' : 'اختر المحافظة أولاً'}</option>{(selectedGovernorate?.cities || []).map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}</select></label>
                    </>
                  })()}
                </div>}
                {provider.slug === 'wasla' ? <div className="shipping-provider-zone-summary"><strong>أسعار وصلة</strong><span className="muted small">لا تُدخل سعرًا أو هامشًا هنا. عند إدخال العميل وجهته، تتأكد المنصة من التغطية ثم تجلب سعر وصلة الحقيقي قبل إتمام الطلب.</span></div> : <div className="shipping-provider-zone-summary"><strong>ملخص تسعير المنصة</strong>{provider.services?.find((service) => service.code === draft.serviceCode)?.zoneRules?.length ? provider.services.find((service) => service.code === draft.serviceCode)?.zoneRules?.map((zone) => <span key={zone.zoneId}>{zone.zoneName}: {zone.baseRate} ج.م · {zone.etaMin || '?'}–{zone.etaMax || '?'} {zone.etaUnit === 'days' ? 'يوم' : 'ساعة'}</span>) : <span className="muted small">لا توجد قواعد مناطق؛ استخدم السعر الثابت المعتمد.</span>}</div>}
                <Button size="sm" className="shipping-provider-save" loading={platformSaving === provider.id} onClick={() => savePlatformConfig(provider, config, { serviceCode: draft.serviceCode, enabledServiceCodes: draft.serviceCode ? [draft.serviceCode] : [], fixedRate: Number(draft.fixedRate || 0), defaultPackageWeight: Number(draft.defaultPackageWeight || 0), codEnabled: draft.codEnabled, rateMarkup: Number(draft.rateMarkup || 0), freeShippingThreshold: Number(draft.freeShippingThreshold || 0), rateMode: provider.services?.find((service) => service.code === draft.serviceCode)?.rateMode || 'fixed', isDefault: config.isDefault === true, waslaPickupLocationName: draft.waslaPickupLocationName, waslaPickupContactPhone: draft.waslaPickupContactPhone, waslaPickupAddressLine1: draft.waslaPickupAddressLine1, waslaPickupGovernorateId: Number(draft.waslaPickupGovernorateId || 0), waslaPickupCityId: Number(draft.waslaPickupCityId || 0) })}>حفظ إعدادات الشركة</Button>
              </div>
            })()}
            <div className="shipping-provider-footer"><Button size="sm" loading={platformSaving === provider.id} disabled={!config?.enabled && !isProviderLive(provider)} title={!config?.enabled && !isProviderLive(provider) ? 'قيد التطوير: لا يمكن تفعيل الإنشاء عبر API قبل اكتمال المحول' : undefined} onClick={() => togglePlatformProvider(provider, config)}>{config?.enabled ? 'إيقاف الشركة' : isProviderLive(provider) ? 'تفعيل الشركة' : 'قريبًا'}</Button>{config?.enabled && <Button size="sm" variant="outline" disabled={provider.integrationType === 'manual' || !provider.adapterConfigured} title={provider.integrationType === 'manual' ? 'المزود اليدوي لا يحتاج اختبار API' : !provider.adapterConfigured ? 'قريبًا: يتاح الاختبار بعد إضافة محول API لهذه الشركة' : 'اختبار اتصال المزود'} onClick={() => testPlatformProvider(provider, config)}>اختبار الاتصال</Button>}</div>
          </Card>)}
        </div>}
      </Card>}

      {tab === 'overview' && <Tabs
        tabs={[
          { key: 'settings', label: 'نظرة عامة' },
          ...(legacyMode ? [{ key: 'zones', label: 'مناطق التوافق القديم', count: zoneCount }] : []),
        ]}
        active={visibleTab}
        onChange={setTab}
      />}

      {visibleTab === 'settings' && (
        <div className="mt-2">
          <div className="stats-grid">
            <StatsCard title="شركات الشحن المتاحة" value={platformLoading ? '—' : platformProviders.length} icon="local_shipping" tone="primary" />
            <StatsCard title="الشركات المفعلة" value={platformLoading ? '—' : activeProviders} icon="check_circle" tone="green" />
            <StatsCard title="الخدمات المفعلة" value={platformLoading ? '—' : enabledServiceCount} icon="local_shipping" tone="indigo" />
            <StatsCard title="مناطق التغطية" value={platformLoading ? '—' : (activeProviders > 0 ? modernCoverageCount : activeZones)} icon="map" tone="blue" />
          </div>

          <div className="shipping-settings-grid">
            <div className="shipping-settings-main">
              {activeProviders === 0 && legacyMode && <details className="shipping-legacy-settings mt-2">
                <summary>إعدادات شحن قديمة للتوافق</summary>
                <p className="muted small">هذه الإعدادات مخصصة للمتاجر القديمة فقط. عند تفعيل شركة شحن حديثة، يتم استخدام نظام الشحن الجديد.</p>
                <Card title="تفعيل الشحن القديم" className="mt-1">
                  <Toggle checked={!!cfg.enabled} onChange={(value) => persistShipping({ enabled: value })} label="تفعيل إعدادات الشحن القديمة" />
                </Card>
                <Card title="إعدادات التسعير القديمة">
                <div className="field">
                  <span className="field-label">نموذج التسعير</span>
                  <div className="shipping-model-grid">
                    <button type="button" className={`shipping-model-card${cfg.model === 'flat' ? ' is-active' : ''}`} onClick={() => persistShipping({ model: 'flat' })}>
                      <span className="shipping-model-body">
                        <span className="shipping-model-title">سعر ثابت</span>
                        <span className="shipping-model-sub">تكلفة موحدة لجميع الطلبات</span>
                      </span>
                      <Icon name="check_circle" ariaHidden />
                    </button>
                    <button type="button" className={`shipping-model-card${cfg.model === 'zones' ? ' is-active' : ''}`} onClick={() => persistShipping({ model: 'zones' })}>
                      <span className="shipping-model-body">
                        <span className="shipping-model-title">حسب المنطقة</span>
                        <span className="shipping-model-sub">تخصيص الأسعار حسب المنطقة الجغرافية</span>
                      </span>
                      <Icon name="check_circle" ariaHidden />
                    </button>
                  </div>
                </div>
                <div className="shipping-fee-grid">
                  {cfg.model === 'flat' && (
                    <div className="field">
                      <span className="field-label">رسوم الشحن الثابتة</span>
                      <div className="input-with-unit">
                        <input className="input" type="number" min="0" value={cfg.flatFee ?? ''} onChange={(e) => persistShipping({ flatFee: Number((e.target as HTMLInputElement).value || 0) })} />
                        <span className="input-unit">ج.م</span>
                      </div>
                    </div>
                  )}
                  <div className="field">
                    <span className="field-label">شحن مجاني للطلبات فوق <span className="field-label-optional">(اختياري)</span></span>
                    <div className="input-with-unit">
                      <input className="input" type="number" min="0" value={cfg.freeAbove ? String(cfg.freeAbove) : ''} onChange={(e) => { const v = (e.target as HTMLInputElement).value; persistShipping({ freeAbove: v === '' ? undefined : Number(v) }) }} />
                      <span className="input-unit">ج.م</span>
                    </div>
                  </div>
                </div>
                </Card>
              </details>}

              {activeProviders > 0 && <Card title="الشحن عبر مزودي المنصة" className="mt-2" titleIcon="local_shipping"><p className="muted small">يتم حساب خيارات الشحن والأسعار ووقت التوصيل من الخدمات المفعّلة بالأعلى عبر نظام الشحن المركزي.</p></Card>}

              <Card title="سياسة الشحن والاسترجاع" className="mt-2" titleIcon="policy" titleIconTone="secondary">
                <div className="muted small mb-1">تظهر هذه المعلومات للعملاء في صفحة إتمام الطلب</div>
                <div className="shipping-policy-editor">
                  <div className="shipping-policy-toolbar">
                    <button type="button" title="عريض" onClick={() => formatPolicy('**', '**')}><Icon name="format_bold" ariaHidden /></button>
                    <button type="button" title="مائل" onClick={() => formatPolicy('_', '_')}><Icon name="format_italic" ariaHidden /></button>
                    <button type="button" title="تسطير" onClick={() => formatPolicy('__', '__')}><Icon name="format_underlined" ariaHidden /></button>
                    <span className="shipping-policy-sep" />
                    <button type="button" title="قائمة نقطية" onClick={() => formatList('- ')}><Icon name="format_list_bulleted" ariaHidden /></button>
                    <button type="button" title="قائمة مرقمة" onClick={() => formatList('')}><Icon name="format_list_numbered" ariaHidden /></button>
                  </div>
                  <textarea className="shipping-policy-textarea" id="shipping-policy-textarea" rows={7} value={cfg.refusedPolicy || ''} onChange={(e) => persistShipping({ refusedPolicy: (e.target as HTMLTextAreaElement).value })} placeholder="اكتب سياسة الشحن والاسترجاع هنا..." />
                </div>
                <div className="flex flex-end mt-1">
                  <Button icon="save" loading={savingCfg} onClick={saveConfig}>حفظ التغييرات</Button>
                </div>
              </Card>
            </div>

            <div className="shipping-settings-side">
              <div className="shipping-preview-card">
                <h4 className="shipping-preview-head"><Icon name="visibility" ariaHidden /> معاينة إتمام الطلب</h4>
                <div className="shipping-preview-sheet">
                  <div className="shipping-preview-row"><span>الإجمالي الفرعي</span><span>450 ج.م</span></div>
                  <div className="shipping-preview-row"><span className="muted small">الشحن ({activeProviders > 0 ? 'مزود المنصة' : cfg.model === 'flat' ? 'سعر ثابت' : 'حسب المنطقة'})</span><span className="font-medium">{activeProviders > 0 ? 'يُحدد عند الدفع' : cfg.model === 'flat' ? `${formatCurrency(cfg.flatFee || 0)}` : '—'}</span></div>
                  <div className="shipping-preview-total"><span>الإجمالي</span><span>{activeProviders > 0 ? 'يُحسب عند الدفع' : formatCurrency(450 + (cfg.model === 'flat' ? Number(cfg.flatFee || 0) : 0))}</span></div>
                  {activeProviders === 0 && cfg.model === 'flat' && !!cfg.freeAbove && Number(cfg.freeAbove) > 450 && (
                    <div className="shipping-free-hint">
                      <Icon name="local_shipping" ariaHidden />
                      <span>أضف منتجات بقيمة {formatCurrency(Number(cfg.freeAbove) - 450)} للحصول على شحن مجاني</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {visibleTab === 'zones' && legacyMode && (
        <div className="mt-2">
          <Card title="مناطق الشحن" actions={<Button icon="add" size="sm" onClick={() => setZoneOpen(true)}>إضافة منطقة</Button>}>
            <Table cardMode
              columns={[
                { key: 'name', header: 'الاسم' },
                { key: 'governorates', header: 'المحافظات', render: (z: ShippingZone) => <span className="muted small">{z.governorates.length} محافظة</span> },
                { key: 'fee', header: 'السعر', render: (z: ShippingZone) => formatCurrency(z.fee || 0) },
                { key: 'freeAbove', header: 'مجاني فوق', render: (z: ShippingZone) => (z.freeAbove ? formatCurrency(z.freeAbove) : '—') },
                { key: 'estimatedDays', header: 'المدة', render: (z: ShippingZone) => z.estimatedDays || '—' },
                { key: 'active', header: 'الحالة', render: (z: ShippingZone) => <Badge tone={z.active ? 'green' : 'slate'}>{z.active ? 'نشطة' : 'موقوفة'}</Badge> },
                { key: 'actions', header: '', render: (z: ShippingZone) => (
                  <div className="flex gap-1">
                    <button type="button" className="icon-btn" onClick={() => { setZoneForm({ id: z.id, name: z.name, governorates: z.governorates || [], fee: String(z.fee || ''), freeAbove: z.freeAbove ? String(z.freeAbove) : '', estimatedDays: z.estimatedDays || '', providerId: z.providerId || '', active: z.active ?? true }); setZoneOpen(true) }}><Icon name="edit" /></button>
                    <button type="button" className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget({ kind: 'zone', id: z.id })}><Icon name="delete" /></button>
                  </div>
                ) },
              ]}
              rows={zones}
            />
          </Card>
        </div>
      )}

      <Modal open={zoneOpen} onClose={() => setZoneOpen(false)} title={zoneForm.id ? 'تعديل منطقة شحن' : 'إضافة منطقة شحن'}>
        <Input label="اسم المنطقة" value={zoneForm.name} onChange={(v) => setZoneForm({ ...zoneForm, name: v })} required placeholder="مثال: القاهرة الكبرى" />
        <div className="field">
          <span className="field-label">المحافظات ({zoneForm.governorates.length})</span>
          <div className="governorate-grid">
            {GOVER_EG.map((g) => (
              <button key={g} type="button" className={`chip ${zoneForm.governorates.includes(g) ? 'chip-active' : ''}`} onClick={() => toggleGovernorate(g)}>{g}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-2">
          <Input label="سعر الشحن" type="number" value={zoneForm.fee} onChange={(v) => setZoneForm({ ...zoneForm, fee: v })} />
          <Input label="شحن مجاني فوق (اختياري)" type="number" value={zoneForm.freeAbove} onChange={(v) => setZoneForm({ ...zoneForm, freeAbove: v })} />
        </div>
        <div className="grid grid-2">
          <Input label="المدة المتوقعة" value={zoneForm.estimatedDays} onChange={(v) => setZoneForm({ ...zoneForm, estimatedDays: v })} placeholder="3-5 أيام" />
          {providers.length > 0 && (
            <div className="field">
              <span className="field-label">شركة التوصيل</span>
              <select className="input" value={zoneForm.providerId} onChange={(e) => setZoneForm({ ...zoneForm, providerId: (e.target as HTMLSelectElement).value })}>
                <option value="">بدون</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="field">
          <Toggle checked={zoneForm.active} onChange={(v) => setZoneForm({ ...zoneForm, active: v })} label="نشطة" />
        </div>
        <div className="flex flex-end">
          <Button variant="ghost" onClick={() => setZoneOpen(false)}>إلغاء</Button>
          <Button onClick={submitZone}>حفظ</Button>
        </div>
      </Modal>

      <Modal open={!!settlementTarget} onClose={() => !settlementSaving && setSettlementTarget(null)} title="تأكيد استلام تسوية من شركة الشحن" footer={<><Button variant="ghost" disabled={settlementSaving} onClick={() => setSettlementTarget(null)}>إلغاء</Button><Button icon="payments" loading={settlementSaving} onClick={recordSettlement}>تأكيد الاستلام وتسجيل التسوية</Button></>}>
        {settlementTarget && <>
          <div className="shipping-settlement-confirm"><strong>{settlementTarget.providerName}</strong><span>{settlementTarget.pendingCount} شحنة COD مسلّمة</span><b>{formatCurrency(settlementTarget.pendingNet)}</b><small>تحصيل {formatCurrency(settlementTarget.pendingGross)} ناقص رسوم شحن {formatCurrency(settlementTarget.pendingFees)}</small></div>
          <div className="shipping-secure-note"><Icon name="warning" ariaHidden /><span>سجّل هذه العملية بعد استلام التحويل أو كشف تسوية مطابق من الشركة. لا يمكن اعتبارها تحويلًا تم تلقائيًا عبر API.</span></div>
          <Input label="مرجع التحويل أو رقم كشف التسوية (اختياري)" value={settlementReference} onChange={setSettlementReference} placeholder="مثال: WSL-SET-2026-09-01" />
          <div className="field"><span className="field-label">ملاحظات (اختياري)</span><textarea className="input" rows={3} value={settlementNote} onInput={(event) => setSettlementNote((event.target as HTMLTextAreaElement).value)} placeholder="أي ملاحظة للمراجعة لاحقًا" /></div>
        </>}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={removeTarget} title="تأكيد الحذف" description="سيتم حذف هذا العنصر نهائياً" confirmLabel="حذف" />
    </div>
  )
}
export default MerchantShipping

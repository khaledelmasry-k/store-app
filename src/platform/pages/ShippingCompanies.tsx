import { FunctionalComponent } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { useLocation } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Badge } from '../../shared/components/ui/Badge'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { Tabs } from '../../shared/components/ui/Tabs'
import { Drawer } from '../../shared/components/ui/Drawer'
import { Toggle } from '../../shared/components/ui/Toggle'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import {
  saveShippingProviderCallable,
  setShippingProviderStatusCallable,
  testShippingConnectionCallable,
} from '../../shared/services/auth'
import type {
  ShippingProviderDefinition,
  ShippingProviderService,
  ShippingZoneRule,
} from '../../shared/types'
import { EGYPT_CITIES_BY_GOVERNORATE, GOVER_EG } from '../../shared/utils/constants'
import { Icon } from '../../shared/components/ui/Icon'
import './ShippingCompanies.css'
import { uploadShippingProviderLogo } from '../../shared/services/uploads'

type Draft = {
  name: string
  slug: string
  description: string
  logoUrl: string
  status: ShippingProviderDefinition['status']
  integrationType: ShippingProviderDefinition['integrationType']
  credentialMode: ShippingProviderDefinition['credentialMode']
  supportsCOD: boolean
  supportsReturns: boolean
  supportsTracking: boolean
  supportsWebhooks: boolean
  supportsPickup: boolean
  allowMerchantRateOverride: boolean
  services: ShippingProviderService[]
  businessProfile: NonNullable<ShippingProviderDefinition['businessProfile']>
  partnership: NonNullable<ShippingProviderDefinition['partnership']>
  publicListing: NonNullable<ShippingProviderDefinition['publicListing']>
  adapterStatus: NonNullable<ShippingProviderDefinition['adapterStatus']>
  branding: NonNullable<ShippingProviderDefinition['branding']>
  integrationConfig: NonNullable<ShippingProviderDefinition['integrationConfig']>
}
type ServiceForm = {
  code: string
  name: string
  serviceType: NonNullable<ShippingProviderService['serviceType']>
  rateMode: NonNullable<ShippingProviderService['rateMode']>
  fixedRate: string
  baseWeight: string
  extraKgRate: string
  estimatedMinHours: string
  estimatedMaxHours: string
  supportsCOD: boolean
  supportsReturns: boolean
  supportsPickup: boolean
  enabled: boolean
}
type ZoneForm = {
  zoneId: string
  zoneName: string
  governorates: string[]
  cities: string
  areas: string
  excludedGovernorates: string
  excludedCities: string
  excludedAreas: string
  baseRate: string
  codFee: string
  returnFee: string
  baseWeight: string
  extraKgRate: string
  freeShippingThreshold: string
  etaMin: string
  etaMax: string
  etaUnit: 'hours' | 'days'
  enabled: boolean
}

const emptyDraft: Draft = {
  name: '',
  slug: '',
  description: '',
  logoUrl: '',
  status: 'draft',
  integrationType: 'manual',
  credentialMode: 'platform',
  supportsCOD: true,
  supportsReturns: false,
  supportsTracking: false,
  supportsWebhooks: false,
  supportsPickup: false,
  allowMerchantRateOverride: false,
  services: [],
  businessProfile: {}, branding: {}, integrationConfig: { requiredFields: [] }, partnership: { status: 'draft' }, publicListing: { enabled: false, sortOrder: 0, shortDescription: '' }, adapterStatus: 'not_implemented',
}
const emptyService: ServiceForm = {
  code: '',
  name: '',
  serviceType: 'standard',
  rateMode: 'zone',
  fixedRate: '',
  baseWeight: '1',
  extraKgRate: '',
  estimatedMinHours: '',
  estimatedMaxHours: '',
  supportsCOD: true,
  supportsReturns: false,
  supportsPickup: false,
  enabled: true,
}
const emptyZone: ZoneForm = {
  zoneId: '',
  zoneName: '',
  governorates: [],
  cities: '',
  areas: '',
  excludedGovernorates: '',
  excludedCities: '',
  excludedAreas: '',
  baseRate: '',
  codFee: '',
  returnFee: '',
  baseWeight: '1',
  extraKgRate: '',
  freeShippingThreshold: '',
  etaMin: '',
  etaMax: '',
  etaUnit: 'hours',
  enabled: true,
}
const splitValues = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const serviceToForm = (service?: ShippingProviderService): ServiceForm => ({
  code: service?.code || '',
  name: service?.name || '',
  serviceType: service?.serviceType || 'standard',
  rateMode: service?.rateMode || 'zone',
  fixedRate: service?.fixedRate == null ? '' : String(service.fixedRate),
  baseWeight: service?.baseWeight == null ? '1' : String(service.baseWeight),
  extraKgRate: service?.extraKgRate == null ? '' : String(service.extraKgRate),
  estimatedMinHours: service?.estimatedMinHours == null ? '' : String(service.estimatedMinHours),
  estimatedMaxHours: service?.estimatedMaxHours == null ? '' : String(service.estimatedMaxHours),
  supportsCOD: service?.supportsCOD !== false,
  supportsReturns: service?.supportsReturns === true,
  supportsPickup: service?.supportsPickup === true,
  enabled: service?.enabled !== false,
})
const zoneToForm = (zone?: ShippingZoneRule): ZoneForm => ({
  zoneId: zone?.zoneId || '',
  zoneName: zone?.zoneName || '',
  governorates: zone?.governorates || [],
  cities: (zone?.cities || []).join(', '),
  areas: (zone?.areas || []).join(', '),
  excludedGovernorates: (zone?.excludedGovernorates || []).join(', '),
  excludedCities: (zone?.excludedCities || []).join(', '),
  excludedAreas: (zone?.excludedAreas || []).join(', '),
  baseRate: zone?.baseRate == null ? '' : String(zone.baseRate),
  codFee: zone?.codFee ? String(zone.codFee) : '',
  returnFee: zone?.returnFee ? String(zone.returnFee) : '',
  baseWeight: zone?.baseWeight == null ? '1' : String(zone.baseWeight),
  extraKgRate: zone?.extraKgRate ? String(zone.extraKgRate) : '',
  freeShippingThreshold: zone?.freeShippingThreshold ? String(zone.freeShippingThreshold) : '',
  etaMin: zone?.etaMin == null ? '' : String(zone.etaMin),
  etaMax: zone?.etaMax == null ? '' : String(zone.etaMax),
  etaUnit: zone?.etaUnit || 'hours',
  enabled: zone?.enabled !== false,
})

export const PlatformShippingCompanies: FunctionalComponent = () => {
  const [, navigate] = useLocation()
  const providers = useCollection<ShippingProviderDefinition>('shippingProviders', {}, true)
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [tab, setTab] = useState('general')
  const [serviceEditor, setServiceEditor] = useState<{ open: boolean; index: number | null }>({
    open: false,
    index: null,
  })
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyService)
  const [zoneEditor, setZoneEditor] = useState<{
    open: boolean
    serviceCode: string
    index: number | null
  }>({ open: false, serviceCode: '', index: null })
  const [zoneForm, setZoneForm] = useState<ZoneForm>(emptyZone)
  const [showAdvancedZone, setShowAdvancedZone] = useState(false)
  const [testing, setTesting] = useState(false)
  const [selectedServiceCode, setSelectedServiceCode] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'service' | 'zone'
    serviceCode?: string
    index: number
  } | null>(null)
  const filtered = useMemo(
    () =>
      providers.data.filter(
        (provider) =>
          (!query ||
            `${provider.name} ${provider.slug}`.toLowerCase().includes(query.toLowerCase())) &&
          (!status || provider.status === status),
      ),
    [providers.data, query, status],
  )

  const startEdit = (provider: ShippingProviderDefinition) => {
    setEditingId(provider.id)
    setDraft({
      name: provider.name,
      slug: provider.slug,
      description: provider.description || '',
      logoUrl: provider.logoUrl || '',
      status: provider.status,
      integrationType: provider.integrationType,
      credentialMode: provider.credentialMode,
      supportsCOD: !!provider.supportsCOD,
      supportsReturns: !!provider.supportsReturns,
      supportsTracking: !!provider.supportsTracking,
      supportsWebhooks: !!provider.supportsWebhooks,
      supportsPickup: !!provider.supportsPickup,
      allowMerchantRateOverride: provider.allowMerchantRateOverride === true,
      services: provider.services || [],
      businessProfile: provider.businessProfile || {}, branding: provider.branding || {}, integrationConfig: provider.integrationConfig || { requiredFields: [] }, partnership: provider.partnership || { status: 'draft' }, publicListing: provider.publicListing || { enabled: false, sortOrder: 0, shortDescription: '' }, adapterStatus: provider.adapterStatus || 'not_implemented',
    })
    setSelectedServiceCode(provider.services?.[0]?.code || '')
    setTab('general')
  }
  const startNew = () => {
    setEditingId('')
    setDraft(emptyDraft)
    setSelectedServiceCode('')
    setTab('general')
  }
  const save = async (nextStatus?: Draft['status']) => {
    if (!draft.name.trim()) {
      toast.push('أدخل اسم شركة الشحن', undefined, 'error')
      setTab('general')
      return
    }
    const providerDraft = {
      ...draft,
      // المزود اليدوي لا يحتاج رمزًا يكتبه مدير المنصة؛ الرمز مطلوب داخليًا فقط.
      slug: draft.slug.trim() || `manual-${editingId || Date.now()}`,
      credentialMode: draft.integrationType === 'manual' ? 'platform' as const : draft.credentialMode,
    }
    setSaving(true)
    try {
      const result = await saveShippingProviderCallable({
        providerId: editingId || undefined,
        provider: { ...providerDraft, status: nextStatus || providerDraft.status },
      })
      const provider = (result.data as any)?.provider
      toast.push(editingId ? 'تم حفظ التعديلات' : 'تم إنشاء مزود الشحن')
      setEditingId(provider?.id || '')
      setDraft(
        provider ? { ...providerDraft, ...provider } : { ...providerDraft, status: nextStatus || providerDraft.status },
      )
    } catch (err: any) {
      toast.push('تعذر حفظ مزود الشحن', err?.message || 'تحقق من البيانات', 'error')
    } finally {
      setSaving(false)
    }
  }
  const persistDraftChange = async (next: Draft, successMessage = 'تم حفظ التعديل') => {
    setDraft(next)
    if (!editingId) return
    setSaving(true)
    try {
      const result = await saveShippingProviderCallable({ providerId: editingId, provider: next })
      const provider = (result.data as any)?.provider
      if (provider) setDraft((current) => ({ ...current, ...provider }))
      toast.push(successMessage)
    } catch (err: any) {
      toast.push('تعذر حفظ التعديل', err?.message || 'حاول مرة أخرى', 'error')
    } finally {
      setSaving(false)
    }
  }
  const openService = (service?: ShippingProviderService, index: number | null = null) => {
    setServiceForm(serviceToForm(service))
    setServiceEditor({ open: true, index })
  }
  const saveService = async () => {
    const code = serviceForm.code.trim().toLowerCase()
    const name = serviceForm.name.trim()
    const min = Number(serviceForm.estimatedMinHours || 0)
    const max = Number(serviceForm.estimatedMaxHours || 0)
    const existingCode =
      serviceEditor.index == null ? '' : draft.services[serviceEditor.index]?.code
    if (!code || !name) {
      toast.push('أدخل اسم الخدمة ورمزها', undefined, 'error')
      return
    }
    if (draft.services.some((service) => service.code === code && service.code !== existingCode)) {
      toast.push('رمز الخدمة مستخدم مسبقاً', undefined, 'error')
      return
    }
    if (
      [
        serviceForm.fixedRate,
        serviceForm.baseWeight,
        serviceForm.extraKgRate,
        serviceForm.estimatedMinHours,
        serviceForm.estimatedMaxHours,
      ].some((value) => value && Number(value) < 0) ||
      (max > 0 && max < min)
    ) {
      toast.push('تحقق من الأسعار والمدة', undefined, 'error')
      return
    }
    const service: ShippingProviderService = {
      code,
      name,
      serviceType: serviceForm.serviceType,
      rateMode: serviceForm.rateMode,
      fixedRate: Number(serviceForm.fixedRate || 0),
      baseWeight: Math.max(0.01, Number(serviceForm.baseWeight || 1)),
      extraKgRate: Number(serviceForm.extraKgRate || 0),
      estimatedMinHours: min,
      estimatedMaxHours: max,
      supportsCOD: serviceForm.supportsCOD,
      supportsReturns: serviceForm.supportsReturns,
      supportsPickup: serviceForm.supportsPickup,
      enabled: serviceForm.enabled,
      zoneRules:
        serviceEditor.index == null ? [] : draft.services[serviceEditor.index]?.zoneRules || [],
    }
    const next = {
      ...draft,
      services:
        serviceEditor.index == null
          ? [...draft.services, service]
          : draft.services.map((item, index) => (index === serviceEditor.index ? service : item)),
    }
    if (serviceEditor.index == null) setSelectedServiceCode(code)
    setServiceEditor({ open: false, index: null })
    await persistDraftChange(next, 'تم حفظ الخدمة')
  }
  const duplicateService = async (service: ShippingProviderService) => {
    const base = `${service.code}-copy`
    let code = base
    let count = 2
    while (draft.services.some((item) => item.code === code)) code = `${base}-${count++}`
    await persistDraftChange(
      {
        ...draft,
        services: [
          ...draft.services,
          {
            ...service,
            code,
            name: `${service.name} — نسخة`,
            zoneRules: service.zoneRules?.map((zone) => ({ ...zone })),
          },
        ],
      },
      'تم نسخ الخدمة',
    )
  }
  const openZone = (serviceCode: string, zone?: ShippingZoneRule, index: number | null = null) => {
    setZoneForm(zoneToForm(zone))
    setShowAdvancedZone(index != null)
    setZoneEditor({ open: true, serviceCode, index })
  }
  const saveZone = async () => {
    const service = draft.services.find((item) => item.code === zoneEditor.serviceCode)
    const zoneName = zoneForm.zoneName.trim()
    const generatedZoneId =
      zoneName
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || `zone-${Date.now()}`
    const zoneId =
      zoneForm.zoneId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-') || generatedZoneId
    const baseRate = Number(zoneForm.baseRate)
    const baseWeight = Number(zoneForm.baseWeight || 1)
    const etaMin = zoneForm.etaMin ? Number(zoneForm.etaMin) : undefined
    const etaMax = zoneForm.etaMax ? Number(zoneForm.etaMax) : undefined
    if (
      !service ||
      !zoneName ||
      zoneForm.baseRate === '' ||
      !Number.isFinite(baseRate) ||
      baseRate < 0 ||
      !Number.isFinite(baseWeight) ||
      baseWeight <= 0 ||
      (etaMin !== undefined && etaMax !== undefined && etaMax < etaMin)
    ) {
      toast.push(
        'اكتب اسم المنطقة وسعر الشحن فقط',
        'باقي الحقول اختيارية ويمكن تعديلها لاحقًا.',
        'error',
      )
      return
    }
    if (
      service.zoneRules?.some((zone, index) => zone.zoneId === zoneId && index !== zoneEditor.index)
    ) {
      toast.push('معرّف المنطقة مستخدم مسبقاً', undefined, 'error')
      return
    }
    const zone: ShippingZoneRule = {
      zoneId,
      zoneName,
      country: 'EG',
      governorates: zoneForm.governorates,
      cities: splitValues(zoneForm.cities),
      areas: splitValues(zoneForm.areas),
      excludedGovernorates: splitValues(zoneForm.excludedGovernorates),
      excludedCities: splitValues(zoneForm.excludedCities),
      excludedAreas: splitValues(zoneForm.excludedAreas),
      baseRate,
      codFee: Number(zoneForm.codFee || 0),
      returnFee: Number(zoneForm.returnFee || 0),
      baseWeight,
      extraKgRate: Number(zoneForm.extraKgRate || 0),
      freeShippingThreshold: Number(zoneForm.freeShippingThreshold || 0),
      etaMin,
      etaMax,
      etaUnit: zoneForm.etaUnit,
      enabled: zoneForm.enabled,
    }
    const next = {
      ...draft,
      services: draft.services.map((item) =>
        item.code !== service.code
          ? item
          : {
              ...item,
              rateMode: 'zone' as const,
              zoneRules:
                zoneEditor.index == null
                  ? [...(item.zoneRules || []), zone]
                  : (item.zoneRules || []).map((existing, index) =>
                      index === zoneEditor.index ? zone : existing,
                    ),
            },
      ),
    }
    setZoneEditor({ open: false, serviceCode: '', index: null })
    await persistDraftChange(next, 'تم حفظ منطقة التغطية')
  }
  const deleteZone = async (serviceCode: string, index: number) =>
    persistDraftChange(
      {
        ...draft,
        services: draft.services.map((service) =>
          service.code === serviceCode
            ? {
                ...service,
                zoneRules: (service.zoneRules || []).filter((_, zoneIndex) => zoneIndex !== index),
              }
            : service,
        ),
      },
      'تم حذف منطقة التغطية',
    )
  const deleteService = async (index: number) =>
    persistDraftChange(
      { ...draft, services: draft.services.filter((_, itemIndex) => itemIndex !== index) },
      'تم حذف الخدمة',
    )
  const toggleStatus = async (provider: ShippingProviderDefinition) => {
    try {
      await setShippingProviderStatusCallable({
        providerId: provider.id,
        status: provider.status === 'active' ? 'inactive' : 'active',
      })
      toast.push(provider.status === 'active' ? 'تم إيقاف المزود' : 'تم تفعيل المزود')
    } catch (err: any) {
      toast.push('تعذر تغيير الحالة', err?.message || 'حاول مرة أخرى', 'error')
    }
  }
  const testConnection = async () => {
    if (draft.integrationType === 'manual') {
      toast.push(
        'المزود اليدوي لا يحتاج اختبار API',
        'تحقق من إعدادات الخدمة والأسعار من تبويبي الخدمات والمناطق.',
        'success',
      )
      return
    }
    if (merchantApiProvider) {
      toast.push(
        'مفتاح الربط خاص بالتاجر',
        'يُجرى اختبار الاتصال من إعدادات الشحن داخل لوحة التاجر بعد أن يحفظ التاجر مفتاحه.',
        'info',
      )
      return
    }
    if (!editingId) {
      toast.push('احفظ المزود أولاً لاختبار الربط', undefined, 'error')
      return
    }
    if (!apiAdapterSupported) {
      toast.push(
        'هذه الشركة غير موصولة آليًا بعد',
        'يمكنك تفعيلها واستخدام خدماتها ومناطقها وأسعارها الآن. اختبار الاتصال يصبح متاحًا بعد إضافة موصل API مخصص لها.',
        'error',
      )
      return
    }
    setTesting(true)
    try {
      const result = await testShippingConnectionCallable({ providerId: editingId })
      const data = result.data as any
      toast.push(
        data?.ok ? 'الاتصال جاهز' : 'التكامل غير مهيأ',
        data?.message,
        data?.ok ? 'success' : 'error',
      )
    } catch (err: any) {
      toast.push('تعذر اختبار الاتصال', err?.message || 'حاول مرة أخرى', 'error')
    } finally {
      setTesting(false)
    }
  }
  const currentService =
    draft.services.find((service) => service.code === selectedServiceCode) || draft.services[0]
  const selectedCities = splitValues(zoneForm.cities)
  const availableCities = Array.from(
    new Set(
      zoneForm.governorates.flatMap(
        (governorate) => EGYPT_CITIES_BY_GOVERNORATE[governorate] || [],
      ),
    ),
  )
  const apiAdapterSupported =
    draft.integrationType === 'api' && ['bosta', 'wasla'].includes(draft.slug.trim().toLowerCase())
  const isWaslaProvider = draft.integrationType === 'api' && draft.slug.trim().toLowerCase() === 'wasla'
  const merchantApiProvider = draft.integrationType === 'api' && draft.credentialMode === 'merchant'
  const manualProvider = draft.integrationType === 'manual'

  return (
    <div className="platform-operations platform-shipping-companies-page shipping-provider-workspace">
      <div className="shipping-editor-header">
        <PageHeader
          title={editingId ? draft.name || 'تعديل مزود الشحن' : 'إضافة شركة شحن'}
          subtitle={merchantApiProvider ? 'أتح الشركة للتجار فقط؛ الربط والأسعار يتبعان حساب كل تاجر لدى الشركة' : 'أضف مزود شحن وحدد خدماته وأسعاره ومناطق التغطية'}
        />
        <div className="shipping-editor-actions">
          <Button variant="outline" onClick={() => navigate('/platform/shipping-companies/applications')}>طلبات الشراكة</Button>
          <Button variant="ghost" onClick={startNew}>
            مزود جديد
          </Button>
          <Button variant="outline" onClick={() => save('draft')} loading={saving}>
            حفظ كمسودة
          </Button>
          <Button onClick={() => save('active')} loading={saving} icon="save">
            حفظ وتفعيل
          </Button>
        </div>
      </div>
      <Card className="shipping-editor-summary">
        <div className="shipping-editor-identity">
          <div className="shipping-logo-frame">
            {draft.logoUrl ? (
              <img src={draft.logoUrl} alt="" />
            ) : (
              <Icon name="local_shipping" ariaHidden />
            )}
          </div>
          <div>
            <strong>{draft.name || 'مزود شحن جديد'}</strong>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              <Badge
                tone={
                  draft.status === 'active'
                    ? 'green'
                    : draft.status === 'inactive'
                      ? 'slate'
                      : 'amber'
                }
              >
                {draft.status === 'active'
                  ? 'نشط'
                  : draft.status === 'inactive'
                    ? 'موقوف'
                    : 'مسودة'}
              </Badge>
              <Badge tone="blue">{draft.integrationType === 'api' ? 'API' : 'يدوي'}</Badge>
              {editingId && <span className="muted small">{draft.slug}</span>}
            </div>
          </div>
        </div>
        <div className="shipping-editor-summary-actions">
          {editingId && (
            <>
              {!manualProvider && !merchantApiProvider && <Button
                size="sm"
                variant="outline"
                onClick={testConnection}
                loading={testing}
                disabled={draft.integrationType === 'manual'}
                title={
                  draft.integrationType === 'manual'
                    ? 'المزود اليدوي لا يحتاج اختبار API'
                    : 'اختبار اتصال المزود'
                }
              >
                اختبار الربط
              </Button>}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft({ ...draft, status: draft.status === 'active' ? 'inactive' : 'active' })
                }
              >
                {draft.status === 'active' ? 'تعطيل' : 'تفعيل'}
              </Button>
            </>
          )}
        </div>
      </Card>
      <Tabs
        tabs={[
          { key: 'general', label: 'عام' },
          ...(!merchantApiProvider ? [{ key: 'services', label: 'الخدمات', count: draft.services.length }, { key: 'zones', label: 'المناطق والأسعار' }] : []),
          ...(!manualProvider ? [{ key: 'api', label: 'التكامل API' }] : []),
          { key: 'capabilities', label: 'الإمكانيات' },
          ...(!manualProvider && !isWaslaProvider ? [{ key: 'webhooks', label: 'Webhooks' }] : []),
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="shipping-editor-panel">
        {tab === 'general' && (
          <Card title="معلومات المزود" subtitle="الهوية الأساسية التي ستظهر للمتاجر">
            <div className="grid grid-2">
              <Input
                label="اسم شركة الشحن"
                value={draft.name}
                onChange={(value) => setDraft({ ...draft, name: value })}
                placeholder="مثال: شحن متجري"
              />
              <label className="field"><span className="field-label">رفع شعار الشركة</span><input className="input" type="file" accept="image/*" disabled={!editingId || saving} onChange={async (event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (!file || !editingId) return; try { const url = await uploadShippingProviderLogo(file, editingId); setDraft((current) => ({ ...current, logoUrl: url, branding: { ...current.branding, logoUrl: url } })); toast.push('تم رفع الشعار') } catch (error: any) { toast.push('تعذر رفع الشعار', error?.message || 'تحقق من الملف', 'error') } }} /><span className="field-hint">يتاح بعد إنشاء المزود ويحفظ في مسار آمن خاص به.</span></label>
              {!manualProvider && <Input
                label="معرّف التكامل"
                helper="رمز الشركة الذي يحدد موصل الـAPI، وليس مفتاح API"
                value={draft.slug}
                onChange={(value) => setDraft({ ...draft, slug: value })}
                placeholder="مثال: wasla أو bosta"
              />}
              <Input
                label="وصف مختصر"
                value={draft.description}
                onChange={(value) => setDraft({ ...draft, description: value })}
                placeholder="وصف يظهر للتاجر"
              />
              <Input
                label="رابط الشعار"
                helper="اختياري"
                value={draft.logoUrl}
                onChange={(value) => setDraft({ ...draft, logoUrl: value })}
                placeholder="https://..."
              />
              <label className="field">
                <span className="field-label">الحالة</span>
                <select
                  className="input"
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      status: (event.target as HTMLSelectElement).value as Draft['status'],
                    })
                  }
                >
                  <option value="draft">مسودة</option>
                  <option value="active">نشطة</option>
                  <option value="inactive">موقوفة</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">نوع التكامل</span>
                <select
                  className="input"
                  value={draft.integrationType}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      integrationType: (event.target as HTMLSelectElement)
                        .value as Draft['integrationType'],
                    })
                  }
                >
                  <option value="manual">يدوي</option>
                  <option value="api">API</option>
                </select>
              </label>
              {!manualProvider && <label className="field">
                <span className="field-label">نوع بيانات الاعتماد</span>
                <select
                  className="input"
                  value={draft.credentialMode}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      credentialMode: (event.target as HTMLSelectElement)
                        .value as Draft['credentialMode'],
                    })
                  }
                >
                  <option value="platform">اعتماد المنصة</option>
                  <option value="merchant">اعتماد التاجر</option>
                  <option value="hybrid">اعتماد مشترك</option>
                </select>
              </label>}
            </div>
            {manualProvider && <p className="field-hint">الشحن اليدوي لا يحتاج API أو مفتاحًا أو اختبار اتصال. أضف فقط الخدمات ومناطق التغطية وأسعارها.</p>}
            <div className="grid grid-2" style={{ marginTop: 16 }}>
              <Input label="الاسم القانوني" value={draft.businessProfile.legalName || ''} onChange={(value) => setDraft({ ...draft, businessProfile: { ...draft.businessProfile, legalName: value } })} />
              <Input label="الموقع الإلكتروني" value={draft.businessProfile.websiteUrl || ''} onChange={(value) => setDraft({ ...draft, businessProfile: { ...draft.businessProfile, websiteUrl: value } })} />
              <Input label="رابط وثائق API" value={draft.businessProfile.apiDocsUrl || ''} onChange={(value) => setDraft({ ...draft, businessProfile: { ...draft.businessProfile, apiDocsUrl: value } })} />
              <Input label="وصف الظهور العام" value={draft.publicListing.shortDescription || ''} onChange={(value) => setDraft({ ...draft, publicListing: { ...draft.publicListing, shortDescription: value } })} />
              <label className="field"><span className="field-label">حالة الشراكة</span><select className="input" value={draft.partnership.status || 'draft'} onChange={(event) => setDraft({ ...draft, partnership: { ...draft.partnership, status: (event.target as HTMLSelectElement).value as any } })}><option value="draft">مسودة</option><option value="onboarding">قيد التجهيز</option><option value="contracted">متعاقدة</option><option value="active">نشطة</option><option value="suspended">موقوفة</option></select></label>
              <label className="field"><span className="field-label">الحالة التقنية</span><select className="input" value={draft.adapterStatus} onChange={(event) => setDraft({ ...draft, adapterStatus: (event.target as HTMLSelectElement).value as any })}><option value="not_implemented">غير منفذ</option><option value="implemented">منفذ</option><option value="testing">قيد الاختبار</option><option value="production_ready">جاهز للإنتاج</option></select></label>
              <label className="field"><span className="field-label">الظهور في صفحة الهبوط</span><input type="checkbox" checked={draft.publicListing.enabled === true} onChange={(event) => setDraft({ ...draft, publicListing: { ...draft.publicListing, enabled: (event.target as HTMLInputElement).checked } })} /></label>
            </div>
          </Card>
        )}
        {tab === 'services' && (
          <Card
            title="الخدمات"
            subtitle="كل خدمة لها تسعير ووقت توصيل وقدرات مستقلة"
            actions={
              <Button size="sm" onClick={() => openService()}>
                + إضافة خدمة
              </Button>
            }
          >
            {draft.services.length === 0 ? (
              <EmptyState
                icon="local_shipping"
                title="لا توجد خدمات بعد"
                description="أضف أول خدمة لبدء إعداد الأسعار والمناطق."
                action={<Button onClick={() => openService()}>إضافة خدمة</Button>}
              />
            ) : (
              <div className="shipping-service-list">
                {draft.services.map((service, index) => (
                  <div
                    className={`shipping-service-card${service.enabled === false ? ' is-disabled' : ''}`}
                    key={service.code}
                  >
                    <div className="shipping-service-card-head">
                      <div>
                        <strong>{service.name}</strong>
                        <span className="muted small">
                          {service.code} · {service.serviceType || 'custom'}
                        </span>
                      </div>
                      <Toggle
                        checked={service.enabled !== false}
                        onChange={(enabled) =>
                          persistDraftChange(
                            {
                              ...draft,
                              services: draft.services.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, enabled } : item,
                              ),
                            },
                            enabled ? 'تم تفعيل الخدمة' : 'تم إيقاف الخدمة',
                          )
                        }
                        label={service.enabled === false ? 'معطلة' : 'نشطة'}
                      />
                    </div>
                    <div className="shipping-service-meta">
                      <span>
                        {service.rateMode === 'zone'
                          ? 'تسعير حسب المنطقة'
                          : service.rateMode === 'weight'
                            ? 'تسعير حسب الوزن'
                            : service.rateMode === 'api'
                              ? 'سعر API'
                              : `${service.fixedRate || 0} ج.م`}
                      </span>
                      <span>
                        ETA: {service.estimatedMinHours || '?'}–{service.estimatedMaxHours || '?'}{' '}
                        ساعة
                      </span>
                      <span>{service.supportsCOD ? 'COD' : 'بدون COD'}</span>
                      <span>{service.zoneRules?.length || 0} مناطق</span>
                    </div>
                    <div className="shipping-service-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openService(service, index)}
                      >
                        تعديل
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => duplicateService(service)}>
                        نسخ
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget({ kind: 'service', index })}
                      >
                        حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
        {tab === 'zones' && (
          <Card title="المناطق والأسعار" subtitle="حدد تغطية كل خدمة وقواعد السعر ووقت التوصيل">
            <div className="field">
              <span className="field-label">الخدمة</span>
              <select
                className="input"
                value={currentService?.code || ''}
                onChange={(event) =>
                  setSelectedServiceCode((event.target as HTMLSelectElement).value)
                }
              >
                <option value="">اختر الخدمة</option>
                {draft.services.map((service) => (
                  <option value={service.code} key={service.code}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
            {currentService ? (
              <>
                <div className="shipping-zone-toolbar">
                  <span className="muted small">
                    {currentService.zoneRules?.length || 0} قواعد تغطية
                  </span>
                  <Button size="sm" onClick={() => openZone(currentService.code)}>
                    + إضافة منطقة
                  </Button>
                </div>
                {(currentService.zoneRules || []).length === 0 ? (
                  <EmptyState
                    icon="map"
                    title="لم تُضف مناطق لهذه الخدمة"
                    description="يمكنك جعل الخدمة تغطي كل مصر أو تحديد محافظات ومدن بعينها."
                    action={
                      <Button onClick={() => openZone(currentService.code)}>إضافة منطقة</Button>
                    }
                  />
                ) : (
                  <div className="shipping-zone-table-wrap">
                    <table className="shipping-zone-table">
                      <thead>
                        <tr>
                          <th>المنطقة</th>
                          <th>المحافظات</th>
                          <th>المدن/المناطق</th>
                          <th>السعر</th>
                          <th>COD</th>
                          <th>المرتجع</th>
                          <th>الوزن</th>
                          <th>ETA</th>
                          <th>الحالة</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {currentService.zoneRules?.map((zone, index) => (
                          <tr key={zone.zoneId}>
                            <td>
                              <strong>{zone.zoneName}</strong>
                              <small>{zone.zoneId}</small>
                            </td>
                            <td>
                              {zone.governorates?.length ? zone.governorates.join('، ') : 'كل مصر'}
                            </td>
                            <td>
                              {[...(zone.cities || []), ...(zone.areas || [])].join('، ') || '—'}
                            </td>
                            <td>{zone.baseRate} ج.م</td>
                            <td>{zone.codFee || 0} ج.م</td>
                            <td>{zone.returnFee || 0} ج.م</td>
                            <td>
                              {zone.baseWeight || 1} كجم + {zone.extraKgRate || 0}
                            </td>
                            <td>
                              {zone.etaMin || '?'}–{zone.etaMax || '?'}{' '}
                              {zone.etaUnit === 'days' ? 'يوم' : 'ساعة'}
                            </td>
                            <td>
                              <Badge tone={zone.enabled === false ? 'slate' : 'green'}>
                                {zone.enabled === false ? 'موقوفة' : 'نشطة'}
                              </Badge>
                            </td>
                            <td>
                              <div className="shipping-row-actions">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openZone(currentService.code, zone, index)}
                                >
                                  تعديل
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: 'zone',
                                      serviceCode: currentService.code,
                                      index,
                                    })
                                  }
                                >
                                  حذف
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon="local_shipping"
                title="أضف خدمة أولاً"
                description="قواعد المناطق تُحفظ على مستوى الخدمة."
              />
            )}
          </Card>
        )}
        {tab === 'api' &&
          (draft.integrationType !== 'api' ? (
            <EmptyState
              icon="api"
              title="التكامل اليدوي مفعّل"
              description="اختر API فقط عند وجود محول مدعوم."
            />
          ) : !apiAdapterSupported ? (
            <EmptyState
              icon="api"
              title="تكامل API غير مهيأ"
              description="المعرّف الحالي ليس محولاً مدعوماً، ولا يمثل مفتاح API."
            />
          ) : (
            <Card
              title={`تكامل ${draft.slug.trim().toLowerCase() === 'wasla' ? 'وصلة' : 'Bosta'} API`}
              subtitle="المفاتيح تُحفظ مشفّرة على الخادم من إعدادات التاجر"
            >
              <div className="shipping-api-grid">
                <div className="shipping-api-status">
                  <span className="shipping-api-status-dot" />
                  <div>
                    <strong>
                      {editingId ? 'جاهز للتحقق من إعداد التاجر' : 'احفظ المزود أولاً'}
                    </strong>
                    <p className="muted small">
                      لا تعني هذه الحالة أن مفتاحًا حُفظ؛ اختبر الربط من إعدادات متجر التاجر بعد
                      إدخال مفتاحه.
                    </p>
                  </div>
                </div>
                <Input label="بيئة التشغيل" value="إدارة الخادم" disabled />
                <Input label="مفتاح API" value="لا يُعرض أو يُدخل من لوحة المنصة" disabled />
                <Input label="آخر اختبار" value="يظهر بعد اختبار التاجر للربط" disabled />
              </div>
              <div className="shipping-secure-note">
                <Icon name="lock" ariaHidden />
                <span>
                  لا تُدخل أسرار شركات الشحن هنا. كل تاجر يحفظ مفتاحه المشفّر من إعدادات الشحن
                  الخاصة بمتجره.
                </span>
              </div>
              <div className="shipping-secure-note"><Icon name="tune" ariaHidden /><span>حقول التكامل المطلوبة (وصفية فقط، دون قيم سرية): {(draft.integrationConfig?.requiredFields || []).length || 0}</span></div>
              {isWaslaProvider && <div className="shipping-secure-note"><Icon name="info" ariaHidden /><span><strong>نطاق وصلة المدعوم حاليًا:</strong> اختبار اتصال، تحميل محافظات ومدن، تسعير مباشر، إنشاء شحنة، وتتبّع/سجل حالة. لا تضف أسعارًا ثابتة أو مناطق محلية لهذه الشركة. Webhooks والإلغاء وAWB/الملصق وإنشاء المرتجع وطلب الاستلام ليست مدعومة بالعقد الحالي، لذلك لا تظهر كميزات متاحة.</span></div>}
            </Card>
          ))}
        {tab === 'capabilities' && (
          <Card title="الإمكانيات" subtitle="حدد ما يمكن للتاجر والعميل استخدامه">
            <div className="shipping-capability-grid">
              {[
                [
                  'supportsCOD',
                  'الدفع عند الاستلام',
                  'قبول الدفع عند الاستلام من العميل',
                  'payments',
                ],
                ['supportsTracking', 'التتبع', 'تحديث حالة الشحنة ورقم التتبع', 'route'],
                [
                  'supportsReturns',
                  'المرتجعات',
                  'دعم إنشاء ومعالجة المرتجعات',
                  'assignment_return',
                ],
                [
                  'supportsPickup',
                  'استلام الشحنات',
                  'طلب استلام الشحنة من نقطة التجميع',
                  'inventory_2',
                ],
                ['supportsWebhooks', 'Webhooks', 'استقبال تحديثات الحالة من المزود', 'webhook'],
              ].filter(([key]) => !(isWaslaProvider && key === 'supportsWebhooks')).map(([key, title, description, icon]) => (
                <div className="shipping-capability-card" key={key}>
                  <span className="shipping-capability-icon">
                    <Icon name={icon} ariaHidden />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                  <Toggle
                    checked={draft[key as keyof Draft] as boolean}
                    onChange={(value) =>
                      persistDraftChange(
                        { ...draft, [key]: value } as Draft,
                        value ? `تم تفعيل ${title}` : `تم إيقاف ${title}`,
                      )
                    }
                  />
                </div>
              ))}
            </div>
            {isWaslaProvider && <div className="shipping-secure-note mt-1"><Icon name="webhook" ariaHidden /><span>لا يوجد Webhook موثّق ومتحقق منه في محول وصلة الحالي، ولذلك لا يمكن تفعيله من الإدارة. تُحدّث حالة الشحنة بجلبها من وصلة عند طلب التحديث.</span></div>}
            {!merchantApiProvider && <label className="shipping-capability-card shipping-capability-card--wide">
              <div>
                <strong>السماح للتاجر بتجاوز السعر الثابت</strong>
                <p>يظهر للتاجر فقط عندما يكون من المسموح تعديل السعر النهائي.</p>
              </div>
              <Toggle
                checked={draft.allowMerchantRateOverride}
                onChange={(value) =>
                  persistDraftChange(
                    { ...draft, allowMerchantRateOverride: value },
                    value ? 'تم السماح بتجاوز السعر' : 'تم إيقاف تجاوز السعر',
                  )
                }
              />
            </label>}
          </Card>
        )}
        {tab === 'webhooks' && !isWaslaProvider &&
          (draft.supportsWebhooks ? (
            <Card title="Webhooks" subtitle="تتبع الأحداث الواردة من شركة الشحن">
              <div className="shipping-webhook-list">
                <div>
                  <span>الحالة</span>
                  <Badge tone="amber">لم يتم الإعداد</Badge>
                </div>
                <div>
                  <span>Endpoint</span>
                  <code>/shippingWebhook/{draft.slug || 'provider'}</code>
                </div>
                <div>
                  <span>التحقق من التوقيع</span>
                  <strong>مطلوب قبل التفعيل</strong>
                </div>
                <div>
                  <span>آخر حدث ناجح</span>
                  <span className="muted">لا توجد أحداث بعد</span>
                </div>
              </div>
            </Card>
          ) : (
            <EmptyState
              icon="webhook"
              title="شركة الشحن لا تدعم Webhooks حالياً"
              description="فعّل القدرة من تبويب الإمكانيات عندما يتوفر adapter يدعمها."
            />
          ))}
      </div>
      <Card className="shipping-provider-list-card">
        <FilterBar
          search={query}
          onSearch={setQuery}
          searchPlaceholder="بحث باسم المزود أو المفتاح..."
          segments={[
            { label: 'الكل', value: '' },
            { label: 'نشطة', value: 'active' },
            { label: 'مسودة', value: 'draft' },
            { label: 'موقوفة', value: 'inactive' },
          ]}
          activeSegment={status}
          onSegmentChange={setStatus}
        />
        <div className="shipping-provider-list">
          {filtered.map((provider) => (
            <div className="shipping-provider-row" key={provider.id}>
              <div className="shipping-logo-frame shipping-logo-frame--sm">
                {provider.logoUrl ? (
                  <img src={provider.logoUrl} alt="" />
                ) : (
                  <Icon name="local_shipping" ariaHidden />
                )}
              </div>
              <div className="shipping-provider-row-main">
                <strong>{provider.name}</strong>
                <span className="muted small">
                  {provider.slug} · {provider.services?.length || 0} خدمات ·{' '}
                  {provider.integrationType === 'api' ? 'API' : 'يدوي'}
                </span>
              </div>
              <Badge
                tone={
                  provider.status === 'active'
                    ? 'green'
                    : provider.status === 'draft'
                      ? 'amber'
                      : 'slate'
                }
              >
                {provider.status === 'active'
                  ? 'نشطة'
                  : provider.status === 'draft'
                    ? 'مسودة'
                    : 'موقوفة'}
              </Badge>
              <div className="shipping-provider-row-actions">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/platform/shipping-companies/${provider.id}`)}
                >
                  التفاصيل
                </Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(provider)}>
                  تعديل
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleStatus(provider)}>
                  {provider.status === 'active' ? 'إيقاف' : 'تفعيل'}
                </Button>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon="local_shipping"
            title="لا توجد نتائج"
            description="أنشئ مزوداً جديداً أو غيّر البحث."
          />
        )}
      </Card>
      <Drawer
        open={serviceEditor.open}
        onClose={() => setServiceEditor({ open: false, index: null })}
        title={serviceEditor.index == null ? 'إضافة خدمة' : 'تعديل الخدمة'}
        size="lg"
      >
        <div className="drawer-section">
          <h4>معلومات الخدمة</h4>
          <div className="grid grid-2">
            <Input
              label="اسم الخدمة"
              value={serviceForm.name}
              onChange={(value) => setServiceForm({ ...serviceForm, name: value })}
            />
            <Input
              label="رمز الخدمة"
              helper="Service Code"
              value={serviceForm.code}
              onChange={(value) => setServiceForm({ ...serviceForm, code: value })}
            />
            <label className="field">
              <span className="field-label">نوع الخدمة</span>
              <select
                className="input"
                value={serviceForm.serviceType}
                onChange={(event) =>
                  setServiceForm({
                    ...serviceForm,
                    serviceType: (event.target as HTMLSelectElement)
                      .value as ServiceForm['serviceType'],
                  })
                }
              >
                <option value="same_day">نفس اليوم</option>
                <option value="next_day">اليوم التالي</option>
                <option value="standard">قياسي</option>
                <option value="economy">اقتصادي</option>
                <option value="express">سريع</option>
                <option value="custom">مخصص</option>
              </select>
            </label>
            <Toggle
              checked={serviceForm.enabled}
              onChange={(enabled) => setServiceForm({ ...serviceForm, enabled })}
              label="الخدمة نشطة"
            />
          </div>
        </div>
        <div className="drawer-section">
          <h4>التسعير</h4>
          <div className="grid grid-2">
            <label className="field">
              <span className="field-label">نموذج التسعير</span>
              <select
                className="input"
                value={serviceForm.rateMode}
                onChange={(event) =>
                  setServiceForm({
                    ...serviceForm,
                    rateMode: (event.target as HTMLSelectElement).value as ServiceForm['rateMode'],
                  })
                }
              >
                <option value="fixed">سعر ثابت</option>
                <option value="zone">حسب المنطقة</option>
                <option value="weight">حسب الوزن</option>
                <option value="hybrid">مختلط</option>
                <option value="api">API</option>
              </select>
            </label>
            {serviceForm.rateMode === 'fixed' && (
              <Input
                label="السعر الأساسي (ج.م)"
                type="number"
                value={serviceForm.fixedRate}
                onChange={(value) => setServiceForm({ ...serviceForm, fixedRate: value })}
              />
            )}
            {(serviceForm.rateMode === 'weight' || serviceForm.rateMode === 'hybrid') && (
              <>
                <Input
                  label="الوزن الأساسي (كجم)"
                  type="number"
                  value={serviceForm.baseWeight}
                  onChange={(value) => setServiceForm({ ...serviceForm, baseWeight: value })}
                />
                <Input
                  label="سعر الكيلو الإضافي"
                  type="number"
                  value={serviceForm.extraKgRate}
                  onChange={(value) => setServiceForm({ ...serviceForm, extraKgRate: value })}
                />
              </>
            )}
          </div>
          <p className="muted small">
            قواعد الأسعار التفصيلية للمناطق تُدار من تبويب «المناطق والأسعار».
          </p>
        </div>
        <div className="drawer-section">
          <h4>وقت التوصيل</h4>
          <div className="grid grid-2">
            <Input
              label="الحد الأدنى (ساعة)"
              type="number"
              value={serviceForm.estimatedMinHours}
              onChange={(value) => setServiceForm({ ...serviceForm, estimatedMinHours: value })}
            />
            <Input
              label="الحد الأقصى (ساعة)"
              type="number"
              value={serviceForm.estimatedMaxHours}
              onChange={(value) => setServiceForm({ ...serviceForm, estimatedMaxHours: value })}
            />
          </div>
        </div>
        <div className="drawer-section">
          <h4>الإمكانيات</h4>
          <div className="flex flex-wrap" style={{ gap: 16 }}>
            <Toggle
              checked={serviceForm.supportsCOD}
              onChange={(supportsCOD) => setServiceForm({ ...serviceForm, supportsCOD })}
              label="الدفع عند الاستلام"
            />
            <Toggle
              checked={serviceForm.supportsReturns}
              onChange={(supportsReturns) => setServiceForm({ ...serviceForm, supportsReturns })}
              label="المرتجعات"
            />
            <Toggle
              checked={serviceForm.supportsPickup}
              onChange={(supportsPickup) => setServiceForm({ ...serviceForm, supportsPickup })}
              label="استلام الشحنات"
            />
          </div>
        </div>
        <div className="drawer-actions">
          <Button onClick={saveService}>حفظ الخدمة</Button>
          <Button variant="outline" onClick={() => setServiceEditor({ open: false, index: null })}>
            إلغاء
          </Button>
        </div>
      </Drawer>
      <Drawer
        open={zoneEditor.open}
        onClose={() => setZoneEditor({ open: false, serviceCode: '', index: null })}
        title={zoneEditor.index == null ? 'إضافة منطقة تغطية' : 'تعديل منطقة التغطية'}
        size="lg"
      >
        {!showAdvancedZone && (
          <div className="drawer-section">
            <h4>إضافة سريعة</h4>
            <p className="muted small">
              اكتب اسم المنطقة وسعر الشحن فقط. ستغطي المنطقة كل مصر افتراضياً، ويمكن تخصيصها لاحقاً.
            </p>
            <div className="grid grid-2">
              <Input
                label="اسم المنطقة"
                placeholder="مثال: القاهرة الكبرى أو باقي المحافظات"
                value={zoneForm.zoneName}
                onChange={(value) => setZoneForm({ ...zoneForm, zoneName: value })}
              />
              <Input
                label="سعر الشحن (ج.م)"
                type="number"
                placeholder="مثال: 65"
                value={zoneForm.baseRate}
                onChange={(value) => setZoneForm({ ...zoneForm, baseRate: value })}
              />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowAdvancedZone(true)}>
              تخصيص المحافظات والمدن والأسعار المتقدمة
            </Button>
          </div>
        )}
        {showAdvancedZone && (
          <>
            <div className="drawer-section">
              <h4>نطاق التغطية</h4>
              <div className="grid grid-2">
                <Input
                  label="معرّف المنطقة"
                  helper="Zone ID"
                  value={zoneForm.zoneId}
                  onChange={(value) => setZoneForm({ ...zoneForm, zoneId: value })}
                />
                <Input
                  label="اسم المنطقة"
                  value={zoneForm.zoneName}
                  onChange={(value) => setZoneForm({ ...zoneForm, zoneName: value })}
                />
              </div>
              <p className="muted small">
                اترك المحافظات بلا تحديد لتغطية كل مصر، أو اختر محافظات محددة.
              </p>
              <div className="shipping-governorate-grid">
                {GOVER_EG.map((governorate) => (
                  <label className="shipping-governorate-option" key={governorate}>
                    <input
                      type="checkbox"
                      checked={zoneForm.governorates.includes(governorate)}
                      onChange={(event) =>
                        setZoneForm({
                          ...zoneForm,
                          governorates: (event.target as HTMLInputElement).checked
                            ? [...zoneForm.governorates, governorate]
                            : zoneForm.governorates.filter((item) => item !== governorate),
                        })
                      }
                    />
                    <span>{governorate}</span>
                  </label>
                ))}
              </div>
              {zoneForm.governorates.length > 0 && (
                <>
                  <p className="muted small mt-1">
                    اختر المدن التي تغطيها هذه المنطقة. عدم اختيار مدينة يعني تغطية كل مدن المحافظات
                    المختارة.
                  </p>
                  <div className="shipping-governorate-grid">
                    {availableCities.map((city) => (
                      <label className="shipping-governorate-option" key={city}>
                        <input
                          type="checkbox"
                          checked={selectedCities.includes(city)}
                          onChange={(event) => {
                            const checked = (event.target as HTMLInputElement).checked
                            const cities = checked
                              ? [...selectedCities, city]
                              : selectedCities.filter((item) => item !== city)
                            setZoneForm({ ...zoneForm, cities: cities.join(', ') })
                          }}
                        />
                        <span>{city}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <div className="grid grid-2 mt-1">
                <Input
                  label="المدن المختارة / مدن إضافية"
                  helper="اختياري — القائمة بالأعلى، أو أضف اسماً مفصولاً بفاصلة"
                  value={zoneForm.cities}
                  onChange={(value) => setZoneForm({ ...zoneForm, cities: value })}
                />
                <Input
                  label="المناطق المحددة"
                  helper="اكتب المناطق مفصولة بفواصل"
                  value={zoneForm.areas}
                  onChange={(value) => setZoneForm({ ...zoneForm, areas: value })}
                />
                <Input
                  label="المحافظات المستبعدة"
                  value={zoneForm.excludedGovernorates}
                  onChange={(value) => setZoneForm({ ...zoneForm, excludedGovernorates: value })}
                />
                <Input
                  label="المدن/المناطق المستبعدة"
                  value={zoneForm.excludedCities}
                  onChange={(value) => setZoneForm({ ...zoneForm, excludedCities: value })}
                />
              </div>
            </div>
            <div className="drawer-section">
              <h4>التسعير</h4>
              <div className="grid grid-3">
                <Input
                  label="السعر الأساسي (ج.م)"
                  type="number"
                  value={zoneForm.baseRate}
                  onChange={(value) => setZoneForm({ ...zoneForm, baseRate: value })}
                />
                <Input
                  label="رسوم COD"
                  type="number"
                  value={zoneForm.codFee}
                  onChange={(value) => setZoneForm({ ...zoneForm, codFee: value })}
                />
                <Input
                  label="رسوم المرتجع"
                  type="number"
                  value={zoneForm.returnFee}
                  onChange={(value) => setZoneForm({ ...zoneForm, returnFee: value })}
                />
                <Input
                  label="الوزن الأساسي (كجم)"
                  type="number"
                  value={zoneForm.baseWeight}
                  onChange={(value) => setZoneForm({ ...zoneForm, baseWeight: value })}
                />
                <Input
                  label="سعر الكيلو الإضافي"
                  type="number"
                  value={zoneForm.extraKgRate}
                  onChange={(value) => setZoneForm({ ...zoneForm, extraKgRate: value })}
                />
                <Input
                  label="حد الشحن المجاني"
                  type="number"
                  value={zoneForm.freeShippingThreshold}
                  onChange={(value) => setZoneForm({ ...zoneForm, freeShippingThreshold: value })}
                />
              </div>
            </div>
            <div className="drawer-section">
              <h4>وقت التوصيل</h4>
              <div className="grid grid-3">
                <Input
                  label="من"
                  type="number"
                  value={zoneForm.etaMin}
                  onChange={(value) => setZoneForm({ ...zoneForm, etaMin: value })}
                />
                <Input
                  label="إلى"
                  type="number"
                  value={zoneForm.etaMax}
                  onChange={(value) => setZoneForm({ ...zoneForm, etaMax: value })}
                />
                <label className="field">
                  <span className="field-label">الوحدة</span>
                  <select
                    className="input"
                    value={zoneForm.etaUnit}
                    onChange={(event) =>
                      setZoneForm({
                        ...zoneForm,
                        etaUnit: (event.target as HTMLSelectElement).value as ZoneForm['etaUnit'],
                      })
                    }
                  >
                    <option value="hours">ساعة</option>
                    <option value="days">يوم</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="drawer-section">
              <Toggle
                checked={zoneForm.enabled}
                onChange={(enabled) => setZoneForm({ ...zoneForm, enabled })}
                label="قاعدة المنطقة نشطة"
              />
            </div>
          </>
        )}
        <div className="drawer-actions">
          <Button onClick={saveZone}>حفظ المنطقة</Button>
          <Button
            variant="outline"
            onClick={() => setZoneEditor({ open: false, serviceCode: '', index: null })}
          >
            إلغاء
          </Button>
        </div>
      </Drawer>
      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          if (deleteTarget.kind === 'service') await deleteService(deleteTarget.index)
          else await deleteZone(deleteTarget.serviceCode || '', deleteTarget.index)
          setDeleteTarget(null)
        }}
        title="تأكيد الحذف"
        description={
          deleteTarget?.kind === 'service'
            ? 'سيتم حذف الخدمة وقواعد مناطقها من هذا المزود.'
            : 'سيتم حذف قاعدة المنطقة من هذه الخدمة.'
        }
        confirmLabel="حذف"
      />
    </div>
  )
}

export default PlatformShippingCompanies

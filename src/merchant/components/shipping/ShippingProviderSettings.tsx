import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Button } from '../../../shared/components/ui/Button'
import { Input } from '../../../shared/components/ui/Input'
import { Toggle } from '../../../shared/components/ui/Toggle'
import { Icon } from '../../../shared/components/ui/Icon'
import { useToast } from '../../../shared/hooks/useToast'
import { getShippingProviderLocationsCallable } from '../../../shared/services/auth'
import type { ShippingProviderDefinition, StoreShippingProviderConfig } from '../../../shared/types'

type ProviderLocation = { id: number; name: string; pickupSupported?: boolean; cities: Array<{ id: number; name: string }> }
type Props = { storeId: string; provider: ShippingProviderDefinition; config: StoreShippingProviderConfig; saving: boolean; onSave: (changes: Record<string, unknown>) => void; onSaveCredentials: (credentials: Record<string, string>) => void }

const standardDraft = (provider: ShippingProviderDefinition, config: StoreShippingProviderConfig) => ({
  fixedRate: String(config.fixedRate ?? ''),
  defaultPackageWeight: String(config.defaultPackageWeight ?? ''),
  codEnabled: config.codEnabled !== false,
  serviceCode: config.serviceCode || provider.services?.[0]?.code || '',
  rateMarkup: String(config.rateMarkup ?? ''),
  freeShippingThreshold: String(config.freeShippingThreshold ?? ''),
})

// Dynamic credential form driven by provider.integrationConfig.requiredFields scope===merchant
const DynamicCredentialsForm: FunctionalComponent<Props> = ({ provider, config, saving, onSaveCredentials }) => {
  const fields = (provider.integrationConfig?.requiredFields || []).filter((f) => f.scope === 'merchant')
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => { setValues({}) }, [provider.id])
  if (fields.length === 0) return null
  const hasSecret = fields.some((f) => f.secret)
  return (
    <div className="shipping-provider-config grid grid-2 mt-1" style={{ gridColumn: '1 / -1' } as any}>
      {fields.map((field) => (
        <div key={field.key} className="field">
          <span className="field-label">{field.label}{field.required ? ' *' : ''}</span>
          {field.type === 'select' && field.options?.length ? (
            <select className="input" value={values[field.key] || ''} onChange={(e) => setValues({ ...values, [field.key]: (e.target as HTMLSelectElement).value })}>
              <option value="">{field.placeholder || `اختر ${field.label}`}</option>
              {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea className="input" rows={3} value={values[field.key] || ''} placeholder={field.placeholder || config.credential?.maskedCredentials?.[field.key] || ''} onInput={(e) => setValues({ ...values, [field.key]: (e.target as HTMLTextAreaElement).value })} />
          ) : (
            <input className="input" type={field.secret ? 'password' : field.type === 'number' ? 'number' : field.type === 'boolean' ? 'checkbox' : 'text'} value={values[field.key] || ''} placeholder={field.placeholder || (field.secret ? (config.credential?.maskedCredentials?.[field.key] || '••••••••') : '')} onInput={(e) => setValues({ ...values, [field.key]: (e.target as HTMLInputElement).value })} />
          )}
          {field.helpText && <span className="field-hint">{field.helpText}</span>}
          {field.secret && config.credential?.maskedCredentials?.[field.key] && <span className="field-hint">محفوظ: {config.credential.maskedCredentials[field.key]}</span>}
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1' }}>
        <Button size="sm" variant="outline" loading={saving} disabled={!Object.values(values).some((v) => String(v).trim())} onClick={() => onSaveCredentials(values)}>حفظ بيانات الربط بأمان</Button>
        {hasSecret && <span className="field-hint" style={{ marginInlineStart: 8 }}>الحقول السرية لا تُعرض بعد الحفظ.</span>}
      </div>
    </div>
  )
}

const WaslaProviderSettings: FunctionalComponent<Props> = ({ storeId, provider, config, saving, onSave, onSaveCredentials }) => {
  const toast = useToast()
  const namespaced = (config.providerConfig?.wasla || {}) as any
  const pickup = namespaced.pickup || {}
  const [draft, setDraft] = useState({
    locationName: String(pickup.locationName ?? (config as any).waslaPickupLocationName ?? ''),
    contactPhone: String(pickup.contactPhone ?? (config as any).waslaPickupContactPhone ?? ''),
    addressLine1: String(pickup.addressLine1 ?? (config as any).waslaPickupAddressLine1 ?? ''),
    governorateId: String(pickup.governorateId ?? (config as any).waslaPickupGovernorateId ?? ''),
    cityId: String(pickup.cityId ?? (config as any).waslaPickupCityId ?? ''),
    apiKey: '',
  })
  const [locations, setLocations] = useState<ProviderLocation[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const loadLocations = async () => {
    setLoadingLocations(true)
    try { const result = await getShippingProviderLocationsCallable({ storeId, providerId: provider.id }); const rows = ((result.data as any)?.locations || []) as ProviderLocation[]; setLocations(rows); toast.push('تم تحميل مناطق شركة الشحن', `ظهرت ${rows.length} محافظة متاحة لحسابك.`, 'success') }
    catch (err: any) { toast.push('تعذر تحميل مناطق شركة الشحن', err?.message || 'احفظ المفتاح واختبره أولاً', 'error') }
    finally { setLoadingLocations(false) }
  }
  useEffect(() => { if (config.enabled && config.configurationStatus === 'CONNECTED') void loadLocations() }, [config.enabled, config.configurationStatus, provider.id])
  const selectedGovernorate = locations.find((location) => String(location.id) === draft.governorateId)
  const merchantFields = (provider.integrationConfig?.requiredFields || []).filter((f) => f.scope === 'merchant')
  // If provider declares merchant fields, render them dynamically alongside pickup UI
  return <div className="shipping-provider-config grid grid-2 mt-1">
    <div className="shipping-secure-note" style={{ gridColumn: '1 / -1' }}><Icon name="info" ariaHidden /><span><strong>إعداد مرة واحدة:</strong> احفظ عنوان الاستلام لهذا المزود؛ سيُرسل تلقائيًا مع كل شحنة.</span></div>
    {merchantFields.length ? <DynamicCredentialsForm storeId={storeId} provider={provider} config={config} saving={saving} onSave={onSave} onSaveCredentials={onSaveCredentials} /> : (
      <>
        <Input label="مفتاح API" type="password" value={draft.apiKey} placeholder={config.credential?.maskedCredentials?.apiKey || 'أدخل مفتاح API الخاص بمتجرك'} onChange={(apiKey) => setDraft((current) => ({ ...current, apiKey }))} />
        <div className="shipping-provider-actions"><Button size="sm" variant="outline" loading={saving} disabled={!draft.apiKey.trim()} onClick={() => onSaveCredentials({ apiKey: draft.apiKey })}>حفظ المفتاح</Button><Button size="sm" variant="outline" loading={loadingLocations} onClick={loadLocations}>{locations.length ? `تحديث المناطق (${locations.length})` : 'تحميل المناطق'}</Button></div>
      </>
    )}
    {merchantFields.length > 0 && <div style={{ gridColumn: '1 / -1' }}><Button size="sm" variant="outline" loading={loadingLocations} onClick={loadLocations}>{locations.length ? `تحديث المناطق (${locations.length})` : 'تحميل المناطق'}</Button></div>}
    <div className="shipping-provider-zone-summary" style={{ gridColumn: '1 / -1' }}><strong>عنوان الاستلام</strong><span className="muted small">يحفظ مرة واحدة للتاجر ويُرسل مع كل شحنة.</span></div>
    <Input label="اسم الفرع أو المخزن" value={draft.locationName} onChange={(locationName) => setDraft((current) => ({ ...current, locationName }))} />
    <Input label="هاتف مسؤول الاستلام" value={draft.contactPhone} onChange={(contactPhone) => setDraft((current) => ({ ...current, contactPhone }))} />
    <Input label="عنوان الفرع أو المخزن" value={draft.addressLine1} onChange={(addressLine1) => setDraft((current) => ({ ...current, addressLine1 }))} />
    <label className="field"><span className="field-label">محافظة الفرع</span><select className="input" value={draft.governorateId} disabled={!locations.length} onChange={(event) => setDraft((current) => ({ ...current, governorateId: (event.target as HTMLSelectElement).value, cityId: '' }))}><option value="">{locations.length ? 'اختر محافظة الفرع' : 'اضغط تحميل المناطق أولاً'}</option>{locations.filter((location) => location.pickupSupported !== false).map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
    <label className="field"><span className="field-label">مدينة الفرع</span><select className="input" value={draft.cityId} disabled={!selectedGovernorate} onChange={(event) => setDraft((current) => ({ ...current, cityId: (event.target as HTMLSelectElement).value }))}><option value="">{selectedGovernorate ? 'اختر مدينة الفرع' : 'اختر المحافظة أولاً'}</option>{(selectedGovernorate?.cities || []).map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}</select></label>
    <div className="shipping-provider-zone-summary"><strong>أسعار الشركة</strong><span className="muted small">تتحقق المنصة من التغطية ثم تجلب السعر الحقيقي للوجهة قبل إتمام الطلب.</span></div>
    <Button size="sm" className="shipping-provider-save" loading={saving} onClick={() => onSave({ serviceCode: config.serviceCode || provider.services?.[0]?.code || '', enabledServiceCodes: config.serviceCode ? [config.serviceCode] : [], defaultPackageWeight: Number((config as any).defaultPackageWeight || 0), codEnabled: (config as any).codEnabled !== false, rateMode: 'api', providerConfig: { wasla: { pickup: { locationType: 'merchant_store', locationName: draft.locationName, contactPhone: draft.contactPhone, addressLine1: draft.addressLine1, governorateId: Number(draft.governorateId || 0), cityId: Number(draft.cityId || 0) } } } })}>حفظ إعدادات الشركة</Button>
  </div>
}

const GenericProviderSettings: FunctionalComponent<Props> = ({ provider, config, saving, onSave, onSaveCredentials }) => {
  const [draft, setDraft] = useState(() => standardDraft(provider, config))
  // If provider declares merchant requiredFields, render dynamic form instead of hardcoded apiKey
  const merchantFields = (provider.integrationConfig?.requiredFields || []).filter((f) => f.scope === 'merchant')
  const hasDynamicFields = merchantFields.length > 0
  const hasRatesFromProvider = provider.capabilities?.includes('getRates') && provider.integrationType === 'api'
  const selectedService = provider.services?.find((service) => service.code === draft.serviceCode)
  // Manual provider should not show credential form at all
  if (provider.integrationType === 'manual' || (provider as any).systemType === 'manual') {
    return <div className="shipping-provider-config grid grid-2 mt-1">
      {provider.services?.length ? <label className="field"><span className="field-label">الخدمة</span><select className="input" value={draft.serviceCode} onChange={(event) => setDraft((current) => ({ ...current, serviceCode: (event.target as HTMLSelectElement).value }))}>{provider.services.filter((service) => service.enabled !== false).map((service) => <option value={service.code} key={service.code}>{service.name}</option>)}</select></label> : null}
      <Input label="وزن الطرد الافتراضي (كجم)" type="number" value={draft.defaultPackageWeight} onChange={(defaultPackageWeight) => setDraft((current) => ({ ...current, defaultPackageWeight }))} />
      {provider.supportsCOD && <Toggle checked={draft.codEnabled} onChange={(codEnabled) => setDraft((current) => ({ ...current, codEnabled }))} label="الدفع عند الاستلام" />}
      <div className="shipping-provider-zone-summary"><strong>ملخص التسعير</strong>{selectedService?.zoneRules?.length ? selectedService.zoneRules.map((zone) => <span key={zone.zoneId}>{zone.zoneName}: {zone.baseRate} ج.م</span>) : <span className="muted small">لا توجد قواعد مناطق؛ استخدم السعر الثابت المعتمد.</span>}</div>
      <Button size="sm" className="shipping-provider-save" loading={saving} onClick={() => onSave({ serviceCode: draft.serviceCode, enabledServiceCodes: draft.serviceCode ? [draft.serviceCode] : [], fixedRate: Number(draft.fixedRate || 0), defaultPackageWeight: Number(draft.defaultPackageWeight || 0), codEnabled: draft.codEnabled, rateMarkup: Number(draft.rateMarkup || 0), freeShippingThreshold: Number(draft.freeShippingThreshold || 0), rateMode: selectedService?.rateMode || 'fixed', isDefault: config.isDefault === true })}>حفظ إعدادات الشركة</Button>
    </div>
  }
  return <div className="shipping-provider-config grid grid-2 mt-1">
    {provider.services?.length ? <label className="field"><span className="field-label">الخدمة</span><select className="input" value={draft.serviceCode} onChange={(event) => setDraft((current) => ({ ...current, serviceCode: (event.target as HTMLSelectElement).value }))}>{provider.services.filter((service) => service.enabled !== false).map((service) => <option value={service.code} key={service.code}>{service.name}</option>)}</select></label> : null}
    {!hasRatesFromProvider && provider.allowMerchantRateOverride && <Input label="السعر الثابت (ج.م)" type="number" value={draft.fixedRate} onChange={(fixedRate) => setDraft((current) => ({ ...current, fixedRate }))} />}
    <Input label="وزن الطرد الافتراضي (كجم)" type="number" value={draft.defaultPackageWeight} onChange={(defaultPackageWeight) => setDraft((current) => ({ ...current, defaultPackageWeight }))} />
    {!hasRatesFromProvider && <Input label="هامش السعر (ج.م)" type="number" value={draft.rateMarkup} onChange={(rateMarkup) => setDraft((current) => ({ ...current, rateMarkup }))} />}
    {!hasRatesFromProvider && <Input label="حد الشحن المجاني (ج.م)" type="number" value={draft.freeShippingThreshold} onChange={(freeShippingThreshold) => setDraft((current) => ({ ...current, freeShippingThreshold }))} />}
    {provider.supportsCOD && <Toggle checked={draft.codEnabled} onChange={(codEnabled) => setDraft((current) => ({ ...current, codEnabled }))} label="الدفع عند الاستلام" />}
    {hasDynamicFields ? <DynamicCredentialsForm storeId={'' as any} provider={provider} config={config} saving={saving} onSave={onSave} onSaveCredentials={onSaveCredentials} /> : (provider.integrationType === 'api' && provider.adapterConfigured && <div className="grid grid-2" style={{ gridColumn: '1 / -1' }}><span className="field-hint">أكمل إعداد الحقول المطلوبة من لوحة المنصة لهذا المزود، ثم احفظ بيانات الربط هنا.</span></div>)}
    <div className="shipping-provider-zone-summary"><strong>ملخص التسعير</strong>{selectedService?.zoneRules?.length ? selectedService.zoneRules.map((zone) => <span key={zone.zoneId}>{zone.zoneName}: {zone.baseRate} ج.م</span>) : <span className="muted small">لا توجد قواعد مناطق؛ استخدم السعر الثابت المعتمد.</span>}</div>
    <Button size="sm" className="shipping-provider-save" loading={saving} onClick={() => onSave({ serviceCode: draft.serviceCode, enabledServiceCodes: draft.serviceCode ? [draft.serviceCode] : [], fixedRate: Number(draft.fixedRate || 0), defaultPackageWeight: Number(draft.defaultPackageWeight || 0), codEnabled: draft.codEnabled, rateMarkup: Number(draft.rateMarkup || 0), freeShippingThreshold: Number(draft.freeShippingThreshold || 0), rateMode: selectedService?.rateMode || 'fixed', isDefault: config.isDefault === true })}>حفظ إعدادات الشركة</Button>
  </div>
}

const BostaProviderSettings: FunctionalComponent<Props> = ({ storeId, provider, config, saving, onSave, onSaveCredentials }) => {
  const [apiKey, setApiKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const merchantFields = (provider.integrationConfig?.requiredFields || []).filter((f) => f.scope === 'merchant')
  if (merchantFields.length) {
    return <GenericProviderSettings storeId={storeId} provider={provider} config={config} saving={saving} onSave={onSave} onSaveCredentials={onSaveCredentials} />
  }
  return <><p className="muted small">أدخل مفاتيح Bosta الخاصة بهذا المتجر فقط، ثم اختبر الاتصال. عنوان Webhook سيظهر بعد نجاح الحفظ.</p><div className="grid grid-2"><Input label="Bosta API Key" type="password" value={apiKey} placeholder={config.credential?.maskedCredentials?.apiKey || 'أدخل مفتاح API'} onChange={setApiKey} /><Input label="Webhook Authorization Key" type="password" value={webhookSecret} placeholder={config.credential?.maskedCredentials?.webhookSecret || 'مطلوب لتأمين Webhook'} onChange={setWebhookSecret} /><Button size="sm" variant="outline" loading={saving} disabled={!apiKey.trim() || !webhookSecret.trim()} onClick={() => onSaveCredentials({ apiKey, webhookSecret })}>حفظ بيانات الربط بأمان</Button></div><GenericProviderSettings storeId={storeId} provider={provider} config={config} saving={saving} onSave={onSave} onSaveCredentials={onSaveCredentials} /></>
}

/** Adapter-driven delegation — no branching on provider display names. Uses adapterKey / systemType metadata. */
export const ShippingProviderSettings: FunctionalComponent<Props> = (props) => {
  const adapterKey = String((props.provider as any).adapterKey || props.provider.slug || '').toLowerCase()
  const systemType = String((props.provider as any).systemType || (props.provider as any).integrationFamily || '').toLowerCase()
  // Handle manual generically
  if (systemType === 'manual' || props.provider.integrationType === 'manual') return <GenericProviderSettings {...props} />
  if (adapterKey === 'wasla' || adapterKey.startsWith('wasla')) return <WaslaProviderSettings {...props} />
  if (adapterKey === 'bosta' || adapterKey.startsWith('bosta')) return <BostaProviderSettings {...props} />
  // For mega / custom and any other adapterKey, use generic dynamic form driven by requiredFields
  return <GenericProviderSettings {...props} />
}

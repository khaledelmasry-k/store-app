import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useDocument } from '../../shared/hooks/useDocument'
import { useCollection } from '../../shared/hooks/useCollection'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Breadcrumb } from '../../shared/components/ui/Breadcrumb'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Badge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Textarea } from '../../shared/components/ui/Textarea'
import { useToast } from '../../shared/hooks/useToast'
import { testShippingConnectionCallable } from '../../shared/services/auth'
import type { ShippingProviderDefinition, Shipment, Store } from '../../shared/types'
import { getShippingProviderCommercialAgreementCallable, saveShippingProviderCommercialAgreementCallable } from '../../shared/services/auth'

type CommercialTier = { minShipments: number; maxShipments: number | null; deliveredCommission: number; returnedCommission: number }
const emptyTier = (): CommercialTier => ({ minShipments: 0, maxShipments: null, deliveredCommission: 0, returnedCommission: 0 })

export const PlatformShippingCompanyDetails: FunctionalComponent<{ id: string }> = ({ id }) => {
  const companyRes = useDocument<ShippingProviderDefinition>('shippingProviders', id)
  const shipmentsRes = useCollection<Shipment>('shipments', { where: { providerId: { value: id } } })
  const storesRes = useCollection<Store>('stores', {})
  const toast = useToast()
  const [testing, setTesting] = useState(false)
  const [agreement, setAgreement] = useState<any>(null)
  const [activeSection, setActiveSection] = useState<'overview' | 'capabilities' | 'eligibility' | 'commercial'>('overview')
  const [agreementForm, setAgreementForm] = useState<{ status: string; effectiveFrom: string; effectiveTo: string; contractReference: string; internalNotes: string; tiers: CommercialTier[] }>({ status: 'draft', effectiveFrom: '', effectiveTo: '', contractReference: '', internalNotes: '', tiers: [] })
  const [savingAgreement, setSavingAgreement] = useState(false)
  const company = companyRes.data
  useEffect(() => {
    if (!company?.id) {
      setAgreement(null)
      return
    }
    void getShippingProviderCommercialAgreementCallable({ providerId: company.id })
      .then((result: any) => {
        const a = result.data?.agreement || {}
        setAgreement(a)
        setAgreementForm({
          status: a.status || 'draft',
          effectiveFrom: a.effectiveFrom ? String(a.effectiveFrom).slice(0, 10) : '',
          effectiveTo: a.effectiveTo ? String(a.effectiveTo).slice(0, 10) : '',
          contractReference: a.contractReference || '',
          internalNotes: a.internalNotes || '',
          tiers: Array.isArray(a.tiers) && a.tiers.length ? a.tiers : [emptyTier()],
        })
      })
      .catch(() => setAgreement({}))
  }, [company?.id])
  if (companyRes.loading) return <Loading variant="screen" />
  if (!company) return <EmptyState icon="local_shipping" title="شركة الشحن غير موجودة" />
  const merchantManagedApi = company.integrationType === 'api' && company.credentialMode === 'merchant'
  const adapterAvailable = company.integrationType === 'manual' || company.adapterStatus === 'production_ready'

  const updateTier = (index: number, patch: Partial<CommercialTier>) => {
    setAgreementForm((f) => ({ ...f, tiers: f.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) }))
  }
  const addTier = () => setAgreementForm((f) => ({ ...f, tiers: [...f.tiers, emptyTier()] }))
  const removeTier = (index: number) => setAgreementForm((f) => ({ ...f, tiers: f.tiers.filter((_, i) => i !== index) }))
  const saveAgreement = async () => {
    setSavingAgreement(true)
    try {
      const payload = {
        providerId: company.id,
        status: agreementForm.status,
        effectiveFrom: agreementForm.effectiveFrom || null,
        effectiveTo: agreementForm.effectiveTo || null,
        contractReference: agreementForm.contractReference || undefined,
        internalNotes: agreementForm.internalNotes || undefined,
        tiers: agreementForm.tiers,
      }
      const result: any = await saveShippingProviderCommercialAgreementCallable(payload)
      setAgreement(result.data?.agreement || null)
      toast.push('تم حفظ الاتفاق التجاري', 'ستُستخدم قيم العمولة هذه في احتساب إيرادات شركات الشحن.', 'success')
    } catch (err: any) {
      toast.push('تعذر حفظ الاتفاق التجاري', err?.message, 'error')
    } finally {
      setSavingAgreement(false)
    }
  }

  const testConnection = async () => {
    if (company.integrationType === 'manual') {
      toast.push('المزود اليدوي لا يحتاج اختبار API', 'تحقق من إعدادات الخدمة والأسعار من شاشة المزود.', 'success')
      return
    }
    if (merchantManagedApi) {
      toast.push('يُختبر الربط من لوحة التاجر', 'كل تاجر يربط مفتاحه الخاص؛ لا يوجد مفتاح للمنصة لاختباره هنا.', 'success')
      return
    }
    setTesting(true)
    try {
      const result = await testShippingConnectionCallable({ providerId: company.id })
      const data = result.data as any
      toast.push(data?.ok ? 'الاتصال جاهز' : 'التكامل غير مهيأ', data?.message, data?.ok ? 'success' : 'error')
    } catch (err: any) {
      toast.push('تعذر اختبار الاتصال', err?.message, 'error')
    } finally {
      setTesting(false)
    }
  }

  return <div className="platform-operations platform-shipping-company-details">
    <Breadcrumb items={[{ label: 'شركات الشحن', href: '/platform/shipping-companies' }, { label: company.name }]} />
    <PageHeader title={company.name} subtitle={merchantManagedApi ? 'شركة API يربطها كل تاجر بحسابه الخاص' : company.description || 'تعريف شركة الشحن وإعدادات التكامل'} actions={<div className="flex" style={{ gap: 8 }}><Badge tone={company.status === 'active' ? 'green' : company.status === 'draft' ? 'amber' : 'slate'}>{company.status === 'active' ? 'نشطة' : company.status === 'draft' ? 'مسودة' : 'موقوفة'}</Badge>{company.integrationType === 'api' && !merchantManagedApi && <Button size="sm" variant="outline" loading={testing} onClick={testConnection}>اختبار الاتصال</Button>}</div>} />
    <nav className="tabs platform-shipping-tabs" aria-label="أقسام شركة الشحن" role="tablist">{([['overview', 'نظرة عامة'], ['capabilities', 'التكامل والتغطية'], ['eligibility', 'أهلية التجار'], ['commercial', 'الاتفاق التجاري']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={activeSection === key} className={`tab ${activeSection === key ? 'tab-active' : ''}`} onClick={() => setActiveSection(key)}>{label}</button>)}</nav>
    {activeSection === 'overview' && <div id="overview" className="stats-grid">
      <StatsCard title="نوع التكامل" value={company.integrationType === 'api' ? 'API' : 'يدوي'} icon="hub" tone="primary" />
      <StatsCard title={merchantManagedApi ? 'ربط التجار' : 'الموصل'} value={merchantManagedApi ? 'من لوحة التاجر' : adapterAvailable ? 'جاهز' : 'غير مهيأ'} icon={merchantManagedApi ? 'storefront' : 'code'} tone={merchantManagedApi || adapterAvailable ? 'green' : 'amber'} />
      <StatsCard title="الشحنات المرتبطة" value={shipmentsRes.data.length} icon="local_shipping" tone="blue" />
      <StatsCard title="المتاجر المستخدمة" value={new Set(shipmentsRes.data.map((s) => s.storeId)).size} icon="storefront" tone="indigo" />
    </div>}
    {activeSection === 'overview' && <Card title="المتاجر المستخدمة"><div id="merchants" className="stack-list">{Array.from(new Set(shipmentsRes.data.map((s) => s.storeId))).map((storeId) => <Link key={storeId} href={`/platform/stores/${storeId}`} className="list-row"><span>{storesRes.data.find((s) => s.id === storeId)?.name || storeId}</span><span className="muted">عرض المتجر</span></Link>)}</div>{shipmentsRes.data.length === 0 && <EmptyState icon="storefront" title="لا توجد شحنات مرتبطة بعد" description="سيظهر هنا استخدام المتاجر للشركة بعد إنشاء أول شحنة." />}</Card>}
    {activeSection === 'capabilities' && <>
    <div id="capabilities" className="platform-detail-grid">
      <Card title="قدرات الشركة"><div className="shipping-capability-list">{[['supportsCOD', 'الدفع عند الاستلام'], ['supportsTracking', 'التتبع'], ['supportsReturns', 'المرتجعات'], ['supportsWebhooks', 'Webhooks'], ['supportsPickup', 'استلام الشحنات']].map(([key, label]) => <span className={company[key as keyof ShippingProviderDefinition] ? 'is-on' : ''} key={key}>{company[key as keyof ShippingProviderDefinition] ? '✓' : '—'} {label}</span>)}</div></Card>
      <Card title={merchantManagedApi ? 'طريقة الربط' : 'الإعدادات الآمنة'}>{merchantManagedApi ? <p className="muted">تُتاح {company.name} للتجار من لوحة الشحن. يضيف كل تاجر مفتاح API الخاص به ويختبره هناك؛ لا تُحفظ مفاتيح التجار أو تُعرض في لوحة المنصة.</p> : <dl className="shipping-provider-dl"><div><dt>Provider key</dt><dd>{company.slug}</dd></div><div><dt>مصدر الاعتماد</dt><dd>{company.credentialMode}</dd></div><div><dt>البلدان</dt><dd>{company.supportedCountries?.join('، ') || 'غير محددة'}</dd></div><div><dt>الأسرار</dt><dd>لا تُعرض في المتصفح</dd></div></dl>}</Card>
      <Card title="الملف التجاري">
        <dl className="shipping-provider-dl">
          <div><dt>الاسم القانوني</dt><dd>{company.businessProfile?.legalName || 'غير محدد'}</dd></div>
          <div><dt>الموقع الإلكتروني</dt><dd>{company.businessProfile?.websiteUrl ? <a href={company.businessProfile.websiteUrl} target="_blank" rel="noreferrer">{company.businessProfile.websiteUrl}</a> : 'غير محدد'}</dd></div>
          <div><dt>توثيق API</dt><dd>{company.businessProfile?.apiDocsUrl ? <a href={company.businessProfile.apiDocsUrl} target="_blank" rel="noreferrer">فتح التوثيق</a> : 'غير محدد'}</dd></div>
        </dl>
      </Card>
    </div>
    <Card title="الخدمات والأسعار"><div className="stack-list">{company.services?.filter((service) => service.enabled !== false).map((service) => <div className="list-row" key={service.code}><div><strong>{service.name}</strong> <span className="muted small">({service.code}) · {service.rateMode === 'zone' ? 'حسب المنطقة' : `${service.fixedRate || 0} ج.م`}</span>{service.zoneRules?.length ? <div className="muted small">{service.zoneRules.map((zone) => `${zone.zoneName}: ${zone.baseRate} ج.م · ${zone.etaMin || '?'}–${zone.etaMax || '?'} ${zone.etaUnit === 'days' ? 'يوم' : 'ساعة'}`).join('، ')}</div> : null}</div><span className="muted small">{service.estimatedMinHours || '?'}–{service.estimatedMaxHours || '?'} ساعة</span></div>) || <p className="muted">لم تُعرّف خدمات بعد.</p>}</div></Card>
    </>}
    {activeSection === 'eligibility' && <Card title="أهلية التجار"><div id="eligibility" className="shipping-provider-dl"><div><dt>الحد الأدنى الشهري</dt><dd>{company.eligibilityConfig?.minimumMerchantMonthlyShipments || 0} شحنة</dd></div><div><dt>جاهزية المحول</dt><dd>{company.integrationType === 'manual' || company.adapterStatus === 'production_ready' ? 'جاهز' : 'غير جاهز'}</dd></div><div><dt>التغطية</dt><dd>{company.services?.reduce((count, service) => count + (service.zoneRules?.length || 0), 0) || 0} منطقة</dd></div><div><dt>الاتفاق التجاري</dt><dd>{agreement?.status === 'active' ? 'نشط' : 'غير نشط'}</dd></div></div></Card>}
    {activeSection === 'commercial' && <Card title="الاتفاق التجاري" subtitle="عمولة التسليم والمرتجع لكل شريحة حجم شحنات — تُستخدم هذه القيم لاحتساب إيرادات شركات الشحن تلقائيًا كل شهر.">
      <div id="commercial" className="grid grid-2">
        <Select label="الحالة" value={agreementForm.status} onChange={(v) => setAgreementForm((f) => ({ ...f, status: v }))} options={[{ value: 'draft', label: 'مسودة' }, { value: 'active', label: 'نشط' }, { value: 'suspended', label: 'موقوف' }, { value: 'expired', label: 'منتهي' }]} />
        <Input label="مرجع العقد (اختياري)" value={agreementForm.contractReference} onChange={(v) => setAgreementForm((f) => ({ ...f, contractReference: v }))} />
        <Input label="سريان الاتفاق من (اختياري)" type="date" value={agreementForm.effectiveFrom} onChange={(v) => setAgreementForm((f) => ({ ...f, effectiveFrom: v }))} />
        <Input label="سريان الاتفاق إلى (اختياري)" type="date" value={agreementForm.effectiveTo} onChange={(v) => setAgreementForm((f) => ({ ...f, effectiveTo: v }))} />
      </div>
      <Textarea label="ملاحظات داخلية (اختياري)" value={agreementForm.internalNotes} onChange={(v) => setAgreementForm((f) => ({ ...f, internalNotes: v }))} rows={2} />

      <div className="commercial-tiers" style={{ marginTop: 16 }}>
        <div className="flex-between"><h4 style={{ margin: 0 }}>شرائح العمولة حسب حجم الشحنات</h4><Button size="sm" variant="outline" icon="add" onClick={addTier}>إضافة شريحة</Button></div>
        <p className="muted small">كل شريحة تحدد نطاق عدد شحنات الشهر (من — إلى)، وعمولة الشركة عن كل شحنة "تم التسليم" وكل شحنة "مرتجعة" ضمن هذا النطاق.</p>
        {agreementForm.tiers.map((tier, i) => (
          <div key={i} className="commercial-tier-row grid grid-4" style={{ alignItems: 'end', gap: 8, marginTop: 8, paddingBottom: 8, borderBottom: '1px solid var(--outline-variant)' }}>
            <Input label="من (عدد شحنات)" type="number" min={0} value={tier.minShipments} onChange={(v) => updateTier(i, { minShipments: Math.max(0, Number(v) || 0) })} />
            <Input label="إلى (اتركه فارغًا = بلا حد)" type="number" min={0} value={tier.maxShipments ?? ''} onChange={(v) => updateTier(i, { maxShipments: v === '' ? null : Math.max(0, Number(v) || 0) })} />
            <Input label="عمولة التسليم (ج.م/شحنة)" type="number" min={0} step="0.01" value={tier.deliveredCommission} onChange={(v) => updateTier(i, { deliveredCommission: Math.max(0, Number(v) || 0) })} />
            <Input label="عمولة المرتجع (ج.م/شحنة)" type="number" min={0} step="0.01" value={tier.returnedCommission} onChange={(v) => updateTier(i, { returnedCommission: Math.max(0, Number(v) || 0) })} />
            <Button variant="ghost" size="sm" icon="delete" onClick={() => removeTier(i)} disabled={agreementForm.tiers.length <= 1}>حذف الشريحة</Button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Button loading={savingAgreement} onClick={saveAgreement}>حفظ الاتفاق التجاري</Button>
      </div>
    </Card>}
  </div>
}

export default PlatformShippingCompanyDetails

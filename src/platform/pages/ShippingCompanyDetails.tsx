import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
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
import { useToast } from '../../shared/hooks/useToast'
import { testShippingConnectionCallable } from '../../shared/services/auth'
import type { ShippingProviderDefinition, Shipment, Store } from '../../shared/types'

export const PlatformShippingCompanyDetails: FunctionalComponent<{ id: string }> = ({ id }) => {
  const companyRes = useDocument<ShippingProviderDefinition>('shippingProviders', id)
  const shipmentsRes = useCollection<Shipment>('shipments', { where: { providerId: { value: id } } })
  const storesRes = useCollection<Store>('stores', {})
  const toast = useToast()
  const [testing, setTesting] = useState(false)
  if (companyRes.loading) return <Loading variant="screen" />
  const company = companyRes.data
  if (!company) return <EmptyState icon="local_shipping" title="شركة الشحن غير موجودة" />
  const merchantManagedApi = company.integrationType === 'api' && company.credentialMode === 'merchant'
  const adapterAvailable = ['wasla', 'bosta'].includes(company.slug.trim().toLowerCase())

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
    <nav className="tabs platform-shipping-tabs" aria-label="أقسام شركة الشحن"><a href="#overview">نظرة عامة</a><a href="#capabilities">القدرات</a><a href="#merchants">المتاجر</a></nav>
    <div id="overview" className="stats-grid">
      <StatsCard title="نوع التكامل" value={company.integrationType === 'api' ? 'API' : 'يدوي'} icon="hub" tone="primary" />
      <StatsCard title={merchantManagedApi ? 'ربط التجار' : 'الموصل'} value={merchantManagedApi ? 'من لوحة التاجر' : adapterAvailable ? 'جاهز' : 'غير مهيأ'} icon={merchantManagedApi ? 'storefront' : 'code'} tone={merchantManagedApi || adapterAvailable ? 'green' : 'amber'} />
      <StatsCard title="الشحنات المرتبطة" value={shipmentsRes.data.length} icon="local_shipping" tone="blue" />
      <StatsCard title="المتاجر المستخدمة" value={new Set(shipmentsRes.data.map((s) => s.storeId)).size} icon="storefront" tone="indigo" />
    </div>
    <div id="capabilities" className="platform-detail-grid">
      <Card title="قدرات الشركة"><div className="shipping-capability-list">{[['supportsCOD', 'الدفع عند الاستلام'], ['supportsTracking', 'التتبع'], ['supportsReturns', 'المرتجعات'], ['supportsWebhooks', 'Webhooks'], ['supportsPickup', 'استلام الشحنات']].map(([key, label]) => <span className={company[key as keyof ShippingProviderDefinition] ? 'is-on' : ''} key={key}>{company[key as keyof ShippingProviderDefinition] ? '✓' : '—'} {label}</span>)}</div></Card>
      <Card title={merchantManagedApi ? 'طريقة الربط' : 'الإعدادات الآمنة'}>{merchantManagedApi ? <p className="muted">تُتاح {company.name} للتجار من لوحة الشحن. يضيف كل تاجر مفتاح API الخاص به ويختبره هناك؛ لا تُحفظ مفاتيح التجار أو تُعرض في لوحة المنصة.</p> : <dl className="shipping-provider-dl"><div><dt>Provider key</dt><dd>{company.slug}</dd></div><div><dt>مصدر الاعتماد</dt><dd>{company.credentialMode}</dd></div><div><dt>البلدان</dt><dd>{company.supportedCountries?.join('، ') || 'غير محددة'}</dd></div><div><dt>الأسرار</dt><dd>لا تُعرض في المتصفح</dd></div></dl>}</Card>
    </div>
    <Card title="الخدمات والأسعار"><div className="stack-list">{company.services?.filter((service) => service.enabled !== false).map((service) => <div className="list-row" key={service.code}><div><strong>{service.name}</strong> <span className="muted small">({service.code}) · {service.rateMode === 'zone' ? 'حسب المنطقة' : `${service.fixedRate || 0} ج.م`}</span>{service.zoneRules?.length ? <div className="muted small">{service.zoneRules.map((zone) => `${zone.zoneName}: ${zone.baseRate} ج.م · ${zone.etaMin || '?'}–${zone.etaMax || '?'} ${zone.etaUnit === 'days' ? 'يوم' : 'ساعة'}`).join('، ')}</div> : null}</div><span className="muted small">{service.estimatedMinHours || '?'}–{service.estimatedMaxHours || '?'} ساعة</span></div>) || <p className="muted">لم تُعرّف خدمات بعد.</p>}</div></Card>
    <Card title="المتاجر المستخدمة"><div id="merchants" className="stack-list">{Array.from(new Set(shipmentsRes.data.map((s) => s.storeId))).map((storeId) => <Link key={storeId} href={`/platform/stores/${storeId}`} className="list-row"><span>{storesRes.data.find((s) => s.id === storeId)?.name || storeId}</span><span className="muted">عرض المتجر</span></Link>)}</div>{shipmentsRes.data.length === 0 && <EmptyState icon="storefront" title="لا توجد شحنات مرتبطة بعد" description="سيظهر هنا استخدام المتاجر للشركة بعد إنشاء أول شحنة." />}</Card>
  </div>
}

export default PlatformShippingCompanyDetails

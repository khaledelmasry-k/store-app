import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { finalizeShippingPartnerRevenuePeriodCallable, getShippingProviderCommercialAgreementCallable, getShippingPartnerRevenuePeriodCallable, markShippingPartnerRevenueSettledCallable } from '../../shared/services/auth'
import { listDocs } from '../../shared/utils/firestore'

const ShippingRevenue: FunctionalComponent = () => {
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([]); const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const [providerFilter, setProviderFilter] = useState('')
  const [hasProviders, setHasProviders] = useState<boolean | null>(null)
  // The filter dropdown must list every active provider. Building its options
  // from `rows` made the list collapse to the selected provider, leaving no way
  // to switch to another one without clearing the filter first.
  const [providerOptions, setProviderOptions] = useState<{ id: string; name: string }[]>([])
  const load = async () => { setLoading(true); try { const providers = await listDocs<any>('shippingProviders', { where: { status: { value: 'active' } } }); setHasProviders(providers.length > 0); setProviderOptions(providers.map((p: any) => ({ id: String(p.id), name: String(p.name || p.id) }))); const next = []; for (const p of providers) { if (providerFilter && p.id !== providerFilter) continue; try { const agreement: any = await getShippingProviderCommercialAgreementCallable({ providerId: p.id }); const revenue: any = await getShippingPartnerRevenuePeriodCallable({ providerId: p.id, period: month }); next.push({ provider: p, agreement: agreement.data?.agreement, period: revenue.data?.period }) } catch { next.push({ provider: p, agreement: null, period: null }) } } setRows(next) } finally { setLoading(false); setInitialLoading(false) } }
  useEffect(() => { void load() }, [month, providerFilter])
  const hasAnyRevenue = rows.some((r) => (r.period?.shipmentVolume || 0) > 0 || r.period?.totalRevenue != null)
  return <div className="platform-operations"><PageHeader title="إيرادات الشحن" subtitle="إيرادات شركات الشحن منفصلة عن إيرادات الاشتراكات." /><div className="grid grid-2 mt-2"><label className="field"><span className="field-label">الشركة</span><select className="input" value={providerFilter} onChange={(e) => setProviderFilter((e.target as HTMLSelectElement).value)}><option value="">كل الشركات</option>{providerOptions.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label className="field"><span className="field-label">الشهر</span><input className="input" type="month" value={month} onChange={(e) => setMonth((e.target as HTMLInputElement).value)} /></label></div>
    {initialLoading ? <div style={{ padding: 40, textAlign: 'center' }}><Loading /><p className="muted small" style={{ marginTop: 12 }}>جارٍ تحميل بيانات الإيرادات...</p></div>
      : hasProviders === false ? <EmptyState icon="local_shipping" title="لا توجد شركات شحن نشطة" description="أضف شركة شحن وفعّلها من صفحة شركات الشحن قبل مراجعة الإيرادات." />
      : rows.length === 0 ? <EmptyState icon="payments" title="لا توجد بيانات للشهر المحدد" description="اختر شركة أو غيّر الشهر." />
      : !hasAnyRevenue ? <Card><EmptyState icon="payments" title="لا توجد بيانات إيرادات شحن لهذه الفترة بعد" description="ستظهر الإيرادات هنا بعد تسليم شحنات ضمن هذه الفترة وربطها باتفاق تجاري نشط. البيانات لا تُختلق — تُحتسب من الشحنات الفعلية." /></Card>
      : <div className="card-grid" aria-busy={loading} style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s ease' }}>{rows.map((row) => <Card key={row.provider.id} title={row.provider.name}><div className="shipping-revenue-summary" style={{ display: 'grid', gap: 6 }}><strong style={{ fontSize: '1.2rem' }}>{row.period?.totalRevenue == null ? '—' : `${row.period.totalRevenue} ج.م`}</strong><span>{row.period?.estimated ? 'تقديري' : row.period?.status || 'OPEN'} · {row.period?.shipmentVolume || 0} شحنة</span><small>Delivered: {row.period?.deliveredCount || 0} · Returned: {row.period?.returnedCount || 0} · Pending: {row.period?.pendingCount || 0}</small><small>حالة الاتفاق: {row.agreement?.status || 'غير مفعّل'}</small>{row.period?.status === 'OPEN' && (row.period?.shipmentVolume || 0) > 0 && <button type="button" className="btn btn-sm" onClick={() => void finalizeShippingPartnerRevenuePeriodCallable({ providerId: row.provider.id, period: month }).then(load)}>تثبيت الفترة</button>}{row.period?.status === 'FINALIZED' && <button type="button" className="btn btn-sm" onClick={() => void markShippingPartnerRevenueSettledCallable({ providerId: row.provider.id, period: month }).then(load)}>تحديد كمسوّاة</button>}</div></Card>)}</div>}</div>
}
export default ShippingRevenue

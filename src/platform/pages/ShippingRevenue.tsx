import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Loading } from '../../shared/components/ui/Loading'
import { getShippingProviderCommercialAgreementCallable, getShippingPartnerRevenuePeriodCallable } from '../../shared/services/auth'
import { listDocs } from '../../shared/utils/firestore'

const ShippingRevenue: FunctionalComponent = () => {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { void (async () => { try { const providers = await listDocs<any>('shippingProviders', { where: { status: { value: 'active' } } }); const period = new Date().toISOString().slice(0, 7); const next = []; for (const p of providers) { const agreement: any = await getShippingProviderCommercialAgreementCallable({ providerId: p.id }); const revenue: any = await getShippingPartnerRevenuePeriodCallable({ providerId: p.id, period }); next.push({ provider: p, agreement: agreement.data?.agreement, period: revenue.data?.period }) } setRows(next) } finally { setLoading(false) } })() }, [])
  return <div className="platform-operations"><PageHeader title="إيرادات الشحن" subtitle="إيرادات شركات الشحن منفصلة عن إيرادات الاشتراكات." />{loading ? <Loading /> : <div className="card-grid">{rows.map((row) => <Card key={row.provider.id} title={row.provider.name}><div className="shipping-revenue-summary"><strong>{row.period?.totalRevenue || 0} ج.م</strong><span>الفترة الحالية · {row.period?.shipmentVolume || 0} شحنة</span><small>Delivered: {row.period?.deliveredCount || 0} · Returned: {row.period?.returnedCount || 0}</small><small>حالة الاتفاق: {row.agreement?.status || 'غير مفعّل'}</small></div></Card>)}</div>}</div>
}
export default ShippingRevenue

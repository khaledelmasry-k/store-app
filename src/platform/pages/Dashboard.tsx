import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { LineChart } from '../../shared/components/charts/LineChart'
import { useCollection } from '../../shared/hooks/useCollection'
import { Loading } from '../../shared/components/ui/Loading'
import { formatCurrency, timeAgo } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Button } from '../../shared/components/ui/Button'
import type { Store, Order, Subscription } from '../../shared/types'

export const PlatformDashboard: FunctionalComponent = () => {
  const storesRes = useCollection<Store>('stores', { orderBy: { field: 'createdAt' } })
  const ordersRes = useCollection<Order>('orders', { orderBy: { field: 'createdAt' } })
  const subsRes = useCollection<Subscription>('subscriptions', { orderBy: { field: 'createdAt' } })
  const analyticsRes = useCollection<any>('analytics', { orderBy: { field: 'date' } })

  const stores = storesRes.data
  const orders = ordersRes.data
  const subs = subsRes.data
  const analytics = analyticsRes.data

  if (storesRes.loading || ordersRes.loading || subsRes.loading || analyticsRes.loading) {
    return <Loading />
  }

  const revenue = orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + o.totalPrice, 0)
  const activeStores = stores.filter((s) => s.active).length
  const activeSubs = subs.filter((s) => s.status === 'active').length

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { key, date: d }
  })
  const revenueSeries = last14.map(({ key }) => analytics.filter((a: any) => a.date === key).reduce((s, a: any) => s + (a.revenue || 0), 0))
  const ordersSeries = last14.map(({ key }) => analytics.filter((a: any) => a.date === key).reduce((s, a: any) => s + (a.orders || 0), 0))

  return (
    <div>
      <PageHeader
        title="نظرة عامة على المنصة"
        subtitle="ملخص أداء جميع المتاجر"
        actions={
          <Link href="/platform/merchants">
            <Button variant="outline" icon="add">إضافة متجر</Button>
          </Link>
        }
      />
      <div className="stats-grid">
        <StatsCard title="المتاجر النشطة" value={activeStores} icon="store" tone="primary" changeLabel={`من ${stores.length} إجمالاً`} />
        <StatsCard title="الاشتراكات النشطة" value={activeSubs} icon="card_membership" tone="blue" changeLabel={`من ${subs.length} اشتراك`} />
        <StatsCard title="إجمالي الطلبات" value={orders.length} icon="receipt_long" tone="green" />
        <StatsCard title="إيرادات مؤكدة" value={revenue} currency icon="payments" tone="amber" />
      </div>
      <div className="grid grid-2 mb-2">
        <Card title="الإيرادات (آخر 14 يوم)" subtitle="إيرادات مؤكدة يومياً">
          {revenueSeries.every((v) => v === 0) ? (
            <EmptyState title="لا توجد إيرادات" description="سيظهر بيانات المبيعات هنا بمجرد ظهور طلبات مكتملة" />
          ) : (
            <div style={{ height: 220 }}>
              <LineChart values={revenueSeries} />
            </div>
          )}
        </Card>
        <Card title="الطلبات (آخر 14 يوم)">
          {ordersSeries.every((v) => v === 0) ? (
            <EmptyState title="لا توجد طلبات" description="ستظهر طلبات العملاء هنا" />
          ) : (
            <div style={{ height: 220 }}>
              <LineChart values={ordersSeries} color="var(--success)" />
            </div>
          )}
        </Card>
      </div>
      <Card title="أحدث الطلبات" subtitle="آخر الطلبات عبر المنصة">
        {orders.length === 0 ? (
          <EmptyState title="لا توجد طلبات" description="لم يتم إنشاء أي طلبات بعد" />
        ) : (
          <Table
            columns={[
              { key: 'orderNumber', header: 'رقم الطلب', render: (o: Order) => <span className="monospace">{o.orderNumber}</span> },
              { key: 'storeId', header: 'المتجر', render: (o: Order) => stores.find((s) => s.id === o.storeId)?.name || '—' },
              { key: 'customerName', header: 'العميل' },
              { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
              { key: 'status', header: 'الحالة', render: (o: Order) => <Badge tone={STATUS_COLORS[o.status]}>{STATUS_LABELS[o.status]}</Badge> },
              { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{timeAgo(o.createdAt)}</span> },
            ]}
            rows={orders.slice(0, 8)}
          />
        )}
      </Card>
    </div>
  )
}
export default PlatformDashboard

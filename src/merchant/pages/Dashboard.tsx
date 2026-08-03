import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { LineChart } from '../../shared/components/charts/LineChart'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { formatCurrency, timeAgo } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { Button } from '../../shared/components/ui/Button'
import type { Order, Product, StoreLink } from '../../shared/types'

export const MerchantDashboard: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''

  const ordersRes = useCollection<Order>('orders', { storeId, orderBy: { field: 'createdAt' } })
  const productsRes = useCollection<Product>('products', { storeId })
  const customersRes = useCollection('customers', { storeId })
  const analyticsRes = useCollection<any>('analytics', { storeId })
  const linksRes = useCollection<StoreLink>('storeLinks', { storeId })

  const orders = ordersRes.data
  const products = productsRes.data
  const customers = customersRes.data
  const analytics = analyticsRes.data
  const links = linksRes.data

  if (ordersRes.loading || productsRes.loading || customersRes.loading || analyticsRes.loading || linksRes.loading) {
    return <Loading />
  }

  const confirmed = orders.filter((o) => o.status === 'DELIVERED')
  const revenue = confirmed.reduce((s, o) => s + o.totalPrice, 0)
  const pending = orders.filter((o) => ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED'].includes(o.status))
  const lowStock = products.filter((p) => p.stock <= (p.lowStockThreshold ?? 5) && p.active)

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const revenueSeries = last14.map((key) => analytics.filter((a) => a.date === key).reduce((s, a) => s + (a.revenue || 0), 0))
  const ordersSeries = last14.map((key) => analytics.filter((a) => a.date === key).reduce((s, a) => s + (a.orders || 0), 0))

  return (
    <div>
      <PageHeader
        title={`مرحباً بك في ${store?.name || 'متجرك'}`}
        subtitle="نظرة عامة على أداء متجرك اليوم"
        actions={<Link href={`/store/${store?.slug}`}><Button variant="outline" icon="store">عرض المتجر</Button></Link>}
      />
      <div className="stats-grid">
        <StatsCard title="إيرادات مؤكدة" value={revenue} currency icon="payments" tone="green" />
        <StatsCard title="طلبات معلقة" value={pending.length} icon="pending_actions" tone="amber" />
        <StatsCard title="إجمالي الطلبات" value={orders.length} icon="receipt_long" tone="primary" />
        <StatsCard title="المنتجات النشطة" value={products.filter((p) => p.active).length} icon="inventory_2" tone="blue" />
        <StatsCard title="العملاء" value={customers.length} icon="groups" tone="violet" />
      </div>
      <div className="grid grid-2 mb-2">
        <Card title="الإيرادات (آخر 14 يوم)">
          <div style={{ height: 220 }}><LineChart values={revenueSeries} /></div>
        </Card>
        <Card title="الطلبات (آخر 14 يوم)">
          <div style={{ height: 220 }}><LineChart values={ordersSeries} color="var(--success)" /></div>
        </Card>
      </div>
      {lowStock.length > 0 && (
        <Card title="تنبيهات المخزون" className="mb-2">
          {lowStock.map((p) => (
            <div key={p.id} className="flex-between mb-1">
              <span>{p.name}</span>
              <Badge tone={p.stock === 0 ? 'red' : 'amber'}>المتبقي: {p.stock}</Badge>
            </div>
          ))}
        </Card>
      )}
      {links.length > 0 && (
        <Card title="أداء روابط البيع" className="mb-2" subtitle="أفضل الروابط حسب الإيرادات">
          <Table
            columns={[
              { key: 'title', header: 'الرابط' },
              { key: 'visits', header: 'الزيارات', render: (l: StoreLink) => <Badge>{l.visits || 0}</Badge> },
              { key: 'ordersCount', header: 'الطلبات', render: (l: StoreLink) => <Badge tone="indigo">{l.ordersCount || 0}</Badge> },
              { key: 'totalRevenue', header: 'الإيرادات', render: (l: StoreLink) => formatCurrency(l.totalRevenue || 0) },
            ]}
            rows={[...links].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0)).slice(0, 5)}
          />
        </Card>
      )}
      <Card title="أحدث الطلبات">
        {orders.length === 0 ? (
          <EmptyState
            title="لا توجد طلبات بعد"
            description="عند وصول طلبات من متجرك ستظهر هنا مباشرة."
            icon="receipt_long"
            action={<Link href={`/store/${store?.slug}`}><Button variant="outline" size="sm">عرض متجرك</Button></Link>}
          />
        ) : (
          <Table
            columns={[
              { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <Link href={`/dashboard/orders/${o.id}`}><span className="monospace">{o.orderNumber}</span></Link> },
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
export default MerchantDashboard

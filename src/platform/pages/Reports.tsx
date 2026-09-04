import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { Table } from '../../shared/components/ui/Table'
import { BarChart } from '../../shared/components/charts/BarChart'
import { DonutChart } from '../../shared/components/charts/DonutChart'
import { useCollection } from '../../shared/hooks/useCollection'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { deliveredRevenue, formatCurrency } from '../../shared/utils/format'
import type { Order } from '../../shared/types'

const STATUS_ORDER = ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']

export const PlatformReports: FunctionalComponent = () => {
  const ordersRes = useCollection<Order>('orders', { orderBy: { field: 'createdAt' } })
  const orders = ordersRes.data
  const storesRes = useCollection('stores', {})
  const stores = storesRes.data

  if (ordersRes.loading || storesRes.loading) return <Loading />

  const revenue = deliveredRevenue(orders)
  const delivered = orders.filter((o) => o.status === 'DELIVERED').length
  const cancelled = orders.filter((o) => o.status === 'CANCELLED' || o.status === 'RETURNED').length

  const byStore = stores
    .map((s: any) => {
      const storeOrders = orders.filter((o) => o.storeId === s.id)
      return {
        id: s.id,
        name: s.name,
        count: storeOrders.length,
        revenue: storeOrders.filter((o) => o.status === 'DELIVERED').reduce((sum, o) => sum + o.totalPrice, 0),
      }
    })
    .sort((a: any, b: any) => b.count - a.count)

  const byStatus = STATUS_ORDER
    .map((status) => ({
      label: STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status,
      value: orders.filter((o) => o.status === status).length,
      color: `var(--${STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'slate'})`,
    }))
    .filter((s) => s.value > 0)

  return (
    <div className="platform-operations platform-reports-page">
      <PageHeader title="تقارير المنصة" subtitle="أداء المتاجر وإجمالي العمليات" />

      <div className="stats-grid mb-2">
        <StatsCard title="إجمالي الطلبات" value={orders.length} icon="receipt_long" tone="primary" />
        <StatsCard title="الإيرادات المحققة" value={revenue} currency icon="payments" tone="green" />
        <StatsCard title="طلبات تم توصيلها" value={delivered} icon="local_shipping" tone="blue" />
        <StatsCard title="ملغي / مرتجع" value={cancelled} icon="block" tone="red" />
      </div>

      <div className="grid grid-2 mb-2">
        <Card title="الطلبات حسب المتجر" subtitle={stores.length ? `أداء أعلى ${Math.min(byStore.length, 10)} متجر` : undefined}>
          {byStore.length === 0 ? (
            <EmptyState title="لا توجد طلبات" description="ستظهر طلبات المتاجر هنا" />
          ) : (
            <BarChart
              values={byStore.slice(0, 10).map((s: any) => s.count)}
              labels={byStore.slice(0, 10).map((s: any) => s.name)}
              color="var(--violet)"
            />
          )}
        </Card>
        <Card title="توزيع حالات الطلبات" subtitle={`${orders.length} طلب`}>
          {byStatus.length === 0 ? (
            <EmptyState title="لا توجد طلبات" description="لم يتم إنشاء أي طلبات بعد" />
          ) : (
            <DonutChart data={byStatus} />
          )}
        </Card>
      </div>

      <Card title="أفضل المتاجر" subtitle="حسب عدد الطلبات والإيرادات">
        <Table
          cardMode
          columns={[
            { key: 'name', header: 'المتجر', render: (s: any) => <span style={{ fontWeight: 600 }}>{s.name}</span> },
            { key: 'count', header: 'الطلبات' },
            { key: 'revenue', header: 'الإيرادات', render: (s: any) => formatCurrency(s.revenue) },
          ]}
          rows={byStore.slice(0, 10) as any}
          emptyMessage="لا توجد بيانات"
        />
      </Card>
    </div>
  )
}
export default PlatformReports

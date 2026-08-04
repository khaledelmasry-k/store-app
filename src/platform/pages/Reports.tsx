import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { BarChart } from '../../shared/components/charts/BarChart'
import { DonutChart } from '../../shared/components/charts/DonutChart'
import { useCollection } from '../../shared/hooks/useCollection'
import type { Order } from '../../shared/types'

export const PlatformReports: FunctionalComponent = () => {
  const ordersRes = useCollection<Order>('orders', { orderBy: { field: 'createdAt' } });
  const orders = ordersRes.data
  const storesRes = useCollection('stores', {});
  const stores = storesRes.data

  const byStore = stores.map((s: any) => {
    const storeOrders = orders.filter((o) => o.storeId === s.id)
    return {
      id: s.id,
      name: s.name,
      count: storeOrders.length,
      revenue: storeOrders.filter((o) => o.status === 'DELIVERED').reduce((sum, o) => sum + o.totalPrice, 0),
    }
  })

  const byStatus = ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'].map((status) => ({
    label: status,
    value: orders.filter((o) => o.status === status).length,
    color: '#6366f1',
  }))

  return (
    <div>
      <PageHeader title="تقارير المنصة" subtitle="أداء المتاجر وإجمالي العمليات" />
      <div className="grid grid-2 mb-2">
        <Card title="الطلبات حسب المتجر">
          <BarChart values={byStore.map((s) => s.count)} labels={byStore.map((s) => s.name)} />
          <Table
            columns={[
              { key: 'name', header: 'المتجر' },
              { key: 'count', header: 'الطلبات' },
              { key: 'revenue', header: 'الإيرادات' },
            ]}
            rows={byStore}
          />
        </Card>
        <Card title="توزيع حالات الطلبات">
          <div className="flex" style={{ justifyContent: 'center', padding: 20 }}>
            <DonutChart data={byStatus} />
          </div>
        </Card>
      </div>
    </div>
  )
}
export default PlatformReports

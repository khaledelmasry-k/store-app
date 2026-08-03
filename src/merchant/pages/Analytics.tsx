import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { LineChart } from '../../shared/components/charts/LineChart'
import { DonutChart } from '../../shared/components/charts/DonutChart'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollection } from '../../shared/hooks/useCollection'
import { STATUS_LABELS } from '../../shared/utils/constants'
import type { Order } from '../../shared/types'

export const MerchantAnalytics: FunctionalComponent = () => {
  const { store } = useStore()
  const { user } = useAuth()
  const storeId = store?.id || ''
  // L1: customers collection requires customers:manage for staff. Merchants pass.
  const canCustomers = user?.role === 'merchant' || (user?.permissions || []).includes('customers:manage')
  const ordersRes = useCollection<Order>('orders', { storeId });
  const orders = ordersRes.data
  const customersRes = useCollection('customers', { storeId }, canCustomers);
  const customers = customersRes.data
  const analyticsRes = useCollection<any>('analytics', { storeId });
  const analytics = analyticsRes.data

  const revenue = orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + o.totalPrice, 0)
  const conversion = customers.length ? orders.length / Math.max(customers.length, 1) : 0

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const revenueSeries = last30.map((key) => analytics.filter((a) => a.date === key).reduce((s, a) => s + (a.revenue || 0), 0))

  const statusData = Object.keys(STATUS_LABELS).map((status, i) => ({
    label: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
    value: orders.filter((o) => o.status === status).length,
    color: ['#6366f1', '#8b5cf6', '#d97706', '#0284c7', '#16a34a', '#dc2626', '#64748b'][i % 7],
  }))

  return (
    <div>
      <PageHeader title="التحليلات" subtitle="مؤشرات الأداء على مدار 30 يوماً" />
      <div className="stats-grid">
        <StatsCard title="الإيرادات" value={revenue} currency icon="payments" tone="green" />
        <StatsCard title="الطلبات" value={orders.length} icon="receipt_long" tone="blue" />
        {canCustomers ? (
          <>
            <StatsCard title="العملاء" value={customers.length} icon="groups" tone="primary" />
            <StatsCard title="معدل الطلبات/عميل" value={conversion.toFixed(2)} icon="trending_up" tone="amber" />
          </>
        ) : (
          <StatsCard title="العملاء" value="—" icon="groups" tone="primary" />
        )}
      </div>
      <div className="grid grid-2">
        <Card title="الإيرادات (30 يوم)">
          <div style={{ height: 240 }}><LineChart values={revenueSeries} /></div>
        </Card>
        <Card title="توزيع الطلبات">
          <div className="flex" style={{ justifyContent: 'center', padding: 20 }}>
            <DonutChart data={statusData} />
          </div>
          <div className="flex" style={{ flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            {statusData.map((s) => (
              <span key={s.label} className="small flex">
                <span className="badge">{s.label}</span> {s.value}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
export default MerchantAnalytics

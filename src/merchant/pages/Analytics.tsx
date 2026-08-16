import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { InternalPageHeader, WorkspaceSection } from '../components/InternalWorkspace'
import '../components/InternalWorkspace.css'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Select } from '../../shared/components/ui/Select'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { LineChart } from '../../shared/components/charts/LineChart'
import { DonutChart } from '../../shared/components/charts/DonutChart'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollection } from '../../shared/hooks/useCollection'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { useToast } from '../../shared/hooks/useToast'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { formatCurrency, formatDateTime, downloadFile, deliveredRevenue } from '../../shared/utils/format'
import { orderItemRevenue } from '../../shared/utils/pricing'
import { csvEscape } from '../../shared/utils/validators'
import type { Order, ProductCost } from '../../shared/types'

export const MerchantAnalytics: FunctionalComponent = () => {
  const { store } = useStore()
  const { user } = useAuth()
  const storeId = store?.id || ''
  const subState = useSubscription(storeId)
  const plan = subState.plan
  const hasAdvancedReports = plan?.advancedReports !== false
  const canCustomers = user?.role === 'merchant' || (user?.permissions || []).includes('customers:view')
  const ordersRes = useCollection<Order>('orders', { storeId })
  const orders = ordersRes.data
  const customersRes = useCollection('customers', { storeId }, canCustomers)
  const customers = customersRes.data
  const analyticsRes = useCollection<any>('analytics', { storeId })
  const analytics = analyticsRes.data
  const costsRes = useCollection<ProductCost>('productCosts', { storeId }, !!storeId)
  const costByProduct = new Map(costsRes.data.map((c) => [c.id, c.costPrice]))
  const toast = useToast()
  const [status, setStatus] = useState('')

  const revenue = deliveredRevenue(orders)
  const profitForOrder = (o: Order): number | null => {
    let hasCost = false
    let profit = 0
    for (const it of o.items || []) {
      const cost = costByProduct.get(it.productId)
      if (typeof cost !== 'number' || cost < 0) continue
      hasCost = true
      profit += orderItemRevenue(it) - Math.max(1, it.quantity || 1) * cost
    }
    return hasCost ? profit : null
  }
  const deliveredProfit = orders
    .filter((o) => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + (profitForOrder(o) ?? 0), 0)
  const hasAnyCost = costsRes.data.some((c) => typeof c.costPrice === 'number' && c.costPrice >= 0)
  const conversion = customers.length ? orders.length / Math.max(customers.length, 1) : 0

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const revenueSeries = last30.map((key) => analytics.filter((a) => a.date === key).reduce((s, a) => s + (a.revenue || 0), 0))

  const statusData = (Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((statusKey) => ({
    label: STATUS_LABELS[statusKey],
    value: orders.filter((o) => o.status === statusKey).length,
    color: `var(--${STATUS_COLORS[statusKey]})`,
  }))

  const filtered = status ? orders.filter((o) => o.status === status) : orders

  const exportCsv = () => {
    const header = ['orderNumber', 'customerName', 'phone', 'governorate', 'city', 'address', 'totalPrice', 'status', 'createdAt']
    const lines = filtered.map((o) =>
      [o.orderNumber, o.customerName, o.phone, o.governorate, o.city, o.address, o.totalPrice, o.status, o.createdAt ? formatDateTime(o.createdAt) : '']
        .map(csvEscape)
        .join(','),
    )
    downloadFile(`orders-${store?.ref || 'store'}-${Date.now()}.csv`, '\uFEFF' + [header.join(','), ...lines].join('\n'), 'text/csv')
    toast.push('تم تصدير الطلبات')
  }

  if (ordersRes.loading || costsRes.loading) return <Loading />

  return (
    <div className="merchant-operations merchant-analytics-page">
      <InternalPageHeader
        eyebrow="مركز الأداء"
        title="التحليلات والتقارير"
        subtitle="مؤشرات الأداء على مدار 30 يوماً"
        actions={<Button variant="outline" icon="download" onClick={exportCsv}>تصدير CSV</Button>}
      />

      <WorkspaceSection title="مؤشرات الأداء" subtitle="ملخص الإيرادات والطلبات والعملاء للفترة الحالية" className="analytics-kpi-workspace">
      <div className="stats-grid">
        <StatsCard title="الإيرادات" value={revenue} currency icon="payments" tone="green" />
        {hasAnyCost && <StatsCard title="الربح الإجمالي" value={deliveredProfit} currency icon="trending_up" tone="violet" />}
        <StatsCard title="الطلبات" value={orders.length} icon="receipt_long" tone="blue" />
        {canCustomers ? (
          <Fragment>
            <StatsCard title="العملاء" value={customers.length} icon="groups" tone="primary" />
            <StatsCard title="معدل الطلبات/عميل" value={conversion.toFixed(2)} icon="trending_up" tone="amber" />
          </Fragment>
        ) : (
          <StatsCard title="العملاء" value="—" icon="groups" tone="primary" />
        )}
      </div>
      </WorkspaceSection>

      <div className="analytics-chart-grid">
        <Card title="الإيرادات (30 يوم)">
          <LineChart values={revenueSeries} height={240} />
        </Card>
        <Card title="توزيع الطلبات" subtitle={`${orders.length} طلب`}>
          <DonutChart data={statusData} />
        </Card>
      </div>

      {!hasAdvancedReports && (
        <Card className="locked-feature-card mb-2">
          <EmptyState
            icon="lock"
            title="التقارير المتقدمة"
            description="هذه الميزة متاحة بدايةً من خطة Growth. يمكنك متابعة المؤشرات الأساسية هنا، وترقية الخطة لفتح التحليلات المتقدمة ورؤى المبيعات."
            action={<a href="/dashboard/subscription"><Button icon="workspace_premium">ترقية الخطة</Button></a>}
          />
        </Card>
      )}

      {hasAdvancedReports && (
        <Card className="advanced-insights-card mb-2" title="رؤى المبيعات المتقدمة" subtitle="متاحة ضمن خطة Growth وما بعدها">
          <div className="grid grid-3">
            <div className="insight-tile">
              <span>متوسط قيمة الطلب</span>
              <strong>{formatCurrency(orders.length ? revenue / orders.length : 0)}</strong>
            </div>
            <div className="insight-tile">
              <span>الربح من الطلبات المسلمة</span>
              <strong>{hasAnyCost ? formatCurrency(deliveredProfit) : 'تكلفة غير مكتملة'}</strong>
            </div>
            <div className="insight-tile">
              <span>معدل الطلبات لكل عميل</span>
              <strong>{conversion.toFixed(2)}</strong>
            </div>
          </div>
        </Card>
      )}

      <WorkspaceSection
        title="تفاصيل الطلبات"
        subtitle={`${filtered.length} طلب • ${formatCurrency(filtered.reduce((s, o) => s + o.totalPrice, 0))}`}
        actions={
          <Select
            value={status}
            onChange={setStatus}
            placeholder="كل الحالات"
            options={[{ value: '', label: 'كل الحالات' }, ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
          />
        }
      >
        <Table cardMode
          columns={[
            { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <span className="monospace">{o.orderNumber}</span> },
            { key: 'customerName', header: 'العميل' },
            { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
            { key: 'profit', header: 'الربح', render: (o: Order) => {
              const profit = profitForOrder(o)
              if (profit == null) return <span className="profit-chip is-missing">تكلفة غير مكتملة</span>
              return <span className={`profit-chip${profit < 0 ? ' is-negative' : ''}`}>{formatCurrency(profit)}</span>
            } },
            { key: 'status', header: 'الحالة', render: (o: Order) => <Badge tone={(STATUS_COLORS as any)[o.status] || 'slate'}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}</Badge> },
            { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{formatDateTime(o.createdAt)}</span> },
          ]}
          rows={filtered.slice(0, 100)}
        />
      </WorkspaceSection>
    </div>
  )
}
export default MerchantAnalytics

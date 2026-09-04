import { FunctionalComponent } from 'preact'
import { formatCurrency } from '../../shared/utils/format'
import './CrmMetricsGrid.css'

interface Metrics {
  totalOrders: number
  deliveredOrders: number
  cancelledOrders: number
  returnedOrders: number
  totalRevenue: number
  avgOrderValue: number
  lastOrderAt?: any
  daysSinceLastOrder?: number | null
  returnRate: number
  cancellationRate: number
}

interface Props {
  metrics: Metrics | null
  loading?: boolean
}

export const CrmMetricsGrid: FunctionalComponent<Props> = ({ metrics, loading }) => {
  if (loading) return <div className="crm-metrics-grid"><div className="crm-metric-card is-skeleton" /></div>
  if (!metrics) return null
  const cards = [
    { label: 'إجمالي الطلبات', value: String(metrics.totalOrders), sub: `${metrics.deliveredOrders} تم تسليمها` },
    { label: 'إجمالي الإنفاق', value: formatCurrency(metrics.totalRevenue), sub: `متوسط ${formatCurrency(metrics.avgOrderValue)}` },
    { label: 'معدل المرتجع', value: `${(metrics.returnRate * 100).toFixed(1)}%`, sub: `${metrics.returnedOrders} مرتجع` },
    { label: 'معدل الإلغاء', value: `${(metrics.cancellationRate * 100).toFixed(1)}%`, sub: `${metrics.cancelledOrders} ملغي` },
    { label: 'آخر طلب من', value: metrics.daysSinceLastOrder != null ? `${metrics.daysSinceLastOrder} يوم` : '—', sub: metrics.daysSinceLastOrder != null && metrics.daysSinceLastOrder > 60 ? 'معرض للخسارة' : 'نشط' },
  ]
  return (
    <div className="crm-metrics-grid">
      {cards.map((c) => (
        <div key={c.label} className="crm-metric-card">
          <span className="crm-metric-label">{c.label}</span>
          <strong className="crm-metric-value">{c.value}</strong>
          <span className="crm-metric-sub">{c.sub}</span>
        </div>
      ))}
    </div>
  )
}

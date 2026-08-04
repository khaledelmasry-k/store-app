import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { downloadFile } from '../../shared/utils/format'
import { csvEscape } from '../../shared/utils/validators'
import { STATUS_LABELS } from '../../shared/utils/constants'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import type { Order } from '../../shared/types'

export const MerchantReports: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const ordersRes = useCollection<Order>('orders', { storeId });
  const orders = ordersRes.data
  const toast = useToast()
  const [status, setStatus] = useState('')

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

  const total = filtered.reduce((s, o) => s + o.totalPrice, 0)

  return (
    <div>
      <PageHeader
        title="التقارير"
        subtitle={`${filtered.length} طلب • ${formatCurrency(total)}`}
        actions={<Button variant="outline" icon="download" onClick={exportCsv}>تصدير CSV</Button>}
      />
      <div className="toolbar">
        <select className="input" style={{ width: 180 }} value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Card>
        <Table
          columns={[
            { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <span className="monospace">{o.orderNumber}</span> },
            { key: 'customerName', header: 'العميل' },
            { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
            { key: 'status', header: 'الحالة', render: (o: Order) => <Badge>{o.status}</Badge> },
            { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{formatDateTime(o.createdAt)}</span> },
          ]}
          rows={filtered.slice(0, 100)}
        />
      </Card>
    </div>
  )
}
export default MerchantReports

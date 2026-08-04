import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Search } from '../../shared/components/ui/Search'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency, timeAgo } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import type { Order } from '../../shared/types'

export const MerchantOrders: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const ordersRes = useCollection<Order>('orders', { storeId, orderBy: { field: 'createdAt' } });
  const orders = ordersRes.data
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')

  const filtered = orders.filter(
    (o) =>
      (o.customerName.includes(query) || o.orderNumber.includes(query) || o.phone.includes(query)) &&
      (!status || o.status === status),
  )

  return (
    <div>
      <PageHeader title="الطلبات" subtitle={`${orders.length} طلب`} />
      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="بحث برقم الطلب أو العميل..." />
        <select className="input" style={{ width: 180 }} value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Card>
        <Table
          columns={[
            { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <Link href={`/dashboard/orders/${o.id}`}><span className="monospace">{o.orderNumber}</span></Link> },
            { key: 'customerName', header: 'العميل' },
            { key: 'phone', header: 'الهاتف' },
            { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
            { key: 'status', header: 'الحالة', render: (o: Order) => <Badge tone={STATUS_COLORS[o.status]}>{STATUS_LABELS[o.status]}</Badge> },
            { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{timeAgo(o.createdAt)}</span> },
          ]}
          rows={filtered}
        />
      </Card>
    </div>
  )
}
export default MerchantOrders

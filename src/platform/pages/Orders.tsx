import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Search } from '../../shared/components/ui/Search'
import { useCollection } from '../../shared/hooks/useCollection'
import { Link } from 'wouter'
import { formatCurrency, timeAgo } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import type { Order } from '../../shared/types'

export const PlatformOrders: FunctionalComponent = () => {
  const ordersRes = useCollection<Order>('orders', { orderBy: { field: 'createdAt' } });
  const orders = ordersRes.data
  const storesRes = useCollection('stores', {});
  const stores = storesRes.data
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')

  const filtered = orders.filter(
    (o) =>
      (o.customerName.includes(query) || o.orderNumber.includes(query) || o.phone.includes(query)) &&
      (!status || o.status === status),
  )

  return (
    <div>
      <PageHeader title="طلبات المنصة" subtitle={`${orders.length} طلب عبر جميع المتاجر`} />
      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="بحث برقم الطلب أو العميل..." />
        <select className="input" style={{ width: 180 }} value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <Card>
        <Table
          columns={[
            { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <Link href={`/platform/orders/${o.id}`}><span className="monospace">{o.orderNumber}</span></Link> },
            { key: 'storeId', header: 'المتجر', render: (o: Order) => (stores.find((s: any) => s.id === o.storeId) as any)?.name || '—' },
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
export default PlatformOrders

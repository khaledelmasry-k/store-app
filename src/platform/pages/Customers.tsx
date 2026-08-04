import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Search } from '../../shared/components/ui/Search'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import type { Customer } from '../../shared/types'

export const PlatformCustomers: FunctionalComponent = () => {
  const customersRes = useCollection<Customer>('customers', { orderBy: { field: 'createdAt' } });
  const customers = customersRes.data
  const storesRes = useCollection('stores', {});
  const stores = storesRes.data
  const [query, setQuery] = useState('')

  const filtered = customers.filter((c) => c.name.includes(query) || c.phone.includes(query))

  return (
    <div>
      <PageHeader title="عملاء المنصة" subtitle={`${customers.length} عميل عبر جميع المتاجر`} />
      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="بحث بالاسم أو الهاتف..." />
      </div>
      <Card>
        <Table
          columns={[
            { key: 'name', header: 'الاسم' },
            { key: 'phone', header: 'الهاتف' },
            { key: 'storeId', header: 'المتجر', render: (c: Customer) => (stores.find((s: any) => s.id === c.storeId) as any)?.name || '—' },
            { key: 'segment', header: 'الشريحة', render: (c: Customer) => c.segment ? <Badge tone="violet">{c.segment}</Badge> : '—' },
            { key: 'totalOrders', header: 'الطلبات', render: (c: Customer) => <Badge>{c.totalOrders}</Badge> },
            { key: 'totalSpent', header: 'الإجمالي', render: (c: Customer) => formatCurrency(c.totalSpent) },
            { key: 'lastOrderAt', header: 'آخر طلب', render: (c: Customer) => <span className="muted">{formatDate(c.lastOrderAt)}</span> },
          ]}
          rows={filtered}
        />
      </Card>
    </div>
  )
}
export default PlatformCustomers

import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { Pagination } from '../../shared/components/ui/Pagination'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { normalizeSegment, segmentLabel } from '../../shared/utils/segments'
import type { Customer } from '../../shared/types'

export const PlatformCustomers: FunctionalComponent = () => {
  const customersRes = useCollection<Customer>('customers', { orderBy: { field: 'createdAt' } })
  const customers = customersRes.data
  const storesRes = useCollection('stores', {})
  const stores = storesRes.data
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const filtered = customers.filter((c) => {
    const matchSearch = c.name.includes(query) || c.phone.includes(query)
    const matchSegment = segment === 'all' || normalizeSegment(c.segment) === segment
    return matchSearch && matchSegment
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const totalCustomers = customers.length
  const totalOrders = customers.reduce((s, c) => s + (c.totalOrders || 0), 0)
  const totalSpent = customers.reduce((s, c) => s + (c.totalSpent || 0), 0)

  if (customersRes.loading) return <Loading />

  return (
    <div className="platform-operations platform-customers-page">
      <PageHeader title="عملاء المنصة" subtitle={`${totalCustomers} عميل عبر جميع المتاجر`} />

      <div className="stats-grid">
        <StatsCard title="إجمالي العملاء" value={totalCustomers} icon="groups" tone="primary" />
        <StatsCard title="إجمالي الطلبات" value={totalOrders} icon="receipt_long" tone="blue" />
        <StatsCard title="إجمالي المبيعات" value={totalSpent} currency icon="payments" tone="green" />
      </div>

      <Card>
        <FilterBar
          search={query}
          onSearch={(q) => { setQuery(q); setPage(1) }}
          searchPlaceholder="بحث بالاسم أو الهاتف..."
          segments={[{ label: 'كل', value: 'all' }, { label: 'VIP', value: 'vip' }, { label: 'عادي', value: 'repeat' }, { label: 'جديد', value: 'new' }, { label: 'منتهي', value: 'inactive' }]}
          activeSegment={segment}
          onSegmentChange={(s) => { setSegment(s); setPage(1) }}
        />
        {filtered.length === 0 ? (
          <EmptyState icon="groups" title="لا يوجد عملاء" description={query ? 'لا توجد نتائج للبحث' : 'لم يقم أي عميل بطلب بعد'} />
        ) : (
          <Table cardMode
            columns={[
              { key: 'name', header: 'الاسم' },
              { key: 'phone', header: 'الهاتف' },
              { key: 'storeId', header: 'المتجر', render: (c: Customer) => (stores.find((s: any) => s.id === c.storeId) as any)?.name || '—' },
              { key: 'segment', header: 'الشريحة', render: (c: Customer) => c.segment ? <Badge tone="violet">{segmentLabel(c.segment)}</Badge> : '—' },
              { key: 'totalOrders', header: 'الطلبات', render: (c: Customer) => <Badge>{c.totalOrders}</Badge> },
              { key: 'totalSpent', header: 'المبلغ', render: (c: Customer) => formatCurrency(c.totalSpent) },
              { key: 'lastOrderAt', header: 'آخر طلب', render: (c: Customer) => <span className="muted">{formatDate(c.lastOrderAt)}</span> },
            ]}
            rows={rows}
          />
        )}
        {filtered.length > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={(p) => { setPage(p); window.scrollTo(0, 0) }}
          />
        )}
      </Card>
    </div>
  )
}
export default PlatformCustomers

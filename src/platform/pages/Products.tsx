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
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency } from '../../shared/utils/format'
import type { Product } from '../../shared/types'

export const PlatformProducts: FunctionalComponent = () => {
  const productsRes = useCollection<Product>('products', { orderBy: { field: 'createdAt' } })
  const products = productsRes.data
  const storesRes = useCollection('stores', {})
  const stores = storesRes.data
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const filtered = products.filter((p) => {
    const matchSearch = p.name.includes(query) || (p.sku || '').includes(query)
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? p.active : !p.active)
    return matchSearch && matchStatus
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const totalProducts = products.length
  const activeProducts = products.filter((p) => p.active).length
  const outOfStock = products.filter((p) => p.stock <= 0).length

  if (productsRes.loading) return <Loading />

  return (
    <div className="platform-operations platform-products-page">
      <PageHeader title="منتجات المنصة" subtitle={`${totalProducts} منتج عبر جميع المتاجر`} />

      <div className="stats-grid">
        <StatsCard title="إجمالي المنتجات" value={totalProducts} icon="inventory_2" tone="primary" />
        <StatsCard title="منشورة" value={activeProducts} icon="visibility" tone="green" />
        <StatsCard title="نفد المخزون" value={outOfStock} icon="warning" tone="red" />
      </div>

      <Card>
        <FilterBar
          search={query}
          onSearch={(q) => { setQuery(q); setPage(1) }}
          searchPlaceholder="بحث باسم المنتج أو SKU..."
          segments={[{ label: 'كل', value: 'all' }, { label: 'منشورة', value: 'active' }, { label: 'مخفية', value: 'inactive' }]}
          activeSegment={statusFilter}
          onSegmentChange={(s) => { setStatusFilter(s); setPage(1) }}
        />
        {filtered.length === 0 ? (
          <EmptyState icon="inventory_2" title="لا توجد منتجات" description={query ? 'لا توجد نتائج للبحث' : 'لم يتم إضافة أي منتجات بعد'} />
        ) : (
          <Table cardMode
            columns={[
              { key: 'name', header: 'المنتج', render: (p: Product) => <span className="flex"><SmartImage src={p.images?.[0]} alt={p.name} className="platform-product-thumb" fallback="product" /><span style={{ marginInlineStart: 8 }}>{p.name}</span></span> },
              { key: 'storeId', header: 'المتجر', render: (p: Product) => (stores.find((s: any) => s.id === p.storeId) as any)?.name || '—' },
              { key: 'price', header: 'السعر', render: (p: Product) => formatCurrency(p.price) },
              { key: 'stock', header: 'المخزون', render: (p: Product) => <Badge tone={p.stock > 0 ? 'green' : 'red'}>{p.stock}</Badge> },
              { key: 'active', header: 'الحالة', render: (p: Product) => <Badge tone={p.active ? 'green' : 'slate'}>{p.active ? 'منشور' : 'مخفي'}</Badge> },
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
export default PlatformProducts

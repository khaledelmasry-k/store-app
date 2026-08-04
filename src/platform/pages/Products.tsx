import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Search } from '../../shared/components/ui/Search'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency } from '../../shared/utils/format'
import type { Product } from '../../shared/types'

export const PlatformProducts: FunctionalComponent = () => {
  const productsRes = useCollection<Product>('products', { orderBy: { field: 'createdAt' } });
  const products = productsRes.data
  const storesRes = useCollection('stores', {});
  const stores = storesRes.data
  const [query, setQuery] = useState('')

  const filtered = products.filter((p) => p.name.includes(query) || (p.sku || '').includes(query))

  return (
    <div>
      <PageHeader title="منتجات المنصة" subtitle={`${products.length} منتج عبر جميع المتاجر`} />
      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="بحث باسم المنتج..." />
      </div>
      <Card>
        <Table
          columns={[
            { key: 'name', header: 'المنتج', render: (p: Product) => <span className="flex"><img src={p.images?.[0]} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} /><span>{p.name}</span></span> },
            { key: 'storeId', header: 'المتجر', render: (p: Product) => (stores.find((s: any) => s.id === p.storeId) as any)?.name || '—' },
            { key: 'price', header: 'السعر', render: (p: Product) => formatCurrency(p.price) },
            { key: 'stock', header: 'المخزون', render: (p: Product) => <Badge tone={p.stock > 0 ? 'green' : 'red'}>{p.stock}</Badge> },
            { key: 'active', header: 'الحالة', render: (p: Product) => <Badge tone={p.active ? 'green' : 'slate'}>{p.active ? 'منشور' : 'مخفي'}</Badge> },
          ]}
          rows={filtered}
        />
      </Card>
    </div>
  )
}
export default PlatformProducts

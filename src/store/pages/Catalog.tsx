import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link, useSearch } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { Search } from '../../shared/components/ui/Search'
import { formatCurrency } from '../../shared/utils/format'
import type { Product, Category } from '../../shared/types'

export const StoreCatalog: FunctionalComponent = () => {
  const { store } = useStore()
  const search = useSearch()
  const params = new URLSearchParams(search)
  const productsRes = useCollection<Product>('products', { storeId: store?.id || '', where: { active: { value: true } } });
  const products = productsRes.data
  const categoriesRes = useCollection<Category>('categories', { storeId: store?.id || '' });
  const categories = categoriesRes.data
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState(params.get('cat') || '')

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) && (!cat || p.categoryId === cat),
  )

  return (
    <div>
      <h1 className="page-title mb-2">المنتجات</h1>
      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="ابحث عن منتج..." />
        <select className="input" style={{ width: 180 }} value={cat} onChange={(e) => setCat((e.target as HTMLSelectElement).value)}>
          <option value="">كل الفئات</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="muted">لا توجد منتجات مطابقة.</p>
      ) : (
        <div className="store-grid">
          {filtered.map((p) => (
            <Link key={p.id} href={`/store/${store?.slug}/product/${p.id}`} className="store-card">
              <img src={p.images?.[0] || ''} alt={p.name} className="store-card-img" />
              <div className="store-card-body">
                <span className="store-card-name">{p.name}</span>
                <span className="store-card-price">
                  {formatCurrency(p.price)}
                  {p.oldPrice && <span className="store-card-old">{formatCurrency(p.oldPrice)}</span>}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
export default StoreCatalog

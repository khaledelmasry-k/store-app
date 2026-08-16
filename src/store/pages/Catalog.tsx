import { FunctionalComponent } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { useSearch, useLocation } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { Search } from '../../shared/components/ui/Search'
import { Select } from '../../shared/components/ui/Select'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { StoreProductCard } from '../components/StoreProductCard'
import type { Product, Category } from '../../shared/types'

export const StoreCatalog:FunctionalComponent = () => {
  const { store } = useStore()
  const search = useSearch()
  const params = new URLSearchParams(search)
  const productsRes = useCollection<Product>('products', { storeId: store?.id || '', where: { active: { value: true } } })
  const products = productsRes.data
  const categoriesRes = useCollection<Category>('categories', { storeId: store?.id || '' })
  const categories = categoriesRes.data
  const [, setLocation] = useLocation()
  const [query, setQuery] = useState(params.get('q') || '')
  const [cat, setCat] = useState(params.get('cat') || '')

  useEffect(() => {
    setCat(params.get('cat') || '')
    setQuery(params.get('q') || '')
  }, [search])

  const selectCat = (value: string) => {
    setCat(value)
    setLocation(value ? `/store/${store?.slug}/catalog?cat=${value}` : `/store/${store?.slug}/catalog`, { replace: true })
  }

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) && (!cat || p.categoryId === cat),
  )

  return (
    <div className="storefront-page storefront-catalog">
      <div className="storefront-page-head">
        <span>كتالوج المتجر</span>
        <h1 className="page-title mb-2">المنتجات</h1>
      </div>
      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="ابحث عن منتج..." />
        <Select
          value={cat}
          onChange={selectCat}
          placeholder="الفئة"
          options={[{ value: '', label: 'كل الفئات' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات"
          description={query ? 'لا توجد نتائج تطابق بحثك.' : 'هذا المتجر لا يحتوي على منتجات بعد.'}
          icon="inventory_2"
        />
      ) : (
        <div className="store-grid">
          {filtered.map((p) => (
            <StoreProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
export default StoreCatalog

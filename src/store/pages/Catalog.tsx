import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { StoreProductCard } from '../components/StoreProductCard'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Icon } from '../../shared/components/ui/Icon'
import type { Product, Category } from '../../shared/types'

const SORT_OPTIONS = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'price_asc', label: 'السعر: من الأقل للأعلى' },
  { value: 'price_desc', label: 'السعر: من الأعلى للأقل' },
]

export const StoreCatalog: FunctionalComponent = () => {
  const { store } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const perPage = 20

  const productsRes = useCollection<Product>(store?.id ? `publicStores/${store.id}/products` : 'publicStores/__none__/products', {
    where: { active: { value: true } },
  })
  const products = productsRes.data
  const categoriesRes = useCollection<Category>(store?.id ? `publicStores/${store.id}/categories` : 'publicStores/__none__/categories')
  const categories = categoriesRes.data

  const filtered = products
    .filter((p) => !q || p.name.includes(q))
    .filter((p) => !cat || p.categoryId === cat)
    .sort((a, b) => {
      switch (sort) {
        case 'price_asc': return a.price - b.price
        case 'price_desc': return b.price - a.price
        default: return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      }
    })

  const paginated = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(filtered.length / perPage)

  return (
    <div className="storefront-page storefront-catalog storefront-catalog--stitch">
      <header className="catalog-hero">
        <div>
          <span className="page-eyebrow">اكتشف مجموعتنا</span>
          <h1 className="page-title">كتالوج المنتجات</h1>
          <p className="page-subtitle">استكشف أحدث المنتجات المتوفرة لدينا.</p>
        </div>
        <div className="catalog-result-count" aria-live="polite"><strong>{filtered.length}</strong><span>منتج متاح</span></div>
      </header>

      {categories.length > 0 && (
        <nav className="catalog-category-rail" aria-label="فئات المنتجات">
          <button type="button" className={!cat ? 'active' : ''} onClick={() => { setCat(''); setPage(1) }}>الكل</button>
          {categories.slice(0, 8).map((c) => (
            <button type="button" key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => { setCat(c.id); setPage(1) }}>{c.name}</button>
          ))}
        </nav>
      )}

      <div className="catalog-toolbar-wrap">
        <div className="catalog-toolbar-label">المنتجات</div>
        <div className="toolbar">
          <div className="toolbar-search">
            <Input
              placeholder="ابحث عن منتج..."
              value={q}
              onChange={(v) => { setQ(v); setPage(1) }}
            />
          </div>
          <div className="toolbar-filters">
            <Select
              value={cat}
              onChange={(v) => { setCat(v); setPage(1) }}
              placeholder="الكل"
              options={[
                { value: '', label: 'الكل' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Select
              value={sort}
              onChange={(v) => { setSort(v); setPage(1) }}
              options={SORT_OPTIONS}
            />
          </div>
        </div>
      </div>

      <div className="store-grid store-grid-catalog">
        {paginated.length > 0 ? (
          paginated.map((p) => <StoreProductCard key={p.id} product={p} />)
        ) : (
          <EmptyState
            icon="inventory_2"
            title="لا توجد منتجات"
            description={q || cat ? 'جرب تغيير معايير البحث أو التصفية.' : 'لا توجد منتجات في هذا المتجر بعد.'}
            action={<Link href={`/store/${store?.slug}/catalog`}><Button variant="outline">عرض جميع المنتجات</Button></Link>}
          />
        )}
      </div>

      {totalPages > 1 && (
        <nav className="pagination" aria-label="ترقيم الصفحات">
          <button
            className="pagination-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="الصفحة السابقة"
          >
            <Icon name="chevron_right" ariaHidden />
          </button>
          <span className="pagination-info" aria-current="page">
            صفحة {page} من {totalPages}
          </span>
          <button
            className="pagination-btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="الصفحة التالية"
          >
            <Icon name="chevron_left" ariaHidden />
          </button>
        </nav>
      )}
    </div>
  )
}
export default StoreCatalog

import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { StoreProductCard } from '../components/StoreProductCard'
import type { Product, Category } from '../../shared/types'

export const StoreHome:FunctionalComponent = () => {
  const { store } = useStore()
  const productsRes = useCollection<Product>('products', { storeId: store?.id || '', where: { active: { value: true } } })
  const products = productsRes.data
  const categoriesRes = useCollection<Category>('categories', { storeId: store?.id || '' })
  const categories = categoriesRes.data

  const featured = products.filter((p) => p.featured).slice(0, 4)
  const latest = products.filter((p) => !p.featured).slice(0, 8)

  return (
    <div>
      <div className="store-hero">
        <h1>{store?.name}</h1>
        <p>{store?.description || 'تسوق أحدث المنتجات بأسعار مميزة وتوصيل سريع لجميع المحافظات.'}</p>
        {products.length > 0 && (
          <Link href={`/store/${store?.slug}/catalog`} className="btn btn-invert btn-lg mt-1">
            تسوق الآن
          </Link>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex mb-2" style={{ flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c) => (
            <Link key={c.id} href={`/store/${store?.slug}/catalog?cat=${c.id}`} className="btn btn-outline btn-sm">
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {featured.length > 0 && (
        <section className="mb-2">
          <h2 className="section-title">مميزات</h2>
          <div className="store-grid">
            {featured.map((p) => (
              <StoreProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section>
          <h2 className="section-title">أحدث المنتجات</h2>
          <div className="store-grid">
            {latest.map((p) => (
              <StoreProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {products.length === 0 && (
        <EmptyState
          title="لا توجد منتجات بعد"
          description="قريباً ستنطلق منتجات هذا المتجر. ترقّبوا!"
          icon="inventory_2"
        />
      )}
    </div>
  )
}
export default StoreHome
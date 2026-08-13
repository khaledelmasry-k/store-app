import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { StoreProductCard } from '../components/StoreProductCard'
import type { Product, Category } from '../../shared/types'

export const StoreHome:FunctionalComponent = () => {
  const { store } = useStore()
  const [heroFailed, setHeroFailed] = useState(false)
  useEffect(() => setHeroFailed(false), [store?.id, store?.heroImage])
  const productsRes = useCollection<Product>('products', { storeId: store?.id || '', where: { active: { value: true } } })
  const products = productsRes.data
  const categoriesRes = useCollection<Category>('categories', { storeId: store?.id || '' })
  const categories = categoriesRes.data

  const featured = products.filter((p) => p.featured).slice(0, 4)
  const latest = products.filter((p) => !p.featured).slice(0, 8)

  const hasHeroImage = Boolean(store?.heroImage) && !heroFailed

  return (
    <div>
      {hasHeroImage ? (
        <div className="store-hero store-hero--image">
          <SmartImage key={store.heroImage} src={store.heroImage} alt="" className="store-hero-img" placeholderClassName="store-hero-img" loading="eager" onError={() => setHeroFailed(true)} />
        </div>
      ) : (
        <div className="store-hero">
          <div className="store-hero-overlay">
            <span className="store-hero-badge">تسوق بثقة — توصيل سريع لجميع المحافظات</span>
            <h1>{store?.name}</h1>
            <p>{store?.description || 'تسوق أحدث المنتجات بأسعار مميزة وتوصيل سريع لجميع المحافظات.'}</p>
            {products.length > 0 && (
              <Link href={`/store/${store?.slug}/catalog`} className="btn btn-invert btn-lg mt-1">
                تسوق الآن
              </Link>
            )}
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <section className="mt-2">
          <h2 className="section-title">تسوق حسب الفئة</h2>
          <div className="flex" style={{ flexWrap: 'wrap', gap: 8 }}>
            {categories.map((c) => (
              <Link key={c.id} href={`/store/${store?.slug}/catalog?cat=${c.id}`} className="btn btn-outline btn-sm">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mt-2">
          <h2 className="section-title">مميزات</h2>
          <div className="store-grid">
            {featured.map((p) => (
              <StoreProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section className="store-promo-band mt-2">
          <div className="store-promo-content">
            <h2>عروض جديدة لا تفوّت</h2>
            <p>اكتشف أحدث المنتجات في متجر {store?.name} — بجودة موثوقة ودفع عند الاستلام.</p>
            <Link href={`/store/${store?.slug}/catalog`} className="btn btn-invert btn-lg">تصفح الكتالوج</Link>
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section className="mt-2">
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
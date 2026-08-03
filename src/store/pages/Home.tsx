import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { formatCurrency } from '../../shared/utils/format'
import type { Product, Category } from '../../shared/types'

export const StoreHome: FunctionalComponent = () => {
  const { store } = useStore()
  const productsRes = useCollection<Product>('products', { storeId: store?.id || '', where: { active: { value: true } } });
  const products = productsRes.data
  const categoriesRes = useCollection<Category>('categories', { storeId: store?.id || '' });
  const categories = categoriesRes.data

  return (
    <div>
      <div className="store-hero">
        <h1>{store?.name}</h1>
        <p>{store?.description || 'تسوق أحدث المنتجات بأسعار مميزة وتوصيل سريع لجميع المحافظات.'}</p>
      </div>
      {categories.length > 0 && (
        <div className="flex mb-2" style={{ flexWrap: 'wrap' }}>
          {categories.map((c) => (
            <Link key={c.id} href={`/store/${store?.slug}/catalog?cat=${c.id}`} className="btn btn-outline btn-sm">
              {c.name}
            </Link>
          ))}
        </div>
      )}
      {products.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات بعد"
          description="قريباً ستنطلق منتجات هذا المتجر. ترقّبونا!"
          icon="inventory_2"
        />
      ) : (
        <div className="store-grid">
          {products.map((p) => (
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
export default StoreHome

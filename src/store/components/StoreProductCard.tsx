import { FunctionalComponent } from 'preact'
import { Link, useLocation } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { wishlistService } from '../../shared/services/system'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { formatCurrency } from '../../shared/utils/format'
import { Icon } from '../../shared/components/ui/Icon'
import type { Product, WishlistItem } from '../../shared/types'
import { getTemplate } from '../../shared/utils/themes'
import './StoreProductCard.css'

interface Props {
  product: Product
  /** Real category name resolved by the page (Stitch cards show the category line). */
  categoryName?: string
}

/**
 * Storefront product card — rebuilt from the real Stitch home source
 * ("Premium Consumer Storefront Home" 56916061f03346f78802151c20218370):
 * aspect-[3/4] media, top-right badge, top-left favorite, hover quick-add
 * overlay, p-5 body with color dots, line-clamped title/category, price row
 * and availability badge. Mobile shows a full-width add button in the body
 * per the Stitch mobile source (46368a57a55d4c4d95b73c89b5dd8680).
 * Pricing / tier / variant / inventory / cart logic unchanged.
 */
export const StoreProductCard: FunctionalComponent<Props> = ({ product, categoryName }) => {
  const { store } = useStore()
  const { user } = useAuth()
  const [, navigate] = useLocation()
  const toast = useToast()
  const wishlistRes = useCollection<WishlistItem>('wishlist', { where: { userId: { value: user?.uid || '__none__' } } }, user?.role === 'customer' && !!user.uid)
  const wished = wishlistRes.data.some((item) => item.productId === product.id && (!item.storeId || item.storeId === store?.id))
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0
  const stock = hasVariants ? (product.variants || []).reduce((s, v) => s + (v.stock || 0), 0) : Number(product.stock || 0)
  const inStock = stock > 0

  const lowStock = !hasVariants && product.lowStockThreshold && stock > 0 && stock <= product.lowStockThreshold
  const lowCount = lowStock ? Math.min(stock, product.lowStockThreshold || 0) : 0

  const colorOptions = (product.colorOptions || product.colors || []) as { hex?: string }[]
  const colorCount = colorOptions.length
  const colors = colorOptions.slice(0, 3)

  const goto = `/store/${store?.slug}/product/${product.id}`
  const cardVariant = getTemplate(store?.theme?.template).layout.productCard

  return (
    <article className={`spc-card store-card spc-card--${cardVariant}${!inStock ? ' spc-card--out' : ''}`} data-template-card={cardVariant}>
      <Link href={goto} className="spc-media" aria-label={product.name}>
        <SmartImage src={product.images?.[0]} alt={product.name} className="spc-media-img" placeholderClassName="spc-media-img" fallback="product" />
        {product.featured && <span className="spc-badge spc-badge--new">جديد</span>}
        {discount > 0 && <span className="spc-badge spc-badge--sale">-{discount}%</span>}
        {!inStock && <span className="spc-badge spc-badge--out">نفد</span>}
        <div className="spc-quick-add">
          <button type="button" className="spc-add-btn" aria-label={`أضف ${product.name} للسلة`}>
            <Icon name="add_shopping_cart" ariaHidden />
            أضف للسلة
          </button>
        </div>
      </Link>
      <button
        type="button"
        className="spc-favorite"
        aria-label={wished ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
        aria-pressed={wished}
        onClick={async (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!user || user.role !== 'customer') {
            navigate(`/store/${store?.slug}/login?returnTo=${encodeURIComponent(goto)}`)
            return
          }
          try {
            if (wished) {
              await wishlistService.remove(wishlistRes.data.find((item) => item.productId === product.id && (item.storeId === store?.id || !item.storeId))?.id || '')
              toast.push('تمت الإزالة من المفضلة')
            } else {
              await wishlistService.create({ userId: user.uid, storeId: store?.id || '', productId: product.id })
              toast.push('تمت الإضافة إلى المفضلة')
            }
          } catch {
            toast.push('تعذر تحديث المفضلة', 'حاول مرة أخرى', 'error')
          }
        }}
      >
        <Icon name={wished ? 'favorite' : 'favorite_border'} ariaHidden />
      </button>
      <div className={`spc-body spc-body--${cardVariant}`}>
        {cardVariant === 'market' && <span className="spc-market-label">شراء سريع</span>}
        {colorCount > 0 && (
          <div className="spc-colors">
            {colors.map((c, i) => (
              <span key={i} className="spc-color-dot" style={c?.hex ? { background: c.hex } : undefined} aria-hidden="true" />
            ))}
            <span className="spc-color-count">+{colorCount} ألوان</span>
          </div>
        )}
        <h3 className="spc-title">
          <Link href={goto}>{product.name}</Link>
        </h3>
        {categoryName && <p className="spc-category">{categoryName}</p>}
        <div className={`spc-price-row spc-price-row--${cardVariant}`}>
          <div className="spc-price-col">
            <span className={`spc-price${discount > 0 ? ' spc-price--sale' : ''}`}>{formatCurrency(product.price, store?.currency)}</span>
            {discount > 0 && product.oldPrice && (
              <span className="spc-old-price">{formatCurrency(product.oldPrice, store?.currency)}</span>
            )}
          </div>
          <span className={`spc-stock${inStock ? '' : ' spc-stock--out'}`}>
            {inStock ? (lowCount > 0 ? `آخر ${lowCount} قطعة` : 'متوفر') : 'نفد'}
          </span>
        </div>
        <button type="button" className={`spc-add-btn spc-add-btn--mobile spc-add-btn--${cardVariant}`} aria-label={`أضف ${product.name} للسلة`}>
          <Icon name="add_shopping_cart" ariaHidden />
          أضف للسلة
        </button>
      </div>
    </article>
  )
}
export default StoreProductCard

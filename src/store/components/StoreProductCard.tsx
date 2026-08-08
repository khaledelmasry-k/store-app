import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { formatCurrency } from '../../shared/utils/format'
import type { Product } from '../../shared/types'

export const StoreProductCard: FunctionalComponent<{ product: Product }> = ({ product }) => {
  const { store } = useStore()
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0

  return (
    <Link href={`/store/${store?.slug}/product/${product.id}`} className="store-card">
      <div className="store-card-img-wrap">
        <SmartImage src={product.images?.[0]} alt={product.name} className="store-card-img" placeholderClassName="store-card-img" />
        {discount > 0 && <span className="store-card-badge">{discount}%-</span>}
      </div>
      <div className="store-card-body">
        <span className="store-card-name">{product.name}</span>
        <span className="store-card-price">
          {formatCurrency(product.price)}
          {product.oldPrice && <span className="store-card-old">{formatCurrency(product.oldPrice)}</span>}
        </span>
      </div>
    </Link>
  )
}

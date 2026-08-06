import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useDocument } from '../../shared/hooks/useDocument'
import { useCart } from '../../shared/hooks/useCart'
import { useToast } from '../../shared/hooks/useToast'
import { Button } from '../../shared/components/ui/Button'
import { Badge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { formatCurrency } from '../../shared/utils/format'
import type { Product } from '../../shared/types'

interface Props {
  id: string
}

export const StoreProduct: FunctionalComponent<Props> = ({ id }) => {
  const { store } = useStore()
  const { data: product, loading } = useDocument<Product>('products', id)
  const cart = useCart()
  const toast = useToast()
  const [qty, setQty] = useState(1)
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')

  if (loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  if (!product || product.storeId !== store?.id) {
    return <EmptyState icon="inventory_2" title="المنتج غير موجود" description="هذا المنتج غير متوفر في هذا المتجر." />
  }

  const addToCart = () => {
    cart.add({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      quantity: qty,
      color: color || undefined,
      size: size || undefined,
    })
    toast.push('تمت إضافة المنتج إلى السلة')
  }

  return (
    <div>
      <div className="store-crumb">
        <Link href={`/store/${store?.slug}`}>الرئيسية</Link>
        <span className="material-symbols-outlined">chevron_left</span>
        <Link href={`/store/${store?.slug}/catalog`}>المنتجات</Link>
        <span className="material-symbols-outlined">chevron_left</span>
        <span>{product.name}</span>
      </div>
      <div className="product-detail">
        <img src={product.images?.[0] || ''} alt={product.name} className="product-detail-img" />
        <div>
        <h1 className="page-title">{product.name}</h1>
        <div className="mt-1 mb-1">
          <Badge tone={product.stock > 0 ? 'green' : 'red'}>{product.stock > 0 ? 'متوفر' : 'نفد المخزون'}</Badge>
        </div>
        <p className="stat-value mb-2">
          {formatCurrency(product.price)}
          {product.oldPrice && <span className="store-card-old">{formatCurrency(product.oldPrice)}</span>}
        </p>
        <p className="muted mb-2">{product.description}</p>

        {product.colors.length > 0 && (
          <div className="mb-1">
            <span className="field-label">اللون:</span>
            <div className="flex mt-1">
              {product.colors.map((c) => (
                <button key={c} type="button" className="btn btn-outline btn-sm" style={{ borderColor: color === c ? 'var(--primary)' : undefined, color: color === c ? 'var(--primary)' : undefined }} onClick={() => setColor(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        {product.sizes.length > 0 && (
          <div className="mb-2">
            <span className="field-label">المقاس:</span>
            <div className="flex mt-1">
              {product.sizes.map((s) => (
                <button key={s} type="button" className="btn btn-outline btn-sm" style={{ borderColor: size === s ? 'var(--primary)' : undefined, color: size === s ? 'var(--primary)' : undefined }} onClick={() => setSize(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex mb-2">
          <div className="qty-stepper">
            <button type="button" className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <strong>{qty}</strong>
            <button type="button" className="qty-btn" onClick={() => setQty(Math.min(product.stock || 99, qty + 1))}>+</button>
          </div>
        </div>
        <div className="flex">
          <Button icon="shopping_cart" onClick={addToCart} disabled={product.stock <= 0}>أضف إلى السلة</Button>
          <Link href={`/store/${store?.slug}/cart`}><Button variant="outline">عرض السلة</Button></Link>
        </div>
      </div>
      </div>
    </div>
  )
}
export default StoreProduct
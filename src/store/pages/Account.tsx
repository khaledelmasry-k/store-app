import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { wishlistService, addressesService } from '../../shared/services/system'
import { Button } from '../../shared/components/ui/Button'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { GOVER_EG } from '../../shared/utils/constants'
import type { WishlistItem, Address, Order } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

export const StoreAccount: FunctionalComponent = () => {
  const { store } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const storeId = store?.id || ''
  const userId = user?.uid || ''

  const isCustomer = user?.role === 'customer'
  const wishlistRes = useCollection<WishlistItem>('wishlist', { userId }, isCustomer && !!userId);

  const wishlist = wishlistRes.data
  const addressesRes = useCollection<Address>('addresses', { userId }, isCustomer && !!userId);
  const addresses = addressesRes.data
  // Always scope by customerId for customers; never fall back to fetching all
  // store orders for guests/merchants (guests are redirected below).
  const ordersRes = useCollection<Order>('orders', isCustomer && userId ? { storeId, where: { customerId: { value: userId } } } : { storeId: '' });
  const orders = ordersRes.data
  const productsRes = useCollection('products', { storeId }, isCustomer && !!userId);
  const products = productsRes.data

  const myOrders = orders.filter((o) => o.phone === user?.phone || o.customerId === userId)

  const [newAddress, setNewAddress] = useState({ label: '', name: '', phone: '', governorate: '', city: '', address: '' })

  if (!isCustomer) {
    return (
      <div className="order-confirmed storefront-state">
        <div className="big-check"><Icon name="account_circle" /></div>
        <h1 className="auth-title">تسجيل الدخول مطلوب</h1>
        <p className="auth-subtitle">سجّل الدخول لعرض طلباتك وعناوينك ومفضلتك.</p>
        <Link href={`/store/${store?.slug}/login`}><Button>تسجيل الدخول</Button></Link>
      </div>
    )
  }

  const addAddress = async () => {
    if (!newAddress.address) {
      toast.push('أدخل العنوان', undefined, 'error')
      return
    }
    await addressesService.create({ ...newAddress, userId, storeId, isDefault: addresses.length === 0 })
    toast.push('تمت إضافة العنوان')
    setNewAddress({ label: '', name: '', phone: '', governorate: '', city: '', address: '' })
  }

  const removeWish = async (id: string) => {
    await wishlistService.remove(id)
    toast.push('أُزيل من المفضلة')
  }

  return (
    <div className="storefront-page storefront-account">
      <h1 className="page-title mb-2">حسابي</h1>
      <div className="grid grid-2">
        <Card title="طلباتي">
          {myOrders.length === 0 ? (
            <p className="muted">لا توجد طلبات بعد.</p>
          ) : (
            myOrders.map((o) => (
              <Link key={o.id} href={`/store/${store?.slug}/orders/${o.id}`} className="list-row list-row--link">
                <div>
                  <span className="monospace">{o.orderNumber}</span>
                  <p className="muted small">{formatDateTime(o.createdAt)} • {formatCurrency(o.totalPrice)} • {o.items.length} منتج</p>
                </div>
                <Badge tone={STATUS_COLORS[o.status as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}</Badge>
              </Link>
            ))
          )}
        </Card>
        <Card title="المفضلة">
          {wishlist.length === 0 ? (
            <p className="muted">لا توجد منتجات مفضلة.</p>
          ) : (
            wishlist.map((w) => {
              const product = products.find((p: any) => p.id === w.productId) as any
              return (
                <div key={w.id} className="list-row">
                  <span>{product?.name || 'منتج محذوف'}</span>
                  <button className="icon-btn" onClick={() => removeWish(w.id)} type="button">
                    <Icon name="delete" />
                  </button>
                </div>
              )
            })
          )}
        </Card>
      </div>
      <Card title="عناويني" className="mt-2">
        {addresses.length > 0 && (
          <div className="mb-2">
            {addresses.map((a) => (
              <div key={a.id} className="list-row">
                <div>
                  <strong>{a.label || a.address}</strong>
                  <p className="muted small">{a.governorate} • {a.city} • {a.address}</p>
                </div>
                {a.isDefault && <Badge tone="green">الافتراضي</Badge>}
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-2">
          <Input label="اسم العنوان" value={newAddress.label} onChange={(v) => setNewAddress({ ...newAddress, label: v })} placeholder="المنزل / العمل" />
          <Input label="الاسم" value={newAddress.name} onChange={(v) => setNewAddress({ ...newAddress, name: v })} />
          <Input label="الهاتف" value={newAddress.phone} onChange={(v) => setNewAddress({ ...newAddress, phone: v })} />
          <Select label="المحافظة" value={newAddress.governorate} onChange={(v) => setNewAddress({ ...newAddress, governorate: v })} options={GOVER_EG.map((g) => ({ value: g, label: g }))} placeholder="اختر المحافظة" />
          <Input label="المدينة" value={newAddress.city} onChange={(v) => setNewAddress({ ...newAddress, city: v })} />
          <Input label="العنوان بالتفصيل" value={newAddress.address} onChange={(v) => setNewAddress({ ...newAddress, address: v })} />
        </div>
        <div className="flex flex-end">
          <Button icon="add" onClick={addAddress}>إضافة عنوان</Button>
        </div>
      </Card>
    </div>
  )
}
export default StoreAccount

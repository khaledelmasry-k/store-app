import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link, useSearch } from 'wouter'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../shared/firebase'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollection } from '../../shared/hooks/useCollection'
import { Button } from '../../shared/components/ui/Button'
import { Avatar } from '../../shared/components/ui/Avatar'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Badge } from '../../shared/components/ui/Badge'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { logout, resetPassword } from '../../shared/services/auth'
import { useToast } from '../../shared/hooks/useToast'
import { Icon } from '../../shared/components/ui/Icon'
import type { Order, Product, WishlistItem } from '../../shared/types'

const NAV_ITEMS = [
  { id: 'overview', label: 'نظرة عامة', icon: 'dashboard' },
  { id: 'orders', label: 'طلباتي', icon: 'shopping_bag' },
  { id: 'addresses', label: 'العناوين', icon: 'location_on' },
  { id: 'wishlist', label: 'قائمة الأمنيات', icon: 'favorite' },
  { id: 'security', label: 'الأمان', icon: 'shield' },
] as const

const GOVERNORATES = ['القاهرة', 'الإسكندرية', 'الجيزة', 'القليوبية', 'المنوفية', 'الغربية', 'الدقهلية', 'كفر الشيخ', 'الشرقية', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'البحر الأحمر', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'الوادي الجديد', 'مطروح', 'البحيرة', 'كفر الشيخ'] as const

const GOVERNORATE_OPTIONS = [{ value: '', label: 'اختر المحافظة' }, ...GOVERNORATES.map(g => ({ value: g, label: g }))]

export const StoreAccount: FunctionalComponent = () => {
  const { store } = useStore()
  const { user, loading: authLoading } = useAuth()
  const search = useSearch()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(search).get('tab') || 'overview')
  const [newAddress, setNewAddress] = useState({ name: '', phone: '', governorate: '', city: '', address: '', isDefault: false })
  const [addresses, setAddresses] = useState(user?.addresses || [])
  const addressSignature = JSON.stringify(user?.addresses || [])

  useEffect(() => {
    const next = new URLSearchParams(search).get('tab')
    if (next && NAV_ITEMS.some((item) => item.id === next)) setActiveTab(next)
  }, [search])

  useEffect(() => {
    setAddresses(JSON.parse(addressSignature) as typeof addresses)
  }, [user?.uid, addressSignature])

const ordersRes = useCollection<Order>('orders', { where: { customerId: { value: user?.uid || '__none__' } } }, !!store?.id && !!user?.uid)
const orders = ordersRes.data?.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) || []
const wishlistRes = useCollection<WishlistItem>('wishlist', { where: { userId: { value: user?.uid || '__none__' } } }, !!store?.id && !!user?.uid)
const productsRes = useCollection<Product>('products', { storeId: store?.id || '' }, !!store?.id)
const wishlistProducts = productsRes.data.filter((product) => wishlistRes.data.some((item) => item.productId === product.id && (!item.storeId || item.storeId === store?.id)))

  const persistAddresses = async (next: typeof addresses) => {
    if (!user?.uid) return
    await updateDoc(doc(db, 'users', user.uid), { addresses: next })
    setAddresses(next)
  }

  const saveAddress = async () => {
    if (!user?.uid || !newAddress.name || !newAddress.phone || !newAddress.governorate || !newAddress.city || !newAddress.address) {
      toast.push('أكمل بيانات العنوان المطلوبة', undefined, 'error')
      return
    }
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `address-${Date.now()}`
    const nextAddress = { id, label: 'عنوان', ...newAddress }
    const next = newAddress.isDefault ? addresses.map((a) => ({ ...a, isDefault: false })).concat(nextAddress) : addresses.concat(nextAddress)
    try {
      await persistAddresses(next)
      setNewAddress({ name: '', phone: '', governorate: '', city: '', address: '', isDefault: false })
      toast.push('تم حفظ العنوان')
    } catch {
      toast.push('تعذر حفظ العنوان', 'حاول مرة أخرى', 'error')
    }
  }

  const removeAddress = async (id: string) => {
    try {
      await persistAddresses(addresses.filter((a) => a.id !== id))
      toast.push('تم حذف العنوان')
    } catch {
      toast.push('تعذر حذف العنوان', 'حاول مرة أخرى', 'error')
    }
  }

if (authLoading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

if (!user || user.role !== 'customer') {
    return (
      <div className="storefront-page storefront-account">
        <div className="auth-required">
          <Icon name="account_circle" className="auth-icon" />
          <h1>تسجيل الدخول مطلوب</h1>
          <p>يرجى تسجيل الدخول للوصول إلى لوحة تحكم حسابك.</p>
          <Link href={`/store/${store?.slug}/login`}><Button icon="login">تسجيل الدخول</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page storefront-account">
      <aside className="account-sidebar">
        <div className="account-header">
          <Avatar name={user.name} size="lg" />
          <h2>{user.name}</h2>
          <span className="muted small">{user.email}</span>
        </div>
        <nav className="account-nav" role="navigation" aria-label="تنقل الحساب">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`account-nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
          <button className="account-nav-item danger" onClick={() => logout().then(() => window.location.reload())}>
            <Icon name="logout" />
            <span>تسجيل الخروج</span>
          </button>
        </nav>
      </aside>

      <main className="account-content" role="main">
        {activeTab === 'overview' && (
          <section className="account-section">
            <h2 className="section-title">نظرة عامة</h2>
            <p className="muted">أهلاً بك، {user.name}! مرحباً بعودتك إلى متجر {store?.name}. إليك نظرة عامة على نشاط حسابك.</p>

            <div className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon"><Icon name="shopping_bag" /></span>
                <div>
                  <span className="stat-label">إجمالي الطلبات</span>
                  <strong className="stat-value">{orders.length}</strong>
                </div>
              </article>
              <article className="stat-card">
                <span className="stat-icon"><Icon name="attach_money" /></span>
                <div>
                  <span className="stat-label">إجمالي الإنفاق</span>
                  <strong className="stat-value">{formatCurrency(orders.reduce((s, o) => s + o.totalPrice, 0))}</strong>
                </div>
              </article>
              <article className="stat-card">
                <span className="stat-icon"><Icon name="local_shipping" /></span>
                <div>
                  <span className="stat-label">قيد التجهيز</span>
                  <strong className="stat-value">{orders.filter(o => o.status === 'PROCESSING' || o.status === 'CONTACTED').length}</strong>
                </div>
              </article>
              <article className="stat-card">
                <span className="stat-icon"><Icon name="check_circle" /></span>
                <div>
                  <span className="stat-label">مكتملة</span>
                  <strong className="stat-value">{orders.filter(o => o.status === 'DELIVERED').length}</strong>
                </div>
              </article>
            </div>

            <section className="recent-orders">
              <div className="section-head">
                <h3 className="section-title">أحدث الطلبات</h3>
                <Link href={`/store/${store?.slug}/account?tab=orders`} className="section-viewall">عرض الكل</Link>
              </div>
              {orders.length > 0 ? (
                <div className="orders-list">
                  {orders.slice(0, 3).map((o) => (
                    <Link key={o.id} href={`/store/${store?.slug}/account/orders/${o.id}`} className="order-row">
                      <div className="order-row-info">
                        <span className="order-row-number monospace">{o.orderNumber}</span>
                        <span className="order-row-date muted small">{formatDateTime(o.createdAt)}</span>
                      </div>
                      <div className="order-row-status">
                        <Badge tone={STATUS_COLORS[o.status as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}</Badge>
                        <span className="order-row-total">{formatCurrency(o.totalPrice)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Icon name="shopping_bag" />
                  <p>لا توجد طلبات بعد</p>
                  <Link href={`/store/${store?.slug}/catalog`}><Button variant="outline" className="mt-1">ابدأ التسوق</Button></Link>
                </div>
              )}
            </section>
          </section>
        )}

        {activeTab === 'orders' && (
          <section className="account-section">
            <h2 className="section-title">جميع الطلبات</h2>
            {orders.length > 0 ? (
              <div className="orders-table">
                <table>
                  <thead>
                    <tr>
                      <th>رقم الطلب</th>
                      <th>التاريخ</th>
                      <th>الإجمالي</th>
                      <th>الحالة</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/store/${store?.slug}/account/orders/${o.id}`} className="monospace">{o.orderNumber}</Link></td>
                        <td>{formatDateTime(o.createdAt)}</td>
                        <td>{formatCurrency(o.totalPrice)}</td>
                        <td><Badge tone={STATUS_COLORS[o.status as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}</Badge></td>
                        <td><Link href={`/store/${store?.slug}/account/orders/${o.id}`} className="btn btn-sm btn-outline">التفاصيل</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <Icon name="shopping_bag" />
                <p>لا توجد طلبات بعد</p>
                <Link href={`/store/${store?.slug}/catalog`}><Button variant="outline" className="mt-1">ابدأ التسوق</Button></Link>
              </div>
            )}
          </section>
        )}

        {activeTab === 'addresses' && (
          <section className="account-section">
            <div className="section-head">
              <h2 className="section-title">العناوين المحفوظة</h2>
            </div>
            <div className="addresses-list">
              {addresses.length > 0 ? (
                addresses.map((addr, idx) => (
                  <article key={idx} className="address-card">
                    <div className="address-info">
                      <div className="address-header">
                        <span className="address-type">{addr.label || 'عنوان'}</span>
                        {addr.isDefault && <Badge tone="green">الافتراضي</Badge>}
                      </div>
                      <address className="address-text">
                        {addr.name}<br />
                        {addr.address}<br />
                        {addr.city}, {addr.governorate}<br />
                        <a href={`tel:${addr.phone}`} className="ltr-text">{addr.phone}</a>
                      </address>
                    </div>
                    <div className="address-actions">
                      <Link href={`/store/${store?.slug}/account?editAddress=${idx}`} className="btn btn-sm btn-outline"><Icon name="edit" /> تعديل</Link>
                      <button className="btn btn-sm btn-outline danger" onClick={() => removeAddress(addr.id)}><Icon name="delete" /> حذف</button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <Icon name="location_on" />
                  <p>لا توجد عناوين محفوظة</p>
                </div>
              )}
            </div>
            <div className="add-address-form">
              <h3>إضافة عنوان جديد</h3>
              <div className="form-grid">
                <Input label="الاسم" value={newAddress.name} onChange={(v) => setNewAddress({ ...newAddress, name: v })} placeholder="الاسم المستلم" />
                <Input label="رقم الهاتف" value={newAddress.phone} onChange={(v) => setNewAddress({ ...newAddress, phone: v })} placeholder="01xxxxxxxxx" type="tel" />
              </div>
              <div className="form-grid">
                <Select label="المحافظة" value={newAddress.governorate} onChange={(v) => setNewAddress({ ...newAddress, governorate: v })} placeholder="اختر المحافظة" options={GOVERNORATE_OPTIONS} />
                <Input label="المدينة" value={newAddress.city} onChange={(v) => setNewAddress({ ...newAddress, city: v })} placeholder="المدينة" />
              </div>
              <Input label="العنوان بالتفصيل" value={newAddress.address} onChange={(v) => setNewAddress({ ...newAddress, address: v })} placeholder="الشارع، المبنى، الشقة" />
              <label className="checkbox-label">
                <input type="checkbox" checked={newAddress.isDefault} onChange={(e) => setNewAddress({ ...newAddress, isDefault: (e.target as HTMLInputElement).checked })} />
                <span>تعيين كافتراضي</span>
              </label>
              <Button onClick={saveAddress}>حفظ العنوان</Button>
            </div>
          </section>
        )}

        {activeTab === 'wishlist' && (
          <section className="account-section">
            <h2 className="section-title">قائمة الأمنيات</h2>
            {wishlistProducts.length > 0 ? (
              <div className="wishlist-grid">
                {wishlistProducts.map((product) => (
                  <Link key={product.id} href={`/store/${store?.slug}/product/${product.id}`} className="wishlist-card">
                    {product.images?.[0] && <img src={product.images[0]} alt="" className="wishlist-card-image" />}
                    <span className="wishlist-card-name">{product.name}</span>
                    <span className="wishlist-card-price">{formatCurrency(product.price, store?.currency)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Icon name="favorite" />
                <p>لا توجد منتجات في قائمة الأمنيات</p>
                <Link href={`/store/${store?.slug}/catalog`}><Button variant="outline" className="mt-1">تصفح المنتجات</Button></Link>
              </div>
            )}
          </section>
        )}

        {activeTab === 'security' && (
          <section className="account-section">
            <h2 className="section-title">الأمان والخصوصية</h2>
            <div className="security-options">
              <div className="security-card">
                <div>
                  <h3>تغيير كلمة المرور</h3>
                  <p className="muted small">تحديث كلمة المرور الخاصة بحسابك</p>
                </div>
                <Button variant="outline" onClick={() => user.email && resetPassword(user.email).then(() => toast.push('تم إرسال رابط تغيير كلمة المرور')).catch(() => toast.push('تعذر إرسال الرابط', undefined, 'error'))}>تغيير</Button>
              </div>
              <div className="security-card">
                <div>
                  <h3>إدارة الجلسات</h3>
                  <p className="muted small">عرض وتسجيل الخروج من الأجهزة الأخرى</p>
                </div>
                <Button variant="outline">إدارة</Button>
              </div>
              <div className="security-card">
                <div>
                  <h3>التحقق بخطوتين</h3>
                  <p className="muted small">إضافة طبقة أمان إضافية لحسابك</p>
                </div>
                <Button variant="outline">تفعيل</Button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
export default StoreAccount

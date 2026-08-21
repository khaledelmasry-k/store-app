import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useCart } from '../../shared/hooks/useCart'
import { useToast } from '../../shared/hooks/useToast'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollection } from '../../shared/hooks/useCollection'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Textarea } from '../../shared/components/ui/Textarea'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { createOrderCallable, quoteCouponCallable } from '../../shared/services/auth'
import { GOVER_EG } from '../../shared/utils/constants'
import { formatCurrency, todayKey } from '../../shared/utils/format'
import { cartSubtotal, lineSubtotal, piecesLabel } from '../../shared/utils/pricing'
import { calculateShipping } from '../../shared/utils/shipping'
import type { ShippingZone } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import { EmptyState } from '../../shared/components/ui/EmptyState'

export const StoreCheckout: FunctionalComponent = () => {
  const { store } = useStore()
  const cart = useCart()
  const toast = useToast()
  const { user } = useAuth()
  const [form, setForm] = useState({ customerName: '', phone: '', governorate: '', city: '', address: '', notes: '', paymentMethod: 'cod', couponCode: '' })
  const [loading, setLoading] = useState(false)
  const [couponLoading, setCouponLoading] = useState(false)
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null)
  const [done, setDone] = useState<{ orderNumber: string; phone: string } | null>(null)

  const zonesRes = useCollection<ShippingZone>('shipping', { storeId: store?.id || '' }, !!store?.id && cart.items.length > 0)
  const subtotal = cartSubtotal(cart.items)

  const quote = calculateShipping({ store, zones: zonesRes.data, subtotal, governorate: form.governorate })
  const total = subtotal + quote.fee - (coupon?.discount || 0)

  const applyCoupon = async () => {
    const code = form.couponCode.trim().toUpperCase()
    if (!code || !store?.id) return
    setCouponLoading(true)
    try {
      const res = await quoteCouponCallable({ storeId: store.id, code, subtotal })
      const data = res.data as { code: string; discount: number }
      setCoupon({ code: data.code, discount: Number(data.discount || 0) })
      toast.push(`تم تطبيق الخصم: ${formatCurrency(Number(data.discount || 0))}`)
    } catch (err: any) {
      setCoupon(null)
      toast.push('تعذر تطبيق الكوبون', err?.message || 'تحقق من الكود وشروطه', 'error')
    } finally {
      setCouponLoading(false)
    }
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (!form.customerName || !form.phone || !form.governorate || !form.city || !form.address) {
      toast.push('أكمل جميع الحقول المطلوبة', undefined, 'error')
      return
    }
    if (!quote.available) {
      toast.push('الشحن غير متوفر لهذه الوجهة', quote.unavailableReason || 'اختر محافظة مغطاة قبل المتابعة', 'error')
      return
    }
    setLoading(true)
    try {
      const salesLinkRef = store?.id ? sessionStorage.getItem(`mk_sales_ref_${store.id}`) || undefined : undefined
      const landingPageId = store?.id ? sessionStorage.getItem(`mk_landing_${store.id}`) || undefined : undefined
      const res = await createOrderCallable({
        storeId: store?.id,
        items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity, color: i.color, size: i.size, variantId: i.variantId })),
        customer: { name: form.customerName, phone: form.phone, governorate: form.governorate, city: form.city, address: form.address, notes: form.notes || '' },
        paymentMethod: form.paymentMethod,
        couponCode: coupon?.code || form.couponCode.trim() || undefined,
        salesLinkRef,
        landingPageId,
      })
      const data = res.data as any
      setDone({ orderNumber: data.orderNumber, phone: form.phone })
      cart.clear()
      if (store?.id) {
        sessionStorage.removeItem(`mk_sales_ref_${store.id}`)
        sessionStorage.removeItem(`mk_landing_${store.id}`)
      }
      toast.push('تم إرسال طلبك بنجاح')
    } catch (err: any) {
      toast.push('تعذر إرسال الطلب', err?.message || 'تحقق من البيانات', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    const isGuest = !user || user.role !== 'customer'
    return (
      <div className="storefront-page storefront-checkout storefront-confirmation order-confirmed">
        <div className="confirmation-card">
          <div className="confirmation-icon">
            <Icon name="check_circle" />
          </div>
          <h1>تم إنشاء طلبك بنجاح</h1>
          <p className="confirmation-subtitle">رقم طلبك: <strong className="monospace">{done.orderNumber}</strong></p>
          <p className="confirmation-subtitle">يمكنك متابعة طلبك باستخدام رقم الطلب ورقم الهاتف.</p>

          {isGuest && (
            <div className="guest-signup">
              <h2>هل تريد إنشاء حساب لمتابعة جميع طلباتك بسهولة؟</h2>
              <p className="muted small">أنشئ حساباً الآن وسنربط هذا الطلب بحسابك تلقائياً — التسجيل اختياري.</p>
              <Link href={`/store/${store?.slug}/login?mode=signup&order=${encodeURIComponent(done.orderNumber)}&phone=${encodeURIComponent(done.phone)}`}>
                <Button icon="person_add" className="mt-1">إنشاء حساب</Button>
              </Link>
            </div>
          )}

          <div className="confirmation-actions">
            <Link href={`/store/${store?.slug}/track`}><Button variant="outline">تتبع الطلب</Button></Link>
            <Link href={`/store/${store?.slug}`}><Button>متابعة التسوق</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  if (cart.items.length === 0) {
    return (
      <div className="storefront-page storefront-checkout storefront-empty-cart">
        <EmptyState
          icon="shopping_cart"
          title="سلتك فارغة"
          description="أضف منتجات إلى السلة قبل إتمام الطلب."
          action={<Link href={`/store/${store?.slug}/catalog`}><Button variant="outline">تصفح المنتجات</Button></Link>}
        />
      </div>
    )
  }

  return (
    <div className="storefront-page storefront-checkout">
      <div className="storefront-page-head">
        <span className="page-eyebrow">دفع آمن ومنظم</span>
        <h1 className="page-title">إتمام الطلب</h1>
      </div>
      <div className="checkout-layout">
        <form onSubmit={submit} className="checkout-form">
          <section className="checkout-section">
            <div className="checkout-section-header">
              <Icon name="person" className="checkout-section-icon" />
              <h2 className="checkout-section-title">المعلومات الشخصية</h2>
            </div>
            <div className="form-grid">
              <Input label="الاسم الكامل" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} required />
              <Input label="رقم الهاتف" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="01xxxxxxxxx" required type="tel" />
            </div>
          </section>

          <section className="checkout-section">
            <div className="checkout-section-header">
              <Icon name="local_offer" className="checkout-section-icon" />
              <h2 className="checkout-section-title">كود الخصم</h2>
            </div>
            <div className="coupon-entry-row">
              <Input label="الكود (اختياري)" value={form.couponCode} onChange={(v) => { setForm({ ...form, couponCode: v.toUpperCase() }); setCoupon(null) }} placeholder="مثال: SAVE10" />
              <Button type="button" variant="outline" loading={couponLoading} disabled={!form.couponCode.trim()} onClick={applyCoupon}>تطبيق</Button>
            </div>
            {coupon && <p className="coupon-applied" role="status">تم تطبيق خصم {formatCurrency(coupon.discount)}</p>}
            <p className="muted small">سيتم التحقق من صلاحية الكود وتطبيقه على الخادم.</p>
          </section>

          <section className="checkout-section">
            <div className="checkout-section-header">
              <Icon name="location_on" className="checkout-section-icon" />
              <h2 className="checkout-section-title">عنوان الشحن</h2>
            </div>
            <div className="form-grid">
              <Select label="المحافظة" value={form.governorate} onChange={(v) => setForm({ ...form, governorate: v })} placeholder="اختر المحافظة" options={GOVER_EG.map((g) => ({ value: g, label: g }))} />
              <Input label="المدينة" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
            </div>
            <Textarea label="العنوان بالتفصيل" value={form.address} onChange={(v) => setForm({ ...form, address: v })} rows={2} required />
            <Textarea label="ملاحظات (اختياري)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} rows={2} />
          </section>

          <section className="checkout-section">
            <div className="checkout-section-header">
              <Icon name="local_shipping" className="checkout-section-icon" />
              <h2 className="checkout-section-title">طريقة الشحن</h2>
            </div>
            <div className="shipping-options">
              <label className="shipping-option">
                <input type="radio" name="shipping" value="standard" checked disabled={!quote.available} />
                <div className="shipping-option-content">
                  <div className="shipping-option-main">
                    <span className="shipping-option-name">شحن قياسي</span>
                    <span className="shipping-option-price">{quote.freeDelivery ? 'مجاني' : formatCurrency(quote.fee)}</span>
                  </div>
                    <p className="shipping-option-desc">{quote.available ? 'التوصيل حسب سياسة المتجر' : quote.unavailableReason}</p>
                </div>
              </label>
              {quote.policy && (
                <div className="shipping-policy">
                  <Icon name="info" className="policy-icon" />
                  <span>{quote.policy}</span>
                </div>
              )}
            </div>
          </section>

          <section className="checkout-section">
            <div className="checkout-section-header">
              <Icon name="payments" className="checkout-section-icon" />
              <h2 className="checkout-section-title">طريقة الدفع</h2>
            </div>
            <div className="payment-options">
              <label className="payment-option">
                <input type="radio" name="payment" value="cod" checked={form.paymentMethod === 'cod'} onChange={() => setForm({ ...form, paymentMethod: 'cod' })} />
                <div className="payment-option-content">
                  <Icon name="local_shipping" className="payment-option-icon" />
                  <div>
                    <span className="payment-option-name">الدفع عند الاستلام</span>
                    <p className="payment-option-desc">ادفع نقداً عند استلام الطلب</p>
                  </div>
                </div>
              </label>
              <label className="payment-option">
                <input type="radio" name="payment" value="bank" checked={form.paymentMethod === 'bank'} onChange={() => setForm({ ...form, paymentMethod: 'bank' })} />
                <div className="payment-option-content">
                  <Icon name="account_balance" className="payment-option-icon" />
                  <div>
                    <span className="payment-option-name">تحويل بنكي</span>
                    <p className="payment-option-desc">تحويل بنكي مسبق</p>
                  </div>
                </div>
              </label>
            </div>
          </section>

          <Button type="submit" block size="lg" loading={loading} disabled={!quote.available} icon="shopping_cart_checkout" className="checkout-submit-btn">
            تأكيد الطلب — {formatCurrency(total)}
          </Button>
        </form>

        <aside className="order-summary order-summary--checkout" id="checkout-summary">
          <h2 className="summary-title">ملخص الطلب</h2>
          <div className="summary-items">
            {cart.items.map((item, i) => {
              const isQtyMode = item.pricingMode === 'quantity' && item.quantityTiers && item.quantityTiers.length > 0
              return (
                <div key={i} className="summary-item">
                  <Link href={`/store/${store?.slug}/product/${item.productId}`} className="summary-item-image">
                    {item.image && <SmartImage src={item.image} alt={item.name} className="summary-item-img" placeholderClassName="summary-item-img" />}
                  </Link>
                  <div className="summary-item-details">
                    <div className="summary-item-name">
                      {item.name}{isQtyMode ? ` — باقة ${item.quantity} ${piecesLabel(item.quantity)}` : ` × ${item.quantity}`}
                    </div>
                    {[item.color, item.size].filter(Boolean).map((v, idx) => (
                      <span key={idx} className="summary-item-meta">{v}</span>
                    ))}
                  </div>
                  <div className="summary-item-price">{formatCurrency(lineSubtotal(item))}</div>
                </div>
              )
            })}
          </div>
          <div className="summary-row"><span>الإجمالي الفرعي</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="summary-row">
            <span>الشحن {quote.method ? `(${quote.method})` : ''}</span>
            <span>{quote.freeDelivery ? 'مجاني' : formatCurrency(quote.fee)}</span>
          </div>
          {coupon && <div className="summary-row"><span>الخصم ({coupon.code})</span><span>-{formatCurrency(coupon.discount)}</span></div>}
          <div className="summary-row total"><span>الإجمالي</span><strong>{formatCurrency(total)}</strong></div>
          {!quote.available && <p className="checkout-shipping-error" role="alert">{quote.unavailableReason}</p>}
          {quote.policy && <p className="muted small mt-1">{quote.policy}</p>}
          <p className="muted small mt-1">تاريخ اليوم: {todayKey()}</p>
        </aside>
      </div>
    </div>
  )
}
export default StoreCheckout

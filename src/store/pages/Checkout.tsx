import { FunctionalComponent } from 'preact'
import { useMemo, useState } from 'preact/hooks'
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
import { createOrderCallable } from '../../shared/services/auth'
import { GOVER_EG } from '../../shared/utils/constants'
import { formatCurrency, todayKey } from '../../shared/utils/format'
import { cartSubtotal, lineSubtotal, piecesLabel } from '../../shared/utils/pricing'
import { calculateShipping } from '../../shared/utils/shipping'
import type { ShippingZone } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

export const StoreCheckout: FunctionalComponent = () => {
  const { store } = useStore()
  const cart = useCart()
  const toast = useToast()
  const { user } = useAuth()
  const [form, setForm] = useState({ customerName: '', phone: '', governorate: '', city: '', address: '', notes: '', paymentMethod: 'cod' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ orderNumber: string; phone: string } | null>(null)

  const zonesRes = useCollection<ShippingZone>('shipping', { storeId: store?.id || '' })
  const zones = zonesRes.data || []
  const subtotal = cartSubtotal(cart.items)

  const quote = useMemo(
    () => calculateShipping({ store, zones, subtotal, governorate: form.governorate }),
    [store, zones, subtotal, form.governorate],
  )
  const total = subtotal + quote.fee

  const submit = async (e: Event) => {
    e.preventDefault()
    if (!form.customerName || !form.phone || !form.governorate || !form.city || !form.address) {
      toast.push('أكمل جميع الحقول المطلوبة', undefined, 'error')
      return
    }
    setLoading(true)
    try {
      // Attribution is keyed by store so a referral from another store can
      // never be attributed to this checkout (tenant isolation).
      const salesLinkRef = store?.id ? sessionStorage.getItem(`mk_sales_ref_${store.id}`) || undefined : undefined
      const landingPageId = store?.id ? sessionStorage.getItem(`mk_landing_${store.id}`) || undefined : undefined
      const res = await createOrderCallable({
        storeId: store?.id,
        items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity, color: i.color, size: i.size, variantId: i.variantId })),
        customer: { name: form.customerName, phone: form.phone, governorate: form.governorate, city: form.city, address: form.address, notes: form.notes || '' },
        paymentMethod: form.paymentMethod,
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
      <div className="order-confirmed">
        <div className="big-check"><Icon name="check_circle" /></div>
        <h1 className="auth-title">تم إنشاء طلبك بنجاح</h1>
        <p className="auth-subtitle">رقم طلبك: <strong className="monospace">{done.orderNumber}</strong></p>
        <p className="auth-subtitle">يمكنك متابعة طلبك باستخدام رقم الطلب ورقم الهاتف.</p>

        {isGuest && (
          <div className="mt-2">
            <h2 className="card-title mb-1">هل تريد إنشاء حساب لمتابعة جميع طلباتك بسهولة؟</h2>
            <p className="muted small mb-2">أنشئ حساباً الآن وسنربط هذا الطلب بحسابك تلقائياً — التسجيل اختياري.</p>
            <div className="flex" style={{ justifyContent: 'center' }}>
              <Link href={`/store/${store?.slug}/login?mode=signup&order=${encodeURIComponent(done.orderNumber)}&phone=${encodeURIComponent(done.phone)}`}>
                <Button icon="person_add">إنشاء حساب</Button>
              </Link>
            </div>
          </div>
        )}

        <div className="flex" style={{ justifyContent: 'center' }}>
          <Link href={`/store/${store?.slug}/track`}><Button variant="outline">تتبع الطلب</Button></Link>
          <Link href={`/store/${store?.slug}`}><Button>متابعة التسوق</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title mb-2">إتمام الطلب</h1>
      <div className="cart-layout">
        <form onSubmit={submit}>
          <div className="grid grid-2">
            <Input label="الاسم الكامل" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} required />
            <Input label="رقم الهاتف" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="01xxxxxxxxx" required />
          </div>
          <div className="grid grid-2">
            <Select label="المحافظة" value={form.governorate} onChange={(v) => setForm({ ...form, governorate: v })} placeholder="اختر المحافظة" options={GOVER_EG.map((g) => ({ value: g, label: g }))} />
            <Input label="المدينة" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
          </div>
          <Textarea label="العنوان بالتفصيل" value={form.address} onChange={(v) => setForm({ ...form, address: v })} rows={2} required />
          <Textarea label="ملاحظات (اختياري)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} rows={2} />
          <div className="field">
            <span className="field-label">طريقة الدفع</span>
            <div className="flex">
              <button type="button" className={`btn ${form.paymentMethod === 'cod' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setForm({ ...form, paymentMethod: 'cod' })}>الدفع عند الاستلام</button>
              <button type="button" className={`btn ${form.paymentMethod === 'bank' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setForm({ ...form, paymentMethod: 'bank' })}>تحويل بنكي</button>
            </div>
          </div>
          <Button type="submit" block size="lg" loading={loading} icon="shopping_cart_checkout">
            تأكيد الطلب — {formatCurrency(total)}
          </Button>
        </form>
        <div className="order-summary">
          <h3 className="card-title mb-1">ملخص الطلب</h3>
          {cart.items.map((item, i) => {
            const isQtyMode = item.pricingMode === 'quantity' && item.quantityTiers && item.quantityTiers.length > 0
            return (
              <div key={i} className="summary-row">
                <span>{item.name}{isQtyMode ? ` — باقة ${item.quantity} ${piecesLabel(item.quantity)}` : ` × ${item.quantity}`}</span>
                <span>{formatCurrency(lineSubtotal(item))}</span>
              </div>
            )
          })}
          <div className="summary-row"><span>الإجمالي الفرعي</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="summary-row">
            <span>الشحن {quote.method ? `(${quote.method})` : ''}</span>
            <span>{quote.freeDelivery ? 'مجاني' : formatCurrency(quote.fee)}</span>
          </div>
          <div className="summary-row total"><span>الإجمالي</span><span>{formatCurrency(total)}</span></div>
          {quote.policy && <p className="muted small mt-1">{quote.policy}</p>}
          <p className="muted small mt-1">تاريخ اليوم: {todayKey()}</p>
        </div>
      </div>
    </div>
  )
}
export default StoreCheckout

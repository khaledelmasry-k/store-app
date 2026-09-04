import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useCart } from '../../shared/hooks/useCart'
import { useToast } from '../../shared/hooks/useToast'
import { useAuth } from '../../shared/hooks/useAuth'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Textarea } from '../../shared/components/ui/Textarea'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { createOrderCallable, getPublicStoreCouponsCallable, getShippingOptionsCallable, quoteCouponCallable } from '../../shared/services/auth'
import { EGYPT_CITIES_BY_GOVERNORATE, GOVER_EG } from '../../shared/utils/constants'
import { formatCurrency, todayKey } from '../../shared/utils/format'
import { cartSubtotal, lineSubtotal, piecesLabel } from '../../shared/utils/pricing'
import { Icon } from '../../shared/components/ui/Icon'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { validatePaymentProofFile } from '../../shared/services/uploads'
import './Checkout.css'

const readProofDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('تعذر قراءة إثبات التحويل'))
  reader.onload = () => resolve(String(reader.result || ''))
  reader.readAsDataURL(file)
})

export const StoreCheckout: FunctionalComponent = () => {
  const { store } = useStore()
  const cart = useCart()
  const toast = useToast()
  const { user } = useAuth()
  const [form, setForm] = useState({ customerName: '', phone: '', governorate: '', city: '', area: '', address: '', notes: '', paymentMethod: 'cod', couponCode: '' })
  const [loading, setLoading] = useState(false)
  const [couponLoading, setCouponLoading] = useState(false)
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null)
  const [platformCoupons, setPlatformCoupons] = useState<Array<{ code: string; type: 'percent' | 'fixed'; value: number; minOrder: number }>>([])
  const [done, setDone] = useState<{ orderNumber: string; phone: string } | null>(null)
  const [shippingOptions, setShippingOptions] = useState<Array<{ providerId?: string; providerName?: string; serviceCode?: string; serviceName?: string; amount?: number; price?: number; currency?: string; etaMin?: number | null; etaMax?: number | null; etaUnit?: string; codAvailable?: boolean; trackingAvailable?: boolean; zoneId?: string | null; zoneName?: string | null }>>([])
  const [shippingUnavailableReason, setShippingUnavailableReason] = useState('')
  const [selectedShippingOption, setSelectedShippingOption] = useState('')
  const [bankTransferProof, setBankTransferProof] = useState<File | null>(null)
  const subtotal = cartSubtotal(cart.items)

  useEffect(() => {
    if (!store?.id) return
    let cancelled = false
    void getPublicStoreCouponsCallable({ storeId: store.id })
      .then((res) => { if (!cancelled) setPlatformCoupons(((res.data as any)?.coupons || []) as typeof platformCoupons) })
      .catch(() => { if (!cancelled) setPlatformCoupons([]) })
    return () => { cancelled = true }
  }, [store?.id])

  useEffect(() => {
    if (!store?.id || !form.governorate || cart.items.length === 0) { setShippingOptions([]); setShippingUnavailableReason(''); return }
    let cancelled = false
    void getShippingOptionsCallable({ storeId: store.id, destination: { governorate: form.governorate, city: form.city, area: form.area }, subtotal, packageWeightKg: 1 }).then((res) => {
      if (!cancelled) {
        const options = ((res.data as any)?.options || []) as Array<{ providerId?: string; providerName?: string; serviceCode?: string; serviceName?: string; amount?: number; price?: number; currency?: string; etaMin?: number | null; etaMax?: number | null; etaUnit?: string; codAvailable?: boolean; trackingAvailable?: boolean; zoneId?: string | null; zoneName?: string | null }>
        setShippingOptions(options)
        setShippingUnavailableReason(String((res.data as any)?.unavailableReason || ''))
        setSelectedShippingOption((current) => current && options.some((option) => `${option.providerId || ''}:${option.serviceCode || ''}` === current) ? current : (options[0] ? `${options[0].providerId || ''}:${options[0].serviceCode || ''}` : ''))
      }
    }).catch(() => { if (!cancelled) { setShippingOptions([]); setSelectedShippingOption(''); setShippingUnavailableReason('تعذر تحميل خيارات الشحن، حاول مرة أخرى.') } })
    return () => { cancelled = true }
  }, [store?.id, form.governorate, form.city, form.area, subtotal, cart.items.length])

  const providerQuote = shippingOptions.find((option) => `${option.providerId || ''}:${option.serviceCode || ''}` === selectedShippingOption) || shippingOptions[0]
  const quote = providerQuote
    ? {
      available: true,
      fee: Number(providerQuote.price ?? providerQuote.amount ?? 0),
      freeDelivery: Number(providerQuote.price ?? providerQuote.amount ?? 0) === 0,
      method: providerQuote.serviceName || providerQuote.providerName || 'شحن',
      policy: providerQuote.etaMin || providerQuote.etaMax ? `المدة المتوقعة: ${providerQuote.etaMin || '?'}–${providerQuote.etaMax || '?'} ${providerQuote.etaUnit === 'hours' ? 'ساعة' : 'يوم'}` : '',
      unavailableReason: undefined,
    }
    : {
      available: false,
      fee: 0,
      freeDelivery: false,
      method: form.governorate ? 'الشحن غير متوفر لهذه الوجهة' : '',
      policy: '',
      unavailableReason: form.governorate ? shippingUnavailableReason || 'لا توجد خدمة شحن مفعّلة لهذه الوجهة' : 'اختر المحافظة لعرض خيارات الشحن',
    }
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
    if (form.paymentMethod === 'bank') {
      const validation = bankTransferProof ? validatePaymentProofFile(bankTransferProof) : { message: 'أرفق صورة إثبات التحويل قبل تأكيد الطلب' }
      if (validation) {
        toast.push('إثبات التحويل مطلوب', validation.message, 'error')
        return
      }
    }
    setLoading(true)
    try {
      const salesLinkRef = store?.id ? sessionStorage.getItem(`mk_sales_ref_${store.id}`) || undefined : undefined
      const landingPageId = store?.id ? sessionStorage.getItem(`mk_landing_${store.id}`) || undefined : undefined
      const attribution = new URLSearchParams(window.location.search)
      const campaignId = sessionStorage.getItem(`mk_campaign_${store?.id || ''}`) || attribution.get('campaignId') || undefined
      const utmSource = attribution.get('utm_source') || undefined
      const utmCampaign = attribution.get('utm_campaign') || undefined
      const res = await createOrderCallable({
        storeId: store?.id,
        items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity, color: i.color, size: i.size, variantId: i.variantId })),
        customer: { name: form.customerName, phone: form.phone, governorate: form.governorate, city: form.city, area: form.area, address: form.address, notes: form.notes || '' },
        paymentMethod: form.paymentMethod,
        bankTransferProof: form.paymentMethod === 'bank' && bankTransferProof ? {
          dataUrl: await readProofDataUrl(bankTransferProof),
          name: bankTransferProof.name,
          contentType: bankTransferProof.type,
        } : undefined,
        couponCode: coupon?.code || form.couponCode.trim() || undefined,
        shippingProviderId: providerQuote?.providerId || undefined,
        shippingServiceCode: providerQuote?.serviceCode || undefined,
        packageWeightKg: 1,
        salesLinkRef,
        landingPageId,
        campaignId,
        utmSource,
        utmCampaign,
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
          <span className="confirmation-kicker">تم إنشاء طلبك بنجاح</span>
          <h1>طلبك وصل لنا بنجاح</h1>
          <p className="confirmation-subtitle">احتفظ بهذا الكود؛ ستحتاجه للتتبع، وهو المرجع الذي يُرسل لشركة الشحن عند إنشاء الشحنة.</p>
          <div className="confirmation-order-code">
            <span>كود الطلب</span>
            <strong className="monospace">{done.orderNumber}</strong>
          </div>

          {isGuest && (
            <div className="guest-signup">
              <h2>تابع طلباتك من مكان واحد</h2>
              <p className="muted small">أنشئ حساب عميل اختياريًا، وسنربط هذا الطلب بحسابك تلقائيًا.</p>
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
    <div className="storefront-page storefront-checkout storefront-checkout--stitch">
      <header className="checkout-hero">
        <span className="page-eyebrow">دفع آمن ومنظم</span>
        <h1 className="page-title">إتمام الطلب</h1>
        <p className="page-subtitle">أدخل بيانات التوصيل لإتمام طلبك بأمان.</p>
      </header>
      <div className="checkout-stepper" aria-label="خطوات الشراء">
        <span className="complete"><b>1</b> السلة</span><i /> <span className="active"><b>2</b> بيانات التوصيل</span><i /> <span><b>3</b> التأكيد</span>
      </div>
      <div className="checkout-layout">
        <form id="checkout-form" onSubmit={submit} className="checkout-form">
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
            {platformCoupons.length > 0 && <div className="coupon-available-list" aria-label="عروض متاحة">
              <span className="muted small">عروض متاحة:</span>
              {platformCoupons.map((item) => <button type="button" className="coupon-available" key={item.code} onClick={() => { setForm({ ...form, couponCode: item.code }); setCoupon(null) }}>
                <strong>{item.code}</strong><span>{item.type === 'percent' ? `${item.value}% خصم` : `${formatCurrency(item.value)} خصم`}</span>
              </button>)}
            </div>}
            {coupon && <p className="coupon-applied" role="status">تم تطبيق خصم {formatCurrency(coupon.discount)}</p>}
            <p className="muted small">سيتم التحقق من صلاحية الكود وتطبيقه على الخادم.</p>
          </section>

          <section className="checkout-section">
            <div className="checkout-section-header">
              <Icon name="location_on" className="checkout-section-icon" />
              <h2 className="checkout-section-title">عنوان الشحن</h2>
            </div>
            <div className="form-grid">
              <Select label="المحافظة" value={form.governorate} onChange={(v) => setForm({ ...form, governorate: v, city: '', area: '' })} placeholder="اختر المحافظة" options={GOVER_EG.map((g) => ({ value: g, label: g }))} />
              {form.governorate && EGYPT_CITIES_BY_GOVERNORATE[form.governorate]?.length ? <Select label="المدينة" value={form.city} onChange={(v) => setForm({ ...form, city: v, area: '' })} placeholder="اختر المدينة" options={EGYPT_CITIES_BY_GOVERNORATE[form.governorate].map((city) => ({ value: city, label: city }))} /> : <Input label="المدينة" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />}
              <Input label="المنطقة / الحي (اختياري)" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
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
              {shippingOptions.length > 0 ? shippingOptions.map((option) => {
                const optionKey = `${option.providerId || ''}:${option.serviceCode || ''}`
                const optionPrice = Number(option.price ?? option.amount ?? 0)
                return <label className="shipping-option" key={optionKey}>
                  <input type="radio" name="shipping" value={optionKey} checked={selectedShippingOption === optionKey} onChange={() => setSelectedShippingOption(optionKey)} />
                  <div className="shipping-option-content">
                    <div className="shipping-option-main">
                      <span className="shipping-option-name">{option.serviceName || option.providerName || 'شحن'}</span>
                      <span className="shipping-option-price">{optionPrice === 0 ? 'مجاني' : formatCurrency(optionPrice)}</span>
                    </div>
                    <p className="shipping-option-desc">{option.providerName}{option.etaMin || option.etaMax ? ` · ${option.etaMin || '?'}–${option.etaMax || '?'} ${option.etaUnit === 'hours' ? 'ساعة' : 'يوم'}` : ''}</p>
                  </div>
                </label>
              }) : <p className="checkout-shipping-error" role="alert">{quote.unavailableReason}</p>}
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
            {form.paymentMethod === 'bank' && <div className="shipping-policy mt-1">
              <Icon name="upload_file" className="policy-icon" />
              <label className="field" style={{ flex: 1 }}>
                <span className="field-label">صورة إثبات التحويل <span className="field-label-optional">(مطلوبة)</span></span>
                <input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setBankTransferProof((event.target as HTMLInputElement).files?.[0] || null)} />
                <span className="muted small">JPG أو PNG أو WebP — الحد الأقصى 5 ميجابايت. تُرسل للمراجعة مع الطلب.</span>
              </label>
            </div>}
          </section>

        </form>

        <aside className="order-summary order-summary--checkout" id="checkout-summary">
          <h2 className="summary-title">ملخص الطلب</h2>
          <div className="summary-items">
            {cart.items.map((item, i) => {
              const isQtyMode = item.pricingMode === 'quantity' && item.quantityTiers && item.quantityTiers.length > 0
              return (
                <div key={i} className="summary-item">
                  <Link href={`/store/${store?.slug}/product/${item.productId}`} className="summary-item-image">
                    <SmartImage src={item.image} alt={item.name} className="summary-item-img" placeholderClassName="summary-item-img" fallback="product" />
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
          <Button type="submit" form="checkout-form" block size="lg" loading={loading} disabled={!quote.available} icon="shopping_cart_checkout" className="checkout-submit-btn">
            تأكيد الطلب — {formatCurrency(total)}
          </Button>
        </aside>
      </div>
    </div>
  )
}
export default StoreCheckout

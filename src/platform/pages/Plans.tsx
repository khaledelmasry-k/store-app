import { FunctionalComponent, Fragment } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Toggle } from '../../shared/components/ui/Toggle'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { SegmentedControl } from '../../shared/components/ui/SegmentedControl'
import { Table } from '../../shared/components/ui/Table'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { savePlanCallable, syncCanonicalPlansCallable, manageSubscriptionCouponCallable, listSubscriptionCouponsCallable, getSubscriptionCouponRedemptionsCallable } from '../../shared/services/auth'
import { formatPriceEgp } from '../../shared/utils/format'
import { PLAN_FEATURE_KEYS, PLAN_FEATURE_LABELS, type PlanFeatureKey } from '../../shared/services/subscription'
import type { SubscriptionPlan } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import { CANONICAL_PLANS } from '../../shared/plans/catalog'

const emptyFlags = () => Object.fromEntries(PLAN_FEATURE_KEYS.map((k) => [k as string, false])) as Record<PlanFeatureKey, boolean>

function flagsOf(p?: SubscriptionPlan | null): Record<PlanFeatureKey, boolean> {
  return Object.fromEntries(PLAN_FEATURE_KEYS.map((k) => [k as string, !!p?.[k]])) as Record<PlanFeatureKey, boolean>
}

// Format a launchExpiresAt value (date string | Firestore Timestamp | null) as
// the YYYY-MM-DD the <input type="date"> expects for its `value`.
// Accept `any` because the form stores an edited date-string while Firestore
// yields a Timestamp — the shape is normalized by savePlan server-side.
function formatLaunchDate(v?: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v.slice(0, 10)
  const t = v
  let ms: number
  if (typeof t.toDate === 'function') ms = t.toDate().getTime()
  else if (typeof t.seconds === 'number') ms = t.seconds * 1000
  else ms = new Date(t).getTime()
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const PlatformPlans: FunctionalComponent = () => {
  const plansRes = useCollection<SubscriptionPlan>('plans', { orderBy: { field: 'sortOrder' } })
  const plans = [...plansRes.data]
    .filter((p) => p.active !== false && (p as any).isPurchasable !== false && (p as any).archived !== true)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const subscriptionPlans = plans.filter((p) => p.billingModel !== 'one_time')
  const lifetimeOffers = plans.filter((p) => p.billingModel === 'one_time')
  const toast = useToast()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [form, setForm] = useState<Partial<SubscriptionPlan>>({ features: [] as string[] })
  const [flags, setFlags] = useState<Record<PlanFeatureKey, boolean>>(emptyFlags())
  const [syncing, setSyncing] = useState(false)
  // Subscription promo codes — SuperAdmin only, distinct from store customer coupons
  const [couponForm, setCouponForm] = useState({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 30,
    applicablePlanIds: ['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'] as string[],
    applicableBillingCycles: ['monthly'] as string[],
    startsAt: '',
    expiresAt: '',
    globalMaxRedemptions: '' as string,
    active: true,
    partner: '',
    internalNotes: '',
  })
  const [couponSaving, setCouponSaving] = useState(false)
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null)
  const [subscriptionCoupons, setSubscriptionCoupons] = useState<any[]>([])
  const [couponsLoading, setCouponsLoading] = useState(false)
  const [couponUsages, setCouponUsages] = useState<Record<string, any[]>>({})

  const recommendedId = [...subscriptionPlans].sort((a, b) => a.priceMonthly - b.priceMonthly)[Math.max(0, Math.floor((subscriptionPlans.length - 1) / 2))]?.id

  const priceOf = (p: SubscriptionPlan) => (billing === 'monthly' ? p.priceMonthly : p.priceYearly || p.priceMonthly * 10)
  const storageLabel = (mb?: number) => {
    const value = Number(mb || 0)
    if (value >= 1024) {
      const gb = value / 1024
      return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`
    }
    return `${value} MB`
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ features: [], billingModel: 'subscription' })
    setFlags(emptyFlags())
    setOpen(true)
  }

  const openEdit = (p: SubscriptionPlan) => {
    setEditing(p)
    setForm({ ...p, features: p.features || [] })
    setFlags(flagsOf(p))
    setOpen(true)
  }

  const submit = async () => {
    if (!form.name || (form.billingModel === 'one_time' ? !(Number(form.oneTimePrice) > 0) : (form.priceMonthly == null || Number(form.priceMonthly) < 0))) {
      toast.push('أكمل بيانات الباقة', undefined, 'error')
      return
    }
    const payload = {
      name: form.name,
      billingModel: form.billingModel === 'one_time' ? 'one_time' : 'subscription',
      oneTimePrice: Number(form.oneTimePrice || 0),
      slug: (form.slug || '').trim() || undefined,
      description: form.description || '',
      priceMonthly: Number(form.priceMonthly),
      priceYearly: Number(form.priceYearly || 0),
      trialDays: Number(form.trialDays ?? 0),
      launchPrice: Number(form.launchPrice || 0),
      launchEnabled: !!form.launchEnabled,
       productLimit: Number(form.productLimit || 10),
       orderLimitPerMonth: Number(form.orderLimitPerMonth || 0),
       landingPagesLimit: Number(form.landingPagesLimit || 0),
       salesLinksLimit: Number(form.salesLinksLimit || 0),
       staffLimit: Number(form.staffLimit || 0),
       storageLimit: Number(form.storageLimit || 0),
       isPopular: !!form.isPopular,
       sortOrder: Number(form.sortOrder || 0),
       features: form.features || [],
       ...flags,
       // Explicit unlimited flags supersede the numeric limits above. When a
       // flag is true the numeric cap is ignored (treated as uncapped) by the
       // server gates; when false the numeric cap (incl. 0 = none) is enforced.
       unlimitedProducts: form.unlimitedProducts === true,
       unlimitedSalesLinks: form.unlimitedSalesLinks === true,
       isLaunchOffer: form.billingModel === 'one_time' ? form.isLaunchOffer !== false : false,
       isPubliclyAvailable: form.billingModel === 'one_time' ? form.isPubliclyAvailable !== false : true,
       launchOfferLimit: form.billingModel === 'one_time' ? Math.max(0, Number(form.launchOfferLimit || 0)) : 0,
       launchOfferSoldCount: form.billingModel === 'one_time' ? Math.max(0, Number(form.launchOfferSoldCount || 0)) : 0,
       launchOfferEndsAt: form.billingModel === 'one_time' ? form.launchOfferEndsAt : null,
       active: form.active ?? true,
    }
    try {
      await savePlanCallable({ planId: editing?.id, plan: payload })
      toast.push(editing ? 'تم تحديث الباقة' : 'تم إنشاء الباقة')
      setOpen(false)
    } catch (err: any) {
      toast.push('فشل حفظ الباقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const toggleActive = async (p: SubscriptionPlan) => {
    try {
      await savePlanCallable({ planId: p.id, plan: { ...p, active: !p.active } })
      toast.push(p.active ? 'تم إيقاف الباقة' : 'تم تفعيل الباقة')
    } catch (err: any) {
      toast.push('فشل تحديث حالة الباقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const syncCanonical = async () => {
    setSyncing(true)
    try {
      const res = await syncCanonicalPlansCallable()
      const count = (res.data as { count?: number })?.count || CANONICAL_PLANS.length
      toast.push('تمت مزامنة كتالوج الخطط', `${count} خطط محدثة بالأسعار الحالية`, 'success')
    } catch (err: any) {
      toast.push('فشل مزامنة الخطط', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const fetchSubscriptionCoupons = async () => {
    setCouponsLoading(true)
    try {
      const res: any = await listSubscriptionCouponsCallable()
      setSubscriptionCoupons(res.data?.coupons || [])
    } catch {
      setSubscriptionCoupons([])
    } finally { setCouponsLoading(false) }
  }
  useEffect(() => { fetchSubscriptionCoupons() }, [])

  const resetCouponForm = () => {
    setCouponForm({
      code: '',
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: 30,
      applicablePlanIds: ['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'],
      applicableBillingCycles: ['monthly'],
      startsAt: '',
      expiresAt: '',
      globalMaxRedemptions: '',
      active: true,
      partner: '',
      internalNotes: '',
    })
    setEditingCouponId(null)
  }

  const editCoupon = (c: any) => {
    const fmt = (v: any) => {
      if (!v) return ''
      if (typeof v === 'string') return v.slice(0, 10)
      try {
        const ms = typeof (v as any).toMillis === 'function' ? (v as any).toMillis() : typeof (v as any).seconds === 'number' ? (v as any).seconds * 1000 : new Date(v).getTime()
        if (!Number.isFinite(ms)) return ''
        const d = new Date(ms)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      } catch { return '' }
    }
    setCouponForm({
      code: String(c.code || '').toUpperCase(),
      name: String(c.name || ''),
      description: String(c.description || ''),
      discountType: c.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: Number(c.discountValue || 0),
      applicablePlanIds: Array.isArray(c.applicablePlanIds) && c.applicablePlanIds.length ? c.applicablePlanIds : ['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'],
      applicableBillingCycles: Array.isArray(c.applicableBillingCycles) && c.applicableBillingCycles.length ? c.applicableBillingCycles : ['monthly'],
      startsAt: fmt(c.startsAt),
      expiresAt: fmt(c.expiresAt),
      globalMaxRedemptions: c.globalMaxRedemptions != null ? String(c.globalMaxRedemptions) : c.maxRedemptions != null ? String(c.maxRedemptions) : '',
      active: c.active !== false,
      partner: String(c.partner || c.source || ''),
      internalNotes: String(c.internalNotes || ''),
    })
    setEditingCouponId(String(c.id))
  }

  const saveSubscriptionCoupon = async () => {
    setCouponSaving(true)
    try {
      const payload: Record<string, unknown> = {
        code: couponForm.code.toUpperCase(),
        name: couponForm.name,
        description: couponForm.description,
        internalNotes: couponForm.internalNotes,
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue),
        applicablePlanIds: couponForm.applicablePlanIds,
        applicableBillingCycles: couponForm.applicableBillingCycles,
        firstCycleOnly: true,
        perMerchantLimit: 1,
        active: couponForm.active,
        partner: couponForm.partner,
        source: couponForm.partner,
        startsAt: couponForm.startsAt ? new Date(couponForm.startsAt).toISOString() : null,
        expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null,
        globalMaxRedemptions: couponForm.globalMaxRedemptions ? Number(couponForm.globalMaxRedemptions) : null,
      }
      if (editingCouponId) {
        await manageSubscriptionCouponCallable({ operation: 'update', couponId: editingCouponId, coupon: payload })
        toast.push('تم تحديث كوبون الاشتراك', undefined, 'success')
      } else {
        await manageSubscriptionCouponCallable({ operation: 'create', coupon: payload })
        toast.push('تم إنشاء كوبون اشتراكات المنصة', undefined, 'success')
      }
      resetCouponForm()
      await fetchSubscriptionCoupons()
    } catch (err: any) {
      toast.push('فشل حفظ كوبون الاشتراك', err?.message || 'تحقق من البيانات', 'error')
    } finally { setCouponSaving(false) }
  }

  const toggleCouponActive = async (c: any) => {
    try {
      await manageSubscriptionCouponCallable({ operation: 'update', couponId: c.id, coupon: { active: !c.active } })
      toast.push(c.active ? 'تم تعطيل الكود' : 'تم تفعيل الكود')
      await fetchSubscriptionCoupons()
    } catch (err: any) { toast.push('فشل تحديث الحالة', err?.message, 'error') }
  }

  const viewCouponUsage = async (c: any) => {
    try {
      const res: any = await getSubscriptionCouponRedemptionsCallable({ couponId: c.id })
      setCouponUsages((prev) => ({ ...prev, [c.id]: res.data?.redemptions || [] }))
    } catch (err: any) { toast.push('تعذر تحميل الاستخدام', err?.message, 'error') }
  }

  return (
    <div className="platform-operations platform-plans-page">
      <PageHeader
          title="العروض التجارية"
          subtitle={`${subscriptionPlans.length} باقات اشتراك${lifetimeOffers.length ? ` · ${lifetimeOffers.length} عرض شراء مرة واحدة` : ''}`}
          context={<span className="platform-intro-meta">الأسعار والحدود والمزايا المعتمدة للمنصة</span>}
          actions={
            <div className="flex">
              <Button variant="outline" icon="sync" loading={syncing} onClick={syncCanonical}>مزامنة الخطط الحالية</Button>
              <Button icon="add" onClick={openCreate}>باقة جديدة</Button>
            </div>
          }
        />

      <Card title="مصفوفة الخطط الحالية" subtitle="المصدر المرجعي للأسعار والحدود المطلوبة" className="mb-2">
        <Table
          cardMode
          rows={CANONICAL_PLANS.filter((p) => p.billingModel !== 'one_time').map((p) => ({ ...p, id: p.id }))}
          columns={[
            { key: 'name', header: 'الخطة' },
            { key: 'model', header: 'النموذج', render: (p) => p.billingModel === 'one_time' ? 'شراء مرة واحدة' : 'اشتراك' },
            { key: 'price', header: 'السعر', render: (p) => p.billingModel === 'one_time' ? `${formatPriceEgp(Number(p.oneTimePrice || 0))} دفعة واحدة` : `${formatPriceEgp(p.priceMonthly)} / شهر، ${formatPriceEgp(p.priceYearly)} / سنة` },
            { key: 'orders', header: 'الطلبات', render: (p) => `${p.orderLimitPerMonth} / شهر` },
            { key: 'products', header: 'المنتجات', render: (p) => p.unlimitedProducts ? 'غير محدود' : p.productLimit },
            { key: 'users', header: 'المستخدمون', render: (p) => p.staffLimit || 1 },
            { key: 'storage', header: 'التخزين', render: (p) => storageLabel(p.storageLimit) },
            { key: 'features', header: 'المزايا', render: (p) => [
              p.coupons ? 'كوبونات' : null,
              p.salesLinksLimit || p.unlimitedSalesLinks ? 'روابط بيع' : null,
              p.analytics ? 'تقارير أساسية' : null,
              p.quantityPricing ? 'تسعير بالكمية' : null,
              p.variantInventory ? 'متغيرات ومخزون' : null,
            ].filter(Boolean).join('، ') || 'أساسي' },
          ]}
        />
        <p className="muted small" style={{ marginTop: 12 }}>
          BUSINESS — باقة تاريخية محفوظة للتوافق مع الاشتراكات القائمة (غير معروضة للبيع)
        </p>
      </Card>

      <div className="flex-between mb-2">
        <SegmentedControl
          value={billing}
          onChange={(v) => setBilling(v as 'monthly' | 'yearly')}
          options={[{ value: 'monthly', label: 'شهري' }, { value: 'yearly', label: 'سنوي' }]}
        />
      </div>

      {subscriptionPlans.length === 0 ? (
        <EmptyState title="لا توجد باقات" description="أنشئ أول باقة اشتراك للتجار" icon="workspace_premium" />
      ) : (
        <div className="plan-grid">
          {subscriptionPlans.map((p) => {
            const recommended = p.isPopular ?? p.id === recommendedId
            const featureList = PLAN_FEATURE_KEYS.filter((k) => flagsOf(p)[k])
            const featureLabels = new Set(featureList.map((k) => PLAN_FEATURE_LABELS[k]))
            const displayFeatures = (p.features || []).filter((f) =>
              !(p.unlimitedProducts && f === 'منتجات غير محدودة')
              && !(p.unlimitedSalesLinks && f === 'روابط بيع غير محدودة')
              && !featureLabels.has(f as any),
            )
            return (
              <div key={p.id} className={`plan-pricing-card${recommended ? ' plan-pricing-card--featured' : ''}`}>
                {recommended && <span className="plan-pricing-badge">الأكثر طلباً</span>}
                <div className="plan-pricing-head">
                  <h3 className="plan-pricing-name">{p.name}</h3>
                  {p.active ? <Badge tone="green">متاحة</Badge> : <Badge tone="slate">موقوفة</Badge>}
                </div>
                {p.description && <p className="plan-pricing-desc">{p.description}</p>}
                <div className="plan-pricing-price">
                  <strong>{p.billingModel === 'one_time' ? formatPriceEgp(Number(p.oneTimePrice || 0)) : formatPriceEgp(priceOf(p))}</strong>
                  <span>{p.billingModel === 'one_time' ? 'دفعة واحدة' : `/ ${billing === 'monthly' ? 'شهرياً' : 'سنوياً'}`}</span>
                </div>
                {p.billingModel !== 'one_time' && p.launchEnabled && Number(p.launchPrice) > 0 && (
                  <div className="plan-pricing-launch">أول شهر {formatPriceEgp(p.launchPrice)} (خصم إطلاق)</div>
                )}
                {p.billingModel !== 'one_time' && Number(p.priceMonthly || 0) > 0 && Number(p.trialDays ?? 0) > 0 && <div className="plan-pricing-trial">تجربة مجانية {Number(p.trialDays ?? 0)} يوم</div>}
                <ul className="plan-pricing-features">
                  {displayFeatures.map((f, i) => (
                    <li key={i}>
                      <Icon name="check_circle" />
                      {f}
                    </li>
                  ))}
                  <li>
                    <Icon name="inventory_2" />
                    {p.unlimitedProducts ? 'منتجات غير محدودة' : `حتى ${p.productLimit} منتج`}
                  </li>
                  <li>
                    <Icon name="receipt_long" />
                    {p.orderLimitPerMonth > 0 ? `حتى ${p.orderLimitPerMonth} طلب شهرياً` : 'طلبات غير محدودة'}
                  </li>
                  {Number(p.landingPagesLimit || 0) > 0 && <li>
                    <Icon name="web" />
                    حتى {p.landingPagesLimit} صفحة هبوط
                  </li>}
                  {(p.unlimitedSalesLinks || Number(p.salesLinksLimit || 0) > 0) && <li>
                    <Icon name="link" />
                    {p.unlimitedSalesLinks ? 'روابط بيع غير محدودة' : `حتى ${p.salesLinksLimit} رابط بيع`}
                  </li>}
                  <li>
                    <Icon name="group_add" />
                    حتى {p.staffLimit || 1} عضو فريق
                  </li>
                  <li>
                    <Icon name="database" />
                    {storageLabel(p.storageLimit)}
                  </li>
                  {featureList.length > 0 && (
                    <li>
                      <Icon name="star" />
                      {featureList.map((k) => PLAN_FEATURE_LABELS[k]).join('، ')}
                    </li>
                  )}
                </ul>
                <div className="plan-pricing-actions">
                  <Button variant="soft" size="sm" icon="edit" onClick={() => openEdit(p)}>تعديل</Button>
                  <Button variant={p.active ? 'ghost' : 'outline'} size="sm" icon={p.active ? 'block' : 'check'} onClick={() => toggleActive(p)}>{p.active ? 'إيقاف' : 'تفعيل'}</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {lifetimeOffers.length > 0 && (
        <Card title="عرض الشراء لمرة واحدة" subtitle="امتلك متجرك — لا يُعامل كاشتراك دوري، وتظل المزايا والحدود صريحة." className="mt-2">
          <div className="plan-grid">
            {lifetimeOffers.map((p) => (
              <div key={p.id} className="plan-pricing-card plan-pricing-card--lifetime">
                <div className="plan-pricing-head">
                  <h3 className="plan-pricing-name">امتلك متجرك</h3>
                  <Badge tone={p.isPubliclyAvailable !== false && p.active !== false ? 'green' : 'slate'}>{p.isPubliclyAvailable !== false && p.active !== false ? 'متاح للطلب' : 'مغلق'}</Badge>
                </div>
                <p className="plan-pricing-desc">دفعة واحدة لحق استخدام دائم لمتجر واحد، وفق حدود العرض.</p>
                <div className="plan-pricing-price"><strong>{formatPriceEgp(Number(p.oneTimePrice || 0))}</strong><span>دفعة واحدة</span></div>
                <ul className="plan-pricing-features">
                  <li><Icon name="inventory_2" />حتى {p.productLimit} منتج</li>
                  <li><Icon name="receipt_long" />حتى {p.orderLimitPerMonth} طلب</li>
                  <li><Icon name="group_add" />حتى {p.staffLimit || 1} أعضاء فريق</li>
                  <li><Icon name="database" />{storageLabel(p.storageLimit)}</li>
                  <li><Icon name="verified" />لا يوجد انتهاء لملكية المتجر الأساسية</li>
                </ul>
                <p className="muted small">المقاعد المستخدمة: {Number(p.launchOfferSoldCount || 0)}{Number(p.launchOfferLimit || 0) > 0 ? ` / ${p.launchOfferLimit}` : ''}</p>
                <div className="plan-pricing-actions">
                  <Button variant="soft" size="sm" icon="edit" onClick={() => openEdit(p)}>تعديل العرض</Button>
                  <Button variant={p.isPubliclyAvailable === false ? 'outline' : 'ghost'} size="sm" onClick={() => savePlanCallable({ planId: p.id, plan: { ...p, isPubliclyAvailable: p.isPubliclyAvailable === false } }).then(() => toast.push(p.isPubliclyAvailable === false ? 'تم فتح العرض' : 'تم إغلاق العرض')).catch((err: any) => toast.push('فشل تحديث العرض', err?.message, 'error'))}>{p.isPubliclyAvailable === false ? 'فتح العرض' : 'إغلاق العرض'}</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="كوبونات الاشتراكات" subtitle="كوبونات اشتراكات Matjari التي يديرها SuperAdmin فقط — منفصلة تماماً عن كوبونات متاجر التجار. خصم واحد لكل تاجر لكل كود، الحد الأقصى 99% أو مبلغ ثابت يضمن دفع ≥1 ج.م." className="mt-2">
        <div className="grid grid-2">
          <Input label="الكود (3-20 حرف إنجليزي/أرقام)" value={couponForm.code} onChange={(v) => setCouponForm({ ...couponForm, code: v.toUpperCase() })} hint="مثال: WELCOME30" />
          <Input label="الاسم الداخلي" value={couponForm.name} onChange={(v) => setCouponForm({ ...couponForm, name: v })} hint="مثال: خصم ترحيبي 30%" />
        </div>
        <Textarea label="الوصف الداخلي" value={couponForm.description} onChange={(v) => setCouponForm({ ...couponForm, description: v })} rows={2} />
        <div className="grid grid-2">
          <label className="field">
            <span className="field-label">نوع الخصم</span>
            <select className="input" value={couponForm.discountType} onChange={(e) => setCouponForm({ ...couponForm, discountType: (e.target as HTMLSelectElement).value as 'percentage' | 'fixed' })}>
              <option value="percentage">نسبة مئوية (PERCENT)</option>
              <option value="fixed">مبلغ ثابت (FIXED)</option>
            </select>
          </label>
          <Input label={couponForm.discountType === 'percentage' ? 'قيمة الخصم % (1-99)' : 'قيمة الخصم (ج.م)'} type="number" value={couponForm.discountValue} onChange={(v) => setCouponForm({ ...couponForm, discountValue: Number(v) })} hint={couponForm.discountType === 'percentage' ? 'الحد الأقصى 99%' : 'يجب أن يبقى المبلغ النهائي ≥1 ج.م'} />
        </div>
        <div className="field">
          <span className="field-label">الباقات المطبقة</span>
          <div className="flex" style={{ gap: 12, flexWrap: 'wrap' }}>
            {['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'].map((pid) => (
              <label key={pid} className="flex" style={{ gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={couponForm.applicablePlanIds.includes(pid)} onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  setCouponForm({ ...couponForm, applicablePlanIds: checked ? [...couponForm.applicablePlanIds, pid] : couponForm.applicablePlanIds.filter((id) => id !== pid) })
                }} />
                <span>{pid.replace('plan-', '').toUpperCase()}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">دورة الفوترة</span>
          <div className="flex" style={{ gap: 12 }}>
            {(['monthly', 'yearly'] as const).map((bc) => (
              <label key={bc} className="flex" style={{ gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={couponForm.applicableBillingCycles.includes(bc)} onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  setCouponForm({ ...couponForm, applicableBillingCycles: checked ? [...couponForm.applicableBillingCycles, bc] : couponForm.applicableBillingCycles.filter((x) => x !== bc) })
                }} />
                <span>{bc === 'monthly' ? 'شهري' : 'سنوي'}</span>
              </label>
            ))}
          </div>
          <p className="muted small">حسب القرار الحالي، الكوبون للدورة الأولى فقط — لا يتكرر شهرياً ولا عند التجديد أو تغيير الباقة.</p>
        </div>
        <div className="grid grid-2">
          <Input type="date" label="تاريخ البداية (اختياري)" value={couponForm.startsAt} onChange={(v) => setCouponForm({ ...couponForm, startsAt: v })} />
          <Input type="date" label="تاريخ الانتهاء (اختياري)" value={couponForm.expiresAt} onChange={(v) => setCouponForm({ ...couponForm, expiresAt: v })} />
        </div>
        <div className="grid grid-2">
          <Input label="الحد الأقصى العام للاستخدام (اختياري)" type="number" value={couponForm.globalMaxRedemptions} onChange={(v) => setCouponForm({ ...couponForm, globalMaxRedemptions: v })} hint="فارغ = بلا حد" />
          <Input label="الشريك/المصدر (اختياري)" value={couponForm.partner} onChange={(v) => setCouponForm({ ...couponForm, partner: v })} hint="مثال: wasla أو حملة تسويقية" />
        </div>
        <Textarea label="ملاحظات داخلية (اختياري)" value={couponForm.internalNotes} onChange={(v) => setCouponForm({ ...couponForm, internalNotes: v })} rows={2} />
        <div className="field" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Toggle checked={couponForm.active} onChange={(v) => setCouponForm({ ...couponForm, active: v })} label="مفعل" />
          <span className="muted small">لكل تاجر استخدام واحد فقط لنفس الكود (perMerchantLimit = 1)</span>
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <Button icon="save" loading={couponSaving} onClick={saveSubscriptionCoupon}>{editingCouponId ? 'تحديث الكود' : 'إنشاء كود خصم'}</Button>
          {editingCouponId && <Button variant="ghost" onClick={resetCouponForm}>إلغاء التعديل</Button>}
          <Button variant="outline" onClick={fetchSubscriptionCoupons} icon="sync">تحديث القائمة</Button>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>أمثلة خصم عادية يحددها SuperAdmin: ‎20% أو 30% أو 50% أو مبلغ ثابت — لا يُسمح بـ100% أو مبلغ يجعل الاشتراك مجانياً.</p>
      </Card>

      <Card title="قائمة كوبونات الاشتراكات" subtitle="Code · Discount · Plans · Billing · Status · Uses · Limit · Start · Expiry" className="mt-2">
        {couponsLoading ? <p className="muted small">جاري التحميل...</p> : subscriptionCoupons.length === 0 ? <p className="muted small">لا توجد أكواد — أنشئ أول كود خصم.</p> : (
          <Table
            cardMode
            rows={subscriptionCoupons}
            columns={[
              { key: 'code', header: 'الكود', render: (c: any) => <strong>{c.code}</strong> },
              { key: 'discount', header: 'الخصم', render: (c: any) => c.discountType === 'percentage' ? `${c.discountValue}%` : `${formatPriceEgp(Number(c.discountValue))}` },
              { key: 'plans', header: 'الباقات', render: (c: any) => (c.applicablePlanIds || []).map((id: string) => id.replace('plan-', '')).join(', ') },
              { key: 'billing', header: 'الدورة', render: (c: any) => (c.applicableBillingCycles || []).join(', ') },
              { key: 'status', header: 'الحالة', render: (c: any) => c.active === false ? <Badge tone="slate">معطل</Badge> : <Badge tone="green">مفعل</Badge> },
              { key: 'uses', header: 'الاستخدام', render: (c: any) => `${c.redemptionCount || 0}` },
              { key: 'limit', header: 'الحد العام', render: (c: any) => c.globalMaxRedemptions != null ? String(c.globalMaxRedemptions) : c.maxRedemptions != null ? String(c.maxRedemptions) : '—' },
              { key: 'startsAt', header: 'البداية', render: (c: any) => c.startsAt ? new Date(typeof c.startsAt.toMillis === 'function' ? c.startsAt.toMillis() : c.startsAt.seconds ? c.startsAt.seconds * 1000 : c.startsAt).toLocaleDateString('ar-EG') : '—' },
              { key: 'expiresAt', header: 'الانتهاء', render: (c: any) => c.expiresAt ? new Date(typeof c.expiresAt.toMillis === 'function' ? c.expiresAt.toMillis() : c.expiresAt.seconds ? c.expiresAt.seconds * 1000 : c.expiresAt).toLocaleDateString('ar-EG') : '—' },
              { key: 'actions', header: 'إجراءات', render: (c: any) => (
                <div className="flex" style={{ gap: 4 }}>
                  <Button size="sm" variant="soft" onClick={() => editCoupon(c)}>تعديل</Button>
                  <Button size="sm" variant={c.active === false ? 'outline' : 'ghost'} onClick={() => toggleCouponActive(c)}>{c.active === false ? 'تفعيل' : 'تعطيل'}</Button>
                  <Button size="sm" variant="outline" onClick={() => viewCouponUsage(c)}>الاستخدام</Button>
                </div>
              ) },
            ]}
          />
        )}
        {Object.keys(couponUsages).length > 0 && (
          <div className="mt-2">
            {Object.entries(couponUsages).map(([couponId, usages]) => (
              <Card key={couponId} title={`استخدام الكود ${subscriptionCoupons.find((c) => c.id === couponId)?.code || couponId}`} className="mt-2">
                {(usages as any[]).length === 0 ? <p className="muted small">لا يوجد استخدام بعد.</p> : (
                  <Table
                    cardMode
                    rows={usages as any[]}
                    columns={[
                      { key: 'merchantId', header: 'التاجر', render: (r: any) => r.merchantId?.slice(0, 8) || '—' },
                      { key: 'planId', header: 'الباقة', render: (r: any) => r.planId || '—' },
                      { key: 'billingCycle', header: 'الدورة', render: (r: any) => r.billingCycle || '—' },
                      { key: 'originalPrice', header: 'السعر الأصلي', render: (r: any) => formatPriceEgp(Number(r.originalPrice || 0)) },
                      { key: 'discountAmount', header: 'الخصم', render: (r: any) => formatPriceEgp(Number(r.discountAmount || 0)) },
                      { key: 'finalPrice', header: 'النهائي', render: (r: any) => formatPriceEgp(Number(r.finalPrice || 0)) },
                      { key: 'redeemedAt', header: 'تاريخ الاستخدام', render: (r: any) => r.redeemedAt ? new Date(typeof r.redeemedAt.toMillis === 'function' ? r.redeemedAt.toMillis() : r.redeemedAt.seconds ? r.redeemedAt.seconds * 1000 : r.redeemedAt).toLocaleDateString('ar-EG') : '—' },
                      { key: 'status', header: 'الحالة', render: (r: any) => r.status || '—' },
                    ]}
                  />
                )}
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل الباقة' : 'إنشاء باقة جديدة'}
        footer={
          <Fragment>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit}>حفظ</Button>
          </Fragment>
        }
      >
        <Input label="اسم الباقة" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required />
        <label className="field-label">نوع العرض</label>
        <select className="input" value={form.billingModel || 'subscription'} onChange={(e) => setForm({ ...form, billingModel: (e.target as HTMLSelectElement).value as 'subscription' | 'one_time' })}>
          <option value="subscription">اشتراك شهري / سنوي</option>
          <option value="one_time">شراء المتجر مرة واحدة</option>
        </select>
        <div className="grid grid-2">
          <Input label="Slug (للرابط)" value={form.slug || ''} onChange={(v) => setForm({ ...form, slug: v })} hint="مثال: growth" />
          <Input label="ترتيب العرض" type="number" value={form.sortOrder || 0} onChange={(v) => setForm({ ...form, sortOrder: Number(v) })} hint="الأصغر يظهر أولاً" />
        </div>
        <Textarea label="الوصف" value={form.description || ''} onChange={(v) => setForm({ ...form, description: v })} rows={2} />
        {form.billingModel === 'one_time' ? (
          <Input label="سعر الشراء لمرة واحدة" type="number" value={form.oneTimePrice || ''} onChange={(v) => setForm({ ...form, oneTimePrice: Number(v) })} hint="يُستخدم فقط بعد اعتماد الدفع من مدير المنصة." />
        ) : (
          <div className="grid grid-2">
            <Input label="السعر الشهري" type="number" value={form.priceMonthly || ''} onChange={(v) => setForm({ ...form, priceMonthly: Number(v) })} />
            <Input label="السعر السنوي" type="number" value={form.priceYearly || ''} onChange={(v) => setForm({ ...form, priceYearly: Number(v) })} />
          </div>
        )}
        {form.billingModel === 'one_time' && <>
          <div className="field"><Toggle checked={form.isLaunchOffer ?? true} onChange={(v) => setForm({ ...form, isLaunchOffer: v })} label="عرض إطلاق" /></div>
          <div className="field"><Toggle checked={form.isPubliclyAvailable ?? true} onChange={(v) => setForm({ ...form, isPubliclyAvailable: v })} label="متاح للطلبات الجديدة" /></div>
          <div className="grid grid-2">
            <Input label="حد مقاعد العرض (0 = بلا حد)" type="number" value={form.launchOfferLimit || ''} onChange={(v) => setForm({ ...form, launchOfferLimit: Math.max(0, Number(v)) })} />
            <Input type="date" label="تاريخ إغلاق العرض (اختياري)" value={formatLaunchDate(form.launchOfferEndsAt)} onChange={(v) => setForm({ ...form, launchOfferEndsAt: v ? String(v).slice(0, 10) : null } as any)} />
          </div>
          <p className="muted small">المقاعد المستخدمة يديرها الخادم ولا يمكن تعديلها من الواجهة.</p>
        </>}
        {form.billingModel !== 'one_time' && <div className="grid grid-2">
          <Input label="مدة التجربة (أيام)" type="number" value={form.trialDays ?? 0} onChange={(v) => setForm({ ...form, trialDays: Math.min(90, Math.max(0, Number(v))) })} hint="صفر للباقات المدفوعة بلا تجربة مستقلة؛ Free الحالية 30 يومًا" />
          <Input label="سعر الإطلاق (الشهر الأول)" type="number" value={form.launchPrice || ''} onChange={(v) => setForm({ ...form, launchPrice: Number(v) })} />
        </div>}
        {form.billingModel !== 'one_time' && <div className="field">
          <Toggle checked={form.launchEnabled ?? false} onChange={(v) => setForm({ ...form, launchEnabled: v })} label="تفعيل خصم الإطلاق للشهر الأول" />
        </div>}
        {form.billingModel !== 'one_time' && form.launchEnabled && (
          <Input
            type="date"
            label="انتهاء عرض الإطلاق"
            hint="يُعفّس خصم الإطلاق تلقائياً بعد هذا التاريخ. اتركه فارغاً لتفعيل غير محدد‌ة بوقت."
            value={formatLaunchDate(form.launchExpiresAt)}
            onChange={(v) => setForm({ ...form, launchExpiresAt: v ? String(v).slice(0, 10) : null } as any)}
          />
        )}
        <div className="field">
          <Toggle checked={form.isPopular ?? false} onChange={(v) => setForm({ ...form, isPopular: v })} label="الأكثر طلباً (يُبرز الباقة)" />
        </div>
        <div className="grid grid-2">
          <Input label="حد المنتجات" type="number" value={form.productLimit ?? 10} onChange={(v) => setForm({ ...form, productLimit: Number(v) })} />
          <Input label="حد الطلبات الشهري" type="number" value={form.orderLimitPerMonth || ''} onChange={(v) => setForm({ ...form, orderLimitPerMonth: Number(v) })} />
        </div>
        <div className="grid grid-2">
          <Input label="حد صفحات الهبوط" type="number" value={form.landingPagesLimit || ''} onChange={(v) => setForm({ ...form, landingPagesLimit: Number(v) })} />
          <Input label="حد روابط البيع" type="number" value={form.salesLinksLimit || ''} onChange={(v) => setForm({ ...form, salesLinksLimit: Number(v) })} />
        </div>
        <div className="grid grid-2">
          <Input label="حد أعضاء الفريق" type="number" value={form.staffLimit || ''} onChange={(v) => setForm({ ...form, staffLimit: Number(v) })} />
          <Input label="حد التخزين (MB)" type="number" value={form.storageLimit || ''} onChange={(v) => setForm({ ...form, storageLimit: Number(v) })} />
        </div>
        <div className="field">
          <Toggle checked={form.unlimitedProducts ?? false} onChange={(v) => setForm({ ...form, unlimitedProducts: v, productLimit: v ? 0 : (form.productLimit ?? 0) })} label="منتجات غير محدودة (تلغي حد المنتجات عند التفعيل)" />
        </div>
        <div className="field">
          <Toggle checked={form.unlimitedSalesLinks ?? false} onChange={(v) => setForm({ ...form, unlimitedSalesLinks: v, salesLinksLimit: v ? 0 : (form.salesLinksLimit ?? 0) })} label="روابط بيع غير محدودة (تلغي حد روابط البيع عند التفعيل)" />
        </div>
        <Textarea label="المميزات (كل سطر ميزة)" value={(form.features || []).join('\n')} onChange={(v) => setForm({ ...form, features: v.split('\n').filter(Boolean) })} rows={4} />
        <div className="field-grow" style={{ marginTop: 12 }}>
          <label className="field-label">مزايا الباقة (مفاتيح ميزة قابلة للتفعيل)</label>
          <div className="plan-feature-toggles">
            {PLAN_FEATURE_KEYS.map((k) => (
              <Toggle
                key={k}
                checked={flags[k]}
                onChange={(v) => setFlags({ ...flags, [k]: v })}
                label={PLAN_FEATURE_LABELS[k]}
              />
            ))}
          </div>
        </div>
        <div className="field">
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="متاحة للاشتراك" />
        </div>
      </Modal>
    </div>
  )
}
export default PlatformPlans

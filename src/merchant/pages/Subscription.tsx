import { FunctionalComponent, Fragment } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useLocation } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { useCollectionOnce } from '../../shared/hooks/useCollectionOnce'
import { getMerchantPaymentInfoCallable, submitPaymentRequestCallable, changeSubscriptionPlanCallable, requestStorePurchaseCallable, getBillingSnapshotsCallable, getEligiblePromotionsCallable } from '../../shared/services/auth'
import { uploadPaymentProof, validatePaymentProofFile, uploadErrorMessage } from '../../shared/services/uploads'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Loading } from '../../shared/components/ui/Loading'
import './Subscription.css'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { ErrorState } from '../../shared/components/ui/ErrorState'
import { Modal } from '../../shared/components/ui/Modal'
import { SegmentedControl } from '../../shared/components/ui/SegmentedControl'
import { Icon } from '../../shared/components/ui/Icon'
import { CountdownTimer } from '../../shared/components/subscription/CountdownTimer'
import { Table } from '../../shared/components/ui/Table'
import { PricingCard } from '../../shared/components/subscription/PricingCard'
import { Progress } from '../../shared/components/ui/Progress'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../shared/utils/format'
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_TONES, usageLevelFor } from '../../shared/utils/constants'
import { usageFrom, PLAN_FEATURE_KEYS, PLAN_FEATURE_LABELS, canUseFeature, isPlanLimitUnlimited } from '../../shared/services/subscription'
import { CANONICAL_PLANS } from '../../shared/plans/catalog'
import { useToast } from '../../shared/hooks/useToast'
import type { PlatformSettings, SubscriptionPayment, SubscriptionPlan } from '../../shared/types'

interface StorageQuota {
  usedBytes: number
  limitBytes: number
  limitReached: boolean
  remainingBytes: number | null
  usedPercent: number
}

const MB = 1024 * 1024
const PUBLIC_PAID_PLAN_IDS = new Set(['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'])

function offerIsPubliclyAvailable(plan: SubscriptionPlan) {
  if (plan.isPubliclyAvailable === false) return false
  const raw: any = plan.launchOfferEndsAt
  if (!raw) return true
  const ms = typeof raw.toDate === 'function' ? raw.toDate().getTime() : typeof raw.seconds === 'number' ? raw.seconds * 1000 : new Date(raw).getTime()
  return !Number.isFinite(ms) || ms > Date.now()
}

const BILLING_TYPE_LABELS: Record<string, string> = {
  plan_change: 'تغيير الباقة',
  renewal: 'تجديد',
  activation: 'تفعيل الاشتراك',
  trial_start: 'بداية التجربة',
  trial_end: 'نهاية التجربة',
}

export const MerchantSubscription: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const [location] = useLocation()
  const subscriptionParams = new URLSearchParams(location.split('?')[1] || window.location.search)
  const lifetimeIntent = subscriptionParams.get('offer') === 'lifetime'
  const toast = useToast()
  const { subscription, plan, paymentRequests, changeRequests, purchaseRequests, status, nextAmount, launchOffer, loading, error: subscriptionError, refresh, resourceUsage } = useSubscription(storeId)

  const plansRes = useCollectionOnce<SubscriptionPlan>('plans', { orderBy: { field: 'priceMonthly' } })
  const allPlans = CANONICAL_PLANS.map((canonical) => {
    const live = plansRes.data.find((candidate) => candidate.id === canonical.id)
    if (!live) return canonical
    return canonical.id === 'plan-lifetime' ? { ...canonical, ...live, id: canonical.id } : { ...live, ...canonical }
  })
    .filter((p: any) => p.active !== false && p.isPurchasable !== false && p.archived !== true)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const productCount = resourceUsage?.products.used ?? 0
  const userCount = resourceUsage?.team.used ?? 1
  const userLimit = resourceUsage?.team.limit ?? Number(plan?.staffLimit || 1)
  const userPct = userLimit > 0 ? Math.min(100, Math.round((userCount / userLimit) * 100)) : 0
  const userLevel = userLimit > 0 ? usageLevelFor(userPct, true) : 'none'
  const userTone = userLevel === 'reached' ? 'red' : userLevel === 'near' || userLevel === 'approaching' ? 'amber' : userLevel === 'moderate' ? 'primary' : 'green'
  const isProductsUnlimited = isPlanLimitUnlimited('products', plan)
  const productLimit = resourceUsage?.products.limit ?? (isProductsUnlimited ? 0 : Number(plan?.productLimit || 0))
  const productPct = productLimit > 0 ? Math.min(100, Math.round((productCount / productLimit) * 100)) : 0
  const productLevel = productLimit > 0 ? usageLevelFor(productPct, true) : 'none'
  const productTone = productLevel === 'reached' ? 'red' : productLevel === 'near' || productLevel === 'approaching' ? 'amber' : productLevel === 'moderate' ? 'primary' : 'green'
  const enabledFeatures = PLAN_FEATURE_KEYS.filter((k) => canUseFeature(k, plan))

  const [snapshots, setSnapshots] = useState<any[]>([])
  const [eligiblePromotions, setEligiblePromotions] = useState<any[]>([])
  useEffect(() => { if (storeId) getEligiblePromotionsCallable({ storeId }).then((r: any) => setEligiblePromotions(r.data?.promotions || [])).catch(() => setEligiblePromotions([])) }, [storeId])
  useEffect(() => {
    if (!storeId) return
    let active = true
    getBillingSnapshotsCallable({ storeId })
      .then((r) => { if (active) setSnapshots((r.data as any)?.snapshots || []) })
      .catch(() => { if (active) setSnapshots([]) })
    return () => { active = false }
  }, [storeId])

  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [changeBilling, setChangeBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [targetPlanId, setTargetPlanId] = useState<string>('')
  const [changing, setChanging] = useState(false)
  const [purchasingOfferId, setPurchasingOfferId] = useState<string | null>(null)

  useEffect(() => {
    if (!storeId) return
    getMerchantPaymentInfoCallable()
      .then((res) => setSettings((res.data as PlatformSettings) || null))
      .catch(() => {})
  }, [storeId])

  const limitBytes = resourceUsage?.storage.limit ?? (plan ? Number(plan.storageLimit || 0) * MB : 0)
  const usedBytes = resourceUsage?.storage.used ?? Number(store?.storageUsed || 0)
  const storage: StorageQuota | null = limitBytes > 0 ? {
    usedBytes,
    limitBytes,
    limitReached: usedBytes >= limitBytes,
    remainingBytes: Math.max(0, limitBytes - usedBytes),
    usedPercent: Math.min(100, Math.round((usedBytes / limitBytes) * 100)),
  } : null

  const storageLevel = storage ? usageLevelFor(storage.usedPercent, true) : 'none'
  const storageTone = storageLevel === 'reached' ? 'red' : storageLevel === 'near' || storageLevel === 'approaching' ? 'amber' : storageLevel === 'moderate' ? 'primary' : 'green'

  if (loading && !subscription) return <Loading variant="screen" message="جاري تحميل الاشتراك..." />

  if (subscriptionError && !subscription) {
    return (
      <div className="merchant-operations merchant-subscription-page">
        <PageHeader breadcrumb="إدارة الباقة" title="الاشتراك" subtitle="اشتراك متجرك" />
        <Card>
          <ErrorState description="تعذر تحميل بيانات الاشتراك الآن. حاول مرة أخرى." onRetry={() => void refresh()} />
        </Card>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="merchant-operations merchant-subscription-page">
        <PageHeader breadcrumb="إدارة الباقة" title="الاشتراك" subtitle="اشتراك متجرك" />
        <Card>
          <EmptyState icon="workspace_premium" title="لا يوجد اشتراك" description="لم يُنشأ اشتراك لهذا المتجر بعد — تواصل مع إدارة المنصة." />
        </Card>
      </div>
    )
  }

  const pendingRequest = paymentRequests.find((p) => p.status === 'pending')
  const pendingChangeRequest = changeRequests.find((r) => r.status === 'pending_payment' || r.status === 'pending_approval')
  const pendingPurchaseRequest = purchaseRequests.find((r) => r.status === 'pending_payment' || r.status === 'pending_approval')
  const paymentHistory = [...paymentRequests].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

  const directPaidActivation = Number(subscription.normalPriceSnapshot || 0) > 0 && (status === 'trialing' || status === 'expired' || status === 'suspended')
  const canSubmit = Boolean(pendingChangeRequest && pendingChangeRequest.status === 'pending_payment') || Boolean(pendingPurchaseRequest && pendingPurchaseRequest.status === 'pending_payment') || directPaidActivation
  const needsPayment = !pendingRequest && (Boolean(pendingChangeRequest) || Boolean(pendingPurchaseRequest) || status === 'trialing' || status === 'expired' || status === 'suspended')

  const handleProof = (file: File | null) => {
    setError('')
    if (!file) return setProof(null)
    const err = validatePaymentProofFile(file)
    if (err) return setError(err.message)
    setProof(file)
  }

  const openChangePlan = () => {
    setTargetPlanId(subscription?.planId || '')
    setChangeBilling('monthly')
    setUpgradeOpen(true)
  }

  const confirmChangePlan = async () => {
    if (!targetPlanId || targetPlanId === subscription?.planId) {
      setUpgradeOpen(false)
      return
    }
    setChanging(true)
    try {
      const res = await changeSubscriptionPlanCallable({ storeId, planId: targetPlanId, billingCycle: changeBilling })
      const result = res.data as { changed?: boolean; requestId?: string; quotedAmount?: number }
      toast.push(result.requestId ? 'تم إنشاء طلب تغيير الباقة' : result.changed ? 'تم تغيير باقتك بنجاح' : 'أنت بالفعل على هذه الباقة', result.requestId ? 'أرسل إثبات الدفع لإكمال التفعيل بعد مراجعة إدارة المنصة.' : undefined, 'success')
      setUpgradeOpen(false)
      refresh()
    } catch (err: any) {
      toast.push('فشل تغيير الباقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setChanging(false)
    }
  }

  const requestLifetimePurchase = async (offerId: string) => {
    setPurchasingOfferId(offerId)
    try {
      const res = await requestStorePurchaseCallable({ storeId, offerId })
      const result = res.data as { quotedAmount?: number }
      toast.push('تم إنشاء طلب امتلاك المتجر', `أرسل إثبات الدفع بمبلغ ${formatCurrency(Number(result.quotedAmount || 0), currency) || 'المبلغ المحدد'} لإكمال المراجعة.`, 'success')
      refresh()
    } catch (err: any) {
      toast.push('تعذر إنشاء طلب الشراء', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setPurchasingOfferId(null)
    }
  }

  const submitPayment = async (e: Event) => {
    e.preventDefault()
    setError('')
    if (!subscription) return
    if (!method.trim() || !reference.trim()) {
      setError('أدخل وسيلة الدفع ورقم العملية')
      return
    }
    if (!/^[0-9]{6,24}$/.test(reference.trim())) {
      setError('رقم العملية غير صالح — أدخل 6 إلى 24 رقماً')
      return
    }
    setSubmitting(true)
    try {
      let screenshotUrl: string | undefined
      if (proof) {
        setUploading(true)
        screenshotUrl = await uploadPaymentProof(proof, subscription.storeId)
      }
      await submitPaymentRequestCallable({
        ...(pendingPurchaseRequest ? { purchaseRequestId: pendingPurchaseRequest.id } : pendingChangeRequest ? { changeRequestId: pendingChangeRequest.id } : { subscriptionId: subscription.id }),
        paymentMethod: method.trim(),
        reference: reference.trim(),
        note: note.trim(),
        screenshotUrl,
      })
      toast.push('تم إرسال طلب التفعيل بنجاح', undefined, 'success')
      setMethod('')
      setReference('')
      setNote('')
      setProof(null)
      refresh()
    } catch (err: any) {
      const safeMessage = err?.code?.startsWith?.('storage/') ? uploadErrorMessage(err) : (err?.message || 'فشل إرسال طلب الدفع')
      setError(safeMessage)
      toast.push('فشل إرسال الطلب', undefined, 'error')
    } finally {
      setUploading(false)
      setSubmitting(false)
    }
  }

  const statusLabel = SUBSCRIPTION_STATUS_LABELS[status as keyof typeof SUBSCRIPTION_STATUS_LABELS] || status
  const isLifetime = subscription.billingModel === 'one_time' && subscription.ownershipType === 'lifetime' && subscription.lifetimeAccess === true
  const lifetimeOffers = allPlans.filter((p: any) => p.billingModel === 'one_time' && p.isLaunchOffer !== false && Number(p.oneTimePrice || 0) > 0 && offerIsPubliclyAvailable(p))
  const subscriptionOffers = allPlans.filter((p: any) => p.billingModel !== 'one_time' && PUBLIC_PAID_PLAN_IDS.has(p.id))

  // Keep the merchant's immutable commercial snapshot visible for the current
  // subscription. The canonical catalog is only for new upgrades/offers.
  const currentMonthlyPrice = Number(subscription.normalPriceSnapshot ?? plan?.priceMonthly ?? 0)
  const isFreePlan = subscription.planId === 'plan-free' || currentMonthlyPrice <= 0
  const paidPeriodEnd = subscription.currentPeriodEnd || subscription.expiresAt
  const renewalLabel = status === 'active' && !isFreePlan && paidPeriodEnd ? formatDate(paidPeriodEnd) : isFreePlan && subscription.trialEndsAt ? `يلزم الترقية قبل ${formatDate(subscription.trialEndsAt)}` : '—'
  const currency = 'EGP'

  const orderUsage = usageFrom(subscription, plan)
  const ordersAtLimit = orderUsage.limit > 0 && orderUsage.level === 'reached'
  const orderTone = orderUsage.level === 'reached' ? 'red' : orderUsage.level === 'near' || orderUsage.level === 'approaching' ? 'amber' : orderUsage.level === 'moderate' ? 'primary' : 'green'

  const scrollToPayment = () => {
    document.getElementById('subscription-payment')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const usageRows = [
    {
      key: 'orders',
      label: 'الطلبات',
      used: orderUsage.used,
      limit: orderUsage.limit,
      unlimited: orderUsage.limit <= 0,
      level: orderUsage.level,
      percent: orderUsage.percent,
      tone: orderTone,
      unit: 'طلب',
      fill: 'is-error',
    },
    {
      key: 'products',
      label: 'المنتجات',
      used: productCount,
      limit: productLimit,
      unlimited: isProductsUnlimited,
      level: productLevel,
      percent: productPct,
      tone: productTone,
      unit: 'منتج',
      fill: 'is-primary',
    },
    {
      key: 'users',
      label: 'المستخدمون',
      used: userCount,
      limit: userLimit,
      unlimited: userLimit <= 0,
      level: userLevel,
      percent: userPct,
      tone: userTone,
      unit: 'مستخدم',
      fill: 'is-primary',
    },
    {
      key: 'storage',
      label: 'المساحة',
      used: storage ? Math.round(storage.usedBytes / MB) : 0,
      limit: storage ? Math.round(storage.limitBytes / MB) : 0,
      unlimited: !storage,
      level: storageLevel,
      percent: storage ? storage.usedPercent : 0,
      tone: storageTone,
      unit: 'ميجابايت',
      fill: 'is-secondary',
    },
  ]

  return (
    <div className="merchant-operations merchant-subscription-page">
      <PageHeader
        breadcrumb="إدارة الباقة"
        title="الاشتراك"
        subtitle="تفاصيل باقة متجرك، الاستخدام، الفوترة والميزات"
        actions={<Badge tone="indigo">{plan?.name || subscription.planName || '—'}</Badge>}
      />

      {ordersAtLimit && (
        <Card className="mb-2">
          <div className="flex-between">
            <div className="flex" style={{ gap: 10 }}>
              <Icon name="error" className="text-amber" />
              <div>
                <p className="font-semibold">تم بلوغ الحد المسموح للطلبات</p>
                <p className="muted small">لقد وصلت إلى الحد الأقصى للطلبات في خطتك الحالية. يرجى الترقية لضمان استمرار البيع.</p>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={openChangePlan}>ترقية الخطة</Button>
          </div>
        </Card>
      )}

      <div className="subscription-summary">
        <div className="subscription-summary-main">
          <span className="subscription-summary-label">الخطة الحالية</span>
          <div className="subscription-summary-plan">
            {plan?.name || subscription.planName || '—'}
            <Badge tone={SUBSCRIPTION_STATUS_TONES[status as keyof typeof SUBSCRIPTION_STATUS_TONES] || 'slate'}>{statusLabel}</Badge>
          </div>
          <div className="subscription-summary-rows">
            <div><span>حالة الملكية</span><b>{isLifetime ? 'المتجر مملوك' : 'اشتراك دوري'}</b></div>
            <div><span>تاريخ التجديد القادم</span><b>{isLifetime ? 'لا يوجد تجديد لملكية المتجر الأساسية' : renewalLabel}</b></div>
            <div><span>نهاية الدورة الحالية</span><b>{paidPeriodEnd ? formatDate(paidPeriodEnd) : isLifetime ? 'لا تنتهي ملكية المتجر' : 'يُحدَّد عند تفعيل الدورة'}</b></div>
            <div><span>تكلفة التجديد</span><b>{isLifetime ? 'لا توجد رسوم شهرية للملكية الأساسية' : isFreePlan ? 'اختر Starter أو Growth أو Pro' : `${formatCurrency(currentMonthlyPrice, currency)} / شهرياً`}</b></div>
            {launchOffer && <div><span>خصم الإطلاق</span><b>أول شهر {formatCurrency(nextAmount, currency)}</b></div>}
          </div>
        </div>
        <div className="subscription-summary-actions">
          <Button icon="workspace_premium" onClick={openChangePlan}>ترقية الخطة</Button>
          <Button variant="ghost" onClick={scrollToPayment}>إدارة الدفع</Button>
        </div>
      </div>

      <Card title="الاستهلاك" titleIcon="data_usage" className="mb-2">
        <div className="subscription-usage-stack">
          {usageRows.map((u) => {
            const remaining = u.unlimited ? null : Math.max(0, Number(u.limit) - Number(u.used))
            return (
              <div key={u.key} className="subscription-usage-item">
                <div className="subscription-usage-meta">
                  <span className="subscription-usage-label">{u.label}</span>
                  <span className={`subscription-usage-count${u.level === 'reached' ? ' is-error' : ''}`}>
                    {u.unlimited ? 'غير محدود' : `${formatNumber(u.used)} / ${formatNumber(u.limit)}`}
                  </span>
                </div>
                <div className="subscription-usage-track">
                  <div
                    className={`subscription-usage-fill is-${u.key === 'orders' ? 'amber' : u.key === 'storage' ? (u.level === 'reached' ? 'error' : 'secondary') : u.key === 'users' ? 'secondary' : 'primary'}`}
                    style={{ width: `${u.unlimited ? 0 : Math.min(100, (u.used / Math.max(u.limit, 1)) * 100)}%` }}
                  />
                </div>
                {!u.unlimited && (
                  <p className={`subscription-usage-remaining${u.level === 'reached' ? ' is-error' : ''}`}>
                    {u.level === 'reached' ? (
                      <>
                        <Icon name="warning" ariaHidden /> وصلت إلى الحد الأقصى لهذا المورد
                      </>
                    ) : (
                      `متبقي ${formatNumber(remaining || 0)} ${u.unit}`
                    )}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        {enabledFeatures.length > 0 && (
          <div className="subscription-features">
            {enabledFeatures.map((k) => (
              <span key={k} className="subscription-feature-chip"><Icon name="check_circle" className="subscription-feature-icon" ariaHidden />{PLAN_FEATURE_LABELS[k]}</span>
            ))}
          </div>
        )}
      </Card>

      {status === 'trialing' && (
        <Card title="تجربتك المجانية" className="mt-2">
          <div className="trial-countdown">
            <Icon name="hourglass_top" />
            <div>
              {subscription?.trialEndsAt ? <CountdownTimer endsAt={subscription.trialEndsAt} label="متبقي من الفترة التجريبية" /> : <strong className="trial-missing-end">تعذر تحديد موعد انتهاء التجربة</strong>}
              {subscription.planId === 'plan-free' ? (
                <p className="muted small">Free متاحة لمدة 30 يومًا فقط. بياناتك تبقى محفوظة بعد الانتهاء، ويلزم اختيار Starter أو Growth أو Pro لمواصلة العمليات.</p>
              ) : (
                <p className="muted small">تجربتك الحالية لـ {plan?.name || subscription.planName} لمدة 3 أيام. عند انتهائها، يمكنك تفعيل نفس الباقة أو اختيار باقة أخرى مدفوعة — لا تعود تلقائيًا إلى Free.</p>
              )}
            </div>
          </div>
        </Card>
      )}
      {status === 'expired' && (
        <Card title="انتهت تجربتك المجانية" className="mt-2">
          <div className="trial-countdown">
            <Icon name="warning" />
            <div>
              <strong>انتهت تجربتك المجانية</strong>
              <p className="muted small">فعّل باقتك للاستمرار. بياناتك محفوظة بالكامل. يمكنك تفعيل نفس الباقة ({plan?.name || subscription.planName}) أو اختيار Starter/Growth/Pro أخرى.</p>
            </div>
          </div>
        </Card>
      )}

      <Card title="سجل الفوترة" className="mt-2">
        {snapshots.length === 0 ? (
          <p className="muted small">لا يوجد سجل فوترة بعد — سيُسجَّل تفعيل اشتراكك وتغييرات باقتك تلقائياً هنا.</p>
        ) : (
          <div className="billing-history">
            {snapshots.map((s) => (
              <div key={s.id} className="billing-history-row">
                <div>
                  <strong>{BILLING_TYPE_LABELS[s.type] || s.type}</strong>
                  <span className="muted small"> — {s.planName || s.planId}</span>
                  {s.note && <p className="muted small mt-1">{s.note}</p>}
                </div>
                <div className="billing-history-meta">
                  <span>{formatCurrency(Number(s.priceMonthly || 0), currency)} / شهر</span>
                  <span className="muted small">{formatDate(s.at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!isLifetime && <div className="plans-section">
        <div className="plans-section-head">
          <div>
            <h2>ترقية أو تغيير الخطة</h2>
            <p>اختر الخطة التي تناسب حجم نشاطك التجاري</p>
          </div>
          <div className="plans-billing-segmented">
            <button type="button" className={`plans-billing-btn${changeBilling === 'monthly' ? ' is-active' : ''}`} onClick={() => setChangeBilling('monthly')}>شهري</button>
            <button type="button" className={`plans-billing-btn${changeBilling === 'yearly' ? ' is-active' : ''}`} onClick={() => setChangeBilling('yearly')}>
              سنوي
              <span className="plans-save-badge">وفر 20%</span>
            </button>
          </div>
        </div>
        {eligiblePromotions.filter((p) => p.placement?.includes?.('subscription') && p.planId && p.promotionalPrice != null).length > 0 && <div className="subscription-offer-callout"><strong>عروض خاصة لك</strong>{eligiblePromotions.filter((p) => p.placement?.includes?.('subscription') && p.planId && p.promotionalPrice != null).map((p) => { const target = subscriptionOffers.find((x: any) => x.id === p.planId); return target ? <div key={p.id}><span>{target.name}</span><b>{formatCurrency(Number(p.promotionalPrice), currency)} بدلًا من {formatCurrency(Number(changeBilling === 'yearly' ? target.priceYearly : target.priceMonthly), currency)}</b><CountdownTimer endsAt={p.endsAt} label="ينتهي خلال" /></div> : null })}</div>}
        {subscriptionOffers.length === 0 ? (
          <EmptyState title="لا توجد باقات" description="لم تُضف الباقات بعد — تواصل مع مدير المنصة." icon="workspace_premium" />
        ) : (
          <div className="grid grid-3">
            {subscriptionOffers.map((p) => (
              <PricingCard key={p.id} plan={p} yearly={changeBilling === 'yearly'} featured={p.id === subscription?.planId} />
            ))}
          </div>
        )}
      </div>}

      {!isLifetime && lifetimeOffers.length > 0 && (
        <div id="lifetime-offer" className={lifetimeIntent ? 'lifetime-offer-section is-handoff-selected' : 'lifetime-offer-section'}>
          <Card title="امتلك متجرك" subtitle="دفعة واحدة — بدون اشتراك شهري للمتجر الأساسي، وفق حدود ومزايا العرض المحددة." className="mt-2">
            {lifetimeIntent && <Badge tone="indigo">العرض المحدد من التسجيل</Badge>}
          <div className="grid grid-2">
            {lifetimeOffers.map((offer: any) => (
              <div key={offer.id} className="mk-pricing-card">
                <h3 className="mk-pricing-name">امتلك متجرك</h3>
                {offer.description && <p className="mk-pricing-desc">{offer.description}</p>}
                <div className="mk-pricing-price"><strong>{formatCurrency(Number(offer.oneTimePrice || 0), currency)}</strong><span>دفعة واحدة</span></div>
                <p className="muted small">حق استخدام دائم لمتجر واحد داخل Matjari، ولا يشمل ملكية المنصة أو الكود المصدري أو المزايا Premium المستقبلية تلقائياً.</p>
                {pendingPurchaseRequest ? (
                  <Badge tone="amber">طلب الشراء قيد المراجعة</Badge>
                ) : (
                  <Button loading={purchasingOfferId === offer.id} onClick={() => requestLifetimePurchase(offer.id)}>امتلك متجرك</Button>
                )}
              </div>
            ))}
          </div>
          </Card>
        </div>
      )}

      <Card title="تغيير الباقة" className="mt-2">
        <div className="flex-between">
          <div>
            <p className="muted small mb-1">
              بدّل باقتك الحالية ({plan?.name || subscription.planName || '—'}) إلى باقة أعلى أو أدنى بما يناسب نمو متجرك.
              الحدود والمزايا تُطبَّق فوراً من النظام.
            </p>
            {storage && storage.limitBytes > 0 && (
              <div className="storage-meter mt-1">
                <div className="flex-between small mb-1">
                  <span className="font-semibold">تخزين الملفات: {formatNumber(Math.round(storage.usedBytes / MB))} من {formatNumber(Math.round(storage.limitBytes / MB))} ميجابايت</span>
                  {storage.limitReached && <Badge tone="red">الحد ممتلئ</Badge>}
                </div>
                <Progress value={storage.usedBytes} max={storage.limitBytes} tone={storage.limitReached ? 'red' : storage.usedPercent > 80 ? 'amber' : 'primary'} />
                <p className="muted small mt-1">
                  {storage.limitReached
                    ? 'استنفدت مساحة التخزين المتاحة. رقِّ باقتك أو احذف بعض الملفات للمتابعة.'
                    : storage.remainingBytes != null
                      ? `مساحة متبقية ${formatNumber(Math.round(storage.remainingBytes / MB))} ميجابايت (${storage.usedPercent}%).`
                      : ''}
                </p>
              </div>
            )}
          </div>
          <Button variant="outline" icon="swap_vert" onClick={openChangePlan}>تغيير الباقة</Button>
        </div>
      </Card>

      <Modal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="تغيير الباقة"
        footer={
          <Fragment>
            <Button variant="ghost" onClick={() => setUpgradeOpen(false)}>إلغاء</Button>
            <Button loading={changing} disabled={!targetPlanId || targetPlanId === subscription?.planId} onClick={confirmChangePlan}>
              تأكيد التغيير
            </Button>
          </Fragment>
        }
      >
        <div className="flex-between mb-2">
          <SegmentedControl
            value={changeBilling}
            onChange={(v) => setChangeBilling(v as 'monthly' | 'yearly')}
            options={[{ value: 'monthly', label: 'شهري' }, { value: 'yearly', label: 'سنوي' }]}
          />
        </div>
        {subscriptionOffers.length === 0 ? (
          <EmptyState title="لا توجد باقات" description="لم تُضف الباقات بعد — تواصل مع مدير المنصة." icon="workspace_premium" />
        ) : (
          <div className="grid grid-2">
            {subscriptionOffers.map((p) => (
              <PricingCard
                key={p.id}
                plan={p}
                yearly={changeBilling === 'yearly'}
                featured={p.id === subscription?.planId}
                selected={targetPlanId === p.id}
                onSelect={() => setTargetPlanId(p.id)}
                ctaLabel={p.id === subscription?.planId ? 'الباقة الحالية' : targetPlanId === p.id ? 'محددة' : 'اختيار'}
              />
            ))}
          </div>
        )}
      </Modal>

      <div id="subscription-payment">
        <Card title={pendingPurchaseRequest ? 'طلب امتلاك المتجر' : pendingChangeRequest ? 'طلب تغيير الباقة' : pendingRequest ? 'طلب التفعيل' : 'تفعيل الاشتراك'} className="mt-2">
          {pendingRequest ? (
            <EmptyState
              icon="hourglass_top"
              title="طلبك قيد المراجعة"
              description={`تم استلام طلب التفعيل بمبلغ ${formatCurrency(pendingRequest.amount, currency)} وهو قيد المراجعة من إدارة المنصة. سيتم تفعيل اشتراكك فور التأكيد.`}
            />
          ) : pendingPurchaseRequest?.status === 'pending_approval' ? (
            <EmptyState icon="hourglass_top" title="طلب امتلاك المتجر قيد المراجعة" description="تم إرسال إثبات الدفع. تبقى ملكية المتجر الأساسية دون تغيير حتى اعتماد الدفع." />
          ) : pendingChangeRequest?.status === 'pending_approval' ? (
            <EmptyState
              icon="hourglass_top"
              title="طلب تغيير الباقة قيد المراجعة"
              description={`تم إرسال طلب تغيير الباقة إلى ${pendingChangeRequest.toPlanName || pendingChangeRequest.toPlanId}. لا تتغير باقتك الحالية قبل اعتماد الدفع.`}
            />
          ) : status === 'active' && !pendingChangeRequest ? (
            <EmptyState
              icon="verified"
              title="اشتراكك نشط"
              description={isLifetime ? 'تم اعتماد ملكية المتجر الأساسية. لا يوجد انتهاء أو تجديد لهذه الملكية، وتظل حدود ومزايا العرض المشتراة مطبقة.' : `باقتك مفعّلة حتى ${formatDate(subscription.currentPeriodEnd || subscription.expiresAt)}. سيتم التجديد تلقائياً بالمبلغ ${formatCurrency(nextAmount, currency)} عند انتهاء الدورة.`}
            />
          ) : canSubmit ? (
            <>
              <p className="muted small mb-2">
                {pendingPurchaseRequest
                  ? `أرسل إثبات الدفع بمبلغ ${formatCurrency(pendingPurchaseRequest.quotedAmount, pendingPurchaseRequest.currency || currency)} لإكمال شراء ملكية المتجر.`
                  : pendingChangeRequest
                  ? `أرسل إثبات الدفع بمبلغ ${formatCurrency(pendingChangeRequest.quotedAmount, pendingChangeRequest.currency || currency)} لإكمال تغيير الباقة.`
                  : status === 'trialing'
                  ? `بدّل للتجديد المدفوع الآن بخصم الإطلاق: أول شهر ${formatCurrency(nextAmount, currency)} فقط.`
                  : `متجرك متوقف عن البيع حالياً. فعّل باقتك بمبلغ ${formatCurrency(nextAmount, currency)} لاستئناف العمل فوراً.`}
              </p>

              {settings?.paymentInstructions && (
                <div className="payment-instructions mb-3">
                  <div className="payment-instructions-head"><Icon name="info" /> تعليمات الدفع</div>
                  <p>{settings.paymentInstructions}</p>
                  {settings.paymentContact && <p className="muted small">للاستفسار: {settings.paymentContact}</p>}
                </div>
              )}

              <form onSubmit={submitPayment}>
                <div className="grid grid-2">
                  <Input label="وسيلة الدفع" placeholder="مثال: فودافون كاش / محفظة / تحويل بنكي" value={method} onChange={setMethod} required />
                  <Input label="رقم العملية" placeholder="رقم التحويل أو العملية" value={reference} onChange={setReference} required />
                </div>
                <Textarea label="ملاحظات (اختياري)" value={note} onChange={setNote} rows={2} placeholder="أي تفاصيل تساعد في مطابقة العملية" />
                <div className="field">
                  <span className="field-label">إرفاق إثبات التحويل (اختياري)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => handleProof((e.target as HTMLInputElement).files?.[0] || null)}
                  />
                  {proof && <p className="muted small">{proof.name}</p>}
                  {uploading && <p className="muted small">جاري رفع الإثبات…</p>}
                </div>
                {error && <p className="field-error">{error}</p>}
                <Button type="submit" loading={submitting} icon="arrow_forward" className="mt-2">{pendingPurchaseRequest ? 'إرسال إثبات شراء المتجر' : 'إرسال طلب التفعيل'}</Button>
              </form>
            </>
          ) : null}
        </Card>

        {paymentHistory.length > 0 && (
          <Card title="سجل المدفوعات" className="mt-2">
            <Table
              cardMode
              columns={[
                { key: 'createdAt', header: 'التاريخ', render: (p: SubscriptionPayment) => formatDateTime(p.createdAt) },
                { key: 'amount', header: 'المبلغ', render: (p: SubscriptionPayment) => formatCurrency(p.amount, currency) },
                { key: 'paymentMethod', header: 'الوسيلة' },
                { key: 'reference', header: 'رقم العملية', render: (p: SubscriptionPayment) => <span dir="ltr">{p.reference}</span> },
                { key: 'status', header: 'الحالة', render: (p: SubscriptionPayment) => (
                  <Badge tone={p.status === 'approved' ? 'green' : p.status === 'rejected' ? 'red' : 'amber'}>
                    {p.status === 'approved' ? 'مقبول' : p.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                  </Badge>
                ) },
              ]}
              rows={paymentHistory}
            />
            {needsPayment && <p className="muted small mt-2">إذا سبق لك الإرسال، يرجى التحقق من حالة الطلب أعلاه قبل إعادة الإرسال.</p>}
          </Card>
        )}
      </div>
    </div>
  )
}
export default MerchantSubscription

import { FunctionalComponent, Fragment } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useStore } from '../../shared/hooks/useStore'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { useCollection } from '../../shared/hooks/useCollection'
import { getMerchantPaymentInfoCallable } from '../../shared/services/auth'
import { submitPaymentRequestCallable } from '../../shared/services/auth'
import { changeSubscriptionPlanCallable } from '../../shared/services/auth'
import { uploadPaymentProof, validateImageFile } from '../../shared/services/uploads'
import { InternalPageHeader, WorkspaceSection } from '../components/InternalWorkspace'
import '../components/InternalWorkspace.css'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Modal } from '../../shared/components/ui/Modal'
import { SegmentedControl } from '../../shared/components/ui/SegmentedControl'
import { Icon } from '../../shared/components/ui/Icon'
import { Table } from '../../shared/components/ui/Table'
import { PricingCard } from '../../shared/components/subscription/PricingCard'
import { UsageCard } from '../../shared/components/subscription/UsageCard'
import { Progress } from '../../shared/components/ui/Progress'
import { LimitRaiser } from '../components/LimitRaiser'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../shared/utils/format'
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_TONES, ORDER_USAGE_LABELS, usageLevelFor } from '../../shared/utils/constants'
import { PLAN_FEATURE_KEYS, PLAN_FEATURE_LABELS, canUseFeature, isPlanLimitUnlimited } from '../../shared/services/subscription'
import { useToast } from '../../shared/hooks/useToast'
import type { PlatformSettings, Product, SubscriptionPayment, SubscriptionPlan } from '../../shared/types'
import { getBillingSnapshotsCallable } from '../../shared/services/auth'

interface StorageQuota {
  usedBytes: number
  limitBytes: number
  limitReached: boolean
  remainingBytes: number | null
  usedPercent: number
}

const MB = 1024 * 1024

const BILLING_TYPE_LABELS: Record<string, string> = {
  activation: 'تفعيل الاشتراك',
  plan_change: 'تغيير الباقة',
  renewal: 'تجديد الاشتراك',
  manual: 'تعديل يدوي',
}

export const MerchantSubscription: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const toast = useToast()
  const { subscription, plan, paymentRequests, status, nextAmount, launchOffer, trialRemaining, loading, refresh } = useSubscription(storeId)

  const plansRes = useCollection<SubscriptionPlan>('plans', { orderBy: { field: 'priceMonthly' } })
  const allPlans = [...plansRes.data].filter((p) => p.active !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const productsRes = useCollection<Product>('products', { storeId, orderBy: { field: 'createdAt' } })
  const productCount = productsRes.data.length
  const teamRes = useCollection<any>('team', { storeId }, !!storeId)
  const userCount = 1 + teamRes.data.length
  const userLimit = Number(plan?.staffLimit || 1)
  const userPct = userLimit > 0 ? Math.min(100, Math.round((userCount / userLimit) * 100)) : 0
  const userLevel = userLimit > 0 ? usageLevelFor(userPct, true) : 'none'
  const userTone = userLevel === 'reached' ? 'red' : userLevel === 'near' || userLevel === 'approaching' ? 'amber' : userLevel === 'moderate' ? 'primary' : 'green'
  const isProductsUnlimited = isPlanLimitUnlimited('products', plan)
  const productLimit = isProductsUnlimited ? 0 : Number(plan?.productLimit || 0)
  const productPct = productLimit > 0 ? Math.min(100, Math.round((productCount / productLimit) * 100)) : 0
  const productLevel = productLimit > 0 ? usageLevelFor(productPct, true) : 'none'
  const productRemaining = productLimit > 0 ? Math.max(0, productLimit - productCount) : null
  const productTone = productLevel === 'reached' ? 'red' : productLevel === 'near' || productLevel === 'approaching' ? 'amber' : productLevel === 'moderate' ? 'primary' : 'green'
  const enabledFeatures = PLAN_FEATURE_KEYS.filter((k) => canUseFeature(k, plan))

  const [snapshots, setSnapshots] = useState<any[]>([])
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
  // Derive the storage meter reactively from the live store document (real-time
  // via StoreProvider's onSnapshot, which picks up Storage-trigger increments the
  // instant they commit) + the plan's limit. This is equivalent to the
  // checkStorageQuota callable but stays current after an upload, so the meter
  // reflects post-upload usage without a reload.
  const limitBytes = plan ? Number(plan.storageLimit || 0) * MB : 0
  const usedBytes = Number(store?.storageUsed || 0)
  const storage: StorageQuota | null = limitBytes > 0 ? {
    usedBytes,
    limitBytes,
    limitReached: usedBytes >= limitBytes,
    remainingBytes: Math.max(0, limitBytes - usedBytes),
    usedPercent: Math.min(100, Math.round((usedBytes / limitBytes) * 100)),
  } : null
  const storageLevel = storage ? usageLevelFor(storage.usedPercent, true) : 'none'
  const storageTone = storageLevel === 'reached' ? 'red' : storageLevel === 'near' || storageLevel === 'approaching' ? 'amber' : storageLevel === 'moderate' ? 'primary' : 'green'

  useEffect(() => {
    getMerchantPaymentInfoCallable()
      .then((res) => setSettings((res.data as PlatformSettings) || null))
      .catch(() => setSettings(null))
  }, [])

  if (loading && !subscription) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  if (!subscription) {
    return (
      <div>
        <InternalPageHeader eyebrow="إدارة الباقة" title="الاشتراك" subtitle="اشتراك متجرك" />
        <Card>
          <EmptyState
            icon="card_membership"
            title="لا يوجد اشتراك"
            description="لم يتم إنشاء اشتراك لمتجرك بعد. يرجى التواصل مع مدير المنصة لتفعيله."
          />
        </Card>
      </div>
    )
  }

  const pendingRequest = paymentRequests.find((p) => p.status === 'pending')
  const paymentHistory = [...paymentRequests].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  const currency = settings?.currency || 'EGP'
  const canSubmit = status === 'trialing' || status === 'expired' || status === 'suspended'
  const needsPayment = !pendingRequest && (status === 'trialing' || status === 'expired' || status === 'suspended')

  const handleProof = (file: File | null) => {
    setError('')
    if (!file) return setProof(null)
    const err = validateImageFile(file)
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
      const res = await changeSubscriptionPlanCallable({ storeId, planId: targetPlanId })
      const changed = (res.data as { changed?: boolean })?.changed
      toast.push(changed ? 'تم تغيير باقتك بنجاح' : 'أنت بالفعل على هذه الباقة', undefined, 'success')
      setUpgradeOpen(false)
      refresh()
    } catch (err: any) {
      toast.push('فشل تغيير الباقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setChanging(false)
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
        subscriptionId: subscription.id,
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
      setError(err?.message || 'فشل إرسال طلب الدفع')
      toast.push('فشل إرسال الطلب', undefined, 'error')
    } finally {
      setUploading(false)
      setSubmitting(false)
    }
  }

  const statusTone = SUBSCRIPTION_STATUS_TONES[status as keyof typeof SUBSCRIPTION_STATUS_TONES] || 'slate'
  const statusLabel = SUBSCRIPTION_STATUS_LABELS[status as keyof typeof SUBSCRIPTION_STATUS_LABELS] || status
  const isFreePlan = Number(plan?.priceMonthly || 0) <= 0
  const paidPeriodEnd = subscription.currentPeriodEnd || subscription.expiresAt
  const renewalLabel = status === 'active' && !isFreePlan && paidPeriodEnd ? formatDate(paidPeriodEnd) : isFreePlan ? 'لا يوجد تجديد مدفوع' : '—'

  return (
    <div className="merchant-operations merchant-subscription-page">
      <InternalPageHeader eyebrow="إدارة الباقة" title="الاشتراك" subtitle="تفاصيل باقة متجرك، الاستخدام، الفوترة والميزات" />

      <WorkspaceSection title="الخطة والحالة" subtitle="التواريخ مفصولة عن الاستخدام والفوترة" className="subscription-overview-workspace">
      <div className="grid grid-2">
        <Card title="معلومات الاشتراك">
          <div className="list-row"><span>الباقة</span><strong>{plan?.name || subscription.planName || '—'}</strong></div>
          <div className="list-row"><span>الحالة</span><Badge tone={statusTone}>{statusLabel}</Badge></div>
          <div className="list-row"><span>تاريخ الإنشاء</span><span>{formatDate(subscription.createdAt)}</span></div>
          {subscription.trialStartedAt && <div className="list-row"><span>بداية التجربة</span><span>{formatDate(subscription.trialStartedAt)}</span></div>}
          {subscription.trialEndsAt && <div className="list-row"><span>نهاية التجربة</span><span>{formatDate(subscription.trialEndsAt)}</span></div>}
          {subscription.currentPeriodStart && <div className="list-row"><span>بداية الدورة الحالية</span><span>{formatDate(subscription.currentPeriodStart)}</span></div>}
          {subscription.currentPeriodEnd && <div className="list-row"><span>نهاية الدورة الحالية</span><span>{formatDate(subscription.currentPeriodEnd)}</span></div>}
          <div className="list-row"><span>موعد التجديد</span><span>{renewalLabel}</span></div>
          <div className="list-row"><span>تاريخ الانتهاء</span><span>{isFreePlan ? 'لا ينتهي' : formatDate(subscription.expiresAt || subscription.currentPeriodEnd || subscription.trialEndsAt)}</span></div>
          {(subscription as any).cancelledAt && <div className="list-row"><span>تاريخ الإلغاء</span><span>{formatDate((subscription as any).cancelledAt)}</span></div>}
          {subscription.activatedAt && (
            <div className="list-row"><span>تاريخ التفعيل</span><span>{formatDate(subscription.activatedAt)}</span></div>
          )}
          <div className="list-row">
            <span>السعر الشهري</span>
            <span>
              {plan ? formatCurrency(plan.priceMonthly, currency) : '—'}
              {launchOffer && <span className="muted small"> — أول شهر {formatCurrency(nextAmount, currency)}</span>}
            </span>
          </div>
        </Card>

        <UsageCard subscription={subscription} plan={plan} />
      </div>
      </WorkspaceSection>

      <WorkspaceSection title="الاستخدام والحدود" subtitle="الاستهلاك الحالي مقارنة بحدود خطتك" className="subscription-usage-workspace">
      <div className="grid grid-2">
        <Card title="استهلاك المنتجات">
          {productLimit <= 0 ? (
            <p className="muted small">باقتك الحالية لا تفرض حداً على عدد المنتجات.</p>
          ) : (
            <>
              <div className="flex-between mb-1">
                <span className="font-semibold">{formatNumber(productCount)} من {formatNumber(productLimit)} منتج</span>
                <Badge tone={productTone as any}>{ORDER_USAGE_LABELS[productLevel] || 'طبيعي'}</Badge>
              </div>
              <Progress value={productCount} max={productLimit} tone={productTone as any} />
              <div className="summary-row mt-2">
                <span>المنتجات المتبقية</span>
                <strong>{formatNumber(productRemaining ?? 0)}</strong>
              </div>
              {productLevel === 'reached' && (
                <div className="mt-2">
                  <LimitRaiser label="المنتجات" detail="لا يمكنك إضافة منتجات جديدة حتى ترفع باقتك." compact />
                </div>
              )}
              {productLevel === 'near' || productLevel === 'approaching' ? (
                <p className="field-hint mt-2">اقتربت من حد المنتجات لهذه الدورة.</p>
              ) : null}
            </>
          )}
        </Card>

        <Card title="استهلاك المستخدمين">
          <div className="flex-between mb-1">
            <span className="font-semibold">{formatNumber(userCount)} من {formatNumber(userLimit)} مستخدم</span>
            <Badge tone={userTone as any}>{ORDER_USAGE_LABELS[userLevel] || 'طبيعي'}</Badge>
          </div>
          <Progress value={userCount} max={Math.max(userLimit, 1)} tone={userTone as any} />
          <div className="summary-row mt-2">
            <span>المقاعد المتبقية</span>
            <strong>{formatNumber(Math.max(0, userLimit - userCount))}</strong>
          </div>
        </Card>

        <Card title="استهلاك التخزين">
          {storage && storage.limitBytes > 0 ? (
            <>
              <div className="flex-between mb-1">
                <span className="font-semibold">
                  {formatNumber(Math.round(storage.usedBytes / MB))} MB / {formatNumber(Math.round(storage.limitBytes / MB))} MB
                </span>
                <Badge tone={storageTone as any}>{ORDER_USAGE_LABELS[storageLevel] || 'طبيعي'}</Badge>
              </div>
              <Progress value={storage.usedBytes} max={storage.limitBytes} tone={storageTone as any} />
              <p className="muted small mt-2">
                {storage.limitReached
                  ? 'استنفدت مساحة التخزين المتاحة. رقِّ باقتك أو احذف بعض الملفات للمتابعة.'
                  : storage.remainingBytes != null
                    ? `مساحة متبقية ${formatNumber(Math.round(storage.remainingBytes / MB))} MB (${storage.usedPercent}%).`
                    : ''}
              </p>
            </>
          ) : (
            <p className="muted small">باقتك الحالية لا تفرض حداً واضحاً للتخزين.</p>
          )}
        </Card>

        <Card title="المزايا المفعّلة في باقتك">
          {enabledFeatures.length === 0 ? (
            <p className="muted small">لا توجد مزايا إضافية مفعّلة في باقتك الحالية.</p>
          ) : (
            <ul className="feature-list">
              {enabledFeatures.map((k) => (
                <li key={k}><Icon name="check_circle" className="feature-list-icon" ariaHidden />{PLAN_FEATURE_LABELS[k]}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      </WorkspaceSection>

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

      {status === 'trialing' && (
        <Card title="تجربتك المجانية" className="mt-2">
          <div className="trial-countdown">
            <Icon name="hourglass_top" />
            <div>
              <strong>{trialRemaining || 'قاربت على الانتهاء'}</strong>
              <p className="muted small">باقتك النشطة تعمل بكامل المزايا خلال الفترة التجريبية.</p>
            </div>
          </div>
        </Card>
      )}

      {plan && <div className="mt-2"><PricingCard plan={plan} featured /></div>}

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
        {allPlans.length === 0 ? (
          <EmptyState title="لا توجد باقات" description="لم تُضف الباقات بعد — تواصل مع مدير المنصة." icon="workspace_premium" />
        ) : (
          <div className="grid grid-2">
            {allPlans.map((p) => (
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

      <Card title={pendingRequest ? 'طلب التفعيل' : 'تفعيل الاشتراك'} className="mt-2">
        {pendingRequest ? (
          <EmptyState
            icon="hourglass_top"
            title="طلبك قيد المراجعة"
            description={`تم استلام طلب التفعيل بمبلغ ${formatCurrency(pendingRequest.amount, currency)} وهو قيد المراجعة من إدارة المنصة. سيتم تفعيل اشتراكك فور التأكيد.`}
          />
        ) : status === 'active' ? (
          <EmptyState
            icon="verified"
            title="اشتراكك نشط"
            description={`باقتك مفعّلة حتى ${formatDate(subscription.currentPeriodEnd || subscription.expiresAt)}. سيتم التجديد تلقائياً بالمبلغ ${formatCurrency(nextAmount, currency)} عند انتهاء الدورة.`}
          />
        ) : canSubmit ? (
          <>
            <p className="muted small mb-2">
              {status === 'trialing'
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
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => handleProof((e.target as HTMLInputElement).files?.[0] || null)}
                />
                {proof && <p className="muted small">{proof.name}</p>}
                {uploading && <p className="muted small">جاري رفع الصورة…</p>}
              </div>
              {error && <p className="field-error">{error}</p>}
              <Button type="submit" loading={submitting} icon="arrow_forward" className="mt-2">إرسال طلب التفعيل</Button>
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
  )
}
export default MerchantSubscription

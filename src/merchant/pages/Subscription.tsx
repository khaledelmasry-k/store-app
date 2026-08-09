import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useStore } from '../../shared/hooks/useStore'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { getMerchantPaymentInfoCallable } from '../../shared/services/auth'
import { submitPaymentRequestCallable } from '../../shared/services/auth'
import { uploadPaymentProof, validateImageFile } from '../../shared/services/uploads'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Icon } from '../../shared/components/ui/Icon'
import { PricingCard } from '../../shared/components/subscription/PricingCard'
import { UsageCard } from '../../shared/components/subscription/UsageCard'
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/format'
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_TONES } from '../../shared/utils/constants'
import { useToast } from '../../shared/hooks/useToast'
import type { PlatformSettings, SubscriptionPayment } from '../../shared/types'

export const MerchantSubscription: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const toast = useToast()
  const { subscription, plan, paymentRequests, status, nextAmount, launchOffer, trialRemaining, loading, refresh } = useSubscription(storeId)

  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getMerchantPaymentInfoCallable()
      .then((res) => setSettings((res.data as PlatformSettings) || null))
      .catch(() => setSettings(null))
  }, [])

  if (loading && !subscription) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  if (!subscription) {
    return (
      <div>
        <PageHeader title="الاشتراك" subtitle="اشتراك متجرك" />
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
  const canSubmit = status === 'trialing' || status === 'expired'
  const needsPayment = !pendingRequest && (status === 'trialing' || status === 'expired')

  const handleProof = (file: File | null) => {
    setError('')
    if (!file) return setProof(null)
    const err = validateImageFile(file)
    if (err) return setError(err.message)
    setProof(file)
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

  return (
    <div>
      <PageHeader title="الاشتراك" subtitle="تفاصيل باقة متجرك وتفعيل الاشتراك" />

      <div className="grid grid-2">
        <Card title="معلومات الاشتراك">
          <div className="list-row"><span>الباقة</span><strong>{plan?.name || subscription.planName || '—'}</strong></div>
          <div className="list-row"><span>الحالة</span><Badge tone={statusTone}>{statusLabel}</Badge></div>
          <div className="list-row">
            <span>{status === 'trialing' ? 'تنتهي التجربة في' : 'ينتهي الاشتراك في'}</span>
            <span>{formatDate(subscription.trialEndsAt || subscription.currentPeriodEnd || subscription.expiresAt)}</span>
          </div>
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
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>الوسيلة</th>
                  <th>رقم العملية</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((p: SubscriptionPayment) => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.createdAt)}</td>
                    <td>{formatCurrency(p.amount, currency)}</td>
                    <td>{p.paymentMethod}</td>
                    <td dir="ltr">{p.reference}</td>
                    <td>
                      <Badge tone={p.status === 'approved' ? 'green' : p.status === 'rejected' ? 'red' : 'amber'}>
                        {p.status === 'approved' ? 'مقبول' : p.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {needsPayment && <p className="muted small mt-2">إذا سبق لك الإرسال، يرجى التحقق من حالة الطلب أعلاه قبل إعادة الإرسال.</p>}
        </Card>
      )}
    </div>
  )
}
export default MerchantSubscription

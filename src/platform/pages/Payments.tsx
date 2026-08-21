import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Tabs } from '../../shared/components/ui/Tabs'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { approvePaymentRequestCallable, rejectPaymentRequestCallable } from '../../shared/services/auth'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { PAYMENT_STATUS_TONES } from '../../shared/utils/constants'
import type { Payment, Transaction, SubscriptionPayment } from '../../shared/types'

export const PlatformPayments: FunctionalComponent = () => {
  const [tab, setTab] = useState<'payments' | 'transactions' | 'subscriptions'>('payments')
  const paymentsRes = useCollection<Payment>('payments', { orderBy: { field: 'createdAt' } })
  const payments = paymentsRes.data
  const txnsRes = useCollection<Transaction>('transactions', { orderBy: { field: 'createdAt' } })
  const txns = txnsRes.data
  const subPaymentsRes = useCollection<SubscriptionPayment>('subscriptionPayments', { orderBy: { field: 'createdAt' } })
  const subPayments = subPaymentsRes.data
  const toast = useToast()

  const [viewTarget, setViewTarget] = useState<SubscriptionPayment | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const total = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const collected = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
  const txnTotal = txns.reduce((s, t) => s + (t.amount || 0), 0)
  const pendingCount = subPayments.filter((p) => p.status === 'pending').length

  if (paymentsRes.loading || txnsRes.loading || subPaymentsRes.loading) return <Loading />

  const decide = async (p: SubscriptionPayment, approved: boolean) => {
    if (busyId) return
    setBusyId(p.id)
    try {
      if (approved) {
        await approvePaymentRequestCallable({ paymentRequestId: p.id, note: 'تم التأكيد من إدارة المنصة' })
        toast.push('تم تفعيل الاشتراك', `تم قبول عملية ${p.reference} وتفعيل الباقة`, 'success')
      } else {
        await rejectPaymentRequestCallable({ paymentRequestId: p.id, note: 'رفض من إدارة المنصة' })
        toast.push('تم رفض الطلب', `تم رفض عملية ${p.reference}`, 'error')
      }
      setViewTarget(null)
    } catch (err: any) {
      toast.push('فشلت العملية', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="platform-operations platform-payments-page">
      <div className="platform-page-intro platform-page-intro--payments">
        <PageHeader
          title="المدفوعات والمعاملات"
          subtitle={tab === 'subscriptions' ? `${subPayments.length} طلب تفعيل اشتراك` : tab === 'payments' ? `${payments.length} عملية دفع` : `${txns.length} معاملة • ${formatCurrency(txnTotal)}`}
        />
        <div className="platform-intro-meta">مراجعة التدفقات المالية وطلبات تفعيل الاشتراكات</div>
      </div>

      <Tabs
        tabs={[
          { key: 'payments', label: 'المدفوعات', count: payments.length },
          { key: 'transactions', label: 'سجل المعاملات', count: txns.length },
          { key: 'subscriptions', label: 'طلبات التفعيل', count: pendingCount },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'payments' | 'transactions' | 'subscriptions')}
      />

      {tab === 'payments' ? (
        <Fragment>
          <div className="stats-grid">
            <StatsCard title="إجمالي المدفوعات" value={total} currency icon="payments" tone="primary" />
            <StatsCard title="تم تحصيله" value={collected} currency icon="account_balance_wallet" tone="green" />
            <StatsCard title="معلق" value={payments.filter((p) => p.status === 'pending').length} icon="hourglass" tone="amber" />
          </div>
          <Card>
            <Table cardMode
              columns={[
                { key: 'method', header: 'الطريقة', render: (p: Payment) => <Badge tone="indigo">{p.method}</Badge> },
                { key: 'amount', header: 'المبلغ', render: (p: Payment) => formatCurrency(p.amount) },
                { key: 'status', header: 'الحالة', render: (p: Payment) => <Badge tone={(PAYMENT_STATUS_TONES[p.status] as any) || 'slate'}>{p.status}</Badge> },
                { key: 'orderId', header: 'الطلب', render: (p: Payment) => p.orderId ? <span className="monospace">{p.orderId.slice(0, 8)}</span> : '—' },
                { key: 'createdAt', header: 'التاريخ', render: (p: Payment) => <span className="muted">{formatDateTime(p.createdAt)}</span> },
              ]}
              rows={payments}
            />
          </Card>
        </Fragment>
      ) : tab === 'transactions' ? (
        <Fragment>
          <div className="stats-grid">
            <StatsCard title="إجمالي المعاملات" value={txnTotal} currency icon="sync" tone="primary" />
            <StatsCard title="مكتملة" value={txns.filter((t) => t.status === 'completed').length} icon="check_circle" tone="green" />
            <StatsCard title="معلقة" value={txns.filter((t) => t.status === 'pending').length} icon="hourglass" tone="amber" />
          </div>
          <Card>
            <Table cardMode
              columns={[
                { key: 'type', header: 'النوع', render: (t: Transaction) => <Badge tone="blue">{t.type}</Badge> },
                { key: 'description', header: 'الوصف' },
                { key: 'amount', header: 'المبلغ', render: (t: Transaction) => formatCurrency(t.amount) },
                { key: 'status', header: 'الحالة', render: (t: Transaction) => <Badge tone={t.status === 'completed' ? 'green' : t.status === 'pending' ? 'amber' : 'red'}>{t.status}</Badge> },
                { key: 'reference', header: 'المرجع', render: (t: Transaction) => t.reference ? <span className="monospace">{t.reference}</span> : '—' },
                { key: 'createdAt', header: 'التاريخ', render: (t: Transaction) => <span className="muted">{formatDateTime(t.createdAt)}</span> },
              ]}
              rows={txns}
            />
          </Card>
        </Fragment>
      ) : (
        <Fragment>
          <div className="stats-grid">
            <StatsCard title="إجمالي الطلبات" value={subPayments.length} icon="card_membership" tone="primary" />
            <StatsCard title="قيد المراجعة" value={pendingCount} icon="hourglass" tone="amber" />
            <StatsCard title="طلبات مقبولة" value={subPayments.filter((p) => p.status === 'approved').length} icon="check_circle" tone="green" />
          </div>
          <Card>
            {subPayments.length === 0 ? (
              <EmptyState icon="card_membership" title="لا توجد طلبات تفعيل" description="عند تقديم تجار طلبات دفع لتفعيل اشتراكاتهم ستظهر هنا." />
            ) : (
              <Table cardMode
                columns={[
                  { key: 'storeId', header: 'المتجر', render: (p: SubscriptionPayment) => <span className="monospace small">{p.storeId.slice(0, 8)}…</span> },
                  { key: 'planName', header: 'الباقة' },
                  { key: 'amount', header: 'المبلغ', render: (p: SubscriptionPayment) => formatCurrency(p.amount) },
                  { key: 'paymentMethod', header: 'الوسيلة' },
                  { key: 'reference', header: 'رقم العملية', render: (p: SubscriptionPayment) => <span className="monospace">{p.reference}</span> },
                  { key: 'status', header: 'الحالة', render: (p: SubscriptionPayment) => <Badge tone={(SUBSCRIPTION_PAYMENT_TONE[p.status] as any) || 'slate'}>{p.status === 'approved' ? 'مقبول' : p.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}</Badge> },
                  { key: 'createdAt', header: 'التاريخ', render: (p: SubscriptionPayment) => <span className="muted">{formatDateTime(p.createdAt)}</span> },
                  { key: 'actions', header: '', render: (p: SubscriptionPayment) => (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" icon="visibility" onClick={() => setViewTarget(p)}>عرض</Button>
                      {p.status === 'pending' && (
                        <Fragment>
                          <Button size="sm" icon="check" loading={busyId === p.id} onClick={() => decide(p, true)}>قبول</Button>
                          <Button variant="danger" size="sm" icon="close" loading={busyId === p.id} onClick={() => decide(p, false)}>رفض</Button>
                        </Fragment>
                      )}
                    </div>
                  ) },
                ]}
                rows={subPayments}
              />
            )}
          </Card>
        </Fragment>
      )}

      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title={viewTarget ? `طلب تفعيل — ${viewTarget.planName}` : ''} footer={viewTarget?.status === 'pending' ? (
        <Fragment>
          <Button variant="danger" icon="close" loading={busyId === viewTarget.id} onClick={() => decide(viewTarget, false)}>رفض الطلب</Button>
          <Button icon="check" loading={busyId === viewTarget.id} onClick={() => decide(viewTarget, true)}>قبول وتفعيل</Button>
        </Fragment>
      ) : undefined}>
        {viewTarget && (
          <div className="detail-stack">
            <div className="list-row"><span>الباقة</span><strong>{viewTarget.planName}</strong></div>
            <div className="list-row"><span>المبلغ</span><strong>{formatCurrency(viewTarget.amount)}</strong></div>
            <div className="list-row"><span>الدورة المدفوعة</span><strong>{viewTarget.periodNumber === 1 ? 'الشهر الأول (سعر الإطلاق)' : `الشهر ${viewTarget.periodNumber}`}</strong></div>
            <div className="list-row"><span>وسيلة الدفع</span><strong>{viewTarget.paymentMethod}</strong></div>
            <div className="list-row"><span>رقم العملية</span><strong className="monospace" dir="ltr">{viewTarget.reference}</strong></div>
            <div className="list-row"><span>التاريخ</span><span>{formatDateTime(viewTarget.createdAt)}</span></div>
            {viewTarget.note && <div className="list-row"><span>ملاحظات</span><span>{viewTarget.note}</span></div>}
            {viewTarget.screenshotUrl && (
              <div className="field">
                <span className="field-label">إثبات التحويل</span>
                <a href={viewTarget.screenshotUrl} target="_blank" rel="noreferrer">
                  <img src={viewTarget.screenshotUrl} alt="إثبات التحويل" className="payment-proof-img" />
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

const SUBSCRIPTION_PAYMENT_TONE: Record<string, string> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
}
export default PlatformPayments

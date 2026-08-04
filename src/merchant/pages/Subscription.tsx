import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import type { Subscription } from '../../shared/types'

const STATUS_TONES: Record<string, string> = {
  active: 'green',
  pending: 'amber',
  expired: 'slate',
  cancelled: 'red',
  rejected: 'red',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  pending: 'قيد المراجعة',
  expired: 'منتهي',
  cancelled: 'ملغى',
  rejected: 'مرفوض',
}

export const MerchantSubscription: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const subsRes = useCollection<Subscription>('subscriptions', { storeId })
  const subs = subsRes.data
  const plansRes = useCollection('plans', {})
  const plans = plansRes.data
  const current = subs[0]

  return (
    <div>
      <PageHeader title="الاشتراك" subtitle="حالة اشتراك متجرك والباقة الحالية" />
      <div className="grid grid-2">
        <Card title="الاشتراك الحالي">
          {current ? (
            <>
              <p className="stat-value">{current.planName}</p>
              <div className="mt-1">
                <Badge tone={(STATUS_TONES[current.status] as any) || 'slate'}>
                  {STATUS_LABELS[current.status] || current.status}
                </Badge>
              </div>
              <dl className="kv mt-2">
                <div className="kv-item"><dt>تاريخ البدء</dt><dd>{formatDate(current.startedAt)}</dd></div>
                <div className="kv-item"><dt>تاريخ الانتهاء</dt><dd>{formatDate(current.expiresAt)}</dd></div>
              </dl>
              {current.status === 'pending' && (
                <div className="mt-2" style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <strong style={{ color: 'var(--warning)' }}>⌛ طلب الاشتراك قيد المراجعة</strong>
                  <p className="muted small mt-1">
                    طلب اشتراكك قيد المراجعة حالياً من قبل إدارة المنصة. سيتم تفعيل حسابك بمجرد الموافقة.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="muted">لا يوجد اشتراك نشط — تواصل مع إدارة المنصة.</p>
          )}
        </Card>
        <Card title="الباقات المتاحة">
          {plans.map((p: any) => (
            <div key={p.id} className="flex-between mb-2" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div>
                <strong>{p.name}</strong>
                <p className="muted small">{p.description}</p>
              </div>
              <div className="flex" style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className="stat-value">{formatCurrency(p.priceMonthly)}</span>
                <span className="muted small">شهرياً</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
export default MerchantSubscription

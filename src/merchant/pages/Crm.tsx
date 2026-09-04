import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Button } from '../../shared/components/ui/Button'
import { Icon } from '../../shared/components/ui/Icon'
import { useStore } from '../../shared/hooks/useStore'
import { useToast } from '../../shared/hooks/useToast'
import { getCrmAnalyticsCallable } from '../../shared/services/crm'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency, formatNumber } from '../../shared/utils/format'
import type { CustomerFollowUp } from '../../shared/types'
import './Crm.css'

export const MerchantCrm: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const toast = useToast()
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const followUpsRes = useCollection<CustomerFollowUp>('customerFollowUps', { storeId, where: { status: { value: 'pending' } }, orderBy: { field: 'dueAt', dir: 'asc' } }, !!storeId)

  useEffect(() => {
    if (!storeId) return
    setLoading(true)
    getCrmAnalyticsCallable({ storeId })
      .then((res: any) => setAnalytics(res.data))
      .catch((err: any) => toast.push('تعذر تحميل تحليلات CRM', err?.message, 'error'))
      .finally(() => setLoading(false))
  }, [storeId])

  const kpis = analytics ? [
    { label: 'إجمالي العملاء', value: formatNumber(analytics.totalCustomers), icon: 'groups', sub: `${analytics.newCustomers} جدد هذا الشهر` },
    { label: 'متكررون', value: formatNumber(analytics.repeatCustomers), icon: 'repeat', sub: `${(analytics.repeatPurchaseRate * 100).toFixed(1)}% معدل التكرار` },
    { label: 'VIP', value: formatNumber(analytics.vip), icon: 'workspace_premium', sub: 'عملاء مميزون', tone: 'amber' },
    { label: 'معرض للخسارة', value: formatNumber(analytics.atRisk), icon: 'warning', sub: 'يحتاج متابعة', tone: 'orange' },
    { label: 'متوسط الطلب', value: formatCurrency(analytics.avgOrderValue), icon: 'receipt_long', sub: 'AOV' },
    { label: 'قيمة العميل', value: formatCurrency(analytics.customerLifetimeValue), icon: 'payments', sub: 'CLV' },
  ] : []

  const overdue = followUpsRes.data.filter((f) => {
    const due = f.dueAt?.seconds ? f.dueAt.seconds * 1000 : 0
    return due && due < Date.now()
  })

  const stageKeys = ['lead', 'new', 'active', 'repeat', 'vip', 'at_risk', 'lost'] as const
  const stageLabels: Record<string, string> = { lead: 'محتمل', new: 'جديد', active: 'نشط', repeat: 'متكرر', vip: 'VIP', at_risk: 'خطر', lost: 'مفقود' }
  const stageColors: Record<string, string> = { lead: 'var(--outline)', new: 'var(--primary)', active: '#22c55e', repeat: '#6366f1', vip: '#f59e0b', at_risk: '#f97316', lost: '#ef4444' }

  if (loading && !analytics) return <div className="loading-screen"><span className="spinner spinner-lg" /> جاري تحميل CRM...</div>

  return (
    <div className="merchant-crm-page">
      <PageHeader
        breadcrumb="إدارة العملاء"
        title="لوحة CRM"
        subtitle={`نظرة 360 على عملاء ${store?.name || 'متجرك'} — مقاييس، مراحل، متابعات`}
        actions={<Button variant="ghost" icon="groups" onClick={() => (window.location.href = '/dashboard/customers')}>إدارة العملاء</Button>}
      />

      <div className="crm-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="crm-kpi-card">
            <div className="crm-kpi-top">
              <span className="crm-kpi-label">{k.label}</span>
              <span className="crm-kpi-icon"><Icon name={k.icon} ariaHidden /></span>
            </div>
            <span className="crm-kpi-value">{k.value}</span>
            <span className="crm-kpi-sub">{k.sub}</span>
          </div>
        ))}
      </div>

      <div className="crm-grid">
        <div className="crm-panel">
          <div className="crm-panel-head">
            <h3>توزيع المراحل</h3>
            <span className="muted small">{analytics?.totalCustomers || 0} عميل</span>
          </div>
          <div className="crm-panel-body">
            {stageKeys.map((key) => {
              const count = analytics?.byStage?.[key] || 0
              const pct = analytics?.totalCustomers ? (count / analytics.totalCustomers) * 100 : 0
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ minWidth: 60, fontSize: 12, color: 'var(--text-on-surface-variant)' }}>{stageLabels[key]}</span>
                  <div className="crm-stage-seg" style={{ flex: 1 }}>
                    <i style={{ width: `${pct}%`, background: stageColors[key] }} />
                  </div>
                  <span style={{ minWidth: 32, textAlign: 'end', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-on-surface-variant)' }}>مفقود: {analytics?.lost || 0}</span>
              <span style={{ fontSize: 11, color: 'var(--text-on-surface-variant)' }}>متابعات مستحقة: {analytics?.followUpsDue || 0}</span>
              <span style={{ fontSize: 11, color: 'var(--error)' }}>متأخرة: {analytics?.overdueFollowUps || 0}</span>
            </div>
          </div>
        </div>

        <div className="crm-panel">
          <div className="crm-panel-head">
            <h3>المتابعات المستحقة</h3>
            <a href="/dashboard/customers" style={{ fontSize: 12, color: 'var(--primary)' }}>عرض العملاء</a>
          </div>
          <div className="crm-panel-body">
            {followUpsRes.loading ? (
              <p className="muted small">جاري التحميل...</p>
            ) : followUpsRes.data.length === 0 ? (
              <p className="muted small">لا توجد متابعات معلقة. أضف متابعات من صفحة العملاء.</p>
            ) : (
              <>
                {overdue.length > 0 && <p style={{ fontSize: 12, color: 'var(--error)', marginBottom: 8 }}>⚠️ {overdue.length} متابعة متأخرة</p>}
                {followUpsRes.data.slice(0, 6).map((f) => {
                  const due = f.dueAt?.seconds ? f.dueAt.seconds * 1000 : 0
                  const isOverdue = due && due < Date.now()
                  return (
                    <div key={f.id} className={`crm-follow-row ${isOverdue ? 'is-overdue' : ''}`}>
                      <span style={{ width: 28, height: 28, borderRadius: 9999, background: isOverdue ? 'var(--error-container)' : 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isOverdue ? 'var(--on-error-container)' : 'var(--text-on-surface-variant)' }}>
                        <Icon name="event" ariaHidden />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.customerName || f.customerId} — {f.customerPhone || ''}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-on-surface-variant)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.notes || 'بدون ملاحظات'}</div>
                      </div>
                      <span style={{ fontSize: 11, color: isOverdue ? 'var(--error)' : 'var(--text-on-surface-variant)', whiteSpace: 'nowrap' }}>
                        {f.dueAt ? new Date(f.dueAt.seconds * 1000).toLocaleDateString('ar-EG') : ''}
                      </span>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="crm-grid">
        <div className="crm-panel">
          <div className="crm-panel-head"><h3>أهم المحافظات</h3></div>
          <div className="crm-panel-body">
            <div className="crm-gov-list">
              {(analytics?.topGovernorates || []).map((g: any) => {
                const pct = analytics?.totalCustomers ? (g.count / analytics.totalCustomers) * 100 : 0
                return (
                  <div key={g.name} className="crm-gov-row">
                    <span style={{ fontSize: 12, minWidth: 80 }}>{g.name}</span>
                    <div className="crm-gov-bar"><i style={{ width: `${pct}%` }} /></div>
                    <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{g.count}</span>
                  </div>
                )
              })}
              {(!analytics?.topGovernorates || analytics.topGovernorates.length === 0) && <p className="muted small">لا توجد بيانات محافظات.</p>}
            </div>
          </div>
        </div>

        <div className="crm-panel">
          <div className="crm-panel-head"><h3>نمو العملاء — آخر 7 أيام</h3></div>
          <div className="crm-panel-body">
            {analytics?.byDay ? (
              <div style={{ display: 'flex', alignItems: 'end', gap: 6, height: 80 }}>
                {Object.entries(analytics.byDay as Record<string, number>).map(([day, count]) => {
                  const max = Math.max(1, ...Object.values(analytics.byDay as Record<string, number>))
                  const h = (Number(count) / max) * 60 + 8
                  return (
                    <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-on-surface-variant)' }}>{count}</span>
                      <div style={{ width: '100%', height: h, background: 'var(--primary)', borderRadius: 6, opacity: 0.85 }} />
                      <span style={{ fontSize: 9, color: 'var(--text-on-surface-variant)' }}>{day.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="muted small">لا توجد بيانات.</p>
            )}
            <p className="muted small" style={{ marginTop: 12 }}>
              معدل التكرار: {(analytics?.repeatPurchaseRate * 100).toFixed(1)}% — {analytics?.repeatCustomers || 0} عملاء اشتروا أكثر من مرة.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
export default MerchantCrm

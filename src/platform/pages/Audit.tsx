import { FunctionalComponent } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { Select } from '../../shared/components/ui/Select'
import { Input } from '../../shared/components/ui/Input'
import { Drawer } from '../../shared/components/ui/Drawer'
import { Button } from '../../shared/components/ui/Button'
import { useCollectionOnce } from '../../shared/hooks/useCollectionOnce'
import { formatDateTime, normalizeDate } from '../../shared/utils/format'
import type { AuditLog, Store, User } from '../../shared/types'
import './PlatformCorePages.css'

const ACTION_LABELS: Record<string, string> = {
  production_test_data_cleanup: 'تم تنظيف بيانات الاختبار', canonical_plans_synced: 'تمت مزامنة الباقات الأساسية',
  subscription_change_requested: 'تم طلب تغيير الباقة', plan_changed: 'تم تغيير الباقة', promotion_created: 'تم إنشاء عرض',
  promotion_activated: 'تم تفعيل العرض', promotion_stopped: 'تم إيقاف العرض', merchant_suspended: 'تم إيقاف التاجر',
  merchant_reactivated: 'تم إعادة تفعيل التاجر', payment_submitted: 'تم إرسال طلب دفع', payment_approved: 'تم اعتماد الدفع',
  payment_rejected: 'تم رفض الدفع', saas_trial_started_on_registration: 'بدأت الفترة التجريبية', store_published: 'تم نشر المتجر',
  store_suspended: 'تم إيقاف المتجر',
}
const ENTITY_LABELS: Record<string, string> = {
  subscriptions: 'الاشتراك', subscriptionChangeRequests: 'طلب تغيير الباقة', plans: 'الباقات', platformPromotions: 'العروض',
  users: 'المستخدم', stores: 'المتجر', subscriptionPayments: 'الدفع', orders: 'الطلب', products: 'المنتج', shipping: 'الشحن',
  merchants: 'التاجر', system: 'النظام',
}
const ACTION_TONES: Record<string, string> = {
  payment_approved: 'green', merchant_reactivated: 'green', store_published: 'green', subscription_change_requested: 'amber',
  saas_trial_started_on_registration: 'amber', promotion_stopped: 'amber', merchant_suspended: 'red', payment_rejected: 'red',
  permanently_deleted: 'red', merchant_deleted: 'red',
}
const FILTERS = [
  { value: 'all', label: 'كل الإجراءات' }, { value: 'merchants', label: 'التجار' }, { value: 'subscriptions', label: 'الاشتراكات' },
  { value: 'payments', label: 'المدفوعات' }, { value: 'promotions', label: 'العروض' }, { value: 'plans', label: 'الباقات' },
  { value: 'stores', label: 'المتاجر' }, { value: 'orders', label: 'الطلبات' }, { value: 'system', label: 'النظام' },
]
function valueText(value: unknown): string { if (value == null) return ''; if (typeof value === 'string' || typeof value === 'number') return String(value); return String(value) }
function actionLabel(action: string): string { return ACTION_LABELS[action] || action.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()) }
function actorFor(log: AuditLog, users: User[]): User | undefined { return users.find((u) => u.id === log.userId || u.uid === log.userId) }
function entityCategory(log: AuditLog): string {
  const text = `${log.resource} ${log.action}`.toLowerCase()
  if (/payment/.test(text)) return 'payments'; if (/promotion|coupon/.test(text)) return 'promotions'; if (/subscription|trial/.test(text)) return 'subscriptions'
  if (/plan/.test(text)) return 'plans'; if (/order/.test(text)) return 'orders'; if (/store|publish/.test(text)) return 'stores'; if (/merchant|user/.test(text)) return 'merchants'; return 'system'
}
function detailsFor(log: AuditLog): string {
  const meta = log.meta || {}; const from = meta.fromPlan || meta.previousPlan || meta.oldPlan; const to = meta.toPlan || meta.newPlan || meta.plan
  if (from || to) return `${valueText(from) || '—'} → ${valueText(to) || '—'}`
  if (meta.amount != null) return `${valueText(meta.amount)} ج.م${meta.method ? ` — ${valueText(meta.method)}` : ''}`
  if (meta.storeName) return `متجر ${valueText(meta.storeName)}`; if (meta.promotionName) return `عرض ${valueText(meta.promotionName)}`; if (meta.description) return valueText(meta.description); return '—'
}
function readableDate(input: any): any {
  const date = normalizeDate(input)
  if (!date) return <span className="muted">—</span>
  return <span className="audit-date"><span>{date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span><span>{date.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}</span></span>
}

export const PlatformAudit: FunctionalComponent = () => {
  const auditRes = useCollectionOnce<AuditLog>('auditLogs', { orderBy: { field: 'createdAt' }, limit: 500 })
  const usersRes = useCollectionOnce<User>('users', { limit: 1000 }); const storesRes = useCollectionOnce<Store>('stores', { limit: 1000 })
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('all'); const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState(''); const [selected, setSelected] = useState<AuditLog | null>(null)
  const users = usersRes.data; const storeMap = useMemo(() => new Map(storesRes.data.map((store) => [store.id, store])), [storesRes.data])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase(); const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity; const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Infinity
    return auditRes.data.filter((log) => { const actor = actorFor(log, users); const store = log.storeId ? storeMap.get(log.storeId) : undefined; const haystack = [actionLabel(log.action), log.action, ENTITY_LABELS[log.resource] || log.resource, actor?.name, actor?.email, store?.name, detailsFor(log)].filter(Boolean).join(' ').toLowerCase(); const stamp = normalizeDate(log.createdAt as any)?.getTime() ?? NaN; return (!q || haystack.includes(q)) && (category === 'all' || entityCategory(log) === category) && stamp >= from && stamp <= to })
  }, [auditRes.data, users, storeMap, query, category, fromDate, toDate])
  return <div className="platform-operations platform-audit-page">
    <PageHeader title="سجل التدقيق الإداري" subtitle={`${auditRes.data.length} إدخال — سجل واضح لكل تغيير`} />
    <Card><FilterBar search={query} onSearch={setQuery} searchPlaceholder="ابحث بالاسم أو البريد أو الإجراء أو المتجر..." /><div className="audit-filters" role="group" aria-label="فلاتر سجل التدقيق"><Select value={category} onChange={setCategory} options={FILTERS} /><Input type="date" value={fromDate} onChange={setFromDate} /><Input type="date" value={toDate} onChange={setToDate} /></div>
      <Table rows={filtered} loading={auditRes.loading} emptyMessage="لا توجد إجراءات مطابقة" onRowClick={setSelected} columns={[
        { key: 'actor', header: 'المستخدم', render: (log: AuditLog) => { const actor = actorFor(log, users); const meta = log.meta || {}; const actorName = actor?.name || (meta.actorName as string) || (log.userId ? 'مستخدم محذوف' : 'النظام'); const actorEmail = actor?.email || (meta.actorEmail as string); const role = actor?.role || (meta.actorRole as string); return <div className="audit-actor"><strong>{actorName}</strong>{actorEmail && <small>{actorEmail}</small>}{role && <Badge tone="slate">{role === 'superAdmin' ? 'مدير المنصة' : role === 'merchant' ? 'تاجر' : role}</Badge>}{!actor && log.userId && <small className="monospace">{log.userId.slice(0, 8)}…</small>}</div> } },
        { key: 'action', header: 'الإجراء', render: (log: AuditLog) => <div className="audit-action"><Badge tone={ACTION_TONES[log.action] || 'slate'}>{actionLabel(log.action)}</Badge><small>{detailsFor(log)}</small></div> },
        { key: 'entity', header: 'الكيان', render: (log: AuditLog) => <span>{ENTITY_LABELS[log.resource] || log.resource}{log.storeId && storeMap.get(log.storeId) ? ` — ${storeMap.get(log.storeId)?.name}` : ''}</span> },
        { key: 'details', header: 'التفاصيل', render: (log: AuditLog) => <span>{detailsFor(log)}</span> }, { key: 'createdAt', header: 'التاريخ', render: (log: AuditLog) => readableDate(log.createdAt) },
        { key: 'more', header: '', render: (log: AuditLog) => <Button variant="ghost" size="sm" onClick={(event: MouseEvent) => { event.stopPropagation(); setSelected(log) }}>عرض التفاصيل</Button> },
      ]} />
    </Card>
    <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="تفاصيل النشاط" size="lg">{selected && (() => {
      const actor = actorFor(selected, users)
      const store = selected.storeId ? storeMap.get(selected.storeId) : undefined
      const entity = `${ENTITY_LABELS[selected.resource] || 'سجل المنصة'}${store ? ` — ${store.name}` : ''}`
      return <div className="audit-technical-details audit-activity-details"><dl>
        <dt>النشاط</dt><dd>{actionLabel(selected.action)}</dd>
        <dt>تم بواسطة</dt><dd>{actor?.name || (selected.meta?.actorName as string) || 'النظام'}{(actor?.email || (selected.meta?.actorEmail as string)) && <small> · {actor?.email || (selected.meta?.actorEmail as string)}</small>}</dd>
        <dt>يتعلق بـ</dt><dd>{entity}</dd>
        <dt>الملخص</dt><dd>{detailsFor(selected)}</dd>
        <dt>التاريخ</dt><dd>{formatDateTime(selected.createdAt)}</dd>
      </dl></div>
    })()}</Drawer>
  </div>
}
export default PlatformAudit

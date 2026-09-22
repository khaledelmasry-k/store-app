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
  subscription_change_requested: 'تم طلب تغيير الباقة', subscription_change_approved: 'تمت الموافقة على تغيير الباقة',
  plan_changed: 'تم تغيير الباقة', plan_created: 'تم إنشاء باقة', plan_deactivated: 'تم إيقاف باقة',
  promotion_created: 'تم إنشاء عرض', promotion_activated: 'تم تفعيل العرض', promotion_stopped: 'تم إيقاف العرض',
  merchant_suspended: 'تم إيقاف التاجر', merchant_reactivated: 'تم إعادة تفعيل التاجر',
  merchant_permanently_deleted: 'تم حذف التاجر نهائياً', delete_test_merchant: 'تم حذف تاجر اختباري',
  delete_selected_test_merchants: 'تم حذف تجار اختباريين محددين', approve_merchant_application: 'تمت الموافقة على طلب التاجر',
  payment_submitted: 'تم إرسال طلب دفع', payment_approved: 'تم اعتماد الدفع', payment_rejected: 'تم رفض الدفع',
  reject_subscription: 'تم رفض الاشتراك', subscription_expired: 'انتهى الاشتراك', trial_suspended: 'تم إيقاف التجربة المجانية',
  free_subscription_suspended: 'تم إيقاف اشتراك مجاني', launch_pricing_expired: 'انتهى سعر الإطلاق',
  one_time_purchase_requested: 'تم طلب شراء لمرة واحدة', one_time_purchase_approved: 'تمت الموافقة على شراء لمرة واحدة',
  saas_trial_started_on_registration: 'بدأت الفترة التجريبية', store_published: 'تم نشر المتجر', store_unpublished: 'تم إلغاء نشر المتجر',
  create_order: 'تم إنشاء طلب', update_order_status: 'تم تحديث حالة الطلب', cancel_order_and_shipment: 'تم إلغاء الطلب والشحنة', claim_order: 'تمت مطالبة بطلب',
  create_product: 'تم إنشاء منتج', update_product: 'تم تعديل منتج', delete_product: 'تم حذف منتج', adjust_product_stock: 'تم تعديل مخزون منتج',
  create_landing_page: 'تم إنشاء صفحة هبوط', create_sales_link: 'تم إنشاء رابط بيع',
  coupon_created: 'تم إنشاء كوبون', coupon_updated: 'تم تعديل كوبون', coupon_deleted: 'تم حذف كوبون',
  invite_staff: 'تمت دعوة عضو فريق',
  create_ticket: 'تم إنشاء تذكرة', ticket_replied: 'تم الرد على تذكرة', ticket_status_changed: 'تم تغيير حالة تذكرة',
  ticket_assigned: 'تم تعيين تذكرة', ticket_closed: 'تم إغلاق تذكرة', ticket_reopened: 'تم إعادة فتح تذكرة',
  update_customer_crm: 'تم تحديث بيانات CRM للعميل', add_customer_note: 'تمت إضافة ملاحظة عميل',
  crm_stage_changed: 'تم تغيير مرحلة CRM', crm_tags_changed: 'تم تعديل وسوم CRM', crm_assignment_changed: 'تم تغيير المسؤول',
  crm_note_added: 'تمت إضافة ملاحظة', crm_followup_created: 'تم إنشاء متابعة', crm_followup_updated: 'تم تحديث متابعة', crm_followup_completed: 'تمت المتابعة',
}
const ENTITY_LABELS: Record<string, string> = {
  subscriptions: 'الاشتراك', subscriptionChangeRequests: 'طلب تغيير الباقة', plans: 'الباقات', platformPromotions: 'العروض',
  users: 'المستخدم', stores: 'المتجر', subscriptionPayments: 'الدفع', orders: 'الطلب', products: 'المنتج', shipping: 'الشحن',
  merchants: 'التاجر', system: 'النظام', landingPages: 'صفحة الهبوط', storeLinks: 'رابط البيع', coupons: 'الكوبون',
  tickets: 'التذكرة', customers: 'العميل', platformMerchantCrm: 'CRM التاجر',
}
const ACTION_TONES: Record<string, string> = {
  payment_approved: 'green', merchant_reactivated: 'green', store_published: 'green', promotion_activated: 'green',
  one_time_purchase_approved: 'green', approve_merchant_application: 'green', subscription_change_approved: 'green',
  subscription_change_requested: 'amber', saas_trial_started_on_registration: 'amber', promotion_stopped: 'amber',
  trial_suspended: 'amber', launch_pricing_expired: 'amber', subscription_expired: 'amber',
  merchant_suspended: 'red', payment_rejected: 'red', reject_subscription: 'red', delete_product: 'red',
  merchant_permanently_deleted: 'red', delete_test_merchant: 'red', delete_selected_test_merchants: 'red',
  free_subscription_suspended: 'red', cancel_order_and_shipment: 'red', coupon_deleted: 'red', store_unpublished: 'red',
}
const FILTERS = [
  { value: 'all', label: 'كل الإجراءات' }, { value: 'merchants', label: 'التجار' }, { value: 'subscriptions', label: 'الاشتراكات' },
  { value: 'payments', label: 'المدفوعات' }, { value: 'promotions', label: 'العروض' }, { value: 'plans', label: 'الباقات' },
  { value: 'stores', label: 'المتاجر' }, { value: 'orders', label: 'الطلبات' }, { value: 'products', label: 'المنتجات' },
  { value: 'crm', label: 'CRM والتذاكر' }, { value: 'marketing', label: 'التسويق' }, { value: 'system', label: 'النظام' },
]
function valueText(value: unknown): string { if (value == null) return ''; if (typeof value === 'string' || typeof value === 'number') return String(value); return String(value) }
function actionLabel(action: string): string { return ACTION_LABELS[action] || action.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()) }
function actorFor(log: AuditLog, users: User[]): User | undefined { return users.find((u) => u.id === log.userId || u.uid === log.userId) }
function entityCategory(log: AuditLog): string {
  const text = `${log.resource} ${log.action}`.toLowerCase()
  if (/payment/.test(text)) return 'payments'; if (/promotion|coupon|sales_link|landing/.test(text)) return 'marketing'; if (/subscription|trial/.test(text)) return 'subscriptions'
  if (/plan/.test(text)) return 'plans'; if (/order/.test(text)) return 'orders'; if (/product/.test(text)) return 'products'
  if (/ticket|crm|customer/.test(text)) return 'crm'; if (/store|publish/.test(text)) return 'stores'; if (/merchant|user|staff/.test(text)) return 'merchants'; return 'system'
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
        { key: 'actor', header: 'المستخدم', render: (log: AuditLog) => {
          const actor = actorFor(log, users)
          const meta = log.meta || {}
          // A guest checkout writes the literal string 'guest' as the actor
          // id (there is no user doc to look up), not a real, since-deleted
          // account — those need distinct labels rather than both falling
          // through to "مستخدم محذوف".
          const isGuest = log.userId === 'guest'
          const actorName = actor?.name || (meta.actorName as string) || (isGuest ? 'زائر' : log.userId ? 'مستخدم محذوف' : 'النظام')
          const actorEmail = actor?.email || (meta.actorEmail as string)
          const role = actor?.role || (meta.actorRole as string)
          return <div className="audit-actor"><strong>{actorName}</strong>{actorEmail && <small>{actorEmail}</small>}{role && <Badge tone="slate">{role === 'superAdmin' ? 'مدير المنصة' : role === 'merchant' ? 'تاجر' : role}</Badge>}{!actor && log.userId && !isGuest && <small className="monospace">{log.userId.slice(0, 8)}…</small>}</div>
        } },
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

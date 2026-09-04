import type { Order } from '../types'

export const CRM_STAGES = ['lead', 'new', 'active', 'repeat', 'vip', 'at_risk', 'lost'] as const
export type CrmStage = typeof CRM_STAGES[number]

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  lead: 'عميل محتمل',
  new: 'عميل جديد',
  active: 'نشط',
  repeat: 'متكرر',
  vip: 'VIP',
  at_risk: 'معرض للخسارة',
  lost: 'مفقود',
}

export const CRM_STAGE_TONES: Record<CrmStage, string> = {
  lead: 'slate',
  new: 'blue',
  active: 'green',
  repeat: 'indigo',
  vip: 'amber',
  at_risk: 'orange',
  lost: 'red',
}

export const CRM_STAGE_OPTIONS = CRM_STAGES.map((s) => ({ value: s, label: CRM_STAGE_LABELS[s] }))

export function normalizeCrmStage(v: string | null | undefined): CrmStage | null {
  if (!v) return null
  const low = String(v).toLowerCase().trim()
  if ((CRM_STAGES as readonly string[]).includes(low)) return low as CrmStage
  // legacy segment mapping
  const legacy: Record<string, CrmStage> = {
    new: 'new',
    repeat: 'repeat',
    vip: 'vip',
    inactive: 'lost',
    'جديد': 'new',
    'متكرر': 'repeat',
    'مكرر': 'repeat',
    'مهمل': 'lost',
    'نشط': 'active',
  }
  return legacy[v] || legacy[low] || null
}

export function crmStageLabel(v: string | null | undefined): string {
  const s = normalizeCrmStage(v)
  return s ? CRM_STAGE_LABELS[s] : ''
}

// Map old 4 segments to new 7 stages for migration/back-compat
export function segmentToCrmStage(seg: string | null | undefined): CrmStage | null {
  const n = String(seg || '').toLowerCase()
  if (n === 'new') return 'new'
  if (n === 'repeat') return 'repeat'
  if (n === 'vip') return 'vip'
  if (n === 'inactive') return 'lost'
  return normalizeCrmStage(seg)
}

// Auto-stage suggestion based on metrics (heuristics, not hard rule)
export interface StageSuggestionInput {
  totalOrders: number
  totalSpent: number
  deliveredOrders: number
  returnedOrders: number
  cancelledOrders: number
  daysSinceLastOrder: number | null
  avgOrderValue: number
}
export function suggestCrmStage(m: StageSuggestionInput): CrmStage {
  if (m.totalOrders === 0) return 'lead'
  if (m.totalOrders === 1) return 'new'
  // At-risk: ordered before but > 60 days ago
  if (m.daysSinceLastOrder != null && m.daysSinceLastOrder > 90 && m.totalOrders > 0) return 'lost'
  if (m.daysSinceLastOrder != null && m.daysSinceLastOrder > 60) return 'at_risk'
  if (m.totalOrders >= 5 || m.totalSpent >= 5000) return 'vip'
  if (m.totalOrders >= 3) return 'repeat'
  return 'active'
}

export function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const tag = String(raw || '').trim().slice(0, 30)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length >= 20) break
  }
  return out
}

export function sanitizePhone(raw: string | null | undefined): string {
  return String(raw || '').trim().slice(0, 30)
}

// Metrics helpers — mirrors backend logic
export function calcCustomerMetrics(orders: Order[]) {
  const totalOrders = orders.length
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED').length
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length
  const returnedOrders = orders.filter((o) => o.status === 'RETURNED').length
  const shippedOrders = orders.filter((o) => o.status === 'SHIPPED').length
  const totalRevenue = orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + (o.totalPrice || 0), 0)
  const avgOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0
  // lastOrderAt
  const sorted = [...orders].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  const lastOrder = sorted[0] || null
  const lastOrderAt = lastOrder?.createdAt || null
  const daysSinceLastOrder = lastOrderAt ? Math.floor((Date.now() - lastOrderAt.seconds * 1000) / 86400000) : null
  const returnRate = totalOrders > 0 ? returnedOrders / totalOrders : 0
  const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0
  const repeatPurchaseRate = totalOrders > 1 ? 1 : 0 // per-customer; aggregated elsewhere
  // frequency: orders per 30d
  const firstOrder = [...orders].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))[0]
  const daysSpan = firstOrder && lastOrder && firstOrder !== lastOrder ? Math.max(1, Math.floor(((lastOrder.createdAt?.seconds || 0) - (firstOrder.createdAt?.seconds || 0)) / 86400)) : 0
  const frequency = daysSpan > 0 ? (totalOrders / daysSpan) * 30 : totalOrders > 1 ? totalOrders : 0

  return {
    totalOrders,
    deliveredOrders,
    cancelledOrders,
    returnedOrders,
    shippedOrders,
    totalRevenue,
    avgOrderValue,
    lastOrderAt,
    lastOrder,
    daysSinceLastOrder,
    returnRate,
    cancellationRate,
    repeatPurchaseRate,
    frequency,
    lifetimeValue: totalRevenue,
  }
}

export type FollowUpStatus = 'pending' | 'done' | 'cancelled' | 'overdue'
export const FOLLOW_UP_STATUSES: FollowUpStatus[] = ['pending', 'done', 'cancelled', 'overdue']
export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: 'قيد الانتظار',
  done: 'مكتمل',
  cancelled: 'ملغي',
  overdue: 'متأخر',
}
export const FOLLOW_UP_STATUS_TONES: Record<FollowUpStatus, string> = {
  pending: 'amber',
  done: 'green',
  cancelled: 'slate',
  overdue: 'red',
}

export type TimelineEventType =
  | 'customer.created'
  | 'customer.updated'
  | 'customer.note'
  | 'customer.tag'
  | 'customer.stage_change'
  | 'order.created'
  | 'order.status_changed'
  | 'order.cancelled'
  | 'order.returned'
  | 'payment'
  | 'shipment.created'
  | 'shipment.delivered'
  | 'shipment.returned'
  | 'shipment.failed'
  | 'follow_up.created'
  | 'follow_up.completed'
  | 'follow_up.cancelled'
  | 'note.added'
  | 'notification.sent'

export const TIMELINE_TYPE_LABELS: Record<TimelineEventType, string> = {
  'customer.created': 'إنشاء العميل',
  'customer.updated': 'تحديث العميل',
  'customer.note': 'ملاحظة',
  'customer.tag': 'وسم',
  'customer.stage_change': 'تغيير المرحلة',
  'order.created': 'طلب جديد',
  'order.status_changed': 'تغيير حالة الطلب',
  'order.cancelled': 'إلغاء الطلب',
  'order.returned': 'مرتجع',
  'payment': 'دفعة',
  'shipment.created': 'إنشاء شحنة',
  'shipment.delivered': 'تم التسليم',
  'shipment.returned': 'مرتجع الشحن',
  'shipment.failed': 'تعذر التسليم',
  'follow_up.created': 'متابعة جديدة',
  'follow_up.completed': 'إتمام المتابعة',
  'follow_up.cancelled': 'إلغاء المتابعة',
  'note.added': 'ملاحظة',
  'notification.sent': 'إشعار',
}

export const TIMELINE_TYPE_ICONS: Record<TimelineEventType, string> = {
  'customer.created': 'person_add',
  'customer.updated': 'edit',
  'customer.note': 'note',
  'customer.tag': 'sell',
  'customer.stage_change': 'workspace_premium',
  'order.created': 'shopping_cart',
  'order.status_changed': 'sync_alt',
  'order.cancelled': 'cancel',
  'order.returned': 'assignment_return',
  'payment': 'payments',
  'shipment.created': 'local_shipping',
  'shipment.delivered': 'check_circle',
  'shipment.returned': 'assignment_return',
  'shipment.failed': 'error',
  'follow_up.created': 'calendar_today',
  'follow_up.completed': 'check_circle',
  'follow_up.cancelled': 'cancel',
  'note.added': 'note',
  'notification.sent': 'notifications',
}

import { httpsCallable, getFunctions } from 'firebase/functions'
import { listDocs, getDocById } from '../utils/firestore'
import type { Customer, CustomerFollowUp, CustomerTimelineEvent } from '../types'

const fns = () => getFunctions()

// ——— Callables ———
export function getCustomer360Callable(input: { storeId: string; customerId: string }) {
  return httpsCallable(fns(), 'getCustomer360')(input) as Promise<{ data: any }>
}
export function updateCustomerCrmCallable(input: {
  storeId: string
  customerId: string
  patch: Record<string, unknown>
}) {
  return httpsCallable(fns(), 'updateCustomerCrm')(input)
}
export function upsertFollowUpCallable(input: {
  storeId: string
  customerId: string
  followUpId?: string
  dueAt: string
  notes?: string
  assignedTo?: string
  status?: string
  result?: string
}) {
  return httpsCallable(fns(), 'upsertCustomerFollowUp')(input)
}
export function getCrmAnalyticsCallable(input: { storeId: string }) {
  return httpsCallable(fns(), 'getCrmAnalytics')(input) as Promise<{ data: any }>
}
export function listCustomerTimelineCallable(input: { storeId: string; customerId: string; limit?: number }) {
  return httpsCallable(fns(), 'listCustomerTimeline')(input) as Promise<{ data: { events: CustomerTimelineEvent[] } }>
}
export function addCustomerNoteCallable(input: { storeId: string; customerId: string; body: string }) {
  return httpsCallable(fns(), 'addCustomerNote')(input)
}
export function getCrmCustomersCallable(input: {
  storeId: string
  q?: string
  stage?: string
  tag?: string
  governorate?: string
  minOrders?: number
  maxOrders?: number
  minSpent?: number
  limit?: number
}) {
  return httpsCallable(fns(), 'listCrmCustomers')(input) as Promise<{ data: { customers: Customer[] } }>
}

// ——— Direct reads (fallback, tenant-scoped) ———
export const crmService = {
  // Follow-ups via direct read (rules gated) — callable preferred for writes
  listFollowUps: (storeId: string, customerId?: string) =>
    customerId
      ? listDocs<CustomerFollowUp>('customerFollowUps', { storeId, where: { customerId: { value: customerId } }, orderBy: { field: 'dueAt', dir: 'desc' } })
      : listDocs<CustomerFollowUp>('customerFollowUps', { storeId, orderBy: { field: 'dueAt', dir: 'asc' } }),
  listTimeline: (storeId: string, customerId: string) =>
    listDocs<CustomerTimelineEvent>('customerTimeline', { storeId, where: { customerId: { value: customerId } }, orderBy: { field: 'createdAt', dir: 'desc' }, limit: 100 }),
  getCustomer: (id: string) => getDocById<Customer>('customers', id),
}

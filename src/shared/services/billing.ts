import { listDocs, getDocById, createDoc, updateDocById, deleteDocById } from '../utils/firestore'
import { manageCouponCallable } from './auth'
import type { Shipment, ShippingCompany, ShippingCompanyReview, Subscription, SubscriptionPlan, Transaction, Payment, Coupon, ShippingZone } from '../types'

const subPath = 'subscriptions'
const plansPath = 'plans'
const txnPath = 'transactions'
const payPath = 'payments'
const couponPath = 'coupons'
const shippingPath = 'shipping'
const shippingCompaniesPath = 'shippingCompanies'
const shipmentsPath = 'shipments'
const shippingReviewsPath = 'shippingCompanyReviews'

export const subscriptionsService = {
  list: (storeId?: string) =>
    listDocs<Subscription>(storeId ? subPath : subPath, storeId ? { storeId, orderBy: { field: 'createdAt' } } : { orderBy: { field: 'createdAt' } }),
  all: () => listDocs<Subscription>(subPath, { orderBy: { field: 'createdAt' } }),
  get: (id: string) => getDocById<Subscription>(subPath, id),
  create: (data: Omit<Subscription, 'id'>) => createDoc<Subscription>(subPath, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(subPath, id, data),
  remove: (id: string) => deleteDocById(subPath, id),
}

export const plansService = {
  list: () => listDocs<SubscriptionPlan>(plansPath, { orderBy: { field: 'priceMonthly' } }),
  get: (id: string) => getDocById<SubscriptionPlan>(plansPath, id),
  create: (data: Omit<SubscriptionPlan, 'id'>) => createDoc<SubscriptionPlan>(plansPath, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(plansPath, id, data),
  remove: (id: string) => deleteDocById(plansPath, id),
}

export const transactionsService = {
  list: (storeId?: string) =>
    listDocs<Transaction>(txnPath, storeId ? { storeId, orderBy: { field: 'createdAt' } } : { orderBy: { field: 'createdAt' } }),
  create: (data: Omit<Transaction, 'id'>) => createDoc<Transaction>(txnPath, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(txnPath, id, data),
}

export const paymentsService = {
  list: (storeId?: string) =>
    listDocs<Payment>(payPath, storeId ? { storeId, orderBy: { field: 'createdAt' } } : { orderBy: { field: 'createdAt' } }),
  create: (data: Omit<Payment, 'id'>) => createDoc<Payment>(payPath, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(payPath, id, data),
}

export const couponsService = {
  list: (storeId: string) => listDocs<Coupon>(couponPath, { storeId, orderBy: { field: 'createdAt' } }),
  create: (storeId: string, data: Omit<Coupon, 'id' | 'storeId'>) => manageCouponCallable({ operation: 'create', storeId, coupon: data }),
  update: (storeId: string, id: string, data: Record<string, unknown>) => manageCouponCallable({ operation: 'update', storeId, couponId: id, coupon: data }),
  remove: (storeId: string, id: string) => manageCouponCallable({ operation: 'delete', storeId, couponId: id }),
}

export const shippingService = {
  list: (storeId: string) => listDocs<ShippingZone>(shippingPath, { storeId, orderBy: { field: 'name' } }),
  create: (storeId: string, data: Omit<ShippingZone, 'id' | 'storeId'>) => createDoc<ShippingZone>(shippingPath, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(shippingPath, id, data),
  remove: (id: string) => deleteDocById(shippingPath, id),
}

export const shippingMarketplaceService = {
  companies: () => listDocs<ShippingCompany>(shippingCompaniesPath, { orderBy: { field: 'name' } }),
  shipments: (storeId: string) => listDocs<Shipment>(shipmentsPath, { storeId, orderBy: { field: 'createdAt' } }),
  reviews: (merchantId: string) => listDocs<ShippingCompanyReview>(shippingReviewsPath, { where: { merchantId: { value: merchantId } }, orderBy: { field: 'createdAt' } }),
}

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth, db } from '../firebase'
import type { Role } from '../types'

export interface Credentials {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
  name: string
  phone: string
  storeName: string
  storeRef: string
  planId?: string
  /** 'monthly' (default) or 'yearly' — charged for the subscription period. */
  billingCycle?: 'monthly' | 'yearly'
}

export function login(creds: Credentials) {
  return signInWithEmailAndPassword(auth, creds.email, creds.password)
}

export function logout() {
  return signOut(auth)
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email)
}

export function signupCustomer(email: string, password: string, name: string, phone?: string) {
  return createUserWithEmailAndPassword(auth, email, password).then((cred) =>
    setDoc(doc(db, 'users', cred.user.uid), {
      email,
      name,
      ...(phone ? { phone } : {}),
      role: 'customer' as Role,
      storeIds: [],
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: cred.user.uid,
    }),
  )
}

export function registerMerchant(input: RegisterInput) {
  const functions = getFunctions()
  const fn = httpsCallable<RegisterInput, { uid: string }>(functions, 'registerMerchant')
  return fn(input)
}

export function createOrderCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'createOrder')
  return fn(input)
}

export function updateOrderStatusCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'updateOrderStatus')
  return fn(input)
}

export function generateOrderNumberCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'generateOrderNumber')
  return fn(input)
}

export function approveSubscriptionCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'approveSubscription')
  return fn(input)
}

export function rejectSubscriptionCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'rejectSubscription')
  return fn(input)
}

export function impersonateCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'impersonate')
  return fn(input)
}

export function exitImpersonationCallable() {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'exitImpersonation')
  return fn({})
}

export function trackOrderCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'trackOrder')
  return fn(input)
}

export function claimOrderCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'claimOrder')
  return fn(input)
}

export function recordStoreLinkVisitCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'recordStoreLinkVisit')
  return fn(input)
}

export function resolveStoreLinkCallable(input: { code: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'resolveStoreLink')
  return fn(input)
}

export function recordLandingPageViewCallable(input: { landingPageId: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'recordLandingPageView')
  return fn(input)
}

export function inviteStaffCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'inviteStaff')
  return fn(input)
}

export function getPlatformOverviewCallable() {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'getPlatformOverview')
  return fn({})
}

export function getMerchantSubscriptionCallable(input: { storeId: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'getMerchantSubscription')
  return fn(input)
}

export function changeSubscriptionPlanCallable(input: { storeId: string; planId: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'changeSubscriptionPlan')
  return fn(input)
}

export function checkStorageQuotaCallable(input: { storeId: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'checkStorageQuota')
  return fn(input)
}

export function getBillingSnapshotsCallable(input: { storeId: string }) {
  const functions = getFunctions()
  const fn = httpsCallable<{ storeId: string }, { snapshots: any[] }>(functions, 'getBillingSnapshots')
  return fn(input)
}

export function getMerchantPaymentInfoCallable() {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'getMerchantPaymentInfo')
  return fn({})
}

export function submitPaymentRequestCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'submitPaymentRequest')
  return fn(input)
}

export function approvePaymentRequestCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'approvePaymentRequest')
  return fn(input)
}

export function rejectPaymentRequestCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'rejectPaymentRequest')
  return fn(input)
}

export function getPublicStoreStatusCallable(input: { slug: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'getPublicStoreStatus')
  return fn(input)
}

export function setStorePublishedCallable(input: { storeId: string; published: boolean }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'setStorePublished')
  return fn(input)
}

export function createLandingPageCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'createLandingPage')
  return fn(input)
}

export function createProductCallable(input: { storeId: string; productId: string; data: Record<string, unknown> }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'createProduct')
  return fn(input)
}

export function createSalesLinkCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'createSalesLink')
  return fn(input)
}

export function savePlanCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'savePlan')
  return fn(input)
}

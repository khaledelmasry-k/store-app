import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCustomToken,
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
  couponCode?: string
}

export function login(creds: Credentials) {
  return signInWithEmailAndPassword(auth, creds.email, creds.password)
}

export function logout() {
  return signOut(auth)
}

export function sendVerificationEmail() {
  const current = auth.currentUser
  if (!current) return Promise.reject(new Error('auth/user-not-found'))
  return sendEmailVerification(current, {
    url: `${window.location.origin}/verify-email`,
    handleCodeInApp: false,
  })
}

export async function reloadCurrentUser() {
  const current = auth.currentUser
  if (!current) return null
  await reload(current)
  return current
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

export function getPublicPlatformConfigCallable() {
  return httpsCallable(getFunctions(), 'getPublicPlatformConfig')({})
}

export const getPlatformCrmDashboardCallable = () => httpsCallable(getFunctions(), 'getPlatformCrmDashboard')({})
export const listPlatformCrmMerchantsCallable = (input: { limit?: number }) => httpsCallable(getFunctions(), 'listPlatformCrmMerchants')(input)
export const getPlatformMerchant360Callable = (input: { merchantId: string }) => httpsCallable(getFunctions(), 'getPlatformMerchant360')(input)
export const updatePlatformMerchantCrmCallable = (input: Record<string, unknown>) => httpsCallable(getFunctions(), 'updatePlatformMerchantCrm')(input)
export const addPlatformMerchantNoteCallable = (input: { merchantId: string; body: string }) => httpsCallable(getFunctions(), 'addPlatformMerchantNote')(input)
export const listPlatformMerchantNotesCallable = (input: { merchantId: string }) => httpsCallable(getFunctions(), 'listPlatformMerchantNotes')(input)
export const upsertPlatformMerchantFollowUpCallable = (input: Record<string, unknown>) => httpsCallable(getFunctions(), 'upsertPlatformMerchantFollowUp')(input)
export const listPlatformMerchantFollowUpsCallable = (input: { merchantId: string }) => httpsCallable(getFunctions(), 'listPlatformMerchantFollowUps')(input)

export function saveEnterpriseWhatsAppSettingsCallable(input: { number: string; enabled: boolean; message?: string }) {
  return httpsCallable(getFunctions(), 'saveEnterpriseWhatsAppSettings')(input)
}

export function saveWhatsAppAutomationSettingsCallable(input: { senderNumber?: string; events: string[]; templates?: Record<string, string>; metaTemplates?: Record<string, { name?: string; language?: string }> }) {
  return httpsCallable(getFunctions(), 'saveWhatsAppAutomationSettings')(input)
}

export function getStoreWhatsAppAutomationCallable(input: { storeId: string }) {
  return httpsCallable(getFunctions(), 'getStoreWhatsAppAutomation')(input)
}

export function getStoreWhatsAppDeliveryLogCallable(input: { storeId: string }) {
  return httpsCallable(getFunctions(), 'getStoreWhatsAppDeliveryLog')(input)
}

export function saveStoreWhatsAppMetaConnectionCallable(input: { storeId: string; phoneNumberId: string; accessToken: string }) {
  return httpsCallable(getFunctions(), 'saveStoreWhatsAppMetaConnection')(input)
}

export function testStoreWhatsAppMetaConnectionCallable(input: { storeId: string }) {
  return httpsCallable(getFunctions(), 'testStoreWhatsAppMetaConnection')(input)
}

export function saveStoreWhatsAppAutomationCallable(input: { storeId: string; senderNumber?: string; events: string[]; templates?: Record<string, string>; metaTemplates?: Record<string, { name?: string; language?: string }> }) {
  return httpsCallable(getFunctions(), 'saveStoreWhatsAppAutomation')(input)
}

export function createPlatformPromotionCallable(input: Record<string, unknown>) { return httpsCallable(getFunctions(), 'createPlatformPromotion')(input) }
export function updatePlatformPromotionCallable(input: Record<string, unknown>) { return httpsCallable(getFunctions(), 'updatePlatformPromotion')(input) }
export function setPlatformPromotionStatusCallable(input: { promotionId: string; status: string }) { return httpsCallable(getFunctions(), 'setPlatformPromotionStatus')(input) }
export function getEligiblePromotionsCallable(input: { storeId: string }) { return httpsCallable(getFunctions(), 'getEligiblePromotions')(input) }
export function listPlatformPromotionsCallable() { return httpsCallable(getFunctions(), 'listPlatformPromotions')({}) }
export function getPublicPromotionsCallable() { return httpsCallable(getFunctions(), 'getPublicPromotions')({}) }
export function createAdCampaignCallable(input: Record<string, unknown>) { return httpsCallable(getFunctions(), 'createAdCampaign')(input) }
export function updateAdCampaignCallable(input: Record<string, unknown>) { return httpsCallable(getFunctions(), 'updateAdCampaign')(input) }
export function listAdCampaignsCallable(input: { storeId: string }) { return httpsCallable(getFunctions(), 'listAdCampaigns')(input) }

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

export function getOrderIntegrationEventsCallable(input: { orderId: string }) {
  return httpsCallable(getFunctions(), 'getOrderIntegrationEvents')(input)
}

export function quoteShipmentCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'quoteShipment')(input)
}

export function assignShipmentCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'assignShipment')(input)
}

export function submitShippingReviewCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'submitShippingReview')(input)
}

export function updateShipmentStatusCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'updateShipmentStatus')(input)
}

export function saveShippingProviderCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'saveShippingProvider')(input)
}

export function setShippingProviderStatusCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'setShippingProviderStatus')(input)
}

export function getMerchantShippingProvidersCallable(input: { storeId: string }) {
  return httpsCallable(getFunctions(), 'getMerchantShippingProviders')(input)
}

export function saveStoreShippingProviderCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'saveStoreShippingProvider')(input)
}

export function testShippingConnectionCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'testShippingConnection')(input)
}

export function getWaslaLocationsCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'getWaslaLocations')(input)
}

export function saveIntegrationCredentialsCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'saveIntegrationCredentials')(input)
}

export function saveShippingAutomationSettingsCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'saveShippingAutomationSettings')(input)
}

export function getShippingOptionsCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'getShippingOptions')(input)
}

export function createOrderShipmentCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'createOrderShipment')(input)
}

export function requestOrderReturnCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'requestOrderReturn')(input)
}

export function receiveOrderReturnCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'receiveOrderReturn')(input)
}

export function refreshShipmentTrackingCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'refreshShipmentTracking')(input)
}

export function recordShippingSettlementCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'recordShippingSettlement')(input)
}

export function downloadShipmentDocumentCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'downloadShipmentDocument')(input)
}

export function cancelExternalShipmentCallable(input: Record<string, unknown>) {
  return httpsCallable(getFunctions(), 'cancelExternalShipment')(input)
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

export async function startImpersonation(storeId: string) {
  const result: any = await impersonateCallable({ storeId })
  if (!result.data?.customToken) throw new Error('لم يتم إنشاء جلسة الدعم')
  await signInWithCustomToken(auth, result.data.customToken)
  return result.data
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

export function manageCouponCallable(input: {
  operation: 'create' | 'update' | 'delete'
  storeId: string
  couponId?: string
  coupon?: Record<string, unknown>
}) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'manageCoupon')
  return fn(input)
}

export function quoteCouponCallable(input: { storeId: string; code: string; subtotal: number }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'quoteCoupon')
  return fn(input)
}

export function quoteSubscriptionCouponCallable(input: { code: string; planId: string; billingCycle?: 'monthly' | 'yearly'; amount: number }) {
  return httpsCallable(getFunctions(), 'quoteSubscriptionCoupon')(input)
}

export function manageSubscriptionCouponCallable(input: { operation: 'create' | 'update'; couponId?: string; coupon?: Record<string, unknown> }) {
  return httpsCallable(getFunctions(), 'manageSubscriptionCoupon')(input)
}

export function getPublicStoreCouponsCallable(input: { storeId: string }) {
  return httpsCallable(getFunctions(), 'getPublicStoreCoupons')(input)
}

export function getPublicStoreCallable(input: { slug: string; preview?: boolean }) {
  return httpsCallable(getFunctions(), 'getPublicStore')(input)
}

export function getPublicLandingPageCallable(input: { slug: string }) {
  return httpsCallable(getFunctions(), 'getPublicLandingPage')(input)
}

export function createTicketCallable(input: { storeId: string; subject: string; description: string; priority: string }) {
  return httpsCallable(getFunctions(), 'createTicket')(input)
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

export function changeSubscriptionPlanCallable(input: { storeId: string; planId: string; billingCycle?: 'monthly' | 'yearly' }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'changeSubscriptionPlan')
  return fn(input)
}

export function requestStorePurchaseCallable(input: { storeId: string; offerId: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'requestStorePurchase')
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

export function updateProductCallable(input: { storeId: string; productId: string; data: Record<string, unknown> }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'updateProduct')
  return fn(input)
}

export function deleteProductCallable(input: { storeId: string; productId: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'deleteProduct')
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

export function syncCanonicalPlansCallable() {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'syncCanonicalPlans')
  return fn({})
}

export function deleteTestMerchantCallable(input: { storeId: string; confirmation: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'deleteTestMerchant')
  return fn(input)
}

export function deleteSelectedTestMerchantsCallable(input: { storeIds: string[]; confirmation: string }) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'deleteSelectedTestMerchants')
  return fn(input)
}

export function suspendMerchantCallable(input: { merchantId: string }) {
  const functions = getFunctions()
  return httpsCallable(functions, 'suspendMerchant')(input)
}

export function reactivateMerchantCallable(input: { merchantId: string }) {
  const functions = getFunctions()
  return httpsCallable(functions, 'reactivateMerchant')(input)
}

export interface MerchantDeletionPreview {
  status: 'ready' | 'deletion_failed' | 'deleting' | 'already_deleted'
  merchantId: string
  merchantName?: string
  merchantEmail?: string
  storeIds?: string[]
  storeNames?: Record<string, string>
  counts?: Record<string, number>
  summary?: Record<string, number>
  confirmation?: string
}

export function getMerchantDeletionPreviewCallable(input: { merchantId: string }) {
  const functions = getFunctions()
  return httpsCallable<typeof input, MerchantDeletionPreview>(functions, 'getMerchantDeletionPreview')(input)
}

export function permanentlyDeleteMerchantCallable(input: { merchantId: string; confirmation: string }) {
  const functions = getFunctions()
  return httpsCallable<typeof input, { ok: boolean; status: 'deleted' | 'already_deleted' | 'already_deleting'; summary: Record<string, number> }>(functions, 'permanentlyDeleteMerchant')(input)
}

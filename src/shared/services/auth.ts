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
  storeName: string
  storeRef: string
  planId?: string
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

export function signupCustomer(email: string, password: string, name: string) {
  return createUserWithEmailAndPassword(auth, email, password).then((cred) =>
    setDoc(doc(db, 'users', cred.user.uid), {
      email,
      name,
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

export function recordStoreLinkVisitCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'recordStoreLinkVisit')
  return fn(input)
}

export function inviteStaffCallable(input: Record<string, unknown>) {
  const functions = getFunctions()
  const fn = httpsCallable(functions, 'inviteStaff')
  return fn(input)
}

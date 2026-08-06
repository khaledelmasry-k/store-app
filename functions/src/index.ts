import * as admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'

admin.initializeApp()

const db = admin.firestore()
const auth = admin.auth()

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const now = () => FieldValue.serverTimestamp()

function tsFromDate(d: Date) {
  return Timestamp.fromDate(d)
}

async function getUserRole(uid: string): Promise<string | null> {
  try {
    const snap = await db.doc(`users/${uid}`).get()
    return snap.exists ? (snap.data()?.role as string) || null : null
  } catch {
    return null
  }
}

const _ALL_PERMISSIONS = [
  'products:view',
  'products:create',
  'products:edit',
  'products:delete',
  'orders:view',
  'orders:edit',
  'orders:status',
  'orders:cancel',
  'customers:view',
  'customers:create',
  'customers:edit',
  'customers:delete',
  'inventory:view',
  'inventory:adjust',
  'sales_links:view',
  'sales_links:create',
  'sales_links:analytics',
  'reports:view',
  'team:view',
  'team:invite',
  'team:manage_roles',
  'team:delete',
  'settings:view',
  'settings:edit',
  'coupons:manage',
  'landing:manage',
] as const

async function assertPlatformAdmin(request: CallableRequest) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const role = await getUserRole(request.auth.uid)
  if (role !== 'superAdmin') throw new HttpsError('permission-denied', 'صلاحيات غير كافية')
}

// RBAC gate for store-scoped operations.
// - superAdmin: platform-wide access
// - merchant (owner of storeId): full access
// - staff (member of storeId): access only when they hold `perm` (when provided)
async function assertStoreAccess(request: CallableRequest, storeId: string, perm?: string) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const userSnap = await db.doc(`users/${request.auth.uid}`).get()
  const user = userSnap.data()
  if (!user) throw new HttpsError('permission-denied', 'الحساب غير موجود')
  if (user.role === 'superAdmin') return
  if (!(user.storeIds || []).includes(storeId)) {
    throw new HttpsError('permission-denied', 'لا تملك هذا المتجر')
  }
  if (user.role === 'merchant') return
  if (user.role === 'staff') {
    if (perm && !(user.permissions || []).includes(perm)) {
      throw new HttpsError('permission-denied', 'صلاحيات غير كافية لهذه العملية')
    }
    return
  }
  throw new HttpsError('permission-denied', 'صلاحيات غير كافية')
}

async function bumpAnalytics(storeId: string, order: { totalPrice: number; status: string }) {
  const d = new Date()
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const ref = db.doc(`analytics/${storeId}_${key}`)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const prev = (snap.exists ? snap.data() : {}) || {}
    const byStatus = { ...(prev.byStatus || {}) }
    byStatus[order.status] = (byStatus[order.status] || 0) + 1
    tx.set(ref, {
      storeId,
      date: key,
      orders: (prev.orders || 0) + 1,
      revenue: FieldValue.increment(order.totalPrice),
      newCustomers: prev.newCustomers || 0,
      byStatus,
      updatedAt: now(),
    }, { merge: true })
  })
}

async function auditLog(storeId: string | null, userId: string, action: string, resource: string, resourceId: string, extra?: Record<string, any>) {
  await db.collection('auditLogs').add({
    storeId,
    userId,
    action,
    resource,
    resourceId,
    ...extra,
    createdAt: now(),
  })
}

// ─────────────────────────────────────────────────────────────
// 1. generateOrderNumber — unique ORD-NNNNN under concurrency
// ─────────────────────────────────────────────────────────────
export const generateOrderNumber = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')

  await assertStoreAccess(request, storeId, 'orders:manage')

  const counterRef = db.doc(`stores/${storeId}/counters/orders`)

  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef)
    const next = (snap.exists ? snap.data()?.value : 0) + 1
    tx.set(counterRef, { value: next }, { merge: true })
    return next
  })

  return { orderNumber: `ORD-${String(seq).padStart(5, '0')}` }
})

// ─────────────────────────────────────────────────────────────
// 2. createOrder — atomic stock deduction + order creation
// ─────────────────────────────────────────────────────────────
export const createOrder = onCall(async (request: CallableRequest<any>) => {
  const { storeId, items, customer, paymentMethod, salesLinkRef } = request.data || {}
  if (!storeId || !Array.isArray(items) || items.length === 0) throw new HttpsError('invalid-argument', 'بيانات الطلب غير مكتملة')
  if (!customer?.name || !customer?.phone) throw new HttpsError('invalid-argument', 'بيانات العميل مطلوبة')

  const allowedPayments = ['cod', 'bank']
  if (paymentMethod && !allowedPayments.includes(paymentMethod)) {
    throw new HttpsError('invalid-argument', 'طريقة دفع غير صالحة')
  }

  // Verify store exists, is active and published (IDOR mitigation — never trust
  // storeId without validation). Unpublished stores reject purchases.
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود أو غير مفعل')
  }
  if (!storeSnap.data()?.published) {
    throw new HttpsError('failed-precondition', 'المتجر غير منشور بعد')
  }

  // Check subscription limit before creating the order. The ordersUsed counter
  // on the active subscription tracks orders created in the current period and
  // is reset when a new subscription period starts (approveSubscription).
  const subQuery = db.collection('subscriptions').where('storeId', '==', storeId).where('status', '==', 'active').limit(1)
  const subSnap = await subQuery.get()
  if (subSnap.empty) {
    throw new HttpsError('failed-precondition', 'لا يوجد اشتراك نشط لهذا المتجر')
  }
  const subRef = subSnap.docs[0].ref
  const sub = subSnap.docs[0].data()!
  const planSnap = await db.doc(`plans/${sub.planId}`).get()
  if (!planSnap.exists) {
    throw new HttpsError('not-found', 'الباقة غير موجودة')
  }
  const plan = planSnap.data() as any
  const orderLimit = plan.orderLimitPerMonth
  const ordersUsed = Number(sub.ordersUsed || 0)
  if (orderLimit && orderLimit > 0 && ordersUsed >= orderLimit) {
    throw new HttpsError('resource-exhausted', `تم تجاوز حد الطلبات الشهري (${orderLimit})`)
  }

  const orderId = db.collection('orders').doc().id

  const result = await db.runTransaction(async (tx) => {
    const lineItems: any[] = []
    let subtotal = 0
    let salesLinkId: string | null = null
    let salesLinkStaffId: string | null = null

    // Read the order counter first — Firestore requires all reads to happen
    // before any writes within a transaction.
    const counterRef = db.doc(`stores/${storeId}/counters/orders`)
    const counterSnap = await tx.get(counterRef)
    const seq = (counterSnap.exists ? counterSnap.data()?.value : 0) + 1
    const orderNumber = `ORD-${String(seq).padStart(5, '0')}`

    for (const item of items) {
      const productSnap = await tx.get(db.doc(`products/${item.productId}`))
      if (!productSnap.exists) throw new HttpsError('failed-precondition', `المنتج ${item.productId} غير موجود`)
      const product = productSnap.data()!

      // Multi-tenancy guard: the product must belong to the order's store.
      if (product.storeId !== storeId) {
        throw new HttpsError('permission-denied', `المنتج ${product.name} لا ينتمي إلى هذا المتجر`)
      }
      if (!product.active) throw new HttpsError('failed-precondition', `المنتج ${product.name} غير متاح`)

      const qty = Number(item.quantity) || 1

      if (item.color && item.size && Array.isArray(product.variants)) {
        const variant = product.variants.find((v: any) => v.color === item.color && v.size === item.size)
        if (variant) {
          if ((variant.stock || 0) < qty) throw new HttpsError('failed-precondition', `الكمية غير متوفرة لـ ${product.name}`)
          variant.stock -= qty
          tx.update(db.doc(`products/${item.productId}`), { variants: product.variants })
        }
      }

      if ((product.stock || 0) < qty) throw new HttpsError('failed-precondition', `الكمية غير متوفرة لـ ${product.name}`)
      tx.update(db.doc(`products/${item.productId}`), { stock: FieldValue.increment(-qty) })

      const price = Number(product.price) || 0
      subtotal += price * qty
      lineItems.push({
        id: `${item.productId}-${item.color || ''}-${item.size || ''}`,
        productId: item.productId,
        name: product.name,
        price,
        quantity: qty,
        color: item.color || '',
        size: item.size || '',
      })
    }

    tx.set(counterRef, { value: seq }, { merge: true })

    if (salesLinkRef) {
      const linkQuery = await db.collection('storeLinks')
        .where('storeId', '==', storeId)
        .where('code', '==', salesLinkRef)
        .limit(1)
        .get()
      if (!linkQuery.empty) {
        const linkDoc = linkQuery.docs[0]
        tx.update(linkDoc.ref, {
          ordersCount: FieldValue.increment(1),
          totalRevenue: FieldValue.increment(subtotal),
          updatedAt: now(),
        })
        salesLinkId = linkDoc.id
        salesLinkStaffId = linkDoc.data()?.staffId || null
      }
    }

    tx.set(db.doc(`orders/${orderId}`), {
      storeId,
      orderNumber,
      customerName: customer.name,
      phone: customer.phone,
      governorate: customer.governorate || '',
      city: customer.city || '',
      address: customer.address || '',
      notes: customer.notes || null,
      customerId: request.auth?.uid || null,
      items: lineItems,
      subtotal,
      shippingFee: 0,
      discount: 0,
      totalPrice: subtotal,
      status: 'NEW',
      paymentMethod: paymentMethod || 'cod',
      couponCode: null,
      trackingCode: null,
      salesLinkRef: salesLinkRef || null,
      salesLinkId,
      salesLinkStaffId,
      createdAt: now(),
      updatedAt: now(),
      createdBy: request.auth?.uid || 'guest',
    })

    const customerId = db.collection('customers').doc().id
    tx.set(db.doc(`customers/${customerId}`), {
      storeId,
      name: customer.name,
      phone: customer.phone,
      governorate: customer.governorate || '',
      city: customer.city || '',
      address: customer.address || '',
      segment: null,
      note: customer.notes || null,
      totalOrders: FieldValue.increment(1),
      totalSpent: FieldValue.increment(subtotal),
      lastOrderAt: now(),
      createdAt: now(),
      updatedAt: now(),
      createdBy: 'system',
    })

    // Atomically consume one order slot from the active subscription. The
    // enforcement check above read the same counter, so concurrent orders can
    // never overshoot the plan limit.
    tx.update(subRef, { ordersUsed: FieldValue.increment(1), updatedAt: now() })

    return { orderId, orderNumber, totalPrice: subtotal }
  })

  await bumpAnalytics(storeId, { totalPrice: result.totalPrice, status: 'NEW' }).catch(() => {})

  await auditLog(storeId, request.auth?.uid || 'guest', 'create_order', 'orders', result.orderId, { orderNumber: result.orderNumber, totalPrice: result.totalPrice })

  return result
})

// ─────────────────────────────────────────────────────────────
// 3b. createProduct — merchant creates a product with plan limit enforcement
// ─────────────────────────────────────────────────────────────
export const createProduct = onCall(async (request: CallableRequest<any>) => {
  await assertStoreAccess(request, request.data?.storeId, 'products:manage')
  const { storeId, name, price, description, images, stock, lowStockThreshold } = request.data || {}
  if (!storeId || !name) throw new HttpsError('invalid-argument', 'بيانات المنتج غير مكتملة')
  if (typeof price !== 'number' || price < 0) throw new HttpsError('invalid-argument', 'السعر غير صالح')

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود أو غير مفعل')
  }

  // Check product limit from subscription plan
  const subSnap = await db.collection('subscriptions').where('storeId', '==', storeId).where('status', '==', 'active').limit(1).get()
  if (!subSnap.empty) {
    const sub = subSnap.docs[0].data() as any
    const planSnap = await db.doc(`plans/${sub.planId}`).get()
    if (planSnap.exists) {
      const plan = planSnap.data() as any
      const productLimit = plan.productLimit
      if (productLimit && productLimit > 0) {
        const existingProducts = await db.collection('products').where('storeId', '==', storeId).get()
        if (existingProducts.size >= productLimit) {
          throw new HttpsError('resource-exhausted', `تم تجاوز حد المنتجات (${productLimit})`)
        }
      }
    }
  }

  const productId = db.collection('products').doc().id
  await db.doc(`products/${productId}`).set({
    id: productId,
    storeId,
    name,
    price,
    description: description || '',
    images: images || [],
    stock: stock || 0,
    lowStockThreshold: lowStockThreshold ?? 5,
    active: true,
    createdAt: now(),
    updatedAt: now(),
    createdBy: request.auth?.uid || 'guest',
  })

  await auditLog(storeId, request.auth?.uid || 'guest', 'create_product', 'products', productId, { name })

  return { id: productId, name }
})

// ─────────────────────────────────────────────────────────────
// 4. registerMerchant — atomic tenant + store + owner creation
// ─────────────────────────────────────────────────────────────
export const registerMerchant = onCall(async (request: CallableRequest<any>) => {
  const { email, password, name, storeName, storeRef, planId } = request.data || {}
  if (!email || !password || !name || !storeName) throw new HttpsError('invalid-argument', 'بيانات التسجيل غير مكتملة')

  const uid = db.collection('users').doc().id
  const storeId = db.collection('stores').doc().id
  const baseSlug = (storeRef || storeName).toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || 'store'

  const emailQuery = await db.collection('users').where('email', '==', email).get()
  if (!emailQuery.empty) throw new HttpsError('already-exists', 'البريد مسجل مسبقاً')

  // Ensure the storefront slug is unique — append a numeric suffix when a
  // store already claims the candidate slug.
  let slug = baseSlug
  let attempt = 1
  for (;;) {
    const slugQuery = await db.collection('stores').where('slug', '==', slug).limit(1).get()
    if (slugQuery.empty) break
    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }

  let planName = 'بانتظار الاختيار'
  if (planId && planId !== 'pending') {
    try {
      const planSnap = await db.doc(`plans/${planId}`).get()
      if (planSnap.exists) {
        planName = planSnap.data()?.name || planName
      }
    } catch {
      // fallback if plan doc query fails
    }
  }

  await db.doc(`users/${uid}`).set({
    uid,
    email,
    name,
    role: 'merchant',
    storeIds: [storeId],
    active: false,
    createdAt: now(),
    updatedAt: now(),
    createdBy: uid,
  })
  await db.doc(`stores/${storeId}`).set({
    ref: slug,
    name: storeName,
    slug,
    active: true,
    published: false,
    ownerId: uid,
    currency: 'EGP',
    description: '',
    theme: { primary: '#6366f1', darkMode: false },
    createdAt: now(),
    updatedAt: now(),
    createdBy: uid,
  })
  await db.collection('subscriptions').add({
    storeId,
    planId: planId || 'pending',
    planName,
    status: 'pending',
    requestNote: 'طلب تسجيل جديد',
    createdAt: now(),
    updatedAt: now(),
    createdBy: uid,
  })

  await auth.createUser({ uid, email, password, displayName: name, disabled: true })
  // Account stays disabled until Platform Admin approves the subscription.
  // users.active stays false; both enforce the pending-approval gate.

  return { uid, storeId, status: 'pending_review' }
})

// ─────────────────────────────────────────────────────────────
// 4. approveSubscription — platform admin creates merchant login
// ─────────────────────────────────────────────────────────────
export const approveSubscription = onCall(async (request: CallableRequest<{ subscriptionId?: string }>) => {
  await assertPlatformAdmin(request)
  const { subscriptionId } = request.data || {}
  if (!subscriptionId) throw new HttpsError('invalid-argument', 'subscriptionId مطلوب')

  const subRef = db.doc(`subscriptions/${subscriptionId}`)
  const subSnap = await subRef.get()
  if (!subSnap.exists) throw new HttpsError('not-found', 'الاشتراك غير موجود')
  const sub = subSnap.data()!

  const storeSnap = await db.doc(`stores/${sub.storeId}`).get()
  const store = storeSnap.data()!
  if (!store) throw new HttpsError('not-found', 'المتجر غير موجود')

  const userSnap = await db.doc(`users/${store.ownerId}`).get()
  const user = userSnap.data()!
  if (!user) throw new HttpsError('not-found', 'المستخدم غير موجود')

  await auth.updateUser(store.ownerId, { disabled: false })
  await db.doc(`users/${store.ownerId}`).update({ active: true })

  await subRef.update({
    status: 'active',
    approvedBy: request.auth!.uid,
    adminEmail: user.email,
    startedAt: now(),
    expiresAt: tsFromDate(new Date(Date.now() + 30 * 86400000)),
    ordersUsed: 0,
    updatedAt: now(),
  })

  await db.collection('notifications').add({
    storeId: sub.storeId,
    userId: store.ownerId,
    title: 'تمت الموافقة على اشتراكك',
    body: `مرحباً ${user.name || user.email}. حسابك الآن نشط. يمكنك تسجيل الدخول إلى لوحة التحكم.`,
    type: 'billing',
    read: false,
    createdAt: now(),
    createdBy: 'system',
  })

  await auditLog(sub.storeId, request.auth!.uid, 'approve_subscription', 'subscriptions', subscriptionId, { storeId: sub.storeId, ownerId: store.ownerId })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 4b. rejectSubscription — platform admin denies a pending request
// ─────────────────────────────────────────────────────────────
export const rejectSubscription = onCall(async (request: CallableRequest<{ subscriptionId?: string }>) => {
  await assertPlatformAdmin(request)
  const { subscriptionId } = request.data || {}
  if (!subscriptionId) throw new HttpsError('invalid-argument', 'subscriptionId مطلوب')

  const subRef = db.doc(`subscriptions/${subscriptionId}`)
  const subSnap = await subRef.get()
  if (!subSnap.exists) throw new HttpsError('not-found', 'الاشتراك غير موجود')
  const sub = subSnap.data()!

  await subRef.update({
    status: 'rejected',
    approvedBy: request.auth!.uid,
    updatedAt: now(),
  })

  await db.collection('notifications').add({
    storeId: sub.storeId,
    userId: null,
    title: 'تم رفض اشتراكك',
    body: 'لم يتم اعتماد طلب اشتراكك هذا. يمكنك التواصل مع إدارة المنصة للمزيد من التفاصيل.',
    type: 'billing',
    read: false,
    createdAt: now(),
    createdBy: 'system',
  })

  await auditLog(sub.storeId, request.auth!.uid, 'reject_subscription', 'subscriptions', subscriptionId, { storeId: sub.storeId })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 4c. getPlatformOverview — platform admin operational snapshot.
//     Returns every store joined with its latest subscription, plan and
//     owner, plus the live order-usage metrics used by the Super Admin UI.
// ─────────────────────────────────────────────────────────────
export const getPlatformOverview = onCall(async (request: CallableRequest) => {
  await assertPlatformAdmin(request)

  const [storesSnap, subsSnap, plansSnap, usersSnap] = await Promise.all([
    db.collection('stores').get(),
    db.collection('subscriptions').get(),
    db.collection('plans').get(),
    db.collection('users').get(),
  ])

  const plans = new Map<string, any>()
  for (const d of plansSnap.docs) plans.set(d.id, d.data())

  const users = new Map<string, any>()
  for (const d of usersSnap.docs) {
    const u = d.data()
    users.set(u.uid || d.id, u)
  }

  // Keep only the latest subscription per store (by createdAt).
  const latestSub = new Map<string, { id: string; data: any }>()
  for (const d of subsSnap.docs) {
    const s = d.data()
    const existing = latestSub.get(s.storeId)
    if (!existing || (s.createdAt?.seconds || 0) >= (existing.data.createdAt?.seconds || 0)) {
      latestSub.set(s.storeId, { id: d.id, data: s })
    }
  }

  const rows = storesSnap.docs.map((d) => {
    const store = d.data()
    const storeId = d.id
    const subEntry = latestSub.get(storeId)
    const sub = subEntry?.data || null
    const plan = sub ? plans.get(sub.planId) : null
    const orderLimit = Number(plan?.orderLimitPerMonth || 0)
    const ordersUsed = Number(sub?.ordersUsed || 0)
    const remaining = orderLimit > 0 ? Math.max(0, orderLimit - ordersUsed) : null
    const usagePercent = orderLimit > 0 ? Math.min(100, Math.round((ordersUsed / orderLimit) * 100)) : 0

    let usageLevel: string = 'none'
    if (orderLimit > 0) {
      if (ordersUsed >= orderLimit) usageLevel = 'reached'
      else if (usagePercent >= 90) usageLevel = 'near'
      else if (usagePercent >= 80) usageLevel = 'approaching'
      else if (usagePercent >= 60) usageLevel = 'moderate'
      else usageLevel = 'normal'
    }

    const owner = store.ownerId ? users.get(store.ownerId) : null

    return {
      storeId,
      storeName: store.name || '—',
      ref: store.ref || '',
      slug: store.slug || '',
      active: !!store.active,
      published: !!store.published,
      createdAt: store.createdAt || null,
      ownerName: owner?.name || null,
      ownerEmail: owner?.email || null,
      ownerRole: owner?.role || null,
      subId: subEntry?.id || null,
      planId: sub?.planId || null,
      planName: plan?.name || sub?.planName || null,
      planPriceMonthly: Number(plan?.priceMonthly || 0),
      productLimit: Number(plan?.productLimit || 0),
      subStatus: sub?.status || null,
      subStartedAt: sub?.startedAt || null,
      subExpiresAt: sub?.expiresAt || null,
      orderLimit,
      ordersUsed,
      remaining,
      usagePercent,
      usageLevel,
    }
  })

  return { rows }
})

// ─────────────────────────────────────────────────────────────
// 5. updateOrderStatus — restore stock on CANCELLED/RETURNED
// ─────────────────────────────────────────────────────────────
export const updateOrderStatus = onCall(async (request: CallableRequest<{ orderId?: string; status?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { orderId, status } = request.data || {}
  if (!orderId || !status) throw new HttpsError('invalid-argument', 'orderId و status مطلوبان')

  const valid = ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']
  if (!valid.includes(status)) throw new HttpsError('invalid-argument', 'حالة غير صالحة')

  const orderRef = db.doc(`orders/${orderId}`)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود')
  const order = orderSnap.data()!

  const role = await getUserRole(request.auth.uid)
  if (role === 'superAdmin') {
    // ok
  } else {
    await assertStoreAccess(request, order.storeId, 'orders:manage')
  }

  const wasCancelled = ['CANCELLED', 'RETURNED'].includes(order.status)
  const becomesCancelled = ['CANCELLED', 'RETURNED'].includes(status)

  await db.runTransaction(async (tx) => {
    if (becomesCancelled && !wasCancelled) {
      for (const item of order.items || []) {
        const productRef = db.doc(`products/${item.productId}`)
        const productSnap = await tx.get(productRef)
        if (!productSnap.exists) continue
        const product = productSnap.data()!
        if (item.color && item.size && Array.isArray(product.variants)) {
          const variant = product.variants.find((v: any) => v.color === item.color && v.size === item.size)
          if (variant) {
            variant.stock = (variant.stock || 0) + item.quantity
            tx.update(productRef, { variants: product.variants })
          }
        }
        tx.update(productRef, { stock: FieldValue.increment(item.quantity) })
      }
    }
    tx.update(orderRef, { status, updatedAt: now() })
  })

  await bumpAnalytics(order.storeId, { totalPrice: order.totalPrice, status }).catch(() => {})

  await auditLog(order.storeId, request.auth.uid, 'update_order_status', 'orders', orderId, { from: order.status, to: status })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 6. impersonate — platform admin logs into a merchant session
// ─────────────────────────────────────────────────────────────
export const impersonate = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  await assertPlatformAdmin(request)
  const { storeId } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')
  const ownerId = storeSnap.data()!.ownerId

  const token = await auth.createCustomToken(ownerId)
  const expiry = tsFromDate(new Date(Date.now() + 15 * 60000))

  await db.doc(`users/${ownerId}`).update({
    impersonatedBy: request.auth!.uid,
    impersonatedUntil: expiry,
  })

  return { customToken: token, storeId }
})

// ─────────────────────────────────────────────────────────────
// 7. exitImpersonation — platform admin leaves a merchant session
// ─────────────────────────────────────────────────────────────
export const exitImpersonation = onCall(async (request: CallableRequest) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const snap = await db.doc(`users/${request.auth.uid}`).get()
  const user = snap.data()
  if (!user) throw new HttpsError('not-found', 'الحساب غير موجود')
  if (!user.impersonatedBy) {
    // nothing to exit — not an impersonated session
    return { ok: true }
  }
  const adminUid = user.impersonatedBy
  await db.doc(`users/${request.auth.uid}`).update({
    impersonatedBy: FieldValue.delete(),
    impersonatedUntil: FieldValue.delete(),
  })
  // Record the exit in the admin's audit trail
  await db.collection('auditLogs').add({
    storeId: null,
    userId: adminUid,
    action: 'impersonation_exited',
    resource: 'users',
    resourceId: request.auth.uid,
    createdAt: now(),
    createdBy: adminUid,
  })
  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 8. trackOrder — public order tracking by phone (+ optional number)
//    Returns only a safe subset of order fields. Never leaks
//    full customer data or other stores' orders.
// ─────────────────────────────────────────────────────────────
export const trackOrder = onCall(async (request: CallableRequest<{ storeId?: string; phone?: string; orderNumber?: string }>) => {
  const { storeId, phone, orderNumber } = request.data || {}
  if (!storeId || !phone) throw new HttpsError('invalid-argument', 'storeId و phone مطلوبان')
  if (!/^\d{9,15}$/.test(String(phone))) throw new HttpsError('invalid-argument', 'رقم هاتف غير صالح')

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود')
  }

  let query = db
    .collection('orders')
    .where('storeId', '==', storeId)
    .where('phone', '==', String(phone))

  if (orderNumber) {
    const normalized = String(orderNumber).trim().toLowerCase()
    if (!normalized.startsWith('ord-')) throw new HttpsError('invalid-argument', 'رقم طلب غير صالح')
    query = query.where('orderNumber', '==', normalized.toUpperCase())
  }

  const snap = await query.orderBy('createdAt', 'desc').limit(10).get()

  const orders = snap.docs.map((d) => {
    const o = d.data()
    return {
      id: d.id,
      orderNumber: o.orderNumber,
      status: o.status,
      items: Array.isArray(o.items) ? o.items.map((i: any) => ({ name: i.name, quantity: i.quantity })) : [],
      totalPrice: o.totalPrice || 0,
      paymentMethod: o.paymentMethod || 'cod',
      createdAt: o.createdAt,
    }
  })

  return { orders }
})

// ─────────────────────────────────────────────────────────────
// 9. recordStoreLinkVisit — count a visit on a sales link.
//    Validates the link belongs to the store. Clients should
//    throttle calls (per session) to avoid inflating counts.
// ─────────────────────────────────────────────────────────────
export const recordStoreLinkVisit = onCall(async (request: CallableRequest<{ storeId?: string; code?: string }>) => {  const { storeId, code } = request.data || {}
  if (!storeId || !code) throw new HttpsError('invalid-argument', 'storeId و code مطلوبان')

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود')
  }

  const linkQuery = await db
    .collection('storeLinks')
    .where('storeId', '==', storeId)
    .where('code', '==', String(code))
    .limit(1)
    .get()

  if (linkQuery.empty) {
    // Unknown code for this store — ignore silently (never leak link existence).
    return { ok: false }
  }

  await linkQuery.docs[0].ref.update({
    visits: FieldValue.increment(1),
    lastVisitAt: now(),
  })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 10. inviteStaff — provision a real staff login for a merchant tenant.
//     The owner (or a staff member with team:manage) invites a colleague.
//     This creates the Firebase Auth user + the users/{uid} doc (role 'staff')
//     with permissions copied from the chosen role, plus the team + invitation
//     records. Returns the one-time initial password for the merchant to pass
//     to the staff member out-of-band.
// ─────────────────────────────────────────────────────────────
export const inviteStaff = onCall(async (request: CallableRequest<{ storeId?: string; name?: string; email?: string; roleId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, name, email, roleId } = request.data || {}
  if (!storeId || !name || !email || !roleId) {
    throw new HttpsError('invalid-argument', 'بيانات الدعوة غير مكتملة')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'بريد إلكتروني غير صالح')
  }

  // Only the store owner (merchant) or a staff member holding team:manage.
  await assertStoreAccess(request, storeId, 'team:manage')

  // The chosen role must belong to this store.
  const roleSnap = await db.doc(`roles/${roleId}`).get()
  if (!roleSnap.exists || roleSnap.data()?.storeId !== storeId) {
    throw new HttpsError('not-found', 'الدور غير موجود')
  }
  const permissions = roleSnap.data()?.permissions || []

  // No account may already exist with this email.
  const existing = await db.collection('users').where('email', '==', String(email).toLowerCase()).get()
  if (!existing.empty) {
    throw new HttpsError('already-exists', 'هذا البريد مستخدم مسبقاً')
  }

  const uid = db.collection('users').doc().id
  const initialPassword = Math.random().toString(36).slice(2, 10)

  try {
    await auth.createUser({ uid, email, password: initialPassword, displayName: name, disabled: false })
  } catch (err: any) {
    if (err?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'هذا البريد مستخدم مسبقاً')
    }
    throw new HttpsError('internal', err?.message || 'تعذر إنشاء الحساب')
  }

  await db.doc(`users/${uid}`).set({
    uid,
    email,
    name,
    role: 'staff',
    storeIds: [storeId],
    active: true,
    permissions,
    createdBy: request.auth.uid,
    createdAt: now(),
    updatedAt: now(),
  })

  const teamId = db.collection('team').doc().id
  await db.doc(`team/${teamId}`).set({
    storeId,
    userId: uid,
    email,
    name,
    role: roleId,
    active: true,
    createdBy: request.auth.uid,
    createdAt: now(),
    updatedAt: now(),
  })

  const invitationId = db.collection('invitations').doc().id
  await db.doc(`invitations/${invitationId}`).set({
    storeId,
    email,
    role: roleId,
    token: Math.random().toString(36).slice(2, 12),
    status: 'accepted',
    invitedBy: request.auth.uid,
    createdAt: now(),
    updatedAt: now(),
  })

  await db.collection('notifications').add({
    storeId,
    userId: null,
    title: 'تمت إضافة موظف جديد',
    body: `تم إنشاء حساب الموظف ${name} بدور محدد. سلّم بيانات الدخول للموظف.`,
    type: 'team',
    read: false,
    createdBy: request.auth.uid,
    createdAt: now(),
  })

  await auditLog(storeId, request.auth.uid, 'invite_staff', 'users', uid, { email, role: roleId })

  return { uid, email, initialPassword }
})

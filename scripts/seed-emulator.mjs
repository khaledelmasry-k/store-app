// Dev-only seed for the Firebase local emulators.
// Run with emulators up:  firebase emulators:exec --project mk-store-app "node scripts/seed-emulator.mjs"
// Seeds plans, admin, and demo merchants in the local emulator. A clean
// emulator is naturally deterministic; an existing emulator is converged
// without deleting historical subscriptions. Set SEED_RESET=true only when a
// caller explicitly wants a disposable reset.
import admin from 'firebase-admin'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const envRaw = readFileSync(envPath, 'utf8')
const projectId = envRaw.match(/VITE_FIREBASE_PROJECT_ID=(\S+)/)?.[1] || 'mk-store-app'

admin.initializeApp({ projectId })
const db = admin.firestore()
const auth = admin.auth()
const ts = admin.firestore.FieldValue.serverTimestamp
const inc = admin.firestore.FieldValue.increment

// Emulator-only identities. Passwords are consumed by this seed script only;
// they are never written to Firestore or bundled into the application.
export const DEV_ACCOUNTS = Object.freeze({
  superAdmin: { uid: 'seed-admin', email: 'khaaledelmasry@gmail.com', password: 'Admin12345', name: 'مدير المنصة' },
  superAdminAlias: { uid: 'seed-admin-legacy', email: 'admin@mk.store', password: 'Admin12345', name: 'مدير المنصة (توافق محلي)' },
  merchant: { uid: 'seed-owner-malek', email: 'malek@test.com', password: 'Owner12345', name: 'مالك المتجر' },
  staff: { uid: 'seed-staff-a', email: 'staff@test.com', password: 'Staff12345', name: 'موظف المتجر' },
  customer: { uid: 'seed-customer', email: 'customer@test.com', password: 'Customer12345', name: 'عميل تجريبي' },
})

const COLLECTIONS = [
  'plans', 'users', 'stores', 'subscriptions', 'orders', 'products', 'customers',
  'analytics', 'transactions', 'payments', 'coupons', 'categories', 'storeLinks',
  'notifications', 'auditLogs', 'shipping', 'team', 'roles', 'invitations',
  'landingPages', 'subscriptionPayments', 'subscriptionChangeRequests', 'storePurchaseRequests', 'productCosts', 'orderCosts', 'publicStores',
  'shippingCompanies', 'shipments', 'shippingCompanyReviews',
]

async function wipe() {
  const list = await auth.listUsers()
  await Promise.all(list.users.map((u) => auth.deleteUser(u.uid).catch(() => {})))
  for (const col of COLLECTIONS) {
    const refs = await db.collection(col).listDocuments()
    for (const ref of refs) await ref.delete()
  }
}

async function createPlan(id, name, priceMonthly, productLimit, orderLimitPerMonth, description, features, opts = {}) {
  await db.collection('plans').doc(id).set({
    id,
    name,
    slug: opts.slug || id,
    billingModel: opts.billingModel === 'one_time' ? 'one_time' : 'subscription',
    oneTimePrice: opts.billingModel === 'one_time' ? Number(opts.oneTimePrice || 0) : 0,
    description,
    priceMonthly,
    priceYearly: opts.priceYearly ?? Math.round(priceMonthly * 10),
    trialDays: opts.trialDays ?? 3,
    launchPrice: opts.launchPrice ?? 0,
    launchEnabled: opts.launchEnabled ?? false,
    ...(opts.launchExpiresAt ? { launchExpiresAt: admin.firestore.Timestamp.fromDate(opts.launchExpiresAt) } : {}),
    productLimit,
    orderLimitPerMonth,
    landingPagesLimit: opts.landingPagesLimit ?? 1,
    salesLinksLimit: opts.salesLinksLimit ?? 2,
    staffLimit: opts.staffLimit ?? 1,
    storageLimit: opts.storageLimit ?? 500,
    isPopular: !!opts.isPopular,
    sortOrder: opts.sortOrder ?? 0,
    features,
    // Structured feature gates (Phase 6 model). Merged from opts so the same
    // key list drives both the backend enforcement and the admin toggles.
    quantityPricing: !!opts.quantityPricing,
    variantInventory: !!opts.variantInventory,
    coupons: !!opts.coupons,
    analytics: opts.analytics !== undefined ? !!opts.analytics : true,
    abandonedCart: false,
    advancedReports: false,
    customDomain: false,
    apiAccess: false,
    removeBranding: false,
    prioritySupport: false,
     storeLimit: opts.storeLimit ?? 1,
     unlimitedProducts: !!opts.unlimitedProducts,
     unlimitedSalesLinks: !!opts.unlimitedSalesLinks,
     active: opts.active !== false,
     isPurchasable: opts.isPurchasable !== false,
     archived: opts.archived === true,
     status: opts.status || (opts.archived ? 'archived' : 'active'),
    createdAt: ts(),
    updatedAt: ts(),
    createdBy: 'seed',
  })
}

async function createUser(uid, email, password, name, role, storeIds = [], active = true) {
  try {
    await auth.createUser({ uid, email, password, displayName: name, disabled: !active })
  } catch (e) {
    if (e.code !== 'auth/uid-already-exists') throw e
    await auth.updateUser(uid, { email, password, displayName: name, disabled: !active, emailVerified: true })
  }
  await auth.updateUser(uid, { email, displayName: name, disabled: !active, emailVerified: true }).catch(() => {})
  await db.collection('users').doc(uid).set({
    uid, email, name, role, storeIds, active,
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  }, { merge: true })
  return uid
}

async function ensureMalekIdentity(password = DEV_ACCOUNTS.merchant.password) {
  const canonicalUid = DEV_ACCOUNTS.merchant.uid
  let byEmail = null
  try { byEmail = await auth.getUserByEmail(DEV_ACCOUNTS.merchant.email) } catch (e) { if (e.code !== 'auth/user-not-found') throw e }
  let byUid = null
  try { byUid = await auth.getUser(canonicalUid) } catch (e) { if (e.code !== 'auth/user-not-found') throw e }
  const uid = byEmail?.uid || byUid?.uid || canonicalUid
  if (byEmail && byUid && byEmail.uid !== byUid.uid) {
    await auth.deleteUser(byUid.uid).catch(() => {})
    await db.collection('users').doc(byUid.uid).delete().catch(() => {})
  }
  await createUser(uid, DEV_ACCOUNTS.merchant.email, password, DEV_ACCOUNTS.merchant.name, 'merchant', ['malek-store'], true)
  return uid
}

async function ensureIdentity(account, role, storeIds = [], active = true) {
  let byEmail = null
  try { byEmail = await auth.getUserByEmail(account.email) } catch (e) { if (e.code !== 'auth/user-not-found') throw e }
  let byUid = null
  try { byUid = await auth.getUser(account.uid) } catch (e) { if (e.code !== 'auth/user-not-found') throw e }
  const uid = byEmail?.uid || byUid?.uid || account.uid
  if (byEmail && byUid && byEmail.uid !== byUid.uid) {
    await auth.deleteUser(byUid.uid).catch(() => {})
    await db.collection('users').doc(byUid.uid).delete().catch(() => {})
  }
  await createUser(uid, account.email, account.password, account.name, role, storeIds, active)
  return uid
}

async function createStore(storeId, ref, name, ownerId, opts = {}) {
  await db.collection('stores').doc(storeId).set({
    ref,
    name,
    slug: ref,
    active: opts.active ?? true,
    isTestMerchant: opts.isTestMerchant === true,
    published: !!opts.published,
    ownerId,
    currency: 'EGP',
    description: opts.description || '',
    theme: { primary: opts.primary || '#6366f1', secondary: opts.secondary || '#f59e0b', darkMode: false },
    logo: opts.logo || null,
    heroImage: opts.heroImage || null,
    seoTitle: opts.seoTitle || name,
    seoDescription: opts.seoDescription || opts.description || '',
    storageUsed: 0,
    storageLimitBytes: opts.storageLimitBytes || 0,
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
}

async function createSubscription(storeId, planId, status, opts = {}) {
  const existing = await db.collection('subscriptions').where('storeId', '==', storeId).get()
  const existingDoc = existing.docs.find((d) => d.data()?.planId === planId && d.data()?.status === status)
  if (existingDoc) {
    const existingId = existingDoc.id
    if (status === 'active' || status === 'trialing') {
      await db.collection('stores').doc(storeId).set({ activeSubscriptionId: existingId, updatedAt: ts() }, { merge: true })
    }
    return existingId
  }
  const sub = {
    storeId,
    planId,
    planName: opts.planName || planId,
    status,
    billingCycle: opts.billingCycle || 'monthly',
    requestNote: 'بيانات تجريبية',
    ordersUsed: opts.ordersUsed || 0,
    periodNumber: opts.periodNumber ?? 0,
    createdAt: opts.createdAt ? admin.firestore.Timestamp.fromDate(opts.createdAt) : ts(),
    updatedAt: ts(),
    createdBy: 'seed',
  }
  if (opts.startedAt) sub.startedAt = admin.firestore.Timestamp.fromDate(opts.startedAt)
  if (opts.expiresAt) sub.expiresAt = admin.firestore.Timestamp.fromDate(opts.expiresAt)
  if (opts.trialStartedAt) sub.trialStartedAt = admin.firestore.Timestamp.fromDate(opts.trialStartedAt)
  if (opts.trialEndsAt) sub.trialEndsAt = admin.firestore.Timestamp.fromDate(opts.trialEndsAt)
  if (opts.currentPeriodStart) sub.currentPeriodStart = admin.firestore.Timestamp.fromDate(opts.currentPeriodStart)
  if (opts.currentPeriodEnd) sub.currentPeriodEnd = admin.firestore.Timestamp.fromDate(opts.currentPeriodEnd)
  if (opts.activatedAt) sub.activatedAt = admin.firestore.Timestamp.fromDate(opts.activatedAt)
  if (opts.approvedBy) sub.approvedBy = opts.approvedBy
  if (opts.normalPriceSnapshot != null) sub.normalPriceSnapshot = opts.normalPriceSnapshot
  if (opts.launchPriceSnapshot != null) sub.launchPriceSnapshot = opts.launchPriceSnapshot
  if (opts.yearlyPriceSnapshot != null) sub.yearlyPriceSnapshot = opts.yearlyPriceSnapshot
  if (opts.launchUsed != null) sub.launchUsed = opts.launchUsed
  const ref = await db.collection('subscriptions').add(sub)
  if (status === 'active' || status === 'trialing') {
    await db.collection('stores').doc(storeId).set({ activeSubscriptionId: ref.id, updatedAt: ts() }, { merge: true })
  }
  return ref.id
}

function publicStoreData(data) {
  return {
    name: data.name || '', slug: data.slug || '', logo: data.logo || null,
    hero: data.hero || null, heroImage: data.heroImage || null,
    description: data.description || '', seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null, theme: data.theme || {},
    currency: data.currency || 'EGP', phone: data.publicPhone || data.phone || null,
    published: data.published === true, active: data.active !== false, updatedAt: ts(),
  }
}

async function rebuildPublicProjections() {
  const stores = await db.collection('stores').get()
  for (const storeDoc of stores.docs) {
    const store = storeDoc.data()
    await db.doc(`publicStores/${storeDoc.id}`).set(publicStoreData(store), { merge: true })
    const products = await db.collection('products').where('storeId', '==', storeDoc.id).get()
    for (const productDoc of products.docs) {
      const p = productDoc.data()
      const ref = db.doc(`publicStores/${storeDoc.id}/products/${productDoc.id}`)
      if (p.active !== true) await ref.delete()
      else await ref.set({
        storeId: storeDoc.id, name: p.name || '', description: p.description || '', images: p.images || [],
        price: Number(p.price || 0), oldPrice: p.oldPrice == null ? null : Number(p.oldPrice), stock: Number(p.stock || 0), active: true,
        featured: p.featured === true, categoryId: p.categoryId || null,
        variants: (p.variants || []).map((v) => ({ id: v.id, ...(v.color == null ? {} : { color: v.color }), ...(v.size == null ? {} : { size: v.size }), stock: Number(v.stock || 0), ...(v.price == null ? {} : { price: v.price }) })),
        colors: p.colors || [], sizes: p.sizes || [], colorOptions: p.colorOptions || [],
        pricingMode: p.pricingMode || 'unit', quantityTiers: p.quantityTiers || [],
        quantityPricingStrategy: p.quantityPricingStrategy || 'cap', updatedAt: ts(),
      }, { merge: true })
    }
    const categories = await db.collection('categories').where('storeId', '==', storeDoc.id).get()
    for (const categoryDoc of categories.docs) {
      const c = categoryDoc.data()
      const ref = db.doc(`publicStores/${storeDoc.id}/categories/${categoryDoc.id}`)
      if (c.active === false) await ref.delete()
      else await ref.set({ storeId: storeDoc.id, name: c.name || '', image: c.image || null, active: true, sortOrder: Number(c.sortOrder || c.order || 0), updatedAt: ts() }, { merge: true })
    }
  }
}

async function createCategory(storeId, name, slug, order) {
  const ref = await db.collection('categories').add({
    storeId, name, slug, order, active: true, createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
  return ref.id
}

async function createProduct(storeId, categoryId, name, price, stock, description = '', extra = {}) {
  const ref = await db.collection('products').doc()
  await ref.set({
    id: ref.id,
    storeId, categoryId,
    name, price, description,
    images: [],
    stock,
    variants: [],
    colors: [],
    sizes: [],
    active: true,
    featured: false,
    lowStockThreshold: 5,
    ...extra,
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
  return ref.id
}

async function createProductCost(storeId, productId, costPrice) {
  await db.collection('productCosts').doc(productId).set({
    id: productId,
    storeId,
    costPrice,
    updatedAt: ts(),
    updatedBy: 'seed',
  })
}

async function createOrder(storeId, counterId, orderNumber, productId, customerName, phone, price, status, daysAgo, opts = {}) {
  const createdAt = new Date(Date.now() - daysAgo * 86400000)
  const quantity = opts.quantity || 1
  const lineId = `${productId}-${opts.variantId || ''}-${quantity}`
  const lineTotal = opts.lineTotal ?? price * quantity
  const item = {
    id: lineId,
    productId,
    name: opts.productName || productId,
    price,
    quantity,
    lineTotal,
    ...(opts.pricingMode ? { pricingMode: opts.pricingMode } : {}),
    ...(opts.quantityTiers ? { quantityTiers: opts.quantityTiers } : {}),
    ...(opts.quantityTier ? { quantityTier: opts.quantityTier } : {}),
    ...(opts.quantityPricingStrategy ? { quantityPricingStrategy: opts.quantityPricingStrategy } : {}),
  }
  const ref = await db.collection('orders').add({
    storeId,
    orderNumber,
    customerName,
    phone,
    governorate: 'القاهرة',
    city: 'مدينة نصر',
    address: 'شارع رئيسي ١٢',
    notes: null,
    customerId: null,
    items: [item],
    subtotal: lineTotal,
    shippingFee: 0,
    discount: 0,
    totalPrice: lineTotal,
    status,
    paymentMethod: 'cod',
    couponCode: null,
    trackingCode: null,
    salesLinkRef: null,
    salesLinkId: null,
    salesLinkStaffId: null,
    createdAt: admin.firestore.Timestamp.fromDate(createdAt),
    updatedAt: admin.firestore.Timestamp.fromDate(createdAt),
    createdBy: 'seed',
  })
  if (typeof opts.costPrice === 'number') {
    await db.collection('orderCosts').doc(ref.id).set({
      id: ref.id,
      storeId,
      orderId: ref.id,
      items: [{ lineId, productId, costPrice: opts.costPrice, quantity }],
      createdAt: admin.firestore.Timestamp.fromDate(createdAt),
      createdBy: 'seed',
    })
  }
  await db.doc(`stores/${storeId}/counters/orders`).set({ value: inc(1) }, { merge: true })
  return ref
}

async function createCustomer(storeId, name, phone, totalOrders, totalSpent) {
  await db.collection('customers').add({
    storeId, name, phone, segment: null, note: null,
    totalOrders, totalSpent,
    lastOrderAt: ts(),
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
}

async function seedAnalytics(storeId, perDayOrders, perDayRevenue, days = 14) {
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const orders = Math.round(perDayOrders * (1 + (i % 3) * 0.4))
    const revenue = Math.round(perDayRevenue * (1 + (i % 3) * 0.4))
    await db.doc(`analytics/${storeId}_${key}`).set({
      storeId, date: key, orders, revenue,
      newCustomers: Math.max(1, Math.round(orders / 2)),
      byStatus: { NEW: Math.max(0, Math.round(orders * 0.3)), DELIVERED: Math.max(0, Math.round(orders * 0.5)), SHIPPED: Math.max(0, orders - Math.round(orders * 0.8)) },
      updatedAt: ts(),
    })
  }
}

async function createShipping(storeId, name, governorates, fee, opts = {}) {
  const ref = await db.collection('shipping').add({
    storeId,
    name,
    governorates,
    fee,
    freeAbove: opts.freeAbove || undefined,
    estimatedDays: opts.estimatedDays || '3-5 أيام',
    providerId: opts.providerId || '',
    active: opts.active ?? true,
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
  return ref.id
}

async function main() {
  console.log(`Seeding project "${projectId}" (emulator)...`)
  if (process.env.SEED_RESET === 'true') {
    await wipe()
    console.log('Wiped existing data (explicit SEED_RESET=true).')
  } else {
    console.log('Preserving existing emulator data and historical subscriptions.')
  }

  // Plans — the Matjari catalog (Egyptian EGP, recurring + one-time). Prices/limits are
  // the single source of truth; 0 product/salesLinks limits = unlimited (handled via
  // the explicit unlimitedProducts/unlimitedSalesLinks flags below). Storage is in MB.
  // Feature flags gate only implemented capabilities; unimplemented legacy flags
  // are explicitly reset to false by createPlan below.
  await createPlan('plan-free', 'FREE', 0, 50, 50, 'شهر مجاني واحد لتجربة تشغيل متجرك قبل اختيار باقة مدفوعة', ['متجر إلكتروني', 'إدارة المنتجات', 'الطلبات', 'العملاء', 'لوحة تحكم', 'تخصيص أساسي', 'تحليلات أساسية'], { billingModel: 'subscription', oneTimePrice: 0, priceYearly: 0, trialDays: 30, landingPagesLimit: 0, salesLinksLimit: 0, staffLimit: 1, storageLimit: 200, slug: 'free', sortOrder: 0, unlimitedProducts: false, unlimitedSalesLinks: false, analytics: true })
  await createPlan('plan-starter', 'STARTER', 499, 500, 300, 'للمتاجر التي بدأت البيع وتحتاج أدوات تسويق أساسية', ['كل مزايا Free', 'كوبونات', 'روابط بيع', 'صفحة هبوط واحدة', 'تخصيص المتجر', 'تنبيهات المخزون'], { priceYearly: 4990, trialDays: 0, launchPrice: 0, launchEnabled: false, landingPagesLimit: 1, salesLinksLimit: 10, staffLimit: 3, storageLimit: 1024, slug: 'starter', sortOrder: 1, unlimitedProducts: false, unlimitedSalesLinks: false, variantInventory: true, coupons: true, analytics: true })
  await createPlan('plan-growth', 'GROWTH', 799, 2000, 1500, 'للمتاجر النامية التي تحتاج أدوات تشغيل أوسع', ['كل مزايا Starter', 'تسعير بالكمية', 'حدود تشغيل أعلى', 'صفحات هبوط متعددة', 'روابط بيع موسعة'], { priceYearly: 7990, trialDays: 0, launchPrice: 0, launchEnabled: false, landingPagesLimit: 5, salesLinksLimit: 50, staffLimit: 10, storageLimit: 5120, slug: 'growth', isPopular: true, sortOrder: 2, unlimitedProducts: false, unlimitedSalesLinks: false, quantityPricing: true, variantInventory: true, coupons: true, analytics: true })
  await createPlan('plan-business', 'BUSINESS', 1099, 5000, 3500, 'باقة تاريخية محفوظة للتوافق مع الاشتراكات القائمة', ['كل مزايا Growth', 'فريق أكبر', 'حدود تشغيل أكبر', 'تخزين موسع', 'أدوات تشغيل متقدمة'], { priceYearly: 10990, trialDays: 0, launchPrice: 0, launchEnabled: false, landingPagesLimit: 10, salesLinksLimit: 100, staffLimit: 20, storageLimit: 10240, slug: 'business', sortOrder: 90, active: false, isPurchasable: false, archived: true, status: 'archived', unlimitedProducts: false, unlimitedSalesLinks: false, quantityPricing: true, variantInventory: true, coupons: true, analytics: true })
  await createPlan('plan-pro', 'PRO', 1299, 0, 10000, 'للمتاجر الكبيرة التي تحتاج حدوداً أعلى', ['كل مزايا Growth', 'أعلى حدود استخدام', 'منتجات غير محدودة', 'روابط بيع غير محدودة'], { priceYearly: 12990, trialDays: 0, launchPrice: 0, launchEnabled: false, landingPagesLimit: 20, salesLinksLimit: 0, staffLimit: 50, storageLimit: 20480, slug: 'pro', sortOrder: 3, unlimitedProducts: true, unlimitedSalesLinks: true, quantityPricing: true, variantInventory: true, coupons: true, analytics: true })
  await createPlan('plan-lifetime', 'LIFETIME', 0, 1000, 5000, 'ملكية أساسية للمتجر بدفعة واحدة، بحدود واضحة', ['ملكية أساسية غير منتهية', 'واجهة متجر', 'إدارة المنتجات والطلبات', 'كوبونات', 'تحليلات أساسية'], { billingModel: 'one_time', oneTimePrice: 4999, priceMonthly: 0, priceYearly: 0, landingPagesLimit: 3, salesLinksLimit: 50, staffLimit: 5, storageLimit: 5120, slug: 'lifetime', sortOrder: 5, unlimitedProducts: false, unlimitedSalesLinks: false, variantInventory: true, coupons: true, analytics: true, trialDays: 0 })
  await createPlan('plan-pro-legacy-1500', 'PRO (Legacy)', 1500, 0, 10000, 'لقطة تاريخية للاشتراكات القديمة — غير متاحة للشراء', ['اشتراك تاريخي'], { priceYearly: 15000, slug: 'pro-legacy-1500', sortOrder: 99, active: false, isPurchasable: false, archived: true, status: 'archived', unlimitedProducts: true, unlimitedSalesLinks: true })

  // Platform admin
  const adminUid = await ensureIdentity(DEV_ACCOUNTS.superAdmin, 'superAdmin', [])
  await ensureIdentity(DEV_ACCOUNTS.superAdminAlias, 'superAdmin', [])
  const staffUid = await ensureIdentity(DEV_ACCOUNTS.staff, 'staff', ['store-a'])
  await db.collection('users').doc(staffUid).set({ permissions: ['products:view', 'orders:view', 'customers:view'], updatedAt: ts() }, { merge: true })
  await ensureIdentity(DEV_ACCOUNTS.customer, 'customer', [])

  // Store A — TEST active growth plan, published, moderate usage
  const aUid = 'seed-owner-a'
  await createUser(aUid, 'owner@a.store', 'Owner12345', 'TEST Owner A', 'merchant', ['store-a'])
  await createStore('store-a', 'test-store-a', 'TEST - متجر اختبار A', aUid, {
    isTestMerchant: true,
    published: true,
    primary: '#16a34a',
    secondary: '#f59e0b',
    storageLimitBytes: 5 * 1024 * 1024 * 1024,
    description: 'متجر اختبار محلي للتحقق من واجهة المتجر والطلبات والتسعير الكمي.',
    seoTitle: 'TEST - متجر اختبار A',
    seoDescription: 'بيانات اختبار محلية فقط للتحقق من واجهة M&K Store.',
  })
  await db.collection('stores').doc('store-a').update({
    shipping: {
      enabled: true,
      model: 'zones',
      flatFee: 0,
      freeAbove: 800,
      refusedPolicy: 'في حالة رفض الاستلام يتم تحميل العميل رسوم شحن ذهاب وإياب بقيمة ٦٠ جنيهاً.',
      providers: [
        { id: 'p-bosta', name: 'بوستة', fee: 35, estimatedDays: '2-4 أيام', active: true },
        { id: 'p-aramex', name: 'أرامكس', fee: 45, estimatedDays: '1-3 أيام', active: false },
      ],
    },
  })
  await createShipping('store-a', 'القاهرة الكبرى', ['القاهرة', 'الجيزة', 'القليوبية'], 40, { freeAbove: 800 })
  await createShipping('store-a', 'الإسكندرية والساحل', ['الإسكندرية', 'مطروح'], 50, { freeAbove: 800 })
  await createShipping('store-a', 'بقية المحافظات', ['الدقهلية', 'الشرقية', 'الغربية', 'المنوفية', 'كفر الشيخ', 'البحيرة', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'شمال سيناء', 'جنوب سيناء'], 70, { freeAbove: 800 })
  await createSubscription('store-a', 'plan-growth', 'active', {
    planName: 'النمو',
    startedAt: new Date(Date.now() - 12 * 86400000),
    expiresAt: new Date(Date.now() + 18 * 86400000),
    currentPeriodStart: new Date(Date.now() - 12 * 86400000),
    currentPeriodEnd: new Date(Date.now() + 18 * 86400000),
    activatedAt: new Date(Date.now() - 12 * 86400000),
    approvedBy: adminUid,
     ordersUsed: 1020,
     periodNumber: 1,
     normalPriceSnapshot: 749,
     launchPriceSnapshot: 749,
     yearlyPriceSnapshot: 7490,
     launchUsed: false,
   })
  const teaCat = await createCategory('store-a', 'شاي', 'tea', 1)
  const coffeeCat = await createCategory('store-a', 'قهوة', 'coffee', 2)
  const p1 = await createProduct('store-a', teaCat, 'شاي صيني ممتاز', 180, 40, 'شاي أخضر فاخر')
  const p2 = await createProduct('store-a', coffeeCat, 'قهوة مختصة', 320, 25, 'حبوب محمصة طازجة')
  const p3 = await createProduct('store-a', teaCat, 'أدوات تحضير الشاي', 150, 60, 'إبريق زجاجي ومصفاة')
  // Bundle-priced product: 1/2/3/4 pieces at a TOTAL package price (500/900/1200/1400).
  const p4 = await createProduct('store-a', teaCat, 'علبة هدايا شاي فاخرة', 500, 40, 'باقة شاي منوّعة في علبة هدايا', {
    pricingMode: 'quantity',
    quantityTiers: [
      { quantity: 1, price: 500 },
      { quantity: 2, price: 900 },
      { quantity: 3, price: 1200 },
      { quantity: 4, price: 1400 },
    ],
  })
  await createProductCost('store-a', p1, 92)
  await createProductCost('store-a', p2, 185)
  await createProductCost('store-a', p3, 80)
  await createProductCost('store-a', p4, 310)
  await createOrder('store-a', 'store-a', 'ORD-00001', p1, 'أحمد حسن', '01000000001', 180, 'DELIVERED', 8, { productName: 'شاي صيني ممتاز', costPrice: 92 })
  await createOrder('store-a', 'store-a', 'ORD-00002', p2, 'سارة أحمد', '01000000002', 320, 'DELIVERED', 5, { productName: 'قهوة مختصة', costPrice: 185 })
  await createOrder('store-a', 'store-a', 'ORD-00003', p3, 'خالد محمود', '01000000003', 150, 'SHIPPED', 3, { productName: 'أدوات تحضير الشاي', costPrice: 80 })
  await createOrder('store-a', 'store-a', 'ORD-00004', p2, 'منى خليل', '01000000004', 320, 'NEW', 1, { productName: 'قهوة مختصة', costPrice: 185 })
  await createOrder('store-a', 'store-a', 'ORD-00005', p1, 'يوسف إبراهيم', '01000000005', 180, 'CANCELLED', 2, { productName: 'شاي صيني ممتاز', costPrice: 92 })
  await createOrder('store-a', 'store-a', 'ORD-00006', p4, 'هبة سمير', '01000000006', 500, 'DELIVERED', 1, {
    productName: 'علبة هدايا شاي فاخرة',
    quantity: 3,
    lineTotal: 1200,
    pricingMode: 'quantity',
    quantityTiers: [
      { quantity: 1, price: 500 },
      { quantity: 2, price: 900 },
      { quantity: 3, price: 1200 },
      { quantity: 4, price: 1400 },
    ],
    quantityTier: { quantity: 3, price: 1200 },
    quantityPricingStrategy: 'cap',
    costPrice: 310,
  })

  // Platform carrier fixture used to exercise the real list → detail → order
  // shipping flow in the local emulator. This uses the existing
  // ShippingCompany/Shipment models and is idempotent.
  const carrierId = 'carrier-bosta-local'
  await db.collection('shippingCompanies').doc(carrierId).set({
    id: carrierId,
    name: 'بوستة للشحن',
    status: 'active',
    zones: ['القاهرة الكبرى', 'الإسكندرية والساحل'],
    ratesByZone: {
      'القاهرة الكبرى': { deliveryPrice: 40, returnPrice: 20, codFee: 5, additionalFees: 0, estimatedDays: '2-4 أيام' },
      'الإسكندرية والساحل': { deliveryPrice: 50, returnPrice: 25, codFee: 5, additionalFees: 0, estimatedDays: '2-5 أيام' },
    },
    services: ['COD', 'تتبع الشحنة'],
    averageRating: 4.6,
    reviewsCount: 1,
    completedShipments: 1,
    deliverySuccessRate: 1,
    createdAt: ts(),
    updatedAt: ts(),
    createdBy: 'seed',
  }, { merge: true })
  const carrierOrder = (await db.collection('orders').where('storeId', '==', 'store-a').where('orderNumber', '==', 'ORD-00003').limit(1).get()).docs[0]
  if (carrierOrder) {
    await db.collection('shipments').doc(`shipment-${carrierOrder.id}`).set({
      id: `shipment-${carrierOrder.id}`,
      storeId: 'store-a',
      orderId: carrierOrder.id,
      active: true,
      status: 'SHIPPED',
      shippingCompanyId: carrierId,
      shippingCompanyName: 'بوستة للشحن',
      trackingNumber: 'BOSTA-LOCAL-0003',
      customerShippingFee: 40,
      carrierShippingCost: 40,
      priceSnapshot: {
        shippingCompanyId: carrierId,
        shippingCompanyName: 'بوستة للشحن',
        zoneId: 'القاهرة الكبرى',
        deliveryPrice: 40,
        returnPrice: 20,
        codFee: 5,
        additionalFees: 0,
        quotedAt: admin.firestore.Timestamp.fromDate(new Date()),
      },
      createdAt: ts(),
      updatedAt: ts(),
      createdBy: 'seed',
    }, { merge: true })
  }
  await createCustomer('store-a', 'أحمد حسن', '01000000001', 3, 640)
  await createCustomer('store-a', 'سارة أحمد', '01000000002', 2, 470)
  await createCustomer('store-a', 'منى خليل', '01000000004', 1, 320)
  await seedAnalytics('store-a', 6, 1200)

  // Sales links for store A — one to home, one to a product.
  await db.collection('storeLinks').add({
    storeId: 'store-a',
    code: 'ahmed',
    name: 'رابط أحمد',
    title: 'رابط أحمد',
    sellerName: 'أحمد',
    destinationType: 'home',
    destinationId: null,
    source: 'facebook',
    campaign: 'حملة رمضان',
    content: 'ad-1',
    active: true,
    archived: false,
    visits: 42,
    ordersCount: 3,
    totalRevenue: 540,
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
  await db.collection('storeLinks').add({
    storeId: 'store-a',
    code: 'teashop',
    name: 'رابط منتج الشاي',
    title: 'رابط منتج الشاي',
    sellerName: 'منى',
    destinationType: 'product',
    destinationId: p1,
    source: 'instagram',
    campaign: '',
    content: '',
    active: true,
    archived: false,
    visits: 18,
    ordersCount: 1,
    totalRevenue: 180,
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })

  // Landing pages for store A.
  await db.collection('landingPages').add({
    storeId: 'store-a',
    slug: 'tea-ramadan',
    title: 'عرض رمضان — شاي وقهوة',
    template: 'modern',
    status: 'published',
    active: true,
    productId: p1,
    hero: {
      title: 'تخفيضات رمضان على الشاي والقهوة',
      subtitle: 'تشكيلة مختارة من أجود أنواع الشاي بأسعار خاصة لفترة محدودة.',
      image: '',
      ctaText: 'اطلب الآن',
    },
    seo: { title: 'TEST - صفحة هبوط متجر اختبار A', description: 'صفحة هبوط اختبارية محلية فقط' },
    sections: [
      {
        type: 'features',
        title: 'لماذا تختارنا؟',
        body: '',
        items: [
          { title: 'جودة فاخرة', body: 'منتجات مختارة بعناية من أفضل الموردين' },
          { title: 'توصيل سريع', body: 'نوصل لجميع المحافظات خلال أيام قليلة' },
          { title: 'دفع عند الاستلام', body: 'ادفع بسهولة عند استلام طلبك' },
        ],
      },
      {
        type: 'steps',
        title: 'كيف تطلب؟',
        body: '',
        items: [
          { title: 'اختر الكمية', body: 'حدد عدد العلب التي تريدها' },
          { title: 'أدخل بياناتك', body: 'الاسم ورقم الهاتف والعنوان' },
          { title: 'استلم طلبك', body: 'ادفع عند الاستلام وتمتع بطلبك' },
        ],
      },
      {
        type: 'faq',
        title: 'أسئلة شائعة',
        body: '',
        items: [
          { title: 'هل الدفع عند الاستلام متاح؟', body: 'نعم، الدفع عند الاستلام متاح لجميع المحافظات.' },
          { title: 'كم تستغرق مدة التوصيل؟', body: 'من 2 إلى 4 أيام حسب المحافظة.' },
        ],
      },
    ],
    views: 128,
    ordersCount: 4,
    totalRevenue: 720,
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
  await db.collection('landingPages').add({
    storeId: 'store-a',
    slug: 'coffee-coming-soon',
    title: 'قهوة مختصة — قريباً',
    template: 'beauty',
    status: 'draft',
    active: true,
    productId: p2,
    hero: {
      title: 'قهوة مختصة',
      subtitle: 'صفحة قيد الإعداد للقهوة المختصة.',
      image: '',
      ctaText: 'اشترك الآن',
    },
    sections: [],
    views: 0,
    ordersCount: 0,
    totalRevenue: 0,
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })

  // Store B — TEST active starter plan, published, near limit
  const bUid = 'seed-owner-b'
  await createUser(bUid, 'owner@b.store', 'Owner12345', 'TEST Owner B', 'merchant', ['store-b'])
  await createStore('store-b', 'test-store-b', 'TEST - متجر اختبار B', bUid, {
    isTestMerchant: true,
    published: true,
    primary: '#0284c7',
    secondary: '#f43f5e',
    storageLimitBytes: 1 * 1024 * 1024 * 1024,
    description: 'متجر اختبار محلي قريب من حدود الخطة.',
  })
  await db.collection('stores').doc('store-b').update({
    shipping: {
      enabled: true,
      model: 'flat',
      flatFee: 30,
      freeAbove: 0,
      refusedPolicy: '',
      providers: [],
    },
  })
  await createSubscription('store-b', 'plan-starter', 'active', {
    planName: 'البداية',
    startedAt: new Date(Date.now() - 20 * 86400000),
    expiresAt: new Date(Date.now() + 10 * 86400000),
    currentPeriodStart: new Date(Date.now() - 20 * 86400000),
    currentPeriodEnd: new Date(Date.now() + 10 * 86400000),
    activatedAt: new Date(Date.now() - 20 * 86400000),
    approvedBy: adminUid,
     ordersUsed: 276,
     periodNumber: 2,
     normalPriceSnapshot: 399,
     launchPriceSnapshot: 399,
     yearlyPriceSnapshot: 3990,
     launchUsed: false,
   })
  const shoesCat = await createCategory('store-b', 'أحذية', 'shoes', 1)
  const sp1 = await createProduct('store-b', shoesCat, 'حذاء رياضي', 550, 20, 'مقاسات متعددة')
  const sp2 = await createProduct('store-b', shoesCat, 'حذاء رسمي', 720, 12, 'جلد طبيعي')
  await createProductCost('store-b', sp1, 340)
  await createProductCost('store-b', sp2, 470)
  await createOrder('store-b', 'store-b', 'ORD-00001', sp1, 'ليلى سالم', '01000000010', 550, 'PROCESSING', 1, { productName: 'حذاء رياضي', costPrice: 340 })
  await createOrder('store-b', 'store-b', 'ORD-00002', sp2, 'عمر فاروق', '01000000011', 720, 'NEW', 0, { productName: 'حذاء رسمي', costPrice: 470 })
  await seedAnalytics('store-b', 3, 1500)

  // Store C — TEST trialing (instant self-serve trial), with a pending activation request
  const cUid = 'seed-owner-c'
  await createUser(cUid, 'owner@c.store', 'Owner12345', 'TEST Owner C', 'merchant', ['store-c'])
  await createStore('store-c', 'test-store-c', 'TEST - متجر اختبار C', cUid, { published: true, isTestMerchant: true })
  const cSubId = await createSubscription('store-c', 'plan-starter', 'trialing', {
    planName: 'البداية',
    trialStartedAt: new Date(Date.now() - 2 * 86400000),
    trialEndsAt: new Date(Date.now() + 1 * 86400000),
    startedAt: new Date(Date.now() - 2 * 86400000),
    expiresAt: new Date(Date.now() + 1 * 86400000),
    normalPriceSnapshot: 399,
    launchPriceSnapshot: 399,
    yearlyPriceSnapshot: 3990,
    ordersUsed: 5,
  })
  // Keep the trial activation request deterministic across converging seed
  // runs. Using add() here created a new document every time while reusing the
  // same embedded id, which produced duplicate rows and unstable UI keys.
  await db.collection('subscriptionPayments').doc('seed-pay-c1').set({
    id: 'seed-pay-c1',
    subscriptionId: cSubId,
    storeId: 'store-c',
    planId: 'plan-starter',
    planName: 'البداية',
    amount: 349,
    paymentMethod: 'فودافون كاش',
    reference: '487221900123',
    note: 'تحويل أول شهر بالخطة الحالية',
    screenshotUrl: null,
    status: 'pending',
    periodNumber: 1,
    createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    createdBy: cUid,
  }, { merge: true })

  // Store D — TEST trial expired (data preserved, storefront gated)
  const dUid = 'seed-owner-d'
  await createUser(dUid, 'owner@d.store', 'Owner12345', 'TEST Owner D', 'merchant', ['store-d'])
  await createStore('store-d', 'test-store-d', 'TEST - متجر اختبار D', dUid, { published: true, isTestMerchant: true })
  await createSubscription('store-d', 'plan-pro', 'expired', {
    planName: 'الاحتراف',
    trialStartedAt: new Date(Date.now() - 12 * 86400000),
    trialEndsAt: new Date(Date.now() - 4 * 86400000),
    startedAt: new Date(Date.now() - 12 * 86400000),
    expiresAt: new Date(Date.now() - 4 * 86400000),
    normalPriceSnapshot: 1499,
    launchPriceSnapshot: 1499,
    yearlyPriceSnapshot: 14990,
    ordersUsed: 40,
  })

  // Store E — TEST legacy pending subscription (admin-approval flow still supported)
  const eUid = 'seed-owner-e'
  await createUser(eUid, 'owner@e.store', 'Owner12345', 'TEST Owner E', 'merchant', ['store-e'])
  await createStore('store-e', 'test-store-e', 'TEST - متجر اختبار E', eUid, { published: false, isTestMerchant: true })
  await createSubscription('store-e', 'plan-starter', 'pending', { planName: 'البداية' })

  // Store F — published, active, WITH a logo and a hero image. Used by the
  // branding E2E tests: header must show the logo only (no duplicated name),
  // footer an independent larger logo, and the hero renders the uploaded image
  // without the generated overlay/CTA.
  const fUid = 'seed-owner-f'
  await createUser(fUid, 'owner@f.store', 'Owner12345', 'TEST Owner F', 'merchant', ['store-f'])
  await createStore('store-f', 'test-logo-store', 'TEST - متجر لوجو', fUid, {
    isTestMerchant: true,
    published: true,
    primary: '#0d9488',
    secondary: '#f97316',
    storageLimitBytes: 1 * 1024 * 1024 * 1024,
    description: 'متجر تجريبي للتحقق من عرض اللوجو في الهيدر والفوتر.',
    logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGMQW+z1Hx9mGBkKAPqXgIF3auCpAAAAAElFTkSuQmCC',
    heroImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAkCAYAAAA5DDySAAAAY0lEQVR4nO3QMQ0AIBDAwPdKgn8UgIwb6HB701n73J+NDtAaoAO0BugArQE6QGuADtAaoAO0BugArQE6QGuADtAaoAO0BugArQE6QGuADtAaoAO0BugArQE6QGuADtB31qgmk4Y58QAAAAAElFTkSuQmCC',
  })
  await createSubscription('store-f', 'plan-starter', 'active', {
    planName: 'البداية',
    startedAt: new Date(Date.now() - 6 * 86400000),
    expiresAt: new Date(Date.now() + 24 * 86400000),
    currentPeriodStart: new Date(Date.now() - 6 * 86400000),
    currentPeriodEnd: new Date(Date.now() + 24 * 86400000),
    activatedAt: new Date(Date.now() - 6 * 86400000),
    approvedBy: adminUid,
    ordersUsed: 0,
    periodNumber: 1,
    normalPriceSnapshot: 399,
    yearlyPriceSnapshot: 3990,
  })
  const fCat = await createCategory('store-f', 'منتجات', 'products', 1)
  await createProduct('store-f', fCat, 'منتج تجريبي', 100, 50, 'للمتجر التجريبي', { featured: true })

  // Store G — published, active, NO logo. The header must fall back to the
  // store name (icon + text) and the hero is the generated overlay + CTA.
  const gUid = 'seed-owner-g'
  await createUser(gUid, 'owner@g.store', 'Owner12345', 'TEST Owner G', 'merchant', ['store-g'])
  await createStore('store-g', 'test-plain-store', 'TEST - متجر بدون لوجو', gUid, {
    isTestMerchant: true,
    published: true,
    primary: '#0b766e',
    secondary: '#c78a25',
    description: 'متجر بدون لوجو — يعرض اسم المتجر في الهيدر.',
  })
  await createSubscription('store-g', 'plan-starter', 'active', {
    planName: 'البداية',
    startedAt: new Date(Date.now() - 6 * 86400000),
    expiresAt: new Date(Date.now() + 24 * 86400000),
    currentPeriodStart: new Date(Date.now() - 6 * 86400000),
    currentPeriodEnd: new Date(Date.now() + 24 * 86400000),
    activatedAt: new Date(Date.now() - 6 * 86400000),
    approvedBy: adminUid,
    ordersUsed: 0,
    periodNumber: 1,
    normalPriceSnapshot: 399,
    yearlyPriceSnapshot: 3990,
  })
  const gCat = await createCategory('store-g', 'منتجات', 'products', 1)
  await createProduct('store-g', gCat, 'منتج البسيط', 90, 30, 'مند غير لوجو', { featured: true })

  // Store H — published, active, WITH a broken logo URL. The header must catch
  // the load failure and fall back to the store name.
  const hUid = 'seed-owner-h'
  await createUser(hUid, 'owner@h.store', 'Owner12345', 'TEST Owner H', 'merchant', ['store-h'])
  await createStore('store-h', 'test-broken-logo-store', 'TEST - متجر لوجو معطل', hUid, {
    isTestMerchant: true,
    published: true,
    primary: '#0b766e',
    secondary: '#c78a25',
    description: 'لوجو معطل يتحقق من الفولباك للاسم.',
    logo: 'https://invalid.example.invalid/broken-logo.png',
  })
  await createSubscription('store-h', 'plan-starter', 'active', {
    planName: 'البداية',
    startedAt: new Date(Date.now() - 6 * 86400000),
    expiresAt: new Date(Date.now() + 24 * 86400000),
    currentPeriodStart: new Date(Date.now() - 6 * 86400000),
    currentPeriodEnd: new Date(Date.now() + 24 * 86400000),
    activatedAt: new Date(Date.now() - 6 * 86400000),
    approvedBy: adminUid,
    ordersUsed: 0,
    periodNumber: 1,
    normalPriceSnapshot: 399,
    yearlyPriceSnapshot: 3990,
  })
  const hCat = await createCategory('store-h', 'منتجات', 'products', 1)
  await createProduct('store-h', hCat, 'منتج معطل اللوجو', 80, 20, 'مند بدون صورة', { featured: true })

  // Store I — published, active, WITH a platform-offered PRESET logo
  // (`preset:storefront`). The header must render the preset mark only (no
  // duplicated name) and fall back to the name after the logo is removed.
  const iUid = 'seed-owner-i'
  await createUser(iUid, 'owner@i.store', 'Owner12345', 'TEST Owner I', 'merchant', ['store-i'])
  await createStore('store-i', 'test-preset-store', 'TEST - متجر شعار جاهز', iUid, {
    isTestMerchant: true,
    published: true,
    primary: '#0e7490',
    secondary: '#f59e0b',
    description: 'متجر يستخدم شعارًا جاهزًا من المنصة.',
    logo: 'preset:storefront',
  })
  await createSubscription('store-i', 'plan-starter', 'active', {
    planName: 'البداية',
    startedAt: new Date(Date.now() - 5 * 86400000),
    expiresAt: new Date(Date.now() + 25 * 86400000),
    currentPeriodStart: new Date(Date.now() - 5 * 86400000),
    currentPeriodEnd: new Date(Date.now() + 25 * 86400000),
    activatedAt: new Date(Date.now() - 5 * 86400000),
    approvedBy: adminUid,
    ordersUsed: 0,
    periodNumber: 1,
    normalPriceSnapshot: 399,
    yearlyPriceSnapshot: 3990,
  })
  const iCat = await createCategory('store-i', 'منتجات', 'products', 1)
  await createProduct('store-i', iCat, 'منتج بريزيت', 120, 40, 'منتج بدون صورة', { featured: true })

  // Malek Store — deterministic local fixture used by storefront and
  // Keep the historical paid snapshot used by the local Malek fixture. Never
  // replace an existing valid subscription with a newly-created FREE record.
  const malekUid = await ensureMalekIdentity('Owner12345')
  await createStore('malek-store', 'malek-store', 'Malek Store', malekUid, {
    published: true,
    primary: '#3525cd',
    secondary: '#4f46e5',
    description: 'متجر مالك التجريبي المحلي.',
    seoTitle: 'Malek Store',
    seoDescription: 'متجر تجريبي محلي للتحقق من مسار المتجر العام.',
  })
  const malekSubs = (await db.collection('subscriptions').where('storeId', '==', 'malek-store').get()).docs
  const existingMalek = malekSubs
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter((s) => s.data.status === 'active' || s.data.status === 'trialing')
    .sort((a, b) => Number(b.data.normalPriceSnapshot || 0) - Number(a.data.normalPriceSnapshot || 0) || (b.data.createdAt?.seconds || 0) - (a.data.createdAt?.seconds || 0))[0]
  const malekSubId = existingMalek?.id || await createSubscription('malek-store', 'plan-pro-legacy-1500', 'active', {
    planName: 'PRO (Legacy)',
    startedAt: new Date(),
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    activatedAt: new Date(),
    approvedBy: adminUid,
    ordersUsed: 0,
    periodNumber: 1,
    normalPriceSnapshot: 1500,
    launchPriceSnapshot: 1500,
    yearlyPriceSnapshot: 15000,
  })
  await db.collection('stores').doc('malek-store').set({ activeSubscriptionId: malekSubId, updatedAt: ts() }, { merge: true })
  const malekCat = await createCategory('malek-store', 'منتجات', 'products', 1)
  await createProduct('malek-store', malekCat, 'منتج مالك التجريبي', 120, 25, 'منتج متاح في المتجر المحلي.', { featured: true })

  // Dedicated local-only QA identities. These are deliberately separate from
  // the historical seed accounts above so visual/functional testing cannot
  // alter an existing fixture. The emulator hosts are forced at the top of
  // this script; no production Firebase endpoint is contacted.
  const qaPassword = 'MatjariQA123!'
  const qaMerchants = [
    { uid: 'qa-free', email: 'qa.free@matjari.test', name: 'QA Free', storeId: 'qa-free-store', planId: 'plan-free', status: 'active', published: true },
    { uid: 'qa-trial', email: 'qa.trial@matjari.test', name: 'QA Trial', storeId: 'qa-trial-store', planId: 'plan-growth', status: 'trialing', published: false, trialDays: 2 },
    { uid: 'qa-active', email: 'qa.active@matjari.test', name: 'QA Active', storeId: 'qa-active-store', planId: 'plan-business', status: 'active', published: true },
    { uid: 'qa-expired', email: 'qa.expired@matjari.test', name: 'QA Expired', storeId: 'qa-expired-store', planId: 'plan-growth', status: 'expired', published: false, trialDays: -2 },
    { uid: 'qa-lifetime', email: 'qa.lifetime@matjari.test', name: 'QA Lifetime', storeId: 'qa-lifetime-store', planId: 'plan-lifetime', status: 'active', published: true },
  ]
  for (const qa of qaMerchants) {
    await createUser(qa.uid, qa.email, qaPassword, qa.name, 'merchant', [qa.storeId], true)
    await createStore(qa.storeId, qa.storeId.replace('-store', ''), `QA — ${qa.name}`, qa.uid, {
      isTestMerchant: true,
      published: qa.published,
      description: 'بيانات اختبار محلية فقط.',
      primary: '#4f46e5',
      secondary: '#f59e0b',
    })
    const now = Date.now()
    const trialEndsAt = qa.trialDays == null ? undefined : new Date(now + qa.trialDays * 86400000)
    const trialStartedAt = qa.trialDays == null ? undefined : new Date(now - 86400000)
    const subId = await createSubscription(qa.storeId, qa.planId, qa.status, {
      planName: qa.planId.replace('plan-', '').toUpperCase(),
      ...(trialEndsAt ? { trialEndsAt, trialStartedAt } : {}),
      startedAt: new Date(now - 7 * 86400000),
      currentPeriodStart: new Date(now - 7 * 86400000),
      currentPeriodEnd: new Date(now + 23 * 86400000),
      normalPriceSnapshot: qa.planId === 'plan-lifetime' ? 4999 : undefined,
    })
    await db.collection('stores').doc(qa.storeId).set({ activeSubscriptionId: subId }, { merge: true })
    const catId = await createCategory(qa.storeId, 'منتجات QA', 'qa-products', 1)
    const featuredId = await createProduct(qa.storeId, catId, `منتج مميز — ${qa.name}`, 749, 18, 'منتج اختبار مميز مع خيارات.', {
      featured: true,
      compareAtPrice: 899,
      variants: [{ id: 'qa-red-m', name: 'أحمر / M', color: 'أحمر', size: 'M', sku: 'QA-RED-M', price: 749, stock: 8 }, { id: 'qa-blue-l', name: 'أزرق / L', color: 'أزرق', size: 'L', sku: 'QA-BLUE-L', price: 749, stock: 10 }],
      quantityTiers: [{ minQuantity: 2, price: 699 }, { minQuantity: 3, price: 649 }],
    })
    await createProduct(qa.storeId, catId, 'منتج مسودة QA', 299, 0, 'منتج غير منشور للاختبار.', { active: false })
    await createProductCost(qa.storeId, featuredId, 320)
    await createCustomer(qa.storeId, 'عميل QA', '01000000000', 2, 1498)
    await createOrder(qa.storeId, 'qa-orders', `QA-${qa.storeId}`, featuredId, 'عميل QA', '01000000000', 749, 'DELIVERED', 2, { productName: `منتج مميز — ${qa.name}`, costPrice: 320 })
    await seedAnalytics(qa.storeId, 3, 2247, 7)
    await createShipping(qa.storeId, 'القاهرة', ['القاهرة', 'الجيزة'], 40, { freeAbove: 800 })
  }
  await ensureIdentity({ uid: 'qa-admin', email: 'qa.admin@matjari.test', password: qaPassword, name: 'QA SuperAdmin' }, 'superAdmin', [])
  const qaAudit = [
    { action: 'plan_changed', entity: 'subscriptions', createdAt: '2026-08-24T18:20:00.000Z' },
    { action: 'payment_approved', entity: 'subscriptionPayments', createdAt: { seconds: 1787595600, nanoseconds: 0 } },
    { action: 'promotion_stopped', entity: 'platformPromotions', createdAt: { _seconds: 1787509200, _nanoseconds: 0 } },
    { action: 'merchant_suspended', entity: 'stores', createdAt: null },
  ]
  for (const entry of qaAudit) await db.collection('auditLogs').add({ ...entry, actorId: 'qa-admin', actorEmail: 'qa.admin@matjari.test', metadata: {}, createdBy: 'qa-seed' })

  // Firestore triggers do not replay historical seed writes. Rebuild the
  // safe public projections explicitly so a clean emulator starts usable.
  await rebuildPublicProjections()

  console.log('Seed complete:')
  console.log('  admin     -> khaaledelmasry@gmail.com / Admin12345 (canonical SuperAdmin; admin@mk.store is a compatibility alias)')
  console.log('  store A   -> owner@a.store / Owner12345 (published, moderate usage, paid growth)')
  console.log('  store B   -> owner@b.store / Owner12345 (published, near limit, paid starter)')
  console.log('  store C   -> owner@c.store / Owner12345 (trialing + pending activation request)')
  console.log('  store D   -> owner@d.store / Owner12345 (trial expired — storefront gated)')
  console.log('  store E   -> owner@e.store / Owner12345 (pending legacy subscription)')
  console.log('  staff     -> staff@test.com / Staff12345 (store-a restricted staff)')
  console.log('  customer  -> customer@test.com / Customer12345 (storefront test customer)')
  console.log('  malek     -> malek@test.com / Owner12345 (published legacy paid storefront, 1500 EGP snapshot)')
  process.exit(0)
}

main().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})

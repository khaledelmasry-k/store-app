// Dev-only seed for the Firebase local emulators.
// Run with emulators up:  firebase emulators:exec --project mk-store-app "node scripts/seed-emulator.mjs"
// Wipes and recreates plans, admin, and demo merchants so every dashboard has
// realistic data. Never runs against production.
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

const COLLECTIONS = [
  'plans', 'users', 'stores', 'subscriptions', 'orders', 'products', 'customers',
  'analytics', 'transactions', 'payments', 'coupons', 'categories', 'storeLinks',
  'notifications', 'auditLogs', 'shipping', 'team', 'roles', 'invitations',
  'landingPages', 'subscriptionPayments',
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
    abandonedCart: !!opts.abandonedCart,
    analytics: opts.analytics !== undefined ? !!opts.analytics : true,
    advancedReports: !!opts.advancedReports,
    customDomain: !!opts.customDomain,
    apiAccess: !!opts.apiAccess,
    removeBranding: !!opts.removeBranding,
    prioritySupport: !!opts.prioritySupport,
     storeLimit: opts.storeLimit ?? 1,
     unlimitedProducts: !!opts.unlimitedProducts,
     unlimitedSalesLinks: !!opts.unlimitedSalesLinks,
     active: opts.active !== false,
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
  }
  await db.collection('users').doc(uid).set({
    uid, email, name, role, storeIds, active,
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
}

async function createStore(storeId, ref, name, ownerId, opts = {}) {
  await db.collection('stores').doc(storeId).set({
    ref,
    name,
    slug: ref,
    active: opts.active ?? true,
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
  return ref.id
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

async function createOrder(storeId, counterId, orderNumber, productId, customerName, phone, price, status, daysAgo) {
  const createdAt = new Date(Date.now() - daysAgo * 86400000)
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
    items: [{ id: `${productId}-`, productId, name: productId, price, quantity: 1 }],
    subtotal: price,
    shippingFee: 0,
    discount: 0,
    totalPrice: price,
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
  await wipe()
  console.log('Wiped existing data.')

  // Plans — the 4 M&K Store plans. Prices/limits are the source of truth;
  // 0 product/stock/salesLinks limits = unlimited. Storage is in MB.
  // Feature flags (quantityPricing, variantInventory, ...) gate advanced product
  // modes; the Free plan has none of them.
   await createPlan('plan-free', 'الأساسية', 0, 5, 30, 'للبدء والتجريب', ['متجر واحد', 'منتجات محدودة', 'تحليلات أساسية'], { priceYearly: 0, priceYearlyDiscount: 0, trialDays: 0, landingPagesLimit: 0, salesLinksLimit: 1, staffLimit: 0, storageLimit: 200, slug: 'free', sortOrder: 0, unlimitedProducts: false, unlimitedSalesLinks: false, analytics: true })
  await createPlan('plan-starter', 'البداية', 299, 50, 100, 'للبدء والبيع', ['متجر إلكتروني كامل', 'دعم بالهاتف', 'روابط بيع'], { priceYearly: 2990, launchPrice: 99, launchEnabled: true, launchExpiresAt: new Date('2026-12-31T23:59:59Z'), landingPagesLimit: 1, salesLinksLimit: 3, staffLimit: 1, storageLimit: 1024, slug: 'starter', sortOrder: 1, unlimitedProducts: false, unlimitedSalesLinks: false, quantityPricing: true, variantInventory: true, coupons: true, analytics: true })
  await createPlan('plan-growth', 'النمو', 599, 250, 500, 'للمتاجر التي تنمو', ['كل مزايب البداية', 'تحليلات متقدمة', 'فريق حتى 3 أعضاء'], { priceYearly: 5990, launchPrice: 199, launchEnabled: true, launchExpiresAt: new Date('2026-12-31T23:59:59Z'), landingPagesLimit: 5, salesLinksLimit: 15, staffLimit: 3, storageLimit: 5120, slug: 'growth', isPopular: true, sortOrder: 2, unlimitedProducts: false, unlimitedSalesLinks: false, quantityPricing: true, variantInventory: true, coupons: true, abandonedCart: true, analytics: true, advancedReports: true })
  await createPlan('plan-pro', 'الاحتراف', 999, 0, 2000, 'للمتاجر المتقدمة', ['كل مزايب النمو', 'أولوية دعم', 'إزالة علامة M&K'], { priceYearly: 9990, launchPrice: 299, launchEnabled: true, launchExpiresAt: new Date('2026-12-31T23:59:59Z'), landingPagesLimit: 20, salesLinksLimit: 0, staffLimit: 10, storageLimit: 20480, slug: 'pro', sortOrder: 3, unlimitedProducts: true, unlimitedSalesLinks: true, quantityPricing: true, variantInventory: true, coupons: true, abandonedCart: true, analytics: true, advancedReports: true, customDomain: true, apiAccess: true, removeBranding: true, prioritySupport: true })

  // Platform admin
  const adminUid = 'seed-admin'
  await createUser(adminUid, 'admin@mk.store', 'Admin12345', 'مدير المنصة', 'superAdmin', [])

  // Store A — active growth plan, published, moderate usage
  const aUid = 'seed-owner-a'
  await createUser(aUid, 'owner@a.store', 'Owner12345', 'محمد علي', 'merchant', ['store-a'])
  await createStore('store-a', 'beit-el-shay', 'بيت الشاي', aUid, {
    published: true,
    primary: '#16a34a',
    secondary: '#f59e0b',
    storageLimitBytes: 5 * 1024 * 1024 * 1024,
    description: 'أجود أنواع الشاي والقهوة وأدوات التحضير — توصيل لكل المحافظات.',
    seoTitle: 'بيت الشاي — متجر شاي وقهوة',
    seoDescription: 'تشكيلة واسعة من الشاي والقهوة وأدوات التحضير بتوصيل سريع.',
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
    ordersUsed: 340,
    periodNumber: 1,
    normalPriceSnapshot: 599,
    launchPriceSnapshot: 199,
    launchUsed: true,
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
  await createOrder('store-a', 'store-a', 'ORD-00001', p1, 'أحمد حسن', '01000000001', 180, 'DELIVERED', 8)
  await createOrder('store-a', 'store-a', 'ORD-00002', p2, 'سارة أحمد', '01000000002', 320, 'DELIVERED', 5)
  await createOrder('store-a', 'store-a', 'ORD-00003', p3, 'خالد محمود', '01000000003', 150, 'SHIPPED', 3)
  await createOrder('store-a', 'store-a', 'ORD-00004', p2, 'منى خليل', '01000000004', 320, 'NEW', 1)
  await createOrder('store-a', 'store-a', 'ORD-00005', p1, 'يوسف إبراهيم', '01000000005', 180, 'CANCELLED', 2)
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
    seo: { title: 'عرض رمضان — بيت الشاي', description: 'عروض رمضان على الشاي والقهوة' },
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

  // Store B — active starter plan, published, near limit
  const bUid = 'seed-owner-b'
  await createUser(bUid, 'owner@b.store', 'Owner12345', 'نور الشاذلي', 'merchant', ['store-b'])
  await createStore('store-b', 'active-shoes', 'أحذية أكتيف', bUid, {
    published: true,
    primary: '#0284c7',
    secondary: '#f43f5e',
    storageLimitBytes: 1 * 1024 * 1024 * 1024,
    description: 'أحذية رياضية وعصريّة للرجال والنساء بأسعار منافسة.',
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
    ordersUsed: 92,
    periodNumber: 2,
    normalPriceSnapshot: 299,
    launchPriceSnapshot: 99,
    launchUsed: true,
  })
  const shoesCat = await createCategory('store-b', 'أحذية', 'shoes', 1)
  const sp1 = await createProduct('store-b', shoesCat, 'حذاء رياضي', 550, 20, 'مقاسات متعددة')
  const sp2 = await createProduct('store-b', shoesCat, 'حذاء رسمي', 720, 12, 'جلد طبيعي')
  await createOrder('store-b', 'store-b', 'ORD-00001', sp1, 'ليلى سالم', '01000000010', 550, 'PROCESSING', 1)
  await createOrder('store-b', 'store-b', 'ORD-00002', sp2, 'عمر فاروق', '01000000011', 720, 'NEW', 0)
  await seedAnalytics('store-b', 3, 1500)

  // Store C — trialing (instant self-serve trial), with a pending activation request
  const cUid = 'seed-owner-c'
  await createUser(cUid, 'owner@c.store', 'Owner12345', 'طارق فؤاد', 'merchant', ['store-c'])
  await createStore('store-c', 'zeina-gifts', 'زينة الجملة', cUid, { published: true })
  const cSubId = await createSubscription('store-c', 'plan-starter', 'trialing', {
    planName: 'البداية',
    trialStartedAt: new Date(Date.now() - 2 * 86400000),
    trialEndsAt: new Date(Date.now() + 1 * 86400000),
    startedAt: new Date(Date.now() - 2 * 86400000),
    expiresAt: new Date(Date.now() + 1 * 86400000),
    normalPriceSnapshot: 299,
    launchPriceSnapshot: 99,
    ordersUsed: 5,
  })
  await db.collection('subscriptionPayments').add({
    id: 'seed-pay-c1',
    subscriptionId: cSubId,
    storeId: 'store-c',
    planId: 'plan-starter',
    planName: 'البداية',
    amount: 99,
    paymentMethod: 'فودافون كاش',
    reference: '487221900123',
    note: 'تحويل أول شهر بسعر الإطلاق',
    screenshotUrl: null,
    status: 'pending',
    periodNumber: 1,
    createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    createdBy: cUid,
  })

  // Store D — trial expired (data preserved, storefront gated)
  const dUid = 'seed-owner-d'
  await createUser(dUid, 'owner@d.store', 'Owner12345', 'هدى رمضان', 'merchant', ['store-d'])
  await createStore('store-d', 'noor-cafe', 'كافتيريا النور', dUid, { published: true })
  await createSubscription('store-d', 'plan-pro', 'expired', {
    planName: 'الاحتراف',
    trialStartedAt: new Date(Date.now() - 12 * 86400000),
    trialEndsAt: new Date(Date.now() - 4 * 86400000),
    startedAt: new Date(Date.now() - 12 * 86400000),
    expiresAt: new Date(Date.now() - 4 * 86400000),
    normalPriceSnapshot: 999,
    launchPriceSnapshot: 299,
    ordersUsed: 40,
  })

  // Store E — legacy pending subscription (admin-approval flow still supported)
  const eUid = 'seed-owner-e'
  await createUser(eUid, 'owner@e.store', 'Owner12345', 'سلمى عادل', 'merchant', ['store-e'])
  await createStore('store-e', 'amal-kids', 'أمل للأطفال', eUid, { published: false })
  await createSubscription('store-e', 'plan-starter', 'pending', { planName: 'البداية' })

  // Store F — published, active, WITH a logo and a hero image. Used by the
  // branding E2E tests: header must show the logo only (no duplicated name),
  // footer an independent larger logo, and the hero renders the uploaded image
  // without the generated overlay/CTA.
  const fUid = 'seed-owner-f'
  await createUser(fUid, 'owner@f.store', 'Owner12345', 'رنا محمود', 'merchant', ['store-f'])
  await createStore('store-f', 'logo-shop', 'متجر اللوجو', fUid, {
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
    normalPriceSnapshot: 299,
  })
  const fCat = await createCategory('store-f', 'منتجات', 'products', 1)
  await createProduct('store-f', fCat, 'منتج تجريبي', 100, 50, 'للمتجر التجريبي', { featured: true })

  // Store G — published, active, NO logo. The header must fall back to the
  // store name (icon + text) and the hero is the generated overlay + CTA.
  const gUid = 'seed-owner-g'
  await createUser(gUid, 'owner@g.store', 'Owner12345', 'فريق سام', 'merchant', ['store-g'])
  await createStore('store-g', 'plain-shop', 'المتجر البسيط', gUid, {
    published: true,
    primary: '#7c3aed',
    secondary: '#ec4899',
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
    normalPriceSnapshot: 299,
  })
  const gCat = await createCategory('store-g', 'منتجات', 'products', 1)
  await createProduct('store-g', gCat, 'منتج البسيط', 90, 30, 'مند غير لوجو', { featured: true })

  // Store H — published, active, WITH a broken logo URL. The header must catch
  // the load failure and fall back to the store name.
  const hUid = 'seed-owner-h'
  await createUser(hUid, 'owner@h.store', 'Owner12345', 'هدى فاروق', 'merchant', ['store-h'])
  await createStore('store-h', 'broken-logo-shop', 'متجر لوجو معطل', hUid, {
    published: true,
    primary: '#e11d48',
    secondary: '#0ea5e9',
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
    normalPriceSnapshot: 299,
  })
  const hCat = await createCategory('store-h', 'منتجات', 'products', 1)
  await createProduct('store-h', hCat, 'منتج معطل اللوجو', 80, 20, 'مند بدون صورة', { featured: true })

  // Store I — published, active, WITH a platform-offered PRESET logo
  // (`preset:storefront`). The header must render the preset mark only (no
  // duplicated name) and fall back to the name after the logo is removed.
  const iUid = 'seed-owner-i'
  await createUser(iUid, 'owner@i.store', 'Owner12345', 'يوسف إبراهيم', 'merchant', ['store-i'])
  await createStore('store-i', 'preset-shop', 'متجر بريزيت', iUid, {
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
    normalPriceSnapshot: 299,
  })
  const iCat = await createCategory('store-i', 'منتجات', 'products', 1)
  await createProduct('store-i', iCat, 'منتج بريزيت', 120, 40, 'منتج بدون صورة', { featured: true })

  console.log('Seed complete:')
  console.log('  admin     -> admin@mk.store / Admin12345')
  console.log('  store A   -> owner@a.store / Owner12345 (published, moderate usage, paid growth)')
  console.log('  store B   -> owner@b.store / Owner12345 (published, near limit, paid starter)')
  console.log('  store C   -> owner@c.store / Owner12345 (trialing + pending activation request)')
  console.log('  store D   -> owner@d.store / Owner12345 (trial expired — storefront gated)')
  console.log('  store E   -> owner@e.store / Owner12345 (pending legacy subscription)')
  process.exit(0)
}

main().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})

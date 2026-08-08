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
  'landingPages',
]

async function wipe() {
  const list = await auth.listUsers()
  await Promise.all(list.users.map((u) => auth.deleteUser(u.uid).catch(() => {})))
  for (const col of COLLECTIONS) {
    const refs = await db.collection(col).listDocuments()
    for (const ref of refs) await ref.delete()
  }
}

async function createPlan(id, name, priceMonthly, productLimit, orderLimitPerMonth, description, features) {
  await db.collection('plans').doc(id).set({
    id,
    name,
    description,
    priceMonthly,
    priceYearly: Math.round(priceMonthly * 10),
    productLimit,
    orderLimitPerMonth,
    features,
    active: true,
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
    seoTitle: opts.seoTitle || name,
    seoDescription: opts.seoDescription || opts.description || '',
    createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
}

async function createSubscription(storeId, planId, status, opts = {}) {
  const sub = {
    storeId,
    planId,
    planName: opts.planName || planId,
    status,
    requestNote: 'بيانات تجريبية',
    ordersUsed: opts.ordersUsed || 0,
    createdAt: opts.createdAt ? admin.firestore.Timestamp.fromDate(opts.createdAt) : ts(),
    updatedAt: ts(),
    createdBy: 'seed',
  }
  if (opts.startedAt) sub.startedAt = admin.firestore.Timestamp.fromDate(opts.startedAt)
  if (opts.expiresAt) sub.expiresAt = admin.firestore.Timestamp.fromDate(opts.expiresAt)
  if (opts.approvedBy) sub.approvedBy = opts.approvedBy
  const ref = await db.collection('subscriptions').add(sub)
  return ref.id
}

async function createCategory(storeId, name, slug, order) {
  const ref = await db.collection('categories').add({
    storeId, name, slug, order, active: true, createdAt: ts(), updatedAt: ts(), createdBy: 'seed',
  })
  return ref.id
}

async function createProduct(storeId, categoryId, name, price, stock, description = '') {
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

  // Plans
  await createPlan('plan-starter', 'البداية', 500, 20, 50, 'للنشاطات الصغيرة', ['متجر إلكتروني كامل', 'دعم بالهاتف', 'روابط بيع'])
  await createPlan('plan-growth', 'النمو', 1200, 100, 200, 'للمتاجر المتنامية', ['كل مزايا البداية', 'تحليلات متقدمة', 'فريق حتى 5 أعضاء'])
  await createPlan('plan-pro', 'الاحتراف', 2500, 500, 500, 'للمتاجر الكبيرة', ['كل مزايا النمو', 'طلبات غير محدودة تقريباً', 'أولوية دعم'])

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
    approvedBy: adminUid,
    ordersUsed: 132,
  })
  const teaCat = await createCategory('store-a', 'شاي', 'tea', 1)
  const coffeeCat = await createCategory('store-a', 'قهوة', 'coffee', 2)
  const p1 = await createProduct('store-a', teaCat, 'شاي صيني ممتاز', 180, 40, 'شاي أخضر فاخر')
  const p2 = await createProduct('store-a', coffeeCat, 'قهوة مختصة', 320, 25, 'حبوب محمصة طازجة')
  const p3 = await createProduct('store-a', teaCat, 'أدوات تحضير الشاي', 150, 60, 'إبريق زجاجي ومصفاة')
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
    approvedBy: adminUid,
    ordersUsed: 46,
  })
  const shoesCat = await createCategory('store-b', 'أحذية', 'shoes', 1)
  const sp1 = await createProduct('store-b', shoesCat, 'حذاء رياضي', 550, 20, 'مقاسات متعددة')
  const sp2 = await createProduct('store-b', shoesCat, 'حذاء رسمي', 720, 12, 'جلد طبيعي')
  await createOrder('store-b', 'store-b', 'ORD-00001', sp1, 'ليلى سالم', '01000000010', 550, 'PROCESSING', 1)
  await createOrder('store-b', 'store-b', 'ORD-00002', sp2, 'عمر فاروق', '01000000011', 720, 'NEW', 0)
  await seedAnalytics('store-b', 3, 1500)

  // Store C — pending subscription
  const cUid = 'seed-owner-c'
  await createUser(cUid, 'owner@c.store', 'Owner12345', 'طارق فؤاد', 'merchant', ['store-c'])
  await createStore('store-c', 'zeina-gifts', 'زينة الجملة', cUid, { published: false })
  await createSubscription('store-c', 'plan-starter', 'pending', { planName: 'البداية' })

  // Store D — expired subscription
  const dUid = 'seed-owner-d'
  await createUser(dUid, 'owner@d.store', 'Owner12345', 'هدى رمضان', 'merchant', ['store-d'])
  await createStore('store-d', 'noor-cafe', 'كافتيريا النور', dUid, { published: false })
  await createSubscription('store-d', 'plan-pro', 'expired', {
    planName: 'الاحتراف',
    startedAt: new Date(Date.now() - 40 * 86400000),
    expiresAt: new Date(Date.now() - 10 * 86400000),
    ordersUsed: 40,
  })

  console.log('Seed complete:')
  console.log('  admin     -> admin@mk.store / Admin12345')
  console.log('  store A   -> owner@a.store / Owner12345 (published, moderate usage)')
  console.log('  store B   -> owner@b.store / Owner12345 (published, near limit)')
  console.log('  store C   -> owner@c.store / Owner12345 (pending subscription)')
  console.log('  store D   -> owner@d.store / Owner12345 (expired subscription)')
  process.exit(0)
}

main().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})

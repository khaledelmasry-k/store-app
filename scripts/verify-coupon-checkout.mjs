/**
 * Coupon checkout contract, exercised through the real callables.
 *
 * This covers the gap that let the coupon regression ship: `quoteCoupon` was
 * tested by hand at the storefront, `createOrder` was not, and the discount
 * computation went missing from `createOrder` alone. Every coupon order threw
 * `قيمة كود الخصم غير صالحة` after the shopper had already been shown a valid
 * discount, and nothing in the suite noticed.
 *
 * Runs against the emulators — it seeds a store, plan, subscription, product
 * and coupon, then drives the deployed callables over HTTP exactly as the
 * storefront does, and asserts the written order document.
 *
 *   firebase emulators:exec --project mk-store-app \
 *     --only auth,firestore,functions,storage \
 *     "node scripts/verify-coupon-checkout.mjs"
 *
 * or: npm run verify:coupon-checkout
 */
import assert from 'node:assert/strict'
import admin from 'firebase-admin'

const PROJECT = process.env.GCLOUD_PROJECT || 'mk-store-app'
const REGION = 'us-central1'
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001'
const CALL = (name) => `http://${FN_HOST}/${PROJECT}/${REGION}/${name}`

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
admin.initializeApp({ projectId: PROJECT })
const db = admin.firestore()

const ID = `coupon-${Date.now()}`
const STORE = `store-${ID}`
const OWNER = `owner-${ID}`
const PRODUCT = `product-${ID}`

/** Invokes a callable the way the firebase-js client does. */
async function callable(name, data) {
  const res = await fetch(CALL(name), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  const raw = await res.text()
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    throw new Error(`${name} returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 300)}`)
  }
  if (body?.error) {
    const err = new Error(body.error.message || 'callable failed')
    err.code = body.error.status
    throw err
  }
  assert.equal(res.status, 200, `${name} returned HTTP ${res.status}: ${JSON.stringify(body)}`)
  return body.result
}

async function seed({ price, couponType, couponValue }) {
  const year = 1000 * 60 * 60 * 24 * 365
  await db.doc(`users/${OWNER}`).set({ role: 'merchant', active: true, merchantStatus: 'active' })
  await db.doc(`plans/plan-${ID}`).set({
    id: `plan-${ID}`, name: 'Coupon Test', coupons: true, orderLimitPerMonth: 0, active: true,
  })
  await db.doc(`stores/${STORE}`).set({
    id: STORE, ownerId: OWNER, name: 'متجر اختبار الكوبون', slug: STORE,
    active: true, storeStatus: 'published', currency: 'EGP',
    shipping: { enabled: false },
  })
  await db.doc(`subscriptions/sub-${ID}`).set({
    storeId: STORE, planId: `plan-${ID}`, status: 'active', ordersUsed: 0,
    currentPeriodEnd: admin.firestore.Timestamp.fromMillis(Date.now() + year),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await db.doc(`products/${PRODUCT}`).set({
    id: PRODUCT, storeId: STORE, name: 'منتج اختبار', price, stock: 50,
    active: true, pricingMode: 'standard',
  })
  await db.doc(`coupons/coupon-${ID}`).set({
    storeId: STORE, code: 'SAVE10', type: couponType, value: couponValue,
    active: true, usedCount: 0, maxUses: 0, minOrder: 0,
  })
}

const customer = { name: 'عميل الاختبار', phone: '01000000001', governorate: 'القاهرة', city: 'مدينة نصر', address: 'شارع 1' }
let passed = 0
const check = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`) }

try {
  // 333 with a 10% coupon is the case that produces a float tail (33.300000000000004).
  await seed({ price: 333, couponType: 'percent', couponValue: 10 })

  let quoted
  await check('quoteCoupon previews the discount', async () => {
    quoted = await callable('quoteCoupon', { storeId: STORE, code: 'SAVE10', subtotal: 333 })
    assert.equal(quoted.discount, 33.3, `expected 33.3, got ${quoted.discount}`)
  })

  let order
  await check('createOrder accepts a coupon order', async () => {
    // Before the fix this threw failed-precondition on every coupon order.
    order = await callable('createOrder', {
      storeId: STORE, customer, paymentMethod: 'cod', couponCode: 'SAVE10',
      items: [{ productId: PRODUCT, quantity: 1 }],
    })
    assert.ok(order?.orderId, 'no orderId returned')
  })

  await check('the charge equals the preview', async () => {
    assert.equal(order.discount, quoted.discount,
      `preview ${quoted.discount} but charged ${order.discount}`)
  })

  await check('totals carry no float tail', async () => {
    assert.equal(order.discount, 33.3)
    assert.equal(order.totalPrice, 299.7, `expected 299.7, got ${order.totalPrice}`)
  })

  await check('the order document matches what was returned', async () => {
    const doc = (await db.doc(`orders/${order.orderId}`).get()).data()
    assert.equal(doc.discount, 33.3)
    assert.equal(doc.subtotal, 333)
    assert.equal(doc.totalPrice, 299.7)
    assert.equal(doc.couponCode, 'SAVE10')
  })

  await check('the coupon usage counter advanced once', async () => {
    const coupon = (await db.doc(`coupons/coupon-${ID}`).get()).data()
    assert.equal(coupon.usedCount, 1)
  })

  await check('a fixed coupon is capped at the subtotal', async () => {
    await db.doc(`coupons/coupon-${ID}`).set({ type: 'fixed', value: 5000, usedCount: 0 }, { merge: true })
    const quote = await callable('quoteCoupon', { storeId: STORE, code: 'SAVE10', subtotal: 333 })
    assert.equal(quote.discount, 333, 'a fixed coupon must never exceed the subtotal')
  })

  await check('an unknown code is rejected', async () => {
    await assert.rejects(
      () => callable('createOrder', {
        storeId: STORE, customer, paymentMethod: 'cod', couponCode: 'NOPE-NOT-REAL',
        items: [{ productId: PRODUCT, quantity: 1 }],
      }),
      /كود الخصم غير صالح/,
    )
  })

  console.log(`\nAll ${passed} coupon checkout checks passed.`)
} catch (error) {
  console.error(`\nFAILED after ${passed} passing check(s):`)
  console.error(error?.message || error)
  process.exitCode = 1
}

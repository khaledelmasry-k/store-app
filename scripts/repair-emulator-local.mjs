// Local/emulator-only compatibility repair. Never point this script at a
// production project. It converges existing emulator stores to the canonical
// activeSubscriptionId + publicStores projection model without changing UI or
// production data.
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
const env = readFileSync('.env.local', 'utf8')
const projectId = env.match(/VITE_FIREBASE_PROJECT_ID=(\S+)/)?.[1] || 'mk-store-app'
admin.initializeApp({ projectId })
const db = admin.firestore()
const ts = admin.firestore.FieldValue.serverTimestamp

const effective = (s) => s?.status === 'active' || s?.status === 'trialing'
const publicStore = (s) => ({
  name: s.name || '', slug: s.slug || '', logo: s.logo || null, hero: s.hero || null,
  heroImage: s.heroImage || null, description: s.description || '', seoTitle: s.seoTitle || null,
  seoDescription: s.seoDescription || null, theme: s.theme || {}, currency: s.currency || 'EGP',
  phone: s.publicPhone || s.phone || null, published: s.published === true, active: s.active !== false, updatedAt: ts(),
})

async function main() {
  const planFree = await db.doc('plans/plan-free').get()
  const stores = await db.collection('stores').get()
  let repairedSubscriptions = 0
  let projectedStores = 0
  let projectedProducts = 0
  let projectedCategories = 0

  for (const storeDoc of stores.docs) {
    const store = storeDoc.data()
    const subSnap = await db.collection('subscriptions').where('storeId', '==', storeDoc.id).get()
    const subs = subSnap.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .sort((a, b) => (b.data.createdAt?.seconds || 0) - (a.data.createdAt?.seconds || 0))
    let pointed = store.activeSubscriptionId ? subs.find((s) => s.id === store.activeSubscriptionId) : null
    if (!pointed) pointed = subs.find((s) => effective(s.data)) || subs[0]
    if (!pointed && planFree.exists) {
      const ref = db.collection('subscriptions').doc()
      await ref.set({
        storeId: storeDoc.id, planId: 'plan-free', planName: planFree.data()?.name || 'FREE',
        status: 'active', billingCycle: 'monthly', ordersUsed: 0, periodNumber: 1,
        createdAt: ts(), updatedAt: ts(), activatedAt: ts(), createdBy: 'local-repair',
      })
      pointed = { id: ref.id, data: { status: 'active', planId: 'plan-free' } }
    }
    if (pointed && (!store.activeSubscriptionId || store.activeSubscriptionId !== pointed.id)) {
      await storeDoc.ref.set({ activeSubscriptionId: pointed.id, updatedAt: ts() }, { merge: true })
      repairedSubscriptions += 1
    }

    await db.doc(`publicStores/${storeDoc.id}`).set(publicStore(store), { merge: true })
    projectedStores += 1
    const products = await db.collection('products').where('storeId', '==', storeDoc.id).get()
    for (const pDoc of products.docs) {
      const p = pDoc.data()
      const ref = db.doc(`publicStores/${storeDoc.id}/products/${pDoc.id}`)
      if (p.active !== true) await ref.delete()
      else {
        await ref.set({ storeId: storeDoc.id, name: p.name || '', description: p.description || '', images: p.images || [], price: Number(p.price || 0), oldPrice: p.oldPrice == null ? null : Number(p.oldPrice), active: true, featured: p.featured === true, categoryId: p.categoryId || null, variants: p.variants || [], colors: p.colors || [], sizes: p.sizes || [], colorOptions: p.colorOptions || [], pricingMode: p.pricingMode || 'unit', quantityTiers: p.quantityTiers || [], quantityPricingStrategy: p.quantityPricingStrategy || 'cap', updatedAt: ts() }, { merge: true })
        projectedProducts += 1
      }
    }
    const categories = await db.collection('categories').where('storeId', '==', storeDoc.id).get()
    for (const cDoc of categories.docs) {
      const c = cDoc.data()
      const ref = db.doc(`publicStores/${storeDoc.id}/categories/${cDoc.id}`)
      if (c.active === false) await ref.delete()
      else {
        await ref.set({ storeId: storeDoc.id, name: c.name || '', image: c.image || null, active: true, sortOrder: Number(c.sortOrder || c.order || 0), updatedAt: ts() }, { merge: true })
        projectedCategories += 1
      }
    }
  }
  console.log(JSON.stringify({ repairedSubscriptions, projectedStores, projectedProducts, projectedCategories }))
  await admin.app().delete()
}

main().catch(async (err) => { console.error(err); await admin.app().delete().catch(() => {}); process.exit(1) })

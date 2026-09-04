// Seed script: creates the first platform admin (and a default plan) in the
// Firebase Emulator only.
//
//   node scripts/seed-superadmin.mjs <uid> <email>
//
// Run from `firebase emulators:exec 'node scripts/seed-superadmin.cjs ...'`.

const admin = require('firebase-admin')

const uid = process.argv[2]
const email = process.argv[3]

if (!uid || !email) {
  console.error('Usage: node scripts/seed-superadmin.mjs <uid> <email>')
  process.exit(1)
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to seed: FIRESTORE_EMULATOR_HOST is not set. This script is emulator-only.')
  process.exit(1)
}

// A production project can expose the same Admin SDK API as the emulator. Do
// not rely on the project ID alone (the local emulator intentionally uses the
// default project ID); require an explicitly local emulator host as well.
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST.split(':')[0]
if (!['localhost', '127.0.0.1'].includes(firestoreHost)) {
  console.error('Refusing to seed: FIRESTORE_EMULATOR_HOST must point to localhost or 127.0.0.1.')
  process.exit(1)
}

admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || 'mk-store-app',
})

const db = admin.firestore()

async function main() {
  await db.doc(`users/${uid}`).set({
    uid,
    email,
    name: 'Super Admin',
    role: 'superAdmin',
    storeIds: [],
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid,
  })

  const existing = await db.collection('plans').where('name', '==', 'Free').get()
  if (existing.empty) {
    await db.collection('plans').add({
      name: 'Free',
      description: 'باقة مجانية تجريبية',
      priceMonthly: 0,
      priceYearly: 0,
      productLimit: 10,
      orderLimitPerMonth: 50,
      features: ['10 منتجات', '50 طلب/شهر'],
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
    })
  }

  await db.doc(`settings/platform`).set({
    id: 'platform',
    currency: 'EGP',
    defaultPlanId: (await db.collection('plans').where('name', '==', 'Free').get()).docs[0]?.id,
    registrationEnabled: true,
    maintenanceMode: false,
    contactEmail: email,
    supportPhone: '01000000000',
    maxStoresPerMerchant: 1,
    allowCustomerAccounts: true,
    paymentInstructions:
      'فودافون كاش: 0100 000 0000\nإنستاباي: 0100 000 0000\n\nبعد إتمام التحويل املأ النموذج أدناه برقم العملية وسيتم تفعيل باقتك خلال ساعات عمل قليلة.',
    paymentContact: email,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  console.log('✅ Seeded platform admin', uid)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

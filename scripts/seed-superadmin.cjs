// Seed script: creates the first platform admin (and a default plan) in the
// Firebase Emulator (or production if run with `firebase deploy` scope).
//
//   node scripts/seed-superadmin.mjs <uid> <email>
//
// Requires the Functions/Emulator environment OR a service account. Run from
// `firebase emulators:exec 'node scripts/seed-superadmin.mjs ...'`.

const admin = require('firebase-admin')

const uid = process.argv[2]
const email = process.argv[3]

if (!uid || !email) {
  console.error('Usage: node scripts/seed-superadmin.mjs <uid> <email>')
  process.exit(1)
}

const service = process.env.FIRESTORE_EMULATOR_HOST
  ? undefined
  : JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}')

admin.initializeApp({
  credential: service
    ? admin.credential.applicationDefault()
    : undefined,
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
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  console.log('✅ Seeded platform admin', uid)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

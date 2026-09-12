import admin from 'firebase-admin'

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('emulators required')
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'mk-store-app' })
const db = admin.firestore()

async function main() {
  const providerId = 'qa-commercial-wasla'
  const storeId = 'qa-commercial-store'
  const uid = 'qa-commercial-merchant'
  await db.doc(`users/${uid}`).set({ uid, role: 'merchant', active: true, storeIds: [storeId] })
  await db.doc(`stores/${storeId}`).set({ id: storeId, ownerId: uid, shippingProfile: { expectedMonthlyShipments: 10, targetGovernorates: ['أسوان'] } })
  await db.doc(`shippingProviders/${providerId}`).set({ id: providerId, name: 'QA Wasla', slug: 'qa-wasla', status: 'active', integrationType: 'api', adapterStatus: 'production_ready', partnership: { status: 'active' }, eligibilityConfig: { enabled: true, minimumMerchantMonthlyShipments: 200 }, services: [{ code: 'standard', zoneRules: [{ governorates: ['القاهرة'] }] }] })
  await db.doc(`storeShippingProviders/${storeId}_${providerId}`).set({ storeId, providerId, enabled: true })
  const agreement = { providerId, status: 'active', currency: 'EGP', settlementCycle: 'monthly', volumeMetric: 'sourced_shipments', tiers: [{ minShipments: 0, maxShipments: null, deliveredCommission: 2, returnedCommission: 1 }] }
  await db.doc(`shippingProviderCommercialAgreements/${providerId}`).set(agreement)
  const legacy = await db.doc(`shippingProviders/legacy-no-metadata`).get()
  if (legacy.exists && legacy.data()?.id !== legacy.id) throw new Error('legacy provider id changed')
  console.log('shipping commercial fixtures: PASS')
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })

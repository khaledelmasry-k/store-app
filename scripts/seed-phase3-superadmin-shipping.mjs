// Test-only fixture. It writes exclusively to the configured local Firestore emulator.
import admin from 'firebase-admin'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
admin.initializeApp({ projectId: 'mk-store-app' })

const db = admin.firestore()
const providers = [
  { id: 'wasla-test-carrier', name: 'وصلة', slug: 'wasla-test-carrier', integrationType: 'api', adapterStatus: 'production_ready', supportsTracking: true, supportsWebhooks: false, supportsPickup: true },
  { id: 'manual-test-carrier', name: 'Manual Carrier', slug: 'manual-test-carrier', integrationType: 'manual', adapterStatus: 'not_implemented', supportsTracking: false, supportsWebhooks: false, supportsPickup: true },
  { id: 'future-test-carrier', name: 'Future Carrier', slug: 'future-test-carrier', integrationType: 'api', adapterStatus: 'production_ready', supportsTracking: true, supportsWebhooks: true, supportsPickup: true },
]

for (const provider of providers) {
  await db.doc(`shippingProviders/${provider.id}`).set({
    ...provider,
    status: 'active',
    credentialMode: 'merchant',
    supportsCOD: true,
    supportsReturns: false,
    partnership: { status: 'active' },
    eligibilityConfig: { enabled: true, minimumMerchantMonthlyShipments: 0 },
    capabilities: provider.id === 'future-test-carrier'
      ? ['getRates', 'createShipment', 'trackShipment', 'getDocument', 'webhook', 'locations']
      : [],
    services: [{ code: 'standard', name: 'Standard Delivery', enabled: true, rateMode: 'zone', zoneRules: [{ zoneId: 'cairo', zoneName: 'القاهرة', governorates: ['القاهرة'], baseRate: 50 }] }],
  })
  await db.doc(`shippingProviderCommercialAgreements/${provider.id}`).set({
    providerId: provider.id,
    status: 'active',
    currency: 'EGP',
    settlementCycle: 'monthly',
    tiers: [{ minShipments: 0, maxShipments: null, deliveredCommission: 1, returnedCommission: 1 }],
  })
}

console.log('Phase 3 SuperAdmin shipping fixture seeded in Firestore emulator.')

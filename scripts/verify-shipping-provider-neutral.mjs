/* Provider-neutral shipping contract checks. Uses a local fake Wasla server only. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'

process.env.FUNCTIONS_EMULATOR = 'true'
const require = createRequire(import.meta.url)
const {
  getShippingAdapter,
  getShippingProviderConfig,
  prepareShippingProviderConfig,
  resolveProviderTrackingNumber,
  sanitizeShippingCredentials,
  supportsShippingCapability,
} = require('../functions/lib/shipping/registry.js')

const locations = [{ id: 1, name: 'القاهرة', cities: [{ id: 101, name: 'مدينة القاهرة' }] }]
let postedShipment = null
const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json')
  if (request.url?.startsWith('/api/v1/merchant/locations')) return response.end(JSON.stringify({ data: locations }))
  if (request.url === '/api/v1/merchant/shipping-quote?pickup_governorate_id=1&delivery_governorate_id=1') return response.end(JSON.stringify({ data: { covered: true, shipping_fee_amount: 49, shipping_fee_currency: 'EGP' } }))
  if (request.method === 'POST' && request.url === '/api/v1/merchant/shipments') {
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      postedShipment = JSON.parse(body)
      response.end(JSON.stringify({ data: { id: '12345678-1234-1234-1234-123456789abc', status: 'CREATED' } }))
    })
    return
  }
  response.statusCode = 404
  response.end(JSON.stringify({ message: 'not found' }))
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address()?.port
const wasla = getShippingAdapter('wasla', 'api')
const manual = getShippingAdapter('anything', 'manual')
let passed = 0
async function check(name, fn) { await fn(); passed += 1; console.log(`PASS ${name}`) }

try {
  await check('WASLA EXISTING CONFIG READ', async () => {
    const legacy = { waslaPickupGovernorateId: 1, waslaPickupCityId: 101, waslaPickupLocationName: 'Store', waslaPickupAddressLine1: 'Street', waslaGovernorateIds: {}, waslaCityIds: {} }
    assert.equal(getShippingProviderConfig(wasla, legacy).waslaPickupCityId, 101)
  })
  await check('WASLA NAMESPACED CONFIG WRITE', async () => {
    const write = prepareShippingProviderConfig(wasla, { waslaPickupGovernorateId: 1, waslaPickupCityId: 101, waslaPickupLocationName: 'Store', waslaPickupAddressLine1: 'Street' })
    assert.equal(write.providerConfig.pickup.cityId, 101)
    assert.equal(write.legacyConfig.waslaPickupCityId, 101)
  })
  const context = { provider: { id: 'same-provider-id', slug: 'wasla', apiBaseUrl: `http://127.0.0.1:${port}` }, config: { providerConfig: { wasla: { pickup: { governorateId: 1, cityId: 101, locationName: 'Store', addressLine1: 'Street' }, destinationMappings: { governorateIds: {}, cityIds: {} } } } }, credentials: { apiKey: 'fake-only' } }
  await check('WASLA RATE QUOTE', async () => {
    const rates = await wasla.getRates(context, { governorate: 'القاهرة', city: 'مدينة القاهرة', currency: 'EGP' })
    assert.equal(rates[0].amount, 49)
  })
  await check('WASLA TRACKING', async () => {
    assert.equal(resolveProviderTrackingNumber(wasla, { providerShipmentId: '12345678-1234-1234-1234-123456789abc' }), 'WS12345678EG')
  })
  await check('WASLA SHIPMENT CREATION CONTRACT', async () => {
    const result = await wasla.createShipment(context, { orderId: 'fake-order', idempotencyKey: 'fake-idempotency', order: { orderNumber: 'ORD-1', customerName: 'Customer', phone: '01000000000', address: 'Address', governorate: 'القاهرة', city: 'مدينة القاهرة', paymentMethod: 'cod', totalPrice: 149, currency: 'EGP', items: [{ name: 'Item', quantity: 1, price: 100 }] } })
    assert.equal(result.providerShipmentId, '12345678-1234-1234-1234-123456789abc')
    assert.equal(postedShipment.pickup_city_id, 101)
  })
  await check('MANUAL PROVIDER', async () => {
    assert.equal(supportsShippingCapability(manual, 'createShipment'), true)
    const shipment = await manual.createShipment({ provider: { id: 'manual-provider', name: 'Manual' }, config: {} }, { orderId: 'order-1' })
    assert.match(shipment.providerShipmentId, /^manual-order-1-/)
  })
  await check('UNKNOWN PROVIDER FAILS SAFELY', async () => assert.equal(getShippingAdapter('unknown-provider', 'api'), null))
  await check('UNSUPPORTED CAPABILITY FAILS SAFELY', async () => {
    assert.equal(supportsShippingCapability(wasla, 'cancelShipment'), false)
    assert.throws(() => sanitizeShippingCredentials(getShippingAdapter('unknown-provider', 'api'), { apiKey: 'x' }))
  })
  console.log(`SHIPPING_PROVIDER_NEUTRAL ${passed}/8 PASS`)
} finally {
  await new Promise((resolve) => server.close(resolve))
}

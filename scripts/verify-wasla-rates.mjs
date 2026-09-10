import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'

process.env.FUNCTIONS_EMULATOR = 'true'

const require = createRequire(import.meta.url)
const { waslaAdapter } = require('../functions/lib/shipping/wasla.js')

const governorates = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحر الأحمر', 'البحيرة', 'الفيوم',
  'الغربية', 'الإسماعيلية', 'المنوفية', 'المنيا', 'القليوبية', 'الوادي الجديد', 'السويس',
  'أسوان', 'أسيوط', 'بني سويف', 'بورسعيد', 'دمياط', 'الشرقية', 'جنوب سيناء',
  'كفر الشيخ', 'مطروح', 'الأقصر', 'قنا', 'شمال سيناء', 'سوهاج',
]

const providerNames = [
  'القاهره', 'الجيزه', 'الاسكندريه', 'الدقهليه', 'البحر الاحمر', 'البحيره', 'الفيوم',
  'الغربيه', 'الاسماعيليه', 'المنوفيه', 'المنيا', 'القليوبيه', 'الوادي الجديد', 'السويس',
  'اسوان', 'اسيوط', 'بني سويف', 'بورسعيد', 'دمياط', 'الشرقيه', 'جنوب سيناء',
  'كفر الشيخ', 'مطروح', 'الاقصر', 'قنا', 'شمال سيناء', 'سوهاج',
]

const locations = providerNames.map((name, index) => ({
  id: index + 1,
  name,
  name_ar: name,
  cities: [{ id: index + 101, name: `مدينة ${name}` }],
}))

let quoteResponse = { covered: true, shipping_fee_amount: 49, shipping_fee_currency: 'EGP' }
let lastQuoteUrl = ''
let shipmentPosts = 0

const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json')
  if (request.url?.startsWith('/api/v1/merchant/locations')) {
    response.end(JSON.stringify({ data: locations }))
    return
  }
  if (request.url?.startsWith('/api/v1/merchant/shipping-quote')) {
    lastQuoteUrl = request.url
    response.end(JSON.stringify({ data: quoteResponse }))
    return
  }
  if (request.method === 'POST' && request.url === '/api/v1/merchant/shipments') {
    shipmentPosts += 1
    response.end(JSON.stringify({ data: { id: 'unexpected' } }))
    return
  }
  response.statusCode = 404
  response.end(JSON.stringify({ message: 'not found' }))
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
const port = typeof address === 'object' && address ? address.port : 0
const context = {
  provider: { name: 'Wasla', slug: 'wasla', apiBaseUrl: `http://127.0.0.1:${port}` },
  config: {
    waslaPickupGovernorateId: 1,
    waslaPickupCityId: 101,
    waslaGovernorateIds: {},
    waslaCityIds: {},
    enabledServiceCodes: ['standard'],
  },
  credentials: { apiKey: 'fake-only' },
}

let passed = 0
async function check(name, assertion) {
  await assertion()
  passed += 1
  console.log(`PASS ${name}`)
}

async function rates(governorate, city = '') {
  return await waslaAdapter.getRates(context, {
    governorate, city, subtotal: 100, currency: 'EGP', weightKg: 1,
  })
}

try {
  for (const governorate of governorates) {
    await check(`governorate ${governorate}`, async () => {
      quoteResponse = { covered: true, shipping_fee_amount: 49, shipping_fee_currency: 'EGP' }
      const result = await rates(governorate)
      assert.equal(result.length, 1)
      assert.equal(result[0].amount, 49)
      assert.equal(result[0].serviceCode, 'standard')
      assert.ok(!new URL(lastQuoteUrl, 'http://fake').searchParams.has('delivery_city_id'))
    })
  }
  console.log(`GOVERNORATES ${governorates.length}/27 PASS`)

  await check('configured governorate ID is preferred', async () => {
    context.config.waslaGovernorateIds = { 'اسم خارجي ثابت': 27 }
    await rates('اسم خارجي ثابت')
    assert.equal(new URL(lastQuoteUrl, 'http://fake').searchParams.get('delivery_governorate_id'), '27')
    context.config.waslaGovernorateIds = {}
  })

  for (const [input, expectedId] of [['اسكندرية', 3], ['الدقهليه', 4], ['بنى سويف', 17], ['مرسى مطروح', 23]]) {
    await check(`safe alias ${input}`, async () => {
      await rates(input)
      assert.equal(Number(new URL(lastQuoteUrl, 'http://fake').searchParams.get('delivery_governorate_id')), expectedId)
    })
  }

  await check('unsafe fuzzy governorate does not match', async () => {
    await assert.rejects(() => rates('القاهرة الجديدة'), (error) => error?.code === 'MAPPING_MISSING')
  })

  for (const covered of [true, 1, '1', 'true', 'TRUE']) {
    await check(`covered form ${String(covered)}`, async () => {
      quoteResponse = { covered, shipping_fee_amount: 49, shipping_fee_currency: 'EGP' }
      assert.equal((await rates('القاهرة'))[0].amount, 49)
    })
  }

  for (const uncovered of [false, 0, '0', 'false']) {
    await check(`uncovered form ${String(uncovered)}`, async () => {
      quoteResponse = { covered: uncovered, shipping_fee_amount: 0, shipping_fee_currency: 'EGP' }
      await assert.rejects(() => rates('القاهرة'), (error) => error?.code === 'NOT_COVERED')
    })
  }

  await check('alternate is_covered form is accepted', async () => {
    quoteResponse = { is_covered: 1, shipping_fee_amount: 49, shipping_fee_currency: 'EGP' }
    assert.equal((await rates('القاهرة'))[0].serviceCode, 'standard')
  })

  await check('malformed quote never becomes free shipping', async () => {
    quoteResponse = { covered: true, shipping_fee_currency: 'EGP' }
    await assert.rejects(() => rates('القاهرة'), (error) => error?.code === 'PROVIDER_REJECTED')
  })

  await check('shipment creation still requires an exact city mapping', async () => {
    await assert.rejects(() => waslaAdapter.createShipment(context, {
      orderId: 'fake-order', orderNumber: 'FAKE-1', customerName: 'Fake Customer', phone: '01000000000',
      governorate: 'القاهرة', city: 'مدينة غير موجودة', address: 'Fake address', subtotal: 100,
      shippingFee: 49, discount: 0, totalPrice: 149, items: [{ name: 'Fake', quantity: 1 }],
    }), (error) => error?.code === 'MAPPING_MISSING')
    assert.equal(shipmentPosts, 0)
  })

  console.log(`WASLA_RATE_TESTS ${passed} passed, 0 failed, 0 skipped, 0 flaky, 0 not run`)
} finally {
  await new Promise((resolve) => server.close(resolve))
}

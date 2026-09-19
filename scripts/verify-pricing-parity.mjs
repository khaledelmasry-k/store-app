#!/usr/bin/env node
/**
 * Quantity-pricing parity guard.
 *
 * The cart total (src/shared/utils/pricing.ts) and the order total
 * (functions/src/pricing.ts) are two implementations of one set of rules,
 * because Cloud Functions is a separate package and cannot import from src/.
 * Every time they have drifted, the storefront quoted one price and the order
 * charged another — silently, in the merchant's or the customer's favour.
 *
 * This script compiles both engines from source and runs them through the same
 * case matrix. Any disagreement fails with a non-zero exit code.
 *
 *   node scripts/verify-pricing-parity.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const out = mkdtempSync(join(tmpdir(), 'pricing-parity-'))

/** Compile one dependency-free pricing module to ESM and import it. */
async function loadEngine(tsPath, outName) {
  try {
    execFileSync(
      process.execPath,
      [
        join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
        join(ROOT, tsPath),
        '--outDir', join(out, outName),
        '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
        '--skipLibCheck', '--ignoreConfig',
      ],
      { stdio: 'pipe' },
    )
  } catch (error) {
    console.error(`Failed to compile ${tsPath}:\n${error.stdout?.toString() || error.message}`)
    process.exit(1)
  }
  // tsc anchors its output at the common root of the file AND anything it
  // imports (the type-only `../types` import pulls the root up a level), so the
  // emitted path is not predictable — locate it by name instead.
  const base = tsPath.split('/').pop().replace(/\.ts$/, '.js')
  const emitted = find(join(out, outName), base)
  if (!emitted) {
    console.error(`Compiled ${tsPath} but could not locate ${base} in the output.`)
    process.exit(1)
  }
  return import(pathToFileURL(emitted).href)
}

function find(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const hit = find(full, name)
      if (hit) return hit
    } else if (entry.name === name) {
      return full
    }
  }
  return null
}

const CASES = [
  ['bundles only, exact tier', 100, 3, [{ quantity: 1, price: 100 }, { quantity: 3, price: 250 }], 'cap'],
  ['bundles only, below lowest tier', 100, 1, [{ quantity: 2, price: 180 }], 'cap'],
  ['mixed legacy + bundle tiers', 100, 3, [{ minQuantity: 2, maxQuantity: 5, price: 90 }, { quantity: 3, price: 250 }], 'cap'],
  ['overflow above top tier, no qty:1', 100, 5, [{ quantity: 2, price: 180 }, { quantity: 4, price: 340 }], 'cap'],
  ['overflow above top tier, with qty:1', 100, 5, [{ quantity: 1, price: 95 }, { quantity: 4, price: 340 }], 'cap'],
  ['repeat strategy', 100, 7, [{ quantity: 3, price: 250 }], 'repeat'],
  ['last strategy', 100, 9, [{ quantity: 2, price: 180 }, { quantity: 4, price: 340 }], 'last'],
  ['legacy range tiers only', 100, 4, [{ minQuantity: 2, maxQuantity: 9, price: 80 }], 'cap'],
  ['no tiers at all', 100, 3, [], 'cap'],
  ['single unit, no tiers', 250, 1, null, 'cap'],
  // Prices that do not divide cleanly — these are what produce float tails.
  ['thirds of a pound', 33.33, 3, null, 'cap'],
  ['tier total over odd qty', 100, 7, [{ quantity: 1, price: 99.99 }, { quantity: 3, price: 250.05 }], 'cap'],
  ['repeat with odd remainder', 19.99, 5, [{ quantity: 2, price: 37.77 }], 'repeat'],
]

// Coupon amounts the storefront previews and the order then charges. The
// preview (quoteCoupon) and the charge (createOrder) call one shared helper,
// so this asserts that helper's arithmetic rather than comparing two copies.
const COUPON_CASES = [
  ['10% of 333', { type: 'percent', value: 10 }, 333, 33.3],
  ['15% of 99.99', { type: 'percent', value: 15 }, 99.99, 15],
  ['fixed 50 on 40 (capped)', { type: 'fixed', value: 50 }, 40, 40],
  ['fixed 50 on 400', { type: 'fixed', value: 50 }, 400, 50],
  ['over-100% clamped', { type: 'percent', value: 250 }, 200, 200],
  ['zero value', { type: 'percent', value: 0 }, 200, 0],
  ['negative value', { type: 'fixed', value: -10 }, 200, 0],
]

const client = await loadEngine('src/shared/utils/pricing.ts', 'client')
const server = await loadEngine('functions/src/pricing.ts', 'server')

let failures = 0
console.log('case'.padEnd(36), 'cart'.padStart(9), 'order'.padStart(9))
for (const [name, price, qty, tiers, strategy] of CASES) {
  // The cart renders lineSubtotal(); the order writes lineTotalForItem().
  const cart = client.lineSubtotal({ price, quantity: qty, pricingMode: 'quantity', quantityTiers: tiers, quantityPricingStrategy: strategy })
  const order = server.lineTotalForItem(price, qty, 'quantity', tiers, strategy).lineTotal
  const ok = Object.is(cart, order)
  if (!ok) failures++
  console.log(name.padEnd(36), String(cart).padStart(9), String(order).padStart(9), ok ? '✓' : '✗ MISMATCH')
}

// Money must never carry a binary-float tail into the order document.
console.log('')
let moneyBad = 0
for (const [name, price, qty, tiers, strategy] of CASES) {
  const v = server.lineTotalForItem(price, qty, 'quantity', tiers, strategy).lineTotal
  const clean = Object.is(v, server.roundMoney(v))
  if (!clean) { moneyBad++; console.log('float tail:'.padEnd(20), name, v) }
}
console.log(moneyBad === 0 ? 'No float tails in any line total.' : `${moneyBad} line total(s) carry a float tail.`)

console.log('')
console.log('coupon case'.padEnd(36), 'expected'.padStart(9), 'actual'.padStart(9))
let couponBad = 0
for (const [name, coupon, subtotal, expected] of COUPON_CASES) {
  const actual = server.couponDiscount(coupon, subtotal)
  const ok = Object.is(actual, expected)
  if (!ok) couponBad++
  console.log(name.padEnd(36), String(expected).padStart(9), String(actual).padStart(9), ok ? '✓' : '✗ MISMATCH')
}

rmSync(out, { recursive: true, force: true })

if (couponBad > 0) {
  console.error(`\n${couponBad} coupon case(s) wrong — checkout would preview or charge the wrong discount.`)
  process.exit(1)
}
if (moneyBad > 0) {
  console.error('\nLine totals carry float tails — round them before they reach the order document.')
  process.exit(1)
}
if (failures > 0) {
  console.error(`\n${failures} case(s) disagree — the cart and the order would charge different amounts.`)
  console.error('Reconcile src/shared/utils/pricing.ts and functions/src/pricing.ts before shipping.')
  process.exit(1)
}
console.log(`\nAll ${CASES.length} cases agree — cart and order totals match.`)

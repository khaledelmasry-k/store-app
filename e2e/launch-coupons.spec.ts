import { test, expect } from '@playwright/test'
import { CANONICAL_PLANS } from '../src/shared/plans/catalog'

test.describe('launch subscription coupons', () => {
  test('WASLA100 eligible plans and canonical prices', async () => {
    const expected: Record<string, number> = { 'plan-basic': 149, 'plan-starter': 249, 'plan-growth': 399, 'plan-pro': 649 }
    for (const [id, price] of Object.entries(expected)) {
      const plan = CANONICAL_PLANS.find((p) => p.id === id)
      expect(plan?.priceMonthly).toBe(price)
      expect(plan?.trialDays).toBe(3)
    }
    expect(CANONICAL_PLANS.find((p) => p.id === 'plan-lifetime')?.oneTimePrice).toBe(4999)
    expect(CANONICAL_PLANS.find((p) => p.id === 'plan-enterprise')).toBeUndefined()
  })
})

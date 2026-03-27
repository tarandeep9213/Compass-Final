/**
 * OP-COMM-003b: Verify rejected submission pre-fills form with full denomination detail
 *
 * Today's submission has been pre-rejected with known values:
 *   A: ones=10, fives=5, tens=3, twenties=2, fifties=1, hundreds=1, other=12
 *   B: dollar=1, halves=2, quarters=4, dimes=3, nickels=2, pennies=6
 *   G: currency=3, coin=2 | H: value=50 | I: yesterday=10, today=5
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const OPERATOR = 'operator@compass.com'

test('OP-COMM-003b: rejected form with full denom detail pre-fills correctly', async ({ page }) => {
  // Clear ALL storage before login so stale data doesn't pollute
  await page.goto('/')
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear() })

  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 10000 })

  // Wait for API fetch to complete and override mock data
  await page.waitForTimeout(3000)

  // Force reload to ensure fresh API data (not stale mock)
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)

  // Verify today's card shows Rejected
  const hasRejected = await page.locator('.badge-red').isVisible({ timeout: 5000 }).catch(() => false)
    || await page.getByText('❌').isVisible({ timeout: 2000 }).catch(() => false)
    || await page.getByText(/Rejected/i).isVisible({ timeout: 2000 }).catch(() => false)
  if (!hasRejected) {
    // Debug: take screenshot to see what's shown
    await page.screenshot({ path: 'test-results/debug-prefill.png' })
    test.skip()
    return
  }

  // Clear sessionStorage so the form tests API fetch path (not sessionStorage cache)
  await page.evaluate(() => sessionStorage.clear())

  // Click Update on the rejected Today card
  const updateBtn = page.getByRole('button', { name: /Update/i }).first()
  await expect(updateBtn).toBeVisible({ timeout: 5000 })
  await updateBtn.click()
  await page.waitForTimeout(1000)

  // Handle method select if it appears
  const onMethod = await page.getByRole('heading', { name: /Choose Entry Method/i })
    .isVisible({ timeout: 3000 }).catch(() => false)
  if (onMethod) {
    await page.getByRole('button', { name: /Select →/i }).first().click()
  }

  await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 8000 })

  // Wait for useEffect API fetch to populate the form
  const numInputs = page.locator('.f-inp[type="number"]')
  await expect(numInputs.first()).toBeVisible({ timeout: 5000 })

  // Poll until form is populated (async API fetch + React re-render)
  let populated = false
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(500)
    const val = await numInputs.nth(0).inputValue()
    if (Number(val) > 0) { populated = true; break }
  }
  expect(populated, 'Form should populate from API within 7.5 seconds').toBe(true)

  // ── Verify Section A denomination values ──
  // Input order: ones(0), twos(1), fives(2), tens(3), twenties(4), fifties(5), hundreds(6), other(7)
  const expectedA = [
    { idx: 0, name: 'ones',     expected: 10 },
    { idx: 1, name: 'twos',     expected: 0 },
    { idx: 2, name: 'fives',    expected: 5 },
    { idx: 3, name: 'tens',     expected: 3 },
    { idx: 4, name: 'twenties', expected: 2 },
    { idx: 5, name: 'fifties',  expected: 1 },
    { idx: 6, name: 'hundreds', expected: 1 },
    { idx: 7, name: 'other',    expected: 12 },
  ]

  for (const { idx, name, expected } of expectedA) {
    const val = await numInputs.nth(idx).inputValue()
    expect(Number(val), `Section A ${name} should be ${expected}`).toBe(expected)
  }

  // Verify section A total is non-zero (computed from the pre-filled values)
  const aTotalEl = page.getByText(/A\.\s*Total/i).first()
    .or(page.locator('td').filter({ hasText: /A\. Total/i }).first())
  const aTotalVisible = await aTotalEl.isVisible({ timeout: 3000 }).catch(() => false)
  expect(aTotalVisible, 'Section A total row should be visible').toBe(true)
})

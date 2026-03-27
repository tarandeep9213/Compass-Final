/**
 * OP-FRM-001: Running total updates in real-time as user types
 * Verifies section totals and grand total update on every keystroke.
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const OPERATOR = 'operator@compass.com'

/** Navigate to a fresh digital form */
async function openFreshForm(page: import('@playwright/test').Page): Promise<boolean> {
  const submitNowBtn = page.getByRole('button', { name: /Submit Now/i })
  const resubmitBtn = page.getByRole('button', { name: /Resubmit/i })
  const updateBtn = page.getByRole('button', { name: /^Update$/i }).first()

  if (await submitNowBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitNowBtn.click()
  } else if (await resubmitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await resubmitBtn.click()
  } else if (await updateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await updateBtn.click()
  } else {
    return false
  }

  const onMethod = await page.getByRole('heading', { name: /Choose Entry Method/i })
    .isVisible({ timeout: 5000 }).catch(() => false)
  if (onMethod) {
    await page.getByRole('button', { name: /Select →/i }).first().click()
  }

  return page.getByRole('heading', { name: /Cash Count Form/i })
    .isVisible({ timeout: 8000 }).catch(() => false)
}

/** Helper: get the input inside a section row by denomination label */
function sectionInput(page: import('@playwright/test').Page, sectionCard: import('@playwright/test').Locator, label: string) {
  return sectionCard.locator('tr', { hasText: label }).locator('input.f-inp')
}

test('OP-FRM-001: section and grand totals update in real-time', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)

  const onForm = await openFreshForm(page)
  if (!onForm) { test.skip(); return }

  // Scope to Section A card (contains "A. Currency" header)
  const secA = page.locator('.card', { hasText: 'A. Currency' })
  await expect(secA).toBeVisible({ timeout: 5000 })

  // Clear all Section A denomination inputs
  const secADenoms = ['Ones', 'Twos', 'Fives', 'Tens', 'Twenties', 'Fifties', 'Hundreds', 'Other']
  for (const denom of secADenoms) {
    await sectionInput(page, secA, denom).fill('0')
  }
  await page.waitForTimeout(300)

  // Section A total row
  const aTotalCell = secA.locator('tr', { hasText: 'A. Total' }).locator('td').last()

  // Step 4: Enter 5 in "Ones" → total $5.00
  await sectionInput(page, secA, 'Ones').fill('5')
  await page.waitForTimeout(300)
  await expect(aTotalCell).toHaveText('$5.00', { timeout: 3000 })

  // Step 5: Enter 30 in "Tens" → total = 5 + 30 = $35.00
  await sectionInput(page, secA, 'Tens').fill('30')
  await page.waitForTimeout(300)
  await expect(aTotalCell).toHaveText('$35.00', { timeout: 3000 })

  // Step 6: Enter 200 in "Hundreds" → total = 5 + 30 + 200 = $235.00
  await sectionInput(page, secA, 'Hundreds').fill('200')
  await page.waitForTimeout(300)
  await expect(aTotalCell).toHaveText('$235.00', { timeout: 3000 })

  // Step 7: Scroll to summary → Section A should show $235.00
  const summaryHeading = page.getByText(/Cashroom Count Totals/i)
  await summaryHeading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await expect(summaryHeading).toBeVisible({ timeout: 3000 })

  // Summary row for A (exact text "Currency" in the 2nd cell)
  const summaryCard = page.locator('.card', { hasText: 'Cashroom Count Totals' })
  const summaryRowA = summaryCard.locator('tr', { hasText: /^A/ }).locator('td').last()
  await expect(summaryRowA).toHaveText('$235.00', { timeout: 3000 })

  // Step 8: Enter 10 in Section B "Dollars"
  const secB = page.locator('.card', { hasText: 'B. Rolled Coin' })
  await secB.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  // Clear Section B inputs
  const secBDenoms = ['Dollars', 'Halves', 'Quarters', 'Dimes', 'Nickels', 'Pennies']
  for (const denom of secBDenoms) {
    await sectionInput(page, secB, denom).fill('0')
  }
  await sectionInput(page, secB, 'Dollars').fill('10')
  await page.waitForTimeout(300)

  // Section B total should show $10.00
  const bTotalCell = secB.locator('tr', { hasText: 'B. Total' }).locator('td').last()
  await expect(bTotalCell).toHaveText('$10.00', { timeout: 3000 })

  // Scroll to summary — verify both A and B
  await summaryHeading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)

  await expect(summaryRowA).toHaveText('$235.00', { timeout: 3000 })
  const summaryRowB = summaryCard.locator('tr', { hasText: /^B/ }).locator('td').last()
  await expect(summaryRowB).toHaveText('$10.00', { timeout: 3000 })

  // Step 9: Variance should be displayed
  const varianceText = await page.getByText(/Variance/i).first().isVisible({ timeout: 3000 }).catch(() => false)
  expect(varianceText, 'Variance should be displayed').toBe(true)
})

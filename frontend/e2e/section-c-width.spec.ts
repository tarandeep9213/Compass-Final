import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

// Regression guard for: "Coins in Counting Machines" (Section C) inputs used to be
// width=50 so only ~3 digits were readable. After fix, Section C uses the default
// NumInput width (72px) matching Sections A, B, D.

async function openDigitalForm(page: import('@playwright/test').Page) {
  await loginAs(page, 'operator@compass.com')

  // Click Submit Now, or fall back to a recent past date
  const submitNow = page.getByRole('button', { name: /Submit Now/i })
  const resubmit = page.getByRole('button', { name: /Resubmit/i })
  if (await submitNow.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submitNow.click()
  } else if (await resubmit.isVisible({ timeout: 1000 }).catch(() => false)) {
    await resubmit.click()
  } else {
    const d = new Date(); d.setDate(d.getDate() - 3)
    await page.fill('input[type="date"]', d.toISOString().split('T')[0])
    await page.getByRole('button', { name: /Go →/i }).click()
  }

  // Method select → Digital Form
  const onMethod = await page.getByRole('heading', { name: /Choose Entry Method/i })
    .isVisible({ timeout: 5000 }).catch(() => false)
  if (onMethod) {
    await page.getByRole('button', { name: /Select →/i }).first().click()
  }
  await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 10000 })
}

test('Section C: NumInputs render at default width (≥72px)', async ({ page }) => {
  await openDigitalForm(page)

  // Section C heading sits inside its own card — locate the card then its inputs.
  const secCCard = page.locator('.card').filter({
    has: page.getByRole('heading', { name: /Coins in Counting Machines/i }),
  })
  await expect(secCCard).toBeVisible()

  const cInputs = secCCard.locator('input.f-inp[type="number"]')
  const count = await cInputs.count()
  expect(count).toBeGreaterThanOrEqual(12) // 6 denoms × 2 machines

  // Every Section C input must be ≥ 72 px wide (the shared default).
  for (let i = 0; i < count; i++) {
    const box = await cInputs.nth(i).boundingBox()
    expect(box, `Section C input #${i} must have a bounding box`).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(72)
  }
})

test('Section C: entering a 7-digit value is fully visible (no horizontal truncation)', async ({ page }) => {
  await openDigitalForm(page)

  const secCCard = page.locator('.card').filter({
    has: page.getByRole('heading', { name: /Coins in Counting Machines/i }),
  })
  const firstCInput = secCCard.locator('input.f-inp[type="number"]').first()
  await firstCInput.fill('1234567')
  await expect(firstCInput).toHaveValue('1234567')

  // The rendered input must be able to show the value without horizontal scroll.
  const metrics = await firstCInput.evaluate((el: HTMLInputElement) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    value: el.value,
  }))
  expect(metrics.value).toBe('1234567')
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1) // +1 px tolerance
})

test('Section C: totals still compute after width fix', async ({ page }) => {
  await openDigitalForm(page)

  const secCCard = page.locator('.card').filter({
    has: page.getByRole('heading', { name: /Coins in Counting Machines/i }),
  })
  const firstRow = secCCard.locator('table.dt tbody tr').first()
  const m1 = firstRow.locator('input.f-inp[type="number"]').nth(0)
  const m2 = firstRow.locator('input.f-inp[type="number"]').nth(1)

  await m1.fill('100')
  await m2.fill('50')

  // "Tot Count" cell (5th column) should show 150.
  const totCountCell = firstRow.locator('td').nth(4)
  await expect(totCountCell).toHaveText('150')
})

test('Regression — Sections A, B, D inputs remain at default width (≥72px)', async ({ page }) => {
  await openDigitalForm(page)

  for (const name of [/^Currency$/i, /Rolled Coin/i, /Bagged Coin/i]) {
    const card = page.locator('.card').filter({
      has: page.getByRole('heading', { name }),
    }).first()
    const firstInput = card.locator('input.f-inp[type="number"]').first()
    await expect(firstInput).toBeVisible()
    const box = await firstInput.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(72)
  }
})

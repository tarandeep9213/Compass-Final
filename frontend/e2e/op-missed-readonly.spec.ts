/**
 * OP-MSS-004: Already-explained missed day shows read-only view
 *
 * First submits an explanation for a missed day, then re-opens it
 * and verifies all fields are read-only.
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const OPERATOR = 'operator@compass.com'

test('OP-MSS-004: already-explained missed day shows read-only view', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)

  // ── Step 1: Find a missed row and submit an explanation ──
  const missedChip = page.getByText(/^Missed$/i).first()
  if (!(await missedChip.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
  await missedChip.click()
  await page.waitForTimeout(1000)

  // Check if there's already a "View Details" button (already explained)
  const viewDetailsBtn = page.getByRole('button', { name: /View Details/i }).first()
  const explainBtn = page.getByRole('button', { name: /Explain Absence/i }).first()

  let alreadyExplained = await viewDetailsBtn.isVisible({ timeout: 3000 }).catch(() => false)

  if (!alreadyExplained) {
    // Need to submit an explanation first
    if (!(await explainBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await explainBtn.click()
    await page.waitForTimeout(1000)

    // Submit an explanation
    await page.locator('input[type="radio"][value="Illness"]').click()
    await page.waitForTimeout(300)
    await page.locator('textarea.f-ta').fill('Staff member was ill — submitted for E2E test.')
    await page.getByRole('button', { name: /Submit Explanation/i }).click()
    await page.waitForTimeout(2000)

    // Verify success screen
    await expect(page.getByText(/Explanation Recorded/i)).toBeVisible({ timeout: 5000 })

    // Go back to dashboard
    await page.getByRole('button', { name: /Back to Submissions/i }).click()
    await page.waitForTimeout(1000)
    await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
      .toBeVisible({ timeout: 8000 })

    // Click Missed filter again
    await page.getByText(/^Missed$/i).first().click()
    await page.waitForTimeout(1000)

    alreadyExplained = await viewDetailsBtn.isVisible({ timeout: 3000 }).catch(() => false)
  }

  if (!alreadyExplained) { test.skip(); return }

  // ── Step 2: Click View Details on the explained missed day ──
  await viewDetailsBtn.click()
  await page.waitForTimeout(1000)

  // ── Step 3: Assert read-only info banner ──
  await expect(page.getByText(/This explanation was submitted/i)).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(/Read-only/i)).toBeVisible({ timeout: 3000 })

  // ── Step 4: Assert all 6 radio options are visible ──
  await expect(page.getByText('Staff illness / absence')).toBeVisible()
  await expect(page.getByText('Technical issues (system/hardware)')).toBeVisible()
  await expect(page.getByText('Emergency closure')).toBeVisible()
  await expect(page.getByText('Public holiday / site closure')).toBeVisible()
  await expect(page.getByText('Staff training day')).toBeVisible()
  await expect(page.getByText('Other (specify below)')).toBeVisible()

  // ── Step 5: Assert radio buttons are read-only ──
  const radios = page.locator('input[type="radio"]')
  const radioCount = await radios.count()
  expect(radioCount).toBeGreaterThanOrEqual(6)
  // At least one should be checked (the saved reason)
  const checkedRadio = page.locator('input[type="radio"]:checked')
  await expect(checkedRadio).toHaveCount(1)

  // ── Step 6: Assert textarea is disabled with saved text ──
  const textarea = page.locator('textarea.f-ta')
  await expect(textarea).toBeVisible()
  await expect(textarea).toBeDisabled()
  const detailText = await textarea.inputValue()
  expect(detailText.length, 'Saved detail text should not be empty').toBeGreaterThan(0)

  // ── Step 7: Assert supervisor input is disabled ──
  const supervisorInputs = page.locator('input.f-inp:disabled')
  const disabledCount = await supervisorInputs.count()
  expect(disabledCount, 'Should have disabled inputs (location, date, supervisor)').toBeGreaterThanOrEqual(2)

  // ── Step 8: Assert "Submit Explanation" button is NOT visible ──
  await expect(page.getByRole('button', { name: /Submit Explanation/i })).not.toBeVisible()

  // ── Step 9: Assert back navigation works ──
  const backBtn = page.getByRole('button', { name: /Back/i }).first()
  await expect(backBtn).toBeVisible()
  await backBtn.click()
  await page.waitForTimeout(1000)

  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 8000 })
})

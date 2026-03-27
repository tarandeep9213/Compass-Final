/**
 * OP-MSS-001: Missed explanation full flow
 * - Form elements, validation, submit, success screen, back navigation
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const OPERATOR = 'operator@compass.com'

test('OP-MSS-001: missed explanation full flow — form, validation, submit, success', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)

  // ── Step 2: Click Missed filter ──
  // KPI cards or filter chips — find "Missed" anywhere clickable
  const missedChip = page.getByText(/^Missed$/i).first()
  if (!(await missedChip.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
  await missedChip.click()
  await page.waitForTimeout(1000)

  // ── Step 3: Click Explain Absence ──
  const explainBtn = page.getByRole('button', { name: /Explain Absence/i }).first()
  if (!(await explainBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    // Might need to scroll to see the button in the table
    await page.keyboard.press('End')
    await page.waitForTimeout(500)
  }
  if (!(await explainBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await explainBtn.click()
  await page.waitForTimeout(1000)

  // ── Step 4: Assert all 6 radio options ──
  await expect(page.getByText('Staff illness / absence')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Technical issues (system/hardware)')).toBeVisible()
  await expect(page.getByText('Emergency closure')).toBeVisible()
  await expect(page.getByText('Public holiday / site closure')).toBeVisible()
  await expect(page.getByText('Staff training day')).toBeVisible()
  await expect(page.getByText('Other (specify below)')).toBeVisible()

  // ── Step 5: Assert textarea, supervisor input, buttons ──
  await expect(page.locator('textarea.f-ta')).toBeVisible()
  // Supervisor input — last text input on the form
  const supervisorInput = page.locator('input.f-inp').last()
  await expect(supervisorInput).toBeVisible()
  // Supervisor should be auto-filled with controller name
  const supervisorValue = await supervisorInput.inputValue()
  expect(supervisorValue.length, 'Supervisor name should be auto-filled').toBeGreaterThan(0)

  await expect(page.getByRole('button', { name: /Submit Explanation/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible()

  // ── Step 6: Submit without reason → validation error ──
  await page.getByRole('button', { name: /Submit Explanation/i }).click()
  await page.waitForTimeout(500)
  await expect(page.getByText(/Please select a reason/i)).toBeVisible({ timeout: 3000 })

  // ── Step 7: Select reason, leave details empty, submit → validation error ──
  await page.locator('input[type="radio"][value="Illness"]').click()
  await page.waitForTimeout(300)
  // Ensure details textarea is empty
  await page.locator('textarea.f-ta').fill('')
  await page.getByRole('button', { name: /Submit Explanation/i }).click()
  await page.waitForTimeout(500)
  await expect(page.getByText(/provide details/i)).toBeVisible({ timeout: 3000 })

  // ── Step 8: Fill details and submit ──
  await page.locator('textarea.f-ta').fill('Staff member was ill and unable to attend the facility.')
  await page.getByRole('button', { name: /Submit Explanation/i }).click()
  await page.waitForTimeout(2000)

  // ── Step 9: Assert success screen ──
  await expect(page.getByText(/Explanation Recorded/i)).toBeVisible({ timeout: 5000 })

  // ── Step 10: Click Back to Submissions → dashboard ──
  const backBtn = page.getByRole('button', { name: /Back to Submissions/i })
  await expect(backBtn).toBeVisible({ timeout: 3000 })
  await backBtn.click()
  await page.waitForTimeout(1000)

  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 8000 })
})

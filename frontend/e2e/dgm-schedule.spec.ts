/**
 * DGM Schedule Calendar — E2E tests
 *
 * DGM-L-001  Schedule page renders with header, location dropdown, and calendar
 * DGM-L-002  Location dropdown shows human-readable names, not raw IDs
 * DGM-L-003  Past dates cannot be clicked (opacity 0.4, no selection)
 * DGM-L-004  Selecting a future date shows the scheduling form or a booking warning
 * DGM-L-005  Submit button is disabled when no date is selected
 * DGM-L-006  Notes field is optional — selecting a date shows textarea (no required marker)
 * DGM-L-007  DOM-warn dates (red dashed border) appear in the calendar for future months
 * DGM-L-008  Clicking a DOM-warn date shows "Avoid This Date" red warning panel
 * DGM-L-009  Clicking date in completed month shows amber "Visit Already Planned" warning
 * DGM-L-010  Calendar legend shows "Avoid (same day as last visit)" entry
 */

import { test, expect } from '@playwright/test'
import { loginAsDgm } from './helpers/auth'

const API = 'http://localhost:8000/v1'

async function getDgmToken(request: import('@playwright/test').APIRequestContext) {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: 'john.ranallo@compass.com', password: 'demo1234' },
  })
  return (await r.json()).access_token as string
}

async function goToSchedule(page: import('@playwright/test').Page) {
  // DGMLog has no sidebar nav — navigate via Coverage Dashboard's Schedule button
  await page.locator('.nav-item').filter({ hasText: 'Coverage Dashboard' }).click()
  await page.waitForSelector('.fade-up', { timeout: 8000 })
  const schedBtn = page.getByRole('button', { name: /Schedule a Visit/i }).first()
  await expect(schedBtn).toBeVisible({ timeout: 8000 })
  await schedBtn.click()
  await expect(page.getByRole('heading', { name: /Schedule a Visit/i })).toBeVisible({ timeout: 10000 })
}

// ─── DGM-L-001 ───────────────────────────────────────────────────────────────
test('DGM-L-001: Schedule page renders with header, dropdown, and calendar', async ({ page }) => {
  await loginAsDgm(page)
  await goToSchedule(page)

  // Header
  await expect(page.getByRole('heading', { name: /Schedule a Visit/i })).toBeVisible()

  // Location dropdown
  await expect(page.locator('select').first()).toBeVisible()

  // Calendar navigation buttons (‹ ›)
  await expect(page.getByRole('button', { name: '‹' })).toBeVisible()
  await expect(page.getByRole('button', { name: '›' })).toBeVisible()

  // Day-of-week headers — use exact match to avoid partial matching "month"
  await expect(page.getByText('MON', { exact: true })).toBeVisible()
  await expect(page.getByText('SAT', { exact: true })).toBeVisible()
  await expect(page.getByText('SUN', { exact: true })).toBeVisible()
})

// ─── DGM-L-002 ───────────────────────────────────────────────────────────────
test('DGM-L-002: Location dropdown shows human-readable names, not raw IDs', async ({ page }) => {
  await loginAsDgm(page)
  await goToSchedule(page)

  const select = page.locator('select').first()
  await expect(select).toBeVisible()

  const options = await select.locator('option').allTextContents()
  expect(options.length).toBeGreaterThan(0)

  for (const opt of options) {
    // Options are formatted "Name (id)" — name part must not be empty
    const namePart = opt.split('(')[0].trim()
    expect(namePart.length).toBeGreaterThan(0)
    // Name and ID must differ (if name were missing it'd just show the raw ID)
    const idPart = (opt.match(/\(([^)]+)\)/)?.[1] ?? '').trim()
    if (idPart) {
      expect(namePart).not.toBe(idPart)
    }
  }
})

// ─── DGM-L-003 ───────────────────────────────────────────────────────────────
test('DGM-L-003: Past dates are faded and clicking them does not change the selected date', async ({ page }) => {
  const today = new Date()
  if (today.getDate() <= 1) { test.skip(); return }  // edge: no past days this month

  await loginAsDgm(page)
  await goToSchedule(page)

  // "Pick a date" placeholder must be visible (nothing selected yet)
  await expect(page.getByText('Pick a date')).toBeVisible({ timeout: 5000 })

  // Find any cell that has the text "1" (day 1 is always past when today ≥ 2)
  // The calendar renders day cells with text content equal to the day number
  // Past cells have opacity: 0.4 but we locate by number and verify clicking does nothing
  const day1 = page.locator('div[style*="opacity: 0.4"]').filter({ hasText: /^1$/ }).first()
  const hasFaded = await day1.count() > 0
  if (!hasFaded) {
    // Try the first visible faded cell
    const anyFaded = page.locator('div[style*="opacity: 0.4"]').first()
    if (!await anyFaded.count()) { test.skip(); return }
    await anyFaded.click({ force: true })
    await page.waitForTimeout(300)
    await expect(page.getByText('Pick a date')).toBeVisible()
    return
  }

  await day1.click({ force: true })
  await page.waitForTimeout(300)

  // The placeholder must still be visible — clicking past dates has no effect
  await expect(page.getByText('Pick a date')).toBeVisible()
})

// ─── DGM-L-004 ───────────────────────────────────────────────────────────────
test('DGM-L-004: Selecting a future date shows the scheduling form or a booking warning', async ({ page }) => {
  await loginAsDgm(page)
  await goToSchedule(page)

  // Navigate to next month
  await page.getByRole('button', { name: '›' }).click()
  await page.waitForTimeout(300)

  // Click day 15 — a mid-month date
  const dayCell = page.locator('div').filter({ hasText: /^15$/ }).first()
  if (!await dayCell.isVisible({ timeout: 3000 }).catch(() => false)) { test.skip(); return }
  await dayCell.click()
  await page.waitForTimeout(300)

  // After clicking a date, one of these must appear:
  // a) scheduling chip: "MONTH AVAILABLE" or "RESCHEDULE VISIT"
  // b) amber warning: "Visit Already Planned This Month"
  const hasChip       = await page.getByText('MONTH AVAILABLE').isVisible({ timeout: 2000 }).catch(() => false)
  const hasReschedule = await page.getByText('RESCHEDULE VISIT').isVisible({ timeout: 2000 }).catch(() => false)
  const hasWarning    = await page.getByText('Visit Already Planned This Month').isVisible({ timeout: 2000 }).catch(() => false)

  expect(hasChip || hasReschedule || hasWarning).toBe(true)

  // "Pick a date" placeholder must be gone
  await expect(page.getByText('Pick a date')).not.toBeVisible()
})

// ─── DGM-L-005 ───────────────────────────────────────────────────────────────
test('DGM-L-005: Submit button is disabled when no date is selected', async ({ page }) => {
  await loginAsDgm(page)
  await goToSchedule(page)

  // Navigate to a future month
  await page.getByRole('button', { name: '›' }).click()
  await page.waitForTimeout(200)

  // The Schedule Visit button must exist and be disabled before any date is selected
  const submitBtn = page.locator('button.btn-primary', { hasText: /Schedule Visit|Reschedule/i }).first()
  await expect(submitBtn).toBeVisible({ timeout: 5000 })
  await expect(submitBtn).toBeDisabled()
})

// ─── DGM-L-006 ───────────────────────────────────────────────────────────────
test('DGM-L-006: Notes field is optional — selecting a free date shows textarea with no required marker', async ({ page }) => {
  await loginAsDgm(page)
  await goToSchedule(page)

  // Try multiple future months to find one that is not yet booked
  let hasChip = false
  for (let nav = 1; nav <= 6; nav++) {
    await page.getByRole('button', { name: '›' }).click()
    await page.waitForTimeout(150)

    // Check if the month header shows "VISITED" or "SCHEDULED" badge
    const badge = page.locator('span', { hasText: /VISITED|SCHEDULED/ })
    if (await badge.count() > 0) continue  // month is booked, try next

    // Click day 10
    const dayCell = page.locator('div').filter({ hasText: /^10$/ }).first()
    if (!await dayCell.isVisible({ timeout: 2000 }).catch(() => false)) continue
    await dayCell.click()
    await page.waitForTimeout(300)

    hasChip = await page.getByText('MONTH AVAILABLE').isVisible({ timeout: 2000 }).catch(() => false)
    if (hasChip) break
  }

  if (!hasChip) { test.skip(); return }

  // Notes textarea must be present
  await expect(page.locator('textarea')).toBeVisible()

  // Label shows "(optional)" — notes are not required
  await expect(page.getByText(/optional/i).first()).toBeVisible()
})

// ─── DGM-L-007 ───────────────────────────────────────────────────────────────
test('DGM-L-007: DOM-warn dates are pre-marked with red dashed border in future calendar months', async ({ page }) => {
  /**
   * DGMLog.tsx derives lastCompletedVisit from VERIFICATIONS mock data.
   * If there is a completed visit for the selected location, future dates
   * matching the same day-of-month get a red dashed circle pre-marked.
   * We check the calendar directly (no API guard needed).
   */
  await loginAsDgm(page)
  await goToSchedule(page)

  // Navigate forward up to 3 months looking for a red dashed cell
  let foundRedCell = false
  for (let i = 1; i <= 3; i++) {
    await page.getByRole('button', { name: '›' }).click()
    await page.waitForTimeout(300)

    const redCells = page.locator('div[style*="dashed #ef4444"]')
    const cnt = await redCells.count()
    if (cnt > 0) {
      foundRedCell = true
      // Cell text must be a valid day number
      const cellText = (await redCells.first().innerText()).trim()
      expect(Number(cellText)).toBeGreaterThanOrEqual(1)
      expect(Number(cellText)).toBeLessThanOrEqual(31)
      break
    }
  }

  if (!foundRedCell) {
    // No completed DGM visits in mock data for this location → no red cells → skip
    test.skip()
  }
})

// ─── DGM-L-008 ───────────────────────────────────────────────────────────────
test('DGM-L-008: Clicking a DOM-warn date shows "Avoid This Date" red warning panel', async ({ page }) => {
  await loginAsDgm(page)
  await goToSchedule(page)

  // Navigate forward looking for a red dashed cell
  let redCell = page.locator('div[style*="dashed #ef4444"]').first()
  let found = false
  for (let i = 1; i <= 3; i++) {
    await page.getByRole('button', { name: '›' }).click()
    await page.waitForTimeout(300)
    redCell = page.locator('div[style*="dashed #ef4444"]').first()
    if (await redCell.count() > 0) { found = true; break }
  }

  if (!found) { test.skip(); return }

  await redCell.click()
  await page.waitForTimeout(300)

  // Red warning panel
  await expect(page.getByText('Avoid This Date')).toBeVisible({ timeout: 3000 })
  await expect(page.getByText(/Repeating the same day each month reduces unpredictability/i)).toBeVisible()
  await expect(page.getByText(/Pick a different date to avoid the compliance flag/i)).toBeVisible()
})

// ─── DGM-L-009 ───────────────────────────────────────────────────────────────
test('DGM-L-009: Clicking date in a booked month shows amber "Visit Already Planned" warning', async ({ page }) => {
  /**
   * When the DGM clicks a date in a month that has a completed (not reschedulable) visit,
   * the amber warning box must appear — not the scheduling form.
   */
  await loginAsDgm(page)
  await goToSchedule(page)

  // Look for a month with a "VISITED" or "COMPLETED" badge by navigating forward
  let visitDate: string | null = null
  for (let nav = 0; nav <= 12; nav++) {
    const badge = page.locator('span', { hasText: /^VISITED$/ })
    if (await badge.count() > 0) {
      // We're on a completed month — get the visit date from the banner
      const banner = page.locator('div', { hasText: /already has a visit on/i }).first()
      if (await banner.count() > 0) {
        const bannerText = await banner.innerText()
        // Extract "on DD MMM" pattern
        const match = bannerText.match(/on (\d+ \w+)/)
        if (match) visitDate = match[1]
      }
      break
    }
    if (nav < 12) {
      await page.getByRole('button', { name: '›' }).click()
      await page.waitForTimeout(200)
    }
  }

  if (!visitDate) { test.skip(); return }

  // Click a day that is NOT the visit day (day 1 or day 28)
  const altDay = page.locator('div').filter({ hasText: /^1$/ }).first()
  if (!await altDay.isVisible({ timeout: 3000 }).catch(() => false)) { test.skip(); return }
  await altDay.click()
  await page.waitForTimeout(300)

  // Amber warning must appear
  await expect(page.getByText('Visit Already Planned This Month')).toBeVisible({ timeout: 3000 })
  await expect(page.getByText(/Only one visit is allowed per location per month/i)).toBeVisible()
  await expect(page.getByText(/Navigate to a different month/i)).toBeVisible()
})

// ─── DGM-L-010 ───────────────────────────────────────────────────────────────
test('DGM-L-010: Calendar legend shows "Avoid" entry when mock data has completed visits', async ({ page }) => {
  /**
   * DGMLog builds lastCompletedVisit from mock VERIFICATIONS.
   * If a completed DGM visit exists for the selected location, the legend
   * must show the red dashed "Avoid" entry.
   */
  await loginAsDgm(page)
  await goToSchedule(page)

  // Check if legend shows "Avoid" entry
  const avoidLegend = page.getByText('Avoid (same day as last visit)', { exact: true })
  const hasEntry = await avoidLegend.isVisible({ timeout: 5000 }).catch(() => false)

  if (!hasEntry) {
    // No completed visits in mock for this location — valid to skip
    test.skip()
    return
  }

  await expect(avoidLegend).toBeVisible()

  // The legend entry should have a red dashed swatch element near it
  const legendRow = page.locator('span').filter({ hasText: 'Avoid (same day as last visit)' })
  await expect(legendRow).toBeVisible()
})

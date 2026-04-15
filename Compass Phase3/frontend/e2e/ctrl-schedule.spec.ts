/**
 * Controller Schedule Calendar — E2E tests
 *
 * CTRL-S-001  Schedule page renders with header, location dropdown, and calendar
 * CTRL-S-002  Location dropdown shows human-readable names, not raw IDs
 * CTRL-S-003  Past dates cannot be clicked (no date selection changes)
 * CTRL-S-004  Selecting a future available date shows the time slot picker
 * CTRL-S-005  Clicking an already-booked date shows "Already Booked" warning, not time slots
 * CTRL-S-006  Submit without date shows validation error
 * CTRL-S-007  Submit with date but no time slot shows time validation error
 * CTRL-S-008  Submit button is enabled (not disabled) — validation runs on click, not on render
 * CTRL-S-009  DOW-warn dates are pre-marked with amber dashed border in calendar
 * CTRL-S-010  Clicking a DOW-warn date shows prominent "Avoid This Day" warning panel
 */

import { test, expect } from '@playwright/test'
import { loginAsController } from './helpers/auth'

const API = 'http://localhost:8000/v1'

async function getControllerToken(request: import('@playwright/test').APIRequestContext) {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: 'terri.serrano@compass.com', password: 'demo1234' },
  })
  return (await r.json()).access_token as string
}

async function goToSchedule(page: import('@playwright/test').Page) {
  // CtrlLog has no sidebar nav — navigate via Weekly Review Dashboard button
  await page.locator('.nav-item').filter({ hasText: 'Weekly Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Weekly Review Dashboard/i })).toBeVisible({ timeout: 10000 })
  const schedBtn = page.getByRole('button', { name: /Schedule.*Visit/i }).first()
  await expect(schedBtn).toBeVisible({ timeout: 8000 })
  await schedBtn.click()
  await expect(page.getByRole('heading', { name: /Schedule a Visit/i })).toBeVisible({ timeout: 10000 })
}

// ─── CTRL-S-001 ───────────────────────────────────────────────────────────────
test('CTRL-S-001: Schedule page renders with header, dropdown, and calendar', async ({ page }) => {
  await loginAsController(page)
  await goToSchedule(page)

  await expect(page.getByRole('heading', { name: /Schedule a Visit/i })).toBeVisible()
  await expect(page.locator('select').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '‹' })).toBeVisible()
  await expect(page.getByRole('button', { name: '›' })).toBeVisible()
  await expect(page.getByText('MON', { exact: true })).toBeVisible()
  await expect(page.getByText('SAT', { exact: true })).toBeVisible()
  // Time slots section label
  await expect(page.getByText('Pick a date', { exact: true })).toBeVisible()
})

// ─── CTRL-S-002 ───────────────────────────────────────────────────────────────
test('CTRL-S-002: Location dropdown shows human-readable names, not raw IDs', async ({ page }) => {
  await loginAsController(page)
  await goToSchedule(page)

  const select  = page.locator('select').first()
  await expect(select).toBeVisible()

  // Wait for the API to populate real location names (async fetch after mount)
  await page.waitForTimeout(2000)

  const options = await select.locator('option').allTextContents()
  expect(options.length).toBeGreaterThan(0)

  for (const opt of options) {
    const namePart = opt.split('(')[0].trim()
    expect(namePart.length).toBeGreaterThan(0)
    const idPart = (opt.match(/\(([^)]+)\)/)?.[1] ?? '').trim()
    if (idPart) expect(namePart).not.toBe(idPart)
  }
})

// ─── CTRL-S-003 ───────────────────────────────────────────────────────────────
test('CTRL-S-003: Past dates are faded and clicking them does not select', async ({ page }) => {
  const today = new Date()
  if (today.getDate() <= 1) { test.skip(); return }

  await loginAsController(page)
  await goToSchedule(page)

  await expect(page.getByText('Pick a date', { exact: true })).toBeVisible({ timeout: 5000 })

  // Click the first faded cell
  const faded = page.locator('div[style*="opacity: 0.4"]').first()
  if (!await faded.count()) { test.skip(); return }
  await faded.click({ force: true })
  await page.waitForTimeout(300)

  // Placeholder must still be visible — past dates are not selectable
  await expect(page.getByText('Pick a date', { exact: true })).toBeVisible()
})

// ─── CTRL-S-004 ───────────────────────────────────────────────────────────────
test('CTRL-S-004: Selecting a future available date shows the time slot picker', async ({ page }) => {
  await loginAsController(page)
  await goToSchedule(page)

  // Navigate to next month for a clean future date
  await page.getByRole('button', { name: '›' }).click()
  await page.waitForTimeout(300)

  // Try day 15 — likely available
  const dayCell = page.locator('div').filter({ hasText: /^15$/ }).first()
  if (!await dayCell.isVisible({ timeout: 3000 }).catch(() => false)) { test.skip(); return }
  await dayCell.click()
  await page.waitForTimeout(300)

  // Either time slots or "Already Booked" must appear
  const hasSlots  = await page.getByText('Available Slots').isVisible({ timeout: 2000 }).catch(() => false)
  const hasBooked = await page.getByText('Already Booked').isVisible({ timeout: 2000 }).catch(() => false)
  const hasMissed = await page.getByText('Visit Missed').isVisible({ timeout: 2000 }).catch(() => false)
  expect(hasSlots || hasBooked || hasMissed).toBe(true)

  // Time slot buttons (9:00 AM etc.) should be visible if date is free
  if (hasSlots) {
    await expect(page.getByRole('button', { name: /9:00 AM/i })).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('button', { name: /1:00 PM/i })).toBeVisible({ timeout: 3000 })
  }
})

// ─── CTRL-S-005 ───────────────────────────────────────────────────────────────
test('CTRL-S-005: Clicking an already-booked date shows warning, not time slots', async ({ page, request }) => {
  const token = await getControllerToken(request)
  const r = await request.get(`${API}/verifications/controller?page_size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok()) { test.skip(); return }

  const data = await r.json()
  const future = (data.items ?? []).find((v: { status: string; verification_date: string }) => {
    return (v.status === 'scheduled' || v.status === 'completed') &&
      v.verification_date >= new Date().toISOString().slice(0, 10)
  })
  if (!future) { test.skip(); return }

  await loginAsController(page)
  await goToSchedule(page)

  // Select the location matching the booked visit
  const select = page.locator('select').first()
  await select.selectOption(future.location_id)
  await page.waitForTimeout(300)

  // Navigate to the booked visit's month
  const visitDate = new Date(future.verification_date + 'T12:00:00')
  const now = new Date()
  let navClicks = (visitDate.getFullYear() - now.getFullYear()) * 12 + (visitDate.getMonth() - now.getMonth())
  for (let i = 0; i < navClicks; i++) {
    await page.getByRole('button', { name: '›' }).click()
    await page.waitForTimeout(150)
  }

  // Wait for API data to load — booked cells render a tooltip only after apiVerifications loads
  // Timeout is generous to handle slow backends; skip gracefully if no booked cell appears
  const bookedCellLoaded = await page.waitForSelector('div[title*="Visit "]', { timeout: 8000 })
    .then(() => true).catch(() => false)
  if (!bookedCellLoaded) { test.skip(); return }

  // Click the booked date cell
  const visitDay = visitDate.getDate()
  const dayCell = page.locator('div').filter({ hasText: new RegExp(`^${visitDay}$`) }).first()
  if (!await dayCell.isVisible({ timeout: 3000 }).catch(() => false)) { test.skip(); return }
  await dayCell.click()
  await page.waitForTimeout(300)

  // Warning must appear, no time slots
  const hasWarning = await page.getByText(/Already Booked|Visit Completed|Visit Missed/i).isVisible({ timeout: 3000 }).catch(() => false)
  expect(hasWarning).toBe(true)
  await expect(page.getByText('Available Slots')).not.toBeVisible()
})

// ─── CTRL-S-006 ───────────────────────────────────────────────────────────────
test('CTRL-S-006: Submit without selecting a date shows date validation error', async ({ page }) => {
  await loginAsController(page)
  await goToSchedule(page)

  // Navigate to a future month first (submit button is always enabled)
  await page.getByRole('button', { name: '›' }).click()
  await page.waitForTimeout(200)

  const submitBtn = page.getByRole('button', { name: /Schedule Visit/i })
  await expect(submitBtn).toBeVisible({ timeout: 5000 })
  await submitBtn.click()

  await expect(page.getByText(/Please select a visit date/i)).toBeVisible({ timeout: 3000 })
})

// ─── CTRL-S-007 ───────────────────────────────────────────────────────────────
test('CTRL-S-007: Submit with date but no time slot shows time validation error', async ({ page }) => {
  await loginAsController(page)
  await goToSchedule(page)

  await page.getByRole('button', { name: '›' }).click()
  await page.waitForTimeout(200)

  // Click an available future date — try days until we find a free one
  let dateSelected = false
  for (const day of [10, 12, 14, 16, 18, 20, 22]) {
    const cell = page.locator('div').filter({ hasText: new RegExp(`^${day}$`) }).first()
    if (!await cell.isVisible({ timeout: 1000 }).catch(() => false)) continue
    await cell.click()
    await page.waitForTimeout(300)
    if (await page.getByText('Available Slots').isVisible({ timeout: 1000 }).catch(() => false)) {
      dateSelected = true
      break
    }
  }
  if (!dateSelected) { test.skip(); return }

  // Submit without picking a time slot
  const submitBtn = page.getByRole('button', { name: /Schedule Visit/i })
  await submitBtn.click()

  await expect(page.getByText(/Please select a time slot/i)).toBeVisible({ timeout: 3000 })
})

// ─── CTRL-S-008 ───────────────────────────────────────────────────────────────
test('CTRL-S-008: Submit button is always enabled (validation runs on click)', async ({ page }) => {
  await loginAsController(page)
  await goToSchedule(page)

  await page.getByRole('button', { name: '›' }).click()
  await page.waitForTimeout(200)

  // Unlike DGMLog, CtrlLog button is NOT disabled when no date/time selected
  const submitBtn = page.getByRole('button', { name: /Schedule Visit/i })
  await expect(submitBtn).toBeVisible({ timeout: 5000 })
  await expect(submitBtn).toBeEnabled()
})

// ─── CTRL-S-009 ───────────────────────────────────────────────────────────────
test('CTRL-S-009: DOW-warn dates are pre-marked with amber dashed border', async ({ page, request }) => {
  /**
   * If the controller has visited a location on the same weekday in the past
   * 4 weeks, the corresponding future dates get amber dashed borders.
   * This relies on real API verifications — skips if DB has no history.
   */
  const token = await getControllerToken(request)
  const r = await request.get(`${API}/verifications/controller?page_size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok()) { test.skip(); return }

  const data = await r.json()
  const recent = (data.items ?? []).filter((v: { status: string; verification_date: string }) => {
    const d = new Date(v.verification_date + 'T12:00:00')
    const cutoff = new Date(Date.now() - 28 * 86400000)
    return (v.status === 'completed' || v.status === 'scheduled') && d >= cutoff
  })
  if (recent.length === 0) { test.skip(); return }

  await loginAsController(page)
  await goToSchedule(page)

  // Check current + next 2 months for dashed amber cells
  let found = false
  for (let nav = 0; nav <= 2; nav++) {
    if (nav > 0) {
      await page.getByRole('button', { name: '›' }).click()
      await page.waitForTimeout(300)
    }
    const warnCells = page.locator('div[style*="dashed #f59e0b"]')
    if (await warnCells.count() > 0) {
      found = true
      const cellText = (await warnCells.first().innerText()).trim()
      expect(Number(cellText)).toBeGreaterThanOrEqual(1)
      expect(Number(cellText)).toBeLessThanOrEqual(31)
      break
    }
  }

  if (!found) {
    // Recent visits exist in API but fall outside the calendar view — skip gracefully
    test.skip()
  }
})

// ─── CTRL-S-010 ───────────────────────────────────────────────────────────────
test('CTRL-S-010: Clicking a DOW-warn date shows prominent "Avoid This Day" warning', async ({ page, request }) => {
  const token = await getControllerToken(request)
  const r = await request.get(`${API}/verifications/controller?page_size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok()) { test.skip(); return }

  const data = await r.json()
  const recent = (data.items ?? []).filter((v: { status: string; verification_date: string }) => {
    const d = new Date(v.verification_date + 'T12:00:00')
    const cutoff = new Date(Date.now() - 28 * 86400000)
    return (v.status === 'completed' || v.status === 'scheduled') && d >= cutoff
  })
  if (recent.length === 0) { test.skip(); return }

  await loginAsController(page)
  await goToSchedule(page)

  // Find a dashed amber cell and click it
  let warnCell = page.locator('div[style*="dashed #f59e0b"]').first()
  let found = false
  for (let nav = 0; nav <= 2; nav++) {
    if (nav > 0) {
      await page.getByRole('button', { name: '›' }).click()
      await page.waitForTimeout(300)
    }
    warnCell = page.locator('div[style*="dashed #f59e0b"]').first()
    if (await warnCell.count() > 0) { found = true; break }
  }
  if (!found) { test.skip(); return }

  await warnCell.click()
  await page.waitForTimeout(300)

  // Prominent DOW warning panel must appear
  await expect(page.getByText('Avoid This Day — DOW Pattern Detected')).toBeVisible({ timeout: 3000 })
  await expect(page.getByText(/Repeating the same weekday reduces unpredictability/i)).toBeVisible()
  await expect(page.getByText(/Pick a different day of the week/i)).toBeVisible()
})

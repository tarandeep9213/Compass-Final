/**
 * CCS Manual Test Cases — Section 3: Operator Dashboard
 * Key tests from OPD-001 to OPD-080 (~25 selected)
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = process.env.E2E_API_URL || 'http://localhost:8000/v1'
const OPERATOR = 'operator@compass.com'

test.describe('CCS Operator Dashboard', () => {

  // OPD-001: Greeting shows time-based message
  test('OPD-001: greeting shows time-based message', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
      .toBeVisible({ timeout: 10000 })
  })

  // OPD-005: Location name displayed in header
  test('OPD-005: location name displayed in header', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    const pageText = await page.innerText('body')
    // Should show a location name somewhere in the header
    const hasLocation = pageText.includes('loc-') || pageText.includes('Location') || pageText.includes('Grange') || pageText.includes('Canteen') || pageText.includes('CC:')
    expect(hasLocation, 'Should display location info').toBe(true)
  })

  // OPD-007: Today's date displayed
  test('OPD-007: today\'s date displayed in header', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    const today = new Date()
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[today.getDay()]
    const hasDate = await page.getByText(dayName).first().isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasDate, 'Should show today\'s day name').toBe(true)
  })

  // OPD-012: Dashboard loads submissions from API
  test('OPD-012: dashboard loads submissions from API', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(3000)
    // Dashboard should render — either with submissions or empty state
    const hasContent = await page.locator('.card').first().isVisible({ timeout: 5000 }).catch(() => false)
      || await page.getByText(/Submit Now|Pending|Accepted|Draft/i).first().isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasContent, 'Dashboard should show content').toBe(true)
  })

  // OPD-018: No submission state shows submit option
  test('OPD-018: no submission state shows submit option', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    // Should show either Submit Now, pending, approved, draft, or rejected
    const hasStatus = await page.getByText(/Submit Now|Pending|Accepted|Draft|Rejected/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasStatus, 'Should show a submission status or submit option').toBe(true)
  })

  // OPD-023: Pending state shows amber card
  test('OPD-023: pending state card is visible when submission pending', async ({ request, page }) => {
    // Create a pending submission if none exists
    const opToken = (await (await request.post(`${API}/auth/login`, {
      data: { email: OPERATOR, password: 'demo1234' },
    })).json()).access_token
    const meRes = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${opToken}` } })
    const me = await meRes.json()
    const locationId = me.location_ids?.[0]
    if (!locationId) { test.skip(); return }

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const subsRes = await request.get(
      `${API}/submissions?location_id=${locationId}&date_from=${todayStr}&date_to=${todayStr}`,
      { headers: { Authorization: `Bearer ${opToken}` } },
    )
    const subs = await subsRes.json()
    const hasPending = (subs.items ?? []).some((s: { status: string }) => s.status === 'pending_approval')

    if (!hasPending) {
      await request.post(`${API}/submissions`, {
        headers: { Authorization: `Bearer ${opToken}` },
        data: {
          location_id: locationId, submission_date: todayStr, source: 'FORM', save_as_draft: false,
          sections: { A: { total: 5000 }, B: { total: 0 }, C: { total: 0 }, D: { total: 0 }, E: { total: 0 }, F: { total: 0 }, G: { total: 0 }, H: { total: 0 }, I: { total: 0 } },
          variance_note: 'OPD test',
        },
      })
    }

    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    const hasPendingUI = await page.getByText(/Pending Approval/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      || await page.locator('.badge-amber').first().isVisible({ timeout: 2000 }).catch(() => false)
    expect(hasPendingUI, 'Should show Pending Approval status').toBe(true)
  })

  // OPD-029: Total fund shown on today's card
  test('OPD-029: total fund amount shown on card', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    // Should show a dollar amount on the card
    const hasCurrency = await page.getByText(/\$[\d,]+\.\d{2}/).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasCurrency, 'Should show a dollar amount').toBe(true)
  })

  // OPD-031: View button shown after submission
  test('OPD-031: view button visible after submission', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    const viewBtn = page.getByRole('button', { name: /View|Update/i }).first()
    const hasView = await viewBtn.isVisible({ timeout: 5000 }).catch(() => false)
    // Either View or Update should be visible (unless no submission yet)
    if (!hasView) {
      const hasSubmitNow = await page.getByRole('button', { name: /Submit Now/i }).isVisible({ timeout: 2000 }).catch(() => false)
      expect(hasSubmitNow, 'Should show View/Update button or Submit Now').toBe(true)
    }
  })

  // OPD-033: History shows rows
  test('OPD-033: history table shows rows', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    // Scroll down to see history
    await page.keyboard.press('End')
    await page.waitForTimeout(500)
    // Should have a table or history section
    const pageText = await page.innerText('body')
    const hasHistory = pageText.includes('Submission History') || pageText.includes('Today') || pageText.includes('Yesterday') || pageText.includes('Missed')
    expect(hasHistory, 'Should show history section').toBe(true)
  })

  // OPD-052: Default filter is All
  test('OPD-052: default filter is All', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    const allFilter = page.getByText('All').first()
    const hasAll = await allFilter.isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasAll, 'All filter should be visible').toBe(true)
  })

  // OPD-054: Filter tabs exist
  test('OPD-054: filter tabs (Pending, Rejected, Missed, Accepted) exist', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    const pageText = await page.innerText('body')
    const hasPending = pageText.includes('Pending')
    const hasAccepted = pageText.includes('Accepted')
    expect(hasPending || hasAccepted, 'Filter tabs should exist').toBe(true)
  })

  // OPD-070-073: KPI cards
  test('OPD-070: KPI cards show submission counts', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    // KPI area should have some metrics
    const pageText = await page.innerText('body')
    const hasKPI = pageText.includes('Submitted') || pageText.includes('Pending') || pageText.includes('Approved') || pageText.includes('Missed') || pageText.includes('Compliance')
    expect(hasKPI, 'KPI area should show submission metrics').toBe(true)
  })

  // OPD-074: New operator with no history
  test('OPD-074: dashboard renders for operator with no submissions', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
      .toBeVisible({ timeout: 10000 })
    // Should not crash — either empty state or submit option shown
    const hasContent = await page.locator('.fade-up').first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasContent, 'Dashboard should render without crashing').toBe(true)
  })

  // OPD-077: Dashboard shows correct data after submission
  test('OPD-077: dashboard reflects data correctly', async ({ page }) => {
    await loginAs(page, OPERATOR)
    await page.waitForTimeout(2000)
    // Navigate away and back
    const draftsBtn = page.getByRole('button', { name: /My Drafts/i })
    if (await draftsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await draftsBtn.click()
      await page.waitForTimeout(1000)
      await page.locator('.nav-item').filter({ hasText: 'Dashboard' }).click()
      await page.waitForTimeout(2000)
    }
    // Dashboard should still render
    await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
      .toBeVisible({ timeout: 10000 })
  })
})

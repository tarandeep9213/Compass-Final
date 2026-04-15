/**
 * System Settings E2E Tests — Admin > Users page
 *
 * Verifies that the System Settings section in AdmUsers:
 *  - Loads current values from the backend on mount
 *  - Saves values to the backend when Save Settings is clicked
 *  - Persists values across page reloads (proves DB write, not just local state)
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = 'http://localhost:8000/v1'

async function getAdminToken(request: import('@playwright/test').APIRequestContext) {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: 'admin@compass.com', password: 'demo1234' },
  })
  return (await r.json()).access_token
}

// ─────────────────────────────────────────────────────────────────────────────
// SYS-001: System Settings section is visible on the Users page
// ─────────────────────────────────────────────────────────────────────────────
test('SYS-001: System Settings section is visible on admin Users page', async ({ page }) => {
  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Users' }).click()
  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible({ timeout: 8000 })

  // System Settings card should be present
  await expect(page.getByText('System Settings')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('DOW Lookback Window')).toBeVisible()
  await expect(page.getByText('Daily Reminder Time')).toBeVisible()
  await expect(page.getByText('Data Retention')).toBeVisible()
  await expect(page.getByRole('button', { name: /Save Settings/i })).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// SYS-002: System Settings loads values from the backend (not always defaults)
// ─────────────────────────────────────────────────────────────────────────────
test('SYS-002: System Settings loads values from backend API on mount', async ({ page, request }) => {
  const token = await getAdminToken(request)

  // Set a known state via API first
  await request.put(`${API}/admin/config`, {
    data: { dow_lookback_weeks: 6, daily_reminder_time: '09:00', data_retention_years: 5 },
    headers: { Authorization: `Bearer ${token}` },
  })

  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Users' }).click()
  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000) // allow API load

  // DOW lookback should show 6 weeks as selected — the active button has white color (inline style)
  const sixWeeksBtn = page.getByRole('button', { name: '6 weeks' })
  await expect(sixWeeksBtn).toBeVisible({ timeout: 5000 })
  const color = await sixWeeksBtn.evaluate(el => (el as HTMLElement).style.color)
  // Selected button has color: #fff (white text on green bg), unselected has var(--td)
  expect(color).toBe('rgb(255, 255, 255)')
})

// ─────────────────────────────────────────────────────────────────────────────
// SYS-003: Saving System Settings writes to the DB (persists after reload)
// ─────────────────────────────────────────────────────────────────────────────
test('SYS-003: Save Settings persists DOW lookback to the database', async ({ page, request }) => {
  const token = await getAdminToken(request)

  // Reset to 4 weeks first
  await request.put(`${API}/admin/config`, {
    data: { dow_lookback_weeks: 4 },
    headers: { Authorization: `Bearer ${token}` },
  })

  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Users' }).click()
  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // Switch to 6 weeks
  await page.getByRole('button', { name: '6 weeks' }).click()

  // Save
  await page.getByRole('button', { name: /Save Settings/i }).click()
  await expect(page.getByText(/✓ Saved/i)).toBeVisible({ timeout: 5000 })

  // Verify via API — the DB should now have 6 weeks
  const cfg = await request.get(`${API}/admin/config`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await cfg.json()
  expect(body.global.dow_lookback_weeks).toBe(6)
})

// ─────────────────────────────────────────────────────────────────────────────
// SYS-004: Saving System Settings persists reminder time to the DB
// ─────────────────────────────────────────────────────────────────────────────
test('SYS-004: Save Settings persists daily reminder time to the database', async ({ page, request }) => {
  const token = await getAdminToken(request)

  // Reset to 08:00 first
  await request.put(`${API}/admin/config`, {
    data: { daily_reminder_time: '08:00' },
    headers: { Authorization: `Bearer ${token}` },
  })

  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Users' }).click()
  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // Change reminder time to 10:30
  const timeInput = page.locator('input[type="time"]')
  await timeInput.fill('10:30')

  // Save
  await page.getByRole('button', { name: /Save Settings/i }).click()
  await expect(page.getByText(/✓ Saved/i)).toBeVisible({ timeout: 5000 })

  // Verify via API
  const cfg = await request.get(`${API}/admin/config`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await cfg.json()
  expect(body.global.daily_reminder_time).toBe('10:30')

  // Cleanup — restore to 08:00
  await request.put(`${API}/admin/config`, {
    data: { daily_reminder_time: '08:00' },
    headers: { Authorization: `Bearer ${token}` },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SYS-005: Saving System Settings persists data retention years to the DB
// ─────────────────────────────────────────────────────────────────────────────
test('SYS-005: Save Settings persists data retention years to the database', async ({ page, request }) => {
  const token = await getAdminToken(request)

  // Reset to 7 years first
  await request.put(`${API}/admin/config`, {
    data: { data_retention_years: 7 },
    headers: { Authorization: `Bearer ${token}` },
  })

  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Users' }).click()
  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // Change retention to 3 years
  const retentionInput = page.locator('input[type="number"][min="1"][max="7"]')
  await retentionInput.fill('3')

  // Save
  await page.getByRole('button', { name: /Save Settings/i }).click()
  await expect(page.getByText(/✓ Saved/i)).toBeVisible({ timeout: 5000 })

  // Verify via API
  const cfg = await request.get(`${API}/admin/config`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await cfg.json()
  expect(body.global.data_retention_years).toBe(3)

  // Cleanup — restore to 7
  await request.put(`${API}/admin/config`, {
    data: { data_retention_years: 7 },
    headers: { Authorization: `Bearer ${token}` },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SYS-006: Values survive a page reload (true DB persistence, not just state)
// ─────────────────────────────────────────────────────────────────────────────
test('SYS-006: Saved settings survive a page reload', async ({ page, request }) => {
  const token = await getAdminToken(request)

  // Set 6 weeks via API
  await request.put(`${API}/admin/config`, {
    data: { dow_lookback_weeks: 6 },
    headers: { Authorization: `Bearer ${token}` },
  })

  // First visit — confirm 6 weeks is loaded
  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Users' }).click()
  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  const sixBtn = page.getByRole('button', { name: '6 weeks' })
  const color1 = await sixBtn.evaluate(el => (el as HTMLElement).style.color)
  expect(color1).toBe('rgb(255, 255, 255)')

  // Save (even though value unchanged — confirms save path works end-to-end)
  await page.getByRole('button', { name: /Save Settings/i }).click()
  await expect(page.getByText(/✓ Saved/i)).toBeVisible({ timeout: 5000 })

  // Reload and navigate back
  await page.reload()
  await page.waitForTimeout(500)
  await page.locator('.nav-item').filter({ hasText: 'Users' }).click()
  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // 6 weeks should still be selected after reload
  const color2 = await page.getByRole('button', { name: '6 weeks' }).evaluate(el => (el as HTMLElement).style.color)
  expect(color2).toBe('rgb(255, 255, 255)')

  // Restore to 4 weeks
  await request.put(`${API}/admin/config`, {
    data: { dow_lookback_weeks: 4 },
    headers: { Authorization: `Bearer ${token}` },
  })
})

/**
 * Location Edit — Cost Center E2E Tests
 *
 * Verifies that the Cost Center field:
 *  - Is visible in the edit expand row
 *  - Is pre-populated with the existing value
 *  - Accepts only numeric input
 *  - Saves to the backend and reflects in the table
 *  - Persists across page reloads
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
// LOC-EDIT-001: Edit form opens with Cost Center field visible
// ─────────────────────────────────────────────────────────────────────────────
test('LOC-EDIT-001: clicking Edit on a location shows a Cost Center field', async ({ page }) => {
  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
  await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(800)

  // Click Edit on the first location row
  await page.locator('table.dt tbody tr').filter({ hasText: /ACTIVE|INACTIVE/ }).first()
    .getByRole('button', { name: 'Edit' }).click()

  // Edit expand row should now show a Cost Center input
  const ccInput = page.locator('input[placeholder="e.g. 12345"]')
  await expect(ccInput).toBeVisible({ timeout: 5000 })
  await expect(page.locator('table.dt tbody label').filter({ hasText: 'Cost Center' })).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// LOC-EDIT-002: Cost Center field is pre-populated with existing value
// ─────────────────────────────────────────────────────────────────────────────
test('LOC-EDIT-002: Cost Center field is pre-filled with the location\'s current value', async ({ page, request }) => {
  const token = await getAdminToken(request)

  // Set a known cost_center on loc-appleton via API
  await request.put(`${API}/admin/locations/loc-appleton`, {
    data: { cost_center: '99001' },
    headers: { Authorization: `Bearer ${token}` },
  })

  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
  await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(800)

  // Find the APPLETON row and click Edit
  const appletonRow = page.locator('table.dt tbody tr').filter({ hasText: /APPLETON/i }).first()
  await appletonRow.getByRole('button', { name: 'Edit' }).click()

  // Cost Center input should be pre-filled with 99001
  const ccInput = page.locator('input[placeholder="e.g. 12345"]')
  await expect(ccInput).toBeVisible({ timeout: 5000 })
  const value = await ccInput.inputValue()
  expect(value).toBe('99001')
})

// ─────────────────────────────────────────────────────────────────────────────
// LOC-EDIT-003: Cost Center only accepts numeric input
// ─────────────────────────────────────────────────────────────────────────────
test('LOC-EDIT-003: Cost Center field strips non-numeric characters', async ({ page }) => {
  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
  await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(800)

  await page.locator('table.dt tbody tr').filter({ hasText: /ACTIVE|INACTIVE/ }).first()
    .getByRole('button', { name: 'Edit' }).click()

  const ccInput = page.locator('input[placeholder="e.g. 12345"]')
  await expect(ccInput).toBeVisible({ timeout: 5000 })

  // Type mixed alphanumeric — only digits should remain
  await ccInput.fill('')
  await ccInput.type('AB12CD34')
  const value = await ccInput.inputValue()
  expect(value).toBe('1234')
})

// ─────────────────────────────────────────────────────────────────────────────
// LOC-EDIT-004: Saving Cost Center updates the table display immediately
// ─────────────────────────────────────────────────────────────────────────────
test('LOC-EDIT-004: saving a new Cost Center reflects in the table without reload', async ({ page, request }) => {
  const token = await getAdminToken(request)

  // Clear cost_center on loc-appleton first
  await request.put(`${API}/admin/locations/loc-appleton`, {
    data: { cost_center: '' },
    headers: { Authorization: `Bearer ${token}` },
  })

  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
  await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(800)

  const appletonRow = page.locator('table.dt tbody tr').filter({ hasText: /APPLETON/i }).first()
  await appletonRow.getByRole('button', { name: 'Edit' }).click()

  const ccInput = page.locator('input[placeholder="e.g. 12345"]')
  await expect(ccInput).toBeVisible({ timeout: 5000 })
  await ccInput.fill('77501')

  // Save
  await page.locator('table.dt tbody').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Changes saved.')).toBeVisible({ timeout: 5000 })

  // Table should now show 77501 in the Cost Center column for APPLETON
  const updatedRow = page.locator('table.dt tbody tr').filter({ hasText: /APPLETON/i }).first()
  await expect(updatedRow.getByText('77501')).toBeVisible({ timeout: 3000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// LOC-EDIT-005: Cost Center persists to DB (survives page reload)
// ─────────────────────────────────────────────────────────────────────────────
test('LOC-EDIT-005: saved Cost Center persists to the database after page reload', async ({ page, request }) => {
  const token = await getAdminToken(request)

  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
  await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(800)

  const appletonRow = page.locator('table.dt tbody tr').filter({ hasText: /APPLETON/i }).first()
  await appletonRow.getByRole('button', { name: 'Edit' }).click()

  const ccInput = page.locator('input[placeholder="e.g. 12345"]')
  await expect(ccInput).toBeVisible({ timeout: 5000 })
  await ccInput.fill('55321')

  await page.locator('table.dt tbody').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Changes saved.')).toBeVisible({ timeout: 5000 })

  // Verify via API — DB should have 55321
  const res = await request.get(`${API}/admin/locations`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  const appleton = body.items.find((l: { id: string }) => l.id === 'loc-appleton')
  expect(appleton?.cost_center).toBe('55321')

  // Reload page and verify table still shows 55321
  await page.reload()
  await page.waitForTimeout(500)
  await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
  await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(800)

  const rowAfterReload = page.locator('table.dt tbody tr').filter({ hasText: /APPLETON/i }).first()
  await expect(rowAfterReload.getByText('55321')).toBeVisible({ timeout: 3000 })

  // Cleanup
  await request.put(`${API}/admin/locations/loc-appleton`, {
    data: { cost_center: null },
    headers: { Authorization: `Bearer ${token}` },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LOC-EDIT-006: Cancel discards Cost Center change without saving
// ─────────────────────────────────────────────────────────────────────────────
test('LOC-EDIT-006: Cancel discards Cost Center change without saving to DB', async ({ page, request }) => {
  const token = await getAdminToken(request)

  // Set known value first
  await request.put(`${API}/admin/locations/loc-appleton`, {
    data: { cost_center: '11111' },
    headers: { Authorization: `Bearer ${token}` },
  })

  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
  await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(800)

  const appletonRow = page.locator('table.dt tbody tr').filter({ hasText: /APPLETON/i }).first()
  await appletonRow.getByRole('button', { name: 'Edit' }).click()

  const ccInput = page.locator('input[placeholder="e.g. 12345"]')
  await expect(ccInput).toBeVisible({ timeout: 5000 })
  await ccInput.fill('99999')

  // Cancel instead of Save
  await page.locator('table.dt tbody').getByRole('button', { name: 'Cancel' }).click()

  // API should still have the original value
  const res = await request.get(`${API}/admin/locations`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  const appleton = body.items.find((l: { id: string }) => l.id === 'loc-appleton')
  expect(appleton?.cost_center).toBe('11111')

  // Cleanup
  await request.put(`${API}/admin/locations/loc-appleton`, {
    data: { cost_center: null },
    headers: { Authorization: `Bearer ${token}` },
  })
})

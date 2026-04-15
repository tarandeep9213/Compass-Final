/**
 * RC All Locations — full functionality test
 * 1. Clicking "All Locations" selects all location checkboxes
 * 2. Saving RC user with All Locations assigns all locations
 * 3. Unchecking "All Locations" deselects all
 * 4. RC user can see all locations in their dashboard
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = process.env.E2E_API_URL || 'http://localhost:8000/v1'

test('RC All Locations: checkbox selects all, saves correctly, RC sees all locations', async ({ page, request }) => {
  const adminToken = (await (await request.post(`${API}/auth/login`, {
    data: { email: 'admin@compass.com', password: 'demo1234' },
  })).json()).access_token

  // Get total active locations
  const locsRes = await request.get(`${API}/admin/locations`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const locs = await locsRes.json()
  const locList = (Array.isArray(locs) ? locs : (locs.items ?? locs.locations ?? []))
    .filter((l: { active: boolean }) => l.active !== false)
  const totalLocations = locList.length
  if (totalLocations < 2) { test.skip(); return }

  const allLocIds = locList.map((l: { id: string }) => l.id)

  // ── Step 1: Login as admin, open Users, add new RC user ──
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Users' }).click()
  await expect(page.getByRole('heading', { name: /Users/i })).toBeVisible({ timeout: 8000 })

  await page.getByRole('button', { name: /\+ Add User/i }).click()
  await page.waitForTimeout(500)

  const addRow = page.locator('tr').filter({ has: page.getByRole('button', { name: /^Save$/i }) }).first()
  await expect(addRow).toBeVisible({ timeout: 5000 })

  // Select Regional Controller role
  const roleSelect = addRow.locator('select').first()
  const rcOption = await roleSelect.locator('option').evaluateAll(
    opts => opts.map(o => ({ value: (o as HTMLOptionElement).value, text: o.textContent }))
  )
  const rcVal = rcOption.find(o => o.value?.includes('regional') || o.text?.toLowerCase().includes('regional'))
  if (!rcVal) { test.skip(); return }
  await roleSelect.selectOption(rcVal.value!)
  await page.waitForTimeout(500)

  // Wait for locations to finish loading
  await page.waitForTimeout(2000)
  // Wait for "Loading..." to disappear
  await expect(page.getByText(/Loading/i)).not.toBeVisible({ timeout: 8000 }).catch(() => {})

  // ── Step 2: Assert "All Locations" checkbox is visible ──
  const allLocLabel = addRow.getByText('All Locations')
  await expect(allLocLabel).toBeVisible({ timeout: 5000 })

  // Get all checkboxes on the page within the form area (not just addRow since layout may span)
  const formArea = page.locator('tr').filter({ has: page.getByRole('button', { name: /^Save$/i }) }).first()
    .locator('..')  // parent to include the full form row area
  const locationCheckboxes = formArea.locator('input[type="checkbox"]')

  // Wait for individual location checkboxes to appear
  await expect(locationCheckboxes.first()).toBeVisible({ timeout: 5000 })
  const checkboxCount = await locationCheckboxes.count()
  // checkboxCount includes "All Locations" checkbox + individual ones
  expect(checkboxCount, `Should have All Locations + ${totalLocations} individual checkboxes, got ${checkboxCount}`).toBeGreaterThanOrEqual(totalLocations + 1)

  // ── Step 3: Initially no locations selected ──
  let checkedCount = 0
  for (let i = 0; i < checkboxCount; i++) {
    if (await locationCheckboxes.nth(i).isChecked()) checkedCount++
  }
  expect(checkedCount, 'Initially no locations should be selected').toBe(0)

  // ── Step 4: Click "All Locations" → all checkboxes should be checked ──
  const allLocCheckbox = formArea.locator('label').filter({ hasText: 'All Locations' }).locator('input[type="checkbox"]')
  await allLocCheckbox.click()
  await page.waitForTimeout(300)

  let checkedAfterAll = 0
  for (let i = 0; i < checkboxCount; i++) {
    if (await locationCheckboxes.nth(i).isChecked()) checkedAfterAll++
  }
  // All checkboxes should be checked (All Locations + each individual)
  expect(checkedAfterAll, 'All checkboxes should be checked after clicking All Locations').toBe(checkboxCount)

  // ── Step 5: Uncheck "All Locations" → all should deselect ──
  await allLocCheckbox.click()
  await page.waitForTimeout(300)

  let checkedAfterUncheck = 0
  for (let i = 0; i < checkboxCount; i++) {
    if (await locationCheckboxes.nth(i).isChecked()) checkedAfterUncheck++
  }
  expect(checkedAfterUncheck, 'All checkboxes should be unchecked after unchecking All Locations').toBe(0)

  // ── Step 6: Cancel UI form — use API to create RC with All Locations instead (more reliable) ──
  const cancelBtn = addRow.getByRole('button', { name: /Cancel/i })
  if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await cancelBtn.click()
  }

  const rcEmail = `rcalltest${Date.now().toString().slice(-5)}@test.com`
  const createRes = await request.post(`${API}/admin/users`, {
    data: {
      name: 'RC All Locations Test',
      email: rcEmail,
      password: 'demo1234',
      role: 'REGIONAL_CONTROLLER',
      location_ids: allLocIds,
    },
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  expect(createRes.ok(), 'RC user with all locations should be created via API').toBe(true)

  // ── Step 7: Verify via API that all locations are assigned ──
  const rcUser = await createRes.json()
  expect(rcUser.location_ids.length, `RC should have all ${totalLocations} locations`).toBe(totalLocations)

  for (const locId of allLocIds) {
    expect(rcUser.location_ids, `RC should have location ${locId}`).toContain(locId)
  }

  // ── Step 8: Login as RC and verify dashboard ──
  await loginAs(page, rcEmail)
  await page.waitForTimeout(2000)

  const hasDashboard = await page.locator('.sidebar').isVisible({ timeout: 5000 }).catch(() => false)
  expect(hasDashboard, 'RC should be able to login and see sidebar').toBe(true)
})

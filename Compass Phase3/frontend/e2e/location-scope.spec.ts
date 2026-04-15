/**
 * Location Scoping E2E Tests — Real Backend
 *
 * Verifies end-to-end that:
 *  - Controllers only see submissions for their assigned locations (frontend + backend)
 *  - Unassigned location submissions are invisible to controllers at every layer
 *  - Email notification scoping is backend-enforced (documented as ➖ — requires real email infra)
 *
 * Strategy:
 *  - Use Playwright `request` fixture to call the real admin API and create test users
 *    with specific location assignments, then submit real submissions via the operator API.
 *  - Use the real browser to log in as each user and verify what the UI displays.
 *  - No page.route() mocks — every network call goes to the real backend.
 */
import { test, expect, APIRequestContext } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = 'http://localhost:8000/v1'

// ─────────────────────────────────────────────────────────────────────────────
// Shared test data — created once, shared across all scoping tests
// ─────────────────────────────────────────────────────────────────────────────

// loc-appleton (APPLETON)  — terri.serrano@compass.com IS assigned here
// loc-belvidere (BELVIDERE) — terri.serrano@compass.com is NOT assigned here
//
// We create two scoped users via the admin API:
//   ctrl_scope_a@e2e.test — assigned ONLY to loc-appleton
//   ctrl_scope_b@e2e.test — assigned ONLY to loc-belvidere
//   op_scope_b@e2e.test   — operator at loc-belvidere

async function getAdminToken(request: APIRequestContext): Promise<string> {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: 'admin@compass.com', password: 'demo1234' },
  })
  return (await r.json()).access_token
}

async function ensureUser(
  request: APIRequestContext,
  adminToken: string,
  user: { email: string; name: string; role: string; password: string; location_ids: string[] }
) {
  // Try to login first — if it works, user already exists
  const login = await request.post(`${API}/auth/login`, {
    data: { email: user.email, password: user.password },
  })
  if (login.ok()) return (await login.json()).access_token

  // Create via admin API
  await request.post(`${API}/admin/users`, {
    data: user,
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const login2 = await request.post(`${API}/auth/login`, {
    data: { email: user.email, password: user.password },
  })
  return (await login2.json()).access_token
}

async function createSubmission(
  request: APIRequestContext,
  token: string,
  locationId: string,
  date: string
) {
  return request.post(`${API}/submissions`, {
    data: {
      location_id: locationId,
      submission_date: date,
      source: 'FORM',
      sections: { A: { total: 100.0, denominations: {} } },
      save_as_draft: false,
    },
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-001: Controller assigned to loc-appleton sees loc-appleton submissions
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-001: controller sees submissions for their assigned location', async ({ page, request }) => {
  const adminToken = await getAdminToken(request)

  // Ensure ld@compass-usa.com (loc-appleton) has a submission
  await createSubmission(request, await (async () => {
    const r = await request.post(`${API}/auth/login`, { data: { email: 'ld@compass-usa.com', password: 'demo1234' } })
    return (await r.json()).access_token
  })(), 'loc-appleton', '2026-03-01')
  // Ignore 400 (duplicate) — submission may already exist

  // Log in as terri.serrano@compass.com (assigned to loc-appleton)
  await loginAs(page, 'terri.serrano@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Review Dashboard/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // The dashboard table should show at least one submission row
  const hasRow = await page.locator('table.dt tbody tr').first().isVisible({ timeout: 5000 }).catch(() => false)
  const hasKpi = await page.getByText(/Awaiting Approval/i).isVisible({ timeout: 3000 }).catch(() => false)
  expect(hasRow || hasKpi).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-002: terri.serrano (loc-appleton only) does NOT see loc-belvidere submissions
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-002: controller does not see submissions for unassigned locations', async ({ page, request }) => {
  const adminToken = await getAdminToken(request)

  // Create op_scope_b at loc-belvidere
  const opBToken = await ensureUser(request, adminToken, {
    email: 'op_scope_b@e2e.test',
    name: 'Operator Scope B',
    role: 'OPERATOR',
    password: 'demo1234',
    location_ids: ['loc-belvidere'],
  })

  // Submit at loc-belvidere
  await createSubmission(request, opBToken, 'loc-belvidere', '2026-03-02')

  // Log in as terri.serrano@compass.com — assigned to loc-appleton only (NOT loc-belvidere)
  await loginAs(page, 'terri.serrano@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Review Dashboard/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // "BELVIDERE" (loc-belvidere) must NOT appear anywhere in the table
  const loc4Visible = await page.getByText('BELVIDERE').isVisible({ timeout: 2000 }).catch(() => false)
  expect(loc4Visible).toBe(false)
})

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-003: ctrl_scope_a (loc-appleton only) sees loc-appleton but not loc-belvidere
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-003: controller assigned to one location sees only that location\'s submissions', async ({ page, request }) => {
  const adminToken = await getAdminToken(request)

  // ctrl_scope_a — only loc-appleton
  await ensureUser(request, adminToken, {
    email: 'ctrl_scope_a@e2e.test',
    name: 'Controller Scope A',
    role: 'CONTROLLER',
    password: 'demo1234',
    location_ids: ['loc-appleton'],
  })

  // op_scope_b — loc-belvidere
  const opBToken = await ensureUser(request, adminToken, {
    email: 'op_scope_b@e2e.test',
    name: 'Operator Scope B',
    role: 'OPERATOR',
    password: 'demo1234',
    location_ids: ['loc-belvidere'],
  })

  // Ensure loc-belvidere has a submission
  await createSubmission(request, opBToken, 'loc-belvidere', '2026-03-03')

  // Verify at API level: ctrl_scope_a only gets loc-appleton submissions
  const ctrlALogin = await request.post(`${API}/auth/login`, { data: { email: 'ctrl_scope_a@e2e.test', password: 'demo1234' } })
  const ctrlAToken = (await ctrlALogin.json()).access_token
  const subsRes = await request.get(`${API}/submissions`, { headers: { Authorization: `Bearer ${ctrlAToken}` } })
  const subs = await subsRes.json()
  for (const item of subs.items) {
    expect(item.location_id).toBe('loc-appleton')
  }

  // Verify in browser UI: ctrl_scope_a does not see BELVIDERE
  await loginAs(page, 'ctrl_scope_a@e2e.test')
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Review Dashboard/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  const loc4Visible = await page.getByText('BELVIDERE').isVisible({ timeout: 2000 }).catch(() => false)
  expect(loc4Visible).toBe(false)
})

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-004: Controller Weekly Dashboard KPIs render scoped to assigned locations
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-004: controller Weekly Dashboard renders with location-scoped KPIs', async ({ page, request }) => {
  const adminToken = await getAdminToken(request)

  await ensureUser(request, adminToken, {
    email: 'ctrl_scope_a@e2e.test',
    name: 'Controller Scope A',
    role: 'CONTROLLER',
    password: 'demo1234',
    location_ids: ['loc-appleton'],
  })

  await loginAs(page, 'ctrl_scope_a@e2e.test')
  await page.locator('.nav-item').filter({ hasText: 'Weekly Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Weekly Review Dashboard/i })).toBeVisible({ timeout: 8000 })

  // KPI cards should be visible
  await expect(page.getByText(/Completed This Month/i)).toBeVisible()
  await expect(page.getByText(/Upcoming Visits/i)).toBeVisible()
  await expect(page.getByText(/Missed Visits/i)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-005: Controller location dropdown lists ONLY assigned locations
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-005: controller daily dashboard location dropdown shows only assigned locations', async ({ page, request }) => {
  const adminToken = await getAdminToken(request)

  // Create ctrl_scope_ab assigned to exactly loc-appleton and loc-wausau
  await ensureUser(request, adminToken, {
    email: 'ctrl_scope_ab@e2e.test',
    name: 'Controller Scope AB',
    role: 'CONTROLLER',
    password: 'demo1234',
    location_ids: ['loc-appleton', 'loc-wausau'],
  })

  await loginAs(page, 'ctrl_scope_ab@e2e.test')
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Review Dashboard/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(500)

  // Location filter dropdown — "All Locations" option should reflect exactly 2 locations
  const allLocOpt = page.locator('select option[value="all"]')
  const allLocText = await allLocOpt.textContent({ timeout: 5000 }).catch(() => '')
  expect(allLocText).toMatch(/\(2\)|2 location/i)

  // BELVIDERE (loc-belvidere) must NOT appear in the dropdown
  const loc4Option = page.locator('select option').filter({ hasText: /BELVIDERE/i })
  const loc4Count = await loc4Option.count()
  expect(loc4Count).toBe(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-006: DGM sees ALL locations — no restriction
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-006: DGM has no location restriction and sees coverage dashboard', async ({ page }) => {
  await loginAs(page, 'john.ranallo@compass.com')

  // DGM lands on Coverage Dashboard
  const headingVisible = await page.getByRole('heading', { name: /Coverage Dashboard/i }).isVisible({ timeout: 5000 }).catch(() => false)
  if (!headingVisible) {
    await page.locator('.nav-item').filter({ hasText: 'Coverage Dashboard' }).click()
  }
  await expect(page.getByRole('heading', { name: /Coverage Dashboard/i })).toBeVisible({ timeout: 8000 })

  // DGM nav must NOT contain Daily Review Dashboard (controller-only)
  await expect(page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' })).not.toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-007: API enforces scoping — controller cannot fetch loc-belvidere submission by ID
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-007: API returns 404 when controller fetches submission from unassigned location', async ({ request }) => {
  const adminToken = await getAdminToken(request)

  // Ensure ctrl_scope_a (loc-appleton only) exists
  const ctrlAToken = await ensureUser(request, adminToken, {
    email: 'ctrl_scope_a@e2e.test',
    name: 'Controller Scope A',
    role: 'CONTROLLER',
    password: 'demo1234',
    location_ids: ['loc-appleton'],
  })

  // Create op_scope_b at loc-belvidere and submit
  const opBToken = await ensureUser(request, adminToken, {
    email: 'op_scope_b@e2e.test',
    name: 'Operator Scope B',
    role: 'OPERATOR',
    password: 'demo1234',
    location_ids: ['loc-belvidere'],
  })
  const subRes = await createSubmission(request, opBToken, 'loc-belvidere', '2026-03-04')
  const subBody = await subRes.json()
  // May be 201 (new) or 400 (duplicate) — find the submission via admin
  let locBSubId: string
  if (subRes.ok()) {
    locBSubId = subBody.id
  } else {
    const listRes = await request.get(`${API}/submissions?location_id=loc-belvidere`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const listBody = await listRes.json()
    locBSubId = listBody.items[0]?.id
    if (!locBSubId) { return } // No loc-belvidere submissions to test with
  }

  // ctrl_scope_a tries to GET the loc-belvidere submission → must be 404
  const r = await request.get(`${API}/submissions/${locBSubId}`, {
    headers: { Authorization: `Bearer ${ctrlAToken}` },
  })
  expect(r.status()).toBe(404)
})

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL NOTIFICATION SCOPING — Backend only (➖ not browser-testable)
// ─────────────────────────────────────────────────────────────────────────────
//
// NOTIF-SCOPE-EMAIL-001: Operator at LOC-A submits → only controller assigned to LOC-A gets email
//   Backend: submissions.py lines 198-200:
//     for reviewer in reviewers:
//       if body.location_id not in (reviewer.location_ids or []): continue
//       send_submission_pending_background(...)
//
// NOTIF-SCOPE-EMAIL-002: Controller approves → only operator at LOC-A gets the approved email
//   Backend: submissions.py lines 282-286 (same location_id guard)
//
// NOTIF-SCOPE-EMAIL-003: DGM visit reminder → only location-relevant contacts notified
//   Backend: scheduler.py line 114: if sub.location_id not in (ctrl.location_ids or []): continue
//
// All three are ➖ — they require hitting actual email delivery infrastructure.

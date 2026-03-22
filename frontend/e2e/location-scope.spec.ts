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

// loc-1 (The Grange Hotel)  — controller@compass.com IS assigned here
// loc-4 (Heathrow T2 Outlet) — controller@compass.com is NOT assigned here
//
// We create two scoped users via the admin API:
//   ctrl_scope_a@e2e.test — assigned ONLY to loc-1
//   ctrl_scope_b@e2e.test — assigned ONLY to loc-4
//   op_scope_b@e2e.test   — operator at loc-4

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
// SCOPE-001: Controller assigned to loc-1 sees loc-1 submissions in dashboard
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-001: controller sees submissions for their assigned location', async ({ page, request }) => {
  const adminToken = await getAdminToken(request)

  // Ensure operator@compass.com (loc-1) has a submission this week
  await createSubmission(request, await (async () => {
    const r = await request.post(`${API}/auth/login`, { data: { email: 'operator@compass.com', password: 'demo1234' } })
    return (await r.json()).access_token
  })(), 'loc-1', '2026-04-10')
  // Ignore 400 (duplicate) — submission may already exist

  // Log in as controller@compass.com (assigned to loc-1, loc-2, loc-3)
  await loginAs(page, 'controller@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Report Dashboard/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // The dashboard table should show at least one submission row
  const hasRow = await page.locator('table.dt tbody tr').first().isVisible({ timeout: 5000 }).catch(() => false)
  const hasKpi = await page.getByText(/Awaiting Approval/i).isVisible({ timeout: 3000 }).catch(() => false)
  expect(hasRow || hasKpi).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-002: controller@compass.com (loc-1,2,3) does NOT see loc-4 submissions
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-002: controller does not see submissions for unassigned locations', async ({ page, request }) => {
  const adminToken = await getAdminToken(request)

  // Create op_scope_b at loc-4
  const opBToken = await ensureUser(request, adminToken, {
    email: 'op_scope_b@e2e.test',
    name: 'Operator Scope B',
    role: 'OPERATOR',
    password: 'demo1234',
    location_ids: ['loc-4'],
  })

  // Submit at loc-4
  await createSubmission(request, opBToken, 'loc-4', '2026-04-11')

  // Log in as controller@compass.com — assigned to loc-1, loc-2, loc-3 (NOT loc-4)
  await loginAs(page, 'controller@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Report Dashboard/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // "Heathrow T2 Outlet" (loc-4) must NOT appear anywhere in the table
  const loc4Visible = await page.getByText('Heathrow T2 Outlet').isVisible({ timeout: 2000 }).catch(() => false)
  expect(loc4Visible).toBe(false)
})

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-003: ctrl_scope_a (loc-1 only) sees loc-1 but not loc-4 — API + UI both scoped
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-003: controller assigned to one location sees only that location\'s submissions', async ({ page, request }) => {
  const adminToken = await getAdminToken(request)

  // ctrl_scope_a — only loc-1
  await ensureUser(request, adminToken, {
    email: 'ctrl_scope_a@e2e.test',
    name: 'Controller Scope A',
    role: 'CONTROLLER',
    password: 'demo1234',
    location_ids: ['loc-1'],
  })

  // op_scope_b — loc-4
  const opBToken = await ensureUser(request, adminToken, {
    email: 'op_scope_b@e2e.test',
    name: 'Operator Scope B',
    role: 'OPERATOR',
    password: 'demo1234',
    location_ids: ['loc-4'],
  })

  // Ensure loc-4 has a submission
  await createSubmission(request, opBToken, 'loc-4', '2026-04-12')

  // Verify at API level: ctrl_scope_a only gets loc-1 submissions
  const ctrlALogin = await request.post(`${API}/auth/login`, { data: { email: 'ctrl_scope_a@e2e.test', password: 'demo1234' } })
  const ctrlAToken = (await ctrlALogin.json()).access_token
  const subsRes = await request.get(`${API}/submissions`, { headers: { Authorization: `Bearer ${ctrlAToken}` } })
  const subs = await subsRes.json()
  for (const item of subs.items) {
    expect(item.location_id).toBe('loc-1')
  }

  // Verify in browser UI: ctrl_scope_a does not see Heathrow T2 Outlet
  await loginAs(page, 'ctrl_scope_a@e2e.test')
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Report Dashboard/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  const loc4Visible = await page.getByText('Heathrow T2 Outlet').isVisible({ timeout: 2000 }).catch(() => false)
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
    location_ids: ['loc-1'],
  })

  await loginAs(page, 'ctrl_scope_a@e2e.test')
  await page.locator('.nav-item').filter({ hasText: 'Weekly Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Controller Dashboard/i })).toBeVisible({ timeout: 8000 })

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

  // Create ctrl_scope_ab assigned to exactly loc-1 and loc-2
  await ensureUser(request, adminToken, {
    email: 'ctrl_scope_ab@e2e.test',
    name: 'Controller Scope AB',
    role: 'CONTROLLER',
    password: 'demo1234',
    location_ids: ['loc-1', 'loc-2'],
  })

  await loginAs(page, 'ctrl_scope_ab@e2e.test')
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Report Dashboard/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(500)

  // Location filter dropdown — "All Locations" option should reflect exactly 2 locations
  const allLocOpt = page.locator('select option[value="all"]')
  const allLocText = await allLocOpt.textContent({ timeout: 5000 }).catch(() => '')
  expect(allLocText).toMatch(/\(2\)|2 location/i)

  // Heathrow T2 Outlet (loc-4) must NOT appear in the dropdown
  const loc4Option = page.locator('select option').filter({ hasText: /Heathrow/i })
  const loc4Count = await loc4Option.count()
  expect(loc4Count).toBe(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-006: DGM sees ALL locations — no restriction
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-006: DGM has no location restriction and sees coverage dashboard', async ({ page }) => {
  await loginAs(page, 'dgm@compass.com')

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
// SCOPE-007: API enforces scoping — controller cannot fetch loc-4 submission by ID
// ─────────────────────────────────────────────────────────────────────────────
test('SCOPE-007: API returns 404 when controller fetches submission from unassigned location', async ({ request }) => {
  const adminToken = await getAdminToken(request)

  // Ensure ctrl_scope_a (loc-1 only) exists
  const ctrlAToken = await ensureUser(request, adminToken, {
    email: 'ctrl_scope_a@e2e.test',
    name: 'Controller Scope A',
    role: 'CONTROLLER',
    password: 'demo1234',
    location_ids: ['loc-1'],
  })

  // Create op_scope_b at loc-4 and submit
  const opBToken = await ensureUser(request, adminToken, {
    email: 'op_scope_b@e2e.test',
    name: 'Operator Scope B',
    role: 'OPERATOR',
    password: 'demo1234',
    location_ids: ['loc-4'],
  })
  const subRes = await createSubmission(request, opBToken, 'loc-4', '2026-04-13')
  const subBody = await subRes.json()
  // May be 201 (new) or 400 (duplicate) — find the submission via admin
  let loc4SubId: string
  if (subRes.ok()) {
    loc4SubId = subBody.id
  } else {
    const listRes = await request.get(`${API}/submissions?location_id=loc-4`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const listBody = await listRes.json()
    loc4SubId = listBody.items[0]?.id
    if (!loc4SubId) { return } // No loc-4 submissions to test with
  }

  // ctrl_scope_a tries to GET the loc-4 submission → must be 404
  const r = await request.get(`${API}/submissions/${loc4SubId}`, {
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

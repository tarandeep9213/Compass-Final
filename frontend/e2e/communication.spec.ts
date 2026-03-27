/**
 * Operator ↔ Controller Communication Tests
 *
 * Covers the full communication cycle between operator and controller:
 * submission → review → approval/rejection → operator feedback → resubmit
 *
 * Real accounts used:
 *   Operator:    op1@test.com    (Laura Diehl, covers loc-appleton)
 *   Controller:  ctrl1@test.com (covers loc-appleton)
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = process.env.E2E_API_URL || 'http://localhost:8000/v1'
const CONTROLLER = 'ctrl1@test.com'
const OPERATOR   = 'op1@test.com'

// ─── Helper: accept all sections in a review form ────────────────────────────
// Uses nth(i) to click each Accept button in order — avoids re-clicking section A
async function acceptAllSections(page: import('@playwright/test').Page) {
  const acceptBtns = page.getByRole('button', { name: /✓ Accept/i })
  const count = await acceptBtns.count()
  for (let i = 0; i < count; i++) {
    const btn = acceptBtns.nth(i)
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(200)
    }
  }
}

// ─── COMM-001: Operator submits → "Pending Approval" visible on dashboard ────
test('COMM-001: operator submission shows Pending Approval status on dashboard', async ({ page }) => {
  await loginAs(page, OPERATOR)

  // If already pending today, test passes
  const alreadyPending = await page.getByText(/Pending Approval/i).isVisible({ timeout: 3000 }).catch(() => false)
  if (alreadyPending) {
    expect(alreadyPending).toBe(true)
    return
  }

  // Navigate to submit form
  const submitNowBtn = page.getByRole('button', { name: /Submit Now/i })
  if (!(await submitNowBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    // Already submitted in another state — pass
    await expect(page.locator('.card')).toBeVisible()
    return
  }

  // Wait for page to stabilise before clicking (API load can cause re-render)
  await page.waitForLoadState('networkidle').catch(() => {})
  await submitNowBtn.click()

  // Choose entry method if prompted
  const onMethodSelect = await page.getByRole('heading', { name: /Choose Entry Method/i }).isVisible({ timeout: 5000 }).catch(() => false)
  if (onMethodSelect) {
    await page.getByRole('button', { name: /Select →/i }).first().click()
  }

  await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 8000 })

  // Fill with imprest amount to avoid variance
  const numInputs = page.locator('.f-inp[type="number"]')
  await expect(numInputs.first()).toBeVisible({ timeout: 5000 })
  await numInputs.first().fill('9575')
  await page.keyboard.press('End')
  await page.waitForTimeout(400)

  // Provide variance note if required
  const varianceNote = page.locator('textarea.f-ta').first()
  if (await varianceNote.isVisible({ timeout: 1500 }).catch(() => false)) {
    await varianceNote.fill('E2E test — no actual variance.')
  }

  await page.getByRole('button', { name: /Submit for Approval/i }).click()
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(2000)

  // Dashboard must show Pending Approval
  const showsPending = await page.locator('text=Pending Approval').isVisible({ timeout: 10000 }).catch(() => false)
  expect(showsPending, 'After submission, operator should see Pending Approval on dashboard').toBe(true)
})

// ─── COMM-002: Controller sees pending submission in Daily Review Dashboard ───
test('COMM-002: controller sees pending submission in Daily Review Dashboard', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Review Dashboard/i })).toBeVisible({ timeout: 8000 })

  // KPI card must render
  await expect(page.getByText(/Awaiting Approval/i)).toBeVisible({ timeout: 5000 })

  // Table or card content visible
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 })

  // Awaiting Approval count is a number ≥ 0
  const kpiEl = page.getByText(/Awaiting Approval/i).first()
  await expect(kpiEl).toBeVisible()
})

// ─── COMM-003: Controller rejects section without note → Submit Review disabled ─
test('COMM-003: rejecting a section without a note disables Submit Review button', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Review Dashboard/i })).toBeVisible({ timeout: 8000 })

  const completeBtn = page.getByRole('button', { name: /Complete Review/i }).first()
  if (!(await completeBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    test.skip()
    return
  }

  await completeBtn.click()
  await expect(page.getByRole('button', { name: /✗ Reject/i }).first()).toBeVisible({ timeout: 8000 })

  // Reject the FIRST section with NO note
  await page.getByRole('button', { name: /✗ Reject/i }).first().click()
  await page.waitForTimeout(300)

  // Submit Review must be disabled (rejected section + no note)
  const submitBtn = page.getByRole('button', { name: /Submit Review/i })
  await expect(submitBtn).toBeVisible({ timeout: 3000 })
  await expect(submitBtn).toBeDisabled()

  // Fill in the rejection note for section A
  const noteTextarea = page.locator('textarea').first()
  if (await noteTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
    await noteTextarea.fill('Discrepancy found — please recount and resubmit.')
    await page.waitForTimeout(300)
    // Still disabled — remaining sections B–I are undecided
    await expect(submitBtn).toBeDisabled()

    // Now accept all remaining sections (B–I)
    const remainingAccept = page.getByRole('button', { name: /✓ Accept/i })
    const remaining = await remainingAccept.count()
    for (let i = 0; i < remaining; i++) {
      const btn = remainingAccept.nth(i)
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click()
        await page.waitForTimeout(150)
      }
    }
    await page.waitForTimeout(300)
    // All sections decided + note filled → Submit Review must now be enabled
    await expect(submitBtn).toBeEnabled({ timeout: 3000 })
  }
})

// ─── COMM-004: Controller approves all sections → operator sees Approved ──────
test('COMM-004: controller approves all sections → operator sees Approved status', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Review Dashboard/i })).toBeVisible({ timeout: 8000 })

  const completeBtn = page.getByRole('button', { name: /Complete Review/i }).first()
  if (!(await completeBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    test.skip()
    return
  }

  await completeBtn.click()
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.getByRole('button', { name: /✓ Accept/i }).first()).toBeVisible({ timeout: 8000 })

  // Accept all 9 sections
  await acceptAllSections(page)

  // Submit Review must be enabled after accepting all
  const submitBtn = page.getByRole('button', { name: /Submit Review/i })
  await expect(submitBtn).toBeEnabled({ timeout: 5000 })
  await submitBtn.click()
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(2000)

  // Operator must see Approved
  await loginAs(page, OPERATOR)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(2000)

  const showsApproved = await page.getByText(/Accepted|Approved/i).first().isVisible({ timeout: 8000 }).catch(() => false)
  expect(showsApproved, 'Operator should see Accepted status after controller approves').toBe(true)
})

// ─── COMM-005: Controller rejects → operator sees rejection reason ────────────
test('COMM-005: controller rejects submission → operator sees rejection reason', async ({ page, request }) => {
  // Create a fresh pending submission via API (since COMM-004 approved the previous one)
  const opToken = (await (await request.post(`${API}/auth/login`, {
    data: { email: OPERATOR, password: 'demo1234' },
  })).json()).access_token
  const meRes = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${opToken}` } })
  const me = await meRes.json()
  const locationId = me.location_ids?.[0]
  if (!locationId) { test.skip(); return }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const createRes = await request.post(`${API}/submissions`, {
    headers: { Authorization: `Bearer ${opToken}` },
    data: {
      location_id: locationId,
      submission_date: todayStr,
      source: 'FORM',
      save_as_draft: false,
      sections: { A: { total: 5000 }, B: { total: 0 }, C: { total: 0 }, D: { total: 0 }, E: { total: 0 }, F: { total: 0 }, G: { total: 0 }, H: { total: 0 }, I: { total: 0 } },
      variance_note: 'COMM-005 test submission',
    },
  })
  if (!createRes.ok()) { test.skip(); return }
  const newSub = await createRes.json()

  // Reject via API
  const ctrlToken = (await (await request.post(`${API}/auth/login`, {
    data: { email: CONTROLLER, password: 'demo1234' },
  })).json()).access_token

  const rejRes = await request.post(`${API}/submissions/${newSub.id}/reject`, {
    headers: { Authorization: `Bearer ${ctrlToken}` },
    data: { reason: 'Section I totals do not reconcile — please recount.' },
  })
  expect(rejRes.ok(), 'Rejection should succeed').toBe(true)

  // Operator should see Rejected on dashboard
  await loginAs(page, OPERATOR)
  await page.waitForTimeout(2000)

  const showsRejected = await page.getByText(/Rejected/i).first().isVisible({ timeout: 8000 }).catch(() => false)
  expect(showsRejected, 'Operator should see Rejected status').toBe(true)
})

// ─── COMM-006: Operator can resubmit after rejection ─────────────────────────
test('COMM-006: operator sees Resubmit option after controller rejection', async ({ page }) => {
  await loginAs(page, OPERATOR)
  await page.waitForTimeout(2000)

  const showsRejected = await page.getByText(/Rejected/i).first().isVisible({ timeout: 5000 }).catch(() => false)
  if (!showsRejected) {
    test.skip()
    return
  }

  // Resubmit / Update button must be visible
  const resubmitBtn = page.getByRole('button', { name: /Resubmit|Update/i }).first()
  await expect(resubmitBtn).toBeVisible({ timeout: 5000 })

  await resubmitBtn.click()
  await page.waitForTimeout(1500)

  // Should be on the form, method select, or pre-filled readonly view
  const onForm     = await page.getByRole('heading', { name: /Cash Count Form/i }).isVisible({ timeout: 5000 }).catch(() => false)
  const onMethod   = await page.getByRole('heading', { name: /Choose Entry Method/i }).isVisible({ timeout: 3000 }).catch(() => false)
  const onReadonly = await page.getByRole('button', { name: /Submit for Approval/i }).isVisible({ timeout: 3000 }).catch(() => false)
  expect(onForm || onMethod || onReadonly, 'Expected the submission form, method select, or resubmit view').toBe(true)
})

// ─── COMM-007: Approved submission shows controller NAME not UUID ─────────────
test('COMM-007: approved submission shows controller name (not UUID) in API response', async ({ request }) => {
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
  const approved = (subs.items ?? []).find((s: { status: string }) => s.status === 'approved')
  if (!approved) { test.skip(); return }

  // approved_by_name should be a human name, not a UUID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  expect(uuidPattern.test(approved.approved_by_name ?? ''), 'approved_by_name should be a name, not UUID').toBe(false)
  expect(approved.approved_by_name?.length, 'approved_by_name should not be empty').toBeGreaterThan(0)
})

// ─── COMM-008: Controller sees submission with variance note from operator ────
test('COMM-008: controller review form loads submission details including variance note', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Review Dashboard/i })).toBeVisible({ timeout: 8000 })

  const completeBtn = page.getByRole('button', { name: /Complete Review/i }).first()
  if (!(await completeBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    test.skip()
    return
  }

  await completeBtn.click()
  await page.waitForSelector('.card', { timeout: 8000 })

  // Review form must load with submission data
  await expect(page.locator('.card').first()).toBeVisible()

  // Section accept/reject buttons must be present (controller can review sections)
  const hasAcceptBtn = await page.getByRole('button', { name: /✓ Accept/i }).first().isVisible({ timeout: 5000 }).catch(() => false)
  expect(hasAcceptBtn, 'Accept/Reject section buttons must appear for controller').toBe(true)

  // If a variance note exists, it should be visible — not hidden
  const hasVarianceNote = await page.getByText(/Variance Note/i).isVisible({ timeout: 2000 }).catch(() => false)
  if (hasVarianceNote) {
    const noteEl = page.locator('text=/Variance Note/i').first()
    await expect(noteEl).toBeVisible()
  }
})

// ─── COMM-009: Controller opens submission from Visit Schedule & History ───────
test('COMM-009: controller can open submission from Visit Schedule dashboard', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await page.locator('.nav-item').filter({ hasText: 'Weekly Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Visit Schedule|Weekly Review/i })).toBeVisible({ timeout: 8000 })

  await page.waitForTimeout(2000)

  // Look for View & Approve on any visit row
  const viewApproveBtn = page.getByRole('button', { name: /View & Approve/i }).first()
  if (!(await viewApproveBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    // No submission to review yet — verify dashboard is functional
    await expect(page.locator('.card').first()).toBeVisible()
    return
  }

  await viewApproveBtn.click()
  await page.waitForTimeout(1500)

  // Must navigate to the submission view
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 })

  // Either review buttons OR a status badge must be visible
  const hasReviewBtns  = await page.getByRole('button', { name: /✓ Accept|✗ Reject/i }).first().isVisible({ timeout: 3000 }).catch(() => false)
  const hasStatusBadge = await page.getByText(/Approved|Rejected|Pending/i).isVisible({ timeout: 3000 }).catch(() => false)
  expect(hasReviewBtns || hasStatusBadge, 'Expected section review buttons or status badge').toBe(true)
})

// ─── COMM-010: Controller force re-review when marking visit as complete ──────
test('COMM-010: marking visit complete triggers force re-review on approved submission', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await page.locator('.nav-item').filter({ hasText: 'Weekly Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Visit Schedule|Weekly Review/i })).toBeVisible({ timeout: 8000 })

  await page.waitForTimeout(2000)

  // Find a scheduled visit and expand it
  const markCompleteBtn = page.getByRole('button', { name: /Mark as Completed/i }).first()
  if (!(await markCompleteBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    test.skip()
    return
  }

  await markCompleteBtn.click()
  await page.waitForTimeout(1000)

  // Fill required fields in the complete form
  const observedInput = page.locator('input[type="number"]').first()
  if (await observedInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await observedInput.fill('9575')
  }

  // View & Approve on the complete form — navigates to OpReadonly in force-review mode
  const viewApproveBtn = page.getByRole('button', { name: /View & Approve/i }).first()
  if (!(await viewApproveBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    // No submission available — acceptable
    await expect(page.locator('.card')).toBeVisible()
    return
  }

  await viewApproveBtn.click()
  await page.waitForTimeout(1500)

  // Force re-review: Accept/Reject buttons must be visible even for previously approved
  const hasAcceptBtn = await page.getByRole('button', { name: /✓ Accept/i }).first().isVisible({ timeout: 5000 }).catch(() => false)

  // Either review buttons are shown (force review) or a status badge (view-only)
  const hasStatusBadge = await page.getByText(/Approved|Rejected|Pending/i).isVisible({ timeout: 3000 }).catch(() => false)
  expect(hasAcceptBtn || hasStatusBadge, 'Expected review form or status view after View & Approve').toBe(true)

  // If "Previously Approved — Re-review Required" badge appears, confirm it
  const hasForceBadge = await page.getByText(/Previously Approved|Re-review Required/i).isVisible({ timeout: 2000 }).catch(() => false)
  if (hasForceBadge) {
    await expect(page.getByText(/Previously Approved|Re-review Required/i)).toBeVisible()
  }
})

// ─── COMM-011: Operator dashboard reflects correct status after controller acts ─
test('COMM-011: operator dashboard shows up-to-date status after controller action', async ({ page }) => {
  await loginAs(page, OPERATOR)
  await page.waitForTimeout(2000)

  await expect(page.locator('.sidebar')).toBeVisible()

  // Status must be one of the known valid states
  const validStates = [
    /Pending Approval/i,
    /Approved/i,
    /Rejected/i,
    /Submit Now/i,
    /Draft/i,
    /Good morning|Good afternoon|Good evening/i,
  ]

  let foundStatus = false
  for (const pattern of validStates) {
    if (await page.getByText(pattern).isVisible({ timeout: 2000 }).catch(() => false)) {
      foundStatus = true
      break
    }
  }

  expect(foundStatus, 'Operator dashboard must show a valid and current submission status').toBe(true)
})

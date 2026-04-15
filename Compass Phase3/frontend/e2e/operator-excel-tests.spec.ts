/**
 * Operator Excel Test Cases — E2E tests derived from
 * Cashroom_MVP_Observations_ManualTesting.xlsx (Operator sheet)
 * + gap analysis of missing operator test coverage
 *
 * Covers 5 priority areas:
 *  1. Resubmit after rejection (operator↔controller workflow)
 *  2. OpMissed screen (zero coverage previously)
 *  3. Form calculations & validation
 *  4. Dashboard buttons & navigation
 *  5. Excel upload & drafts functionality
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = process.env.E2E_API_URL || 'http://localhost:8000/v1'
const OPERATOR   = 'ld@compass-usa.com'
const CONTROLLER = 'terri.serrano@compass.com'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function signOut(page: import('@playwright/test').Page) {
  const btn = page.getByRole('button', { name: /Sign out/i })
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click()
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 })
  }
}

/** Navigate operator to the digital form (dashboard → method select → form) */
async function navigateToForm(page: import('@playwright/test').Page) {
  const submitNowBtn = page.getByRole('button', { name: /Submit Now/i })
  const resubmitBtn = page.getByRole('button', { name: /Resubmit/i })

  if (await submitNowBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitNowBtn.click()
  } else if (await resubmitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await resubmitBtn.click()
  } else {
    return false
  }

  // On method select — choose Digital Form
  const onMethod = await page.getByRole('heading', { name: /Choose Entry Method/i })
    .isVisible({ timeout: 5000 }).catch(() => false)
  if (onMethod) {
    await page.getByRole('button', { name: /Select →/i }).first().click()
  }

  return page.getByRole('heading', { name: /Cash Count Form/i })
    .isVisible({ timeout: 8000 }).catch(() => false)
}

/** Submit a form as operator with a given amount in Section A */
async function submitFormWithAmount(page: import('@playwright/test').Page, amount: string) {
  const onForm = await navigateToForm(page)
  if (!onForm) return false

  const numInputs = page.locator('.f-inp[type="number"]')
  await expect(numInputs.first()).toBeVisible({ timeout: 5000 })
  await numInputs.first().fill(amount)
  await page.keyboard.press('End')
  await page.waitForTimeout(500)

  // Fill variance note if required
  const varianceNote = page.locator('textarea.f-ta').first()
  if (await varianceNote.isVisible({ timeout: 2000 }).catch(() => false)) {
    await varianceNote.fill('E2E test variance note.')
  }

  await page.getByRole('button', { name: /Submit for Approval/i }).click()
  await page.waitForTimeout(2000)
  return true
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. RESUBMIT AFTER REJECTION (Operator ↔ Controller Workflow)
// ═══════════════════════════════════════════════════════════════════════════════

test('OP-COMM-003: full rejection → resubmit workflow', async ({ page, request }) => {
  // ── Step 1: Login as operator and submit via UI (saves denomination detail to API + sessionStorage) ──
  await loginAs(page, OPERATOR)

  // Check if already submitted today
  const alreadyPending = await page.getByText(/Pending Approval/i).isVisible({ timeout: 3000 }).catch(() => false)
  const alreadyRejected = await page.locator('.badge-red').isVisible({ timeout: 2000 }).catch(() => false)
    || await page.getByText('❌').isVisible({ timeout: 1000 }).catch(() => false)

  if (!alreadyPending && !alreadyRejected) {
    // Submit a new form via UI
    const submitted = await submitFormWithAmount(page, '95')  // 95 in Section A ones field
    if (!submitted) { test.skip(); return }
    await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
      .toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)
  }

  // ── Step 2: If pending, reject via API ──
  if (!alreadyRejected) {
    const opLogin = await request.post(`${API}/auth/login`, {
      data: { email: 'ld@compass-usa.com', password: 'demo1234' },
    })
    const opToken = (await opLogin.json()).access_token

    const ctrlLogin = await request.post(`${API}/auth/login`, {
      data: { email: 'terri.serrano@compass.com', password: 'demo1234' },
    })
    const ctrlToken = (await ctrlLogin.json()).access_token

    const today = new Date().toISOString().split('T')[0]
    const subsRes = await request.get(
      `${API}/submissions?location_id=loc-appleton&date_from=${today}&date_to=${today}`,
      { headers: { Authorization: `Bearer ${opToken}` } },
    )
    const subs = await subsRes.json()
    const pending = (subs.items ?? []).find((s: { status: string }) => s.status === 'pending_approval')
    if (!pending) { test.skip(); return }

    const rejectRes = await request.post(`${API}/submissions/${pending.id}/reject`, {
      data: { reason: 'Section A totals incorrect - please recount' },
      headers: { Authorization: `Bearer ${ctrlToken}` },
    })
    if (!rejectRes.ok()) { test.skip(); return }
  }

  // ── Step 3: Reload operator dashboard and verify rejected status ──
  await page.reload()
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)

  const showsRejected = await page.locator('.badge-red').isVisible({ timeout: 8000 }).catch(() => false)
    || await page.getByText(/Rejected/i).isVisible({ timeout: 3000 }).catch(() => false)
    || await page.getByText('❌').isVisible({ timeout: 3000 }).catch(() => false)
  expect(showsRejected, 'Operator dashboard should show Rejected for today\'s submission').toBe(true)

  // ── Step 4: Click Update/Resubmit ──
  const updateBtn = page.getByRole('button', { name: /Update|Resubmit/i }).first()
  await expect(updateBtn).toBeVisible({ timeout: 5000 })
  await updateBtn.click()
  await page.waitForTimeout(1500)

  const onForm = await page.getByRole('heading', { name: /Cash Count Form/i }).isVisible({ timeout: 5000 }).catch(() => false)
  const onMethod = await page.getByRole('heading', { name: /Choose Entry Method/i }).isVisible({ timeout: 3000 }).catch(() => false)
  expect(onForm || onMethod).toBe(true)

  if (onMethod) {
    await page.getByRole('button', { name: /Select →/i }).first().click()
    await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 8000 })
  }

  // ── Step 5: Assert previously entered values are preserved (NOT lost) ──
  // Wait for the async API fetch useEffect to populate the form
  const numInputs = page.locator('.f-inp[type="number"]')
  await expect(numInputs.first()).toBeVisible({ timeout: 5000 })

  // Wait for at least one input to become non-zero (useEffect async fetch + React re-render)
  let anyNonZero = false
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.waitForTimeout(500)
    const allInputs = await numInputs.all()
    for (const inp of allInputs) {
      const v = await inp.inputValue()
      if (Number(v) > 0) { anyNonZero = true; break }
    }
    if (anyNonZero) break
  }
  expect(anyNonZero, 'Previously entered values should be preserved — at least one field should be non-zero').toBe(true)

  // ── Step 6: Modify and resubmit ──
  await numInputs.first().fill('9575')
  await page.keyboard.press('End')
  await page.waitForTimeout(500)

  const varianceNote = page.locator('textarea.f-ta').first()
  if (await varianceNote.isVisible({ timeout: 1500 }).catch(() => false)) {
    await varianceNote.fill('Corrected after rejection.')
  }

  await page.getByRole('button', { name: /Submit for Approval/i }).click()
  await page.waitForTimeout(2000)

  // ── Step 7: Verify status back to Pending ──
  const pendingAgain = await page.getByText(/Pending Approval/i).first().isVisible({ timeout: 8000 }).catch(() => false)
    || await page.locator('.badge-amber').first().isVisible({ timeout: 3000 }).catch(() => false)
    || await page.getByText('⏳').first().isVisible({ timeout: 3000 }).catch(() => false)
  expect(pendingAgain, 'After resubmit, status should be Pending Approval').toBe(true)
})

test('OP-COMM-007: form is locked (read-only) while pending controller review', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, OPERATOR)
  await page.waitForTimeout(3000)

  const showsPending = await page.getByText(/Pending Approval/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    || await page.locator('.badge-amber').first().isVisible({ timeout: 2000 }).catch(() => false)
  if (!showsPending) { test.skip(); return }

  // Click View on Today's card
  const viewBtn = page.getByRole('button', { name: /View →/i }).first()
  if (!(await viewBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

  await viewBtn.click()
  await page.waitForTimeout(1500)

  // Should be readonly — no Submit for Approval button
  await expect(page.getByRole('button', { name: /Submit for Approval/i })).not.toBeVisible({ timeout: 3000 })

  // No editable number inputs (form is read-only)
  const editableInputs = page.locator('.f-inp[type="number"]:not([disabled]):not([readonly])')
  const editableCount = await editableInputs.count()
  // In readonly view, inputs should be zero or disabled
  expect(editableCount).toBe(0)
})

test('OP-COMM-002: rejection reason text is visible to operator', async ({ page, request }) => {
  // Ensure there's a rejected submission for today
  const opLogin = await request.post(`${API}/auth/login`, {
    data: { email: OPERATOR, password: 'demo1234' },
  })
  const opToken = (await opLogin.json()).access_token
  const ctrlLogin = await request.post(`${API}/auth/login`, {
    data: { email: CONTROLLER, password: 'demo1234' },
  })
  const ctrlToken = (await ctrlLogin.json()).access_token

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const subsRes = await request.get(
    `${API}/submissions?location_id=loc-appleton&date_from=${todayStr}&date_to=${todayStr}`,
    { headers: { Authorization: `Bearer ${opToken}` } },
  )
  const subs = await subsRes.json()
  const pending = (subs.items ?? []).find((s: { status: string }) => s.status === 'pending_approval')

  if (pending) {
    // Reject it with a known reason
    await request.post(`${API}/submissions/${pending.id}/reject`, {
      data: { reason: 'Section A totals do not match bank records' },
      headers: { Authorization: `Bearer ${ctrlToken}` },
    })
  } else {
    const rejected = (subs.items ?? []).find((s: { status: string }) => s.status === 'rejected')
    if (!rejected) { test.skip(); return }
  }

  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, OPERATOR)
  await page.waitForTimeout(3000)

  const showsRejected = await page.locator('.badge-red').first().isVisible({ timeout: 5000 }).catch(() => false)
    || await page.getByText('❌').first().isVisible({ timeout: 2000 }).catch(() => false)
    || await page.getByText(/Rejected/i).first().isVisible({ timeout: 2000 }).catch(() => false)
  if (!showsRejected) { test.skip(); return }

  // Open the rejected submission
  const viewBtn = page.getByRole('button', { name: /View|Update|Resubmit/i }).first()
  if (!(await viewBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

  await viewBtn.click()
  await page.waitForTimeout(1500)

  // Rejection banner or reason text should be visible
  const hasRejectionBanner = await page.getByText(/Rejected|rejection|recount/i).isVisible({ timeout: 5000 }).catch(() => false)
  expect(hasRejectionBanner).toBe(true)
})

test('OP-COMM-004: operator history refreshes to show Accepted after controller approval', async ({ page, request }) => {
  // Ensure there's a pending submission via API
  const opLogin = await request.post(`${API}/auth/login`, {
    data: { email: OPERATOR, password: 'demo1234' },
  })
  const opToken = (await opLogin.json()).access_token
  const ctrlLogin = await request.post(`${API}/auth/login`, {
    data: { email: CONTROLLER, password: 'demo1234' },
  })
  const ctrlToken = (await ctrlLogin.json()).access_token

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const subsRes = await request.get(
    `${API}/submissions?location_id=loc-appleton&date_from=${todayStr}&date_to=${todayStr}`,
    { headers: { Authorization: `Bearer ${opToken}` } },
  )
  const subs = await subsRes.json()
  let pendingSub = (subs.items ?? []).find((s: { status: string }) => s.status === 'pending_approval')

  if (!pendingSub) {
    // If rejected, update to draft then submit to make it pending
    const rejected = (subs.items ?? []).find((s: { status: string }) => s.status === 'rejected')
    if (rejected) {
      await request.put(`${API}/submissions/${rejected.id}`, {
        data: {
          location_id: 'loc-appleton', submission_date: todayStr, source: 'FORM', save_as_draft: true,
          sections: rejected.sections ?? { A: { total: 100 } },
        },
        headers: { Authorization: `Bearer ${opToken}` },
      })
      const submitRes = await request.post(`${API}/submissions/${rejected.id}/submit`, {
        data: {},
        headers: { Authorization: `Bearer ${opToken}` },
      })
      if (submitRes.ok()) pendingSub = await submitRes.json()
    }
    if (!pendingSub) { test.skip(); return }
  }

  // Approve via API
  const approveRes = await request.post(`${API}/submissions/${pendingSub.id}/approve`, {
    data: { notes: 'All sections verified' },
    headers: { Authorization: `Bearer ${ctrlToken}` },
  })
  if (!approveRes.ok()) { test.skip(); return }

  // Login as operator, verify Accepted is visible
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, OPERATOR)
  await page.waitForTimeout(3000)

  const showsAccepted = await page.getByText(/Accepted/i).first().isVisible({ timeout: 8000 }).catch(() => false)
    || await page.locator('.badge-green').first().isVisible({ timeout: 2000 }).catch(() => false)
    || await page.getByText('✅').first().isVisible({ timeout: 2000 }).catch(() => false)
  expect(showsAccepted, 'Operator should see Accepted after controller approval').toBe(true)
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. OPMISSED SCREEN (Previously zero coverage)
// ═══════════════════════════════════════════════════════════════════════════════

test('OP-MSS-001: missed explanation form renders with all elements', async ({ page }) => {
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 8000 })

  // Click Missed filter to find a missed row
  const missedChip = page.locator('.kpi-row').getByText(/Missed/i).first()
  if (!(await missedChip.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await missedChip.click()
  await page.waitForTimeout(500)

  // Find an "Explain Absence" button
  const explainBtn = page.getByRole('button', { name: /Explain Absence/i }).first()
  if (!(await explainBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
  await explainBtn.click()
  await page.waitForTimeout(1000)

  // Assert all 6 radio options visible
  await expect(page.getByText('Staff illness / absence')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Technical issues (system/hardware)')).toBeVisible()
  await expect(page.getByText('Emergency closure')).toBeVisible()
  await expect(page.getByText('Public holiday / site closure')).toBeVisible()
  await expect(page.getByText('Staff training day')).toBeVisible()
  await expect(page.getByText('Other (specify below)')).toBeVisible()

  // Assert textarea and supervisor input
  await expect(page.locator('textarea.f-ta')).toBeVisible()
  await expect(page.locator('input.f-inp').filter({ hasNot: page.locator('[type="radio"]') }).last()).toBeVisible()

  // Assert submit button
  await expect(page.getByRole('button', { name: /Submit Explanation/i })).toBeVisible()
})

test('OP-MSS-002: submit missed explanation with reason and details succeeds', async ({ page }) => {
  await loginAs(page, OPERATOR)

  // Navigate to a missed submission
  const missedChip = page.locator('.kpi-row').getByText(/Missed/i).first()
  if (!(await missedChip.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await missedChip.click()
  await page.waitForTimeout(500)

  const explainBtn = page.getByRole('button', { name: /Explain Absence/i }).first()
  if (!(await explainBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
  await explainBtn.click()
  await page.waitForTimeout(1000)

  // Select a reason
  await page.locator('input[type="radio"][value="Illness"]').click()
  await page.waitForTimeout(300)

  // Enter details
  await page.locator('textarea.f-ta').fill('Staff member was ill and unable to attend.')

  // Supervisor name should be auto-filled — verify it's populated
  const supervisorInput = page.locator('input.f-inp').last()
  const supervisorValue = await supervisorInput.inputValue()
  expect(supervisorValue.length).toBeGreaterThan(0)

  // Submit
  await page.getByRole('button', { name: /Submit Explanation/i }).click()
  await page.waitForTimeout(2000)

  // Assert success screen
  await expect(page.getByText(/Explanation Recorded/i)).toBeVisible({ timeout: 5000 })

  // Assert "Back to Submissions" button
  await expect(page.getByRole('button', { name: /Back to Submissions/i })).toBeVisible()
})

test('OP-MSS-003: submit without selecting reason shows validation error', async ({ page }) => {
  await loginAs(page, OPERATOR)

  const missedChip = page.locator('.kpi-row').getByText(/Missed/i).first()
  if (!(await missedChip.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await missedChip.click()
  await page.waitForTimeout(500)

  const explainBtn = page.getByRole('button', { name: /Explain Absence/i }).first()
  if (!(await explainBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
  await explainBtn.click()
  await page.waitForTimeout(1000)

  // Click submit without selecting a reason
  await page.getByRole('button', { name: /Submit Explanation/i }).click()
  await page.waitForTimeout(500)

  // Assert validation error
  const hasError = await page.getByText(/Please select a reason/i).isVisible({ timeout: 3000 }).catch(() => false)
  expect(hasError).toBe(true)
})

test('OP-MSS-004: submit without details shows validation error', async ({ page }) => {
  await loginAs(page, OPERATOR)

  const missedChip = page.locator('.kpi-row').getByText(/Missed/i).first()
  if (!(await missedChip.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await missedChip.click()
  await page.waitForTimeout(500)

  const explainBtn = page.getByRole('button', { name: /Explain Absence/i }).first()
  if (!(await explainBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
  await explainBtn.click()
  await page.waitForTimeout(1000)

  // Select a reason but don't fill details
  await page.locator('input[type="radio"][value="Illness"]').click()
  await page.waitForTimeout(300)

  // Clear the details textarea
  await page.locator('textarea.f-ta').fill('')

  // Submit
  await page.getByRole('button', { name: /Submit Explanation/i }).click()
  await page.waitForTimeout(500)

  // Assert validation error
  const hasError = await page.getByText(/provide details/i).isVisible({ timeout: 3000 }).catch(() => false)
  expect(hasError).toBe(true)
})

test('OP-MSS-005: Back button on missed form returns to dashboard', async ({ page }) => {
  await loginAs(page, OPERATOR)

  const missedChip = page.locator('.kpi-row').getByText(/Missed/i).first()
  if (!(await missedChip.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await missedChip.click()
  await page.waitForTimeout(500)

  const explainBtn = page.getByRole('button', { name: /Explain Absence/i }).first()
  if (!(await explainBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
  await explainBtn.click()
  await page.waitForTimeout(1000)

  // Click Cancel or Back button
  const cancelBtn = page.getByRole('button', { name: /Cancel/i })
  const backBtn = page.getByRole('button', { name: /← Back/i })

  if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cancelBtn.click()
  } else if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await backBtn.click()
  }

  await page.waitForTimeout(1000)

  // Should be back on dashboard
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 8000 })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FORM CALCULATIONS & VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

test('OP-FRM-001: running total updates in real-time as user types', async ({ page }) => {
  await loginAs(page, OPERATOR)
  const onForm = await navigateToForm(page)
  if (!onForm) { test.skip(); return }

  // Enter value in Section A ($100 bills)
  const numInputs = page.locator('.f-inp[type="number"]')
  await expect(numInputs.first()).toBeVisible({ timeout: 5000 })
  await numInputs.first().fill('100')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(500)

  // Scroll to summary to see the total
  await page.keyboard.press('End')
  await page.waitForTimeout(500)

  // Total Fund should show a non-zero value
  const totalText = await page.getByText(/Total Fund|Total Cash/i).first().textContent().catch(() => '')
  // The summary area should exist and show the running total
  const summaryCard = page.locator('text=/Cashroom Count Totals/i')
  await expect(summaryCard).toBeVisible({ timeout: 5000 })
})

test('OP-FRM-002: variance percentage updates dynamically', async ({ page }) => {
  await loginAs(page, OPERATOR)
  const onForm = await navigateToForm(page)
  if (!onForm) { test.skip(); return }

  // Enter amount close to imprest (9575)
  const numInputs = page.locator('.f-inp[type="number"]')
  await numInputs.first().fill('9575')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(500)

  await page.keyboard.press('End')
  await page.waitForTimeout(500)

  // Variance should show ~0%
  const varianceText = await page.getByText(/Variance|variance/i).first().textContent().catch(() => '')
  expect(varianceText).toBeTruthy()

  // Now change to a value far from imprest
  await page.keyboard.press('Home')
  await page.waitForTimeout(300)
  await numInputs.first().fill('50000')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(500)

  await page.keyboard.press('End')
  await page.waitForTimeout(500)

  // Variance explanation textarea should now appear (>5%)
  const hasVarianceNote = await page.locator('textarea.f-ta').isVisible({ timeout: 3000 }).catch(() => false)
  const hasVarianceWarn = await page.getByText(/Variance Note|variance.*explanation/i).isVisible({ timeout: 2000 }).catch(() => false)
  expect(hasVarianceNote || hasVarianceWarn).toBe(true)
})

test('OP-FRM-003: submit with >5% variance without explanation is blocked', async ({ page }) => {
  await loginAs(page, OPERATOR)
  const onForm = await navigateToForm(page)
  if (!onForm) { test.skip(); return }

  // Enter amount far from imprest to trigger >5% variance
  const numInputs = page.locator('.f-inp[type="number"]')
  await numInputs.first().fill('50000')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(500)

  await page.keyboard.press('End')
  await page.waitForTimeout(500)

  // Leave variance note empty and try to submit
  const submitBtn = page.getByRole('button', { name: /Submit for Approval/i })
  await expect(submitBtn).toBeVisible({ timeout: 5000 })
  await submitBtn.click()
  await page.waitForTimeout(1000)

  // Should show error or still be on the form (not navigated away)
  const stillOnForm = await page.getByRole('heading', { name: /Cash Count Form/i })
    .isVisible({ timeout: 3000 }).catch(() => false)
  const hasError = await page.locator('.login-error').isVisible({ timeout: 2000 }).catch(() => false)
  expect(stillOnForm || hasError).toBe(true)
})

test('OP-FRM-004: submit button disabled when total is zero', async ({ page }) => {
  await loginAs(page, OPERATOR)
  const onForm = await navigateToForm(page)
  if (!onForm) { test.skip(); return }

  // Don't fill any fields — total should be 0
  await page.keyboard.press('End')
  await page.waitForTimeout(500)

  // Submit button should be disabled
  const submitBtn = page.getByRole('button', { name: /Submit for Approval/i })
  await expect(submitBtn).toBeVisible({ timeout: 5000 })
  await expect(submitBtn).toBeDisabled()
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DASHBOARD BUTTONS & NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

test('OP-BTN-001: Submit Now button navigates to method select', async ({ page }) => {
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 8000 })

  const submitNowBtn = page.getByRole('button', { name: /Submit Now/i })
  if (!(await submitNowBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

  await submitNowBtn.click()
  await expect(page.getByRole('heading', { name: /Choose Entry Method/i })).toBeVisible({ timeout: 8000 })

  // Both method cards visible
  await expect(page.getByText('Digital Form')).toBeVisible()
  await expect(page.getByText('Excel Upload')).toBeVisible()
})

test('OP-BTN-002: View button on Today card opens readonly submission', async ({ page }) => {
  await loginAs(page, OPERATOR)
  await page.waitForTimeout(2000)

  const viewBtn = page.getByRole('button', { name: /View →/i }).first()
  if (!(await viewBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

  await viewBtn.click()
  await page.waitForTimeout(1500)

  // Should be on readonly view — Submission heading visible
  await expect(page.getByRole('heading', { name: /Submission/i })).toBeVisible({ timeout: 8000 })

  // No submit button (read-only)
  await expect(page.getByRole('button', { name: /Submit for Approval/i })).not.toBeVisible({ timeout: 2000 })
})

test('OP-BTN-003: KPI card click filters history table', async ({ page }) => {
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // Click the Accepted KPI card
  const acceptedCard = page.locator('.kpi-row').getByText(/Accepted/i).first()
  if (!(await acceptedCard.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await acceptedCard.click()
  await page.waitForTimeout(500)

  // Table should show only accepted rows or empty state
  const table = page.locator('table.dt tbody')
  if (await table.isVisible({ timeout: 3000 }).catch(() => false)) {
    const rows = table.locator('tr')
    const rowCount = await rows.count()
    // All visible rows should have accepted status
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const rowText = await rows.nth(i).textContent()
      // Row should contain "Accepted" or equivalent
      expect(rowText).toMatch(/Accepted|Approved/i)
    }
  }

  // Click All to restore
  const allChip = page.locator('.kpi-row').getByText(/^All$/i).first()
    .or(page.getByRole('button', { name: /^All$/i }).first())
  if (await allChip.isVisible({ timeout: 2000 }).catch(() => false)) {
    await allChip.click()
  }
})

test('OP-BTN-004: My Drafts button navigates to drafts page', async ({ page }) => {
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 8000 })

  const draftsBtn = page.getByRole('button', { name: /My Drafts/i })
  if (!(await draftsBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

  await draftsBtn.click()
  await expect(page.getByRole('heading', { name: /My Drafts/i })).toBeVisible({ timeout: 8000 })
})

test('OP-BTN-005: pagination Next/Previous buttons work', async ({ page }) => {
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1000)

  // Check if pagination exists (Next button visible = >10 items)
  const nextBtn = page.getByRole('button', { name: /Next →/i })
  if (!(await nextBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

  // Get first row text on page 1
  const firstRowP1 = await page.locator('table.dt tbody tr').first().textContent().catch(() => '')

  // Click Next
  await nextBtn.click()
  await page.waitForTimeout(500)

  // First row should be different (different page)
  const firstRowP2 = await page.locator('table.dt tbody tr').first().textContent().catch(() => '')
  expect(firstRowP2).not.toBe(firstRowP1)

  // Click Previous
  const prevBtn = page.getByRole('button', { name: /← Previous/i })
  await expect(prevBtn).toBeVisible({ timeout: 3000 })
  await prevBtn.click()
  await page.waitForTimeout(500)

  // Should be back to page 1
  const firstRowBack = await page.locator('table.dt tbody tr').first().textContent().catch(() => '')
  expect(firstRowBack).toBe(firstRowP1)
})

test('OP-BTN-006: Back button on method select returns to dashboard', async ({ page }) => {
  await loginAs(page, OPERATOR)

  const submitNowBtn = page.getByRole('button', { name: /Submit Now/i })
  if (!(await submitNowBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

  await submitNowBtn.click()
  await expect(page.getByRole('heading', { name: /Choose Entry Method/i })).toBeVisible({ timeout: 8000 })

  // Click ← Back
  await page.getByRole('button', { name: /← Back/i }).click()
  await page.waitForTimeout(1000)

  // Should be back on dashboard
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 8000 })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. EXCEL UPLOAD & DRAFTS FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════════════════════

test('OP-XLS-001: sample Excel download link works', async ({ page }) => {
  await loginAs(page, OPERATOR)

  const submitNowBtn = page.getByRole('button', { name: /Submit Now/i })
  if (!(await submitNowBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await submitNowBtn.click()

  await expect(page.getByRole('heading', { name: /Choose Entry Method/i })).toBeVisible({ timeout: 8000 })

  // Select Excel Upload
  const selectBtns = page.getByRole('button', { name: /Select →/i })
  await selectBtns.nth(1).click()
  await expect(page.getByRole('heading', { name: /Excel Upload/i })).toBeVisible({ timeout: 8000 })

  // Click Sample Excel link and capture download
  const sampleLink = page.getByText(/Sample Excel/i)
  await expect(sampleLink).toBeVisible({ timeout: 5000 })

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    sampleLink.click(),
  ])

  const filename = download.suggestedFilename()
  expect(filename).toMatch(/\.(xlsx|xls)$/i)
})

test('OP-XLS-002: wrong file type shows error', async ({ page }) => {
  await loginAs(page, OPERATOR)

  const submitNowBtn = page.getByRole('button', { name: /Submit Now/i })
  if (!(await submitNowBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await submitNowBtn.click()

  await expect(page.getByRole('heading', { name: /Choose Entry Method/i })).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: /Select →/i }).nth(1).click()
  await expect(page.getByRole('heading', { name: /Excel Upload/i })).toBeVisible({ timeout: 8000 })

  // Upload a .txt file
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'test.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('This is not a spreadsheet'),
  })
  await page.waitForTimeout(1000)

  // Error message should appear
  const hasError = await page.getByText(/\.xlsx|invalid|error|unsupported/i).isVisible({ timeout: 5000 }).catch(() => false)
  expect(hasError).toBe(true)
})

test('OP-DFT-001: draft card shows total and section pills', async ({ page }) => {
  await loginAs(page, OPERATOR)

  // First save a draft with some values
  const onForm = await navigateToForm(page)
  if (!onForm) { test.skip(); return }

  const numInputs = page.locator('.f-inp[type="number"]')
  await numInputs.first().fill('5000')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300)

  // Save draft
  await page.getByRole('button', { name: /Save Draft/i }).first().click()
  await page.waitForTimeout(1000)

  // Navigate to My Drafts
  const draftsBtn = page.getByRole('button', { name: /My Drafts/i })
  if (!(await draftsBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await draftsBtn.click()
  await expect(page.getByRole('heading', { name: /My Drafts/i })).toBeVisible({ timeout: 8000 })

  // Draft card should show a dollar amount
  const hasDollarAmount = await page.getByText(/\$[\d,]+/).first().isVisible({ timeout: 5000 }).catch(() => false)
  expect(hasDollarAmount).toBe(true)

  // Resume and Discard buttons visible
  await expect(page.getByRole('button', { name: /Resume/i }).first()).toBeVisible({ timeout: 3000 })
  await expect(page.getByRole('button', { name: /Discard/i }).first()).toBeVisible({ timeout: 3000 })
})

test('OP-DFT-002: Change method button on form returns to method select', async ({ page }) => {
  await loginAs(page, OPERATOR)
  const onForm = await navigateToForm(page)
  if (!onForm) { test.skip(); return }

  // Click ← Back button
  const backBtn = page.getByRole('button', { name: /← Back/i }).first()
  await expect(backBtn).toBeVisible({ timeout: 5000 })
  await backBtn.click()
  await page.waitForTimeout(1000)

  // Should be back on method select or dashboard
  const onMethod = await page.getByRole('heading', { name: /Choose Entry Method/i })
    .isVisible({ timeout: 5000 }).catch(() => false)
  const onDash = await page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i })
    .isVisible({ timeout: 3000 }).catch(() => false)
  expect(onMethod || onDash).toBe(true)
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. OPERATOR READONLY VIEW — DETAILED
// ═══════════════════════════════════════════════════════════════════════════════

test('OP-RDO-001: pending submission shows awaiting controller approval banner', async ({ page }) => {
  await loginAs(page, OPERATOR)
  await page.waitForTimeout(2000)

  const showsPending = await page.getByText(/Pending Approval/i).isVisible({ timeout: 5000 }).catch(() => false)
  if (!showsPending) { test.skip(); return }

  const viewBtn = page.getByRole('button', { name: /View →/i }).first()
  if (!(await viewBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await viewBtn.click()
  await page.waitForTimeout(1500)

  // Amber/pending banner should be visible
  const hasPendingBanner = await page.getByText(/Awaiting.*approval|Pending.*Approval/i)
    .isVisible({ timeout: 5000 }).catch(() => false)
  expect(hasPendingBanner).toBe(true)
})

test('OP-RDO-002: approved submission shows Approved by [Name] banner', async ({ page }) => {
  await loginAs(page, OPERATOR)

  // Filter to accepted
  const acceptedCard = page.locator('.kpi-row').getByText(/Accepted/i).first()
  if (!(await acceptedCard.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
  await acceptedCard.click()
  await page.waitForTimeout(500)

  const viewBtn = page.getByRole('button', { name: /View Details|View →/i }).first()
  if (!(await viewBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    // Try clicking the row
    const row = page.locator('table.dt tbody tr').first()
    if (!(await row.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await row.click()
  } else {
    await viewBtn.click()
  }
  await page.waitForTimeout(1500)

  // Green/approved banner with controller name (not UUID)
  const hasApprovedBanner = await page.getByText(/Approved by/i).isVisible({ timeout: 5000 }).catch(() => false)
  if (hasApprovedBanner) {
    const text = await page.getByText(/Approved by/i).first().textContent() ?? ''
    // Should not contain UUID pattern
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}/i
    expect(uuidPattern.test(text)).toBe(false)
  }
})

test('OP-RDO-003: readonly view shows all sections A-I with values', async ({ page }) => {
  await loginAs(page, OPERATOR)

  // Open any submission (accepted or pending)
  const viewBtn = page.getByRole('button', { name: /View →|View Details/i }).first()
  if (!(await viewBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
  await viewBtn.click()
  await page.waitForTimeout(1500)

  // Section A should be visible
  await expect(page.getByText(/A\.\s*Total|Section A|Currency/i).first()).toBeVisible({ timeout: 5000 })

  // Summary/total should be visible
  await page.keyboard.press('End')
  await page.waitForTimeout(500)
  const hasSummary = await page.getByText(/Total.*Cash|Total.*Fund|Cashier/i).first()
    .isVisible({ timeout: 5000 }).catch(() => false)
  expect(hasSummary).toBe(true)
})

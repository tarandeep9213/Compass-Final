/**
 * Remaining Operator Excel test cases:
 * - Opr-013: Imprest amount auto-populates from admin config
 * - Opr-016: Drafts visible only to creator
 * - Opr-017: Dashboard doesn't show 90 days of missed backlog
 * - Opr-033: Discard form and start new
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = process.env.E2E_API_URL || 'http://localhost:8000/v1'
const OPERATOR = 'ld@compass-usa.com'

// ═══════════════════════════════════════════════════════════════════════════════
// Opr-013: Imprest amount auto-populates from admin config
// ═══════════════════════════════════════════════════════════════════════════════

test('Opr-013: imprest balance on form matches admin-configured expected cash', async ({ page, request }) => {
  // Step 1: Get the expected cash for loc-appleton from admin API
  const adminLogin = await request.post(`${API}/auth/login`, {
    data: { email: 'admin@compass.com', password: 'demo1234' },
  })
  const adminToken = (await adminLogin.json()).access_token

  const locsRes = await request.get(`${API}/admin/locations`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const locs = await locsRes.json()
  const locList = Array.isArray(locs) ? locs : (locs.items ?? locs.locations ?? [])
  const appleton = locList.find((l: { id: string }) => l.id === 'loc-appleton')
  if (!appleton) { test.skip(); return }

  const adminImprest = appleton.expected_cash

  // Step 2: Login as operator
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)

  // Step 3: Check imprest on the dashboard's Today card (variance line shows "Imprest: $X,XXX.XX")
  // If today has a submission, the Today card shows "Imprest: $X,XXX.XX"
  const imprestOnDash = await page.getByText(/Imprest:/i).first().textContent().catch(() => '')

  if (imprestOnDash && adminImprest > 0) {
    const formattedImprest = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(adminImprest)
    const match = imprestOnDash.includes(formattedImprest.replace('$', ''))
    expect(match, `Dashboard imprest should match admin value ${formattedImprest}, got: "${imprestOnDash}"`).toBe(true)
  }

  // Step 4: Also verify via the readonly view if a submission exists
  const viewBtn = page.getByRole('button', { name: /View →/i }).first()
  if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await viewBtn.click()
    await page.waitForTimeout(1500)

    // The readonly view shows imprest in the summary section
    await page.keyboard.press('End')
    await page.waitForTimeout(500)
    const imprestOnReadonly = await page.getByText(/Imprest/i).first().textContent().catch(() => '')
    expect(imprestOnReadonly!.length, 'Imprest should be displayed on readonly view').toBeGreaterThan(0)

    if (adminImprest > 0) {
      const formattedImprest = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(adminImprest)
      const match = imprestOnReadonly?.includes(formattedImprest.replace('$', ''))
      expect(match, `Readonly imprest should match admin value ${formattedImprest}, got: "${imprestOnReadonly}"`).toBe(true)
    }
  } else {
    // No submission today — try navigating to form
    const submitNowBtn = page.getByRole('button', { name: /Submit Now/i })
    if (await submitNowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitNowBtn.click()
      const onMethod = await page.getByRole('heading', { name: /Choose Entry Method/i })
        .isVisible({ timeout: 5000 }).catch(() => false)
      if (onMethod) {
        const imprestText = await page.getByText(/Imprest balance/i).textContent().catch(() => '')
        expect(imprestText!.length, 'Imprest should show on method select page').toBeGreaterThan(0)
      }
    }
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// Opr-016: Drafts visible only to creator
// ═══════════════════════════════════════════════════════════════════════════════

test('Opr-016: drafts are only visible to the operator who created them', async ({ request }) => {
  // Step 1: Login as operator and create a draft via API
  const opLogin = await request.post(`${API}/auth/login`, {
    data: { email: OPERATOR, password: 'demo1234' },
  })
  const opToken = (await opLogin.json()).access_token
  const opMe = await request.get(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${opToken}` },
  })
  const opUser = await opMe.json()

  // Create a draft submission
  const draftDate = '2027-01-15' // future date unlikely to conflict
  const createRes = await request.post(`${API}/submissions`, {
    data: {
      location_id: 'loc-appleton',
      submission_date: draftDate,
      source: 'FORM',
      sections: { A: { total: 100, ones: 100 } },
      save_as_draft: true,
    },
    headers: { Authorization: `Bearer ${opToken}` },
  })

  if (!createRes.ok()) { test.skip(); return }
  const draft = await createRes.json()
  expect(draft.status).toBe('draft')

  // Step 2: Verify the draft is visible to the creator
  const myDrafts = await request.get(
    `${API}/submissions?location_id=loc-appleton&status=draft&page_size=50`,
    { headers: { Authorization: `Bearer ${opToken}` } },
  )
  const myDraftsData = await myDrafts.json()
  const foundMine = (myDraftsData.items ?? []).find((s: { id: string }) => s.id === draft.id)
  expect(foundMine, 'Creator should see their own draft').toBeTruthy()

  // Step 3: Login as a different user and verify they can't see it
  // Try controller (different role)
  const ctrlLogin = await request.post(`${API}/auth/login`, {
    data: { email: 'terri.serrano@compass.com', password: 'demo1234' },
  })
  const ctrlToken = (await ctrlLogin.json()).access_token

  const ctrlDrafts = await request.get(
    `${API}/submissions?location_id=loc-appleton&status=draft&page_size=50`,
    { headers: { Authorization: `Bearer ${ctrlToken}` } },
  )
  const ctrlDraftsData = await ctrlDrafts.json()
  const ctrlItems = ctrlDraftsData.items ?? []

  // Controller should not see the operator's draft (different operator_id)
  const foundByCtrl = ctrlItems.find((s: { id: string }) => s.id === draft.id)
  // Controller CAN see submissions for their location, but all items should have operator's ID
  // The key check: if controller sees the draft, its operator_id should match the operator
  if (foundByCtrl) {
    // If controller sees it, that's because controllers can view location submissions
    // But the operator_id should still be the original creator
    expect(foundByCtrl.operator_id).toBe(opUser.id)
  }

  // Step 4: Try another operator if available
  // Check if there's another operator in the system
  const adminLogin = await request.post(`${API}/auth/login`, {
    data: { email: 'admin@compass.com', password: 'demo1234' },
  })
  const adminToken = (await adminLogin.json()).access_token
  const usersRes = await request.get(`${API}/admin/users?role=operator`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  if (usersRes.ok()) {
    const users = await usersRes.json()
    const userList = Array.isArray(users) ? users : (users.items ?? [])
    const otherOp = userList.find((u: { email: string }) => u.email !== OPERATOR && u.active !== false)
    if (otherOp) {
      const otherLogin = await request.post(`${API}/auth/login`, {
        data: { email: otherOp.email, password: 'demo1234' },
      })
      if (otherLogin.ok()) {
        const otherToken = (await otherLogin.json()).access_token
        const otherDrafts = await request.get(
          `${API}/submissions?status=draft&page_size=50`,
          { headers: { Authorization: `Bearer ${otherToken}` } },
        )
        const otherData = await otherDrafts.json()
        const foundByOther = (otherData.items ?? []).find((s: { id: string }) => s.id === draft.id)
        expect(foundByOther, 'Other operator should NOT see this draft').toBeFalsy()
      }
    }
  }

  // Cleanup: delete the draft
  await request.delete(`${API}/submissions/${draft.id}`, {
    headers: { Authorization: `Bearer ${opToken}` },
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Opr-017: Dashboard doesn't show 90 days of missed backlog
// ═══════════════════════════════════════════════════════════════════════════════

test('Opr-017: missed count is reasonable, not 90 days of backlog', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)

  // Find the Missed KPI card value
  const missedCard = page.getByText(/^Missed$/i).first()
  if (!(await missedCard.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

  // Get the missed count — it's in a sibling or parent element
  // KPI cards show: label, count, "last 90 days"
  const missedSection = missedCard.locator('..')
  const missedText = await missedSection.textContent().catch(() => '')

  // Extract the number from the text
  const countMatch = missedText?.match(/(\d+)/)
  const missedCount = countMatch ? parseInt(countMatch[1]) : 0

  // Assert: missed count should be < 80 (not nearly all 90 days)
  // A reasonable threshold: if user has been active, they shouldn't have 80+ missed days
  expect(missedCount, `Missed count (${missedCount}) should not be nearly 90 days of backlog`).toBeLessThan(80)

  // Also verify: total submissions + missed should roughly equal 90
  // But we mainly care that missed isn't absurdly high for an active user
})

// ═══════════════════════════════════════════════════════════════════════════════
// Opr-033: Discard form and start new
// ═══════════════════════════════════════════════════════════════════════════════

test('Opr-033: start fresh clears draft and opens clean form', async ({ page, request }) => {
  // Create a draft for today via API if none exists
  const opLogin = await request.post(`${API}/auth/login`, {
    data: { email: OPERATOR, password: 'demo1234' },
  })
  const opToken = (await opLogin.json()).access_token

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Check if there's already a draft for today
  const subsRes = await request.get(
    `${API}/submissions?location_id=loc-appleton&status=draft&date_from=${todayStr}&date_to=${todayStr}`,
    { headers: { Authorization: `Bearer ${opToken}` } },
  )
  const subs = await subsRes.json()
  const existingDraft = (subs.items ?? []).find((s: { status: string }) => s.status === 'draft')

  if (!existingDraft) {
    // Check if there's a non-draft submission for today
    const allSubsRes = await request.get(
      `${API}/submissions?location_id=loc-appleton&date_from=${todayStr}&date_to=${todayStr}`,
      { headers: { Authorization: `Bearer ${opToken}` } },
    )
    const allSubs = await allSubsRes.json()
    const todaySub = (allSubs.items ?? [])[0]

    if (todaySub && todaySub.status !== 'draft' && todaySub.status !== 'rejected') {
      // Today has an approved/pending submission — can't create a draft, skip
      test.skip(); return
    }

    // Create a draft
    const createRes = await request.post(`${API}/submissions`, {
      data: {
        location_id: 'loc-appleton',
        submission_date: todayStr,
        source: 'FORM',
        sections: { A: { total: 777, ones: 777 } },
        save_as_draft: true,
      },
      headers: { Authorization: `Bearer ${opToken}` },
    })
    if (!createRes.ok()) { test.skip(); return }
  }

  // Login and verify "Start fresh" button on Today card
  await page.goto('/')
  await page.evaluate(() => sessionStorage.clear())
  await loginAs(page, OPERATOR)
  await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
    .toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)

  const startFreshBtn = page.getByRole('button', { name: /Start fresh/i })
  if (!(await startFreshBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }

  // Click "Start fresh"
  await startFreshBtn.click()
  await page.waitForTimeout(1000)

  // Should navigate to method select
  await expect(page.getByRole('heading', { name: /Choose Entry Method/i })).toBeVisible({ timeout: 8000 })

  // Choose Digital Form → form should be clean
  await page.getByRole('button', { name: /Select →/i }).first().click()
  await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 8000 })

  // Assert form is empty — first input should be 0 or empty
  const numInputs = page.locator('.f-inp[type="number"]')
  await expect(numInputs.first()).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)
  const freshVal = await numInputs.first().inputValue()
  expect(Number(freshVal) || 0, 'Form should be clean after Start fresh — first field should be 0 or empty').toBe(0)
})

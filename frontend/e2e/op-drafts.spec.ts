/**
 * E2E tests for operator drafts workflow (DRAFT-001 to DRAFT-004)
 * Covers: save draft, drafts list, discard draft, resume draft, dashboard badge
 *
 * Uses a far-future test date (2027-06-15) to avoid collisions with real data.
 * beforeEach cleans up via API so tests are idempotent across runs.
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { loginAs } from './helpers/auth'

const TEST_DATE = '2027-06-15'
const OPERATOR_EMAIL = 'operator@compass.com'
const API_BASE = 'http://localhost:8000/v1'

/** Clean up any drafts for TEST_DATE via the API before each test. */
async function cleanupDrafts(request: APIRequestContext) {
  // Login
  const loginResp = await request.post(`${API_BASE}/auth/login`, {
    data: { email: OPERATOR_EMAIL, password: 'demo1234' },
  })
  if (!loginResp.ok()) return
  const { access_token } = await loginResp.json()

  // List all drafts
  const listResp = await request.get(`${API_BASE}/submissions?status=draft&page_size=100`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!listResp.ok()) return
  const { items } = await listResp.json()

  // Delete any that match TEST_DATE
  for (const item of items) {
    if (item.submission_date === TEST_DATE) {
      await request.delete(`${API_BASE}/submissions/${item.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      })
    }
  }
}

/** Navigate to the Cash Count Form for a specific (future, no-draft) date. */
async function navigateToFormForDate(page: Page, dateStr: string) {
  // Wait for the dashboard date jump input to be ready
  await page.locator('input[type="date"]').waitFor({ state: 'visible', timeout: 8000 })
  await page.fill('input[type="date"]', dateStr)
  await page.getByRole('button', { name: /Go →/i }).click()
  await page.waitForTimeout(1200)

  // Should land on method select (future date with no submission)
  const onMethodSelect = await page
    .getByRole('heading', { name: /Choose Entry Method/i })
    .isVisible({ timeout: 6000 })
    .catch(() => false)

  if (onMethodSelect) {
    // Click the first "Select →" button (Digital Form)
    await page.getByRole('button', { name: /Select →/i }).first().click()
  }

  await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 10000 })
}

// ── DRAFT-001: Save draft then verify it appears in My Drafts ─────────────────
test('DRAFT-001: saving a draft makes it appear in My Drafts list', async ({ page, request }) => {
  await cleanupDrafts(request)
  await loginAs(page, OPERATOR_EMAIL)

  // Navigate to form for test date
  await navigateToFormForDate(page, TEST_DATE)

  // Fill in the first numeric input with a value
  const firstInput = page.locator('.f-inp[type="number"]').first()
  await expect(firstInput).toBeVisible({ timeout: 5000 })
  await firstInput.fill('100')

  // Click "Save Draft"
  await page.getByRole('button', { name: /Save Draft/i }).first().click()
  await page.waitForTimeout(1200)

  // Should navigate back to operator dashboard
  await expect(page.getByRole('heading', { name: /Good/i })).toBeVisible({ timeout: 8000 })

  // Navigate to My Drafts — button appears in header when drafts exist
  const myDraftsBtn = page.getByRole('button', { name: /My Drafts/i })
  await expect(myDraftsBtn).toBeVisible({ timeout: 5000 })
  await myDraftsBtn.click()

  // Verify draft page heading and at least one draft card
  await expect(page.getByRole('heading', { name: /My Drafts/i })).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /Resume/i }).first()).toBeVisible({ timeout: 5000 })
})

// ── DRAFT-002: Draft count badge shown on dashboard ───────────────────────────
test('DRAFT-002: My Drafts button shows badge count when drafts exist', async ({ page, request }) => {
  await cleanupDrafts(request)
  await loginAs(page, OPERATOR_EMAIL)

  // Create a fresh draft
  await navigateToFormForDate(page, TEST_DATE)
  const firstInput = page.locator('.f-inp[type="number"]').first()
  await expect(firstInput).toBeVisible({ timeout: 5000 })
  await firstInput.fill('200')
  await page.getByRole('button', { name: /Save Draft/i }).first().click()
  await page.waitForTimeout(1200)

  // My Drafts button with badge count must be visible
  const myDraftsBtn = page.getByRole('button', { name: /My Drafts/i })
  await expect(myDraftsBtn).toBeVisible({ timeout: 5000 })

  // Badge inside the button should have a number
  const badge = myDraftsBtn.locator('span').last()
  const badgeText = await badge.innerText()
  expect(parseInt(badgeText, 10)).toBeGreaterThan(0)
})

// ── DRAFT-003: Discard a draft removes it from My Drafts ──────────────────────
test('DRAFT-003: discarding a draft removes it from My Drafts list', async ({ page, request }) => {
  await cleanupDrafts(request)
  await loginAs(page, OPERATOR_EMAIL)

  // Create a fresh draft to discard
  await navigateToFormForDate(page, TEST_DATE)
  const firstInput = page.locator('.f-inp[type="number"]').first()
  await expect(firstInput).toBeVisible({ timeout: 5000 })
  await firstInput.fill('300')
  await page.getByRole('button', { name: /Save Draft/i }).first().click()
  await page.waitForTimeout(1200)

  // Go to My Drafts
  await page.getByRole('button', { name: /My Drafts/i }).click()
  await expect(page.getByRole('heading', { name: /My Drafts/i })).toBeVisible({ timeout: 5000 })

  // Count drafts before discard
  const resumeBtns = page.getByRole('button', { name: /Resume/i })
  const countBefore = await resumeBtns.count()
  expect(countBefore).toBeGreaterThan(0)

  // Click Discard on the first draft — accept the confirmation dialog
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: /Discard/i }).first().click()

  // Wait for either draft count to decrease or "No drafts" message
  let success = false
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(500)
    const noDraftsVisible = await page.getByText(/No drafts/i).isVisible({ timeout: 500 }).catch(() => false)
    const countAfter = await page.getByRole('button', { name: /Resume/i }).count()
    if (noDraftsVisible || countAfter < countBefore) {
      success = true
      break
    }
  }

  expect(success, 'Draft should be removed after discard').toBe(true)
})

// ── DRAFT-004: Resume draft opens form pre-populated ─────────────────────────
test('DRAFT-004: resuming a draft opens the Cash Count Form', async ({ page, request }) => {
  await cleanupDrafts(request)
  await loginAs(page, OPERATOR_EMAIL)

  // Create a fresh draft
  await navigateToFormForDate(page, TEST_DATE)
  const firstInput = page.locator('.f-inp[type="number"]').first()
  await expect(firstInput).toBeVisible({ timeout: 5000 })
  await firstInput.fill('500')
  await page.getByRole('button', { name: /Save Draft/i }).first().click()
  await page.waitForTimeout(1200)

  // Go to My Drafts
  const myDraftsBtn = page.getByRole('button', { name: /My Drafts/i })
  await expect(myDraftsBtn).toBeVisible({ timeout: 5000 })
  await myDraftsBtn.click()

  // Click Resume
  await expect(page.getByRole('button', { name: /Resume/i }).first()).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /Resume/i }).first().click()

  // Should navigate to the Cash Count Form
  await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 10000 })

  // The "Save Draft" button should be present (we're in draft mode)
  await expect(page.getByRole('button', { name: /Save Draft/i }).first()).toBeVisible({ timeout: 3000 })
})

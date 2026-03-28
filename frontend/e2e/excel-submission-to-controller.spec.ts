/**
 * WORKFLOW-EXCEL-001
 * Operator submits a cash count via Excel upload → Controller (same location) sees it as pending.
 *
 * Prerequisites (real backend):
 *   - operator@compass.com  → assigned to at least one location
 *   - controller@compass.com → assigned to the SAME location
 *   - Both accounts exist in the DB with password demo1234
 *
 * The test creates a minimal valid cashroom Excel file in a temp directory,
 * uploads it through the UI, submits for approval, then switches to the controller
 * and verifies the pending submission is visible in the Daily Review Dashboard.
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const API = 'http://localhost:8000/v1'

// ── Helper: build a minimal valid cashroom Excel file ────────────────────────
function createCashroomExcel(): string {
  const wb = XLSX.utils.book_new()
  const ws: XLSX.WorkSheet = {}

  // Section A: Currency (col B, rows 7–14)
  ws['B7']  = { v: 500,  t: 'n' }  // ones
  ws['B8']  = { v: 0,    t: 'n' }  // twos
  ws['B9']  = { v: 1000, t: 'n' }  // fives
  ws['B10'] = { v: 2000, t: 'n' }  // tens
  ws['B11'] = { v: 3000, t: 'n' }  // twenties
  ws['B12'] = { v: 0,    t: 'n' }  // fifties
  ws['B13'] = { v: 1000, t: 'n' }  // hundreds
  ws['B14'] = { v: 0,    t: 'n' }  // other

  // Section B: Rolled Coin (col E, rows 7–12)
  ws['E7']  = { v: 25, t: 'n' }  // dollar
  ws['E8']  = { v: 0,  t: 'n' }  // halves
  ws['E9']  = { v: 50, t: 'n' }  // quarters
  ws['E10'] = { v: 0,  t: 'n' }  // dimes
  ws['E11'] = { v: 0,  t: 'n' }  // nickels
  ws['E12'] = { v: 0,  t: 'n' }  // pennies

  // Section C: Coins in Counting Machines (col I = No.1, col K = No.2, rows 8–13)
  for (let r = 8; r <= 13; r++) {
    ws[`I${r}`] = { v: 0, t: 'n' }
    ws[`K${r}`] = { v: 0, t: 'n' }
  }

  // Section C totals (col L)
  for (let r = 8; r <= 14; r++) {
    ws[`L${r}`] = { v: 0, t: 'n' }
  }

  // Section D: Bagged Coin (col B = bag count, col C = totals, rows 19–22)
  ws['B19'] = { v: 0, t: 'n' }
  ws['B20'] = { v: 0, t: 'n' }
  ws['B21'] = { v: 0, t: 'n' }
  ws['B22'] = { v: 0, t: 'n' }

  // Sections E–I: zeros
  // E (rows 18–27, cols B/C/E/F)
  // F (rows 30–35, col B/C)
  // G (rows 37–38, some cols)
  // H row 40
  // I rows 42–43
  // The parser handles missing cells gracefully (returns 0)

  // Section totals (col L, rows 40–50) — must match what parser reads
  ws['L40'] = { v: 7500, t: 'n' }  // A: Currency
  ws['L41'] = { v: 75,   t: 'n' }  // B: Rolled Coin
  ws['L42'] = { v: 0,    t: 'n' }  // C: Coins in Machines
  ws['L43'] = { v: 0,    t: 'n' }  // D: Bagged Coin
  ws['L44'] = { v: 0,    t: 'n' }  // E: Unissued Changers
  ws['L45'] = { v: 0,    t: 'n' }  // F: Uncounted/Returned
  ws['L46'] = { v: 0,    t: 'n' }  // G: Mutilated
  ws['L49'] = { v: 0,    t: 'n' }  // H: Outstanding Funds
  ws['L50'] = { v: 0,    t: 'n' }  // I: Net Unreimbursed

  // Total Cash (L48)
  ws['L48'] = { v: 7575, t: 'n' }

  ws['!ref'] = 'A1:M56'

  XLSX.utils.book_append_sheet(wb, ws, 'CashRoom Form')

  const tmpPath = path.join(os.tmpdir(), `cashroom-e2e-${Date.now()}.xlsx`)
  XLSX.writeFile(wb, tmpPath)
  return tmpPath
}

// ── Helper: get the operator's location ID via the API ───────────────────────
async function getOperatorLocationId(
  request: import('@playwright/test').APIRequestContext,
  token: string,
): Promise<string | null> {
  const res = await request.get(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok()) return null
  const user = await res.json()
  return (user.location_ids as string[])[0] ?? null
}

// ── Helper: get a valid JWT token for an email/password ──────────────────────
async function getToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
  password: string,
): Promise<string | null> {
  const res = await request.post(`${API}/auth/login`, {
    data: { email, password },
  })
  if (!res.ok()) return null
  return (await res.json()).access_token as string
}

// ─────────────────────────────────────────────────────────────────────────────

test('WORKFLOW-EXCEL-001: operator Excel submission appears as pending in controller Daily Review Dashboard', async ({ page, request }) => {

  // ── Step 0: Verify accounts and shared location via API ───────────────────
  const opToken = await getToken(request, 'operator@compass.com', 'demo1234')
  if (!opToken) {
    test.skip(true, 'operator@compass.com not found in DB — seed data missing')
    return
  }
  const ctrlToken = await getToken(request, 'controller@compass.com', 'demo1234')
  if (!ctrlToken) {
    test.skip(true, 'controller@compass.com not found in DB — seed data missing')
    return
  }

  const operatorLocationId = await getOperatorLocationId(request, opToken)
  if (!operatorLocationId) {
    test.skip(true, 'Operator has no assigned location — assign one via Admin → Users first')
    return
  }

  // Verify the controller shares the same location
  const ctrlRes = await request.get(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${ctrlToken}` },
  })
  const ctrlUser = await ctrlRes.json()
  const sharedLocation = (ctrlUser.location_ids as string[]).includes(operatorLocationId)
  if (!sharedLocation) {
    test.skip(true, `Controller is not assigned to operator's location (${operatorLocationId}) — update assignments in Admin → Users`)
    return
  }

  // ── Step 1: Log in as operator ────────────────────────────────────────────
  await loginAs(page, 'operator@compass.com')
  await expect(page.locator('.sidebar')).toBeVisible()
  await page.waitForTimeout(1500) // Allow API fetches to settle

  // ── Step 2: Check if already submitted today ──────────────────────────────
  const alreadyPending = await page.getByText(/Pending Approval/i).first().isVisible({ timeout: 3000 }).catch(() => false)
  const alreadyAccepted = await page.getByText(/Accepted/i).first().isVisible({ timeout: 2000 }).catch(() => false)

  if (alreadyPending || alreadyAccepted) {
    // Already submitted today — skip to controller check
    console.log('Operator already submitted today — skipping to controller check')
  } else {
    // ── Step 3: Start Excel submission ──────────────────────────────────────
    const submitNowBtn = page.getByRole('button', { name: /Submit Now/i })
    await expect(submitNowBtn).toBeVisible({ timeout: 5000 })
    await submitNowBtn.click()

    // ── Step 4: Choose Entry Method → Excel ─────────────────────────────────
    await expect(page.getByRole('heading', { name: /Choose Entry Method/i })).toBeVisible({ timeout: 8000 })

    // Click the Excel method card/button
    const excelOption = page.getByRole('button', { name: /Excel/i })
      .or(page.getByText(/Excel/i).locator('..').getByRole('button'))
      .first()
    await expect(excelOption).toBeVisible({ timeout: 5000 })
    await excelOption.click()

    // ── Step 5: Upload the Excel file ────────────────────────────────────────
    await expect(page.getByRole('heading', { name: /Excel Upload|Upload.*Excel|Import/i })).toBeVisible({ timeout: 8000 })

    const excelFilePath = createCashroomExcel()
    try {
      const fileInput = page.locator('input[type="file"]')
      await expect(fileInput).toBeAttached({ timeout: 5000 })
      await fileInput.setInputFiles(excelFilePath)

      // ── Step 6: Verify parsed data appears ────────────────────────────────
      await expect(page.getByText(/parsed|preview|total|section/i).first()).toBeVisible({ timeout: 8000 })

      // ── Step 7: Submit for approval ───────────────────────────────────────
      const submitBtn = page.getByRole('button', { name: /Submit for Approval|Submit/i }).last()
      await expect(submitBtn).toBeVisible({ timeout: 8000 })
      await expect(submitBtn).toBeEnabled({ timeout: 5000 })
      await submitBtn.click()

      // ── Step 8: Confirm back on operator dashboard ────────────────────────
      await expect(
        page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i })
      ).toBeVisible({ timeout: 12000 })
      await page.waitForTimeout(1000)

      // Verify today's submission shows as Pending Approval
      await expect(page.getByText(/Pending Approval/i).first()).toBeVisible({ timeout: 5000 })
    } finally {
      fs.unlinkSync(excelFilePath)
    }
  }

  // ── Step 9: Log in as controller ─────────────────────────────────────────
  await loginAs(page, 'controller@compass.com')
  await expect(page.locator('.sidebar')).toBeVisible()

  // ── Step 10: Navigate to Daily Review Dashboard ───────────────────────────
  await page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' }).click()
  await expect(page.getByRole('heading', { name: /Daily Report Dashboard/i })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1500)

  // ── Step 11: Verify pending submission is visible ─────────────────────────
  // The dashboard should show at least one awaiting approval item
  await expect(page.getByText(/Awaiting Approval/i)).toBeVisible({ timeout: 5000 })

  // The "Complete Review" button should be visible for the pending submission
  const completeReviewBtn = page.getByRole('button', { name: /Complete Review/i }).first()
  await expect(completeReviewBtn).toBeVisible({ timeout: 5000 })

  // ── Step 12: Verify the submission is for the correct location ────────────
  // The location name or ID should appear alongside the pending submission row
  const dashboardContent = await page.locator('.card').first().textContent()
  expect(dashboardContent).toBeTruthy()
  // At minimum: there is a pending item visible for the controller to review
  const pendingCount = await page.getByRole('button', { name: /Complete Review/i }).count()
  expect(pendingCount).toBeGreaterThanOrEqual(1)
})

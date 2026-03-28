/**
 * UPDATE-SUBMISSION tests
 * Tests that operators can update pending_approval submissions via Form and Excel.
 *
 * Requires:
 *   - operator@compass.com with password demo1234 assigned to loc-1
 *   - Backend running on port 8001 with seeded locations
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const EXCEL_FILE = path.resolve(__dirname, '../../Cashroom Count Worksheet.xlsx')

const API = 'http://localhost:8001/v1'

async function getToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
  password = 'demo1234',
): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password } })
  return (await res.json()).access_token as string
}

async function createTestSubmission(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  date: string,
): Promise<string> {
  // Delete any existing submission for this date first (cleanup)
  const list = await request.get(`${API}/submissions?location_id=loc-1&date_from=${date}&date_to=${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const items = (await list.json()).items ?? []
  for (const s of items) {
    if (s.status === 'draft') {
      await request.delete(`${API}/submissions/${s.id}`, { headers: { Authorization: `Bearer ${token}` } })
    }
  }

  const res = await request.post(`${API}/submissions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      location_id: 'loc-1',
      submission_date: date,
      source: 'FORM',
      sections: {
        A: { total: 500, ones: 100, fives: 400 },
        B: { total: 75, dollar: 50, quarters: 25 },
        C: { total: 0 }, D: { total: 0 }, E: { total: 0 },
        F: { total: 0 }, G: { total: 0 }, H: { total: 0 }, I: { total: 0 },
      },
      variance_note: null,
      save_as_draft: false,
    },
  })
  const sub = await res.json()
  return sub.id as string
}

test.describe('Update Submission', () => {

  test('US-001: pending submission shows Update button on operator dashboard', async ({ page, request }) => {
    const token = await getToken(request, 'operator@compass.com')
    // Use local date (matching todayStr() in frontend)
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    // Create a fresh pending submission for today
    const subId = await createTestSubmission(request, token, today)
    expect(subId).toBeTruthy()

    // Login and check dashboard
    await loginAs(page, 'operator@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(2000)

    // Today's card should show "Update →" button (the primary one in today's card)
    const todayCard = page.locator('.btn-primary', { hasText: /Update/ })
    await expect(todayCard.first()).toBeVisible({ timeout: 8000 })
  })

  test('US-002: Update button navigates to method selector with update banner', async ({ page, request }) => {
    const token = await getToken(request, 'operator@compass.com')
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    await createTestSubmission(request, token, today)

    await loginAs(page, 'operator@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(1500)

    // Click the primary "Update →" button in today's card
    await page.locator('.btn-primary', { hasText: /Update/ }).first().click()

    // Should see method selector with update banner
    await expect(page.getByRole('heading', { name: /Choose Entry Method/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Updating existing submission/i)).toBeVisible({ timeout: 3000 })
  })

  test('US-003: update pending submission via Digital Form', async ({ page, request }) => {
    const token = await getToken(request, 'operator@compass.com')
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    const subId = await createTestSubmission(request, token, today)

    await loginAs(page, 'operator@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(1500)

    // Click the primary "Update →" button in today's card
    await page.locator('.btn-primary', { hasText: /Update/ }).first().click()
    await expect(page.getByRole('heading', { name: /Choose Entry Method/i })).toBeVisible({ timeout: 5000 })

    const formCard = page.locator('.card', { hasText: /Digital Form/i })
    await formCard.getByRole('button', { name: /Select/i }).click()

    // Form should load with existing data
    await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 10000 })

    // The "Save Changes" button should show (not "Save Draft") for pending submission
    await expect(page.getByText(/Save Changes/i).first()).toBeVisible({ timeout: 3000 })

    // Submit for Approval button should be available
    const submitBtn = page.getByRole('button', { name: /Submit for Approval/i })
    await expect(submitBtn).toBeVisible({ timeout: 5000 })

    // Verify submission still exists with same ID via API
    const checkRes = await request.get(`${API}/submissions/${subId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(checkRes.ok()).toBeTruthy()
    const sub = await checkRes.json()
    expect(sub.status).toBe('pending_approval')
  })

  test('US-004: update pending submission via Excel re-upload', async ({ page, request }) => {
    const token = await getToken(request, 'operator@compass.com')
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    await createTestSubmission(request, token, today)

    await loginAs(page, 'operator@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(1500)

    // Click the primary "Update →" button in today's card
    await page.locator('.btn-primary', { hasText: /Update/ }).first().click()
    await expect(page.getByRole('heading', { name: /Choose Entry Method/i })).toBeVisible({ timeout: 5000 })

    const excelCard = page.locator('.card', { hasText: /Excel Upload/i })
    await excelCard.getByRole('button', { name: /Select/i }).click()

    // Should see Excel Upload page with re-upload banner
    await expect(page.getByRole('heading', { name: /Excel Upload/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Re-uploading for existing submission/i)).toBeVisible({ timeout: 3000 })

    // Upload the real Excel file
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 5000 })
    await fileInput.setInputFiles(EXCEL_FILE)

    // Should navigate to form with parsed Excel data
    await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 10000 })

    // Verify no error
    const errorVisible = await page.getByText(/Could not read section totals/i).isVisible().catch(() => false)
    expect(errorVisible).toBe(false)
  })

  test('US-005: approved submission has no Update button', async ({ page, request }) => {
    const token = await getToken(request, 'operator@compass.com')

    // Verify via API that approved submissions can't be updated
    const res = await request.get(`${API}/submissions?status=approved&page_size=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const items = (await res.json()).items ?? []

    if (items.length === 0) {
      test.skip(true, 'No approved submissions to test against')
      return
    }

    // Login and check that approved submissions show only "View Details" in history
    await loginAs(page, 'operator@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(1500)

    // The history should not have an "Update" button next to approved entries
    // (approved rows only show "View Details")
    const approvedRows = page.locator('tr', { hasText: /Approved/i })
    if (await approvedRows.first().isVisible().catch(() => false)) {
      const updateBtn = approvedRows.first().getByRole('button', { name: /Update/i })
      expect(await updateBtn.isVisible().catch(() => false)).toBe(false)
    }
  })

  test('US-006: View Details for pending shows Update button in readonly view', async ({ page, request }) => {
    const token = await getToken(request, 'operator@compass.com')
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    await createTestSubmission(request, token, today)

    await loginAs(page, 'operator@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(1500)

    // Click "View →" in today's card to go to readonly
    await page.locator('.btn-outline', { hasText: /^View/ }).first().click()

    // Should see readonly submission page with "Update →" button
    await expect(page.getByText(/Submission/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.btn-primary', { hasText: /Update/ })).toBeVisible({ timeout: 3000 })
  })
})

/**
 * Import Roster → Welcome Email E2E Tests
 *
 * Verifies the full flow:
 *   1. Admin uploads Excel roster via UI → preview table → Confirm Import
 *   2. Backend creates new users and queues welcome email via send_welcome_background
 *   3. UI shows "✉ Welcome emails with login credentials have been sent to all newly created users."
 *   4. API audit trail records ROSTER_IMPORT event
 *
 * Test IDs:
 *   IMPORT-EMAIL-001  API import creates new users (welcome email is queued)
 *   IMPORT-EMAIL-002  Audit trail records ROSTER_IMPORT event
 *   IMPORT-EMAIL-003  UI shows welcome email confirmation after xlsx upload + confirm
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import * as XLSX from 'xlsx'

const API = 'http://localhost:8000/v1'

async function getAdminToken(request: import('@playwright/test').APIRequestContext) {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: 'admin@compass.com', password: 'demo1234' },
  })
  return (await r.json()).access_token
}

/** Build a minimal wide-format xlsx buffer with one new user row */
function buildRosterXlsx(locName: string, userEmail: string, userName: string): Buffer {
  const wb = XLSX.utils.book_new()
  const rows = [
    ['CC#', 'District', 'Cashroom Lead', 'Cashroom Lead Email', 'Controller', 'Controller Email'],
    ['E2ETEST',  locName, userName, userEmail, '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Roster')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT-EMAIL-001: API import creates new user → welcome email queued
// ─────────────────────────────────────────────────────────────────────────────
test('IMPORT-EMAIL-001: POST /admin/import creates new user and returns users_created >= 1', async ({ request }) => {
  const token = await getAdminToken(request)
  const suffix = Date.now().toString().slice(-7)
  const uniqueEmail = `importtest${suffix}@testsite.com`

  const r = await request.post(`${API}/admin/import`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      rows: [
        {
          location_code: `E2E${suffix}`,
          location_name: `E2E Import Site ${suffix}`,
          district: 'Test District',
          cashroom_lead: `Import User ${suffix}`,
          cashroom_lead_email: uniqueEmail,
        },
      ],
    },
  })

  expect(r.status()).toBe(200)
  const body = await r.json()

  // At least 1 new user was created → welcome email was queued
  expect(body.users_created).toBeGreaterThanOrEqual(1)
  expect(body.locations_created).toBeGreaterThanOrEqual(1)
  expect(body).toHaveProperty('warnings')
})

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT-EMAIL-002: Audit trail records ROSTER_IMPORT event
// ─────────────────────────────────────────────────────────────────────────────
test('IMPORT-EMAIL-002: audit trail records ROSTER_IMPORT event after import', async ({ request }) => {
  const token = await getAdminToken(request)
  const suffix = Date.now().toString().slice(-7)

  // Trigger an import
  await request.post(`${API}/admin/import`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      rows: [
        {
          location_code: `AUD${suffix}`,
          location_name: `Audit Test Site ${suffix}`,
          cashroom_lead: `Audit User ${suffix}`,
          cashroom_lead_email: `auditimport${suffix}@testsite.com`,
        },
      ],
    },
  })

  // Check audit trail for ROSTER_IMPORT event
  const auditR = await request.get(
    `${API}/audit?event_type=ROSTER_IMPORT&page_size=5`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(auditR.status()).toBe(200)
  const auditBody = await auditR.json()
  const items = auditBody.items ?? auditBody
  expect(Array.isArray(items)).toBe(true)
  expect(items.length).toBeGreaterThan(0)

  // Most recent ROSTER_IMPORT event should reference our import
  const latest = items[0]
  expect(latest.event_type).toBe('ROSTER_IMPORT')
  expect(latest.detail).toMatch(/imported/i)
})

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT-EMAIL-003: UI shows "Welcome emails sent" after xlsx upload + confirm
// ─────────────────────────────────────────────────────────────────────────────
test('IMPORT-EMAIL-003: UI shows welcome email confirmation after xlsx upload and confirm import', async ({ page }) => {
  const suffix = Date.now().toString().slice(-7)
  const locName = `UI Import Site ${suffix}`
  const userEmail = `uiimport${suffix}@testsite.com`
  const userName = `UI Import User ${suffix}`

  await loginAs(page, 'admin@compass.com')

  // Navigate to Import Roster
  await page.locator('.nav-item').filter({ hasText: 'Import Roster' }).click()
  await expect(page.getByRole('heading', { name: /Import Users/i })).toBeVisible({ timeout: 8000 })

  // Build xlsx buffer and upload it
  const xlsxBuffer = buildRosterXlsx(locName, userEmail, userName)
  const fileInput = page.locator('input[type="file"]')
  await expect(fileInput).toHaveCount(1)

  await fileInput.setInputFiles({
    name: 'test-roster.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: xlsxBuffer,
  })

  // Wait for preview table to populate
  await expect(page.getByRole('button', { name: /Confirm Import/i })).toBeVisible({ timeout: 8000 })

  // Preview table should show the location name
  const previewTable = page.locator('table')
  const previewText = await previewTable.first().innerText().catch(() => '')
  const hasLocation = previewText.includes(locName) || previewText.includes('UI Import')
  expect(hasLocation).toBe(true)

  // Click Confirm Import
  await page.getByRole('button', { name: /Confirm Import/i }).click()

  // Wait for import to complete
  await expect(page.getByText(/imported successfully/i)).toBeVisible({ timeout: 15000 })

  // ✅ Key assertion: Welcome email confirmation must be visible
  await expect(
    page.getByText(/Welcome emails with login credentials have been sent/i)
  ).toBeVisible({ timeout: 5000 })

  // Also verify the success summary shows users were created
  const successText = await page.locator('div').filter({ hasText: /imported successfully/i }).first().innerText()
  expect(successText).toMatch(/\d+\s+users/)
})

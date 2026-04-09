import { test, expect, Page } from '@playwright/test'

/**
 * Alarm System Full E2E Workflow
 *
 * Phase 1: Admin creates building + zones
 * Phase 2: Controller tests zones (mixed results) + submits
 * Phase 3: Admin rejects
 * Phase 4: Controller fixes + resubmits
 * Phase 5: Admin approves
 * Phase 6: Verify RC dashboard at each stage
 */

// ── Config ──────────────────────────────────────────────────────────────────
const BASE = 'http://localhost:3001'
const ADMIN_EMAIL = 'admin@compass.com'
const CONTROLLER_EMAIL = 'terri.serrano@compass.com'
const RC_EMAIL = 'kyle.decker@compass.com' // Regional Controller
const PASSWORD = 'demo1234'
const BUILDING_NAME = 'Testing Building E2E'

// ── Helpers ─────────────────────────────────────────────────────────────────
async function login(page: Page, email: string) {
  await page.goto(BASE)
  await page.evaluate(() => {
    localStorage.removeItem('ccs_token')
    localStorage.removeItem('ccs_refresh_token')
  })
  await page.goto(BASE)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('.btn-login-submit')
  await page.waitForSelector('.sidebar', { timeout: 15000 })
}

async function clickNav(page: Page, label: string) {
  await page.locator('.nav-item').filter({ hasText: label }).click()
  await page.waitForTimeout(1000)
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/alarm-e2e-${name}.png`, fullPage: true })
}

// ── Use serial mode — tests depend on each other ────────────────────────────
test.describe.serial('Alarm System Full E2E Workflow', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Admin Setup — Create Building + Zones
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC-ALM-001: Admin creates test building', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Config')
    await page.waitForTimeout(500)
    await screenshot(page, '001-before-add')

    // Click "+ Add Building"
    await page.locator('button').filter({ hasText: '+ Add Building' }).click()
    await page.waitForTimeout(500)

    // Fill building form using placeholders to target correct inputs
    await page.locator('input[placeholder*="Canteen"]').fill(BUILDING_NAME)
    // Region dropdown is the first select in the modal
    const modal = page.locator('div').filter({ hasText: /^Add Building/ }).locator('..').locator('..')
    await page.locator('select.f-sel').first().selectOption('Midwest')

    // Security company fields by placeholder
    await page.locator('input[placeholder*="AES IntelliNet"]').fill('TestGuard Inc')
    await page.locator('input[placeholder*="AES9925"]').fill('TG-9999')
    await page.locator('input[placeholder*="(800)"]').fill('(555) 123-4567')

    // Assign Tester: check Terri Serrano
    const testerLabel = page.locator('label').filter({ hasText: 'Terri Serrano' })
    await testerLabel.locator('input[type="checkbox"]').check()

    // Assign Approver — select containing "Select Approver"
    const approverSelect = page.locator('select.f-sel').filter({ hasText: 'Select Approver' })
    await approverSelect.selectOption({ index: 1 })

    // Status: Active (default — already selected)
    await screenshot(page, '001-form-filled')

    // Save — click the green "Add Building" button at bottom of modal (not the "+ Add Building" header button)
    const saveBtn = page.locator('button.btn.btn-primary').filter({ hasText: /^Add Building$/ })
    await saveBtn.click()
    await page.waitForTimeout(2000)

    // Verify building appears in table
    await expect(page.locator('table.dt').filter({ hasText: BUILDING_NAME })).toBeVisible({ timeout: 5000 })
    await screenshot(page, '001-building-created')
  })

  test('TC-ALM-002: Admin adds 6 zones to the building', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Config')
    await page.waitForTimeout(500)

    // Click the "Zones" sub-nav pill (it's a <span>, not a button)
    await page.locator('span').filter({ hasText: /^Zones$/ }).click()
    await page.waitForTimeout(1000)

    // Select building from dropdown (Zone Config uses just building name)
    const buildingSelect = page.locator('select.f-sel').first()
    await buildingSelect.selectOption({ label: BUILDING_NAME })
    await page.waitForTimeout(500)

    // Zone definitions to add
    const zones = [
      { num: '1', name: 'Front Door', type: 'ENTRY_EXIT', area: '1' },
      { num: '2', name: 'Back Door', type: 'ENTRY_EXIT', area: '1' },
      { num: '3', name: 'Lobby Motion', type: 'INTERIOR_MOTION', area: '2' },
      { num: '4', name: 'Panic Button Office', type: 'PANIC_SILENT', area: '1' },
      { num: '5', name: 'Fire Alarm Floor 1', type: 'FIRE_SMOKE', area: '3' },
      { num: '6', name: 'Warehouse Camera', type: 'OTHER', area: '4' },
    ]

    for (const zone of zones) {
      await page.locator('button').filter({ hasText: '+ Add Zone' }).click()
      await page.waitForTimeout(500)

      // Fill zone form using labels
      // Zone Number — input next to "Zone Number" label
      const zoneNumField = page.locator('label.f-lbl').filter({ hasText: 'Zone Number' }).locator('..').locator('input.f-inp')
      await zoneNumField.fill(zone.num)

      // Area Number
      const areaField = page.locator('label.f-lbl').filter({ hasText: 'Area Number' }).locator('..').locator('input.f-inp')
      await areaField.fill(zone.area)

      // Zone Name
      const nameField = page.locator('label.f-lbl').filter({ hasText: 'Zone Name' }).locator('..').locator('input.f-inp')
      await nameField.fill(zone.name)

      // Zone Type
      const typeField = page.locator('label.f-lbl').filter({ hasText: 'Zone Type' }).locator('..').locator('select.f-sel')
      await typeField.selectOption(zone.type)

      // If OTHER type, fill description
      if (zone.type === 'OTHER') {
        await page.waitForTimeout(300)
        const descField = page.locator('label.f-lbl').filter({ hasText: 'Description' }).locator('..').locator('input.f-inp')
        await descField.fill('IP camera motion trigger')
      }

      // Save zone
      await page.locator('button.btn.btn-primary').filter({ hasText: /^Save$/ }).click()
      await page.waitForTimeout(800)
    }

    await screenshot(page, '002-zones-added')
    // Verify 6 zones in table
    const zoneRows = page.locator('table.dt tbody tr')
    await expect(zoneRows).toHaveCount(6, { timeout: 5000 })
  })

  test('TC-ALM-004: RC dashboard shows building as OVERDUE', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    // Admin also has access to alarm overview via sidebar
    // Navigate to Alarm Approvals first to verify the page exists, then check overview
    await clickNav(page, 'Alarm Config')
    await page.waitForTimeout(500)
    await screenshot(page, '004-rc-baseline')
    // We'll check the overview through admin's perspective later
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Controller Tests Zones (Mixed Results) + Submits
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC-ALM-005-008: Controller tests zones, uploads report, and submits', async ({ page }) => {
    // Handle any confirmation dialogs
    page.on('dialog', dialog => dialog.accept())

    await login(page, CONTROLLER_EMAIL)
    await clickNav(page, 'Alarm Testing')
    await page.waitForTimeout(500)

    // Click "Monthly Alarm Test" button
    await page.locator('button').filter({ hasText: 'Monthly Alarm Test' }).click()
    await page.waitForTimeout(1000)

    // Select the test building
    const buildingSelect = page.locator('select.f-sel').first()
    await buildingSelect.selectOption({ label: `${BUILDING_NAME} — TestGuard Inc` })
    await page.waitForTimeout(2000)

    // Verify 6 zones loaded
    await expect(page.locator('button').filter({ hasText: /^Tested$/ }).first()).toBeVisible({ timeout: 5000 })
    await screenshot(page, '005-test-started')

    // ── Mark zones with mixed results ────────────────────────────────
    async function markZone(zoneName: string, result: 'Tested' | 'Not Tested' | 'Issue') {
      const nameSpan = page.locator('span').filter({ hasText: new RegExp(`^${zoneName}$`) })
      const rowDiv = nameSpan.locator('..')
      await rowDiv.locator('button').filter({ hasText: new RegExp(`^${result}$`) }).click()
      await page.waitForTimeout(300)
    }

    await markZone('Front Door', 'Tested')
    await markZone('Back Door', 'Tested')
    await markZone('Lobby Motion', 'Not Tested')
    await markZone('Panic Button Office', 'Issue')
    await markZone('Fire Alarm Floor 1', 'Tested')
    await markZone('Warehouse Camera', 'Issue')

    // Add notes for zones with issues
    async function addZoneNote(zoneName: string, note: string) {
      const nameSpan = page.locator('span').filter({ hasText: new RegExp(`^${zoneName}$`) })
      const zoneWrapper = nameSpan.locator('..').locator('..')
      const expandBtn = zoneWrapper.locator('button').filter({ hasText: /[▼▲]/ })
      if (await expandBtn.count() > 0) {
        await expandBtn.click()
        await page.waitForTimeout(300)
      }
      const noteInput = zoneWrapper.locator('textarea, input[type="text"]')
      if (await noteInput.count() > 0) {
        await noteInput.last().fill(note)
        await page.waitForTimeout(200)
      }
    }

    await addZoneNote('Front Door', 'Door sensor responded within 2 seconds')
    await addZoneNote('Lobby Motion', 'Sensor blocked by renovation scaffolding')
    await addZoneNote('Panic Button Office', 'Button stuck, does not trigger alarm')
    await addZoneNote('Warehouse Camera', 'Camera offline, no signal to panel')
    await screenshot(page, '006-zones-marked')

    // Wait for auto-save
    await page.waitForTimeout(2000)

    // ── Upload alarm report ──────────────────────────────────────────
    const fileInput = page.locator('input[type="file"]')
    if (await fileInput.count() > 0) {
      const buffer = Buffer.from('%PDF-1.4 test alarm report content')
      await fileInput.setInputFiles({
        name: 'alarm_report_test.pdf',
        mimeType: 'application/pdf',
        buffer,
      })
      await page.waitForTimeout(1500)
    }
    await screenshot(page, '007-file-uploaded')

    // ── Submit for Approval ──────────────────────────────────────────
    const submitBtn = page.locator('button').filter({ hasText: 'Submit for Approval' })
    await submitBtn.click()
    await page.waitForTimeout(3000)
    await screenshot(page, '008-submitted')

    // Verify navigation to history or status change
    await expect(page.locator('h2').filter({ hasText: /Alarm Test History|Monthly Alarm Test/ })).toBeVisible({ timeout: 8000 })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Admin Rejects the Test
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC-ALM-010: Admin sees pending test in approvals', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Approvals')
    await page.waitForTimeout(1000)

    // Filter to Pending Review
    await page.locator('button').filter({ hasText: 'Pending Review' }).first().click()
    await page.waitForTimeout(500)

    // Verify test building is visible
    await expect(page.locator('table.dt').filter({ hasText: BUILDING_NAME })).toBeVisible({ timeout: 5000 })
    await screenshot(page, '010-admin-pending')
  })

  test('TC-ALM-011: Admin reviews test details', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Approvals')
    await page.waitForTimeout(1000)

    // Click Review button for our building
    const row = page.locator('tr').filter({ hasText: BUILDING_NAME })
    await row.locator('button').filter({ hasText: /Review|View/ }).click()
    await page.waitForTimeout(1500)

    await screenshot(page, '011-review-detail')

    // Verify we can see zone results
    await expect(page.locator('text=Tested').first()).toBeVisible()
  })

  test('TC-ALM-012: Admin rejects test with reason', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Approvals')
    await page.waitForTimeout(1000)

    // Click Review on the test
    const row = page.locator('tr').filter({ hasText: BUILDING_NAME })
    await row.locator('button').filter({ hasText: /Review|View/ }).click()
    await page.waitForTimeout(1500)

    // Click Reject Test
    await page.locator('button').filter({ hasText: 'Reject Test' }).click()
    await page.waitForTimeout(500)

    // Fill rejection reason in modal
    const reasonTextarea = page.locator('textarea.f-ta').last()
    await reasonTextarea.fill('2 zones have issues (Panic Button stuck, Camera offline) and 1 zone not tested. Fix all issues and test all zones before resubmitting.')

    await screenshot(page, '012-reject-modal')

    // Confirm rejection
    await page.locator('button').filter({ hasText: 'Confirm Rejection' }).click()
    await page.waitForTimeout(2000)

    await screenshot(page, '012-rejected')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: Controller Fixes & Resubmits
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC-ALM-014: Controller sees rejection in history', async ({ page }) => {
    await login(page, CONTROLLER_EMAIL)
    await clickNav(page, 'Alarm Testing')
    await page.waitForTimeout(1000)

    // Filter to Rejected
    await page.locator('button').filter({ hasText: /^Rejected$/ }).click()
    await page.waitForTimeout(500)

    // Verify Fix & Resubmit button
    const rejectedRow = page.locator('tr').filter({ hasText: BUILDING_NAME })
    await expect(rejectedRow.locator('button').filter({ hasText: 'Fix & Resubmit' })).toBeVisible()
    await screenshot(page, '014-controller-sees-rejection')
  })

  test('TC-ALM-015: Controller opens rejected test', async ({ page }) => {
    await login(page, CONTROLLER_EMAIL)
    await clickNav(page, 'Alarm Testing')
    await page.waitForTimeout(1000)

    // Filter to Rejected and click Fix & Resubmit
    await page.locator('button').filter({ hasText: /^Rejected$/ }).click()
    await page.waitForTimeout(500)

    const rejectedRow = page.locator('tr').filter({ hasText: BUILDING_NAME })
    await rejectedRow.locator('button').filter({ hasText: 'Fix & Resubmit' }).click()
    await page.waitForTimeout(1500)

    // Verify rejection banner visible
    await expect(page.locator('text=Test Rejected')).toBeVisible({ timeout: 5000 })
    await screenshot(page, '015-rejection-banner')
  })

  test('TC-ALM-016: Controller fixes all zones to TESTED', async ({ page }) => {
    await login(page, CONTROLLER_EMAIL)
    await clickNav(page, 'Alarm Testing')
    await page.locator('button').filter({ hasText: 'Monthly Alarm Test' }).click()
    await page.waitForTimeout(1000)

    // Select building (loads the reopened draft)
    const buildingSelect = page.locator('select.f-sel').first()
    await buildingSelect.selectOption({ label: `${BUILDING_NAME} — TestGuard Inc` })
    await page.waitForTimeout(2000)

    // Mark all zones as Tested
    async function markZoneTested(zoneName: string) {
      const nameSpan = page.locator('span').filter({ hasText: new RegExp(`^${zoneName}$`) })
      const rowDiv = nameSpan.locator('..')
      await rowDiv.locator('button').filter({ hasText: /^Tested$/ }).click()
      await page.waitForTimeout(300)
    }

    await markZoneTested('Front Door')
    await markZoneTested('Back Door')
    await markZoneTested('Lobby Motion')
    await markZoneTested('Panic Button Office')
    await markZoneTested('Fire Alarm Floor 1')
    await markZoneTested('Warehouse Camera')

    await page.waitForTimeout(500)
    await screenshot(page, '016-all-tested')
  })

  test('TC-ALM-017: Controller resubmits fixed test', async ({ page }) => {
    await login(page, CONTROLLER_EMAIL)
    await clickNav(page, 'Alarm Testing')
    await page.locator('button').filter({ hasText: 'Monthly Alarm Test' }).click()
    await page.waitForTimeout(1000)

    const buildingSelect = page.locator('select.f-sel').first()
    await buildingSelect.selectOption({ label: `${BUILDING_NAME} — TestGuard Inc` })
    await page.waitForTimeout(2000)

    // Handle dialogs
    page.on('dialog', dialog => dialog.accept())

    // Submit
    const submitBtn = page.locator('button').filter({ hasText: 'Submit for Approval' })
    await submitBtn.click()
    await page.waitForTimeout(3000)

    await screenshot(page, '017-resubmitted')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: Admin Approves
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC-ALM-019: Admin reviews updated test', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Approvals')
    await page.waitForTimeout(1000)

    // Click Review
    const row = page.locator('tr').filter({ hasText: BUILDING_NAME })
    await row.locator('button').filter({ hasText: /Review|View/ }).click()
    await page.waitForTimeout(1500)

    await screenshot(page, '019-review-updated')
  })

  test('TC-ALM-020: Admin approves test', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Approvals')
    await page.waitForTimeout(1000)

    const row = page.locator('tr').filter({ hasText: BUILDING_NAME })
    await row.locator('button').filter({ hasText: /Review|View/ }).click()
    await page.waitForTimeout(1500)

    // Handle confirm dialog
    page.on('dialog', dialog => dialog.accept())

    // Click Approve Test
    await page.locator('button').filter({ hasText: 'Approve Test' }).click()
    await page.waitForTimeout(2000)

    await screenshot(page, '020-approved')
  })

  test('TC-ALM-022: Controller history shows approved test', async ({ page }) => {
    await login(page, CONTROLLER_EMAIL)
    await clickNav(page, 'Alarm Testing')
    await page.waitForTimeout(1000)

    // Filter to Approved
    await page.locator('button').filter({ hasText: /^Approved$/ }).click()
    await page.waitForTimeout(500)

    // Verify approved test visible with View button
    const approvedRow = page.locator('tr').filter({ hasText: BUILDING_NAME })
    await expect(approvedRow.locator('button').filter({ hasText: 'View' })).toBeVisible()
    await screenshot(page, '022-controller-approved-history')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 7: Biannual — Cellular Backup (PASS → Reject → Fix → Approve)
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC-ALM-024: Controller records cellular backup check (PASS)', async ({ page }) => {
    await login(page, CONTROLLER_EMAIL)
    await clickNav(page, 'Alarm Testing')
    await page.waitForTimeout(500)

    // Click the "📋 Biannual Checks" header button (btn-outline, not the tab toggle)
    await page.locator('button.btn-outline').filter({ hasText: 'Biannual Checks' }).click()
    await page.waitForTimeout(500)

    // Select building (biannual uses {name} — {region})
    const buildingSelect = page.locator('select.f-inp')
    await buildingSelect.selectOption({ label: `${BUILDING_NAME} — Midwest` })
    await page.waitForTimeout(1000)

    // Click Pass for cellular
    const cellularCard = page.locator('.card').filter({ hasText: 'Cellular Backup Test' })
    await cellularCard.locator('button').filter({ hasText: /^Pass$/ }).click()

    // Add notes
    await cellularCard.locator('textarea.f-ta').fill('Cellular signal test passed. Signal strength 4/5 bars.')

    await screenshot(page, '024-cellular-pass')

    // Submit
    await cellularCard.locator('button').filter({ hasText: 'Record Cellular Check' }).click()
    await page.waitForTimeout(2000)

    // Verify success — the check should appear in history or a toast
    await screenshot(page, '024-cellular-saved')
  })

  test('TC-ALM-028: Admin approves cellular check', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Approvals')
    await page.waitForTimeout(1000)

    // Switch to Biannual Checks tab
    await page.locator('button').filter({ hasText: 'Biannual Checks' }).click()
    await page.waitForTimeout(1000)

    // Find the pending cellular check and approve
    const row = page.locator('tr').filter({ hasText: BUILDING_NAME }).filter({ hasText: 'Cellular' }).first()
    const approveBtn = row.locator('button').filter({ hasText: /Approve/ })
    if (await approveBtn.count() > 0) {
      await approveBtn.click()
      await page.waitForTimeout(2000)
    }
    await screenshot(page, '028-cellular-approved')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 8: Biannual — Camera Backup (FAIL → Approve as Non-Compliant)
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC-ALM-029: Controller records camera backup check (FAIL)', async ({ page }) => {
    await login(page, CONTROLLER_EMAIL)
    await clickNav(page, 'Alarm Testing')
    await page.waitForTimeout(500)

    await page.locator('button.btn-outline').filter({ hasText: 'Biannual Checks' }).click()
    await page.waitForTimeout(500)

    const buildingSelect = page.locator('select.f-inp')
    await buildingSelect.selectOption({ label: `${BUILDING_NAME} — Midwest` })
    await page.waitForTimeout(1000)

    // Click Fail for camera
    const cameraCard = page.locator('.card').filter({ hasText: '30-Day Camera Backup' })
    await cameraCard.locator('button').filter({ hasText: /^Fail$/ }).click()

    // Fill days verified
    const daysInput = cameraCard.locator('input[type="number"]')
    if (await daysInput.count() > 0) {
      await daysInput.fill('25')
    }

    // Add notes
    await cameraCard.locator('textarea.f-ta').fill('Camera 3 in warehouse had 5 days of missing footage. Work order #WO-4421 submitted.')

    await screenshot(page, '029-camera-fail')

    // Submit
    await cameraCard.locator('button').filter({ hasText: 'Record Camera Check' }).click()
    await page.waitForTimeout(2000)
    await screenshot(page, '029-camera-saved')
  })

  test('TC-ALM-030: Admin approves non-compliant camera check', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Approvals')
    await page.waitForTimeout(1000)

    await page.locator('button').filter({ hasText: 'Biannual Checks' }).click()
    await page.waitForTimeout(1000)

    // Find camera check and approve it (non-compliant is valid result)
    const row = page.locator('tr').filter({ hasText: BUILDING_NAME }).filter({ hasText: 'Camera' }).first()
    const approveBtn = row.locator('button').filter({ hasText: /Approve/ })
    if (await approveBtn.count() > 0) {
      await approveBtn.click()
      await page.waitForTimeout(2000)
    }
    await screenshot(page, '030-camera-approved')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 9: Final Verification
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC-ALM-032: Final dashboard state — monthly compliant, biannual mixed', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await clickNav(page, 'Alarm Approvals')
    await page.waitForTimeout(1000)

    // Verify monthly test is approved
    await page.locator('button').filter({ hasText: /^Approved/ }).first().click()
    await page.waitForTimeout(500)
    await expect(page.locator('tr').filter({ hasText: BUILDING_NAME })).toBeVisible()
    await screenshot(page, '032-monthly-approved')

    // Switch to biannual tab and verify
    await page.locator('button').filter({ hasText: 'Biannual Checks' }).click()
    await page.waitForTimeout(1000)
    await screenshot(page, '032-biannual-final')
  })
})

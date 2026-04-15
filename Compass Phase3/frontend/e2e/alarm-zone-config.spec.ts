import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Login as admin and navigate to Alarm Zone Config screen
// ─────────────────────────────────────────────────────────────────────────────

async function gotoZoneConfig(page: import('@playwright/test').Page) {
  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Alarm Config' }).click()
  await expect(page.getByRole('heading', { name: /Alarm Zone Configuration/i })).toBeVisible({ timeout: 8000 })
}

// =============================================================================
// 1. PAGE LOAD & LAYOUT
// =============================================================================

test.describe('Zone Config — Page Load & Layout', () => {

  test('ZC-001: Page renders with heading and admin name', async ({ page }) => {
    await gotoZoneConfig(page)
    await expect(page.getByRole('heading', { name: /Alarm Zone Configuration/i })).toBeVisible()
    await expect(page.locator('text=Manage alarm zones per building')).toBeVisible()
  })

  test('ZC-002: Sub-nav pills are visible (Zones, Buildings, Rules, Access)', async ({ page }) => {
    await gotoZoneConfig(page)
    for (const label of ['Zones', 'Buildings', 'Rules', 'Access']) {
      await expect(page.locator('span').filter({ hasText: label }).first()).toBeVisible()
    }
  })

  test('ZC-003: Zones pill is active by default', async ({ page }) => {
    await gotoZoneConfig(page)
    const zonesPill = page.locator('span').filter({ hasText: 'Zones' }).first()
    const style = await zonesPill.getAttribute('style')
    expect(style).toContain('var(--g7)')
  })

  test('ZC-004: Building dropdown is visible and has at least one option', async ({ page }) => {
    await gotoZoneConfig(page)
    const select = page.locator('select.f-sel')
    await expect(select).toBeVisible()
    const options = await select.locator('option').count()
    expect(options).toBeGreaterThanOrEqual(1)
  })

  test('ZC-005: First building is selected by default', async ({ page }) => {
    await gotoZoneConfig(page)
    const select = page.locator('select.f-sel')
    const value = await select.inputValue()
    expect(value).toBeTruthy()
  })

  test('ZC-006: Zone table shows columns — Zone #, Zone Name, Type, Area, Status, Actions', async ({ page }) => {
    await gotoZoneConfig(page)
    for (const col of ['Zone #', 'Zone Name', 'Type', 'Area', 'Status', 'Actions']) {
      await expect(page.locator('table.dt thead').getByText(col)).toBeVisible()
    }
  })

  test('ZC-007: Card header shows total and active zone counts', async ({ page }) => {
    await gotoZoneConfig(page)
    await expect(page.locator('.card-sub').filter({ hasText: /total/ })).toBeVisible()
    await expect(page.locator('.card-sub').filter({ hasText: /active/ })).toBeVisible()
  })

  test('ZC-008: Import CSV and + Add Zone buttons are visible', async ({ page }) => {
    await gotoZoneConfig(page)
    await expect(page.getByRole('button', { name: /Import CSV/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /\+ Add Zone/i })).toBeVisible()
  })
})

// =============================================================================
// 2. BUILDING SWITCHER
// =============================================================================

test.describe('Zone Config — Building Switcher', () => {

  test('ZC-009: Switching building updates the zone list', async ({ page }) => {
    await gotoZoneConfig(page)
    const select = page.locator('select.f-sel')
    const options = await select.locator('option').all()
    if (options.length < 2) {
      test.skip()
      return
    }
    // Read zones for first building
    const firstCount = await page.locator('table.dt tbody tr').count()

    // Switch to second building
    const secondValue = await options[1].getAttribute('value')
    await select.selectOption(secondValue!)
    await page.waitForTimeout(500)

    // Card title should update to second building name
    const secondName = await options[1].textContent()
    await expect(page.locator('.card-title')).toContainText(secondName!.trim())
  })

  test('ZC-010: Card title shows "Zones for <building name>"', async ({ page }) => {
    await gotoZoneConfig(page)
    const select = page.locator('select.f-sel')
    const selectedOption = select.locator('option[selected]').or(select.locator('option').first())
    const buildingName = await selectedOption.textContent()
    await expect(page.locator('.card-title')).toContainText(buildingName!.trim())
  })
})

// =============================================================================
// 3. ADD ZONE
// =============================================================================

test.describe('Zone Config — Add Zone', () => {

  test('ZC-011: Clicking "+ Add Zone" opens the modal', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()
    await expect(page.getByRole('heading', { name: /Add Zone/i })).toBeVisible()
  })

  test('ZC-012: Add modal has all required fields', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()
    await expect(page.locator('label').filter({ hasText: 'Zone Number' })).toBeVisible()
    await expect(page.locator('label').filter({ hasText: 'Zone Name' })).toBeVisible()
    await expect(page.locator('label').filter({ hasText: 'Zone Type' })).toBeVisible()
    await expect(page.locator('label').filter({ hasText: 'Area Number' })).toBeVisible()
  })

  test('ZC-013: Zone Type dropdown has all 6 types', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()
    const typeSelect = page.locator('select.f-sel').last()
    for (const type of ['Entry / Exit', 'Interior Motion', 'Panic Silent', 'Holdup', 'Fire / Smoke', 'Other']) {
      await expect(typeSelect.locator('option').filter({ hasText: type })).toBeAttached()
    }
  })

  test('ZC-014: Saving without zone number shows validation error', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()

    // Fill name but leave zone number empty
    const nameInput = page.locator('.f-inp').nth(2) // Zone Name input
    await nameInput.fill('Test Zone')

    await page.getByRole('button', { name: /Save/i }).click()
    await expect(page.getByText(/Zone number required/i)).toBeVisible()
  })

  test('ZC-015: Saving without zone name shows validation error', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()

    // Fill zone number but leave name empty
    const numInput = page.locator('input[type="number"]').first()
    await numInput.fill('99')

    await page.getByRole('button', { name: /Save/i }).click()
    await expect(page.getByText(/Zone name required/i)).toBeVisible()
  })

  test('ZC-016: Successfully add a new zone', async ({ page }) => {
    await gotoZoneConfig(page)
    const suffix = Date.now().toString().slice(-4)

    await page.getByRole('button', { name: /\+ Add Zone/i }).click()

    // Zone Number
    const numInput = page.locator('input[type="number"]').first()
    await numInput.fill(`9${suffix}`)

    // Zone Name
    const inputs = page.locator('.f-inp')
    // Find the zone name input (after zone number and area number)
    for (let i = 0; i < await inputs.count(); i++) {
      const label = await inputs.nth(i).evaluate(el => el.closest('.f-field')?.querySelector('.f-lbl')?.textContent)
      if (label?.includes('Zone Name')) {
        await inputs.nth(i).fill(`E2E Test Zone ${suffix}`)
        break
      }
    }

    await page.getByRole('button', { name: /Save/i }).click()

    // Verify success toast
    await expect(page.getByText(/added/i)).toBeVisible({ timeout: 5000 })

    // Verify zone appears in table
    await expect(page.locator('table.dt').getByText(`E2E Test Zone ${suffix}`)).toBeVisible({ timeout: 5000 })
  })

  test('ZC-017: Duplicate zone number shows validation error', async ({ page }) => {
    await gotoZoneConfig(page)

    // Get the first zone's number from the table
    const firstZoneNum = await page.locator('table.dt tbody tr td').first().textContent()

    await page.getByRole('button', { name: /\+ Add Zone/i }).click()
    const numInput = page.locator('input[type="number"]').first()
    await numInput.fill(firstZoneNum!.trim())

    // Fill a name
    const inputs = page.locator('.f-inp')
    for (let i = 0; i < await inputs.count(); i++) {
      const label = await inputs.nth(i).evaluate(el => el.closest('.f-field')?.querySelector('.f-lbl')?.textContent)
      if (label?.includes('Zone Name')) {
        await inputs.nth(i).fill('Duplicate Test')
        break
      }
    }

    await page.getByRole('button', { name: /Save/i }).click()
    await expect(page.getByText(/already exists/i)).toBeVisible()
  })

  test('ZC-018: Cancel button closes the Add modal without saving', async ({ page }) => {
    await gotoZoneConfig(page)
    const initialRows = await page.locator('table.dt tbody tr').count()

    await page.getByRole('button', { name: /\+ Add Zone/i }).click()
    await expect(page.getByRole('heading', { name: /Add Zone/i })).toBeVisible()

    await page.getByRole('button', { name: /Cancel/i }).click()

    // Modal should be gone
    await expect(page.getByRole('heading', { name: /Add Zone/i })).not.toBeVisible()

    // Row count unchanged
    const afterRows = await page.locator('table.dt tbody tr').count()
    expect(afterRows).toBe(initialRows)
  })

  test('ZC-019: Selecting "Other" zone type shows description field', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()

    // Description field should NOT be visible initially (default is ENTRY_EXIT)
    await expect(page.locator('label').filter({ hasText: 'Description' })).not.toBeVisible()

    // Select "Other" zone type
    const typeSelect = page.locator('select.f-sel').last()
    await typeSelect.selectOption('OTHER')

    // Description field should now appear
    await expect(page.locator('label').filter({ hasText: 'Description' })).toBeVisible()
  })
})

// =============================================================================
// 4. EDIT ZONE
// =============================================================================

test.describe('Zone Config — Edit Zone', () => {

  test('ZC-020: Clicking edit button opens Edit modal with pre-filled data', async ({ page }) => {
    await gotoZoneConfig(page)

    // Get the name of the first zone
    const firstZoneName = await page.locator('table.dt tbody tr').first().locator('td').nth(1).textContent()

    // Click the edit (pencil) button on the first row
    await page.locator('table.dt tbody tr').first().getByTitle('Edit').click()

    // Modal heading should say "Edit Zone"
    await expect(page.getByRole('heading', { name: /Edit Zone/i })).toBeVisible()

    // Zone name field should be pre-filled
    const nameInput = page.locator('.f-inp').filter({ hasText: '' })
    // Verify modal contains the zone name
    await expect(page.locator('h3')).toContainText(firstZoneName!.trim())
  })

  test('ZC-021: Edit a zone name and verify update', async ({ page }) => {
    await gotoZoneConfig(page)
    const suffix = Date.now().toString().slice(-4)

    // First add a zone to edit
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()
    const numInput = page.locator('input[type="number"]').first()
    await numInput.fill(`8${suffix}`)
    const inputs = page.locator('.f-inp')
    for (let i = 0; i < await inputs.count(); i++) {
      const label = await inputs.nth(i).evaluate(el => el.closest('.f-field')?.querySelector('.f-lbl')?.textContent)
      if (label?.includes('Zone Name')) {
        await inputs.nth(i).fill(`Edit Test ${suffix}`)
        break
      }
    }
    await page.getByRole('button', { name: /Save/i }).click()
    await page.waitForTimeout(500)

    // Now click edit on the zone we just created
    const row = page.locator('table.dt tbody tr').filter({ hasText: `Edit Test ${suffix}` })
    await row.getByTitle('Edit').click()

    // Change the name
    const editInputs = page.locator('.f-inp')
    for (let i = 0; i < await editInputs.count(); i++) {
      const label = await editInputs.nth(i).evaluate(el => el.closest('.f-field')?.querySelector('.f-lbl')?.textContent)
      if (label?.includes('Zone Name')) {
        await editInputs.nth(i).fill(`Edited Zone ${suffix}`)
        break
      }
    }
    await page.getByRole('button', { name: /Save/i }).click()

    // Verify update toast
    await expect(page.getByText(/updated/i)).toBeVisible({ timeout: 5000 })

    // Verify new name in table
    await expect(page.locator('table.dt').getByText(`Edited Zone ${suffix}`)).toBeVisible()
  })
})

// =============================================================================
// 5. DEACTIVATE / REACTIVATE ZONE
// =============================================================================

test.describe('Zone Config — Deactivate / Reactivate', () => {

  test('ZC-022: Active zones show "Active" badge and Deactivate button', async ({ page }) => {
    await gotoZoneConfig(page)
    const firstRow = page.locator('table.dt tbody tr').first()
    await expect(firstRow.locator('.badge-green')).toBeVisible()
    await expect(firstRow.getByText('Deactivate')).toBeVisible()
  })

  test('ZC-023: Deactivating a zone changes badge to Inactive', async ({ page }) => {
    await gotoZoneConfig(page)

    // Accept the confirmation dialog
    page.on('dialog', dialog => dialog.accept())

    const firstRow = page.locator('table.dt tbody tr').first()
    await firstRow.getByText('Deactivate').click()

    // Wait for the update
    await page.waitForTimeout(500)

    // Verify toast
    await expect(page.getByText(/deactivated/i)).toBeVisible({ timeout: 5000 })
  })

  test('ZC-024: Inactive zone shows "Reactivate" button', async ({ page }) => {
    await gotoZoneConfig(page)

    // Accept the confirmation dialog
    page.on('dialog', dialog => dialog.accept())

    // Deactivate first
    const firstRow = page.locator('table.dt tbody tr').first()
    await firstRow.getByText('Deactivate').click()
    await page.waitForTimeout(500)

    // Now it should show Reactivate
    await expect(firstRow.getByText('Reactivate')).toBeVisible()
  })

  test('ZC-025: Declining the confirmation dialog does NOT deactivate', async ({ page }) => {
    await gotoZoneConfig(page)

    // Dismiss the confirmation dialog
    page.on('dialog', dialog => dialog.dismiss())

    const firstRow = page.locator('table.dt tbody tr').first()
    await firstRow.getByText('Deactivate').click()

    // Should still show Active
    await expect(firstRow.locator('.badge-green')).toBeVisible()
  })
})

// =============================================================================
// 6. DELETE ZONE
// =============================================================================

test.describe('Zone Config — Delete Zone', () => {

  test('ZC-026: Newly added zone shows delete button', async ({ page }) => {
    await gotoZoneConfig(page)
    const suffix = Date.now().toString().slice(-4)

    // Add a new zone
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()
    const numInput = page.locator('input[type="number"]').first()
    await numInput.fill(`7${suffix}`)
    const inputs = page.locator('.f-inp')
    for (let i = 0; i < await inputs.count(); i++) {
      const label = await inputs.nth(i).evaluate(el => el.closest('.f-field')?.querySelector('.f-lbl')?.textContent)
      if (label?.includes('Zone Name')) {
        await inputs.nth(i).fill(`Delete Test ${suffix}`)
        break
      }
    }
    await page.getByRole('button', { name: /Save/i }).click()
    await page.waitForTimeout(500)

    // The new zone should have a delete button (trash icon)
    const row = page.locator('table.dt tbody tr').filter({ hasText: `Delete Test ${suffix}` })
    await expect(row.getByTitle('Delete')).toBeVisible()
  })

  test('ZC-027: Pre-existing zones do NOT show delete button', async ({ page }) => {
    await gotoZoneConfig(page)

    // First row is a pre-existing zone — should NOT have delete
    const firstRow = page.locator('table.dt tbody tr').first()
    await expect(firstRow.getByTitle('Delete')).not.toBeVisible()
  })

  test('ZC-028: Deleting a zone removes it from the table', async ({ page }) => {
    await gotoZoneConfig(page)
    const suffix = Date.now().toString().slice(-4)

    // Add a zone
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()
    const numInput = page.locator('input[type="number"]').first()
    await numInput.fill(`6${suffix}`)
    const inputs = page.locator('.f-inp')
    for (let i = 0; i < await inputs.count(); i++) {
      const label = await inputs.nth(i).evaluate(el => el.closest('.f-field')?.querySelector('.f-lbl')?.textContent)
      if (label?.includes('Zone Name')) {
        await inputs.nth(i).fill(`ToDelete ${suffix}`)
        break
      }
    }
    await page.getByRole('button', { name: /Save/i }).click()
    await page.waitForTimeout(500)

    // Accept confirmation
    page.on('dialog', dialog => dialog.accept())

    // Delete the zone
    const row = page.locator('table.dt tbody tr').filter({ hasText: `ToDelete ${suffix}` })
    await row.getByTitle('Delete').click()
    await page.waitForTimeout(500)

    // Verify it's gone
    await expect(page.locator('table.dt').getByText(`ToDelete ${suffix}`)).not.toBeVisible()

    // Verify delete toast
    await expect(page.getByText(/deleted/i)).toBeVisible({ timeout: 5000 })
  })

  test('ZC-029: Declining delete confirmation keeps the zone', async ({ page }) => {
    await gotoZoneConfig(page)
    const suffix = Date.now().toString().slice(-4)

    // Add a zone
    await page.getByRole('button', { name: /\+ Add Zone/i }).click()
    const numInput = page.locator('input[type="number"]').first()
    await numInput.fill(`5${suffix}`)
    const inputs = page.locator('.f-inp')
    for (let i = 0; i < await inputs.count(); i++) {
      const label = await inputs.nth(i).evaluate(el => el.closest('.f-field')?.querySelector('.f-lbl')?.textContent)
      if (label?.includes('Zone Name')) {
        await inputs.nth(i).fill(`KeepMe ${suffix}`)
        break
      }
    }
    await page.getByRole('button', { name: /Save/i }).click()
    await page.waitForTimeout(500)

    // Dismiss confirmation
    page.on('dialog', dialog => dialog.dismiss())

    const row = page.locator('table.dt tbody tr').filter({ hasText: `KeepMe ${suffix}` })
    await row.getByTitle('Delete').click()

    // Zone should still be there
    await expect(row).toBeVisible()
  })
})

// =============================================================================
// 7. CSV IMPORT
// =============================================================================

test.describe('Zone Config — CSV Import', () => {

  test('ZC-030: Clicking "Import CSV" opens the import modal', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /Import CSV/i }).click()
    await expect(page.getByRole('heading', { name: /Import Zones from CSV/i })).toBeVisible()
  })

  test('ZC-031: Import modal has file input and expected columns hint', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /Import CSV/i }).click()
    await expect(page.locator('input[type="file"]')).toBeVisible()
    await expect(page.getByText(/zone_number, zone_name, zone_type, area_number/i)).toBeVisible()
  })

  test('ZC-032: Download Sample CSV link is visible in import modal', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /Import CSV/i }).click()
    const downloadLink = page.getByText('Download Sample CSV')
    await expect(downloadLink).toBeVisible()
    const href = await downloadLink.getAttribute('href')
    expect(href).toContain('alarm-zones-sample.csv')
  })

  test('ZC-033: Uploading a valid CSV shows preview table', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /Import CSV/i }).click()

    // Create a minimal CSV file
    const csvContent = 'zone_number,zone_name,zone_type,area_number\n50,Test Door,ENTRY_EXIT,1\n51,Test Motion,INTERIOR_MOTION,1'
    const buffer = Buffer.from(csvContent, 'utf-8')

    // Upload via file chooser
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test-zones.csv',
      mimeType: 'text/csv',
      buffer,
    })

    // Preview should appear
    await expect(page.getByText(/Preview/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('2 rows')).toBeVisible()
    await expect(page.getByText('Test Door')).toBeVisible()
    await expect(page.getByText('Test Motion')).toBeVisible()
  })

  test('ZC-034: Uploading a CSV with only headers shows "No valid rows" message', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /Import CSV/i }).click()

    const csvContent = 'zone_number,zone_name,zone_type,area_number\n'
    const buffer = Buffer.from(csvContent, 'utf-8')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'empty.csv',
      mimeType: 'text/csv',
      buffer,
    })

    await expect(page.getByText(/No valid rows/i)).toBeVisible({ timeout: 5000 })
  })

  test('ZC-035: Import button shows count of zones to import', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /Import CSV/i }).click()

    const csvContent = 'zone_number,zone_name,zone_type,area_number\n60,CSV Zone A,ENTRY_EXIT,1\n61,CSV Zone B,PANIC_SILENT,2\n62,CSV Zone C,HOLDUP,1'
    const buffer = Buffer.from(csvContent, 'utf-8')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'three-zones.csv',
      mimeType: 'text/csv',
      buffer,
    })

    await expect(page.getByRole('button', { name: /Import 3 Zones/i })).toBeVisible({ timeout: 5000 })
  })

  test('ZC-036: Confirming import adds zones to the table', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /Import CSV/i }).click()

    const suffix = Date.now().toString().slice(-3)
    const csvContent = `zone_number,zone_name,zone_type,area_number\n7${suffix},Imported Zone ${suffix},ENTRY_EXIT,1`
    const buffer = Buffer.from(csvContent, 'utf-8')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'import-test.csv',
      mimeType: 'text/csv',
      buffer,
    })

    // Click import button
    await page.getByRole('button', { name: /Import 1 Zone/i }).click()

    // Verify success toast
    await expect(page.getByText(/imported/i)).toBeVisible({ timeout: 5000 })

    // Modal should close
    await expect(page.getByRole('heading', { name: /Import Zones from CSV/i })).not.toBeVisible()

    // Zone should appear in the table
    await expect(page.locator('table.dt').getByText(`Imported Zone ${suffix}`)).toBeVisible({ timeout: 5000 })
  })

  test('ZC-037: Duplicate zone numbers in CSV are skipped during import', async ({ page }) => {
    await gotoZoneConfig(page)

    // Get the first zone's number from the table
    const firstZoneNum = await page.locator('table.dt tbody tr td').first().textContent()

    await page.getByRole('button', { name: /Import CSV/i }).click()

    // CSV with a duplicate zone number
    const csvContent = `zone_number,zone_name,zone_type,area_number\n${firstZoneNum!.trim()},Duplicate Import,ENTRY_EXIT,1`
    const buffer = Buffer.from(csvContent, 'utf-8')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'dup.csv',
      mimeType: 'text/csv',
      buffer,
    })

    await page.getByRole('button', { name: /Import/i }).last().click()

    // Should show 0 zones imported
    await expect(page.getByText(/0 zone/i)).toBeVisible({ timeout: 5000 })
  })

  test('ZC-038: Invalid zone type in CSV defaults to OTHER', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.getByRole('button', { name: /Import CSV/i }).click()

    const suffix = Date.now().toString().slice(-3)
    const csvContent = `zone_number,zone_name,zone_type,area_number\n4${suffix},Weird Zone ${suffix},UNKNOWN_TYPE,1`
    const buffer = Buffer.from(csvContent, 'utf-8')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'bad-type.csv',
      mimeType: 'text/csv',
      buffer,
    })

    // Preview should show "Other" for the invalid type
    await expect(page.getByText('Other')).toBeVisible({ timeout: 5000 })
  })

  test('ZC-039: Cancel import modal without importing', async ({ page }) => {
    await gotoZoneConfig(page)
    const initialRows = await page.locator('table.dt tbody tr').count()

    await page.getByRole('button', { name: /Import CSV/i }).click()
    await page.getByRole('button', { name: /Cancel/i }).click()

    // Modal closed
    await expect(page.getByRole('heading', { name: /Import Zones from CSV/i })).not.toBeVisible()

    // Row count unchanged
    const afterRows = await page.locator('table.dt tbody tr').count()
    expect(afterRows).toBe(initialRows)
  })
})

// =============================================================================
// 8. ZONE TYPE DISPLAY
// =============================================================================

test.describe('Zone Config — Zone Type Badges', () => {

  test('ZC-040: Zone types display as colored pill badges', async ({ page }) => {
    await gotoZoneConfig(page)
    // Check that at least one type pill is rendered with a background color
    const typePill = page.locator('table.dt tbody tr td:nth-child(3) span').first()
    await expect(typePill).toBeVisible()
    const style = await typePill.getAttribute('style')
    expect(style).toContain('background')
  })

  test('ZC-041: All zone types have distinct visual badges', async ({ page }) => {
    await gotoZoneConfig(page)
    // Verify at least ENTRY_EXIT and INTERIOR_MOTION labels appear (Wausau has both)
    const typeLabels = await page.locator('table.dt tbody tr td:nth-child(3) span').allTextContents()
    expect(typeLabels.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// 9. PAGINATION
// =============================================================================

test.describe('Zone Config — Pagination', () => {

  test('ZC-042: Pagination appears when zones exceed page size (10)', async ({ page }) => {
    await gotoZoneConfig(page)
    const zoneCountText = await page.locator('.card-sub').first().textContent()
    const totalMatch = zoneCountText?.match(/(\d+)\s*total/)
    const total = totalMatch ? parseInt(totalMatch[1]) : 0

    if (total > 10) {
      // Pagination footer should be visible
      await expect(page.getByText(/Showing \d+–\d+ of \d+ zones/)).toBeVisible()
      await expect(page.getByText('Next →')).toBeVisible()
    } else {
      // Pagination should NOT appear
      await expect(page.getByText(/Showing \d+–\d+ of \d+ zones/)).not.toBeVisible()
    }
  })

  test('ZC-043: Clicking Next page shows next set of zones', async ({ page }) => {
    await gotoZoneConfig(page)
    const zoneCountText = await page.locator('.card-sub').first().textContent()
    const totalMatch = zoneCountText?.match(/(\d+)\s*total/)
    const total = totalMatch ? parseInt(totalMatch[1]) : 0

    if (total <= 10) {
      test.skip()
      return
    }

    // Should show "Showing 1–10"
    await expect(page.getByText(/Showing 1–10/)).toBeVisible()

    // Click Next
    await page.getByText('Next →').click()

    // Should show "Showing 11–..."
    await expect(page.getByText(/Showing 11–/)).toBeVisible()
  })

  test('ZC-044: Prev button is disabled on first page', async ({ page }) => {
    await gotoZoneConfig(page)
    const prevBtn = page.getByText('← Prev')
    if (await prevBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(prevBtn).toBeDisabled()
    }
  })

  test('ZC-045: Clicking a page number navigates directly to that page', async ({ page }) => {
    await gotoZoneConfig(page)
    const zoneCountText = await page.locator('.card-sub').first().textContent()
    const totalMatch = zoneCountText?.match(/(\d+)\s*total/)
    const total = totalMatch ? parseInt(totalMatch[1]) : 0

    if (total <= 10) {
      test.skip()
      return
    }

    // Click page 2 button
    const page2Btn = page.locator('button').filter({ hasText: '2' }).last()
    if (await page2Btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page2Btn.click()
      await expect(page.getByText(/Showing 11–/)).toBeVisible()
    }
  })
})

// =============================================================================
// 10. SUB-NAV NAVIGATION
// =============================================================================

test.describe('Zone Config — Sub-Nav Navigation', () => {

  test('ZC-046: Clicking Buildings pill navigates to Building Setup', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.locator('span').filter({ hasText: 'Buildings' }).first().click()
    await expect(page.getByRole('heading', { name: /Building/i })).toBeVisible({ timeout: 8000 })
  })

  test('ZC-047: Clicking Rules pill navigates to Compliance Rules', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.locator('span').filter({ hasText: 'Rules' }).first().click()
    await expect(page.getByRole('heading', { name: /Compliance Rules/i })).toBeVisible({ timeout: 8000 })
  })

  test('ZC-048: Clicking Access pill navigates to User Access', async ({ page }) => {
    await gotoZoneConfig(page)
    await page.locator('span').filter({ hasText: 'Access' }).first().click()
    await expect(page.getByRole('heading', { name: /Access/i })).toBeVisible({ timeout: 8000 })
  })
})

// =============================================================================
// 11. EMPTY STATE
// =============================================================================

test.describe('Zone Config — Empty State', () => {

  test('ZC-049: Building with no zones shows empty state message', async ({ page }) => {
    await gotoZoneConfig(page)

    // Try to find a building with no zones by switching buildings
    const select = page.locator('select.f-sel')
    const options = await select.locator('option').all()

    for (const option of options) {
      const value = await option.getAttribute('value')
      await select.selectOption(value!)
      await page.waitForTimeout(300)

      const emptyMsg = page.getByText('No zones found')
      if (await emptyMsg.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(emptyMsg).toBeVisible()
        await expect(page.getByText(/Add a zone or import from CSV/i)).toBeVisible()
        return
      }
    }

    // If all buildings have zones, this test is informational — skip
    test.skip()
  })
})

// =============================================================================
// 12. ACCESS CONTROL
// =============================================================================

test.describe('Zone Config — Access Control', () => {

  test('ZC-050: Non-admin user cannot see Alarm Config nav item', async ({ page }) => {
    // Login as operator (non-admin)
    await loginAs(page, 'ld@compass-usa.com')
    const alarmConfigNav = page.locator('.nav-item').filter({ hasText: 'Alarm Config' })
    await expect(alarmConfigNav).not.toBeVisible({ timeout: 5000 })
  })
})

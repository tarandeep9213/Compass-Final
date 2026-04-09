import { test, expect, Page } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Helper: login in demo/mock mode by blocking the real API
// ─────────────────────────────────────────────────────────────────────────────
async function loginAsDemoController(page: Page) {
  // Block ALL requests to the backend API so the app falls back to demo/mock mode
  await page.route('http://localhost:8006/**', route => route.abort())
  await page.route('http://localhost:8000/**', route => route.abort())
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('ccs_token')
    localStorage.removeItem('ccs_refresh_token')
  })
  await page.goto('/')
  await page.fill('input[type="email"]', 'terri.serrano@compass.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('.btn-login-submit')
  await page.waitForSelector('.sidebar', { timeout: 10000 })
}

async function clickAlarmTesting(page: Page) {
  await page.locator('.nav-item').filter({ hasText: 'Alarm Testing' }).click()
  await page.waitForSelector('.fade-up', { timeout: 8000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Alarm Test History — action buttons & status verification
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Alarm Test History — Monthly Tests tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoController(page)
    await clickAlarmTesting(page)
  })

  test('ALARM-HIST-001: Monthly tab is active by default with correct table columns', async ({ page }) => {
    const table = page.locator('table.dt').first()
    await expect(table).toBeVisible({ timeout: 8000 })
    await expect(table.locator('th').filter({ hasText: 'Actions' })).toBeVisible()
    await expect(table.locator('th').filter({ hasText: 'Status' })).toBeVisible()
    await expect(table.locator('th').filter({ hasText: 'Building' })).toBeVisible()
  })

  test('ALARM-HIST-002: DRAFT rows show "Continue" button', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Draft$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const firstRow = rows.first()
      await expect(firstRow.locator('button').filter({ hasText: 'Continue' })).toBeVisible()
      await expect(firstRow.locator('button').filter({ hasText: 'View' })).toHaveCount(0)
      await expect(firstRow.locator('button').filter({ hasText: 'Fix & Resubmit' })).toHaveCount(0)
    }
  })

  test('ALARM-HIST-003: SUBMITTED rows show "View" button', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Submitted$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const firstRow = rows.first()
      await expect(firstRow.locator('button').filter({ hasText: 'View' })).toBeVisible()
      await expect(firstRow.locator('button').filter({ hasText: 'Continue' })).toHaveCount(0)
      await expect(firstRow.locator('button').filter({ hasText: 'Fix & Resubmit' })).toHaveCount(0)
    }
  })

  test('ALARM-HIST-004: REJECTED rows show "Fix & Resubmit" button', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Rejected$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const firstRow = rows.first()
      await expect(firstRow.locator('button').filter({ hasText: 'Fix & Resubmit' })).toBeVisible()
      await expect(firstRow.locator('button').filter({ hasText: 'View' })).toHaveCount(0)
      await expect(firstRow.locator('button').filter({ hasText: 'Continue' })).toHaveCount(0)
    }
  })

  test('ALARM-HIST-005: APPROVED rows show "View" button', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Approved$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      await expect(rows.first().locator('button').filter({ hasText: 'View' })).toBeVisible()
    }
  })

  test('ALARM-HIST-006: "Fix & Resubmit" navigates to alarm-test-form', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Rejected$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      await rows.first().locator('button').filter({ hasText: 'Fix & Resubmit' }).click()
      await expect(page.locator('h2').filter({ hasText: 'Monthly Alarm Test' })).toBeVisible({ timeout: 5000 })
    }
  })

  test('ALARM-HIST-007: "Continue" navigates to alarm-test-form', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Draft$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      await rows.first().locator('button').filter({ hasText: 'Continue' }).click()
      await expect(page.locator('h2').filter({ hasText: 'Monthly Alarm Test' })).toBeVisible({ timeout: 5000 })
    }
  })

  test('ALARM-HIST-008: KPI cards are visible', async ({ page }) => {
    await expect(page.locator('.kpi-card').filter({ hasText: 'Tests This Year' })).toBeVisible()
    await expect(page.locator('.kpi-card').filter({ hasText: 'Pending Review' })).toBeVisible()
    await expect(page.locator('.kpi-card').filter({ hasText: 'Rejected' })).toBeVisible()
    await expect(page.locator('.kpi-card').filter({ hasText: 'Approved' })).toBeVisible()
  })

  test('ALARM-HIST-009: Status filter pills work correctly', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Rejected$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator('.badge-red')).toBeVisible()
    }
  })

  test('ALARM-HIST-010: Pagination info is visible', async ({ page }) => {
    await expect(page.locator('text=Showing')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Alarm Test History — Biannual Checks tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoController(page)
    await clickAlarmTesting(page)
    await page.locator('button').filter({ hasText: 'Biannual Checks' }).click()
    await page.waitForTimeout(500)
  })

  test('ALARM-BI-001: Biannual tab has correct columns including Actions', async ({ page }) => {
    const table = page.locator('table.dt').first()
    await expect(table).toBeVisible({ timeout: 8000 })
    await expect(table.locator('th').filter({ hasText: 'Actions' })).toBeVisible()
    await expect(table.locator('th').filter({ hasText: 'Status' })).toBeVisible()
    await expect(table.locator('th').filter({ hasText: 'Result' })).toBeVisible()
    await expect(table.locator('th').filter({ hasText: 'Type' })).toBeVisible()
  })

  test('ALARM-BI-002: SUBMITTED rows show "View" button', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Submitted$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const firstRow = rows.first()
      await expect(firstRow.locator('button').filter({ hasText: 'View' })).toBeVisible()
      await expect(firstRow.locator('button').filter({ hasText: 'Continue' })).toHaveCount(0)
      await expect(firstRow.locator('button').filter({ hasText: 'Fix & Resubmit' })).toHaveCount(0)
    }
  })

  test('ALARM-BI-003: DRAFT rows show "Continue" button', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Draft$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const firstRow = rows.first()
      await expect(firstRow.locator('button').filter({ hasText: 'Continue' })).toBeVisible()
      await expect(firstRow.locator('button').filter({ hasText: 'View' })).toHaveCount(0)
      await expect(firstRow.locator('button').filter({ hasText: 'Fix & Resubmit' })).toHaveCount(0)
    }
  })

  test('ALARM-BI-004: REJECTED rows show "Fix & Resubmit" button', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Rejected$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const firstRow = rows.first()
      await expect(firstRow.locator('button').filter({ hasText: 'Fix & Resubmit' })).toBeVisible()
      await expect(firstRow.locator('button').filter({ hasText: 'View' })).toHaveCount(0)
      await expect(firstRow.locator('button').filter({ hasText: 'Continue' })).toHaveCount(0)
    }
  })

  test('ALARM-BI-005: APPROVED rows show "View" button', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Approved$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      await expect(rows.first().locator('button').filter({ hasText: 'View' })).toBeVisible()
    }
  })

  test('ALARM-BI-006: All status filter pills are present', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: /^All$/ })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /^Draft$/ })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /^Submitted$/ })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /^Approved$/ })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /^Rejected$/ })).toBeVisible()
  })

  test('ALARM-BI-007: KPI cards show Pending Review and Rejected', async ({ page }) => {
    await expect(page.locator('.kpi-card').filter({ hasText: 'Pending Review' })).toBeVisible()
    await expect(page.locator('.kpi-card').filter({ hasText: 'Rejected' })).toBeVisible()
    await expect(page.locator('.kpi-card').filter({ hasText: 'Total Checks' })).toBeVisible()
  })

  test('ALARM-BI-008: Rows have AlarmStatusBadge with bdot', async ({ page }) => {
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      await expect(rows.first().locator('.badge .bdot')).toBeVisible()
    }
  })

  test('ALARM-BI-009: "Continue" navigates to biannual-check page', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Draft$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      await rows.first().locator('button').filter({ hasText: 'Continue' }).click()
      await expect(page.locator('h2').filter({ hasText: /Biannual/i })).toBeVisible({ timeout: 5000 })
    }
  })

  test('ALARM-BI-010: "Fix & Resubmit" navigates to biannual-check page', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Rejected$/ }).click()
    await page.waitForTimeout(500)
    const table = page.locator('table.dt').first()
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      await rows.first().locator('button').filter({ hasText: 'Fix & Resubmit' }).click()
      await expect(page.locator('h2').filter({ hasText: /Biannual/i })).toBeVisible({ timeout: 5000 })
    }
  })

  test('ALARM-BI-011: Table rows are visible', async ({ page }) => {
    const rows = page.locator('table.dt tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 5000 })
  })
})

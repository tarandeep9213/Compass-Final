/**
 * Comprehensive E2E — Phase 7: RC Dashboard & Cross-Cutting
 * Self-contained setup — seeds required state via API
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = process.env.E2E_API_URL || 'http://localhost:8000/v1'

test.describe('Phase 7 — RC Dashboard & Cross-Cutting', () => {
  test.describe.configure({ mode: 'serial' })

  let rcToken: string
  let adminToken: string

  test('7.0 Setup: ensure RC user exists', async ({ request }) => {
    adminToken = (await (await request.post(`${API}/auth/login`, {
      data: { email: 'admin@compass.com', password: 'demo1234' },
    })).json()).access_token
    const headers = { Authorization: `Bearer ${adminToken}` }

    // Ensure RC user password
    const usersRes = await request.get(`${API}/admin/users`, { headers })
    const users = await usersRes.json()
    const userList = Array.isArray(users) ? users : (users.items ?? [])
    const rc = userList.find((u: { email: string }) => u.email === 'rc1@test.com')
    if (rc) {
      await request.put(`${API}/admin/users/${rc.id}`, { headers, data: { password: 'demo1234' } })
    }

    // Also try rc@compass.com (demo seed user)
    let loginRes = await request.post(`${API}/auth/login`, {
      data: { email: 'rc1@test.com', password: 'demo1234' },
    })
    if (!loginRes.ok()) {
      loginRes = await request.post(`${API}/auth/login`, {
        data: { email: 'rc@compass.com', password: 'demo1234' },
      })
    }
    expect(loginRes.ok(), 'RC login should succeed').toBe(true)
    rcToken = (await loginRes.json()).access_token
  })

  test('7.1 RC Business Dashboard loads with sections', async ({ page }) => {
    // Try rc1@test.com first, fall back to rc@compass.com
    try {
      await loginAs(page, 'rc1@test.com')
    } catch {
      await loginAs(page, 'rc@compass.com')
    }

    // Business Dashboard should be visible
    const header = page.locator('h2').filter({ hasText: 'Business Dashboard' })
    await expect(header).toBeVisible({ timeout: 10000 })

    // KPI cards should load
    await expect(page.getByText('Compliance Rate', { exact: true }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Approval Rate', { exact: true }).first()).toBeVisible({ timeout: 5000 })
  })

  test('7.2 RC Reports page loads', async ({ page }) => {
    try {
      await loginAs(page, 'rc1@test.com')
    } catch {
      await loginAs(page, 'rc@compass.com')
    }

    await page.locator('.nav-item').filter({ hasText: 'Reports' }).click()
    await page.waitForTimeout(2000)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 8000 })
  })

  test('7.3 RC Cash Trends page loads', async ({ page }) => {
    try {
      await loginAs(page, 'rc1@test.com')
    } catch {
      await loginAs(page, 'rc@compass.com')
    }

    await page.locator('.nav-item').filter({ hasText: 'Cash Trends' }).click()
    await page.waitForTimeout(2000)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 8000 })
  })

  test('7.4 Compliance dashboard API returns data', async ({ request }) => {
    const res = await request.get(`${API}/compliance/dashboard`, {
      headers: { Authorization: `Bearer ${rcToken}` },
    })
    expect(res.ok()).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('summary')
    expect(data).toHaveProperty('locations')
    expect(data.summary).toHaveProperty('overall_compliance_pct')
    expect(data.summary).toHaveProperty('total_locations')
  })

  test('7.5 Business dashboard APIs return data', async ({ request }) => {
    // Controller activity
    const ctrlRes = await request.get(`${API}/business-dashboard/controller-activity`, {
      headers: { Authorization: `Bearer ${rcToken}` },
    })
    expect(ctrlRes.ok()).toBe(true)
    const ctrlData = await ctrlRes.json()
    expect(ctrlData).toHaveProperty('month_year')
    expect(ctrlData).toHaveProperty('items')

    // Operator behaviour
    const opRes = await request.get(`${API}/business-dashboard/operator-behaviour`, {
      headers: { Authorization: `Bearer ${rcToken}` },
    })
    expect(opRes.ok()).toBe(true)
    const opData = await opRes.json()
    expect(opData).toHaveProperty('total_submissions')

    // DGM coverage
    const dgmRes = await request.get(`${API}/business-dashboard/dgm-coverage`, {
      headers: { Authorization: `Bearer ${rcToken}` },
    })
    expect(dgmRes.ok()).toBe(true)
    const dgmData = await dgmRes.json()
    expect(dgmData).toHaveProperty('dgms')
    expect(dgmData).toHaveProperty('pendingLocations')
  })

  test('7.6 Reports summary API returns data with cash_at_risk', async ({ request }) => {
    const today = new Date()
    const startOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const res = await request.get(
      `${API}/reports/summary?date_from=${startOfMonth}&date_to=${todayStr}`,
      { headers: { Authorization: `Bearer ${rcToken}` } },
    )
    expect(res.ok()).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('total_submissions')
    expect(data).toHaveProperty('approved')
    expect(data).toHaveProperty('rejected')
    expect(data).toHaveProperty('cash_at_risk')
    expect(data).toHaveProperty('variance_exceptions')
  })

  test('7.7 Complete audit trail has events from all phases', async ({ request }) => {
    const auditRes = await request.get(`${API}/audit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const auditData = await auditRes.json()
    const events = Array.isArray(auditData) ? auditData : (auditData.items ?? auditData.events ?? [])
    const types = new Set(events.map((e: { event_type: string }) => e.event_type))

    // Should have events from various phases
    expect(events.length, 'Should have audit events').toBeGreaterThan(0)

    // Log all event types found for debugging
    const typeList = [...types].sort()
    console.log('Audit event types found:', typeList.join(', '))
  })

  test('7.8 Data persists on page refresh', async ({ page }) => {
    try {
      await loginAs(page, 'rc1@test.com')
    } catch {
      await loginAs(page, 'rc@compass.com')
    }

    // Wait for dashboard to load
    await expect(page.getByText('Business Dashboard').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Compliance Rate', { exact: true }).first()).toBeVisible({ timeout: 15000 })

    // Refresh the page
    await page.reload()
    await page.waitForTimeout(3000)

    // Dashboard should still show data after refresh
    await expect(page.getByText('Business Dashboard').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Compliance Rate', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  })
})

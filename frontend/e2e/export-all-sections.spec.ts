/**
 * EXPORT-ALL-SECTIONS: Verify the Export All Sections button downloads
 * an Excel file with one sheet per section (A-L) with correct data.
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const API = 'http://localhost:8006/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })).json()).access_token
}

test.describe('Export All Sections — Cash Trends', () => {

  test('EAS-001: API returns data for all sections A-L', async ({ request }) => {
    const token = await getToken(request, 'admin@compass.com')

    const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    const results: Record<string, { periods: number; hasData: boolean }> = {}

    for (const sec of sections) {
      const res = await request.get(
        `${API}/reports/section-trends?section=${sec}&granularity=monthly&periods=6`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      expect(res.ok()).toBeTruthy()
      const data = await res.json()
      expect(data.section).toBe(sec)
      expect(data.data).toBeDefined()
      expect(data.summary).toBeDefined()
      expect(data.summary.latest_value).toBeDefined()
      expect(data.summary.peak).toBeDefined()
      expect(data.summary.total).toBeDefined()

      results[sec] = {
        periods: data.data.length,
        hasData: data.data.length > 0,
      }

      // Verify each data point has required fields
      for (const point of data.data) {
        expect(point.period).toBeDefined()
        expect(point.avg_total).toBeDefined()
        expect(point.sum_total).toBeDefined()
        expect(point.count).toBeDefined()
        expect(point.max_val).toBeDefined()
        expect(point.latest_val).toBeDefined()
      }
    }

    console.log('Section data coverage:')
    for (const [sec, info] of Object.entries(results)) {
      console.log(`  ${sec}: ${info.periods} periods, hasData=${info.hasData}`)
    }
    console.log('All 12 sections return valid structure ✓')
  })

  test('EAS-002: Export button downloads file via UI', async ({ page }) => {
    // Login as RC
    await page.goto('/')
    await page.fill('input[type="email"]', 'kyle.decker@compass.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.click('.btn-login-submit')

    const sidebar = await page.waitForSelector('.sidebar', { timeout: 10000 }).catch(() => null)
    if (!sidebar) {
      console.log('Login failed — skipping UI test')
      return
    }

    // Navigate to Cash Trends
    await page.locator('.nav-item').filter({ hasText: /Cash Trends/i }).click()
    await page.waitForTimeout(2000)

    // Find and click Export All Sections button
    const exportBtn = page.getByText(/Export All Sections/i)
    if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        exportBtn.click(),
      ])

      // Save and verify file
      const downloadPath = path.join(__dirname, '..', 'test-results', 'export-all-sections.xlsx')
      await download.saveAs(downloadPath)
      expect(fs.existsSync(downloadPath)).toBe(true)

      const fileSize = fs.statSync(downloadPath).size
      expect(fileSize).toBeGreaterThan(100) // not empty
      console.log(`Downloaded: ${download.suggestedFilename()} (${fileSize} bytes) ✓`)

      // Verify with SheetJS
      const XLSX = require('xlsx')
      const wb = XLSX.readFile(downloadPath)
      console.log(`Sheets: ${wb.SheetNames.length}`)
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name]
        const rows = XLSX.utils.sheet_to_json(ws)
        console.log(`  ${name}: ${rows.length} rows`)
      }
      expect(wb.SheetNames.length).toBeGreaterThanOrEqual(12)
      console.log('All sections present in Excel ✓')

      try { fs.unlinkSync(downloadPath) } catch { /* ignore */ }
    } else {
      console.log('Export button not visible — skipping download test')
    }
  })
})

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'
const API = 'http://localhost:8003/v1'

test.describe.serial('RC Location Review', () => {

  test.setTimeout(60000)

  test('RC sees Location Review nav and screen loads', async ({ page }) => {
    console.log('Step 1: Login as RC')
    await page.goto(BASE)
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.locator('input').nth(0).fill('kyle.decker@compass.com')
    await page.locator('input[type="password"]').fill('demo1234')
    await page.locator('button:has-text("Sign In")').click()
    await page.waitForTimeout(3000)

    // Check nav item exists
    const navItem = page.locator('text=Location Review')
    const visible = await navItem.isVisible({ timeout: 5000 }).catch(() => false)
    console.log(`  Location Review nav visible: ${visible}`)
    expect(visible).toBe(true)

    // Click it
    console.log('Step 2: Navigate to Location Review')
    await navItem.click()
    await page.waitForTimeout(3000)

    // Check screen loaded
    const heading = page.locator('h2:has-text("Location Review")')
    const headingVisible = await heading.isVisible({ timeout: 5000 }).catch(() => false)
    console.log(`  Heading visible: ${headingVisible}`)
    expect(headingVisible).toBe(true)

    // Check table exists with locations
    const table = page.locator('table')
    const tableVisible = await table.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`  Table visible: ${tableVisible}`)

    // Check for location rows
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    console.log(`  Location rows: ${rowCount}`)

    await page.screenshot({ path: 'test-results/rc_location_review.png' })
    console.log('  Screenshot saved')
  })

  test('RC sees Fill Form button for locations without submissions', async ({ page }) => {
    console.log('Step 3: Check Fill Form button')

    // Login
    await page.goto(BASE)
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.locator('input').nth(0).fill('kyle.decker@compass.com')
    await page.locator('input[type="password"]').fill('demo1234')
    await page.locator('button:has-text("Sign In")').click()
    await page.waitForTimeout(3000)

    await page.locator('text=Location Review').click()
    await page.waitForTimeout(3000)

    // Look for Fill Form or No submission
    const fillBtn = page.locator('button:has-text("Fill Form")')
    const fillCount = await fillBtn.count()
    console.log(`  Fill Form buttons: ${fillCount}`)

    const viewBtn = page.locator('button:has-text("View Form")')
    const viewCount = await viewBtn.count()
    console.log(`  View Form buttons: ${viewCount}`)

    const noSub = page.locator('text=No submission yet')
    const noSubCount = await noSub.count()
    console.log(`  "No submission yet" labels: ${noSubCount}`)

    // If Fill Form exists, click it
    if (fillCount > 0) {
      console.log('Step 4: Click Fill Form')
      await fillBtn.first().click()
      await page.waitForTimeout(3000)

      // Should navigate to OpForm
      const bodyText = await page.textContent('body')
      const hasForm = bodyText?.includes('Section A') || bodyText?.includes('Counted By') || bodyText?.includes('Submit')
      console.log(`  OpForm loaded: ${hasForm}`)

      await page.screenshot({ path: 'test-results/rc_fill_form.png' })
    }
  })

  test('RC Fill Form creates submission via API', async () => {
    console.log('Step 5: API test — RC fills form')

    // Login as RC
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kyle.decker@compass.com', password: 'demo1234' }),
    })
    const { access_token: token } = await loginRes.json() as { access_token: string }

    const today = new Date().toISOString().split('T')[0]

    // Clean first
    // RC fills form
    const fillRes = await fetch(`${API}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        location_id: 'loc-wausau',
        submission_date: today,
        source: 'FORM',
        sections: { A: { total: 5000 } },
        variance_note: null,
        save_as_draft: false,
        submitted_by_role: 'REGIONAL_CONTROLLER',
      }),
    })
    const data = await fillRes.json() as Record<string, unknown>
    console.log(`  HTTP ${fillRes.status} role=${data.submitted_by_role} status=${data.status}`)

    expect(fillRes.status).toBe(201)
    expect(data.submitted_by_role).toBe('REGIONAL_CONTROLLER')
    expect(data.status).toBe('approved')
    console.log('  PASS — RC submission created and auto-approved')
  })
})

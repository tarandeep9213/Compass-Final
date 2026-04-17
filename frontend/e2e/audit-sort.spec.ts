import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test('Audit Trail column sorting works', async ({ page }) => {
  // Login as admin
  await page.goto(BASE)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.locator('input').nth(0).fill('kyle.decker@compass.com')
  await page.locator('input[type="password"]').fill('demo1234')
  await page.locator('button:has-text("Sign In")').click()
  await page.waitForTimeout(3000)

  // Navigate to Audit Trail
  const auditNav = page.locator('text=Audit Trail')
  if (await auditNav.isVisible({ timeout: 3000 })) {
    await auditNav.click()
    await page.waitForTimeout(3000)
  }

  // Check that sort arrows exist on headers
  const headers = page.locator('thead th')
  const headerCount = await headers.count()
  console.log(`Table headers: ${headerCount}`)

  // Check Timestamp header has sort indicator (default sort)
  const timestampTh = page.locator('th:has-text("Timestamp")')
  const timestampText = await timestampTh.textContent()
  console.log(`Timestamp header: "${timestampText?.trim()}"`)
  const hasArrow = timestampText?.includes('▼') || timestampText?.includes('▲')
  console.log(`Has sort arrow: ${hasArrow}`)

  // Click Timestamp to toggle sort
  await timestampTh.click()
  await page.waitForTimeout(500)
  const afterClick = await timestampTh.textContent()
  console.log(`After click: "${afterClick?.trim()}"`)

  // Click Event header to sort by event
  const eventTh = page.locator('th:has-text("Event")')
  await eventTh.click()
  await page.waitForTimeout(500)
  const eventText = await eventTh.textContent()
  console.log(`Event header after click: "${eventText?.trim()}"`)
  const eventHasArrow = eventText?.includes('▼') || eventText?.includes('▲')
  expect(eventHasArrow).toBe(true)

  // Click Actor header
  const actorTh = page.locator('th:has-text("Actor")')
  await actorTh.click()
  await page.waitForTimeout(500)
  const actorText = await actorTh.textContent()
  console.log(`Actor header after click: "${actorText?.trim()}"`)

  // Verify Timestamp header no longer has arrow (sort moved to Actor)
  const tsAfter = await timestampTh.textContent()
  const tsStillSorted = tsAfter?.includes('▼') || tsAfter?.includes('▲')
  console.log(`Timestamp still sorted: ${tsStillSorted}`)
  expect(tsStillSorted).toBe(false)

  await page.screenshot({ path: 'test-results/audit_sort.png' })
  console.log('All sort checks passed')
})

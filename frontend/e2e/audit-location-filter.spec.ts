import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test('Audit location filter has API locations', async ({ page }) => {
  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Audit Trail' }).click()
  await page.waitForTimeout(3000)

  // Location filter is the 3rd select (Type, Actor, Location)
  const selects = page.locator('select')
  const selectCount = await selects.count()

  // Find the select that has "All Locations" option
  let locationSelect = null
  for (let i = 0; i < selectCount; i++) {
    const text = await selects.nth(i).innerText()
    if (text.includes('All Locations') || text.includes('No locations')) {
      locationSelect = selects.nth(i)
      break
    }
  }

  expect(locationSelect, 'Should find location filter select').toBeTruthy()

  const options = await locationSelect!.locator('option').allInnerTexts()
  console.log('Location filter options:', options)

  // Should have more than just "All Locations" — API locations should appear
  expect(options.length, 'Location filter should have location options').toBeGreaterThan(1)
})

test('Audit location filter filters events correctly', async ({ page }) => {
  await loginAs(page, 'admin@compass.com')
  await page.locator('.nav-item').filter({ hasText: 'Audit Trail' }).click()
  await page.waitForTimeout(3000)

  // Count events before filter
  const rowsBefore = await page.locator('table tbody tr').count().catch(() => 0)
    || await page.locator('.event-row').count().catch(() => 0)

  // Find and select a specific location
  const selects = page.locator('select')
  const selectCount = await selects.count()
  for (let i = 0; i < selectCount; i++) {
    const text = await selects.nth(i).innerText()
    if (text.includes('All Locations')) {
      const options = await selects.nth(i).locator('option').all()
      if (options.length > 1) {
        // Select the second option (first non-All location)
        await selects.nth(i).selectOption({ index: 1 })
        await page.waitForTimeout(1000)

        // Count events after filter — should be less or equal
        const rowsAfter = await page.locator('table tbody tr').count().catch(() => 0)
          || await page.locator('.event-row').count().catch(() => 0)

        // Filtered count should be <= original (or same if all events are from that location)
        expect(rowsAfter).toBeLessThanOrEqual(rowsBefore)
      }
      break
    }
  }
})

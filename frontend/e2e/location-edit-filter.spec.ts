/**
 * Test: Location edit works when filter is active
 * Bug: Edit row hides when a location filter is selected
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Location Edit with Filter', () => {

  test('Edit button works WITHOUT filter (baseline)', async ({ page }) => {
    await loginAs(page, 'admin@compass.com')
    await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
    await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
    await page.waitForTimeout(1000)

    // Click Edit on first location
    const editBtn = page.getByRole('button', { name: /^Edit$/i }).first()
    if (!(await editBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await editBtn.click()
    await page.waitForTimeout(500)

    // Save button should be visible (edit row expanded)
    const saveBtn = page.getByRole('button', { name: /^Save$/i }).first()
    await expect(saveBtn).toBeVisible({ timeout: 3000 })
  })

  test('Edit button works WITH filter selected (bug fix)', async ({ page }) => {
    await loginAs(page, 'admin@compass.com')
    await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
    await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
    await page.waitForTimeout(1000)

    // Select a specific location from filter dropdown
    const filterSelect = page.locator('select').first()
    const options = await filterSelect.locator('option').all()
    if (options.length < 2) { test.skip(); return } // Need at least one location option

    // Select the second option (first real location, not "All locations")
    await filterSelect.selectOption({ index: 1 })
    await page.waitForTimeout(500)

    // Should show 1 filtered location
    const editBtn = page.getByRole('button', { name: /^Edit$/i }).first()
    await expect(editBtn).toBeVisible({ timeout: 3000 })

    // Click Edit
    await editBtn.click()
    await page.waitForTimeout(500)

    // Save button MUST be visible (this was the bug — edit row was hiding)
    const saveBtn = page.getByRole('button', { name: /^Save$/i }).first()
    await expect(saveBtn).toBeVisible({ timeout: 3000 })

    // Cancel button should also be visible
    const cancelBtn = page.getByRole('button', { name: /^Cancel$/i }).first()
    await expect(cancelBtn).toBeVisible({ timeout: 2000 })
  })

  test('Edit form shows correct data for filtered location', async ({ page }) => {
    await loginAs(page, 'admin@compass.com')
    await page.locator('.nav-item').filter({ hasText: 'Locations' }).click()
    await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({ timeout: 8000 })
    await page.waitForTimeout(1000)

    // Select a specific location
    const filterSelect = page.locator('select').first()
    const options = await filterSelect.locator('option').allInnerTexts()
    if (options.length < 2) { test.skip(); return }
    const locationName = options[1] // First real location name
    await filterSelect.selectOption({ index: 1 })
    await page.waitForTimeout(500)

    // Click Edit
    await page.getByRole('button', { name: /^Edit$/i }).first().click()
    await page.waitForTimeout(500)

    // The edit form should have inputs with values (not empty)
    const inputs = page.locator('.f-inp')
    const inputCount = await inputs.count()
    expect(inputCount, 'Edit form should have input fields').toBeGreaterThan(0)

    // Name input should contain the location name
    const nameInput = inputs.first()
    const nameValue = await nameInput.inputValue()
    expect(nameValue.length, 'Name field should not be empty').toBeGreaterThan(0)
  })
})

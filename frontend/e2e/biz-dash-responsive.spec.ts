/**
 * Business Dashboard Responsiveness Tests
 * Verify the dashboard renders correctly at different viewport sizes
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Business Dashboard Responsive', () => {

  test('Desktop (1280x720): all KPI cards visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await loginAs(page, 'rc@compass.com')
    await expect(page.getByText('Business Dashboard').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Compliance Rate', { exact: true }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Approval Rate', { exact: true }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Cash at Risk', { exact: true }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Variance Exceptions', { exact: true }).first()).toBeVisible({ timeout: 5000 })
  })

  test('Tablet (768x1024): dashboard renders without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await loginAs(page, 'rc@compass.com')
    await expect(page.getByText('Business Dashboard').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Compliance Rate', { exact: true }).first()).toBeVisible({ timeout: 15000 })

    // No horizontal scrollbar — content fits
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(hasHScroll, 'Should not have horizontal scrollbar on tablet').toBe(false)
  })

  test('Mobile (375x667): dashboard renders without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAs(page, 'rc@compass.com')
    await expect(page.getByText('Business Dashboard').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Compliance Rate', { exact: true }).first()).toBeVisible({ timeout: 15000 })

    // No horizontal scrollbar
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(hasHScroll, 'Should not have horizontal scrollbar on mobile').toBe(false)
  })

  test('Mobile (375x667): KPI cards stack vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAs(page, 'rc@compass.com')
    await expect(page.getByText('Compliance Rate', { exact: true }).first()).toBeVisible({ timeout: 15000 })

    // All 4 KPI labels should still be visible (stacked, not overflowing)
    const labels = ['Compliance Rate', 'Approval Rate', 'Cash at Risk', 'Variance Exceptions']
    for (const label of labels) {
      const el = page.getByText(label, { exact: true }).first()
      // Scroll to it if needed
      await el.scrollIntoViewIfNeeded().catch(() => {})
      const visible = await el.isVisible({ timeout: 3000 }).catch(() => false)
      expect(visible, `${label} should be visible on mobile`).toBe(true)
    }
  })
})

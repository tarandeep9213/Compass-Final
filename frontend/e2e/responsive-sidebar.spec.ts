import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test('RESP-001: mobile sidebar hidden by default, hamburger toggles it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await loginAs(page, 'rc@compass.com')
  await page.waitForTimeout(1500)

  // Sidebar should be off-screen (hidden)
  const sidebar = page.locator('.sidebar')
  const sidebarBox = await sidebar.boundingBox()
  console.log('Sidebar position:', sidebarBox?.x)
  expect(sidebarBox!.x).toBeLessThan(0) // off-screen left

  // Hamburger should be visible
  const hamburger = page.locator('.hamburger-btn')
  await expect(hamburger).toBeVisible()

  // Click hamburger — sidebar slides in
  await hamburger.click()
  await page.waitForTimeout(500)
  const sidebarBox2 = await sidebar.boundingBox()
  console.log('Sidebar after open:', sidebarBox2?.x)
  expect(sidebarBox2!.x).toBeGreaterThanOrEqual(0)

  // Overlay should be visible
  await expect(page.locator('.sidebar-overlay')).toBeVisible()

  // Click hamburger again (now shows ✕) — sidebar closes
  await hamburger.click()
  await page.waitForTimeout(500)
  const sidebarBox3 = await sidebar.boundingBox()
  console.log('Sidebar after close:', sidebarBox3?.x)
  expect(sidebarBox3!.x).toBeLessThan(0)

  await page.screenshot({ path: 'resp-mobile-fixed.png' })
})

test('RESP-002: desktop sidebar always visible, no hamburger', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await loginAs(page, 'rc@compass.com')
  await page.waitForTimeout(1500)

  // Sidebar should be visible
  const sidebarBox = await page.locator('.sidebar').boundingBox()
  expect(sidebarBox!.x).toBeGreaterThanOrEqual(0)

  // Hamburger should be hidden
  const hamburger = page.locator('.hamburger-btn')
  await expect(hamburger).not.toBeVisible()
})

test('RESP-003: mobile nav click closes sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await loginAs(page, 'rc@compass.com')
  await page.waitForTimeout(1500)

  // Open sidebar
  await page.locator('.hamburger-btn').click()
  await page.waitForTimeout(300)

  // Click a nav item
  await page.locator('.nav-item').first().click()
  await page.waitForTimeout(500)

  // Sidebar should close
  const sidebarBox = await page.locator('.sidebar').boundingBox()
  expect(sidebarBox!.x).toBeLessThan(0)
})

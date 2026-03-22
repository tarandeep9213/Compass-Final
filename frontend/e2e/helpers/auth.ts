import { Page } from '@playwright/test'

export async function loginAs(page: Page, email: string, password = 'demo1234') {
  // Clear any existing auth tokens so re-login always works
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('ccs_token')
    localStorage.removeItem('ccs_refresh_token')
  })
  await page.goto('/')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('.btn-login-submit')
  await page.waitForSelector('.sidebar', { timeout: 10000 })
}

export async function clickNav(page: Page, label: string) {
  await page.locator('.nav-item').filter({ hasText: label }).click()
  await page.waitForSelector('.fade-up', { timeout: 8000 })
}

export async function loginAsOperator(page: Page) {
  return loginAs(page, 'ld@compass-usa.com')
}

export async function loginAsController(page: Page) {
  return loginAs(page, 'terri.serrano@compass.com')
}

export async function loginAsAdmin(page: Page) {
  return loginAs(page, 'admin@compass.com')
}

export async function loginAsDgm(page: Page) {
  return loginAs(page, 'john.ranallo@compass.com')
}

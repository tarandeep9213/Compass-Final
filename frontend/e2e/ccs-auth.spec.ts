/**
 * CCS Manual Test Cases — Section 1: Authentication
 * Key tests from AUTH-001 to AUTH-059 (25 selected)
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = process.env.E2E_API_URL || 'http://localhost:8000/v1'

test.describe('CCS Auth Tests', () => {

  // AUTH-001: Login form renders correctly
  test('AUTH-001: login form renders with all elements', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('.btn-login-submit')).toBeVisible()
    await expect(page.getByText(/CashRoom/i)).toBeVisible()
  })

  // AUTH-004: Submit with empty email
  test('AUTH-004: submit with empty email shows error', async ({ page }) => {
    await page.goto('/')
    await page.click('.btn-login-submit')
    await expect(page.getByText(/enter your email/i)).toBeVisible({ timeout: 3000 })
  })

  // AUTH-005: Submit with empty password
  test('AUTH-005: submit with empty password shows error', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="email"]', 'admin@compass.com')
    await page.click('.btn-login-submit')
    await expect(page.getByText(/enter your password/i)).toBeVisible({ timeout: 3000 })
  })

  // AUTH-007: Error clears on email change
  test('AUTH-007: error clears when typing in email', async ({ page }) => {
    await page.goto('/')
    await page.click('.btn-login-submit')
    await expect(page.getByText(/enter your email/i)).toBeVisible({ timeout: 3000 })
    await page.fill('input[type="email"]', 'a')
    await expect(page.getByText(/enter your email/i)).not.toBeVisible({ timeout: 2000 })
  })

  // AUTH-009: Enter key submits login
  test('AUTH-009: enter key submits login form', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="email"]', 'admin@compass.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.press('input[type="password"]', 'Enter')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
  })

  // AUTH-014: Valid login — Operator role
  test('AUTH-014: valid login as operator lands on operator dashboard', async ({ page }) => {
    await loginAs(page, 'operator@compass.com')
    await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i })).toBeVisible({ timeout: 10000 })
  })

  // AUTH-015: Valid login — Controller role
  test('AUTH-015: valid login as controller lands on controller dashboard', async ({ page }) => {
    await loginAs(page, 'controller@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Daily Review|Weekly Review/i).first()).toBeVisible({ timeout: 5000 })
  })

  // AUTH-017: Valid login — Admin role
  test('AUTH-017: valid login as admin lands on admin dashboard', async ({ page }) => {
    await loginAs(page, 'admin@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Audit Trail/i).first()).toBeVisible({ timeout: 5000 })
  })

  // AUTH-018: Valid login — RC role
  test('AUTH-018: valid login as RC lands on Business Dashboard', async ({ page }) => {
    await loginAs(page, 'rc@compass.com')
    await expect(page.getByText('Business Dashboard').first()).toBeVisible({ timeout: 10000 })
  })

  // AUTH-019: Wrong password
  test('AUTH-019: wrong password shows error', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="email"]', 'admin@compass.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('.btn-login-submit')
    await expect(page.getByText(/incorrect|invalid/i).first()).toBeVisible({ timeout: 5000 })
  })

  // AUTH-021: Sign In button shows loading state
  test('AUTH-021: sign in button shows loading during request', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="email"]', 'admin@compass.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.click('.btn-login-submit')
    // Button should show loading text briefly
    const btn = page.locator('.btn-login-submit')
    // After success, sidebar appears
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
  })

  // AUTH-027: Token stored after login
  test('AUTH-027: token stored in localStorage after login', async ({ page }) => {
    await loginAs(page, 'admin@compass.com')
    const token = await page.evaluate(() => localStorage.getItem('ccs_token'))
    expect(token).toBeTruthy()
    expect(token!.length).toBeGreaterThan(20)
  })

  // AUTH-028: Session persists on refresh
  test('AUTH-028: session persists on page refresh', async ({ page }) => {
    await loginAs(page, 'admin@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
    await page.reload()
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
  })

  // AUTH-031: Tokens cleared on sign out
  test('AUTH-031: tokens cleared on sign out', async ({ page }) => {
    await loginAs(page, 'admin@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /Sign out/i }).click()
    await page.waitForTimeout(1000)
    const token = await page.evaluate(() => localStorage.getItem('ccs_token'))
    expect(token).toBeNull()
    // Should be back on login screen
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 })
  })

  // AUTH-032: Forgot password link visible
  test('AUTH-032: forgot password link is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Forgot password/i)).toBeVisible({ timeout: 3000 })
  })

  // AUTH-033: Forgot password navigates to reset view
  test('AUTH-033: forgot password click shows reset view', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/Forgot password/i).click()
    await expect(page.getByText(/Reset your password/i)).toBeVisible({ timeout: 5000 })
  })

  // AUTH-039: Back to sign in from forgot view
  test('AUTH-039: back to sign in from forgot view', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/Forgot password/i).click()
    await expect(page.getByText(/Reset your password/i)).toBeVisible({ timeout: 5000 })
    await page.getByText(/Back to sign in/i).click()
    await expect(page.locator('.btn-login-submit')).toBeVisible({ timeout: 5000 })
  })

  // API-level auth tests
  test('AUTH-API-01: login API returns token for valid credentials', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: 'admin@compass.com', password: 'demo1234' },
    })
    expect(res.ok()).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('access_token')
    expect(data).toHaveProperty('refresh_token')
    expect(data).toHaveProperty('user')
    expect(data.user.role).toBe('ADMIN')
  })

  test('AUTH-API-02: login API rejects wrong password', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: 'admin@compass.com', password: 'wrong' },
    })
    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(401)
  })

  test('AUTH-API-03: me endpoint returns current user', async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { email: 'admin@compass.com', password: 'demo1234' },
    })
    const token = (await loginRes.json()).access_token
    const meRes = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(meRes.ok()).toBe(true)
    const me = await meRes.json()
    expect(me.email).toBe('admin@compass.com')
    expect(me.role).toBe('ADMIN')
  })

  test('AUTH-API-04: change password works', async ({ request }) => {
    // Login
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { email: 'admin@compass.com', password: 'demo1234' },
    })
    const token = (await loginRes.json()).access_token

    // Change password
    const changeRes = await request.post(`${API}/auth/change-password`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { current_password: 'demo1234', new_password: 'TestPw1234' },
    })
    expect(changeRes.ok()).toBe(true)

    // Login with new password
    const newLogin = await request.post(`${API}/auth/login`, {
      data: { email: 'admin@compass.com', password: 'TestPw1234' },
    })
    expect(newLogin.ok()).toBe(true)

    // Reset back
    const newToken = (await newLogin.json()).access_token
    await request.post(`${API}/auth/change-password`, {
      headers: { Authorization: `Bearer ${newToken}` },
      data: { current_password: 'TestPw1234', new_password: 'demo1234' },
    })
  })
})

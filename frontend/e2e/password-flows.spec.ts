/**
 * PASSWORD-FLOW tests
 * Tests Change Password (logged-in) and Forgot Password (full OTP flow).
 *
 * Requires:
 *   - operator@compass.com with password demo1234
 *   - Backend running with DEBUG=true (for /auth/dev/last-otp)
 *   - Mailcatcher running on local SMTP
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = 'http://localhost:8001/v1'

async function getToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
  password: string,
): Promise<string | null> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password } })
  if (!res.ok()) return null
  return (await res.json()).access_token as string
}

// ─── CHANGE PASSWORD (logged-in) ────────────────────────────────────────────

test.describe('Change Password', () => {
  const EMAIL = 'operator@compass.com'
  const OLD_PW = 'demo1234'
  const NEW_PW = 'newpass5678'

  test('CP-001: change password modal opens, validates, and changes password successfully', async ({ page, request }) => {
    // Verify account exists
    const token = await getToken(request, EMAIL, OLD_PW)
    if (!token) { test.skip(true, 'operator account not found'); return }

    // Log in
    await loginAs(page, EMAIL)
    await expect(page.locator('.sidebar')).toBeVisible()

    // Click "Change Password" button in top bar
    await page.getByRole('button', { name: /Change Password/i }).click()

    // Modal should appear — heading is "Change Password"
    await expect(page.locator('text=Change Password').nth(1)).toBeVisible({ timeout: 3000 })

    // The modal has: Current Password, New Password, Confirm New Password fields
    const currentPwInput = page.locator('input[type="password"]').nth(0)
    const newPwInput = page.locator('input[type="password"]').nth(1)
    const confirmPwInput = page.locator('input[type="password"]').nth(2)
    const submitBtn = page.getByRole('button', { name: /Change Password/i }).last()

    // Test validation: new password too short
    await currentPwInput.fill(OLD_PW)
    await newPwInput.fill('short')
    await confirmPwInput.fill('short')
    await submitBtn.click()
    await expect(page.getByText(/at least 8/i)).toBeVisible({ timeout: 3000 })

    // Test validation: passwords don't match
    await newPwInput.fill(NEW_PW)
    await confirmPwInput.fill('differentpass')
    await submitBtn.click()
    await expect(page.getByText(/match/i)).toBeVisible({ timeout: 3000 })

    // Successfully change password
    await currentPwInput.fill(OLD_PW)
    await newPwInput.fill(NEW_PW)
    await confirmPwInput.fill(NEW_PW)
    await submitBtn.click()

    // Should show success or close modal
    await expect(
      page.getByText(/success/i).or(page.getByText(/changed/i)).or(page.getByText(/updated/i))
    ).toBeVisible({ timeout: 5000 })

    // Verify new password works via API
    const newToken = await getToken(request, EMAIL, NEW_PW)
    expect(newToken).toBeTruthy()

    // Old password should NOT work
    const oldToken = await getToken(request, EMAIL, OLD_PW)
    expect(oldToken).toBeNull()

    // Restore original password via API
    const restoreRes = await request.post(`${API}/auth/change-password`, {
      headers: { Authorization: `Bearer ${newToken}` },
      data: { current_password: NEW_PW, new_password: OLD_PW },
    })
    expect(restoreRes.ok()).toBeTruthy()
  })
})

// ─── FORGOT PASSWORD (full OTP flow) ────────────────────────────────────────

test.describe('Forgot Password', () => {
  const EMAIL = 'operator@compass.com'
  const OLD_PW = 'demo1234'
  const RESET_PW = 'resetpass9999'

  test('FP-001: full forgot password flow — request OTP, enter code, set new password, login', async ({ page, request }) => {
    // Verify account exists
    const token = await getToken(request, EMAIL, OLD_PW)
    if (!token) { test.skip(true, 'operator account not found'); return }

    // Go to login page
    await page.goto('/')
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // Click "Forgot password?"
    await page.getByText(/Forgot password/i).click()
    await expect(page.getByText(/Reset your password/i)).toBeVisible({ timeout: 3000 })

    // Enter email and submit
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.getByRole('button', { name: /Send.*Code|Reset|Submit/i }).click()

    // Should advance to OTP entry view
    await expect(page.getByText(/Check your email/i)).toBeVisible({ timeout: 8000 })

    // Wait for backend to finish processing and storing OTP
    await page.waitForTimeout(1000)

    // Fetch OTP from debug endpoint
    const otpRes = await request.get(`${API}/auth/dev/last-otp?email=${EMAIL}`)
    if (!otpRes.ok()) { test.skip(true, 'DEBUG OTP endpoint not available'); return }
    const { otp } = await otpRes.json() as { otp: string }
    expect(otp).toMatch(/^\d{6}$/)

    // Enter the OTP into the single 6-digit input
    const otpInput = page.locator('input[maxlength="6"]')
    await expect(otpInput).toBeVisible({ timeout: 3000 })
    await otpInput.fill(otp)

    // Submit OTP — button says "Continue →"
    await page.getByRole('button', { name: /Continue/i }).click()

    // Should advance to new password form
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 8000 })

    // Enter new password + confirm
    const pwInputs = page.locator('input[type="password"]')
    await pwInputs.first().fill(RESET_PW)
    if (await pwInputs.nth(1).isVisible().catch(() => false)) {
      await pwInputs.nth(1).fill(RESET_PW)
    }

    // Submit new password
    await page.getByRole('button', { name: /Reset|Submit|Update|Save|Set/i }).click()

    // Should show success message
    await expect(page.getByText(/Password reset successfully/i)).toBeVisible({ timeout: 8000 })

    // Verify new password works via API
    const newToken = await getToken(request, EMAIL, RESET_PW)
    expect(newToken).toBeTruthy()

    // Old password should NOT work
    const oldToken = await getToken(request, EMAIL, OLD_PW)
    expect(oldToken).toBeNull()

    // Restore original password
    const restoreRes = await request.post(`${API}/auth/change-password`, {
      headers: { Authorization: `Bearer ${newToken}` },
      data: { current_password: RESET_PW, new_password: OLD_PW },
    })
    expect(restoreRes.ok()).toBeTruthy()
  })

  test('FP-002: invalid OTP shows error', async ({ page, request }) => {
    await page.goto('/')
    await page.getByText(/Forgot password/i).click()
    await expect(page.getByText(/Reset your password/i)).toBeVisible({ timeout: 3000 })

    await page.locator('input[type="email"]').fill(EMAIL)
    await page.getByRole('button', { name: /Send.*Code|Reset|Submit/i }).click()

    // Wait for OTP view
    await expect(
      page.getByText(/verification code/i)
        .or(page.getByText(/enter.*code/i))
        .or(page.locator('input[maxlength="6"]'))
    ).toBeVisible({ timeout: 8000 })

    // Enter wrong OTP
    const singleInput = page.locator('input[maxlength="6"]')
    const digitInputs = page.locator('input[maxlength="1"]')

    if (await singleInput.isVisible().catch(() => false)) {
      await singleInput.fill('000000')
    } else if (await digitInputs.first().isVisible().catch(() => false)) {
      for (let i = 0; i < 6; i++) await digitInputs.nth(i).fill('0')
    } else {
      await page.locator('input[type="text"]').first().fill('000000')
    }

    await page.getByRole('button', { name: /Verify|Submit|Continue|Next/i }).click()

    // Should show error
    await expect(
      page.getByText(/invalid/i).or(page.getByText(/expired/i)).or(page.getByText(/incorrect/i))
    ).toBeVisible({ timeout: 5000 })
  })
})

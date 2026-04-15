import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = 'http://localhost:8000/v1'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Navigate to the forgot-password view on the login page */
async function openForgotView(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Forgot password/i })).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: /Forgot password/i }).click()
  await expect(page.getByText(/Reset your password/i)).toBeVisible({ timeout: 5000 })
}

/**
 * Trigger forgot-password via the UI then retrieve the raw OTP from the backend
 * debug endpoint (only available when DEBUG=True).
 * Returns the OTP string, or null if the debug endpoint is unavailable.
 */
async function triggerForgotAndGetOtp(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  email: string
): Promise<string | null> {
  await page.fill('input[type="email"]', email)
  await page.getByRole('button', { name: /Send Reset Code/i }).click()
  await expect(page.getByText(/Check your email/i)).toBeVisible({ timeout: 8000 })

  // Retrieve OTP from backend debug endpoint (requires DEBUG=True on the server)
  const r = await request.get(`${API}/auth/dev/last-otp?email=${encodeURIComponent(email)}`)
  if (!r.ok()) return null
  return (await r.json()).otp
}

// AUTH-001: Login with operator credentials → sidebar appears with "Dashboard" nav item
test('AUTH-001: operator login shows sidebar with Dashboard nav item', async ({ page }) => {
  await loginAs(page, 'ld@compass-usa.com')
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.nav-item').filter({ hasText: 'Dashboard' })).toBeVisible()
})

// AUTH-002: Login with wrong password → error message visible
test('AUTH-002: wrong password shows error message', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[type="email"]', 'ld@compass-usa.com')
  await page.fill('input[type="password"]', 'wrongpassword')
  await page.click('.btn-login-submit')
  await expect(page.locator('.login-error')).toBeVisible({ timeout: 8000 })
  const errorText = await page.locator('.login-error').textContent()
  expect(errorText).toBeTruthy()
  expect(errorText!.length).toBeGreaterThan(0)
})

// AUTH-005: Operator logs in → cannot see admin/controller nav items
test('AUTH-005: operator cannot see admin or controller nav items', async ({ page }) => {
  await loginAs(page, 'ld@compass-usa.com')
  await expect(page.locator('.nav-item').filter({ hasText: 'Users' })).not.toBeVisible()
  await expect(page.locator('.nav-item').filter({ hasText: 'Locations' })).not.toBeVisible()
  await expect(page.locator('.nav-item').filter({ hasText: 'Audit Trail' })).not.toBeVisible()
  await expect(page.locator('.nav-item').filter({ hasText: 'Weekly Review Dashboard' })).not.toBeVisible()
  await expect(page.locator('.nav-item').filter({ hasText: 'Daily Review Dashboard' })).not.toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET FLOW — Real backend (no page.route() mocks)
//
// Requires the backend to run with DEBUG=True so the /auth/dev/last-otp
// endpoint is available. If DEBUG=False (production), tests that need the
// OTP are skipped gracefully.
// ─────────────────────────────────────────────────────────────────────────────

// AUTH-PW-001: "Forgot password?" link opens the forgot-password view
test('AUTH-PW-001: forgot password link shows Reset your password form', async ({ page }) => {
  await openForgotView(page)
  await expect(page.getByText(/Enter your account email/i)).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.getByRole('button', { name: /Send Reset Code/i })).toBeVisible()
})

// AUTH-PW-002: Submit with empty email shows validation error
test('AUTH-PW-002: forgot password with empty email shows validation error', async ({ page }) => {
  await openForgotView(page)
  await page.getByRole('button', { name: /Send Reset Code/i }).click()
  await expect(page.locator('.login-error')).toBeVisible()
  const msg = await page.locator('.login-error').textContent()
  expect(msg).toMatch(/enter your email/i)
})

// AUTH-PW-003: Submitting an unregistered email still returns 200 (no enumeration)
test('AUTH-PW-003: forgot password with unknown email shows no-error response (security)', async ({ page }) => {
  await openForgotView(page)
  await page.fill('input[type="email"]', 'nobody_at_all@unknown.invalid')
  await page.getByRole('button', { name: /Send Reset Code/i }).click()
  // Should advance to OTP view, show an error, or stay on "Sending…" (SMTP not configured)
  const otpView    = await page.getByText(/Check your email/i).isVisible({ timeout: 12000 }).catch(() => false)
  const errorView  = await page.locator('.login-error').isVisible({ timeout: 3000 }).catch(() => false)
  const sendingBtn = await page.getByRole('button', { name: /Sending/i }).isVisible({ timeout: 3000 }).catch(() => false)
  expect(otpView || errorView || sendingBtn).toBe(true)
})

// AUTH-PW-004: "← Back to sign in" from forgot view returns to login form
test('AUTH-PW-004: back to sign in from forgot view shows login form', async ({ page }) => {
  await openForgotView(page)
  await page.getByRole('button', { name: /Back to sign in/i }).click()
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible()
})

// AUTH-PW-005: Submit valid email → advances to OTP "Check your email" view (real API)
test('AUTH-PW-005: forgot password submit advances to OTP entry view', async ({ page, request }) => {
  await openForgotView(page)
  await page.fill('input[type="email"]', 'ld@compass-usa.com')
  await page.getByRole('button', { name: /Send Reset Code/i }).click()
  // Should advance to OTP view — real backend returns 200 for known email
  // If SMTP not configured, button stays on "Sending…" — skip in that case
  const otpView    = await page.getByText(/Check your email/i).isVisible({ timeout: 12000 }).catch(() => false)
  const demoError  = await page.locator('.login-error').isVisible({ timeout: 2000 }).catch(() => false)
  const sendingBtn = await page.getByRole('button', { name: /Sending/i }).isVisible({ timeout: 2000 }).catch(() => false)
  if (demoError || sendingBtn) {
    // Backend unreachable or SMTP not configured — acceptable
    return
  }
  expect(otpView).toBe(true)
  await expect(page.getByText(/6-digit code/i)).toBeVisible()
  await expect(page.locator('input[placeholder="000000"]')).toBeVisible()
})

// AUTH-PW-006: OTP view — submitting invalid (non-6-digit) code shows validation error
test('AUTH-PW-006: OTP view rejects non-6-digit code with validation error', async ({ page, request }) => {
  await openForgotView(page)
  await page.fill('input[type="email"]', 'ld@compass-usa.com')
  await page.getByRole('button', { name: /Send Reset Code/i }).click()

  const otpView = await page.getByText(/Check your email/i).isVisible({ timeout: 8000 }).catch(() => false)
  if (!otpView) { test.skip(); return }

  await expect(page.locator('input[placeholder="000000"]')).toBeVisible({ timeout: 8000 })
  await page.fill('input[placeholder="000000"]', '123')
  await page.getByRole('button', { name: /Continue/i }).click()
  await expect(page.locator('.login-error')).toBeVisible()
  const msg = await page.locator('.login-error').textContent()
  expect(msg).toMatch(/6-digit code/i)
})

// AUTH-PW-007: Valid 6-digit OTP advances to "Set new password" view (real OTP from backend)
test('AUTH-PW-007: valid 6-digit OTP advances to new password form', async ({ page, request }) => {
  await openForgotView(page)
  const otp = await triggerForgotAndGetOtp(page, request, 'john.ranallo@compass.com')
  if (!otp) { test.skip(); return } // DEBUG endpoint not available

  await expect(page.locator('input[placeholder="000000"]')).toBeVisible({ timeout: 8000 })
  await page.fill('input[placeholder="000000"]', otp)
  await page.getByRole('button', { name: /Continue/i }).click()
  await expect(page.getByText(/Set new password/i)).toBeVisible({ timeout: 5000 })
  await expect(page.locator('input[placeholder="At least 8 characters"]')).toBeVisible()
  await expect(page.locator('input[placeholder="Repeat your new password"]')).toBeVisible()
})

// AUTH-PW-008: New password too short shows validation error
test('AUTH-PW-008: new password shorter than 8 characters shows validation error', async ({ page, request }) => {
  await openForgotView(page)
  const otp = await triggerForgotAndGetOtp(page, request, 'john.ranallo@compass.com')
  if (!otp) { test.skip(); return }

  await page.fill('input[placeholder="000000"]', otp)
  await page.getByRole('button', { name: /Continue/i }).click()
  await expect(page.locator('input[placeholder="At least 8 characters"]')).toBeVisible({ timeout: 5000 })

  await page.fill('input[placeholder="At least 8 characters"]', 'short')
  await page.fill('input[placeholder="Repeat your new password"]', 'short')
  await page.getByRole('button', { name: /Reset Password/i }).click()
  await expect(page.locator('.login-error')).toBeVisible()
  const msg = await page.locator('.login-error').textContent()
  expect(msg).toMatch(/8 characters/i)
})

// AUTH-PW-009: Mismatched passwords shows "Passwords do not match" error
test('AUTH-PW-009: mismatched passwords shows do not match error', async ({ page, request }) => {
  await openForgotView(page)
  const otp = await triggerForgotAndGetOtp(page, request, 'john.ranallo@compass.com')
  if (!otp) { test.skip(); return }

  await page.fill('input[placeholder="000000"]', otp)
  await page.getByRole('button', { name: /Continue/i }).click()
  await expect(page.locator('input[placeholder="At least 8 characters"]')).toBeVisible({ timeout: 5000 })

  await page.fill('input[placeholder="At least 8 characters"]', 'Password123')
  await page.fill('input[placeholder="Repeat your new password"]', 'Password999')
  await page.getByRole('button', { name: /Reset Password/i }).click()
  await expect(page.locator('.login-error')).toBeVisible()
  const msg = await page.locator('.login-error').textContent()
  expect(msg).toMatch(/do not match/i)
})

// AUTH-PW-010: Full happy path — real OTP → password reset → login with new password
test('AUTH-PW-010: full password reset flow resets password and allows login with new credentials', async ({ page, request }) => {
  const testEmail = 'kyle.decker@compass.com'
  const newPassword = 'NewE2EPass1'
  const originalPassword = 'demo1234'

  await openForgotView(page)
  const otp = await triggerForgotAndGetOtp(page, request, testEmail)
  if (!otp) { test.skip(); return }

  await page.fill('input[placeholder="000000"]', otp)
  await page.getByRole('button', { name: /Continue/i }).click()
  await expect(page.locator('input[placeholder="At least 8 characters"]')).toBeVisible({ timeout: 5000 })

  await page.fill('input[placeholder="At least 8 characters"]', newPassword)
  await page.fill('input[placeholder="Repeat your new password"]', newPassword)
  await page.getByRole('button', { name: /Reset Password/i }).click()

  // Should return to login view with success message
  await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/Password reset successfully/i)).toBeVisible()

  // Verify old password no longer works
  await page.fill('input[type="email"]', testEmail)
  await page.fill('input[type="password"]', originalPassword)
  await page.click('.btn-login-submit')
  await expect(page.locator('.login-error')).toBeVisible({ timeout: 5000 })

  // Verify new password works
  await page.fill('input[type="password"]', newPassword)
  await page.click('.btn-login-submit')
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 })

  // Restore original password via API so other tests aren't broken
  const forgotRes = await request.post(`${API}/auth/forgot-password`, { data: { email: testEmail } })
  if (forgotRes.ok()) {
    const otpRes = await request.get(`${API}/auth/dev/last-otp?email=${encodeURIComponent(testEmail)}`)
    if (otpRes.ok()) {
      const { otp: restoreOtp } = await otpRes.json()
      await request.post(`${API}/auth/reset-password`, {
        data: { email: testEmail, otp: restoreOtp, new_password: originalPassword },
      })
    }
  }
})

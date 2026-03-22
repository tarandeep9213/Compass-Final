import { test, expect } from '@playwright/test';

// Configuration for the test email account
const TEST_EMAIL = `testuser_${Date.now()}@yourdomain.com`;
const TEST_NAME = 'Playwright Tester';

test.describe('Email Communication Workflows', () => {

  test('Admin creates a new user and user receives welcome email', async ({ page }) => {
    // 1. Navigate to User Management
    await page.goto('/admin/users');
    await page.click('button:has-text("+ Add User")');

    // 2. Fill out the form
    await page.fill('input[name="name"]', TEST_NAME);
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.selectOption('select[name="role"]', 'operator');
    
    // 3. Save and trigger backend email
    await page.click('button:has-text("Save")');

    // 4. Verify UI Feedback
    await expect(page.locator('text=User "Playwright Tester" added')).toBeVisible();
    await expect(page.locator('text=An email with credentials has been sent')).toBeVisible();

    // 5. API Check: Verify email was actually sent/received
    // Note: In a real CI environment, you'd call your mail service API here
    /*
    const email = await fetchLatestEmail(TEST_EMAIL);
    expect(email.subject).toBe('CashRoom Login Credentials');
    expect(email.text).toContain('Temporary Password: demo1234');
    */
  });

  test('User requests a password reset email', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Forgot Password?');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button:has-text("Send Reset Link")');

    // Verify UI success state
    await expect(page.locator('text=Reset link sent to your email')).toBeVisible();
    
    /* const resetEmail = await fetchLatestEmail(TEST_EMAIL);
    expect(resetEmail.subject).toContain('Reset your password');
    expect(resetEmail.body).toContain('/reset-password?token=');
    */
  });

  test('User triggers a "Resend Code" for MFA/Verification', async ({ page }) => {
    // Assuming user is at the OTP verification screen
    await page.goto('/verify-otp');
    
    const resendBtn = page.locator('button:has-text("Resend Code")');
    await resendBtn.click();

    // Verify button goes into cooldown/loading state
    await expect(resendBtn).toBeDisabled();
    await expect(page.locator('text=New code sent')).toBeVisible();

    /*
    const otpEmail = await fetchLatestEmail(TEST_EMAIL);
    expect(otpEmail.body).toMatch(/\d{6}/); // Check for 6-digit code
    */
  });
});
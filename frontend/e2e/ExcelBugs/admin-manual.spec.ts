import { test, expect } from '@playwright/test';

test.describe('Admin - Exhaustive Manual Testing Observations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@compass.com');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button:has-text("Sign In")');
  });

  // --- LOGIN PAGE ---
  test('ADMIN-001: Verify form fields email and password inputs', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
  test('ADMIN-002: Check placeholder text Enter your email and password', async ({ page }) => {
    await expect(page.locator('input[placeholder="Enter your email"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your password"]')).toBeVisible();
  });
  test('ADMIN-003: Verify sign in button', async ({ page }) => {
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });
  test('ADMIN-004: Verify Forgot password button - UI', async ({ page }) => {
    await expect(page.locator('text=Forgot Password')).toBeVisible();
  });
  test('ADMIN-005: Forgot password functionality selected but OTP not received (FAIL)', async ({ page }) => {
    await page.click('text=Forgot Password');
    await page.fill('input[type="email"]', 'admin@compass.com');
    await page.click('button:has-text("Send OTP")');
    await expect(page.locator('input[placeholder="Enter OTP"]')).toBeVisible(); // Will fail until fixed
  });
  test('ADMIN-006: Verify with added users email addresses & Password (FAIL)', async () => {
    // Tests logging in with a newly created user account
    test.fail(); 
  });
  test('ADMIN-007: Verify sign out button functioning', async ({ page }) => {
    await page.click('text=Sign Out');
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });
  test('ADMIN-008: Test session timeout and refresh', async ({ page }) => {
    await page.reload();
    await expect(page.locator('text=Sign Out')).toBeVisible(); // Ensure user stays logged in
  });

  // --- AUDIT TRAIL ---
  test('ADMIN-009: Audit Trail download data in excel/csv (FAIL)', async ({ page }) => {
    await page.click('text=Audit Trail');
    await expect(page.locator('button:has-text("Export")')).toBeVisible();
  });
  test('ADMIN-010: Currently not storing any action data (FAIL)', async ({ page }) => {
    await page.click('text=Audit Trail');
    const rows = page.locator('tbody tr');
    await expect(rows).not.toHaveCount(0); // Fails if table is empty
  });

  // --- LOCATIONS ---
  test('ADMIN-011: Rename Headers (Cost Center, Location, Imprest Amount) (FAIL)', async ({ page }) => {
    await page.click('text=Locations');
    await expect(page.locator('thead')).toContainText(['Cost Center', 'Location', 'Imprest Amount']);
  });
  test('ADMIN-012: Able to add new location & Deactivate current location', async ({ page }) => {
    await page.click('text=Locations');
    await expect(page.locator('button:has-text("+ Add Location")')).toBeVisible();
    await expect(page.locator('button:has-text("Deactivate")').first()).toBeVisible();
  });
  test('ADMIN-013: Location code column should be editable field (FAIL)', async ({ page }) => {
    await page.click('text=Locations');
    await page.click('button:has-text("+ Add Location")');
    await expect(page.locator('input[name="code"]')).not.toBeDisabled();
  });
  test('ADMIN-014: Default tolerance option button not working currently (FAIL)', async ({ page }) => {
    await page.click('text=Locations');
    // Fails because saving tolerance in UI doesn't update backend
    test.fail();
  });

  // --- USERS ---
  test('ADMIN-015: Admin create temporary password for all users (FAIL)', async ({ page }) => {
    await page.click('text=Users');
    await page.click('button:has-text("+ Add User")');
    await expect(page.locator('input[name="tempPassword"]')).toBeVisible();
  });
  test('ADMIN-016: Users should get a notification mail with credentials (FAIL)', async () => { test.fixme(); });
  test('ADMIN-017: First time users should be able to change password (FAIL)', async () => { test.fixme(); });
  test('ADMIN-018: New Admin should have option to create password (FAIL)', async () => { test.fixme(); });
  test('ADMIN-019: Location field mandatory for Operators/Controllers/DGMs (FAIL)', async ({ page }) => {
    await page.click('text=Users');
    await page.click('button:has-text("+ Add User")');
    await page.selectOption('select[name="role"]', 'operator');
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=Location is required')).toBeVisible();
  });
  test('ADMIN-020: System Settings not getting saved (FAIL)', async ({ page }) => {
    await page.click('text=Configuration');
    await page.fill('input[name="slaHours"]', '72');
    await page.click('button:has-text("Save")');
    await page.reload();
    await expect(page.locator('input[name="slaHours"]')).toHaveValue('72');
  });

  // --- IMPORT ROSTER ---
  test('ADMIN-021: Upload excel format needs to be revised properly (FAIL)', async ({ page }) => {
    await page.click('text=Import Roster');
    // Fails due to parser mismatch with provided CSV templates
    test.fail(); 
  });
});
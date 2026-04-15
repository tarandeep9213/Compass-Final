import { test, expect } from '@playwright/test';

test.describe('Regional/Division Controller - Exhaustive Manual Testing Observations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'kyle.decker@compass.com');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button:has-text("Sign In")');
  });

  test('RC-001: Logged in user info visible & Sign out option', async ({ page }) => {
    await expect(page.locator('text=Kyle Decker')).toBeVisible();
    await expect(page.locator('text=Sign Out')).toBeVisible();
  });

  // --- COMPLIANCE DASHBOARD ---
  test('RC-002: Compliance Dashboard Tooltips reflect whole pop up (FAIL - UI Issue)', async ({ page }) => {
    await page.click('text=Compliance Dashboard');
    await page.hover('text=Overall Compliance');
    const tooltip = page.locator('.tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).not.toHaveCSS('overflow', 'hidden'); // Verifying UI fix
  });
  test('RC-003: Total Location count reflects admin config (FAIL - Mismatch)', async ({ page }) => {
    await page.click('text=Compliance Dashboard');
    await expect(page.locator('text=All Locations (4)')).toBeVisible(); // Kyle has 4 locations
  });
  test('RC-004: Date/period filter & Location dropdown available', async ({ page }) => {
    await page.click('text=Compliance Dashboard');
    await expect(page.locator('select[name="locationFilter"]')).toBeVisible();
    await expect(page.locator('button:has-text("Custom")')).toBeVisible();
  });

  // --- REPORTS ---
  test('RC-005: Reports Total Submission Tooltip UI issue (FAIL)', async ({ page }) => {
    await page.click('text=Reports');
    await page.hover('text=Total Submissions');
    await expect(page.locator('.tooltip')).toBeVisible();
  });
  test('RC-006: Reports Export to CSV/Excel', async ({ page }) => {
    await page.click('text=Reports');
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export CSV")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });

  // --- CASH TRENDS ---
  test('RC-007: Cash Trends Custom date selection missing (FAIL)', async ({ page }) => {
    await page.click('text=Cash Trends');
    await expect(page.locator('button:has-text("Custom Date")')).toBeVisible();
  });
  test('RC-008: Cash Trends Location Dropdown instead of tabs (PASS - Enhancement)', async ({ page }) => {
    await page.click('text=Cash Trends');
    await expect(page.locator('select[name="location"]')).toBeVisible();
  });
  test('RC-009: Cash Trends Categories I, J, K Need to be mapped (FAIL)', async ({ page }) => {
    await page.click('text=Cash Trends');
    const dropdown = page.locator('select[name="category"]');
    await expect(dropdown).toContainText('I. Net Unreimbursed Bill Changer');
    await expect(dropdown).toContainText('J. Coin Purchase in transit');
    await expect(dropdown).toContainText('K. Total Cashier\'s Fund');
  });
  test('RC-010: Cash Trends download report csv/excel', async ({ page }) => {
    await page.click('text=Cash Trends');
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download CSV")');
    await downloadPromise;
  });

  // --- AUDIT TRAIL ---
  test('RC-011: Audit Trail download missing & not storing data (FAIL)', async ({ page }) => {
    await page.click('text=Audit Trail');
    await expect(page.locator('button:has-text("Export")')).toBeVisible();
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
  });
});
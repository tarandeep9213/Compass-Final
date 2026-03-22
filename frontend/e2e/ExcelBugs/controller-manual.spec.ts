import { test, expect } from '@playwright/test';

test.describe('Controller - Exhaustive Manual Testing Observations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'terri.serrano@compass.com');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button:has-text("Sign In")');
  });

  test('CTRL-001: Daily Review Dashboard is default landing page (FAIL)', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Daily Review');
  });
  test('CTRL-002: Location dropdown reflects admin config (FAIL)', async ({ page }) => {
    await expect(page.locator('select[name="locationFilter"] option')).toHaveCount(2); // APPLETON & WAUSAU
  });
  test('CTRL-003: Reject form button & mandatory comments (FAIL)', async ({ page }) => {
    await page.click('text=Daily Review');
    await page.click('text=View →');
    await page.click('button:has-text("Reject")');
    await page.click('button:has-text("Confirm")');
    await expect(page.locator('text=Comment is required')).toBeVisible();
  });
  test('CTRL-004: Approve/reject each section of form (FAIL)', async ({ page }) => {
    await page.click('text=Daily Review');
    await page.click('text=View →');
    await expect(page.locator('button:has-text("Reject Section")')).toBeVisible();
  });

  // --- WEEKLY SUBMISSION / SCHEDULING ---
  test('CTRL-005: Schedule only visible to controller, not operators (BLOCKER)', async ({ page }) => {
    await expect(page.locator('text=Schedule Visit')).toBeVisible();
  });
  test('CTRL-006: Day-of-Week Conflict Warning triggers but allows booking (BLOCKER)', async ({ page }) => {
    await page.click('text=Schedule Visit');
    await page.fill('input[type="date"]', '2026-03-24'); // Tuesday
    await page.click('button:has-text("Check")');
    await expect(page.locator('text=DOW Warning')).toBeVisible();
    await expect(page.locator('button:has-text("Book Visit")')).not.toBeDisabled();
  });
  test('CTRL-007: DOW warning added as compliance miss for that visit (BLOCKER)', async () => { test.fixme(); });
  test('CTRL-008: If missed - should be able to add justification', async ({ page }) => {
    await page.click('text=Dashboard');
    await page.click('text=Mark as Missed');
    await expect(page.locator('textarea[placeholder*="justification"]')).toBeVisible();
  });
  
  // --- VISIT COMPLETION ---
  test('CTRL-009: Complete button should not complete the process directly (BLOCKER)', async ({ page }) => {
    await page.click('text=Complete Visit');
    await expect(page.locator('text=Section A')).toBeVisible(); // Should open review form, not just complete
  });
  test('CTRL-010: If form not submitted, show operator yet to fill (PASS)', async ({ page }) => {
    await expect(page.locator('text=operator is yet to fill')).toBeVisible();
  });
  test('CTRL-011: Controller marks verified against each section & Digital Sign (BLOCKER)', async ({ page }) => {
    await page.click('text=Complete Visit');
    await page.click('button:has-text("Verify All")');
    await page.click('button:has-text("Complete")');
    await expect(page.locator('text=Digital signature required')).toBeVisible();
  });

  // --- DGM REVIEW ---
  test('CTRL-012: Review DGM Visits dashboard visible & scoped correctly (BLOCKER)', async ({ page }) => {
    await page.click('text=Review DGM Visits');
    await expect(page.locator('h2')).toContainText('Review DGM Visits');
  });
});
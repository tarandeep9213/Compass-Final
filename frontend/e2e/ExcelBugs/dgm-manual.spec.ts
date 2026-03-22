import { test, expect } from '@playwright/test';

test.describe('DGM - Exhaustive Manual Testing Observations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'john.ranallo@compass.com');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button:has-text("Sign In")');
  });

  test('DGM-001: Access location only as per configuration over dashboard', async ({ page }) => {
    await expect(page.locator('select[name="locationFilter"] option')).toHaveCount(2); 
  });
  test('DGM-002: Date of visit for current month not same as last (DOM Warning)', async ({ page }) => {
    await page.click('text=Schedule Visit');
    await page.fill('input[type="date"]', '2026-03-20');
    await expect(page.locator('text=DOM Warning')).toBeVisible();
  });
  test('DGM-003: If visit already planned, cannot add visit other day same month', async ({ page }) => {
    await page.click('text=Schedule Visit');
    await page.fill('input[type="date"]', '2026-03-25');
    await expect(page.locator('text=Visit already scheduled for this month')).toBeVisible();
  });
  test('DGM-004: User able to cancel/change planned visit dates', async ({ page }) => {
    await page.click('text=Dashboard');
    await expect(page.locator('button:has-text("Reschedule")')).toBeVisible();
  });
  test('DGM-005: Overdue option upto 48 hours then mark as missed', async () => { test.fixme(); });
  test('DGM-006: Complete button not direct & requires form view first', async ({ page }) => {
    await page.click('text=Complete Visit');
    await expect(page.locator('text=Review Operator Submission')).toBeVisible();
  });
  test('DGM-007: DGM verify sections & Digital signature mandatory', async ({ page }) => {
    await page.click('text=Complete Visit');
    await page.click('button:has-text("Sign")');
    await expect(page.locator('text=Signature required')).toBeVisible();
  });
  test('DGM-008: History Tab shows view of submissions', async ({ page }) => {
    await page.click('text=History');
    await expect(page.locator('table')).toBeVisible();
  });
});
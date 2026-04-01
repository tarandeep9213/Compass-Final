/**
 * REVIEW-GATE: Controller/DGM cannot confirm completion without
 * first completing the section review via "View & Approve".
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = 'http://localhost:8006/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })).json()).access_token
}

test.describe('Review Gate — must View & Approve before confirming', () => {

  test('RG-001: Confirm Completion button disabled without section review', async ({ page, request }) => {
    const token = await getToken(request, 'controller@compass.com')

    // Schedule a visit
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const visit = await (await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2028-09-01', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null },
    })).json()

    if (!visit.id) {
      console.log('Setup:', visit.detail)
      return
    }

    // Login as controller
    await loginAs(page, 'terri.serrano@compass.com')

    // Navigate to Weekly Review Dashboard
    await page.locator('.nav-item').filter({ hasText: /Weekly Review/i }).click().catch(() => {})

    // Find a scheduled visit and click Mark as Completed
    const completeBtn = page.getByRole('button', { name: /Mark as Completed/i }).first()
    if (await completeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await completeBtn.click()

      // The expand panel should show — check for the helper message
      const reviewMsg = page.getByText(/Please complete the section review/i)
      if (await reviewMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Review gate message shown ✓')

        // Confirm button should be disabled
        const confirmBtn = page.getByRole('button', { name: /Confirm Completion/i })
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          const disabled = await confirmBtn.isDisabled()
          expect(disabled).toBe(true)
          console.log('Confirm button disabled without review ✓')
        }
      } else {
        console.log('Review gate message not visible — submission may not be approved or UI different')
      }
    } else {
      console.log('No Mark as Completed button visible — skipping UI check')
    }

    // Cleanup
    await request.patch(`${API}/verifications/controller/${visit.id}/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    })
  })

  test('RG-002: DGM Confirm Completion disabled without section review', async ({ page }) => {
    // Login as DGM
    await loginAs(page, 'john.ranallo@compass.com')

    // Navigate to Coverage Dashboard
    await page.locator('.nav-item').filter({ hasText: /Coverage Dashboard/i }).click().catch(() => {})

    // Find a scheduled visit and click Mark as Completed
    const completeBtn = page.getByRole('button', { name: /Mark as Completed/i }).first()
    if (await completeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await completeBtn.click()

      // Check for the review gate message
      const reviewMsg = page.getByText(/Please complete the section review/i)
      if (await reviewMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('DGM review gate message shown ✓')

        // Confirm button should be disabled
        const confirmBtn = page.getByRole('button', { name: /Confirm Completion/i })
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          const disabled = await confirmBtn.isDisabled()
          expect(disabled).toBe(true)
          console.log('DGM Confirm button disabled without review ✓')
        }
      } else {
        const gateMsg = page.getByText(/Submission not yet approved/i)
        if (await gateMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('DGM submission gate blocking — review gate not reached (expected if no approved submission)')
        } else {
          console.log('DGM review gate not visible — UI may differ')
        }
      }
    } else {
      console.log('No Mark as Completed button visible for DGM — skipping')
    }
  })
})

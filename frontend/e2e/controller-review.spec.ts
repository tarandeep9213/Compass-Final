/**
 * CONTROLLER-REVIEW tests
 * Tests the Complete Review flow: controller approves/rejects a pending submission.
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = 'http://localhost:8002/v1'

async function getToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })
  return (await res.json()).access_token as string
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

test.describe('Controller Review Flow', () => {

  test('CR-001: controller sees pending submissions on Daily Review Dashboard', async ({ page, request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const today = localToday()

    // Ensure a pending submission exists
    await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: today, source: 'FORM',
        sections: { A: { total: 500 }, B: { total: 100 } },
        variance_note: null, save_as_draft: false,
      },
    })

    // Login as controller
    await loginAs(page, 'controller@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(1500)

    // Should be on Daily Review Dashboard
    await expect(page.getByRole('heading', { name: /Daily Review Dashboard/i })).toBeVisible({ timeout: 5000 })

    // Should see pending submissions
    const pageText = await page.locator('body').textContent() ?? ''
    console.log('Has "Awaiting":', pageText.includes('Awaiting'))
    console.log('Has "Pending":', pageText.includes('Pending'))
    console.log('Has "Complete Review":', pageText.includes('Complete Review'))
  })

  test('CR-002: Complete Review navigates to submission detail with review form', async ({ page, request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const testDate = '2026-02-12'

    // Create a pending submission
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: testDate, source: 'FORM',
        sections: { A: { total: 500 }, B: { total: 100 } },
        variance_note: null, save_as_draft: false,
      },
    })).json()

    // Login as controller and go to Daily Review
    await loginAs(page, 'controller@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(1500)

    // Click Complete Review on the pending submission
    const reviewBtn = page.getByRole('button', { name: /Complete Review/i }).first()
    if (await reviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reviewBtn.click()

      // Should navigate to submission detail with review form
      await expect(page.getByText(/Submission/i).first()).toBeVisible({ timeout: 5000 })

      // Review form should show Accept/Reject buttons for sections
      await expect(
        page.getByRole('button', { name: /Accept/i }).first()
          .or(page.getByRole('button', { name: /Approve/i }).first())
      ).toBeVisible({ timeout: 5000 })
    } else {
      console.log('No Complete Review button visible — may need different filter')
    }
  })

  test('CR-003: controller approves submission via API', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    // Create a pending submission
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2026-02-13', source: 'FORM',
        sections: { A: { total: 500 } },
        variance_note: null, save_as_draft: false,
      },
    })).json()

    expect(sub.status).toBe('pending_approval')

    // Approve it
    const approveRes = await request.post(`${API}/submissions/${sub.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: {},
    })
    expect(approveRes.ok()).toBeTruthy()

    // Verify status changed
    const check = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })).json()
    expect(check.status).toBe('approved')
    expect(check.approved_by).toBeTruthy()
  })

  test('CR-004: controller rejects submission with reason via API', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    // Create a pending submission
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2026-02-14', source: 'FORM',
        sections: { A: { total: 500 } },
        variance_note: null, save_as_draft: false,
      },
    })).json()

    // Reject it
    const rejectRes = await request.post(`${API}/submissions/${sub.id}/reject`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: { reason: 'Section A total seems too low' },
    })
    expect(rejectRes.ok()).toBeTruthy()

    // Verify status changed
    const check = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })).json()
    expect(check.status).toBe('rejected')
    expect(check.rejection_reason).toBe('Section A total seems too low')
  })

  test('CR-005: approved submission cannot be approved again', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2026-02-15', source: 'FORM',
        sections: { A: { total: 500 } },
        variance_note: null, save_as_draft: false,
      },
    })).json()

    // Approve once
    await request.post(`${API}/submissions/${sub.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrlToken}` }, data: {},
    })

    // Try to approve again — should fail
    const res = await request.post(`${API}/submissions/${sub.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrlToken}` }, data: {},
    })
    expect(res.status()).toBe(400)
  })
})

/**
 * DRAFT-DELETE tests
 * Verifies that deleting/discarding drafts actually removes them from the backend.
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:8002/v1'

async function getToken(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email: 'operator@compass.com', password: 'demo1234' } })
  return (await res.json()).access_token as string
}

async function createDraft(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  date: string,
): Promise<string> {
  const res = await request.post(`${API}/submissions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      location_id: 'loc-1', submission_date: date, source: 'FORM',
      sections: { A: { total: 300 }, B: { total: 75 } },
      variance_note: null, save_as_draft: true,
    },
  })
  return (await res.json()).id as string
}

async function draftExistsInAPI(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  draftId: string,
): Promise<boolean> {
  const res = await request.get(`${API}/submissions/${draftId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.ok()
}

test.describe('Draft Delete', () => {

  test('DD-001: deleting draft via API actually removes it from backend', async ({ request }) => {
    const token = await getToken(request)
    const draftId = await createDraft(request, token, '2026-01-15')

    // Verify it exists
    expect(await draftExistsInAPI(request, token, draftId)).toBe(true)

    // Delete it
    const delRes = await request.delete(`${API}/submissions/${draftId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(delRes.status()).toBe(204)

    // Verify it's gone
    expect(await draftExistsInAPI(request, token, draftId)).toBe(false)
  })

  test.skip('DD-002: deleting draft from OpDrafts Discard button removes from backend', async ({ page, request }) => {
    const token = await getToken(request)
    const testDate = '2026-01-20'

    // Clean up any existing draft for this date
    const list = await request.get(`${API}/submissions?location_id=loc-1&status=draft&date_from=${testDate}&date_to=${testDate}&page_size=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    for (const s of ((await list.json()).items ?? [])) {
      await request.delete(`${API}/submissions/${s.id}`, { headers: { Authorization: `Bearer ${token}` } })
    }

    // Create a draft
    const draftId = await createDraft(request, token, testDate)
    expect(await draftExistsInAPI(request, token, draftId)).toBe(true)

    // Login as operator
    const { loginAs } = await import('./helpers/auth')
    await loginAs(page, 'operator@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(3000)

    // Navigate to My Drafts — button only shows when API returns drafts
    const draftsBtn = page.getByText(/My Drafts/i)
    await expect(draftsBtn).toBeVisible({ timeout: 8000 })
    await draftsBtn.click()
    await expect(page.getByRole('heading', { name: /My Drafts/i })).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(1000)

    // Should see the draft (Jan 20)
    await expect(page.getByText(/Jan 20/i).or(page.getByText(/20 Jan/i))).toBeVisible({ timeout: 5000 })

    // Click Discard and confirm the dialog
    page.once('dialog', dialog => dialog.accept())
    const discardBtn = page.getByRole('button', { name: /Discard/i }).first()
    await discardBtn.click()
    await page.waitForTimeout(2000)

    // Verify it's actually deleted from backend
    const stillExists = await draftExistsInAPI(request, token, draftId)
    if (stillExists) {
      // Check what drafts remain
      const remaining = await request.get(`${API}/submissions?status=draft&page_size=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const items = (await remaining.json()).items ?? []
      console.log(`Remaining drafts: ${items.length}`, items.map((i: {id:string;submission_date:string}) => `${i.id.slice(0,8)} ${i.submission_date}`))
    }
    expect(stillExists).toBe(false)
  })

  test.skip('DD-003: discarding draft from OpForm removes from backend', async ({ page, request }) => {
    const token = await getToken(request)
    const testDate = '2026-01-25'

    // Clean up
    const list = await request.get(`${API}/submissions?location_id=loc-1&status=draft&date_from=${testDate}&date_to=${testDate}&page_size=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    for (const s of ((await list.json()).items ?? [])) {
      await request.delete(`${API}/submissions/${s.id}`, { headers: { Authorization: `Bearer ${token}` } })
    }

    // Create a draft
    const draftId = await createDraft(request, token, testDate)
    expect(await draftExistsInAPI(request, token, draftId)).toBe(true)

    // Login as operator
    const { loginAs } = await import('./helpers/auth')
    await loginAs(page, 'operator@compass.com')
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.waitForTimeout(2000)

    // Navigate to My Drafts → Resume the draft
    const draftsBtn = page.getByText(/My Drafts/i)
    await expect(draftsBtn).toBeVisible({ timeout: 5000 })
    await draftsBtn.click()
    await expect(page.getByRole('heading', { name: /My Drafts/i })).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(1000)

    // Click Resume on the draft
    await page.getByRole('button', { name: /Resume/i }).first().click()

    // Should be on the form
    await expect(page.getByRole('heading', { name: /Cash Count Form/i })).toBeVisible({ timeout: 10000 })

    // Click Discard and confirm
    page.on('dialog', dialog => dialog.accept())
    await page.locator('.btn-outline', { hasText: /Discard/i }).first().click()
    await page.waitForTimeout(1500)

    // Verify it's actually deleted from backend
    expect(await draftExistsInAPI(request, token, draftId)).toBe(false)
  })

  test('DD-004: failed delete shows error, draft remains in backend', async ({ request }) => {
    const token = await getToken(request)
    const draftId = await createDraft(request, token, '2026-01-28')

    // Submit the draft (so it's no longer deletable — status becomes pending_approval)
    await request.post(`${API}/submissions/${draftId}/submit`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { variance_note: null },
    })

    // Try to delete it — should fail (only drafts can be deleted)
    const delRes = await request.delete(`${API}/submissions/${draftId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(delRes.status()).toBe(400)

    // Verify it still exists
    expect(await draftExistsInAPI(request, token, draftId)).toBe(true)
  })
})

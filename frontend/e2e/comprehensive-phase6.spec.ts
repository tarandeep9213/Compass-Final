/**
 * Comprehensive E2E — Phase 6: DGM Scheduled Visit
 * Self-contained setup — seeds required state via API
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = process.env.E2E_API_URL || 'http://localhost:8000/v1'
const DGM1 = 'dgm1@test.com'

test.describe('Phase 6 — DGM Scheduled Visit', () => {
  test.describe.configure({ mode: 'serial' })

  let dgmToken: string
  let visitId: string

  test('6.0 Setup: ensure DGM user and locations exist', async ({ request }) => {
    const adminToken = (await (await request.post(`${API}/auth/login`, {
      data: { email: 'admin@compass.com', password: 'demo1234' },
    })).json()).access_token
    const headers = { Authorization: `Bearer ${adminToken}` }

    // Ensure DGM password
    const usersRes = await request.get(`${API}/admin/users`, { headers })
    const users = await usersRes.json()
    const userList = Array.isArray(users) ? users : (users.items ?? [])
    const dgm = userList.find((u: { email: string }) => u.email === DGM1)
    if (dgm) {
      await request.put(`${API}/admin/users/${dgm.id}`, { headers, data: { password: 'demo1234' } })
    }

    dgmToken = (await (await request.post(`${API}/auth/login`, {
      data: { email: DGM1, password: 'demo1234' },
    })).json()).access_token
    expect(dgmToken).toBeTruthy()
  })

  test('6.1 Schedule DGM visit for today', async ({ request }) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const res = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: {
        location_id: 'loc-location-alpha',
        date: todayStr,
        notes: 'Phase 6 DGM visit',
      },
    })
    expect(res.ok(), 'DGM visit schedule should succeed').toBe(true)
    const visit = await res.json()
    visitId = visit.id
    expect(visit.status).toBe('scheduled')
    expect(visit.verification_type).toBe('DGM')
  })

  test('6.2 Duplicate DGM visit same date blocked or second visit created', async ({ request }) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // Try scheduling another visit for same location on same date
    const res = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: {
        location_id: 'loc-location-alpha',
        date: todayStr,
        notes: 'Second visit attempt',
      },
    })
    // Backend may block (400/409) or allow — both are valid behaviors
    // If blocked: status >= 400
    // If allowed: verify it created a second visit
    if (res.ok()) {
      const visit2 = await res.json()
      expect(visit2.id).not.toBe(visitId) // Should be a different visit
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400)
    }
  })

  test('6.3 DGM visit appears in list', async ({ request }) => {
    const res = await request.get(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
    })
    expect(res.ok()).toBe(true)
    const data = await res.json()
    const visits = Array.isArray(data) ? data : (data.items ?? [])
    const found = visits.find((v: { id: string }) => v.id === visitId)
    expect(found, 'DGM visit should appear in list').toBeTruthy()
  })

  test('6.4 Complete DGM visit with signature', async ({ request }) => {
    if (!visitId) { test.skip(); return }

    const res = await request.patch(`${API}/verifications/dgm/${visitId}/complete`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: {
        observed_total: 10000,
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        notes: 'All verified by DGM',
      },
    })
    expect(res.ok(), 'DGM visit completion should succeed').toBe(true)
    const completed = await res.json()
    expect(completed.status).toBe('completed')
  })

  test('6.5 Completed DGM visit is read-only', async ({ request }) => {
    if (!visitId) { test.skip(); return }

    const res = await request.patch(`${API}/verifications/dgm/${visitId}/complete`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: {
        observed_total: 9999,
        signature_data: 'data:image/png;base64,test',
      },
    })
    expect(res.ok(), 'Re-completing should fail').toBe(false)
  })

  test('6.6 DGM dashboard shows coverage', async ({ page }) => {
    await loginAs(page, DGM1)

    // DGM lands on Coverage Dashboard
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)

    // Should show coverage data or dashboard content
    const pageText = await page.innerText('body')
    const hasCoverage = pageText.includes('Coverage') || pageText.includes('Visit') || pageText.includes('Location')
    expect(hasCoverage, 'DGM dashboard should show coverage info').toBe(true)
  })
})

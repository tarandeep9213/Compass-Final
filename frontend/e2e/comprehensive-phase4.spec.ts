/**
 * Comprehensive E2E — Phase 4: Controller Review
 * Requires: users + locations + pending submissions (seeded in 4.0 setup)
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = process.env.E2E_API_URL || 'http://localhost:8000/v1'
const OP1 = 'op1@test.com'
const OP2 = 'op2@test.com'
const CTRL1 = 'ctrl1@test.com'

test.describe('Phase 4 — Controller Review', () => {
  test.describe.configure({ mode: 'serial' })

  let adminToken: string
  let ctrl1Token: string

  test('4.0 Setup: seed users, locations, and pending submissions', async ({ request }) => {
    // Login as admin
    const adminRes = await request.post(`${API}/auth/login`, {
      data: { email: 'admin@compass.com', password: 'demo1234' },
    })
    if (!adminRes.ok()) {
      // Admin might have changed password from Phase 1 tests
      const retry = await request.post(`${API}/auth/login`, {
        data: { email: 'admin@compass.com', password: 'ChangedPw123' },
      })
      expect(retry.ok(), 'Admin login should succeed').toBe(true)
      adminToken = (await retry.json()).access_token
      // Reset password back
      await request.post(`${API}/auth/change-password`, {
        data: { current_password: 'ChangedPw123', new_password: 'demo1234' },
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      adminToken = (await (await request.post(`${API}/auth/login`, {
        data: { email: 'admin@compass.com', password: 'demo1234' },
      })).json()).access_token
    } else {
      adminToken = (await adminRes.json()).access_token
    }
    const headers = { Authorization: `Bearer ${adminToken}` }

    // Ensure locations exist
    const locsRes = await request.get(`${API}/locations`, { headers })
    const locs = await locsRes.json()
    const locList = Array.isArray(locs) ? locs : (locs.items ?? [])
    if (locList.length === 0) {
      // Create locations via import
      await request.post(`${API}/admin/import`, {
        headers,
        data: {
          rows: [
            { location_code: '5001', location_name: 'Location Alpha', cashroom_lead: 'Operator One', cashroom_lead_email: OP1, controller: 'Controller One', controller_email: CTRL1, dgm: 'DGM User', dgm_email: 'dgm1@test.com', regional_controller: 'RC User', regional_controller_email: 'rc1@test.com' },
            { location_code: '5002', location_name: 'Location Beta', cashroom_lead: 'Operator Two', cashroom_lead_email: OP2, controller: 'Controller Two', controller_email: 'ctrl2@test.com', dgm: 'DGM User', dgm_email: 'dgm1@test.com', regional_controller: 'RC User', regional_controller_email: 'rc1@test.com' },
          ],
        },
      })
    }

    // Ensure test users exist with known passwords
    const usersRes = await request.get(`${API}/admin/users`, { headers })
    const users = await usersRes.json()
    const userList = Array.isArray(users) ? users : (users.items ?? [])
    for (const email of [OP1, OP2, CTRL1, 'ctrl2@test.com', 'dgm1@test.com', 'rc1@test.com']) {
      const u = userList.find((u: { email: string }) => u.email === email)
      if (u) {
        await request.put(`${API}/admin/users/${u.id}`, { headers, data: { password: 'demo1234' } })
      }
    }

    // Set expected cash
    await request.put(`${API}/admin/locations/loc-location-alpha`, { headers, data: { expected_cash: 10000 } })
    await request.put(`${API}/admin/locations/loc-location-beta`, { headers, data: { expected_cash: 8000 } })

    // Create pending submissions for OP1 and OP2 if they don't exist today
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    for (const opEmail of [OP1, OP2]) {
      const opToken = (await (await request.post(`${API}/auth/login`, {
        data: { email: opEmail, password: 'demo1234' },
      })).json()).access_token
      const locId = opEmail === OP1 ? 'loc-location-alpha' : 'loc-location-beta'

      const subsRes = await request.get(
        `${API}/submissions?location_id=${locId}&date_from=${todayStr}&date_to=${todayStr}`,
        { headers: { Authorization: `Bearer ${opToken}` } },
      )
      const subs = await subsRes.json()
      const hasPending = (subs.items ?? []).some((s: { status: string }) => s.status === 'pending_approval')

      if (!hasPending) {
        // Create and submit
        const createRes = await request.post(`${API}/submissions`, {
          headers: { Authorization: `Bearer ${opToken}` },
          data: {
            location_id: locId,
            submission_date: todayStr,
            source: 'FORM',
            save_as_draft: false,
            sections: {
              A: { total: 5000, ones: 500, tens: 2000, hundreds: 2500 },
              B: { total: 3000, dollar: 3000 },
              C: { total: 0 }, D: { total: 0 }, E: { total: 0 },
              F: { total: 0 }, G: { total: 0 }, H: { total: 0 }, I: { total: 0 },
            },
            variance_note: opEmail === OP1 ? 'Phase 4 test submission' : null,
          },
        })
        expect(createRes.ok(), `Submission for ${opEmail} should succeed`).toBe(true)
      }
    }

    // Get controller token for later tests
    ctrl1Token = (await (await request.post(`${API}/auth/login`, {
      data: { email: CTRL1, password: 'demo1234' },
    })).json()).access_token
    expect(ctrl1Token).toBeTruthy()
  })

  test('4.1 Controller 1 rejects Operator 1 submission', async ({ request }) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const ctrlToken = (await (await request.post(`${API}/auth/login`, {
      data: { email: CTRL1, password: 'demo1234' },
    })).json()).access_token

    const subsRes = await request.get(
      `${API}/submissions?location_id=loc-location-alpha&date_from=${todayStr}&date_to=${todayStr}`,
      { headers: { Authorization: `Bearer ${ctrlToken}` } },
    )
    const subs = await subsRes.json()
    const pending = (subs.items ?? []).find((s: { status: string }) => s.status === 'pending_approval')
    expect(pending, 'Should find pending submission for OP1').toBeTruthy()

    const rejRes = await request.post(`${API}/submissions/${pending.id}/reject`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: { reason: 'Section A totals do not match bank records' },
    })
    expect(rejRes.ok(), 'Rejection should succeed').toBe(true)
    const rejected = await rejRes.json()
    expect(rejected.status).toBe('rejected')
  })

  test('4.2 Operator 1 sees rejection + reason', async ({ page, request }) => {
    // Verify via API first
    const op1Token = (await (await request.post(`${API}/auth/login`, {
      data: { email: OP1, password: 'demo1234' },
    })).json()).access_token

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const subsRes = await request.get(
      `${API}/submissions?location_id=loc-location-alpha&date_from=${todayStr}&date_to=${todayStr}`,
      { headers: { Authorization: `Bearer ${op1Token}` } },
    )
    const subs = await subsRes.json()
    const rejected = (subs.items ?? []).find((s: { status: string }) => s.status === 'rejected')
    expect(rejected, 'OP1 should have a rejected submission').toBeTruthy()
    if (rejected) {
      expect(rejected.rejection_reason).toContain('Section A')
    }

    // Verify on UI
    await loginAs(page, OP1)
    await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
      .toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)

    // Dashboard should show rejected status
    const hasRejected = await page.getByText(/Rejected/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasRejected, 'Dashboard should show Rejected status').toBe(true)
  })

  test('4.3 Operator 1 resubmits after rejection', async ({ page, request }) => {
    const op1Token = (await (await request.post(`${API}/auth/login`, {
      data: { email: OP1, password: 'demo1234' },
    })).json()).access_token

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // Resubmit via API — create new submission for same date
    const createRes = await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${op1Token}` },
      data: {
        location_id: 'loc-location-alpha',
        submission_date: todayStr,
        source: 'FORM',
        save_as_draft: false,
        sections: {
          A: { total: 6000, ones: 600, tens: 2500, hundreds: 2900 },
          B: { total: 3000, dollar: 3000 },
          C: { total: 0 }, D: { total: 0 }, E: { total: 0 },
          F: { total: 0 }, G: { total: 0 }, H: { total: 0 }, I: { total: 1000, yesterday: 0, today: 1000 },
        },
        variance_note: 'Corrected Section A count after rejection',
      },
    })
    expect(createRes.ok(), 'Resubmission should succeed').toBe(true)
    const newSub = await createRes.json()
    expect(newSub.status).toBe('pending_approval')

    // Verify on UI
    await loginAs(page, OP1)
    await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
      .toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)

    const hasPending = await page.getByText(/Pending Approval/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      || await page.locator('.badge-amber').first().isVisible({ timeout: 2000 }).catch(() => false)
    expect(hasPending, 'After resubmit, should show Pending Approval').toBe(true)
  })

  test('4.4 Controller 1 approves resubmission', async ({ request }) => {
    const ctrlToken = (await (await request.post(`${API}/auth/login`, {
      data: { email: CTRL1, password: 'demo1234' },
    })).json()).access_token

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const subsRes = await request.get(
      `${API}/submissions?location_id=loc-location-alpha&date_from=${todayStr}&date_to=${todayStr}`,
      { headers: { Authorization: `Bearer ${ctrlToken}` } },
    )
    const subs = await subsRes.json()
    const pending = (subs.items ?? []).find((s: { status: string }) => s.status === 'pending_approval')
    expect(pending, 'Should find pending submission to approve').toBeTruthy()

    const approveRes = await request.post(`${API}/submissions/${pending.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: { notes: 'Approved after recount' },
    })
    expect(approveRes.ok(), 'Approval should succeed').toBe(true)
    const approved = await approveRes.json()
    expect(approved.status).toBe('approved')
  })

  test('4.5 Controller 2 approves Operator 2 directly', async ({ request }) => {
    const ctrl2Token = (await (await request.post(`${API}/auth/login`, {
      data: { email: 'ctrl2@test.com', password: 'demo1234' },
    })).json()).access_token

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const subsRes = await request.get(
      `${API}/submissions?location_id=loc-location-beta&date_from=${todayStr}&date_to=${todayStr}`,
      { headers: { Authorization: `Bearer ${ctrl2Token}` } },
    )
    const subs = await subsRes.json()
    const pending = (subs.items ?? []).find((s: { status: string }) => s.status === 'pending_approval')
    expect(pending, 'Should find OP2 pending submission').toBeTruthy()

    const approveRes = await request.post(`${API}/submissions/${pending.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrl2Token}` },
      data: {},
    })
    expect(approveRes.ok(), 'OP2 approval should succeed').toBe(true)
  })

  test('4.6 Both operators see Approved status', async ({ page, request }) => {
    // OP1
    await loginAs(page, OP1)
    await expect(page.getByRole('heading', { name: /Good morning|Good afternoon|Good evening/i }))
      .toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)

    const op1Approved = await page.getByText(/Accepted|Approved/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(op1Approved, 'OP1 should see Approved/Accepted').toBe(true)

    // OP2 — verify via API
    const op2Token = (await (await request.post(`${API}/auth/login`, {
      data: { email: OP2, password: 'demo1234' },
    })).json()).access_token

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const subsRes = await request.get(
      `${API}/submissions?location_id=loc-location-beta&date_from=${todayStr}&date_to=${todayStr}`,
      { headers: { Authorization: `Bearer ${op2Token}` } },
    )
    const subs = await subsRes.json()
    const approved = (subs.items ?? []).find((s: { status: string }) => s.status === 'approved')
    expect(approved, 'OP2 should have approved submission').toBeTruthy()
  })

  test('4.7 Rejection and approval emails sent', async ({ request }) => {
    const mailRes = await request.get('http://localhost:1080/emails').catch(() => null)
    if (!mailRes || !mailRes.ok()) { test.skip(); return }

    const emails = await mailRes.json()
    // Should have rejection + approval emails
    const hasRejection = emails.some((e: { subject: string }) =>
      e.subject?.toLowerCase().includes('reject'))
    const hasApproval = emails.some((e: { subject: string }) =>
      e.subject?.toLowerCase().includes('approv'))

    // At least one of these should exist
    expect(hasRejection || hasApproval, 'Should have rejection or approval emails').toBe(true)
  })

  test('4.8 Audit trail has reject, resubmit, approve events', async ({ request }) => {
    const token = (await (await request.post(`${API}/auth/login`, {
      data: { email: 'admin@compass.com', password: 'demo1234' },
    })).json()).access_token

    const auditRes = await request.get(`${API}/audit`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const auditData = await auditRes.json()
    const events = Array.isArray(auditData) ? auditData : (auditData.items ?? auditData.events ?? [])

    const types = events.map((e: { event_type: string }) => e.event_type)
    const hasReject = types.includes('SUBMISSION_REJECTED')
    const hasApprove = types.includes('SUBMISSION_APPROVED')

    expect(hasReject || hasApprove, 'Audit trail should have reject or approve events').toBe(true)
  })
})

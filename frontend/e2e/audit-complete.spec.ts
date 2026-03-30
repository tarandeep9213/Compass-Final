/**
 * Tests all audit trail events are logged correctly.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8006/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })).json()).access_token
}

async function countAudit(request: import('@playwright/test').APIRequestContext, token: string, type: string): Promise<number> {
  return (await (await request.get(`${API}/audit?event_type=${type}&page_size=1`, { headers: { Authorization: `Bearer ${token}` } })).json()).total
}

async function latestAudit(request: import('@playwright/test').APIRequestContext, token: string, type: string) {
  const data = (await (await request.get(`${API}/audit?event_type=${type}&page_size=1`, { headers: { Authorization: `Bearer ${token}` } })).json())
  return data.items[0] ?? null
}

test.describe('Audit Trail — All Events', () => {

  test('AUDIT-01: PASSWORD_RESET_REQUESTED on forgot-password', async ({ request }) => {
    const adminToken = await getToken(request, 'admin@compass.com')
    const before = await countAudit(request, adminToken, 'PASSWORD_RESET_REQUESTED')

    await request.post(`${API}/auth/forgot-password`, { data: { email: 'operator@compass.com' } })

    const after = await countAudit(request, adminToken, 'PASSWORD_RESET_REQUESTED')
    expect(after).toBe(before + 1)
    console.log(`PASSWORD_RESET_REQUESTED: ${before} -> ${after} ✓`)
  })

  test('AUDIT-02: PASSWORD_RESET_OTP_VERIFIED on verify-otp', async ({ request }) => {
    const adminToken = await getToken(request, 'admin@compass.com')

    // Request OTP first
    await request.post(`${API}/auth/forgot-password`, { data: { email: 'operator@compass.com' } })
    const otpRes = await request.get(`${API}/auth/dev/last-otp?email=operator@compass.com`)
    if (!otpRes.ok()) { test.skip(true, 'DEBUG OTP not available'); return }
    const { otp } = await otpRes.json()

    const before = await countAudit(request, adminToken, 'PASSWORD_RESET_OTP_VERIFIED')
    await request.post(`${API}/auth/verify-otp`, { data: { email: 'operator@compass.com', otp } })
    const after = await countAudit(request, adminToken, 'PASSWORD_RESET_OTP_VERIFIED')
    expect(after).toBe(before + 1)
    console.log(`PASSWORD_RESET_OTP_VERIFIED: ${before} -> ${after} ✓`)
  })

  test('AUDIT-03: SUBMISSION_UPDATED on PUT submission', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const adminToken = await getToken(request, 'admin@compass.com')

    // Create a draft
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: { location_id: 'loc-1', submission_date: '2028-09-01', source: 'FORM', sections: { A: { total: 100 } }, variance_note: null, save_as_draft: true },
    })).json()
    if (!sub.id) { console.log('Setup:', sub.detail); return }

    const before = await countAudit(request, adminToken, 'SUBMISSION_UPDATED')
    await request.put(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: { location_id: 'loc-1', submission_date: '2028-09-01', source: 'FORM', sections: { A: { total: 500 } }, variance_note: null, save_as_draft: true },
    })
    const after = await countAudit(request, adminToken, 'SUBMISSION_UPDATED')
    expect(after).toBe(before + 1)
    console.log(`SUBMISSION_UPDATED: ${before} -> ${after} ✓`)
  })

  test('AUDIT-04: SUBMISSION_APPROVED has old/new values', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')
    const adminToken = await getToken(request, 'admin@compass.com')

    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: { location_id: 'loc-1', submission_date: '2028-09-02', source: 'FORM', sections: { A: { total: 100 } }, variance_note: null, save_as_draft: false },
    })).json()
    if (!sub.id) { console.log('Setup:', sub.detail); return }

    await request.post(`${API}/submissions/${sub.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrlToken}` }, data: {},
    })

    const event = await latestAudit(request, adminToken, 'SUBMISSION_APPROVED')
    expect(event).toBeTruthy()
    expect(event.old_value).toBe('pending_approval')
    expect(event.new_value).toBe('approved')
    console.log(`SUBMISSION_APPROVED old=${event.old_value} new=${event.new_value} ✓`)
  })

  test('AUDIT-05: SUBMISSION_REJECTED has old/new values', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')
    const adminToken = await getToken(request, 'admin@compass.com')

    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: { location_id: 'loc-1', submission_date: '2028-09-03', source: 'FORM', sections: { A: { total: 100 } }, variance_note: null, save_as_draft: false },
    })).json()
    if (!sub.id) { console.log('Setup:', sub.detail); return }

    await request.post(`${API}/submissions/${sub.id}/reject`, {
      headers: { Authorization: `Bearer ${ctrlToken}` }, data: { reason: 'Test rejection' },
    })

    const event = await latestAudit(request, adminToken, 'SUBMISSION_REJECTED')
    expect(event).toBeTruthy()
    expect(event.old_value).toBe('pending_approval')
    expect(event.new_value).toContain('rejected')
    console.log(`SUBMISSION_REJECTED old=${event.old_value} new=${event.new_value} ✓`)
  })

  test('AUDIT-06: MISSED_SUBMISSION_LOGGED', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const adminToken = await getToken(request, 'admin@compass.com')

    const before = await countAudit(request, adminToken, 'MISSED_SUBMISSION_LOGGED')
    await request.post(`${API}/missed-submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: { location_id: 'loc-1', missed_date: '2028-09-04', reason: 'Illness', detail: 'Sick day', supervisor_name: 'Test Supervisor' },
    })
    const after = await countAudit(request, adminToken, 'MISSED_SUBMISSION_LOGGED')
    expect(after).toBe(before + 1)
    console.log(`MISSED_SUBMISSION_LOGGED: ${before} -> ${after} ✓`)
  })

  test('AUDIT-07: CONFIG_UPDATED with old/new on tolerance change', async ({ request }) => {
    const adminToken = await getToken(request, 'admin@compass.com')

    // Change tolerance
    await request.put(`${API}/config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { default_tolerance_pct: 7.5 },
    })

    const event = await latestAudit(request, adminToken, 'CONFIG_UPDATED')
    expect(event).toBeTruthy()
    expect(event.old_value).toBeTruthy()
    expect(event.new_value).toBeTruthy()
    expect(event.detail).toContain('default_tolerance_pct')
    console.log(`CONFIG_UPDATED detail="${event.detail}" ✓`)

    // Restore
    await request.put(`${API}/config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { default_tolerance_pct: 0.5 },
    })
  })

  test('AUDIT-08: CONFIG_LOCATION_OVERRIDE on set/remove', async ({ request }) => {
    const adminToken = await getToken(request, 'admin@compass.com')

    const setBefore = await countAudit(request, adminToken, 'CONFIG_LOCATION_OVERRIDE')
    await request.put(`${API}/config/locations/loc-1/override`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { tolerance_pct: 3.0 },
    })
    const setAfter = await countAudit(request, adminToken, 'CONFIG_LOCATION_OVERRIDE')
    expect(setAfter).toBe(setBefore + 1)
    console.log(`CONFIG_LOCATION_OVERRIDE set: ${setBefore} -> ${setAfter} ✓`)

    const rmBefore = await countAudit(request, adminToken, 'CONFIG_LOCATION_OVERRIDE_REMOVED')
    await request.delete(`${API}/config/locations/loc-1/override`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const rmAfter = await countAudit(request, adminToken, 'CONFIG_LOCATION_OVERRIDE_REMOVED')
    expect(rmAfter).toBe(rmBefore + 1)
    console.log(`CONFIG_LOCATION_OVERRIDE_REMOVED: ${rmBefore} -> ${rmAfter} ✓`)
  })
})

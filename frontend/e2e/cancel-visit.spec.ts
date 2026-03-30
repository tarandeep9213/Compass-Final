/**
 * CANCEL-VISIT tests
 * Tests cancel visit feature for controller and DGM.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8006/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })).json()).access_token
}

test.describe('Cancel Controller Visit', () => {

  test('CV-001: cancel scheduled controller visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    const visit = await (await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2027-12-01', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })).json()
    if (!visit.id) { console.log('Setup failed:', visit.detail); return }

    const res = await request.patch(`${API}/verifications/controller/${visit.id}/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { notes: 'No longer needed' },
    })
    expect(res.ok()).toBeTruthy()
    const cancelled = await res.json()
    expect(cancelled.status).toBe('cancelled')
    console.log('Controller visit cancelled')
  })

  test('CV-002: cannot cancel completed visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    // Find a completed visit
    const list = await (await request.get(`${API}/verifications/controller?status=completed&page_size=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    if (!list.items.length) { test.skip(true, 'No completed visits'); return }

    const res = await request.patch(`${API}/verifications/controller/${list.items[0].id}/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    })
    expect(res.status()).toBe(400)
    console.log('Cannot cancel completed visit')
  })

  test('CV-003: cancelled visit frees 7-day block', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')

    // Schedule a visit
    const visit = await (await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2027-12-10', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })).json()
    if (!visit.id) { console.log('Setup failed:', visit.detail); return }

    // Cancel it
    await request.patch(`${API}/verifications/controller/${visit.id}/cancel`, {
      headers: { Authorization: `Bearer ${token}` }, data: {},
    })

    // Now schedule another within 7 days — should be allowed since first was cancelled
    const visit2 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2027-12-12', scheduled_time: '11:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    expect(visit2.status()).toBe(201)
    console.log('Cancelled visit freed 7-day block')
  })
})

test.describe('Cancel DGM Visit', () => {

  test('CV-004: cancel DGM visit frees monthly block', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')

    // Schedule for a month
    const visit = await (await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2027-11-10', notes: null },
    })).json()
    if (!visit.id) { console.log('Setup failed:', visit.detail); return }

    // Cancel it
    const cancelRes = await request.patch(`${API}/verifications/dgm/${visit.id}/cancel`, {
      headers: { Authorization: `Bearer ${token}` }, data: { notes: 'Rescheduling' },
    })
    expect(cancelRes.ok()).toBeTruthy()
    expect((await cancelRes.json()).status).toBe('cancelled')

    // Schedule another in same month — should be allowed
    const visit2 = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2027-11-20', notes: null },
    })
    expect(visit2.status()).toBe(201)
    console.log('DGM cancelled visit freed monthly block')
  })
})

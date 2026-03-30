/**
 * VISIT-TIME-RULES: Tests time-aware validation for complete/miss/cancel.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8006/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })).json()).access_token
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

test.describe('Controller Time-Aware Actions', () => {

  test('VTR-001: cannot complete future visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    const visit = await (await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2028-07-01', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })).json()
    if (!visit.id) { console.log('Setup:', visit.detail); return }

    const res = await request.patch(`${API}/verifications/controller/${visit.id}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { signature_data: 'test', notes: 'test' },
    })
    expect(res.status()).toBe(400)
    console.log('Future complete blocked:', (await res.json()).detail)
  })

  test('VTR-002: cannot miss future visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    const visit = await (await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2028-07-10', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })).json()
    if (!visit.id) { console.log('Setup:', visit.detail); return }

    const res = await request.patch(`${API}/verifications/controller/${visit.id}/miss`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { missed_reason: 'test' },
    })
    expect(res.status()).toBe(400)
    console.log('Future miss blocked:', (await res.json()).detail)
  })

  test('VTR-003: can cancel future visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    const visit = await (await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-3', date: '2028-07-15', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })).json()
    if (!visit.id) { console.log('Setup:', visit.detail); return }

    const res = await request.patch(`${API}/verifications/controller/${visit.id}/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    })
    expect(res.ok()).toBeTruthy()
    console.log('Future cancel allowed ✓')
  })

  test('VTR-004: cannot complete past visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    // Use the existing past scheduled visit from earlier tests
    const list = await (await request.get(`${API}/verifications/controller?status=scheduled&page_size=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()

    const today = localToday()
    const pastVisit = list.items.find((v: {verification_date:string}) => v.verification_date < today)
    if (!pastVisit) { test.skip(true, 'No past scheduled visit'); return }

    const res = await request.patch(`${API}/verifications/controller/${pastVisit.id}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { signature_data: 'test' },
    })
    expect(res.status()).toBe(400)
    console.log('Past complete blocked:', (await res.json()).detail)
  })

  test('VTR-005: can miss past visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    const list = await (await request.get(`${API}/verifications/controller?status=scheduled&page_size=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()

    const today = localToday()
    const pastVisit = list.items.find((v: {verification_date:string}) => v.verification_date < today)
    if (!pastVisit) { test.skip(true, 'No past scheduled visit'); return }

    const res = await request.patch(`${API}/verifications/controller/${pastVisit.id}/miss`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { missed_reason: 'Travel issue' },
    })
    expect(res.ok()).toBeTruthy()
    console.log('Past miss allowed ✓')
  })

  test('VTR-006: cannot cancel past visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    const list = await (await request.get(`${API}/verifications/controller?status=scheduled&page_size=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()

    const today = localToday()
    const pastVisit = list.items.find((v: {verification_date:string}) => v.verification_date < today)
    if (!pastVisit) { test.skip(true, 'No past scheduled visit'); return }

    const res = await request.patch(`${API}/verifications/controller/${pastVisit.id}/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    })
    expect(res.status()).toBe(400)
    console.log('Past cancel blocked:', (await res.json()).detail)
  })
})

test.describe('DGM Time-Aware Actions', () => {

  test('VTR-007: DGM cannot complete future visit', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')
    const visit = await (await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2028-08-10', notes: null },
    })).json()
    if (!visit.id) { console.log('Setup:', visit.detail); return }

    const res = await request.patch(`${API}/verifications/dgm/${visit.id}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { signature_data: 'test' },
    })
    expect(res.status()).toBe(400)
    console.log('DGM future complete blocked:', (await res.json()).detail)
  })

  test('VTR-008: DGM cannot miss future/today visit', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')
    const today = localToday()
    const visit = await (await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2028-08-15', notes: null },
    })).json()
    if (!visit.id) { console.log('Setup:', visit.detail); return }

    const res = await request.patch(`${API}/verifications/dgm/${visit.id}/miss`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { missed_reason: 'test' },
    })
    expect(res.status()).toBe(400)
    console.log('DGM future miss blocked:', (await res.json()).detail)
  })

  test('VTR-009: DGM can cancel future visit', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')
    const visit = await (await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-3', date: '2028-08-20', notes: null },
    })).json()
    if (!visit.id) { console.log('Setup:', visit.detail); return }

    const res = await request.patch(`${API}/verifications/dgm/${visit.id}/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    })
    expect(res.ok()).toBeTruthy()
    console.log('DGM future cancel allowed ✓')
  })
})

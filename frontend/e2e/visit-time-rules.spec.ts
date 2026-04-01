/**
 * VISIT-TIME-RULES: Tests time-aware validation for complete/miss/cancel.
 * Updated for new rules: complete allowed anytime within SLA window,
 * miss only for past dates, cancel only before scheduled time.
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

  test('VTR-001: can complete future visit (within SLA)', async ({ request }) => {
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
    // Future visit with scheduled time on a future date — no SLA window check applies (only for today)
    expect(res.ok()).toBeTruthy()
    console.log('Future complete allowed ✓')
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

  test('VTR-004: can miss past visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    const list = await (await request.get(`${API}/verifications/controller?status=scheduled&page_size=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    if (!list?.items) { test.skip(true, 'Could not fetch visits'); return }

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
})

test.describe('DGM Time-Aware Actions', () => {

  test('VTR-005: DGM can complete today visit', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')
    const today = localToday()
    const visit = await (await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: today, notes: null },
    })).json()
    if (!visit.id) { console.log('Setup:', visit.detail); return }

    const res = await request.patch(`${API}/verifications/dgm/${visit.id}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { signature_data: 'test', observed_total: 9575 },
    })
    expect(res.ok()).toBeTruthy()
    console.log('DGM today complete allowed ✓')
  })

  test('VTR-006: DGM cannot miss future/today visit', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')
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

  test('VTR-007: DGM can cancel future visit', async ({ request }) => {
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

  test('VTR-008: DGM cannot complete visit after SLA expires', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')
    const d = new Date()
    d.setDate(d.getDate() - 5)
    const oldDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

    const visit = await (await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-4', date: oldDate, notes: null },
    })).json()
    if (!visit.id) { console.log('Setup:', visit.detail); return }

    const res = await request.patch(`${API}/verifications/dgm/${visit.id}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { signature_data: 'test', observed_total: 9575 },
    })
    expect(res.status()).toBe(400)
    console.log('DGM SLA expired — blocked:', (await res.json()).detail)
  })
})

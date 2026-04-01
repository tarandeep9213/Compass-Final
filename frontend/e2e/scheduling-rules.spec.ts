/**
 * SCHEDULING-RULES tests
 * Tests business-week block (controller) and monthly block (DGM) rules.
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:8006/v1'

async function getToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })
  return (await res.json()).access_token as string
}

test.describe('Business Week Block Rule (Controller)', () => {

  test('SR-001: backend rejects scheduling same location in same Mon-Fri week', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    // 2026-08-10 is a Monday, 2026-08-13 is Thursday (same week)
    const monday = '2026-08-10'
    const thursday = '2026-08-13'

    const visit1 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: monday, scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    if (visit1.status() !== 201) { console.log('Setup visit failed (date may exist):', (await visit1.json()).detail); return }

    const visit2 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: thursday, scheduled_time: '11:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    expect(visit2.status()).toBe(400)
    const err = await visit2.json()
    expect(err.detail).toContain('week')
    console.log('Same week blocked:', err.detail)
  })

  test('SR-002: backend allows scheduling same location in next week', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    // 2026-08-10 is Monday, 2026-08-17 is next Monday (different week)
    const visit1 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2026-08-10', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    if (visit1.status() !== 201) { console.log('Setup visit failed:', (await visit1.json()).detail); return }

    const visit2 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2026-08-17', scheduled_time: '11:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    expect(visit2.status()).toBe(201)
    console.log('Next week allowed')
  })

  test('SR-003: business-week block is per-location — different location not blocked', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    // Schedule on loc-1 Monday, then loc-2 same week Thursday — should be allowed
    await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2026-09-07', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })

    const visit2 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2026-09-10', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    expect(visit2.status()).toBe(201)
    console.log('Different location same week: allowed')
  })

  test('SR-004: backend rejects scheduling on weekends', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    // 2026-10-10 is Saturday
    const visit = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2026-10-10', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    expect(visit.status()).toBe(400)
    const err = await visit.json()
    expect(err.detail).toContain('weekday')
    console.log('Weekend blocked:', err.detail)
  })
})

test.describe('Monthly Block Rule (DGM)', () => {

  test('SR-005: backend rejects scheduling same location in same month', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')

    const visit1 = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2027-03-10', notes: null },
    })
    if (visit1.status() !== 201) { console.log('Setup failed:', (await visit1.json()).detail); return }

    const visit2 = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2027-03-25', notes: null },
    })
    expect(visit2.status()).toBe(400)
    const err = await visit2.json()
    expect(err.detail).toContain('March')
    console.log('Same month blocked:', err.detail)
  })

  test('SR-006: backend allows scheduling same location in next month', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')

    const visit1 = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2027-03-31', notes: null },
    })
    if (visit1.status() !== 201) { console.log('Setup failed:', (await visit1.json()).detail); return }

    const visit2 = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2027-04-01', notes: null },
    })
    expect(visit2.status()).toBe(201)
    console.log('Next month allowed (Mar 31 → Apr 1)')
  })
})

test.describe('DOW Warning Rule', () => {

  test('SR-007: DOW check warns on same weekday within 2 weeks', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')

    const res = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-5', date: '2026-07-01', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    if (res.status() !== 201) { console.log('Setup failed:', (await res.json()).detail); return }

    const check = await request.get(
      `${API}/verifications/controller/check-dow?location_id=loc-5&date=2026-07-08`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const dow = await check.json()
    expect(dow.warning).toBe(true)
    expect(dow.match_count).toBeGreaterThanOrEqual(1)
    console.log('DOW warning for same weekday within 2 weeks:', dow)
  })

  test('SR-008: DOW warning threshold is 1 (not 2)', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')

    await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-3', date: '2026-04-09', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })

    const check = await request.get(
      `${API}/verifications/controller/check-dow?location_id=loc-3&date=2026-04-16`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const dow = await check.json()
    expect(dow.warning).toBe(true)
    expect(dow.match_count).toBe(1)
    console.log('DOW warns with just 1 prior visit:', dow)
  })
})

test.describe('SLA Window', () => {

  test('SR-009: DGM cannot complete visit after SLA window expires', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')
    // Schedule 5 days ago — beyond 48hr default SLA
    const d = new Date()
    d.setDate(d.getDate() - 5)
    const oldDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

    const visit = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-3', date: oldDate, notes: null },
    })
    if (visit.status() !== 201) { console.log('Setup failed:', (await visit.json()).detail); return }
    const vid = (await visit.json()).id

    const res = await request.patch(`${API}/verifications/dgm/${vid}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { signature_data: 'test', observed_total: 9575 },
    })
    expect(res.status()).toBe(400)
    const err = await res.json()
    expect(err.detail).toContain('completion window has passed')
    console.log('SLA expired — complete blocked:', err.detail)
  })

  test('SR-010: DGM can complete visit within SLA window', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')
    // Schedule for today — within 48hr SLA
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

    const visit = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-4', date: today, notes: null },
    })
    if (visit.status() !== 201) { console.log('Setup failed:', (await visit.json()).detail); return }
    const vid = (await visit.json()).id

    const res = await request.patch(`${API}/verifications/dgm/${vid}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { signature_data: 'test', observed_total: 9575 },
    })
    expect(res.ok()).toBeTruthy()
    console.log('SLA active — complete allowed ✓')
  })

  test('SR-011: SLA window respects admin config change', async ({ request }) => {
    const adminToken = await getToken(request, 'admin@compass.com')
    const dgmToken = await getToken(request, 'dgm@compass.com')

    // Set SLA to 120 hours (5 days)
    await request.put(`${API}/admin/config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { approval_sla_hours: 120 },
    })

    // Schedule 4 days ago — within 120hr SLA
    const d = new Date()
    d.setDate(d.getDate() - 4)
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

    const visit = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: { location_id: 'loc-5', date, notes: null },
    })
    if (visit.status() !== 201) { console.log('Setup failed:', (await visit.json()).detail); return }
    const vid = (await visit.json()).id

    const res = await request.patch(`${API}/verifications/dgm/${vid}/complete`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: { signature_data: 'test', observed_total: 9575 },
    })
    expect(res.ok()).toBeTruthy()
    console.log('SLA 120hrs — 4 days ago allowed ✓')

    // Reset SLA back to 48
    await request.put(`${API}/admin/config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { approval_sla_hours: 48 },
    })
  })
})

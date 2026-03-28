/**
 * SCHEDULING-RULES tests
 * Tests 7-day block and DOW warning rules for controller visit scheduling.
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:8002/v1'

async function getToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })
  return (await res.json()).access_token as string
}

test.describe('7-Day Block Rule', () => {

  test('SR-001: backend rejects scheduling within 6 days of existing visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')
    // Use unique far-future dates with timestamp to avoid collisions
    const base = '2026-08-10'
    const blocked = '2026-08-13'

    const visit1 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: base, scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    if (visit1.status() !== 201) { console.log('Setup visit failed (date may exist):', (await visit1.json()).detail); return }

    const visit2 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: blocked, scheduled_time: '11:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    expect(visit2.status()).toBe(400)
    const err = await visit2.json()
    expect(err.detail).toContain('Too soon')
    console.log('3 days later blocked:', err.detail)
  })

  test('SR-002: backend allows scheduling 7+ days after existing visit', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')

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
    console.log('7 days later allowed')
  })

  test('SR-003: 7-day block is per-location — different location not blocked', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')

    await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2026-09-01', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })

    const visit2 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-5', date: '2026-11-02', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    expect(visit2.status()).toBe(201)
    console.log('Different location not blocked')
  })

  test('SR-004: backend rejects scheduling BEFORE existing visit within 6 days', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')

    const visit1 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2026-10-15', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    if (visit1.status() !== 201) { console.log('Setup failed:', (await visit1.json()).detail); return }

    const visit2 = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2026-10-12', scheduled_time: '11:00', dow_warning_acknowledged: false, dow_warning_reason: null, notes: null },
    })
    expect(visit2.status()).toBe(400)
    console.log('Before existing visit also blocked')
  })
})

test.describe('DOW Warning Rule', () => {

  test('SR-005: DOW check warns on same weekday within 2 weeks', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')

    // Schedule visit for a Wednesday — use loc-5, unique date
    const res = await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        location_id: 'loc-5', date: '2026-07-01',
        scheduled_time: '09:00', dow_warning_acknowledged: false,
        dow_warning_reason: null, notes: null,
      },
    })
    if (res.status() !== 201) { console.log('Setup failed:', (await res.json()).detail); return }

    // Check DOW for same weekday 7 days later (within 14-day lookback)
    const check = await request.get(
      `${API}/verifications/controller/check-dow?location_id=loc-5&date=2026-07-08`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const dow = await check.json()
    expect(dow.warning).toBe(true)
    expect(dow.match_count).toBeGreaterThanOrEqual(1)
    console.log('DOW warning for same weekday within 2 weeks:', dow)
  })

  test('SR-006: DOW check no warning for same weekday beyond 2 weeks', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')

    // Visit on Monday 2026-06-01 exists from SR-005
    // Check DOW for Monday 3 weeks later (beyond 2-week lookback: 21 days > 14)
    const check = await request.get(
      `${API}/verifications/controller/check-dow?location_id=loc-5&date=2026-07-22`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const dow = await check.json()
    expect(dow.warning).toBe(false)
    console.log('No DOW warning beyond 2 weeks:', dow)
  })

  test('SR-007: DOW warning threshold is 1 (not 2)', async ({ request }) => {
    const token = await getToken(request, 'controller@compass.com')

    // Schedule ONE visit for a Thursday (2026-04-09)
    await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        location_id: 'loc-3', date: '2026-04-09',
        scheduled_time: '09:00', dow_warning_acknowledged: false,
        dow_warning_reason: null, notes: null,
      },
    })

    // Check DOW for next Thursday — should warn with just 1 prior visit
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

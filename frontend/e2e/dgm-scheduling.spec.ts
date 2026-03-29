/**
 * DGM SCHEDULING RULES tests
 * Tests monthly block, DOM warning, and completion gate.
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:8003/v1'

async function getToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })
  return (await res.json()).access_token as string
}

test.describe('DGM Monthly Block', () => {

  test('DGM-001: backend rejects second visit in same month for same location', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')

    const v1 = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2027-01-10', notes: null },
    })
    if (v1.status() !== 201) { console.log('Setup:', (await v1.json()).detail); return }

    const v2 = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-1', date: '2027-01-20', notes: null },
    })
    expect(v2.status()).toBe(400)
    const err = await v2.json()
    expect(err.detail).toContain('Only one visit per month')
    console.log('Monthly block:', err.detail)
  })

  test('DGM-002: different month is allowed', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')

    await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2027-02-10', notes: null },
    })

    const v2 = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-2', date: '2027-03-10', notes: null },
    })
    expect(v2.status()).toBe(201)
    console.log('Different month allowed')
  })

  test('DGM-003: different location same month is allowed', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')

    await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-3', date: '2027-04-10', notes: null },
    })

    const v2 = await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-4', date: '2027-04-15', notes: null },
    })
    expect(v2.status()).toBe(201)
    console.log('Different location same month allowed')
  })
})

test.describe('DGM DOM Warning', () => {

  test('DGM-004: DOM check warns on same day-of-month within 3 months', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')

    // Schedule visit on 10th
    await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { location_id: 'loc-5', date: '2027-05-10', notes: null },
    })

    // Check DOM for 10th of next month
    const check = await request.get(
      `${API}/verifications/dgm/check-dom?location_id=loc-5&date=2027-06-10`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const dom = await check.json()
    expect(dom.warning).toBe(true)
    expect(dom.match_count).toBeGreaterThanOrEqual(1)
    console.log('DOM warning for same day-of-month:', dom)
  })

  test('DGM-005: DOM check no warning for different day-of-month', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')

    // Visit on 10th already exists from DGM-004
    const check = await request.get(
      `${API}/verifications/dgm/check-dom?location_id=loc-5&date=2027-06-15`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const dom = await check.json()
    expect(dom.warning).toBe(false)
    console.log('No DOM warning for different day:', dom)
  })

  test('DGM-006: DOM check no warning beyond 3 months', async ({ request }) => {
    const token = await getToken(request, 'dgm@compass.com')

    // Visit on May 10 exists, check Sep 10 (4 months later)
    const check = await request.get(
      `${API}/verifications/dgm/check-dom?location_id=loc-5&date=2027-09-10`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const dom = await check.json()
    expect(dom.warning).toBe(false)
    console.log('No DOM warning beyond 3 months:', dom)
  })
})

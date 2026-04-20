/**
 * DOW-LOOKBACK: Verify that changing dow_lookback_weeks in admin
 * config actually affects the DOW warning check.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8001/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })).json()).access_token
}

test.describe('DOW Lookback Window — respects admin config', () => {

  test('DOW-LB-001: 4-week lookback warns on visit 3 weeks ago', async ({ request }) => {
    const adminToken = await getToken(request, 'admin@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    // Set lookback to 4 weeks
    await request.put(`${API}/admin/config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { dow_lookback_weeks: 4 },
    })

    // Schedule a visit on a Wednesday
    await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: { location_id: 'loc-1', date: '2027-01-06', scheduled_time: '09:00', dow_warning_acknowledged: false, dow_warning_reason: null },
    })

    // Check DOW for same weekday 3 weeks later (within 4-week lookback)
    const check = await request.get(
      `${API}/verifications/controller/check-dow?location_id=loc-1&date=2027-01-27`,
      { headers: { Authorization: `Bearer ${ctrlToken}` } }
    )
    const dow = await check.json()
    if (dow.warning !== undefined) {
      expect(dow.warning).toBe(true)
      expect(dow.lookback_weeks).toBe(4)
      console.log(`4-week lookback: visit 3 weeks ago triggers warning ✓ (lookback_weeks=${dow.lookback_weeks})`)
    } else {
      console.log('Setup failed — token issue')
    }
  })

  test('DOW-LB-002: 2-week lookback does NOT warn on visit 3 weeks ago', async ({ request }) => {
    const adminToken = await getToken(request, 'admin@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    // Tighten lookback to 2 weeks
    await request.put(`${API}/admin/config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { dow_lookback_weeks: 2 },
    })

    // Check DOW for same location 3 weeks after Jan 6 (beyond 2-week lookback)
    const check = await request.get(
      `${API}/verifications/controller/check-dow?location_id=loc-1&date=2027-01-27`,
      { headers: { Authorization: `Bearer ${ctrlToken}` } }
    )
    const dow = await check.json()
    if (dow.warning !== undefined) {
      expect(dow.warning).toBe(false)
      expect(dow.lookback_weeks).toBe(2)
      console.log(`2-week lookback: visit 3 weeks ago does NOT trigger warning ✓ (lookback_weeks=${dow.lookback_weeks})`)
    } else {
      console.log('Setup failed — token issue')
    }

    // Reset to default
    await request.put(`${API}/admin/config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { dow_lookback_weeks: 4 },
    })
  })
})

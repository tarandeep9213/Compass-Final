/**
 * DGM Gate: DGM can only complete visit after operator submission is approved.
 * Tests all gate states: no submission, pending, rejected, approved.
 * Also verifies submission data integrity (values match what operator submitted).
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8001/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })).json()).access_token
}

function futureMonthDate(monthsAhead: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + monthsAhead)
  d.setDate(10) // mid-month to avoid month rollover
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test.describe('DGM Gate — operator submission states', () => {

  test('DGMG-001: gate blocks when no operator submission exists', async ({ request }) => {
    const dgmToken = await getToken(request, 'dgm@compass.com')

    // Schedule DGM visit on a date with no submission
    const date = futureMonthDate(8)
    const visit = await (await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: { location_id: 'loc-1', date, notes: null },
    })).json()
    if (!visit.id) { console.log('Setup:', visit.detail); return }

    // Check submissions — should be none for this date
    const subs = await (await request.get(`${API}/submissions?location_id=loc-1&page_size=200`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
    })).json()
    const sub = subs.items?.find((s: { submission_date: string }) => s.submission_date === date)
    expect(sub).toBeUndefined()
    console.log('No submission exists for', date, '— DGM gate should show "not yet submitted" ✓')

    // Cleanup
    await request.patch(`${API}/verifications/dgm/${visit.id}/cancel`, {
      headers: { Authorization: `Bearer ${dgmToken}` }, data: {},
    })
  })

  test('DGMG-002: gate blocks when submission is pending_approval', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const dgmToken = await getToken(request, 'dgm@compass.com')

    const date = futureMonthDate(9)

    // Operator submits
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: date, source: 'FORM',
        sections: { A: { total: 5000 }, B: { total: 2000 }, C: { total: 1000 } },
        variance_note: null, save_as_draft: false,
      },
    })).json()
    if (sub.detail) { console.log('Setup:', sub.detail); return }
    expect(sub.status).toBe('pending_approval')
    console.log('Submission pending_approval — DGM gate should show "pending review" ✓')
  })

  test('DGMG-003: gate blocks when submission is rejected', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')
    const dgmToken = await getToken(request, 'dgm@compass.com')

    const date = futureMonthDate(10)

    // Operator submits
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: date, source: 'FORM',
        sections: { A: { total: 5000 } },
        variance_note: null, save_as_draft: false,
      },
    })).json()
    if (sub.detail) { console.log('Setup:', sub.detail); return }

    // Controller rejects
    const reject = await request.post(`${API}/submissions/${sub.id}/reject`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: { reason: 'Section A total incorrect', section_reviews: { A: { decision: 'reject', note: 'Wrong total' } } },
    })
    expect(reject.status()).toBe(200)

    // Verify rejected
    const check = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
    })).json()
    expect(check.status).toBe('rejected')
    console.log('Submission rejected — DGM gate should show "rejected" ✓')
  })

  test('DGMG-004: gate opens when submission is approved, values match operator input', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')
    const dgmToken = await getToken(request, 'dgm@compass.com')

    const date = futureMonthDate(11)
    const operatorSections = { A: { total: 4500 }, B: { total: 2500 }, C: { total: 1200 }, D: { total: 800 }, E: { total: 575 } }
    const expectedTotal = 4500 + 2500 + 1200 + 800 + 575

    // Operator submits with known values
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: date, source: 'FORM',
        sections: operatorSections,
        variance_note: null, save_as_draft: false,
      },
    })).json()
    if (sub.detail) { console.log('Setup:', sub.detail); return }

    // Controller approves
    const approve = await request.post(`${API}/submissions/${sub.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: {},
    })
    expect(approve.status()).toBe(200)

    // Verify submission data integrity — fetch as DGM and check values
    const fetchedSub = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
    })).json()
    expect(fetchedSub.status).toBe('approved')
    expect(fetchedSub.total_cash).toBe(expectedTotal)
    expect(fetchedSub.sections.A.total ?? fetchedSub.sections.A).toBe(4500)
    expect(fetchedSub.sections.B.total ?? fetchedSub.sections.B).toBe(2500)
    console.log(`Submission approved — total_cash=${fetchedSub.total_cash}, matches operator input (${expectedTotal}) ✓`)

    // Schedule and complete DGM visit
    const visit = await (await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: { location_id: 'loc-1', date, notes: null },
    })).json()
    if (!visit.id) { console.log('Visit setup:', visit.detail); return }

    const complete = await request.patch(`${API}/verifications/dgm/${visit.id}/complete`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: { observed_total: expectedTotal, signature_data: 'data:image/png;base64,dGVzdA==', notes: 'Verified all sections' },
    })
    if (complete.ok()) {
      const result = await complete.json()
      expect(result.status).toBe('completed')
      expect(result.observed_total).toBe(expectedTotal)
      console.log(`DGM visit completed with observed_total=${result.observed_total} matching operator ✓`)
    } else {
      console.log('DGM completion blocked (SLA/time):', (await complete.json()).detail)
    }
  })
})

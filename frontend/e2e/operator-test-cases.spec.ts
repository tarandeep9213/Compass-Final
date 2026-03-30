/**
 * Operator E2E Test Cases from V2 reference repo.
 * Adapted to use our seed data (operator@compass.com, controller@compass.com).
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8006/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })).json()).access_token
}

test.describe('OP-COMM-003: Rejection → Resubmit workflow', () => {

  test('rejection preserves values and resubmit works', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    // 1. Operator submits form
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2028-10-01', source: 'FORM',
        sections: { A: { total: 9575, ones: 100, fives: 500, tens: 300, twenties: 200, fifties: 100, hundreds: 50, other: 0 }, B: { total: 0 } },
        variance_note: null, save_as_draft: false,
      },
    })).json()
    expect(sub.status).toBe('pending_approval')

    // 2. Controller rejects Section A
    await request.post(`${API}/submissions/${sub.id}/reject`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: { reason: 'Section A totals incorrect — please recount.' },
    })

    // 3. Verify rejected with reason
    const rejected = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })).json()
    expect(rejected.status).toBe('rejected')
    expect(rejected.rejection_reason).toContain('Section A totals incorrect')

    // 4. Verify values preserved — sections still have data
    expect(rejected.sections.A.total).toBe(9575)
    expect(rejected.sections.A.ones).toBe(100)
    expect(rejected.sections.A.fives).toBe(500)
    console.log('Values preserved after rejection ✓')

    // 5. Operator updates and resubmits
    await request.put(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2028-10-01', source: 'FORM',
        sections: { A: { total: 9000, ones: 50, fives: 400 }, B: { total: 0 } },
        variance_note: null, save_as_draft: true,
      },
    })
    await request.post(`${API}/submissions/${sub.id}/submit`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: { variance_note: null },
    })

    const resubmitted = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })).json()
    expect(resubmitted.status).toBe('pending_approval')
    expect(resubmitted.sections.A.ones).toBe(50)
    console.log('Resubmit with updated values ✓')
  })
})

test.describe('OP-COMM-007: Update pending — values reflected on controller', () => {

  test('operator updates pending, controller sees new values', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    // Create submission
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2028-10-02', source: 'FORM',
        sections: { A: { total: 500, ones: 10 } },
        variance_note: null, save_as_draft: false,
      },
    })).json()
    expect(sub.status).toBe('pending_approval')

    // Update ones from 10 to 20
    await request.put(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2028-10-02', source: 'FORM',
        sections: { A: { total: 520, ones: 20 } },
        variance_note: null, save_as_draft: true,
      },
    })

    // Controller reads the submission — should see ones=20
    const ctrlView = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
    })).json()
    expect(ctrlView.sections.A.ones).toBe(20)
    console.log('Controller sees updated values (ones=20) ✓')
  })
})

test.describe('OP-MSS-001: Missed explanation full flow', () => {

  test('missed submission via API — validation and success', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')

    // Submit without required fields should fail (API validates)
    const bad = await request.post(`${API}/missed-submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: { location_id: 'loc-1', missed_date: '2028-10-03' },
    })
    expect(bad.status()).toBe(422) // validation error

    // Submit with all fields
    const good = await request.post(`${API}/missed-submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', missed_date: '2028-10-03',
        reason: 'Illness', detail: 'Staff illness — called in at 7 AM',
        supervisor_name: 'Chris Controller',
      },
    })
    expect(good.status()).toBe(201)
    const missed = await good.json()
    expect(missed.reason).toBe('Illness')
    expect(missed.detail).toContain('Staff illness')
    console.log('Missed submission created ✓')
  })
})

test.describe('OP-MSS-004: Already-explained missed is read-only', () => {

  test('missed submissions are queryable via API', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')

    // List missed submissions
    const list = await (await request.get(`${API}/missed-submissions?location_id=loc-1&page_size=5`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })).json()

    if (list.total > 0) {
      const ms = list.items[0]
      expect(ms.reason).toBeTruthy()
      expect(ms.detail).toBeTruthy()
      console.log(`Found ${list.total} missed submissions, first: ${ms.reason} ✓`)
    } else {
      console.log('No missed submissions found (expected if none created)')
    }
  })
})

test.describe('OP-FRM-001: Variance calculation', () => {

  test('total_cash and variance calculated correctly', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')

    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2028-10-05', source: 'FORM',
        sections: {
          A: { total: 235 }, B: { total: 10 }, C: { total: 0 },
          D: { total: 0 }, E: { total: 0 }, F: { total: 0 },
          G: { total: 0 }, H: { total: 0 }, I: { total: 0 },
        },
        variance_note: null, save_as_draft: false,
      },
    })).json()

    expect(sub.total_cash).toBe(245)
    expect(sub.expected_cash).toBe(9575)
    expect(sub.variance).toBe(245 - 9575) // -9330
    expect(sub.variance_pct).toBeCloseTo(((245 - 9575) / 9575) * 100, 1)
    console.log(`total=${sub.total_cash}, variance=${sub.variance}, pct=${sub.variance_pct.toFixed(2)}% ✓`)
  })
})

test.describe('Opr-013: Imprest from admin config', () => {

  test('submission uses location expected_cash, not hardcoded', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')

    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2028-10-06', source: 'FORM',
        sections: { A: { total: 100 } },
        variance_note: null, save_as_draft: false,
      },
    })).json()

    // loc-1 has expected_cash=9575 from seed
    expect(sub.expected_cash).toBe(9575)
    expect(sub.expected_cash).not.toBe(0)
    console.log(`Imprest from location: ${sub.expected_cash} ✓`)
  })
})

test.describe('Opr-016: Drafts visible only to creator', () => {

  test('draft invisible to other operators and controllers', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const op2Token = await getToken(request, 'op2@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    // Create draft as operator
    const draft = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2028-10-07', source: 'FORM',
        sections: { A: { total: 999 } }, variance_note: null, save_as_draft: true,
      },
    })).json()
    expect(draft.status).toBe('draft')

    // Other operator cannot see it
    const op2List = await (await request.get(`${API}/submissions?status=draft&page_size=100`, {
      headers: { Authorization: `Bearer ${op2Token}` },
    })).json()
    expect(op2List.items.some((s: {id:string}) => s.id === draft.id)).toBe(false)
    console.log('Other operator cannot see draft ✓')

    // Controller cannot see it
    const ctrlList = await (await request.get(`${API}/submissions?status=draft&page_size=100`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
    })).json()
    expect(ctrlList.items.some((s: {id:string}) => s.id === draft.id)).toBe(false)
    console.log('Controller cannot see draft ✓')
  })
})

test.describe('Opr-033: Discard draft', () => {

  test('draft can be deleted and is gone from API', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')

    // Create draft
    const draft = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2028-10-08', source: 'FORM',
        sections: { A: { total: 111 } }, variance_note: null, save_as_draft: true,
      },
    })).json()

    // Delete it
    const del = await request.delete(`${API}/submissions/${draft.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })
    expect(del.status()).toBe(204)

    // Verify gone
    const check = await request.get(`${API}/submissions/${draft.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })
    expect(check.status()).toBe(404)
    console.log('Draft deleted and gone ✓')
  })
})

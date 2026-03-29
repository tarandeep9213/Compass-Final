/**
 * FULL-WORKFLOW: Complete Cash Count Lifecycle
 * Traces a submission from operator → controller approval → controller visit → DGM visit → RC dashboard
 * All via API calls to verify the complete data flow.
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = 'http://localhost:8003/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email, password: 'demo1234' } })).json()).access_token
}

test.describe('Full Cash Count Lifecycle', () => {
  const testDate = '2027-06-15'

  test('FULL-001: operator submit → controller approve → controller visit → DGM visit', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')
    const dgmToken = await getToken(request, 'dgm@compass.com')

    // ── Step 1: Operator creates submission ──
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: testDate, source: 'FORM',
        sections: { A: { total: 5000 }, B: { total: 500 }, C: { total: 0 }, D: { total: 0 },
          E: { total: 0 }, F: { total: 0 }, G: { total: 0 }, H: { total: 300 }, I: { total: -50 },
          holdover: 100, coin_transit: 3500 },
        variance_note: null, save_as_draft: false,
      },
    })).json()
    expect(sub.status).toBe('pending_approval')
    expect(sub.expected_cash).toBe(9575)
    console.log(`Step 1: Submission created (${sub.id.slice(0,8)}) — pending_approval`)

    // ── Step 2: Controller approves submission ──
    const approveRes = await request.post(`${API}/submissions/${sub.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrlToken}` }, data: {},
    })
    expect(approveRes.ok()).toBeTruthy()
    const approved = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })).json()
    expect(approved.status).toBe('approved')
    console.log('Step 2: Submission approved by controller')

    // ── Step 3: Controller schedules visit ──
    const ctrlVisit = await (await request.post(`${API}/verifications/controller`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: {
        location_id: 'loc-1', date: testDate, scheduled_time: '09:00',
        dow_warning_acknowledged: false, dow_warning_reason: null, notes: 'Lifecycle test',
      },
    })).json()
    expect(ctrlVisit.status).toBe('scheduled')
    console.log(`Step 3: Controller visit scheduled (${ctrlVisit.id.slice(0,8)})`)

    // ── Step 4: Controller completes visit with Approve outcome ──
    const completeRes = await request.patch(`${API}/verifications/controller/${ctrlVisit.id}/complete`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: { signature_data: 'data:image/png;base64,TEST_SIG', notes: '[VISIT APPROVED] — All verified' },
    })
    expect(completeRes.ok()).toBeTruthy()
    const completedCtrl = await completeRes.json()
    expect(completedCtrl.status).toBe('completed')
    console.log('Step 4: Controller visit completed with APPROVE')

    // ── Step 5: DGM schedules visit ──
    const dgmVisit = await (await request.post(`${API}/verifications/dgm`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: { location_id: 'loc-1', date: testDate, notes: 'DGM lifecycle test' },
    })).json()
    expect(dgmVisit.status).toBe('scheduled')
    console.log(`Step 5: DGM visit scheduled (${dgmVisit.id.slice(0,8)})`)

    // ── Step 6: DGM completes visit ──
    const dgmComplete = await request.patch(`${API}/verifications/dgm/${dgmVisit.id}/complete`, {
      headers: { Authorization: `Bearer ${dgmToken}` },
      data: { signature_data: 'data:image/png;base64,DGM_SIG', notes: '[VISIT APPROVED] — Coverage confirmed' },
    })
    expect(dgmComplete.ok()).toBeTruthy()
    console.log('Step 6: DGM visit completed')

    // ── Step 7: Verify all data via RC ──
    const rcToken = await getToken(request, 'rc@compass.com')
    const summary = await (await request.get(`${API}/reports/summary?date_from=${testDate}&date_to=${testDate}`, {
      headers: { Authorization: `Bearer ${rcToken}` },
    })).json()
    expect(summary.total_submissions).toBeGreaterThanOrEqual(1)
    expect(summary.approved).toBeGreaterThanOrEqual(1)
    console.log(`Step 7: RC sees — total:${summary.total_submissions} approved:${summary.approved}`)

    console.log('✅ FULL LIFECYCLE COMPLETE')
  })

  test('FULL-002: rejection → resubmit → re-approve cycle', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    // Create submission
    const sub = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2027-06-16', source: 'FORM',
        sections: { A: { total: 100 } }, variance_note: null, save_as_draft: false,
      },
    })).json()
    expect(sub.status).toBe('pending_approval')

    // Controller rejects
    await request.post(`${API}/submissions/${sub.id}/reject`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
      data: { reason: 'Section A too low' },
    })
    const rejected = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })).json()
    expect(rejected.status).toBe('rejected')
    expect(rejected.rejection_reason).toBe('Section A too low')
    console.log('Rejected with reason')

    // Operator updates and resubmits
    await request.put(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2027-06-16', source: 'FORM',
        sections: { A: { total: 5000 } }, variance_note: null, save_as_draft: true,
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
    console.log('Resubmitted after rejection')

    // Controller approves
    await request.post(`${API}/submissions/${sub.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrlToken}` }, data: {},
    })
    const final = await (await request.get(`${API}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${opToken}` },
    })).json()
    expect(final.status).toBe('approved')
    console.log('✅ Reject → Resubmit → Approve cycle complete')
  })

  test('FULL-003: draft → submit → approve lifecycle', async ({ request }) => {
    const opToken = await getToken(request, 'operator@compass.com')
    const ctrlToken = await getToken(request, 'controller@compass.com')

    // Create draft
    const draft = await (await request.post(`${API}/submissions`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: {
        location_id: 'loc-1', submission_date: '2027-06-17', source: 'FORM',
        sections: { A: { total: 200 } }, variance_note: null, save_as_draft: true,
      },
    })).json()
    expect(draft.status).toBe('draft')

    // Verify draft invisible to controller
    const ctrlList = await (await request.get(`${API}/submissions?status=draft&page_size=100`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
    })).json()
    expect(ctrlList.items.some((s: {id:string}) => s.id === draft.id)).toBe(false)
    console.log('Draft invisible to controller ✓')

    // Submit the draft
    await request.post(`${API}/submissions/${draft.id}/submit`, {
      headers: { Authorization: `Bearer ${opToken}` },
      data: { variance_note: null },
    })

    // Verify now visible to controller as pending
    const ctrlList2 = await (await request.get(`${API}/submissions?page_size=200`, {
      headers: { Authorization: `Bearer ${ctrlToken}` },
    })).json()
    const found = ctrlList2.items.find((s: {id:string}) => s.id === draft.id)
    expect(found).toBeTruthy()
    expect(found.status).toBe('pending_approval')
    console.log('Submitted draft visible to controller ✓')

    // Approve
    await request.post(`${API}/submissions/${draft.id}/approve`, {
      headers: { Authorization: `Bearer ${ctrlToken}` }, data: {},
    })
    console.log('✅ Draft → Submit → Approve lifecycle complete')
  })
})

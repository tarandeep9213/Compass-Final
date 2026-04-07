# Test Cases: Controller & DGM Visit Completion Flow

## Overview

This document covers E2E test cases for the "Mark as Complete" flow for both Controller and DGM roles. The approval gate has been removed — controllers and DGMs can now complete visits even when the operator hasn't submitted or the submission was rejected.

### Two Paths

| Path | Condition | Behavior |
|------|-----------|----------|
| **Path A** | Operator submitted (pending or approved) | Verifier views the form, approves/reviews sections inline, signs, and confirms |
| **Path B** | No submission OR submission was rejected | Verifier fills a blank cash count form (auto-approved), signs, and confirms |

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Operator | operator@compass.com | demo1234 |
| Controller | controller@compass.com | demo1234 |
| DGM | dgm@compass.com | demo1234 |
| Admin | admin@compass.com | demo1234 |

---

## How to Run Automated Tests

```bash
cd backend
python -m pytest tests/test_controller_completion_flow.py -v
```

Expected: **12 tests pass** (9 controller + 3 DGM)

---

## Controller Test Cases

### TC-C1: Path A (Approved) — Full Flow

**Precondition:** Operator has submitted and the submission has been approved.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `controller@compass.com` | Login successful |
| 2 | Navigate to Controller Dashboard | Dashboard loads with scheduled visits |
| 3 | Schedule a visit for loc-1 on a future date | Visit appears as "Scheduled" |
| 4 | Login as `operator@compass.com` in another session | Login successful |
| 5 | Submit a cash count form for loc-1 on the same date | Submission created with status "pending_approval" |
| 6 | Login as controller, go to Daily Review, approve the submission | Submission status changes to "approved" |
| 7 | Go to Controller Dashboard, click "Mark as Completed" on the visit | Expand panel shows "View & Approve" button with "Approved" badge |
| 8 | Click "View & Approve" | OpReadonly opens showing the operator's filled form with section review (Approve/Reject per section A-K) |
| 9 | Approve all sections, click "Submit Review" | Returns to Controller Dashboard, review saved |
| 10 | Add notes (optional), sign in the signature pad | Signature captured |
| 11 | Click "Confirm Completion" | Visit status changes to "completed", observed_total recorded |

**Automated test:** `TestPathA_Approved::test_full_flow`

---

### TC-C2: Path A (Pending) — Approve Inline

**Precondition:** Operator has submitted but it's still pending approval.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as controller | Login successful |
| 2 | Schedule a visit for loc-1 on a future date | Visit scheduled |
| 3 | Login as operator, submit cash count for same location+date | Submission status = "pending_approval" |
| 4 | Login as controller, click "Mark as Completed" on the visit | Expand panel shows "View & Approve" button with "Pending approval" badge |
| 5 | Click "View & Approve" | OpReadonly opens showing the form with section review enabled |
| 6 | Approve all sections, click "Submit Review" | Submission is approved inline, review saved to sessionStorage |
| 7 | Sign and click "Confirm Completion" | Visit completed successfully |

**Automated test:** `TestPathA_Pending::test_controller_approves_pending_then_completes`

---

### TC-C3: Path B (No Submission) — Controller Fills Form

**Precondition:** Operator has NOT submitted a cash count for the visit date.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as controller | Login successful |
| 2 | Schedule a visit for loc-2 on a future date | Visit scheduled |
| 3 | Click "Mark as Completed" on the visit (operator has not submitted) | Expand panel shows yellow banner: "No operator submission. Please fill the form." with "Fill Cash Count Form" button |
| 4 | Click "Fill Cash Count Form" | OpForm opens in verifier fill mode with "Submit & Complete" button |
| 5 | Fill in sections A-K with cash counts | Totals calculate correctly |
| 6 | Click "Submit & Complete" | Submission is created with `status: approved`, `submitted_by_role: CONTROLLER`. Navigates back to Controller Dashboard |
| 7 | Expand panel now shows "Form submitted & auto-approved" with signature pad | Sign |
| 8 | Click "Confirm Completion" | Visit completed with observed_total from controller's form |

**Automated tests:**
- `TestPathB_NoSubmission::test_controller_creates_submission_auto_approved`
- `TestPathB_NoSubmission::test_full_flow_with_visit_completion`

---

### TC-C4: Path B (Rejected) — Controller Replaces Rejected Form

**Precondition:** Operator submitted but the submission was rejected.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as operator, submit cash count for loc-1 | Submission pending |
| 2 | Login as controller, reject the submission with a reason | Submission status = "rejected" |
| 3 | Click "Mark as Completed" on the scheduled visit | Expand panel shows red banner: "Operator's form was rejected. Please fill a new cash count form." with "Fill Cash Count Form" button |
| 4 | Click "Fill Cash Count Form" | OpForm opens in verifier fill mode |
| 5 | Fill in corrected amounts, click "Submit & Complete" | New submission created (replaces rejected one), auto-approved with `submitted_by_role: CONTROLLER` |
| 6 | Sign and click "Confirm Completion" | Visit completed |

**Automated tests:**
- `TestPathB_Rejected::test_controller_replaces_rejected_submission`
- `TestPathB_Rejected::test_full_flow_rejected_then_complete`

---

## DGM Test Cases

### TC-D1: Path B (No Submission) — DGM Fills Form

**Precondition:** Operator has NOT submitted. DGM has a scheduled monthly visit.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `dgm@compass.com` | Login successful |
| 2 | Navigate to DGM Dashboard | Dashboard loads with scheduled visits |
| 3 | Schedule a DGM visit for a location on a future date | Visit appears as "Scheduled" |
| 4 | Click "Mark as Completed" (operator has not submitted) | Expand panel shows yellow banner: "No operator submission" with "Fill Cash Count Form" button |
| 5 | Click "Fill Cash Count Form" | OpForm opens in verifier fill mode |
| 6 | Fill in cash counts, click "Submit & Complete" | Submission created with `status: approved`, `submitted_by_role: DGM`, `approved_by_name: Diana DGM` |
| 7 | Sign and click "Confirm Completion" | Visit completed with observed_total from DGM's form |

**Automated tests:**
- `TestDGM_PathB_NoSubmission::test_dgm_creates_submission_auto_approved`
- `TestDGM_PathB_NoSubmission::test_dgm_full_flow_with_visit_completion`

---

### TC-D2: Path B (Rejected) — DGM Replaces Rejected Form

**Precondition:** Operator submitted but it was rejected by controller.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as operator, submit cash count | Submission pending |
| 2 | Login as controller, reject the submission | Submission status = "rejected" |
| 3 | Login as DGM, click "Mark as Completed" on the visit | Expand panel shows red banner: "Operator's form was rejected" with "Fill Cash Count Form" button |
| 4 | Click "Fill Cash Count Form" | OpForm opens |
| 5 | Fill corrected amounts, click "Submit & Complete" | New submission replaces rejected one, auto-approved with `submitted_by_role: DGM` |
| 6 | Sign and click "Confirm Completion" | Visit completed |

**Automated test:** `TestDGM_PathB_Rejected::test_dgm_replaces_rejected_submission`

---

### TC-D3: Path A (Pending/Approved) — DGM Views & Approves

**Precondition:** Operator has submitted (pending or approved).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as DGM | Login successful |
| 2 | Click "Mark as Completed" on a visit where operator has submitted | Expand panel shows "View & Approve" button with status badge |
| 3 | Click "View & Approve" | OpReadonly opens with section review form |
| 4 | Approve/reject each section (A-K) | Decisions recorded |
| 5 | If pending: submission is approved inline. Click "Submit Review" | Returns to DGM Dashboard |
| 6 | Sign and click "Confirm Completion" | Visit completed |

**Note:** This path follows the same logic as the controller Path A. No separate automated test since the backend endpoints are identical for approval.

---

## Edge Case Test Cases

### TC-E1: Operator Cannot Auto-Approve

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as operator | Login successful |
| 2 | Submit a form with `submitted_by_role: "CONTROLLER"` in the request body | Submission created but status = "pending_approval" (NOT auto-approved) |
| 3 | Verify the backend ignores the `submitted_by_role` body field and uses the actual user role | `submitted_by_role` is determined by `current_user.role`, not request body |

**Automated test:** `TestEdgeCases::test_operator_cannot_submit_as_controller`

---

### TC-E2: Cannot Replace Non-Rejected Submission

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Operator submits a form (pending approval) | Submission created |
| 2 | Controller tries to submit a new form for the same location+date | HTTP 409 Conflict — "A submission already exists" |
| 3 | Verify that only rejected submissions can be replaced | Pending and approved submissions are protected |

**Automated test:** `TestEdgeCases::test_controller_cannot_create_duplicate_non_rejected`

---

### TC-E3: `submitted_by_role` in API Responses

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `GET /v1/submissions?location_id=loc-2` | Returns list of submissions |
| 2 | Verify each submission has `submitted_by_role` field | Field present with value "OPERATOR", "CONTROLLER", or "DGM" |

**Automated test:** `TestEdgeCases::test_submitted_by_role_in_list_response`

---

## Test Results Summary

| # | Test Case | Status |
|---|-----------|--------|
| TC-C1 | Controller Path A (Approved) — Full Flow | PASS |
| TC-C2 | Controller Path A (Pending) — Approve Inline | PASS |
| TC-C3 | Controller Path B (No Submission) — Fill Form | PASS |
| TC-C4 | Controller Path B (Rejected) — Replace Form | PASS |
| TC-D1 | DGM Path B (No Submission) — Fill Form | PASS |
| TC-D2 | DGM Path B (Rejected) — Replace Form | PASS |
| TC-D3 | DGM Path A (Pending/Approved) — View & Approve | Manual |
| TC-E1 | Operator Cannot Auto-Approve | PASS |
| TC-E2 | Cannot Replace Non-Rejected Submission | PASS |
| TC-E3 | submitted_by_role in API Responses | PASS |

**Automated: 12/12 passed** | **Manual: 1 (TC-D3)**

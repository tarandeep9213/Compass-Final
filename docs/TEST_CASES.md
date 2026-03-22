# CashRoom Compliance System — Test Cases Document

**Version:** 1.0
**Date:** 2026-03-06
**Scope:** End-to-end functional test cases covering the full backend API + frontend integration

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Submission Flow — Operator](#2-submission-flow--operator)
3. [Approval Flow — Controller](#3-approval-flow--controller)
4. [Rejection and Resubmission Flow](#4-rejection-and-resubmission-flow)
5. [Missed Submission Logging](#5-missed-submission-logging)
6. [Controller Verification Visits](#6-controller-verification-visits)
7. [DGM Verification Visits](#7-dgm-verification-visits)
8. [Roster Import (Admin)](#8-roster-import-admin)
9. [User Management (Admin)](#9-user-management-admin)
10. [Location Management (Admin)](#10-location-management-admin)
11. [Compliance Dashboard](#11-compliance-dashboard)
12. [Reports](#12-reports)
13. [Audit Trail](#13-audit-trail)
14. [Access Control — Role Enforcement](#14-access-control--role-enforcement)
15. [Email Notification Triggers](#15-email-notification-triggers)

---

## 1. Authentication

### TC-AUTH-01: Successful Login
**Actor:** Any user
**Precondition:** User exists with `active=True`
**Steps:**
1. POST `/v1/auth/login` with `{"email": "operator@compass.com", "password": "demo1234"}`

**Expected Result:**
- HTTP 200
- Response contains `access_token`, `refresh_token`, `token_type: "bearer"`, `expires_in: 3600`
- `user.role` matches the user's stored role

---

### TC-AUTH-02: Invalid Password
**Steps:**
1. POST `/v1/auth/login` with `{"email": "operator@compass.com", "password": "wrongpass"}`

**Expected Result:**
- HTTP 401
- `detail: "Invalid email or password"`

---

### TC-AUTH-03: Inactive User Login
**Precondition:** User has `active=False`
**Steps:**
1. POST `/v1/auth/login` with correct credentials

**Expected Result:**
- HTTP 401
- `detail: "Account is inactive. Contact your administrator."`

---

### TC-AUTH-04: Token Refresh
**Steps:**
1. Obtain tokens via TC-AUTH-01
2. POST `/v1/auth/refresh` with `{"refresh_token": "<token>"}`

**Expected Result:**
- HTTP 200
- New `access_token` in response
- Old access token becomes invalid after expiry (1 hour)

---

### TC-AUTH-05: Get Current User Profile
**Steps:**
1. GET `/v1/auth/me` with valid `Authorization: Bearer <token>`

**Expected Result:**
- HTTP 200
- Returns `{id, name, email, role, location_ids, access_grants}`

---

## 2. Submission Flow — Operator

### TC-SUB-01: Create Submission (Direct Submit)
**Actor:** Operator
**Precondition:** Operator assigned to a location
**Steps:**
1. POST `/v1/submissions` with:
```json
{
  "location_id": "loc-appleton",
  "submission_date": "2026-03-06",
  "source": "FORM",
  "save_as_draft": false,
  "sections": {
    "A": {"total": 500.00, "denominations": {}},
    "B": {"total": 750.00, "denominations": {}}
  }
}
```

**Expected Result:**
- HTTP 201
- `status: "pending_approval"`
- `submitted_at` is set to current UTC time
- `total_cash: 1250.00`
- Audit event `SUBMISSION_CREATED` logged
- Email sent to all controllers assigned to `loc-appleton` (notification N-01)

---

### TC-SUB-02: Save as Draft
**Steps:**
1. POST `/v1/submissions` with `save_as_draft: true` and partial sections

**Expected Result:**
- HTTP 201
- `status: "draft"`
- `submitted_at: null`
- No email notifications sent

---

### TC-SUB-03: Update Draft
**Precondition:** Draft submission exists
**Steps:**
1. PUT `/v1/submissions/{draft_id}` with updated sections

**Expected Result:**
- HTTP 200
- `status` remains `"draft"`
- `total_cash` recalculated from updated sections

---

### TC-SUB-04: Submit Draft
**Precondition:** Draft submission exists
**Steps:**
1. POST `/v1/submissions/{draft_id}/submit` with `{"variance_note": null}`

**Expected Result:**
- HTTP 200
- `status: "pending_approval"`
- `submitted_at` is now set
- Audit event `SUBMISSION_SUBMITTED` logged
- Email sent to controllers at that location (notification N-02)

---

### TC-SUB-05: Operator Cannot Update Non-Draft
**Precondition:** Submission with `status: "pending_approval"`
**Steps:**
1. PUT `/v1/submissions/{submission_id}` with new sections

**Expected Result:**
- HTTP 400
- `detail: "Only draft submissions can be updated"`

---

### TC-SUB-06: Operator Cannot See Other Operator's Submissions
**Precondition:** Two operators with different `operator_id`
**Steps:**
1. GET `/v1/submissions` as Operator A
2. Verify submissions belonging to Operator B are absent

**Expected Result:**
- Only submissions where `operator_id == current_user.id` are returned

---

### TC-SUB-07: List Submissions with Filters
**Steps:**
1. GET `/v1/submissions?status=pending_approval&date_from=2026-03-01&date_to=2026-03-06`

**Expected Result:**
- HTTP 200
- `items` array with matching submissions
- `total`, `page`, `page_size`, `total_pages` present in response

---

## 3. Approval Flow — Controller

### Scenario 1: Same-Day Acceptance (TC-CTRL-APPROVE-01)
**Actor:** Controller
**Precondition:** A `pending_approval` submission exists for today at a location assigned to the controller
**Steps:**
1. GET `/v1/submissions?status=pending_approval&location_id=loc-appleton` — confirm submission is visible
2. POST `/v1/submissions/{submission_id}/approve` with `{"notes": null}`

**Expected Result:**
- HTTP 200
- `status: "approved"`
- `approved_by_name` = controller's name
- `approved_at` = current UTC timestamp
- Audit event `SUBMISSION_APPROVED` logged
- Operator receives `submission_approved.html` email (notification N-03)

---

### Scenario 2: Next-Day Acceptance (TC-CTRL-APPROVE-02)
**Actor:** Controller
**Precondition:** Submission was created on Day 1 (`submission_date: "2026-03-05"`), controller logs in on Day 2 (`2026-03-06`)
**Steps:**
1. GET `/v1/submissions?status=pending_approval` — submission from yesterday still visible
2. POST `/v1/submissions/{submission_id}/approve` with `{"notes": null}`

**Expected Result:**
- HTTP 200
- `status: "approved"`
- `submission_date` remains `"2026-03-05"` (original date preserved)
- `approved_at` reflects today's UTC time
- Operator email notification sent

---

### TC-CTRL-APPROVE-03: Cannot Approve Already-Approved Submission
**Steps:**
1. POST `/v1/submissions/{already_approved_id}/approve`

**Expected Result:**
- HTTP 400
- `detail: "Submission is not pending approval"`

---

### TC-CTRL-APPROVE-04: Non-Controller Cannot Approve
**Steps:**
1. POST `/v1/submissions/{id}/approve` as Operator role

**Expected Result:**
- HTTP 403
- `detail: "Not authorised to approve submissions"`

---

## 4. Rejection and Resubmission Flow

### TC-REJECT-01: Controller Rejects Submission
**Actor:** Controller
**Precondition:** `pending_approval` submission exists
**Steps:**
1. POST `/v1/submissions/{submission_id}/reject` with:
```json
{"reason": "Section B total does not match denomination breakdown"}
```

**Expected Result:**
- HTTP 200
- `status: "rejected"`
- `rejection_reason` = provided reason
- `approved_by_name` = controller's name (who rejected)
- Audit event `SUBMISSION_REJECTED` logged
- Operator receives `submission_rejected.html` email (notification N-04)

---

### TC-REJECT-02: Operator Resubmits After Rejection
**Precondition:** Submission in `rejected` state
**Steps:**
1. Operator creates a NEW submission (POST `/v1/submissions`) for the same location and date with corrected sections and `save_as_draft: false`

**Expected Result:**
- HTTP 201
- New submission ID issued (original rejected submission untouched)
- New submission `status: "pending_approval"`
- Controller receives email notification for the new submission

---

### TC-REJECT-03: Full Rejection → Resubmission → Acceptance Cycle (E2E)
**Steps:**
1. Operator submits (TC-SUB-01)
2. Controller rejects (TC-REJECT-01)
3. Operator resubmits (TC-REJECT-02)
4. Controller approves resubmission (TC-CTRL-APPROVE-01)

**Expected Result:**
- DB contains two submission records for same location+date: one `rejected`, one `approved`
- All four audit events logged in sequence: `SUBMISSION_CREATED`, `SUBMISSION_REJECTED`, `SUBMISSION_CREATED`, `SUBMISSION_APPROVED`
- Three email notifications sent: N-01 (create), N-04 (reject), N-01 (resubmit), N-03 (approve)

---

## 5. Missed Submission Logging

### TC-MISSED-01: Operator Logs Missed Day
**Steps:**
1. POST `/v1/missed-submissions` with:
```json
{
  "location_id": "loc-appleton",
  "missed_date": "2026-03-05",
  "reason": "equipment_failure",
  "detail": "Cash counting machine broke down at 14:00",
  "supervisor_name": "Jane Smith"
}
```

**Expected Result:**
- HTTP 201
- Record created in `missed_submissions` table
- Controllers at that location receive `missed_explanation.html` email (notification N-09)

---

### TC-MISSED-02: List Missed Submissions
**Steps:**
1. GET `/v1/missed-submissions?location_id=loc-appleton`

**Expected Result:**
- HTTP 200
- Paginated list with `missed_date`, `reason`, `detail`, `supervisor_name`, `logged_at`

---

## 6. Controller Verification Visits

### TC-CTRL-VISIT-01: Check DOW Warning
**Precondition:** Controller has visited same location on a Friday for the past 4 weeks
**Steps:**
1. GET `/v1/verifications/controller/check-dow?location_id=loc-appleton&date=2026-03-13`

**Expected Result:**
- HTTP 200
- `warning: true`
- `match_count >= 2`
- `previous_dates` lists recent Friday visits
- `day_name: "Friday"`

---

### TC-CTRL-VISIT-02: Schedule Controller Visit (No Warning)
**Steps:**
1. POST `/v1/verifications/controller` with:
```json
{
  "location_id": "loc-appleton",
  "date": "2026-03-10",
  "scheduled_time": "09:00",
  "dow_warning_acknowledged": false,
  "notes": ""
}
```

**Expected Result:**
- HTTP 201
- `status: "scheduled"`
- `verification_type: "CONTROLLER"`
- `warning_flag: false`
- All DGMs receive `visit_scheduled.html` email (notification N-05)

---

### TC-CTRL-VISIT-03: Schedule Visit with DOW Warning Acknowledged
**Steps:**
1. POST `/v1/verifications/controller` with `dow_warning_acknowledged: true`

**Expected Result:**
- HTTP 201
- `warning_flag: true` stored on the record

---

### TC-CTRL-VISIT-04: Complete Controller Visit
**Precondition:** A `scheduled` controller visit exists
**Steps:**
1. PATCH `/v1/verifications/controller/{visit_id}/complete` with:
```json
{
  "observed_total": 9575.00,
  "notes": "All cash accounted for, no discrepancies",
  "signature_data": null
}
```

**Expected Result:**
- HTTP 200
- `status: "completed"`
- `observed_total: 9575.00`
- All DGMs receive `visit_completed.html` email (notification N-06)

---

### TC-CTRL-VISIT-05: Mark Controller Visit as Missed
**Steps:**
1. PATCH `/v1/verifications/controller/{visit_id}/miss` with:
```json
{"missed_reason": "Travel or transport issue", "notes": ""}
```

**Expected Result:**
- HTTP 200
- `status: "missed"`
- `missed_reason` stored

---

### TC-CTRL-VISIT-06: Non-Controller Cannot Schedule Controller Visit
**Steps:**
1. POST `/v1/verifications/controller` as Operator role

**Expected Result:**
- HTTP 403

---

### TC-CTRL-VISIT-07: List Controller Verifications (Scoped)
**Steps:**
1. GET `/v1/verifications/controller` as Controller role

**Expected Result:**
- Only visits where `verifier_id == current_user.id` are returned

---

## 7. DGM Verification Visits

### TC-DGM-VISIT-01: Schedule DGM Monthly Visit
**Steps:**
1. POST `/v1/verifications/dgm` with:
```json
{
  "location_id": "loc-1",
  "date": "2026-03-24",
  "notes": "Monthly cash room inspection"
}
```

**Expected Result:**
- HTTP 201
- `status: "scheduled"`
- `verification_type: "DGM"`
- `month_year: "2026-03"`
- All Regional Controllers receive `visit_scheduled.html` email (notification N-07)

---

### TC-DGM-VISIT-02: Complete DGM Visit
**Steps:**
1. PATCH `/v1/verifications/dgm/{visit_id}/complete` with `observed_total: 9600.00`

**Expected Result:**
- HTTP 200
- `status: "completed"`
- Regional Controllers receive `visit_completed.html` email (notification N-08)

---

### TC-DGM-VISIT-03: DGM Cannot Schedule Controller Visit
**Steps:**
1. POST `/v1/verifications/controller` as DGM role

**Expected Result:**
- HTTP 403

---

### TC-DGM-VISIT-04: List DGM Verifications by Month
**Steps:**
1. GET `/v1/verifications/dgm?month_year=2026-03` as DGM

**Expected Result:**
- Only DGM-type visits with `month_year="2026-03"` returned

---

## 8. Roster Import (Admin)

### TC-IMPORT-01: Import Valid Roster from Excel (Frontend)
**Actor:** Admin
**Precondition:** Valid `User_details.xlsx` with columns: Location Name, District, Cashroom Lead, Daily Reviewer, Controller, DGM, Regional Controller
**Steps:**
1. Navigate to Admin > Import page in the frontend
2. Upload `User_details.xlsx`
3. Click Import

**Expected Result:**
- POST `/v1/admin/import` called with parsed rows
- Response shows `locations_created`, `locations_updated`, `users_created`, `users_updated`, `assignments_created`
- Location IDs generated as `loc-{district-name-slug}` (e.g., `loc-appleton`)
- User emails auto-generated as `first.last@compass.com`
- Default password set to `demo1234` for all created users
- Same user appearing in multiple rows (e.g., shared controller) deduplicated — created once, assigned to all locations

---

### TC-IMPORT-02: Duplicate User Deduplication
**Precondition:** Controller "Mark Taylor" appears in 3 rows (same controller covers 3 locations)
**Steps:**
1. Run import with those 3 rows

**Expected Result:**
- `users_created: 1` (for Mark Taylor)
- Mark Taylor has all 3 location IDs in his `location_ids`
- No UNIQUE constraint violation on `users.email`

---

### TC-IMPORT-03: Idempotent Re-import
**Steps:**
1. Import same file twice

**Expected Result:**
- Second import: `locations_created: 0`, `locations_updated: N`
- No duplicate users; existing users get updated assignments

---

### TC-IMPORT-04: Non-Admin Cannot Import
**Steps:**
1. POST `/v1/admin/import` as Controller role

**Expected Result:**
- HTTP 403

---

## 9. User Management (Admin)

### TC-USER-01: Create User
**Steps:**
1. POST `/v1/admin/users` with `{name, email, role, location_ids, password}`

**Expected Result:**
- HTTP 201
- Audit event `USER_CREATED` logged

---

### TC-USER-02: Update User
**Steps:**
1. PUT `/v1/admin/users/{user_id}` with changed `role` or `location_ids`

**Expected Result:**
- HTTP 200
- Audit event `USER_UPDATED` logged

---

### TC-USER-03: Deactivate User (Soft Delete)
**Steps:**
1. DELETE `/v1/admin/users/{user_id}`

**Expected Result:**
- HTTP 200
- User `active` set to `false`; record not deleted
- Audit event `USER_DEACTIVATED` logged
- Deactivated user cannot login (TC-AUTH-03)

---

## 10. Location Management (Admin)

### TC-LOC-01: Create Location
**Steps:**
1. POST `/v1/admin/locations` with `{name, city, address, expected_cash, tolerance_pct, sla_hours}`

**Expected Result:**
- HTTP 201
- Location appears in list
- Audit event `LOCATION_CREATED` logged

---

### TC-LOC-02: Update Location Tolerance Override
**Steps:**
1. PUT `/v1/admin/locations/{loc_id}` with `{tolerance_pct: 3.0}`

**Expected Result:**
- HTTP 200
- `effective_tolerance_pct: 3.0` in response
- `has_override: true`
- Submissions at that location use 3% threshold for variance exception

---

### TC-LOC-03: Deactivate Location
**Steps:**
1. DELETE `/v1/admin/locations/{loc_id}`

**Expected Result:**
- Location `active` set to `false`
- Location no longer appears on compliance dashboard
- Audit event `LOCATION_DEACTIVATED` logged

---

## 11. Compliance Dashboard

### TC-COMPLIANCE-01: Dashboard Data
**Steps:**
1. GET `/v1/compliance/dashboard` as Controller

**Expected Result:**
- Response contains `summary` with `overall_compliance_pct`, `submitted_today`, `total_locations`, `overdue_count`, `variance_exceptions_today`, `controller_issues`, `dgm_coverage_this_month`
- `locations` array with per-location health status (red/amber/green)
- Location without today's submission shows `health: "red"`
- Location with pending submission shows `health: "amber"`
- Location with approved submission and no overdue ctrl visit shows `health: "green"`

---

### TC-COMPLIANCE-02: Location Health Logic
**Test Matrix:**

| Condition | Expected Health |
|-----------|----------------|
| No submission today | red |
| Submission rejected | red |
| Variance exception (pending) | amber |
| Pending approval | amber |
| Controller visit > 30 days ago | amber |
| Approved, all checks pass | green |

---

## 12. Reports

### TC-REPORT-01: Summary Report
**Steps:**
1. GET `/v1/reports/summary?date_from=2026-02-01&date_to=2026-03-06`

**Expected Result:**
- Returns `{total_submissions, approved, rejected, pending, approval_rate_pct, variance_exceptions, avg_variance_pct, controller_verifications, dgm_visits}`

---

### TC-REPORT-02: Location Breakdown Report
**Steps:**
1. GET `/v1/reports/locations?date_from=2026-01-01&date_to=2026-03-06`

**Expected Result:**
- Paginated list of locations with `{total, approved, rejected, exceptions}` per location

---

### TC-REPORT-03: Exception Report
**Steps:**
1. GET `/v1/reports/exceptions?date_from=2026-01-01&date_to=2026-03-06`

**Expected Result:**
- List of submissions where `variance_exception=true`
- Includes `variance_pct`, `variance_note`, `status`

---

### TC-REPORT-04: Section Trend Analysis
**Steps:**
1. GET `/v1/reports/section-trends?section=A&granularity=monthly&periods=6`

**Expected Result:**
- Returns `{data: [{period, avg_total}], summary: {latest_value, previous_value, change_pct, period_avg, peak}}`

---

### TC-REPORT-05: CSV Export
**Steps:**
1. GET `/v1/reports/export?date_from=2026-01-01&date_to=2026-03-06`

**Expected Result:**
- HTTP 200 with `Content-Type: text/csv`
- File `cashroom_report_2026-01-01_2026-03-06.csv` downloaded
- CSV rows contain: Date, Location, Operator, Status, Total Cash, Variance, Variance %, Exception

---

## 13. Audit Trail

### TC-AUDIT-01: View Audit Log
**Steps:**
1. GET `/v1/audit` as Admin

**Expected Result:**
- Paginated list of `audit_events`
- Each event has: `event_type`, `actor_name`, `actor_role`, `location_name`, `detail`, `created_at`

---

### TC-AUDIT-02: Filter Audit Log
**Steps:**
1. GET `/v1/audit?event_type=SUBMISSION_APPROVED&date_from=2026-03-01`

**Expected Result:**
- Only `SUBMISSION_APPROVED` events on or after 2026-03-01

---

### TC-AUDIT-03: Audit Log Immutability
**Verification:** No UPDATE or DELETE SQL issued against `audit_events` table
**Expected Result:**
- Log entries cannot be modified or deleted through any API endpoint

---

## 14. Access Control — Role Enforcement

### TC-RBAC-01: Operator Scope
| Action | Expected |
|--------|----------|
| POST /submissions | 201 (own location) |
| POST /submissions/{id}/approve | 403 |
| POST /verifications/controller | 403 |
| GET /admin/users | 403 |

### TC-RBAC-02: Controller Scope
| Action | Expected |
|--------|----------|
| POST /submissions/{id}/approve | 200 |
| POST /submissions/{id}/reject | 200 |
| POST /verifications/controller | 201 |
| POST /verifications/dgm | 403 |
| GET /admin/users | 403 |

### TC-RBAC-03: DGM Scope
| Action | Expected |
|--------|----------|
| POST /verifications/dgm | 201 |
| POST /verifications/controller | 403 |
| POST /submissions/{id}/approve | 403 |
| GET /admin/users | 403 |

### TC-RBAC-04: Admin Full Access
| Action | Expected |
|--------|----------|
| GET /admin/users | 200 |
| POST /admin/locations | 201 |
| DELETE /admin/users/{id} | 200 |
| GET /compliance/dashboard | 200 (all locations) |

---

## 15. Email Notification Triggers

| Test Case | Event | Trigger | Recipient |
|-----------|-------|---------|-----------|
| TC-NOTIF-01 | N-01 | POST /submissions (not draft) | Controllers at location |
| TC-NOTIF-02 | N-02 | POST /submissions/{id}/submit | Controllers at location |
| TC-NOTIF-03 | N-03 | POST /submissions/{id}/approve | Operator |
| TC-NOTIF-04 | N-04 | POST /submissions/{id}/reject | Operator |
| TC-NOTIF-05 | N-05 | POST /verifications/controller | All DGMs |
| TC-NOTIF-06 | N-06 | PATCH /verifications/controller/{id}/complete | All DGMs |
| TC-NOTIF-07 | N-07 | POST /verifications/dgm | All Regional Controllers |
| TC-NOTIF-08 | N-08 | PATCH /verifications/dgm/{id}/complete | All Regional Controllers |
| TC-NOTIF-09 | N-09 | POST /missed-submissions | Controllers at location |

**Verification method:** All emails sent via `BackgroundTasks` (non-blocking). In test environment, set `MAIL_SUPPRESS_SEND=True` in environment and assert the background task was enqueued by checking the mock email outbox.

---

## Appendix: Test Data Reference

### Demo Accounts (password: `demo1234`)

| Email | Role | Locations |
|-------|------|-----------|
| operator@compass.com | OPERATOR | loc-1 |
| controller@compass.com | CONTROLLER | loc-1, loc-2, loc-3 |
| dgm@compass.com | DGM | loc-1 |
| admin@compass.com | ADMIN | all |
| regional@compass.com | REGIONAL_CONTROLLER | all |

### Seeded Verification Data

| Controller | Location | History |
|------------|----------|---------|
| terri.serrano@compass.com | APPLETON | 6 past + 3 scheduled; DOW warning on next Friday |
| connie.ping@compass.com | CENTRAL IL | 4 past + 2 scheduled |
| controller@compass.com | loc-1, loc-2, loc-3 | 4 each + 2 scheduled each |
| akilah.bililty@compass.com | OMAHA | 4 past + 2 scheduled |

| DGM | Location | History |
|-----|----------|---------|
| john.ranallo@compass.com | APPLETON | 5 monthly + 2 upcoming |
| gregg.berndt@compass.com | DES MOINES | 4 monthly + 2 upcoming |
| dgm@compass.com | The Grange Hotel | 5 monthly + 2 upcoming |
| bill.zonzo@compass.com | MADISON | 4 monthly + 2 upcoming |

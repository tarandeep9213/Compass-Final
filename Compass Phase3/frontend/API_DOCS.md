# API Documentation
# Compass CashRoom Compliance System (CCS)

**Version:** 1.0
**Based on:** PRD v2.0 + DB Design v1.0
**Base URL:** `https://api.yourdomain.com/v1`
**Protocol:** HTTPS only
**Format:** JSON request and response bodies
**Auth:** Bearer JWT on all endpoints except `/v1/auth/login` and `/health`

---

## Table of Contents

1. [Global Conventions](#1-global-conventions)
2. [Authentication](#2-authentication)
3. [Submissions](#3-submissions)
4. [Missed Submissions](#4-missed-submissions)
5. [Verifications — Controller](#5-verifications--controller)
6. [Verifications — DGM](#6-verifications--dgm)
7. [Admin — Locations](#7-admin--locations)
8. [Admin — Users](#8-admin--users)
9. [Admin — Config](#9-admin--config)
10. [Admin — Access Grants](#10-admin--access-grants)
11. [Admin — Roster Import](#11-admin--roster-import)
12. [Compliance Dashboard](#12-compliance-dashboard)
13. [Reports](#13-reports)
14. [Audit Trail](#14-audit-trail)
15. [Health Check](#15-health-check)
16. [Error Reference](#16-error-reference)

---

## 1. Global Conventions

### Request Headers

```
Authorization: Bearer <jwt_token>      # Required on all protected endpoints
Content-Type: application/json         # Required on all POST/PUT/PATCH requests
```

### Pagination

All list endpoints support:

| Query Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page number |
| `page_size` | integer | `10` | Items per page (max 100) |

Paginated response shape:
```json
{
  "items": [...],
  "total": 142,
  "page": 1,
  "page_size": 10,
  "total_pages": 15
}
```

### Date format

All dates use `YYYY-MM-DD`. All timestamps use ISO 8601 UTC: `2026-03-05T14:32:00Z`.

### Currency

All currency fields are returned as numbers with 2 decimal places: `9620.50`.

### Role enforcement

Every endpoint enforces the required role server-side. A valid JWT with the wrong role returns `403 Forbidden`.

### Audit events

Every state-changing endpoint (POST/PUT/PATCH/DELETE that modifies business data) writes an audit event **within the same database transaction**. If the audit write fails, the entire operation rolls back.

---

## 2. Authentication

### POST /v1/auth/login

Authenticate and receive a JWT token.

**Auth required:** No

**Request body:**
```json
{
  "email": "controller@compass.com",
  "password": "demo1234"
}
```

**Validation:**
- `email`: required, non-empty string
- `password`: required, non-empty string

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Chris Controller",
    "email": "controller@compass.com",
    "role": "CONTROLLER",
    "location_ids": ["LHR-T5-01", "LHR-T5-02", "LHR-T3-01"],
    "access_grants": []
  }
}
```

**JWT payload (internal):**
```json
{
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "role": "CONTROLLER",
  "email": "controller@compass.com",
  "exp": 1741478400
}
```

**Error responses:**
- `401` — Invalid email or password (same message for both — do not distinguish)
- `422` — Missing or empty email/password fields

---

### GET /v1/auth/me

Get the current authenticated user's full profile.

**Auth required:** Yes (any role)

**Response `200 OK`:**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Chris Controller",
  "email": "controller@compass.com",
  "role": "CONTROLLER",
  "location_ids": ["LHR-T5-01", "LHR-T5-02"],
  "access_grants": ["operator"],
  "active": true
}
```

`access_grants` is an array of `"operator"` and/or `"controller"` strings. Empty array if no grants.

---

### POST /v1/auth/refresh

Refresh an access token before it expires.

**Auth required:** Yes (any role, token must not be expired)

**Request body:** none

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

---

## 3. Submissions

### GET /v1/submissions

List submissions. Results are filtered by the caller's role and location assignments.

**Auth required:** OPERATOR, CONTROLLER, ADMIN, REGIONAL_CONTROLLER, AUDITOR

**Role behaviour:**
- `OPERATOR` — only sees their own submissions for their assigned locations
- `CONTROLLER` — sees all submissions for their assigned locations (all operators)
- `ADMIN`, `REGIONAL_CONTROLLER`, `AUDITOR` — sees all submissions across all locations

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `location_id` | string | Filter to a specific location |
| `status` | string | `draft`, `pending_approval`, `approved`, `rejected` |
| `date_from` | date | Inclusive start date (`YYYY-MM-DD`) |
| `date_to` | date | Inclusive end date (`YYYY-MM-DD`) |
| `operator_id` | UUID | Filter by operator (ADMIN/CONTROLLER/RC only) |
| `page` | integer | Default 1 |
| `page_size` | integer | Default 10, max 100 |

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "a1b2c3d4-...",
      "location_id": "LHR-T5-01",
      "location_name": "Heathrow T5 - Unit 01",
      "operator_id": "uuid-...",
      "operator_name": "Alex Operator",
      "submission_date": "2026-03-05",
      "status": "pending_approval",
      "source": "FORM",
      "total_cash": 9620.50,
      "expected_cash": 9575.00,
      "variance": 45.50,
      "variance_pct": 0.4751,
      "variance_exception": false,
      "variance_note": null,
      "approved_by": null,
      "approved_by_name": null,
      "approved_at": null,
      "rejection_reason": null,
      "submitted_at": "2026-03-05T18:22:00Z",
      "created_at": "2026-03-05T17:45:00Z",
      "updated_at": "2026-03-05T18:22:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 10,
  "total_pages": 5
}
```

---

### POST /v1/submissions

Create a new submission or save a draft.

**Auth required:** OPERATOR

**Request body:**
```json
{
  "location_id": "LHR-T5-01",
  "submission_date": "2026-03-05",
  "source": "FORM",
  "sections": {
    "A": { "100": 5, "50": 2, "20": 10, "10": 0, "5": 4, "2": 0, "1": 3 },
    "B": { "1.00": 20, "0.50": 10, "0.25": 40, "0.10": 5, "0.05": 2, "0.01": 0 },
    "C": { "25_dollar_bags": 2, "10_quarter_bags": 1, "5_dime_bags": 0, "2_nickel_bags": 0, "50_bulkers": 0 },
    "D": { "rows": [{"qty": 2, "amount": 50.00}, {"qty": 0, "amount": 0}, {"qty": 0, "amount": 0}, {"qty": 0, "amount": 0}] },
    "E": { "row1": 120.00, "row2": 55.00, "row3": 0.00, "row4": 0.00 },
    "F": { "amount1": 0.00, "amount2": 0.00, "amount3": 0.00 },
    "G": { "currency": 0.00, "coin": 0.00 },
    "H": { "amount": 500.00 },
    "I": { "shortage": 0.00, "overage": 0.00 }
  },
  "variance_note": null,
  "save_as_draft": false
}
```

**Field notes:**
- `save_as_draft: true` → creates/updates with `status='DRAFT'`. No variance note required.
- `save_as_draft: false` → finalises to `status='PENDING_APPROVAL'`. Triggers all validations.
- All section data is optional when `save_as_draft: true`.
- `variance_note` required (min 10 chars) when `save_as_draft: false` AND `|variance_pct| > effective_tolerance`.

**Server-side calculations on submit:**
1. Calculate section totals (A–I) from denomination data.
2. Calculate `total_cash` = sum of all section totals.
3. Snapshot `expected_cash` from location (with override check).
4. Calculate `variance` = `total_cash - expected_cash`.
5. Calculate `variance_pct` = `(variance / expected_cash) * 100`.
6. Set `variance_exception` = `|variance_pct| > effective_tolerance`.
7. If `variance_exception = true` and no `variance_note` → return `422`.
8. Check no APPROVED or PENDING submission exists for this `(location_id, submission_date)` → `409` if found.
9. Check `submission_date <= today` → `422` if future date.

**Business logic for resubmit (operator resubmitting a REJECTED submission):**
- If a REJECTED submission exists for `(location_id, submission_date)`, UPDATE it rather than INSERT.
- Reset `status`, `approved_by`, `approved_at`, `rejection_reason`, `submitted_at`.
- Delete existing `submission_sections` and re-insert.

**Response `201 Created`:**
```json
{
  "id": "a1b2c3d4-...",
  "status": "pending_approval",
  "total_cash": 9620.50,
  "expected_cash": 9575.00,
  "variance": 45.50,
  "variance_pct": 0.4751,
  "variance_exception": false,
  "submitted_at": "2026-03-05T18:22:00Z"
}
```

**Error responses:**
- `403` — Operator not assigned to this location
- `409` — Approved or pending submission already exists for this date
- `422` — Validation failure (future date, variance note missing, at-least-one-section rule)

**Audit event written:** `SUBMISSION_CREATED`

---

### GET /v1/submissions/{id}

Get a single submission with all section detail.

**Auth required:** OPERATOR (own submissions only), CONTROLLER (assigned locations), ADMIN, RC, AUDITOR

**Response `200 OK`:**
```json
{
  "id": "a1b2c3d4-...",
  "location_id": "LHR-T5-01",
  "location_name": "Heathrow T5 - Unit 01",
  "operator_id": "uuid-...",
  "operator_name": "Alex Operator",
  "submission_date": "2026-03-05",
  "status": "approved",
  "source": "FORM",
  "total_cash": 9620.50,
  "expected_cash": 9575.00,
  "variance": 45.50,
  "variance_pct": 0.4751,
  "variance_exception": false,
  "variance_note": null,
  "approved_by": "uuid-controller",
  "approved_by_name": "Chris Controller",
  "approved_at": "2026-03-05T20:10:00Z",
  "rejection_reason": null,
  "submitted_at": "2026-03-05T18:22:00Z",
  "sections": {
    "A": { "total": 8003.00, "denominations": { "100": 5, "50": 2, "20": 10, "10": 0, "5": 4, "2": 0, "1": 3 } },
    "B": { "total": 52.60, "denominations": { "1.00": 20, "0.50": 10, "0.25": 40, "0.10": 5, "0.05": 2, "0.01": 0 } },
    "C": { "total": 70.00, "denominations": { "25_dollar_bags": 2, "10_quarter_bags": 1, "5_dime_bags": 0, "2_nickel_bags": 0, "50_bulkers": 0 } },
    "D": { "total": 100.00, "denominations": { "rows": [{"qty": 2, "amount": 50.00}, {"qty": 0, "amount": 0}, {"qty": 0, "amount": 0}, {"qty": 0, "amount": 0}] } },
    "E": { "total": 175.00, "denominations": { "row1": 120.00, "row2": 55.00, "row3": 0.00, "row4": 0.00 } },
    "F": { "total": 0.00, "denominations": { "amount1": 0.00, "amount2": 0.00, "amount3": 0.00 } },
    "G": { "total": 0.00, "denominations": { "currency": 0.00, "coin": 0.00 } },
    "H": { "total": 500.00, "denominations": { "amount": 500.00 } },
    "I": { "total": 0.00, "denominations": { "shortage": 0.00, "overage": 0.00 } }
  }
}
```

**Error responses:**
- `403` — Access denied (operator accessing another operator's submission, or location not assigned)
- `404` — Submission not found

---

### PUT /v1/submissions/{id}

Update a DRAFT submission. Cannot update a submitted (non-DRAFT) submission.

**Auth required:** OPERATOR (own submissions only)

**Request body:** Same structure as `POST /v1/submissions`. `save_as_draft` must be `true` or omitted; use `POST /v1/submissions/{id}/submit` to finalise.

**Response `200 OK`:** Same as GET /v1/submissions/{id}

**Error responses:**
- `403` — Not the owner, or not a DRAFT
- `404` — Not found
- `409` — Submission is not in DRAFT status

---

### POST /v1/submissions/{id}/submit

Finalise a draft submission → PENDING_APPROVAL.

**Auth required:** OPERATOR (own DRAFT submissions only)

**Request body:**
```json
{
  "variance_note": "Minor coin discrepancy due to changer machine malfunction."
}
```
`variance_note` is only required if `variance_exception` would be true. Pass `null` otherwise.

**Response `200 OK`:** Full submission object (same as GET)

**Error responses:**
- `403` — Not the owner
- `404` — Not found
- `409` — Submission is not DRAFT, or approved/pending already exists for this location+date
- `422` — Variance note required but missing

**Audit event written:** `SUBMISSION_CREATED` (with status PENDING_APPROVAL)

---

### POST /v1/submissions/{id}/approve

Approve a submission. Controller only.

**Auth required:** CONTROLLER

**Request body:**
```json
{
  "notes": "All sections verified and balanced."
}
```
`notes` is optional.

**Business logic:**
1. Verify caller role = CONTROLLER.
2. Verify submission exists and `status = 'PENDING_APPROVAL'` → `409` if not.
3. Verify controller is assigned to `submission.location_id` → `403` if not.
4. Update: `status='APPROVED'`, `approved_by=caller_id`, `approved_at=now()`.
5. Write `SUBMISSION_APPROVED` audit event.
6. (v2) Trigger email notification to operator.

**Response `200 OK`:**
```json
{
  "id": "a1b2c3d4-...",
  "status": "approved",
  "approved_by": "uuid-controller",
  "approved_by_name": "Chris Controller",
  "approved_at": "2026-03-05T20:10:00Z"
}
```

**Error responses:**
- `403` — Not a CONTROLLER, or location not assigned
- `404` — Submission not found
- `409` — Submission is not in PENDING_APPROVAL status

**Audit event written:** `SUBMISSION_APPROVED`

---

### POST /v1/submissions/{id}/reject

Reject a submission. Controller only.

**Auth required:** CONTROLLER

**Request body:**
```json
{
  "reason": "Cash count does not match physical observation. Section B appears understated."
}
```
`reason` is required, min 10 characters.

**Business logic:**
1. All same checks as approve.
2. `reason` must be non-empty (min 10 chars) → `422` if not.
3. Update: `status='REJECTED'`, `rejection_reason=reason`, `approved_by=caller_id`.
4. Write `SUBMISSION_REJECTED` audit event.
5. (v2) Trigger email notification to operator.

**Response `200 OK`:**
```json
{
  "id": "a1b2c3d4-...",
  "status": "rejected",
  "rejection_reason": "Cash count does not match physical observation. Section B appears understated.",
  "approved_by": "uuid-controller",
  "approved_by_name": "Chris Controller",
  "approved_at": "2026-03-05T20:10:00Z"
}
```

**Error responses:**
- `403` — Not a CONTROLLER, or location not assigned
- `404` — Submission not found
- `409` — Submission is not in PENDING_APPROVAL status
- `422` — Reason is missing or too short

**Audit event written:** `SUBMISSION_REJECTED`

---

## 4. Missed Submissions

### POST /v1/missed-submissions

Log a formal explanation for a day with no submission.

**Auth required:** OPERATOR

**Request body:**
```json
{
  "location_id": "LHR-T5-01",
  "missed_date": "2026-03-04",
  "reason": "Illness",
  "detail": "Cashroom lead was hospitalised unexpectedly. No backup staff available.",
  "supervisor_name": "David Williams"
}
```

**Validation:**
- `reason`: one of `Illness`, `Technical Issue`, `Emergency`, `Public Holiday`, `Training`, `Other`
- `detail`: required, min 20 chars
- `supervisor_name`: required, non-empty
- `missed_date`: must be in the past (< today), must be a date with no existing submission for this location
- Operator must be assigned to `location_id`

**Response `201 Created`:**
```json
{
  "id": "uuid-...",
  "location_id": "LHR-T5-01",
  "missed_date": "2026-03-04",
  "reason": "Illness",
  "detail": "Cashroom lead was hospitalised unexpectedly. No backup staff available.",
  "supervisor_name": "David Williams",
  "logged_at": "2026-03-05T09:15:00Z"
}
```

**Error responses:**
- `403` — Operator not assigned to location
- `409` — Explanation already logged for this location+date
- `422` — Validation failure

**Audit event written:** `MISSED_SUBMISSION_LOGGED`

---

### GET /v1/missed-submissions

List missed submission explanations.

**Auth required:** CONTROLLER (assigned locations), ADMIN, RC, AUDITOR

**Query parameters:** `location_id`, `date_from`, `date_to`, `page`, `page_size`

**Response `200 OK`:** Paginated list of missed submission objects (same shape as POST response).

---

## 5. Verifications — Controller

### GET /v1/verifications/controller/check-dow

Check whether a proposed visit date triggers a day-of-week pattern warning. Called live as the controller selects a date in the schedule form.

**Auth required:** CONTROLLER

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `location_id` | string | Yes | Location to check |
| `date` | date | Yes | Proposed visit date (YYYY-MM-DD) |

**Business logic:**
1. Compute `day_of_week` from `date`.
2. Read `dow_lookback_weeks` from `system_config` (default 6).
3. Compute `cutoff` = `date - (dow_lookback_weeks * 7) days`.
4. Query `verifications` where `location_id`, `verification_type='CONTROLLER'`, `status='COMPLETED'`, `day_of_week=computed_dow`, `verification_date >= cutoff`, `verification_date < date`.
5. If any match: return warning with details.

**Response `200 OK` — no warning:**
```json
{
  "warning": false
}
```

**Response `200 OK` — warning triggered:**
```json
{
  "warning": true,
  "day_name": "Tuesday",
  "match_count": 2,
  "previous_dates": ["2026-02-17", "2026-02-24"],
  "lookback_weeks": 6
}
```

---

### POST /v1/verifications/controller

Schedule a new controller verification visit.

**Auth required:** CONTROLLER

**Request body:**
```json
{
  "location_id": "LHR-T5-01",
  "date": "2026-03-12",
  "scheduled_time": "11:00",
  "dow_warning_acknowledged": false,
  "dow_warning_reason": null,
  "notes": null
}
```

**Field notes:**
- `date` must be tomorrow or later → `422` if today or past.
- `scheduled_time` must be one of: `"09:00"`, `"11:00"`, `"13:00"`, `"15:00"`, `"17:00"`.
- If `dow_warning_acknowledged = true`, `dow_warning_reason` is required.
- `dow_warning_reason` must be one of: `"operational"`, `"requested"`, `"followup"`, `"other"`.
- If a SCHEDULED visit already exists for this `(location_id, date)` → `409`.
- Controller must be assigned to `location_id` → `403`.

**Server-side computed fields:**
- `day_of_week` = `EXTRACT(DOW FROM date)` (0=Sunday)
- `warning_flag` = result of DOW check (run server-side regardless of client flag)
- `month_year` = NULL (controller visits)

**Response `201 Created`:**
```json
{
  "id": "uuid-...",
  "location_id": "LHR-T5-01",
  "location_name": "Heathrow T5 - Unit 01",
  "verifier_id": "uuid-controller",
  "verification_type": "CONTROLLER",
  "status": "scheduled",
  "verification_date": "2026-03-12",
  "scheduled_time": "11:00",
  "day_of_week": 4,
  "warning_flag": false,
  "warning_reason": null,
  "created_at": "2026-03-05T10:00:00Z"
}
```

**Error responses:**
- `403` — Controller not assigned to location
- `409` — Scheduled visit already exists for this location+date
- `422` — Validation failure (past date, invalid time slot, missing DOW reason)

**Audit event written:** `CONTROLLER_VERIFIED`

---

### GET /v1/verifications/controller

List controller verification records.

**Auth required:** CONTROLLER (own records for assigned locations), ADMIN, RC, AUDITOR

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `location_id` | string | Filter by location |
| `status` | string | `scheduled`, `completed`, `missed`, `cancelled` |
| `date_from` | date | Inclusive start |
| `date_to` | date | Inclusive end |
| `page` | integer | Default 1 |
| `page_size` | integer | Default 10 |

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "uuid-...",
      "location_id": "LHR-T5-01",
      "location_name": "Heathrow T5 - Unit 01",
      "verifier_id": "uuid-controller",
      "verifier_name": "Chris Controller",
      "verification_type": "CONTROLLER",
      "status": "completed",
      "verification_date": "2026-03-05",
      "scheduled_time": "11:00",
      "day_of_week": 3,
      "day_name": "Wednesday",
      "warning_flag": false,
      "warning_reason": null,
      "observed_total": 9580.00,
      "variance_vs_imprest": 5.00,
      "variance_pct": 0.052,
      "notes": "All sections verified.",
      "created_at": "2026-03-01T09:00:00Z",
      "updated_at": "2026-03-05T11:45:00Z"
    }
  ],
  "total": 28,
  "page": 1,
  "page_size": 10,
  "total_pages": 3
}
```

Note: `variance_vs_imprest` and `variance_pct` in list responses are computed on-the-fly from `observed_total` and the location's `expected_cash`. They are not stored.

---

### PATCH /v1/verifications/controller/{id}/complete

Mark a scheduled controller visit as completed.

**Auth required:** CONTROLLER

**Request body:**
```json
{
  "observed_total": 9580.00,
  "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "notes": "All sections verified. Minor coin discrepancy in Section B.",
  "dow_warning_reason": null
}
```

**Field notes:**
- `observed_total`: required, must be > 0.
- `signature_data`: required. Base64 PNG string. Max 200 KB (check string length before decode).
- `notes`: optional.
- `dow_warning_reason`: required if the completion triggers a DOW warning (server checks). One of: `"operational"`, `"requested"`, `"followup"`, `"other"`.

**Business logic:**
1. Verify visit exists and `status = 'SCHEDULED'` → `409` if not.
2. Verify controller is assigned to the visit's location → `403`.
3. Run DOW check server-side. If warning detected and `dow_warning_reason` not provided → `422`.
4. Set `status='COMPLETED'`, `observed_total`, `signature_data`, `notes`, `warning_flag`, `warning_reason`.
5. Write `CONTROLLER_VERIFIED` audit event.

**Response `200 OK`:** Full verification object.

**Error responses:**
- `403` — Not assigned to location
- `404` — Verification not found
- `409` — Not in SCHEDULED status
- `422` — `observed_total` missing, `signature_data` missing or too large, `dow_warning_reason` required

**Audit event written:** `CONTROLLER_VERIFIED`

---

### PATCH /v1/verifications/controller/{id}/miss

Mark a scheduled controller visit as missed.

**Auth required:** CONTROLLER

**Request body:**
```json
{
  "missed_reason": "Location access unavailable",
  "notes": "Building was closed for emergency maintenance."
}
```

**Field notes:**
- `missed_reason`: required. One of the predefined reasons (see verifications table design notes).
- `notes`: optional.

**Business logic:**
1. Verify visit exists and `status = 'SCHEDULED'`.
2. Verify controller is assigned to location.
3. Set `status='MISSED'`, `missed_reason`, `notes`.
4. Write `CONTROLLER_VERIFIED` audit event.

**Response `200 OK`:** Full verification object.

**Audit event written:** `CONTROLLER_VERIFIED`

---

## 6. Verifications — DGM

### POST /v1/verifications/dgm

Schedule a DGM monthly oversight visit.

**Auth required:** DGM

**Request body:**
```json
{
  "location_id": "LHR-T5-01",
  "date": "2026-03-20",
  "notes": null
}
```

**Business logic:**
1. DGM must be assigned to `location_id` → `403`.
2. Compute `month_year = LEFT(date::TEXT, 7)` (e.g., `"2026-03"`).
3. Check no DGM verification exists for `(location_id, month_year)` → `409` if found.
4. Create record with `status='SCHEDULED'`, `verification_type='DGM'`, `month_year` set.
5. `day_of_week` computed and stored. `scheduled_time` = NULL for DGM visits.

**Response `201 Created`:**
```json
{
  "id": "uuid-...",
  "location_id": "LHR-T5-01",
  "verification_type": "DGM",
  "status": "scheduled",
  "verification_date": "2026-03-20",
  "month_year": "2026-03",
  "notes": null,
  "created_at": "2026-03-05T10:00:00Z"
}
```

**Error responses:**
- `403` — DGM not assigned to location
- `409` — DGM visit already exists for this location in this month
- `422` — Validation failure

**Audit event written:** `DGM_VERIFIED`

---

### GET /v1/verifications/dgm

List DGM verification records.

**Auth required:** DGM (own records for assigned locations), ADMIN, RC, AUDITOR

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `location_id` | string | Filter by location |
| `status` | string | `scheduled`, `completed`, `missed` |
| `month_year` | string | Filter by month, e.g. `2026-03` |
| `year` | integer | Filter by year |
| `page` | integer | Default 1 |
| `page_size` | integer | Default 10 |

**Response `200 OK`:** Paginated list of verification objects (same shape as controller GET).

---

### PATCH /v1/verifications/dgm/{id}/complete

Mark a scheduled DGM visit as completed.

**Auth required:** DGM

**Request body:**
```json
{
  "observed_total": 9600.00,
  "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "notes": "Full walkthrough completed. Cash balanced."
}
```

**Field notes:**
- `observed_total`: required, > 0.
- `signature_data`: required. Base64 PNG. Max 200 KB.
- `notes`: optional.

**Business logic:**
1. Verify visit exists and `status = 'SCHEDULED'`.
2. Verify DGM is assigned to the visit's location.
3. Set `status='COMPLETED'`, `observed_total`, `signature_data`, `notes`.
4. Write `DGM_VERIFIED` audit event.

**Response `200 OK`:** Full verification object.

**Audit event written:** `DGM_VERIFIED`

---

### PATCH /v1/verifications/dgm/{id}/miss

Mark a scheduled DGM visit as missed.

**Auth required:** DGM

**Request body:**
```json
{
  "missed_reason": "Travel or transport issue",
  "notes": "Flight cancelled due to weather."
}
```

**Response `200 OK`:** Full verification object.

**Audit event written:** `DGM_VERIFIED`

---

## 7. Admin — Locations

All admin endpoints require role `ADMIN`.

### GET /v1/admin/locations

List all locations (including inactive).

**Query parameters:** `active` (boolean, default: no filter), `page`, `page_size`

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "LHR-T5-01",
      "name": "Heathrow T5 - Unit 01",
      "city": "London",
      "expected_cash": 9575.00,
      "tolerance_pct": 5.00,
      "effective_tolerance_pct": 7.50,
      "sla_hours": 48,
      "active": true,
      "has_override": true,
      "created_at": "2025-01-10T09:00:00Z",
      "updated_at": "2026-01-15T14:30:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "page_size": 10,
  "total_pages": 2
}
```

`effective_tolerance_pct` = value from `location_config_overrides` if present, else `locations.tolerance_pct`.
`has_override` = whether a `location_config_overrides` row exists for this location.

---

### POST /v1/admin/locations

Create a new location.

**Request body:**
```json
{
  "id": "LHR-T5-03",
  "name": "Heathrow T5 - Unit 03",
  "city": "London",
  "expected_cash": 9575.00,
  "tolerance_pct": 5.00,
  "sla_hours": 48
}
```

**Validation:**
- `id`: required, unique, max 20 chars, no spaces
- `name`: required, max 200 chars
- `city`: required
- `expected_cash`: required, > 0
- `tolerance_pct`: optional (defaults to global default), range 1–20
- `sla_hours`: optional, defaults to 48, must be > 0

**Response `201 Created`:** Location object.

**Audit event written:** `LOCATION_CREATED`

---

### PUT /v1/admin/locations/{id}

Update an existing location.

**Request body:** Same as POST (all fields optional in PUT; only provided fields are updated).

**Response `200 OK`:** Updated location object.

**Audit event written:** `LOCATION_UPDATED` (with `old_value` and `new_value` of changed fields as JSON)

---

### DELETE /v1/admin/locations/{id}

Soft-delete a location (sets `active = false`). Cannot hard-delete.

**Response `200 OK`:**
```json
{ "id": "LHR-T5-03", "active": false }
```

**Audit event written:** `LOCATION_UPDATED`

---

### POST /v1/admin/locations/{id}/reactivate

Reactivate a soft-deleted location.

**Response `200 OK`:**
```json
{ "id": "LHR-T5-03", "active": true }
```

**Audit event written:** `LOCATION_UPDATED`

---

## 8. Admin — Users

All admin endpoints require role `ADMIN`.

### GET /v1/admin/users

List all users (including inactive).

**Query parameters:** `role`, `active` (boolean), `location_id`, `page`, `page_size`

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "uuid-...",
      "name": "Chris Controller",
      "email": "controller@compass.com",
      "role": "CONTROLLER",
      "location_ids": ["LHR-T5-01", "LHR-T5-02"],
      "location_names": ["Heathrow T5 - Unit 01", "Heathrow T5 - Unit 02"],
      "active": true,
      "created_at": "2025-06-01T09:00:00Z"
    }
  ],
  "total": 24,
  "page": 1,
  "page_size": 10,
  "total_pages": 3
}
```

---

### POST /v1/admin/users

Create a new user.

**Request body:**
```json
{
  "name": "Jane Smith",
  "email": "jane.smith@compass.com",
  "password": "InitialPass123!",
  "role": "CONTROLLER",
  "location_ids": ["LHR-T5-01", "LHR-T5-02"]
}
```

**Validation:**
- `email`: required, unique (case-insensitive), valid email format
- `password`: required, min 8 chars
- `role`: required, one of: `OPERATOR`, `CONTROLLER`, `DGM`, `ADMIN`, `AUDITOR`, `REGIONAL_CONTROLLER`
- `location_ids`: optional array of valid location IDs

**Server-side:** Hash password with bcrypt (cost 12) before storing.

**Response `201 Created`:** User object (without password hash).

**Audit event written:** `USER_CREATED`

---

### PUT /v1/admin/users/{id}

Update a user.

**Request body:**
```json
{
  "name": "Jane Smith",
  "email": "jane.smith@compass.com",
  "password": null,
  "role": "CONTROLLER",
  "location_ids": ["LHR-T5-01", "LHR-T5-02", "LHR-T3-01"]
}
```

**Field notes:**
- `password`: if `null` or omitted, password is not changed.
- `email`: if changed, must still be unique.
- All fields optional — only provided fields are updated.

**Response `200 OK`:** Updated user object.

**Audit event written:** `USER_UPDATED`

---

### DELETE /v1/admin/users/{id}

Soft-delete a user (`active = false`). Cannot hard-delete.

**Response `200 OK`:**
```json
{ "id": "uuid-...", "active": false }
```

**Audit event written:** `USER_UPDATED`

---

### POST /v1/admin/users/{id}/reactivate

Reactivate a soft-deleted user.

**Response `200 OK`:**
```json
{ "id": "uuid-...", "active": true }
```

**Audit event written:** `USER_UPDATED`

---

## 9. Admin — Config

### GET /v1/admin/config

Get all global config values and all per-location tolerance overrides.

**Auth required:** ADMIN

**Response `200 OK`:**
```json
{
  "global": {
    "default_tolerance_pct": 5.00,
    "approval_sla_hours": 48,
    "dow_lookback_weeks": 6,
    "daily_reminder_time": "08:00",
    "data_retention_years": 7
  },
  "location_overrides": [
    {
      "location_id": "LHR-T5-01",
      "location_name": "Heathrow T5 - Unit 01",
      "tolerance_pct": 7.50,
      "updated_at": "2026-01-15T14:30:00Z"
    }
  ]
}
```

---

### PUT /v1/admin/config

Update global config values.

**Auth required:** ADMIN

**Request body:**
```json
{
  "default_tolerance_pct": 5.00,
  "approval_sla_hours": 48,
  "dow_lookback_weeks": 6,
  "daily_reminder_time": "08:00",
  "data_retention_years": 7
}
```

All fields optional — only provided fields are updated.

**Validation:**
- `default_tolerance_pct`: 1.0 – 20.0
- `approval_sla_hours`: 1 – 168 (1 hour to 1 week)
- `dow_lookback_weeks`: 4 or 6 only
- `daily_reminder_time`: valid HH:MM (00:00 – 23:59)
- `data_retention_years`: 1 – 7

**Response `200 OK`:** Full config object (same as GET).

**Audit event written:** `CONFIG_CHANGED` (one event per changed key, with `old_value` and `new_value`)

---

### PUT /v1/admin/config/locations/{location_id}

Set or update a per-location tolerance override.

**Auth required:** ADMIN

**Request body:**
```json
{
  "tolerance_pct": 7.50
}
```

**Validation:** `tolerance_pct` range 1.0 – 20.0

**Response `200 OK`:**
```json
{
  "location_id": "LHR-T5-01",
  "tolerance_pct": 7.50,
  "updated_at": "2026-03-05T10:00:00Z"
}
```

**Audit event written:** `CONFIG_CHANGED`

---

### DELETE /v1/admin/config/locations/{location_id}

Remove a per-location tolerance override (location falls back to global default).

**Auth required:** ADMIN

**Response `204 No Content`**

**Audit event written:** `CONFIG_CHANGED`

---

## 10. Admin — Access Grants

### GET /v1/admin/access-grants

List all current screen access grants.

**Auth required:** ADMIN

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "uuid-...",
      "user_id": "uuid-...",
      "user_name": "John Smith",
      "user_email": "john.smith@compass.com",
      "user_role": "DGM",
      "access_type": "operator",
      "note": "Covering for sick operator at LHR-T5-01",
      "granted_by": "uuid-admin",
      "granted_by_name": "Admin User",
      "granted_at": "2026-03-01T09:00:00Z"
    }
  ]
}
```

---

### POST /v1/admin/access-grants

Grant Operator or Controller screen access to a DGM or Regional Controller user.

**Auth required:** ADMIN

**Request body:**
```json
{
  "user_id": "uuid-...",
  "access_type": "operator",
  "note": "Covering for sick operator at LHR-T5-01"
}
```

**Validation:**
- Target user must have role `DGM` or `REGIONAL_CONTROLLER` → `422` if not.
- `access_type` must be `"operator"` or `"controller"`.
- If grant already exists for `(user_id, access_type)`: upsert (update `note` and `granted_at`).

**Response `201 Created`:** Grant object.

**Audit event written:** `ACCESS_GRANTED`

---

### PUT /v1/admin/access-grants/{id}

Update the note on an existing grant.

**Auth required:** ADMIN

**Request body:**
```json
{
  "note": "Updated reason for access."
}
```

**Response `200 OK`:** Updated grant object.

---

### DELETE /v1/admin/access-grants/{id}

Revoke an access grant.

**Auth required:** ADMIN

**Response `204 No Content`**

**Audit event written:** `ACCESS_REVOKED`

---

## 11. Admin — Roster Import

### POST /v1/admin/import

Bulk-create or update users and location assignments from a parsed roster.

**Auth required:** ADMIN

**Request body:**
```json
{
  "rows": [
    {
      "location_code": "LHR-T5-01",
      "location_name": "Heathrow T5 - Unit 01",
      "district": "London Heathrow",
      "cashroom_lead": "Alex Operator",
      "daily_reviewer": "Chris Controller",
      "controller": "Chris Controller",
      "dgm": "Dana DGM",
      "regional_controller": "RC User",
      "division_contacts": "RC User"
    }
  ]
}
```

**Business logic (per row):**
1. Upsert location by `location_code` (create if not exists, update `name` and `district` if exists).
2. For each personnel field:
   - Parse name → look up existing user by name (case-insensitive).
   - If not found: create user with a temporary password and the mapped role.
   - If found: verify role matches; warn if mismatch but do not overwrite role.
3. `daily_reviewer` and `controller` both map to `CONTROLLER` role. If same name in both fields, create/update one record.
4. Link user to location via `user_locations`.
5. `division_contacts` maps to `REGIONAL_CONTROLLER`.

**Response `200 OK`:**
```json
{
  "locations_created": 3,
  "locations_updated": 2,
  "users_created": 8,
  "users_updated": 4,
  "assignments_created": 15,
  "warnings": [
    "Row 4: 'Bob Controller' found with role OPERATOR — skipped role update."
  ]
}
```

**Audit events written:** `LOCATION_CREATED` / `LOCATION_UPDATED` / `USER_CREATED` / `USER_UPDATED` per affected entity.

---

## 12. Compliance Dashboard

### GET /v1/compliance/dashboard

Returns all locations with their 3-track compliance status for the Compliance Dashboard screen.

**Auth required:** ADMIN, REGIONAL_CONTROLLER

**Query parameters:** `sort` (`status` for most-critical-first, `name` for A–Z; default: `status`)

**Response `200 OK`:**
```json
{
  "generated_at": "2026-03-05T14:00:00Z",
  "summary": {
    "overall_compliance_pct": 75.0,
    "submitted_today": 9,
    "total_locations": 12,
    "overdue_count": 1,
    "variance_exceptions_today": 2,
    "controller_issues": 1,
    "dgm_coverage_this_month": 10
  },
  "locations": [
    {
      "id": "LHR-T5-01",
      "name": "Heathrow T5 - Unit 01",
      "health": "green",
      "submission": {
        "status": "approved",
        "total_cash": 9620.50,
        "variance": 45.50,
        "variance_pct": 0.4751,
        "submitted_at": "2026-03-05T18:22:00Z"
      },
      "submission_rate_30d": 96.7,
      "controller_visit": {
        "last_date": "2026-02-28",
        "days_since": 5,
        "warning_flag": false,
        "next_scheduled_date": "2026-03-12"
      },
      "dgm_visit": {
        "status": "completed",
        "visit_date": "2026-03-03",
        "observed_total": 9600.00
      }
    }
  ]
}
```

**Health badge logic (server-side):**
- `"red"`: submission rejected today, OR any controller visit missed, OR submission overdue > SLA hours
- `"amber"`: no submission today, OR last controller visit > 14 days ago with no upcoming scheduled, OR no DGM visit this month
- `"green"`: all three tracks clear

---

## 13. Reports

All report endpoints require role `ADMIN`, `REGIONAL_CONTROLLER`, or `AUDITOR`.

### GET /v1/reports/summary

KPI summary for a date range.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `date_from` | date | Required |
| `date_to` | date | Required |

**Response `200 OK`:**
```json
{
  "date_from": "2026-03-01",
  "date_to": "2026-03-05",
  "total_submissions": 48,
  "approved": 44,
  "rejected": 2,
  "pending": 1,
  "approval_rate_pct": 91.67,
  "variance_exceptions": 3,
  "avg_variance_pct": 0.82,
  "controller_verifications": 7,
  "dgm_visits": 4
}
```

---

### GET /v1/reports/locations

Per-location summary report.

**Query parameters:** `date_from`, `date_to`, `page`, `page_size`

**Response `200 OK`:** Paginated list:
```json
{
  "items": [
    {
      "location_id": "LHR-T5-01",
      "location_name": "Heathrow T5 - Unit 01",
      "submissions": 5,
      "approved": 4,
      "rejected": 1,
      "overdue": 0,
      "avg_variance_pct": 0.52,
      "exceptions": 0
    }
  ]
}
```

---

### GET /v1/reports/actors

Per-actor summary report. Returns different column sets based on role.

**Query parameters:** `date_from`, `date_to`, `role` (`OPERATOR`, `CONTROLLER`, `DGM`), `page`, `page_size`

**Response `200 OK` — Operators:**
```json
{
  "role": "OPERATOR",
  "items": [
    {
      "user_id": "uuid-...",
      "name": "Alex Operator",
      "submissions": 5,
      "approved": 4,
      "rejected": 1,
      "pending": 0,
      "rate_pct": 100.0,
      "avg_variance_pct": 0.52,
      "exceptions": 0,
      "location_count": 1
    }
  ]
}
```

**Response `200 OK` — Controllers:**
```json
{
  "role": "CONTROLLER",
  "items": [
    {
      "user_id": "uuid-...",
      "name": "Chris Controller",
      "approvals_made": 10,
      "approved": 9,
      "rejected": 1,
      "approval_rate_pct": 90.0,
      "avg_variance_of_reviewed": 0.65,
      "verifications_total": 5,
      "verifications_completed": 4,
      "verifications_missed": 1,
      "verifications_scheduled": 2,
      "verification_completion_rate_pct": 80.0
    }
  ]
}
```

**Response `200 OK` — DGMs:**
```json
{
  "role": "DGM",
  "items": [
    {
      "user_id": "uuid-...",
      "name": "Dana DGM",
      "verifications_total": 6,
      "completed": 5,
      "missed": 1,
      "scheduled": 3,
      "completion_rate_pct": 83.33
    }
  ]
}
```

---

### GET /v1/reports/exceptions

List all variance exceptions in the date range.

**Query parameters:** `date_from`, `date_to`, `page`, `page_size`

**Response `200 OK`:** Paginated list:
```json
{
  "items": [
    {
      "submission_id": "uuid-...",
      "submission_date": "2026-03-04",
      "location_id": "LHR-T5-02",
      "location_name": "Heathrow T5 - Unit 02",
      "operator_id": "uuid-...",
      "operator_name": "Alex Operator",
      "total_cash": 10250.00,
      "variance": 675.00,
      "variance_pct": 7.05,
      "status": "approved",
      "rejection_reason": null
    }
  ]
}
```

---

### GET /v1/reports/section-trends

Cash count section totals aggregated over time for the RC Trends chart.

**Auth required:** REGIONAL_CONTROLLER, ADMIN, AUDITOR

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `section` | char | Required | One of: `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I` |
| `granularity` | string | `monthly` | `weekly`, `monthly`, `quarterly` |
| `periods` | integer | `12` | Number of periods to return |
| `location_id` | string | (all) | Filter to a single location |

**Response `200 OK`:**
```json
{
  "section": "A",
  "granularity": "monthly",
  "location_id": null,
  "data": [
    { "period": "2025-04", "avg_total": 8120.50 },
    { "period": "2025-05", "avg_total": 8243.00 },
    { "period": "2025-06", "avg_total": 7980.25 }
  ],
  "summary": {
    "latest_value": 8350.00,
    "previous_value": 8243.00,
    "change_pct": 1.30,
    "period_avg": 8163.44,
    "peak": 8743.00
  }
}
```

---

### GET /v1/reports/export

Download all three report tables as a single CSV file.

**Auth required:** ADMIN, REGIONAL_CONTROLLER, AUDITOR

**Query parameters:** `date_from`, `date_to`

**Response `200 OK`:**
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="ccs-report-2026-03-01-to-2026-03-05.csv"`

CSV structure: Three sections separated by blank lines and section header rows.

---

## 14. Audit Trail

### GET /v1/audit

Paginated, filterable audit event log.

**Auth required:** ADMIN, AUDITOR

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `event_type` | string | Filter by event type (exact enum value) |
| `actor_id` | UUID | Filter by actor |
| `location_id` | string | Filter by location |
| `date_from` | datetime | Inclusive start (ISO 8601) |
| `date_to` | datetime | Inclusive end (ISO 8601) |
| `page` | integer | Default 1 |
| `page_size` | integer | Default 15, max 100 |

**Cascading filter behaviour:**
- When `event_type` is set: the set of valid `actor_id` values for the dropdown is: `SELECT DISTINCT actor_id FROM audit_events WHERE event_type = ?`
- When `event_type` + `actor_id` are set: the set of valid `location_id` values is: `SELECT DISTINCT location_id FROM audit_events WHERE event_type = ? AND actor_id = ?`

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "uuid-...",
      "event_type": "SUBMISSION_APPROVED",
      "actor_id": "uuid-controller",
      "actor_name": "Chris Controller",
      "actor_role": "CONTROLLER",
      "location_id": "LHR-T5-01",
      "location_name": "Heathrow T5 - Unit 01",
      "entity_id": "uuid-submission",
      "entity_type": "submission",
      "detail": "Submission approved for 2026-03-05, total $9,620.50, variance +$45.50",
      "old_value": null,
      "new_value": null,
      "ip_address": "192.168.1.42",
      "created_at": "2026-03-05T20:10:00Z"
    }
  ],
  "total": 1243,
  "page": 1,
  "page_size": 15,
  "total_pages": 83
}
```

**Helper endpoint — distinct filter values:**

`GET /v1/audit/filter-options?event_type=SUBMISSION_APPROVED`

Returns valid actors and locations for cascading dropdowns:
```json
{
  "actors": [
    { "id": "uuid-...", "name": "Chris Controller" }
  ],
  "locations": [
    { "id": "LHR-T5-01", "name": "Heathrow T5 - Unit 01" }
  ]
}
```

---

## 15. Health Check

### GET /health

**Auth required:** No

**Response `200 OK`:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "db": "connected",
  "timestamp": "2026-03-05T14:00:00Z"
}
```

If the DB is unreachable, return `503 Service Unavailable` with `"db": "disconnected"`.

---

## 16. Error Reference

### Standard error response shape

All errors return JSON:
```json
{
  "error": {
    "code": "SUBMISSION_ALREADY_EXISTS",
    "message": "An approved or pending submission already exists for this location and date.",
    "field": null
  }
}
```

For validation errors (422), `field` identifies which field failed:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Variance explanation is required when variance exceeds tolerance.",
    "field": "variance_note"
  }
}
```

### HTTP status codes

| Code | When |
|---|---|
| `200 OK` | Successful GET, PUT, PATCH |
| `201 Created` | Successful POST that creates a resource |
| `204 No Content` | Successful DELETE |
| `400 Bad Request` | Malformed JSON or missing required headers |
| `401 Unauthorized` | Missing or expired JWT |
| `403 Forbidden` | Valid JWT but insufficient role or location assignment |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Business rule violation (duplicate submission, wrong status transition, etc.) |
| `422 Unprocessable Entity` | Validation failure (missing required field, value out of range) |
| `500 Internal Server Error` | Unhandled exception — log and return generic message |
| `503 Service Unavailable` | Database connection failure |

### Application error codes

| Code | HTTP | Description |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_EXPIRED` | 401 | JWT has expired |
| `TOKEN_INVALID` | 401 | JWT signature invalid |
| `FORBIDDEN` | 403 | Role or location access denied |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `SUBMISSION_ALREADY_EXISTS` | 409 | Active submission exists for this location+date |
| `WRONG_STATUS` | 409 | Status transition not allowed (e.g., approving an already-approved submission) |
| `DGM_VISIT_ALREADY_EXISTS` | 409 | DGM visit already recorded for this location+month |
| `VISIT_ALREADY_SCHEDULED` | 409 | Controller visit already scheduled for this location+date |
| `VALIDATION_ERROR` | 422 | Field-level validation failure |
| `FUTURE_DATE` | 422 | Submission date is in the future |
| `VARIANCE_NOTE_REQUIRED` | 422 | Variance exceeds tolerance but no note provided |
| `SIGNATURE_REQUIRED` | 422 | Signature data missing from completion form |
| `SIGNATURE_TOO_LARGE` | 422 | Signature data exceeds 200 KB |
| `DOW_REASON_REQUIRED` | 422 | DOW warning triggered but no reason provided |
| `ACCESS_TYPE_INVALID` | 422 | Access grant target user has wrong role |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

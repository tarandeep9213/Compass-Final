# CashRoom Compliance System — API Documentation

**Version:** 1.0
**Date:** 2026-03-06
**Base URL:** `http://localhost:8001/v1`
**Format:** JSON (all requests and responses)
**Auth:** Bearer JWT — include `Authorization: Bearer <access_token>` on all endpoints except `/auth/login`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Submissions](#2-submissions)
3. [Missed Submissions](#3-missed-submissions)
4. [Verifications — Controller](#4-verifications--controller)
5. [Verifications — DGM](#5-verifications--dgm)
6. [Locations (Public)](#6-locations-public)
7. [Compliance Dashboard](#7-compliance-dashboard)
8. [Reports](#8-reports)
9. [Audit Events](#9-audit-events)
10. [Admin — Locations](#10-admin--locations)
11. [Admin — Users](#11-admin--users)
12. [Admin — Config](#12-admin--config)
13. [Admin — Access Grants](#13-admin--access-grants)
14. [Admin — Roster Import](#14-admin--roster-import)
15. [Common Schemas](#15-common-schemas)
16. [Error Codes](#16-error-codes)

---

## 1. Authentication

### POST `/auth/login`
Authenticate with email and password. Returns JWT tokens.

**Auth required:** No

**Request body:**
```json
{
  "email": "operator@compass.com",
  "password": "demo1234"
}
```

**Response 200:**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "name": "Alex Operator",
    "email": "operator@compass.com",
    "role": "OPERATOR",
    "location_ids": ["loc-1"],
    "access_grants": []
  }
}
```

**Errors:**
- `401` — Invalid credentials or inactive account

---

### GET `/auth/me`
Return the current authenticated user's profile.

**Auth required:** Yes

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Alex Operator",
  "email": "operator@compass.com",
  "role": "OPERATOR",
  "location_ids": ["loc-1"],
  "access_grants": []
}
```

---

### POST `/auth/refresh`
Exchange a refresh token for a new access token.

**Auth required:** No

**Request body:**
```json
{
  "refresh_token": "<refresh_jwt>"
}
```

**Response 200:**
```json
{
  "access_token": "<new_jwt>",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**Errors:**
- `401` — Invalid or expired refresh token

---

## 2. Submissions

### POST `/submissions`
Create a new submission or save as draft.

**Auth required:** Yes — role must be `OPERATOR` or `ADMIN`

**Request body:**
```json
{
  "location_id": "loc-appleton",
  "submission_date": "2026-03-06",
  "source": "FORM",
  "save_as_draft": false,
  "variance_note": null,
  "sections": {
    "A": { "total": 500.00, "denominations": { "50": 5, "20": 10 } },
    "B": { "total": 750.00, "denominations": {} },
    "C": { "total": 0.0,   "denominations": {} }
  }
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location_id` | string | Yes | Must exist in locations table |
| `submission_date` | string | Yes | ISO date `YYYY-MM-DD` |
| `source` | enum | Yes | `FORM`, `CHAT`, or `EXCEL` |
| `save_as_draft` | boolean | Yes | `true` = draft; `false` = pending_approval |
| `sections` | object | Yes | Map of section codes A–I |
| `variance_note` | string | No | Required when variance exception is detected |

**Response 201:** `SubmissionOut` (see [Common Schemas](#15-common-schemas))

**Side effects (when `save_as_draft=false`):**
- Audit event `SUBMISSION_CREATED` logged
- Email notification sent to all controllers at that location (N-01)

**Errors:**
- `403` — Not an operator
- `404` — Location not found

---

### GET `/submissions`
List submissions (scoped by role).

**Auth required:** Yes

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `location_id` | string | Filter by location |
| `status` | string | `draft`, `pending_approval`, `approved`, `rejected` |
| `date_from` | string | ISO date (inclusive) |
| `date_to` | string | ISO date (inclusive) |
| `operator_id` | string | Filter by operator UUID |
| `page` | int | Default: 1 |
| `page_size` | int | Default: 20, max: 100 |

**Scoping rules:**
- `OPERATOR` — sees only their own submissions
- `CONTROLLER` — sees submissions for their assigned locations
- `DGM`, `ADMIN`, `REGIONAL_CONTROLLER` — sees all

**Response 200:**
```json
{
  "items": [ /* SubmissionOut[] */ ],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

---

### GET `/submissions/{submission_id}`
Get a single submission with section detail.

**Auth required:** Yes

**Response 200:** `SubmissionDetailOut` (includes `sections` field)

**Errors:**
- `403` — Operator requesting another operator's submission
- `404` — Not found

---

### PUT `/submissions/{submission_id}`
Update a draft submission's sections.

**Auth required:** Yes — must be the submission's owner

**Request body:** Same shape as POST `/submissions`

**Response 200:** `SubmissionOut`

**Errors:**
- `400` — Not a draft submission
- `403` — Not the owner
- `404` — Not found

---

### POST `/submissions/{submission_id}/submit`
Promote a draft to `pending_approval`.

**Auth required:** Yes — must be the submission's owner

**Request body:**
```json
{
  "variance_note": "Section B shortage explained by till error"
}
```

**Response 200:** `SubmissionOut`

**Side effects:**
- Audit event `SUBMISSION_SUBMITTED` logged
- Email notification to controllers at that location (N-02)

**Errors:**
- `400` — Submission is not a draft
- `403` — Not the owner
- `404` — Not found

---

### POST `/submissions/{submission_id}/approve`
Approve a pending submission.

**Auth required:** Yes — role must be `CONTROLLER`

**Request body:**
```json
{
  "notes": "Verified, all sections correct"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "approved",
  "approved_by": "uuid",
  "approved_by_name": "Chris Controller",
  "approved_at": "2026-03-06T14:23:00+00:00"
}
```

**Side effects:**
- Audit event `SUBMISSION_APPROVED` logged
- Email notification to operator (N-03)

**Errors:**
- `400` — Not in `pending_approval` state
- `403` — Not a controller
- `404` — Not found

---

### POST `/submissions/{submission_id}/reject`
Reject a pending submission.

**Auth required:** Yes — role must be `CONTROLLER`

**Request body:**
```json
{
  "reason": "Section B total does not match denominations"
}
```

**Response 200:** Same shape as approve response, with `status: "rejected"`

**Side effects:**
- Audit event `SUBMISSION_REJECTED` logged
- Email notification to operator (N-04)

**Errors:**
- `400` — Not in `pending_approval` state
- `403` — Not a controller
- `404` — Not found

---

## 3. Missed Submissions

### POST `/missed-submissions`
Log an explanation for a missed submission day.

**Auth required:** Yes

**Request body:**
```json
{
  "location_id": "loc-appleton",
  "missed_date": "2026-03-05",
  "reason": "equipment_failure",
  "detail": "Cash counting machine was out of order all day",
  "supervisor_name": "Jane Smith"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "location_id": "loc-appleton",
  "missed_date": "2026-03-05",
  "reason": "equipment_failure",
  "detail": "Cash counting machine was out of order all day",
  "supervisor_name": "Jane Smith",
  "logged_at": "2026-03-06T08:00:00+00:00"
}
```

**Side effects:**
- Email notification to controllers at that location (N-09)

---

### GET `/missed-submissions`
List missed submission records.

**Auth required:** Yes

**Query params:** `location_id`, `date_from`, `date_to`, `page`, `page_size`

**Response 200:** Paginated list of `MissedSubmissionOut`

---

## 4. Verifications — Controller

### GET `/verifications/controller/check-dow`
Check if scheduling a visit on a given date would trigger a day-of-week pattern warning.

**Auth required:** Yes

**Query params:**
| Param | Required | Description |
|-------|----------|-------------|
| `location_id` | Yes | Target location |
| `date` | Yes | Proposed visit date `YYYY-MM-DD` |

**Response 200:**
```json
{
  "warning": true,
  "day_name": "Friday",
  "match_count": 3,
  "previous_dates": ["2026-02-20", "2026-02-06", "2026-01-23"],
  "lookback_weeks": 4
}
```

**Warning logic:** `warning=true` when the same weekday appears 2 or more times in the lookback window (default 4 weeks, configurable in system config).

---

### POST `/verifications/controller`
Schedule a controller verification visit.

**Auth required:** Yes — role must be `CONTROLLER`

**Request body:**
```json
{
  "location_id": "loc-appleton",
  "date": "2026-03-13",
  "scheduled_time": "09:00",
  "dow_warning_acknowledged": true,
  "dow_warning_reason": "Only available on Fridays this month",
  "notes": ""
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location_id` | string | Yes | Must exist |
| `date` | string | Yes | `YYYY-MM-DD` |
| `scheduled_time` | string | Yes | `HH:MM` format |
| `dow_warning_acknowledged` | boolean | No | Set to `true` if user acknowledged the DOW warning |
| `dow_warning_reason` | string | No | Reason for proceeding despite warning |
| `notes` | string | No | Free text notes |

**Response 201:** `VerificationOut` (see [Common Schemas](#15-common-schemas))

**Side effects:**
- All active DGMs receive `visit_scheduled.html` email (N-05)

**Errors:**
- `403` — Not a controller
- `404` — Location not found

---

### GET `/verifications/controller`
List controller verification visits.

**Auth required:** Yes

**Query params:** `location_id`, `status`, `date_from`, `date_to`, `page`, `page_size`

**Scoping:** Controllers see only their own visits. Admin/DGM/RC see all.

**Response 200:** Paginated `VerificationOut[]`

---

### PATCH `/verifications/controller/{visit_id}/complete`
Mark a scheduled controller visit as completed.

**Auth required:** Yes — must be the visit's `verifier_id` or Admin

**Request body:**
```json
{
  "observed_total": 9575.00,
  "notes": "All cash accounted for. Till 3 slightly short.",
  "signature_data": null,
  "dow_warning_reason": null
}
```

**Response 200:** `VerificationOut` with `status: "completed"`

**Side effects:**
- All DGMs receive `visit_completed.html` email (N-06)

**Errors:**
- `400` — Visit is not in `scheduled` state
- `403` — Not the assigned verifier
- `404` — Visit not found or wrong type

---

### PATCH `/verifications/controller/{visit_id}/miss`
Mark a scheduled controller visit as missed.

**Auth required:** Yes — must be the visit's `verifier_id` or Admin

**Request body:**
```json
{
  "missed_reason": "Travel or transport issue",
  "notes": ""
}
```

**Response 200:** `VerificationOut` with `status: "missed"`

**Errors:**
- `400` — Visit is not in `scheduled` state
- `403` — Not the assigned verifier
- `404` — Not found

---

## 5. Verifications — DGM

### GET `/verifications/dgm/check-dow`
Same as controller DOW check but for DGM visits.

**Query params:** `location_id`, `date`

**Response 200:** Same shape as controller DOW check response.

---

### POST `/verifications/dgm`
Schedule a DGM monthly verification visit.

**Auth required:** Yes — role must be `DGM`

**Request body:**
```json
{
  "location_id": "loc-1",
  "date": "2026-03-24",
  "notes": "Monthly cash room inspection"
}
```

**Note:** DGM visits have no `scheduled_time` (time not tracked). `month_year` is automatically derived from `date[:7]`.

**Response 201:** `VerificationOut`

**Side effects:**
- All active Regional Controllers receive `visit_scheduled.html` email (N-07)

**Errors:**
- `403` — Not a DGM
- `404` — Location not found

---

### GET `/verifications/dgm`
List DGM verification visits.

**Auth required:** Yes

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `location_id` | string | Filter by location |
| `status` | string | `scheduled`, `completed`, `missed`, `cancelled` |
| `month_year` | string | `YYYY-MM` — filter by month |
| `year` | int | Filter all visits in a given year |
| `page` | int | Default: 1 |
| `page_size` | int | Default: 20 |

**Scoping:** DGMs see only their own visits.

**Response 200:** Paginated `VerificationOut[]`

---

### PATCH `/verifications/dgm/{visit_id}/complete`
Mark a DGM visit as completed.

**Auth required:** Yes — must be `verifier_id` or Admin

**Request body:**
```json
{
  "observed_total": 9600.00,
  "notes": "Monthly visit complete. No issues found.",
  "signature_data": null
}
```

**Response 200:** `VerificationOut`

**Side effects:**
- All Regional Controllers receive `visit_completed.html` email (N-08)

---

### PATCH `/verifications/dgm/{visit_id}/miss`
Mark a DGM visit as missed.

**Request body:**
```json
{
  "missed_reason": "Location closed for holiday period",
  "notes": ""
}
```

**Response 200:** `VerificationOut`

---

## 6. Locations (Public)

### GET `/locations`
List all active locations. Used by the frontend to populate dropdowns.

**Auth required:** Yes

**Response 200:**
```json
[
  { "id": "loc-appleton", "name": "APPLETON" },
  { "id": "loc-1",        "name": "The Grange Hotel" }
]
```

---

## 7. Compliance Dashboard

### GET `/compliance/dashboard`
Return per-location health status and summary metrics.

**Auth required:** Yes

**Query params:**
| Param | Values | Default | Description |
|-------|--------|---------|-------------|
| `sort` | `status`, `name` | `status` | Sort locations by health status (red first) or name |

**Response 200:**
```json
{
  "generated_at": "2026-03-06",
  "summary": {
    "overall_compliance_pct": 72.5,
    "submitted_today": 8,
    "total_locations": 12,
    "overdue_count": 3,
    "variance_exceptions_today": 1,
    "controller_issues": 2,
    "dgm_coverage_this_month": 58.3
  },
  "locations": [
    {
      "id": "loc-appleton",
      "name": "APPLETON",
      "health": "green",
      "submission": {
        "status": "approved",
        "total_cash": 9575.00,
        "variance": 75.00,
        "variance_pct": 0.79,
        "submitted_at": "2026-03-06T09:14:00+00:00"
      },
      "submission_rate_30d": 93.3,
      "controller_visit": {
        "last_date": "2026-02-27",
        "days_since": 7,
        "warning_flag": false,
        "next_scheduled_date": "2026-03-13"
      },
      "dgm_visit": {
        "status": "scheduled",
        "visit_date": "2026-03-24",
        "observed_total": null
      }
    }
  ]
}
```

**Health status logic:**
- `red` — No submission today, OR submission rejected
- `amber` — Variance exception, OR submission pending approval, OR last controller visit > 30 days ago
- `green` — Submission approved, all checks pass

**Scoping:**
- `OPERATOR`, `CONTROLLER` — see only their assigned locations
- `ADMIN`, `DGM`, `REGIONAL_CONTROLLER` — see all active locations

---

## 8. Reports

### GET `/reports/summary`
Aggregate submission and verification statistics for a date range.

**Auth required:** Yes

**Query params:** `date_from` (required), `date_to` (required)

**Response 200:**
```json
{
  "date_from": "2026-02-01",
  "date_to": "2026-03-06",
  "total_submissions": 156,
  "approved": 130,
  "rejected": 18,
  "pending": 8,
  "approval_rate_pct": 83.3,
  "variance_exceptions": 12,
  "avg_variance_pct": 1.84,
  "controller_verifications": 22,
  "dgm_visits": 4
}
```

---

### GET `/reports/locations`
Per-location submission breakdown for a date range.

**Auth required:** Yes

**Query params:** `date_from` (required), `date_to` (required), `page`, `page_size`

**Response 200:** Paginated list:
```json
{
  "items": [
    {
      "location_id": "loc-appleton",
      "name": "APPLETON",
      "total": 34,
      "approved": 28,
      "rejected": 4,
      "exceptions": 2
    }
  ],
  "total": 12, "page": 1, "page_size": 20, "total_pages": 1
}
```

---

### GET `/reports/actors`
Per-operator submission statistics.

**Auth required:** Yes

**Query params:** `date_from` (required), `date_to` (required), `role` (default: `OPERATOR`), `page`, `page_size`

**Response 200:** Paginated list with `{actor_id, name, total, approved, rejected, exceptions}` per actor.

---

### GET `/reports/exceptions`
List submissions with variance exceptions.

**Auth required:** Yes

**Query params:** `date_from` (required), `date_to` (required), `page`, `page_size`

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "location_id": "loc-1",
      "location_name": "The Grange Hotel",
      "operator_name": "Alex Operator",
      "submission_date": "2026-03-04",
      "total_cash": 10250.00,
      "variance": 750.00,
      "variance_pct": 7.89,
      "status": "approved",
      "variance_note": "Extra cash from weekend event"
    }
  ],
  "total": 5, "page": 1, "page_size": 20, "total_pages": 1
}
```

---

### GET `/reports/section-trends`
Trend data for a specific cashroom section over time.

**Auth required:** Yes

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `section` | string | Yes | Section code: `A`–`I` |
| `granularity` | string | No | `monthly` (default), `weekly`, `quarterly` |
| `periods` | int | No | Number of periods (default: 6, max: 24) |
| `location_id` | string | No | Filter to a specific location |

**Response 200:**
```json
{
  "section": "A",
  "granularity": "monthly",
  "location_id": null,
  "data": [
    { "period": "2025-10", "avg_total": 4820.50 },
    { "period": "2025-11", "avg_total": 5010.25 }
  ],
  "summary": {
    "latest_value": 5010.25,
    "previous_value": 4820.50,
    "change_pct": 3.9,
    "period_avg": 4915.38,
    "peak": 5200.00
  }
}
```

---

### GET `/reports/export`
Export all submissions in a date range as CSV.

**Auth required:** Yes

**Query params:** `date_from` (required), `date_to` (required)

**Response 200:**
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename=cashroom_report_<from>_<to>.csv`
- CSV columns: `Date, Location, Operator, Status, Total Cash, Variance, Variance %, Exception`

---

## 9. Audit Events

### GET `/audit`
Retrieve the system audit log.

**Auth required:** Yes — Admin or Auditor only (enforced by frontend convention; backend accepts any authenticated user)

**Query params:**
| Param | Description |
|-------|-------------|
| `event_type` | Filter by event type (e.g., `SUBMISSION_APPROVED`) |
| `actor_id` | Filter by actor UUID |
| `location_id` | Filter by location |
| `date_from` | ISO date |
| `date_to` | ISO date |
| `page` | Default: 1 |
| `page_size` | Default: 50, max: 200 |

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "event_type": "SUBMISSION_APPROVED",
      "actor_id": "uuid",
      "actor_name": "Chris Controller",
      "actor_role": "CONTROLLER",
      "location_id": "loc-appleton",
      "location_name": "APPLETON",
      "entity_id": "uuid",
      "entity_type": "Submission",
      "detail": "Submission approved for APPLETON on 2026-03-06",
      "old_value": null,
      "new_value": null,
      "ip_address": "127.0.0.1",
      "created_at": "2026-03-06T14:23:00+00:00"
    }
  ],
  "total": 348,
  "page": 1,
  "page_size": 50,
  "total_pages": 7
}
```

---

## 10. Admin — Locations

All `/admin/*` endpoints require `ADMIN` role.

### GET `/admin/locations`

**Query params:** `active` (boolean), `page`, `page_size` (max: 200)

**Response 200:** Paginated list of location objects including:
- `effective_tolerance_pct` — resolved tolerance (override or global default)
- `has_override` — whether a per-location override exists

---

### POST `/admin/locations`
Create a new location.

**Request body:**
```json
{
  "name": "New Site",
  "city": "Chicago",
  "address": "123 Main St",
  "expected_cash": 10000.0,
  "tolerance_pct": 3.5,
  "sla_hours": 24
}
```

**Response 201:** Location object

**Side effects:** Audit event `LOCATION_CREATED`

---

### PUT `/admin/locations/{location_id}`
Update location fields (partial update — null fields unchanged).

**Request body:** Same as POST, all fields optional.

**Response 200:** Updated location object

**Side effects:** Audit event `LOCATION_UPDATED`

---

### DELETE `/admin/locations/{location_id}`
Soft-deactivate a location (`active=False`).

**Response 200:** `{"ok": true}`

**Side effects:** Audit event `LOCATION_DEACTIVATED`

---

## 11. Admin — Users

### GET `/admin/users`

**Query params:** `role`, `active`, `location_id`, `page`, `page_size`

**Response 200:** Paginated list with `location_names` resolved from `location_ids`

---

### POST `/admin/users`
Create a new user.

**Request body:**
```json
{
  "name": "Jane Smith",
  "email": "jane.smith@compass.com",
  "password": "demo1234",
  "role": "OPERATOR",
  "location_ids": ["loc-appleton"]
}
```

**Response 201:** User object

**Side effects:** Audit event `USER_CREATED`

---

### PUT `/admin/users/{user_id}`
Update a user.

**Request body:** Any subset of: `name`, `email`, `role`, `location_ids`, `active`, `password`

**Response 200:** Updated user object

**Side effects:** Audit event `USER_UPDATED`

---

### DELETE `/admin/users/{user_id}`
Soft-deactivate a user.

**Response 200:** `{"ok": true}`

**Side effects:** Audit event `USER_DEACTIVATED`

---

## 12. Admin — Config

### GET `/admin/config`
Return global system configuration.

**Response 200:**
```json
{
  "default_tolerance_pct": 5.0,
  "approval_sla_hours": 24,
  "dow_lookback_weeks": 4,
  "daily_reminder_time": "08:00",
  "data_retention_years": 7,
  "updated_at": "2026-03-06T00:00:00+00:00",
  "location_overrides": [
    {
      "location_id": "loc-appleton",
      "tolerance_pct": 3.0,
      "updated_at": "2026-03-01T00:00:00+00:00"
    }
  ]
}
```

---

### PUT `/admin/config`
Update global configuration.

**Request body:** Any subset of config fields:
```json
{
  "default_tolerance_pct": 4.0,
  "approval_sla_hours": 48,
  "dow_lookback_weeks": 6
}
```

**Response 200:** Updated config object

**Side effects:** Audit event `CONFIG_UPDATED`

---

## 13. Admin — Access Grants

### GET `/admin/access-grants`
List all access grants (role overrides for DGMs/Regional Controllers).

**Response 200:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "user_name": "Diana DGM",
    "user_email": "dgm@compass.com",
    "user_role": "DGM",
    "access_type": "operator",
    "note": "Acting as cashroom operator this week",
    "granted_by": "uuid",
    "granted_by_name": "Admin User",
    "granted_at": "2026-03-06T10:00:00+00:00"
  }
]
```

---

### POST `/admin/access-grants`
Grant a DGM or Regional Controller additional role access.

**Request body:**
```json
{
  "user_id": "uuid",
  "access_type": "operator",
  "note": "Covering for absent operator"
}
```

**`access_type` values:** `"operator"`, `"controller"`

**Response 201:** Access grant object

**Side effects:** Audit event `ACCESS_GRANT_CREATED`

---

### DELETE `/admin/access-grants/{grant_id}`
Revoke an access grant.

**Response 200:** `{"ok": true}`

**Side effects:** Audit event `ACCESS_GRANT_REVOKED`

---

## 14. Admin — Roster Import

### POST `/admin/import`
Bulk-import users and locations from an Excel roster.

**Auth required:** Yes — `ADMIN` only

**Request body:**
```json
{
  "rows": [
    {
      "location_name": "APPLETON",
      "district": "APPLETON",
      "cc_number": "5012",
      "cashroom_lead": "Sandra Rodriguez",
      "daily_reviewer": "Marcus Webb",
      "controller": "Mark Taylor",
      "dgm": "John Ranallo",
      "regional_controller": "Lisa Chen"
    }
  ]
}
```

**Field mapping:**
| Row field | Converted to | Role |
|-----------|-------------|------|
| `cashroom_lead` | email `first.last@compass.com` | `OPERATOR` |
| `daily_reviewer` | email `first.last@compass.com` | `OPERATOR` |
| `controller` | email `first.last@compass.com` | `CONTROLLER` |
| `dgm` | email `first.last@compass.com` | `DGM` |
| `regional_controller` | email `first.last@compass.com` | `REGIONAL_CONTROLLER` |

**Location ID generation:** `loc-{district-name-slug}` (e.g., `"APPLETON"` → `"loc-appleton"`)

**Deduplication:** Users appearing in multiple rows (same controller covering multiple sites) are created once and assigned to all relevant locations.

**Default password:** `demo1234` for all newly created users.

**Response 200:**
```json
{
  "locations_created": 5,
  "locations_updated": 3,
  "users_created": 18,
  "users_updated": 4,
  "assignments_created": 22,
  "warnings": []
}
```

**Side effects:** Audit event `ROSTER_IMPORT`

**Errors:**
- `403` — Not admin

---

## 15. Common Schemas

### `SubmissionOut`
```json
{
  "id": "uuid",
  "location_id": "loc-appleton",
  "location_name": "APPLETON",
  "operator_id": "uuid",
  "operator_name": "Sandra Rodriguez",
  "submission_date": "2026-03-06",
  "status": "pending_approval",
  "source": "FORM",
  "total_cash": 9500.00,
  "expected_cash": 0.0,
  "variance": 9500.00,
  "variance_pct": 0.0,
  "variance_exception": false,
  "variance_note": null,
  "approved_by": null,
  "approved_by_name": null,
  "approved_at": null,
  "rejection_reason": null,
  "submitted_at": "2026-03-06T09:14:00+00:00",
  "created_at": "2026-03-06T09:14:00+00:00",
  "updated_at": "2026-03-06T09:14:00+00:00"
}
```

### `SubmissionDetailOut`
Extends `SubmissionOut` with:
```json
{
  "sections": {
    "A": { "total": 500.00, "denominations": { "50": 5, "20": 10 } },
    "B": { "total": 750.00, "denominations": {} }
  }
}
```

### `VerificationOut`
```json
{
  "id": "uuid",
  "verification_type": "CONTROLLER",
  "location_id": "loc-appleton",
  "location_name": "APPLETON",
  "verifier_id": "uuid",
  "verifier_name": "Terri Serrano",
  "verification_date": "2026-03-13",
  "scheduled_time": "09:00",
  "day_of_week": 4,
  "day_name": "Friday",
  "status": "scheduled",
  "warning_flag": true,
  "warning_reason": "Visiting every Friday for 4+ weeks",
  "observed_total": null,
  "variance_vs_imprest": null,
  "variance_pct": null,
  "notes": "",
  "missed_reason": null,
  "month_year": null,
  "signature_data": null,
  "created_at": "2026-03-06T10:00:00+00:00",
  "updated_at": "2026-03-06T10:00:00+00:00"
}
```

**Status values:** `scheduled`, `completed`, `missed`, `cancelled`
**Verification type values:** `CONTROLLER`, `DGM`

### Paginated Response Pattern
All paginated endpoints return:
```json
{
  "items": [],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

---

## 16. Error Codes

| HTTP Status | Meaning | Common Causes |
|-------------|---------|---------------|
| `400` | Bad Request | Invalid state transition (approve already-approved, update non-draft) |
| `401` | Unauthorized | Missing/expired token, wrong password, inactive account |
| `403` | Forbidden | Role does not have permission for this action |
| `404` | Not Found | Resource ID does not exist |
| `422` | Unprocessable Entity | Request body validation failure (missing required field, wrong type) |
| `500` | Internal Server Error | Unhandled exception; check backend logs |

**Error response shape:**
```json
{
  "detail": "Human-readable error message"
}
```

---

## Appendix: Notification Reference

| ID | Event | Endpoint | Recipients | Template |
|----|-------|----------|------------|----------|
| N-01 | Submission created (not draft) | POST /submissions | Controllers at location | `submission_pending.html` |
| N-02 | Draft submitted | POST /submissions/{id}/submit | Controllers at location | `submission_pending.html` |
| N-03 | Submission approved | POST /submissions/{id}/approve | Operator | `submission_approved.html` |
| N-04 | Submission rejected | POST /submissions/{id}/reject | Operator | `submission_rejected.html` |
| N-05 | Controller visit scheduled | POST /verifications/controller | All DGMs | `visit_scheduled.html` |
| N-06 | Controller visit completed | PATCH /verifications/controller/{id}/complete | All DGMs | `visit_completed.html` |
| N-07 | DGM visit scheduled | POST /verifications/dgm | All Regional Controllers | `visit_scheduled.html` |
| N-08 | DGM visit completed | PATCH /verifications/dgm/{id}/complete | All Regional Controllers | `visit_completed.html` |
| N-09 | Missed submission logged | POST /missed-submissions | Controllers at location | `missed_explanation.html` |

All notifications are delivered asynchronously via FastAPI `BackgroundTasks` (non-blocking).

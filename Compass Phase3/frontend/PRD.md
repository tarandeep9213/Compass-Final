# Product Requirements Document
# Compass CashRoom Compliance System (CCS)

**Version:** 2.0
**Date:** March 2026
**Status:** Final — for DB design and API design
**Frontend:** React 18 + Vite + TypeScript (complete — mock data only)
**Backend to build:** FastAPI + PostgreSQL

**Changelog v2.0:**
- Manager role eliminated. All submission approval responsibilities transferred to Controller.
- Controller now has two dashboards: verification visit management and daily submission approval.
- All notifications previously directed to Manager are now directed to Controller.
- Manager removed from user_role enum, API role guards, reports, roster import mapping, and user creation.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Roles](#2-user-roles)
3. [Core Business Rules](#3-core-business-rules)
4. [System-Wide Constraints](#4-system-wide-constraints)
5. [Functional Requirements by Module](#5-functional-requirements-by-module)
   - 5.1 Authentication
   - 5.2 Operator — Cash Submission Workflow
   - 5.3 Controller — Full Workflow (Verification + Approval)
   - 5.4 DGM — Monthly Oversight Workflow
   - 5.5 Regional Controller — Compliance & Trends
   - 5.6 Admin — Locations Management
   - 5.7 Admin — Users Management
   - 5.8 Admin — Screen Access Delegation
   - 5.9 Admin — Roster Import
   - 5.10 Audit Trail
   - 5.11 Reports
6. [Data Models Summary](#6-data-models-summary)
7. [API Surface Summary](#7-api-surface-summary)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Email Notification Requirements](#9-email-notification-requirements)
10. [Out of Scope](#10-out-of-scope)

---

## 1. Product Overview

### 1.1 What Is This System?

The Compass CashRoom Compliance System (CCS) is a web application used by Compass Group / Canteen Services to track daily cash reconciliation across multiple cashroom locations (e.g., airport terminals, food courts).

**Problem it solves:** Every cashroom location must count and report their cash at the end of each business day. Currently done on paper or in spreadsheets. CCS digitises the entire process and enforces a multi-layer compliance chain.

### 1.2 Compliance Chain

The system enforces three overlapping compliance tracks monitored in real-time:

| Track | Owner | Frequency | What It Checks |
|---|---|---|---|
| Cash Submission | Operator + Controller | Daily | Was cash counted and approved? |
| Controller Verification | Controller | Rolling (no fixed schedule) | Physical spot-check of cash count |
| DGM Oversight | DGM | Once per calendar month | Senior management oversight visit |

> **Note:** The Controller owns both the daily submission approval track and the physical verification track. These are managed through two separate dashboards within the Controller's interface.

### 1.3 Key Stakeholders

- **Operators:** Cashroom staff who physically count and report cash daily
- **Controllers:** Compliance officers who approve/reject operator submissions AND physically verify cash counts at locations
- **DGMs:** District General Managers who perform monthly oversight visits
- **Regional Controllers:** Senior oversight role with read-access to all compliance data
- **Admins:** System administrators who manage users, locations, and configuration
- **Auditors:** Read-only access to reports and audit trail

---

## 2. User Roles

| Role | Landing Screen | Primary Responsibility |
|---|---|---|
| `OPERATOR` | Operator Dashboard | Submit daily cash counts |
| `CONTROLLER` | Controller Dashboard | Approve/reject submissions + schedule and log verification visits |
| `DGM` | DGM Visit Dashboard | Schedule and log monthly oversight visits |
| `ADMIN` | Locations | Manage locations, users, system config |
| `REGIONAL_CONTROLLER` | Compliance Dashboard | Senior oversight across all locations |
| `AUDITOR` | Reports | Read-only access to reports and audit trail |

### 2.1 Controller Dual Role

The Controller is the only role with two distinct dashboards:

| Dashboard | Panel | Purpose |
|---|---|---|
| Dashboard | `ctrl-dashboard` | Manage scheduled and completed physical verification visits |
| Daily Report Dashboard | `ctrl-daily-report` | Review, approve, and reject daily operator cash submissions |

Both dashboards are accessible from the Controller's sidebar navigation at all times.

### 2.2 Access Delegation (Special Rule)

Admins can grant DGM and Regional Controller users temporary access to:
- The full **Operator** workflow (to submit cash counts on behalf of a location)
- The full **Controller** workflow (both dashboards — verification visits and submission approvals)

This access is role-additive: the user retains their original role's nav items and gains the delegated screens in addition. Access is stored server-side and must survive page refresh.

---

## 3. Core Business Rules

| Rule ID | Rule | Enforcement |
|---|---|---|
| BR-001 | Each active location must have exactly one cash submission per calendar day | Block duplicate: 409 on second submit for same location+date |
| BR-002 | An operator may only submit for locations assigned to them | Check user_locations at submit time; 403 if not assigned |
| BR-003 | If \|variance %\| > tolerance (default 5%), operator must provide a written explanation | Require variance_note before submission is accepted; 422 if missing |
| BR-004 | Controller must approve or reject within 48 hours of submission (configurable SLA) | System flags submissions as "overdue" after SLA hours pass; overdue count shown in red on Controller's Daily Report Dashboard |
| BR-005 | Controller may only approve/reject submissions for locations assigned to them | 403 if location not in controller's user_locations |
| BR-006 | Controller should not visit same location on same day-of-week two consecutive weeks (configurable lookback: 4 or 6 weeks) | System warns (amber) but does not block; logs warning_flag and reason |
| BR-007 | DGM may visit a given location at most once per calendar month | Block with 409 if a DGM verification exists for same location+month_year |
| BR-008 | A draft submission may exist in parallel with an approved/pending submission only for a different date | Same-date draft of an existing approved/pending sub: block |
| BR-009 | Missed submission explanations do not replace the submission — the day remains "Missing" in compliance tracking | Separate table; compliance view still counts the day as missing |
| BR-010 | Variance % = (Total Fund − Expected Cash) / Expected Cash × 100 | Computed server-side, stored at submit time |
| BR-011 | Total Fund = Sum of sections A + B + C + D + E + F + G + H + I(net) | Computed server-side |
| BR-012 | Section I net = Overage − Shortage | Computed server-side |
| BR-013 | Operators cannot submit for future dates | Date validation: submission_date <= today |
| BR-014 | Rejected submissions may be resubmitted (creates a new submission for the same date, replacing the rejected one) | Delete or supersede the old rejected record; one active submission per location+date |
| BR-015 | Controller visit date must be in the future (tomorrow or later) | Date validation at schedule time |

---

## 4. System-Wide Constraints

- **Authentication:** JWT-based. All endpoints except `/v1/auth/login` and `/health` require a valid Bearer token.
- **Role enforcement:** Every endpoint checks the caller's role. Role violations return 403.
- **Audit immutability:** Audit events are write-only (append). No update or delete on audit_events.
- **Soft deletes:** Locations and users are never hard-deleted. Deactivation sets `active = false`.
- **One submission per location per day:** Enforced by a unique constraint on (location_id, submission_date) in the submissions table.
- **One DGM visit per location per month:** Enforced by a unique constraint on (location_id, month_year, verification_type='DGM').
- **Decimal precision:** All currency amounts stored as NUMERIC(12,2). Variance percentages stored as NUMERIC(8,4).
- **Timezone:** All timestamps stored in UTC. Display conversion is the frontend's responsibility.

---

## 5. Functional Requirements by Module

---

### 5.1 Authentication

#### 5.1.1 Login

**Actor:** All users
**Trigger:** User submits email and password

**Flow:**
1. User provides email + password
2. System looks up user by email
3. Validates bcrypt password hash
4. If valid: return JWT access token + user profile (`id`, `name`, `role`, `locationIds`, `accessGrants`)
5. If invalid: return 401 with message "Invalid email or password" (do not distinguish between wrong email vs wrong password)
6. Frontend stores token in memory; includes in `Authorization: Bearer <token>` header on all subsequent requests

**JWT Payload must include:** `user_id`, `role`, `email`, `exp`

**Frontend behaviour post-login by role:**

| Role | Landing Panel |
|---|---|
| OPERATOR | `op-start` |
| CONTROLLER | `ctrl-dashboard` |
| DGM | `dgm-dash` |
| ADMIN | `adm-locations` |
| REGIONAL_CONTROLLER | `adm-compliance` |
| AUDITOR | `aud-reports` |

#### 5.1.2 Get Current User (`/v1/auth/me`)

Returns the authenticated user's full profile, including any active access grants. Used by the frontend to re-hydrate state after page refresh.

Response must include:
- `id`, `name`, `email`, `role`, `locationIds`
- `accessGrants: ["operator" | "controller"]` — list of extra screen access types currently granted

#### 5.1.3 Token Refresh

Standard refresh endpoint. Returns new access token given a valid (non-expired) existing token.

---

### 5.2 Operator — Cash Submission Workflow

#### 5.2.1 Operator Dashboard (`op-start`)

**Actor:** Operator (also: DGM or RC user with Operator Access Grant)

**Data displayed:**
1. **Today's Status Card** — one of:
   - Not submitted: amber — "Submit Today's Count" button
   - Draft in progress: amber — "Resume Draft" button
   - Pending approval: amber — shows total and variance
   - Approved: green — shows total, variance, approver name
   - Rejected: red — shows rejection reason + "Resubmit" button

2. **Summary Chips** (filter the history table below):
   - Pending | Rejected | Missing | Approved
   - Count shown on each chip. Clicking filters the table.

3. **30-Day History Table** (10 rows per page, paginated):
   - Columns: Date | Total Cash | Variance | Status
   - Shows every calendar day for the past 30 days including today
   - Days with no submission show "Missing" row in red with "Log Missed" action link
   - Today with no submission shows "Submit Now" link
   - Clicking any submitted row → navigates to `op-readonly`
   - Clicking any missing row → navigates to `op-missed`

4. **Jump to Date** — date input to filter/scroll to a specific past date

**Business rules:**
- Only shows data for the operator's assigned location(s)
- Cannot submit for future dates
- Cannot submit for a date that already has an approved/pending submission (rejected = can resubmit)

---

#### 5.2.2 Choose Entry Method (`op-method`)

**Actor:** Operator
**Context received:** `locationId`, `date`, `submissionId` (if resuming draft)

Three entry method cards:
1. **Digital Form** (recommended) — navigates to `op-form`
2. **Guided Chat** — navigates to `op-chat`
3. **Excel Upload** — navigates to `op-excel`

A reference table of all 9 form sections (A–I) is shown to help the operator prepare.

No form data — purely a navigation screen. No API call needed.

---

#### 5.2.3 Digital Cash Form (`op-form`)

**Actor:** Operator
**Context received:** `locationId`, `date`, `submissionId` (if resuming draft)

This is the most complex screen. It captures all 9 sections of the cash count.

**Form Sections:**

| Section | Name | Input Type | Denominations / Fields |
|---|---|---|---|
| A | Currency Bills | Qty per denomination × face value | $100, $50, $20, $10, $5, $2, $1 |
| B | Coins in Counting Machines | Qty per denomination × face value | $1.00, $0.50, $0.25, $0.10, $0.05, $0.01 |
| C | Bagged Coin | Qty per bag type × bag value | $25 dollar bags, $10 quarter bags, $5 dime bags, $2 nickel bags, $50 bulkers |
| D | Unissued Changer Funds | 4 rows each with qty × amount | Free-form entries |
| E | Rolled Coin | 4 direct dollar amounts | Subtotals per coin type |
| F | Returned Uncounted Funds | 3 direct dollar amounts | Returned cash not yet counted |
| G | Mutilated / Foreign Currency | 2 direct amounts (currency + coin) | Damaged or foreign money |
| H | Changer Funds Outstanding | 1 direct amount | Cash currently in change machines |
| I | Net Unreimbursed Shortage/Overage | 2 amounts: shortage + overage | Net = Overage − Shortage |

**Sticky Calculation Bar (always visible at top):**
- Total Fund (sum of A through I net)
- Imprest (expected cash from location config)
- Variance = Total Fund − Imprest
- Variance % = (Variance / Imprest) × 100
- Color coding: green ≤ 2% | amber 2–5% | red > 5%
- Section completion dots: one dot per section (A–I), fills as user enters data

**Variance Warning:**
- If |Variance %| > tolerance threshold (from location config, default 5%):
  - Yellow warning banner: "Variance exceeds X% tolerance. Explanation required."
  - Required textarea appears: "Explain the variance" (min 10 chars)
  - Submit is blocked until this is filled

**Actions:**
- **Save Draft:** Saves current state without submitting. Creates/updates a `DRAFT` submission record. Shows a success confirmation. Can be resumed later.
- **Submit:** Validates all rules, creates/updates submission with `PENDING_APPROVAL` status.

**Validation rules:**
- All quantity fields must be ≥ 0
- If variance exceeds tolerance, variance_note required (min 10 chars)
- At least one section must have a non-zero value
- Duplicate date check (non-draft for same location+date already approved/pending → block)

**Data for draft pre-fill:**
When resuming a draft, all previously entered section values must be pre-populated.

---

#### 5.2.4 Guided Chat Entry (`op-chat`)

**Actor:** Operator
**Context received:** `locationId`, `date`

Chatbot-style denomination entry for new or less technical staff.

**Flow:**
1. System shows a welcome message and walks through 19 denominations one at a time
2. Each prompt: "How many [denomination] do you have?"
3. Operator types a number and presses Enter or clicks Send
4. System acknowledges: "Got it: $X" and advances to next prompt
5. Running total sidebar updates after each entry
6. After all 19, a summary screen shows all values with total and variance
7. If variance > 5%: requires explanation before submit
8. Submit creates `PENDING_APPROVAL` submission

**Denominations covered (19 total):**
- Section A: $100, $50, $20, $10, $5, $2, $1 bills
- Section B: $1.00, $0.50, $0.25, $0.10, $0.05, $0.01 coins
- Section C: Bagged coins (aggregated)
- Section E: Rolled coin total
- Section H: Changer outstanding

**Sections D, F, G, I default to $0** when using chat. Operator can switch to Digital Form if those sections have values.

**Navigation:**
- Back arrow on any step returns to previous denomination with prior answer pre-filled
- Progress indicator shows "Step X of 19"

---

#### 5.2.5 Excel Upload (`op-excel`)

**Actor:** Operator
**Context received:** `locationId`, `date`

**Flow:**
1. Drag-and-drop (or click-to-browse) zone accepts `.xlsx` or `.xls` only
2. Client-side parsing using SheetJS extracts section totals from the Sheboygan format template
3. Preview table displays extracted totals for sections A–I + grand total + variance
4. If variance > 5%: explanation textarea appears
5. "Submit" creates submission with `source='EXCEL_UPLOAD'`; filename stored in `excel_filename`
6. "Demo File" button fills mock values without actual upload (dev/testing only; gate behind env flag in production)

**File format:** Must match the Sheboygan Excel template. Backend parser (openpyxl/Python) validates format when file is sent for storage. Client-side parsing extracts totals for immediate preview.

**Error cases:**
- Non-`.xlsx`/`.xls` file → "Only .xlsx or .xls files are accepted"
- File doesn't match expected template → "Could not parse this file. Please use the standard template."

---

#### 5.2.6 View Submission — Read Only (`op-readonly`)

**Actor:** Operator (read-only view) or Controller (approval mode)
**Context received:** `submissionId`, `fromPanel`

**Operator view:**
- Location name, date, status badge
- Total cash, imprest, variance, variance %
- Full section-by-section breakdown (A–I with individual and grand totals)
- Variance note (if present)
- Variance exception badge (if |variance%| > tolerance)
- Submission source badge (Form / Guided Chat / Excel Upload)
- If approved: "Approved by [name] on [datetime]"
- If rejected: rejection reason + "Resubmit" button

**Controller view (when `fromPanel === 'ctrl-daily-report'`):**
All of the above, PLUS:
- "Approve" button (green)
- "Reject" button (red) — opens inline textarea for rejection reason (required, min 10 chars)
- After action: shows confirmation and disables buttons

**Resubmit flow:** Navigates to `op-method` with same `locationId` and `date` in context.

---

#### 5.2.7 Missed Submission Explanation (`op-missed`)

**Actor:** Operator
**Context received:** `date`, `locationId`

When a day has no submission and the operator clicks "Log Missed" from the dashboard, this screen captures a formal explanation.

**Form fields:**
- **Reason** (dropdown, required): Illness | Technical Issue | Emergency | Public Holiday | Training | Other
- **Detail** (textarea, required, min 20 chars): Full explanation
- **Supervisor name** (text, required): Name of the supervisor who is aware / authorised the missed day

**On submit:**
- Creates a `missed_submissions` record
- Shows success confirmation modal with option to return to dashboard
- The day remains "Missing" in compliance views — this record is for audit purposes only

---

#### 5.2.8 Saved Drafts (`op-drafts`)

**Actor:** Operator

Lists all saved draft submissions for this operator. Shows: Date | Location | Last Saved | Total (so far) | Resume button.

Clicking Resume navigates to `op-form` with the draft pre-loaded.

---

### 5.3 Controller — Full Workflow (Verification + Approval)

The Controller role has two fully independent dashboards accessible from the sidebar:

| Sidebar Item | Panel | Responsibility |
|---|---|---|
| Dashboard | `ctrl-dashboard` | Physical verification visit management |
| Daily Report Dashboard | `ctrl-daily-report` | Daily operator submission review and approval |

---

#### 5.3.1 Controller Dashboard (`ctrl-dashboard`)

**Actor:** Controller (also: DGM or RC user with Controller Access Grant)

Manages all scheduled and past physical verification visits across the controller's assigned locations.

**KPI Cards (4):**
1. Completed This Month
2. Upcoming Visits (scheduled count)
3. Missed Visits (need follow-up)
4. Avg Visit Gap (days between completed visits)

**Filter Bar:**
- Status chips: All | Scheduled | Completed | Missed
- Location dropdown

**Visit Table columns:** Date | Day of Week | Location | Status | Observed Total | vs Imprest | Variance % | DOW Warning | Notes | Actions

**Inline Actions (for Scheduled rows only):**
- **Complete** button: expands inline form with:
  - Observed Total (numeric, required)
  - Notes (optional)
  - Digital Signature (canvas, required — controller must sign before confirming)
  - DOW Warning Reason (dropdown, appears only if this completion triggers a DOW pattern warning):
    - Operational necessity
    - Requested by location manager
    - Follow-up required
    - Other
  - Confirm / Cancel buttons
- **Missed** button: expands inline form with:
  - Reason (dropdown, required):
    - Location access unavailable
    - Operational conflict — staff not available
    - Personal / medical emergency
    - Travel or transport issue
    - Rescheduled by area manager
    - Other (documented separately)
  - Notes (optional)
  - Confirm / Cancel buttons

Only one row can be expanded at a time. Confirming an action closes the expanded row and updates status immediately.

**"Schedule Visit" button** at top of page → navigates to `ctrl-schedule`

---

#### 5.3.2 Daily Report Dashboard (`ctrl-daily-report`)

**Actor:** Controller

The submission approval queue. Replaces the former Manager approval screen. The controller reviews all operator cash count submissions for their assigned locations and approves or rejects them.

**KPI Cards (4):**
1. Awaiting Approval count (turns red if any submission is overdue > SLA hours)
2. Approved count
3. Rejected count
4. Avg Variance % (color-coded: green ≤ 2% / amber 2–5% / red > 5%)

**Filter Bar:**
- Location dropdown (all assigned locations or specific one)
- Status chips: All | Pending | Approved | Rejected
- Date range: Last 7 days | Last 30 days | All time

**Submission Table:**
- Columns: Date | Location | Operator | Total Cash | Variance | Status | Overdue Flag | Actions
- Overdue rows (pending > SLA hours) highlighted in red
- Actions column: "View" button → navigates to `op-readonly` in controller approval mode (`fromPanel = 'ctrl-daily-report'`)
- Inline **Approve** button: one-click approval without navigating away
- Inline **Reject** button: opens inline textarea for rejection reason (required, min 10 chars); confirm button saves

**Business rules:**
- Controller can only see and act on submissions for their assigned locations
- After inline approve/reject, row status badge updates immediately
- Overdue flag fires after SLA hours (default 48h, configured in Global Defaults)

---

#### 5.3.3 Approval History (`ctrl-approval-history`)

**Actor:** Controller

Read-only history of all approval decisions made by this controller.

**KPI Cards:** Total actioned | Approval % | Rejection % | Avg variance of reviewed submissions

**Filters:** Date range (7d / 30d / All) | Status (Approved / Rejected)

**Table columns:** Location | Operator | Submission Date | Total Cash | Variance | Status | Decision Time | Rejection Reason (excerpt)

---

#### 5.3.4 Schedule Controller Visit (`ctrl-schedule`)

**Actor:** Controller

**Step 1 — Location:** Dropdown. Shows only controller's assigned locations.

**Step 2 — Date:** Calendar widget.
- Can only select future dates (tomorrow or later)
- Dates with existing SCHEDULED visits show a green dot (blocked, cannot re-select)
- Dates that would trigger a DOW warning show an amber dot
- DOW check fires live as the user clicks a date (calls `GET /v1/verifications/controller/check-dow`)

**Day-of-Week Warning Flow:**
- If selected date triggers a DOW warning:
  - Amber warning banner shows previous visit dates on the same day-of-week
  - Controller must acknowledge by selecting a reason from dropdown:
    - Operational necessity
    - Requested by location manager
    - Follow-up required
    - Other
  - System logs `warning_flag = true` and `warning_reason`
  - Visit is not blocked — only warned

**Step 3 — Time Slot:** 5 options: 09:00 | 11:00 | 13:00 | 15:00 | 17:00

**Step 4 — Submit:** Creates `SCHEDULED` verification record. Shows success confirmation with booking details.

---

#### 5.3.5 Controller Verification History (`ctrl-history`)

**Actor:** Controller

**KPI Cards:** Total Verified | This Month | Pattern Warnings | Avg Days Between Visits

**Filters:** Location dropdown

**Table columns:** Date | Day of Week | Location | Observed Total | vs Imprest | Variance % | DOW Warning flag | Notes

---

### 5.4 DGM — Monthly Oversight Workflow

#### 5.4.1 DGM Visit Dashboard (`dgm-dash`)

**Actor:** DGM

Monthly oversight visit management. Same layout/behaviour pattern as Controller Dashboard.

**KPI Cards (4):**
1. Visited This Month (X / total locations)
2. Remaining (locations not yet visited this month)
3. Overdue Months (past months with no visit)
4. Missed Visits (need follow-up)

**Filter Bar:**
- Status chips: All | Scheduled | Completed | Missed
- Location dropdown

**Visit Table columns:** Date | Location | Month | Status | Observed Total | vs Imprest | Notes/Reason | Actions

**Inline Actions (for Scheduled rows only):**
- **Complete** button: expands inline form:
  - Observed Total (numeric, required)
  - Notes (optional)
  - Digital Signature (canvas, required — DGM must sign before confirming)
  - If the location already has a completed DGM visit this month: amber warning chip "Already visited this month on [date]" shown in Notes column
- **Missed** button: expands inline form:
  - Reason (dropdown, required): same options as Controller
  - Notes (optional)

**"Schedule Visit" button** at top → navigates to `dgm-log`

---

#### 5.4.2 Log DGM Visit (`dgm-log`)

**Actor:** DGM

**Step 1 — Location:** Dropdown with all DGM's assigned locations.

**Step 2 — Month/Date:** Calendar shows which months already have a DGM visit (blocked with "VISITED" badge). If selected month already has a visit, an amber warning shows existing visit date. No time slot required.

**Step 3 — Notes:** Optional free text.

**Submit:** Creates `SCHEDULED` DGM verification record with `month_year` populated.

**Business rule:** If a DGM visit already exists for this location in the same month → 409 "Already visited this location this month."

---

#### 5.4.3 DGM Visit History (`dgm-history`)

**Actor:** DGM

Read-only full visit history with rich filtering.

**KPI Cards (4):** Total Visits | Completed | Scheduled | Missed

**Filters (5 dropdowns):** Location | Year | Month | Status | Variance Band (within tolerance / over tolerance)

**Table columns:** Month | Location | Visit Date | Status | Observed Total | vs Imprest | Notes

---

### 5.5 Regional Controller — Compliance & Trends

#### 5.5.1 Compliance Dashboard (`adm-compliance`)

**Actor:** Regional Controller (primary) and Admin

Single-page operational view of ALL locations' compliance status across all 3 tracks simultaneously.

**KPI Cards (6):**
1. **Overall Compliance %** — % of active locations fully green on all 3 tracks
2. **Submitted Today** — X of N locations have a submission for today
3. **Overdue >48h** — count of submissions pending beyond SLA (shown in red when > 0)
4. **Variance Exceptions** — locations with |variance%| > tolerance today
5. **Controller Issues** — locations with missed controller visits or last visit > 14 days ago
6. **DGM Coverage** — count of locations visited by DGM this calendar month

**Sort Toggle:** "Most Critical" (red/amber first) | "A–Z"

**Location Status Table** — one row per active location:

| Column | Description |
|---|---|
| Health Badge | green (Compliant) / amber (At Risk) / red (Non-Compliant) |
| Today's Submission | Status badge, Total, Variance |
| 30-Day Rate | % of past 30 days with at least one submission |
| Last Controller Visit | Date, days ago, DOW warning flag |
| Next Controller Visit | Scheduled date (if any) |
| DGM This Month | Visit status + observed total |

**Health badge logic:**
- red: today's submission is rejected, OR any controller visit missed, OR submission overdue > SLA
- amber: not yet submitted today, OR controller visit overdue > 14 days, OR no DGM visit this month
- green: all three tracks clear

---

#### 5.5.2 Cash Count Trends (`rc-trends`)

**Actor:** Regional Controller

Interactive area chart showing average cash count section totals over time.

**Filters:**
- Granularity toggle: Weekly | Monthly | Quarterly
- Period selector: Last 8/12/24 weeks | Last 6/12 months | Last 4/8 quarters
- Location pills: "All" + one pill per active location

**Section tabs (A–I):** Click to switch which section is charted. One section at a time.

**KPI Summary row (above chart):**
- Latest period value
- % change vs previous period (green up / red down)
- Period average
- Peak value in range

**Chart type:** Area chart (Recharts AreaChart) with gradient fill in the active section's colour.

**Backend endpoint needed:** `GET /v1/reports/section-trends?section=A&granularity=monthly&periods=12&location_id=optional`

---

### 5.6 Admin — Locations Management (`adm-locations`)

**Actor:** Admin

Full CRUD for cashroom locations, plus global system defaults.

#### 5.6.1 Locations Table

**Columns:** Code | Name | Expected Cash | Tolerance % | Status | Actions

**Actions per row:**
- **Edit:** Opens inline form in the same row with fields pre-populated
- **Deactivate:** Requires a confirmation step. Sets `active = false`. Deactivated locations show greyed out with a "Reactivate" action.
- **Reactivate:** Sets `active = true`

**Add Location:** "Add Location" button above table opens an inline add form.

**Inline Add/Edit Form fields:**
- Name (text, required)
- Expected Cash (number, required, must be > 0)
- Tolerance % (number, required, range 1–20)

**Pagination:** 10 rows per page

#### 5.6.2 Global Defaults Card (below table)

Settings that apply to newly created locations unless overridden:
- **Default Tolerance %** — applied to new locations
- **Approval SLA (hours)** — global SLA before submission is flagged overdue for controller action

"Save Defaults" button shows a 3-second success flash on save.

These settings are stored in `system_config` table as key-value pairs.

---

### 5.7 Admin — Users Management (`adm-users`)

**Actor:** Admin

Full CRUD for user accounts, plus system settings, plus screen access delegation.

#### 5.7.1 Users Table

**Columns:** Name | Email | Role | Locations | Status | Actions

**Actions per row:**
- **Edit:** Opens inline edit form
- **Deactivate / Reactivate:** Soft delete

**Add User:** Opens inline add form.

**Inline Add/Edit Form fields:**
- Name (text, required)
- Email (email, required, unique)
- Role (dropdown: Operator | Controller | DGM | Admin | Auditor | Regional Controller)
- Locations (multi-select of active locations)
- Password (text, required for add; optional for edit — if left blank, password is unchanged)

**Pagination:** 10 rows per page

#### 5.7.2 System Settings Card (below user table)

- **DOW Lookback Window:** 4-week or 6-week toggle (how far back to check day-of-week visit patterns for controllers)
- **Daily Reminder Time:** Time picker for automated reminder email sends
- **Data Retention:** Number input 1–7 years

"Save Settings" button. Settings stored in `system_config` table.

---

### 5.8 Admin — Screen Access Delegation Card (within `adm-users`)

Below System Settings card. Only DGM and Regional Controller users appear in this table.

**Table columns:** User | Role | Operator Access | Controller Access | Actions

**Per access type per user:**
- If not granted: NONE badge + "Grant" button
- If granted: GRANTED badge + grant date + note + "Edit" and "Revoke" buttons

**Grant / Edit inline form:**
- Operator access: blue-coloured inline form
- Controller access: purple-coloured inline form
- Fields: Optional Reason/Note (text)

**Revoke:** Removes access immediately. Writes ACCESS_REVOKED audit event.

**Effect on DGM/RC user after grant:**
- New nav item(s) appear in their sidebar:
  - "Operator View" if operator access granted
  - "Controller View" if controller access granted (includes both Controller dashboards)
- Profile card in sidebar shows access badges
- Full operator/controller flow becomes available for their assigned locations

---

### 5.9 Admin — Roster Import (`adm-import`)

**Actor:** Admin

Bulk import of user accounts and location assignments from the Cashroom roster Excel file.

**Upload Zone:**
- Drag & drop or click to browse
- Accepts: `.xlsx`, `.xls`, `.csv`

**Expected columns in roster file:**

| Column | Maps To |
|---|---|
| CC # | Location code |
| District | Location district |
| Cashroom Lead | Operator |
| Manager/Daily Reviewer | Controller (this column's personnel now perform Controller duties) |
| Controller | Controller |
| DGM/RD | DGM |
| Regional Controller | Regional Controller |
| Division Contacts | Regional Controller (secondary) |

> **Note:** The "Manager/Daily Reviewer" column from the legacy roster maps to the Controller role. Persons listed in this column are imported as Controllers. Duplicate name entries across "Manager/Daily Reviewer" and "Controller" columns for the same location should be merged into a single Controller user record.

**Parsing (client-side with SheetJS):**
- Auto-detects header row (finds row containing "CC")
- Handles continuation rows where CC # is blank (inherits from previous row)
- Skips empty rows

**Preview table:**
- Shows all parsed rows with role-ownership badges colour-coded by column type
- Summary KPIs: Unique Locations | Unique Cashroom Leads | Unique Controllers | Unique DGMs

**Confirm Import:**
- Appears once rows are parsed
- On click: `POST /v1/admin/import` with parsed rows
- Backend creates/updates user accounts and location assignments
- Shows success banner

---

### 5.10 Audit Trail (`adm-audit`)

**Actor:** Admin and Auditor (read-only)

Immutable, filterable log of every state-changing action in the system.

#### Event Types Logged

| Event Type | Triggered By |
|---|---|
| SUBMISSION_CREATED | Operator submits a cash count |
| SUBMISSION_APPROVED | Controller approves a submission |
| SUBMISSION_REJECTED | Controller rejects a submission |
| CONTROLLER_VERIFIED | Controller completes or misses a verification visit |
| DGM_VERIFIED | DGM completes or misses a visit |
| USER_CREATED | Admin creates a user |
| USER_UPDATED | Admin edits a user |
| LOCATION_CREATED | Admin creates a location |
| LOCATION_UPDATED | Admin edits a location |
| CONFIG_CHANGED | Admin saves global defaults or system settings |
| MISSED_SUBMISSION_LOGGED | Operator logs a missed day explanation |
| ACCESS_GRANTED | Admin grants Operator/Controller access to DGM/RC |
| ACCESS_REVOKED | Admin revokes access |

#### Filters (cascading)

1. **Event Type** dropdown → narrows Actor options to only actors who have performed that event
2. **Actor** dropdown → narrows Location options to only locations relevant to both selections
3. **Location** dropdown
4. **Date Range:** All Time | Today | Last 7 Days | This Month | Custom (date range pickers)

Cascading behavior: selecting a filter auto-narrows downstream dropdowns. Selecting a value that invalidates a prior selection auto-resets that prior selection.

#### Table Columns

Timestamp | Event (colored badge) | Actor | Location | Detail | Change (old → new value)

**Pagination:** 15 rows per page

---

### 5.11 Reports (`adm-reports`)

**Actor:** Admin and Auditor (read-only)

Summary reports for a selected date range with CSV export.

**Date Range Selector:** This Week | This Month | Custom (default: This Month)

**KPI Cards (6):**
1. Total Submissions
2. Approval Rate %
3. Variance Exceptions count
4. Avg Variance %
5. Controller Verification Visits
6. DGM Visits

**Report Table 1 — Per-Location Summary** (10 per page):

| Location | Submissions | Approved | Rejected | Overdue | Avg Variance % | Exceptions |
|---|---|---|---|---|---|---|

**Report Table 2 — Per-Actor Summary** (10 per page):

Role filter chips: All Roles | Operator | Controller | DGM

Columns vary by role:
- **Operators:** Submissions | Approved | Rejected | Pending | Rate % | Avg Variance | Exceptions | Locations
- **Controllers:** Approvals Made | Approved | Rejected | Approval Rate % | Avg Variance of reviewed subs | Verifications | Completed | Missed | Completion Rate %
- **DGMs:** Verifications | Completed | Missed | Scheduled | Completion Rate %

**Report Table 3 — Variance Exceptions** (10 per page):

All submissions in the date range where |variance%| > tolerance:

| Date | Location | Operator | Total Cash | Variance | Status | Rejection Reason |
|---|---|---|---|---|---|---|

**Export CSV:** Downloads all three tables in a single CSV file.

---

## 6. Data Models Summary

### Entities

| Entity | Key Fields | Notes |
|---|---|---|
| `locations` | id (VARCHAR PK), name, expected_cash, tolerance_pct, sla_hours, active | id format e.g. "LHR-T5-01" |
| `users` | id (UUID PK), name, email (unique), hashed_password, role, active | |
| `user_locations` | user_id + location_id (composite PK) | Many-to-many |
| `submissions` | id (UUID), location_id, operator_id, submission_date, status, source, total_cash, expected_cash (snapshot), variance, variance_pct, variance_note, variance_exception, approved_by, approved_at, rejection_reason, submitted_at, excel_filename | UNIQUE(location_id, submission_date). approved_by references a Controller user. |
| `submission_sections` | id, submission_id, section_code (A–I), section_total, denominations (JSONB) | UNIQUE(submission_id, section_code) |
| `missed_submissions` | id, location_id, operator_id, missed_date, reason, detail, supervisor_name, logged_at | UNIQUE(location_id, missed_date) |
| `verifications` | id, location_id, verifier_id, verification_type (CONTROLLER/DGM), status, verification_date, month_year (DGM only), scheduled_time (controller only), day_of_week, warning_flag, warning_reason, observed_total, signature_data, notes | UNIQUE(location_id, month_year, verification_type) blocks DGM duplicates. signature_data stores base64 PNG from canvas. |
| `system_config` | key (VARCHAR PK), value, updated_at, updated_by | Key-value store for global settings |
| `location_config_overrides` | location_id (PK), tolerance_pct, updated_at | Per-location tolerance override |
| `access_grants` | id, user_id, access_type ('operator'/'controller'), note, granted_by, granted_at | UNIQUE(user_id, access_type) |
| `audit_events` | id, event_type, actor_id, actor_name (snapshot), location_id, entity_id, entity_type, detail, old_value, new_value, ip_address, created_at | Append-only |

### Status Enums

| Enum | Values |
|---|---|
| submission_status | DRAFT, PENDING_APPROVAL, APPROVED, REJECTED |
| submission_source | FORM, CHAT, EXCEL_UPLOAD |
| verification_type | CONTROLLER, DGM |
| verification_status | SCHEDULED, COMPLETED, MISSED, CANCELLED |
| user_role | OPERATOR, CONTROLLER, DGM, ADMIN, AUDITOR, REGIONAL_CONTROLLER |

> **Note:** MANAGER has been removed from the user_role enum. The Controller role now covers all submission approval duties previously assigned to Manager.

---

## 7. API Surface Summary

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /v1/auth/login | Public | Login, return JWT + user profile |
| POST | /v1/auth/refresh | Authenticated | Refresh token |
| GET | /v1/auth/me | Authenticated | Current user + access grants |

### Submissions

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /v1/submissions | OPERATOR | Create submission (draft or direct submit) |
| GET | /v1/submissions | OP/CTRL/ADMIN | List with filters (location_id, status, date range, operator_id) |
| GET | /v1/submissions/{id} | OP/CTRL/ADMIN | Get single submission with all sections |
| PUT | /v1/submissions/{id} | OPERATOR | Update draft |
| POST | /v1/submissions/{id}/submit | OPERATOR | Finalise draft → PENDING_APPROVAL |
| POST | /v1/submissions/{id}/approve | CONTROLLER | Approve submission |
| POST | /v1/submissions/{id}/reject | CONTROLLER | Reject with reason |
| POST | /v1/missed-submissions | OPERATOR | Log missed day explanation |

**POST /v1/submissions/{id}/approve business logic:**
1. Check caller has role CONTROLLER
2. Check submission exists and is in PENDING_APPROVAL status → 409 if not
3. Check controller is assigned to the submission's location → 403 if not
4. Update submission: status='APPROVED', approved_by=current_user_id, approved_at=now()
5. Write SUBMISSION_APPROVED audit event
6. Send approval notification email to Operator

**POST /v1/submissions/{id}/reject business logic:**
1. Check caller has role CONTROLLER
2. Reason must not be empty → 422 if empty
3. Check submission exists and is in PENDING_APPROVAL status → 409 if not
4. Check controller is assigned to the submission's location → 403 if not
5. Update submission: status='REJECTED', rejection_reason=reason, approved_by=current_user_id
6. Write SUBMISSION_REJECTED audit event
7. Send rejection notification email to Operator

### Verifications

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /v1/verifications/controller | CONTROLLER | Schedule visit |
| GET | /v1/verifications/controller | CONTROLLER/ADMIN | List controller verifications |
| GET | /v1/verifications/controller/check-dow | CONTROLLER | Check DOW pattern for proposed date |
| PATCH | /v1/verifications/controller/{id}/complete | CONTROLLER | Mark scheduled visit as completed (includes signature_data) |
| PATCH | /v1/verifications/controller/{id}/miss | CONTROLLER | Mark scheduled visit as missed |
| POST | /v1/verifications/dgm | DGM | Schedule DGM visit |
| GET | /v1/verifications/dgm | DGM/ADMIN | List DGM verifications |
| PATCH | /v1/verifications/dgm/{id}/complete | DGM | Mark DGM visit as completed (includes signature_data) |
| PATCH | /v1/verifications/dgm/{id}/miss | DGM | Mark DGM visit as missed |

### Admin

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /v1/admin/locations | ADMIN | List all locations |
| POST | /v1/admin/locations | ADMIN | Create location |
| PUT | /v1/admin/locations/{id} | ADMIN | Update location |
| DELETE | /v1/admin/locations/{id} | ADMIN | Soft-delete (active=false) |
| GET | /v1/admin/users | ADMIN | List all users |
| POST | /v1/admin/users | ADMIN | Create user |
| PUT | /v1/admin/users/{id} | ADMIN | Update user |
| DELETE | /v1/admin/users/{id} | ADMIN | Soft-delete user |
| GET | /v1/admin/config | ADMIN | Get global config |
| PUT | /v1/admin/config | ADMIN | Update global config |
| PUT | /v1/admin/config/locations/{id} | ADMIN | Set per-location tolerance override |
| DELETE | /v1/admin/config/locations/{id} | ADMIN | Remove per-location override |
| GET | /v1/admin/access-grants | ADMIN | List all screen access grants |
| POST | /v1/admin/access-grants | ADMIN | Grant Operator/Controller access to DGM or RC user |
| PUT | /v1/admin/access-grants/{id} | ADMIN | Update grant note |
| DELETE | /v1/admin/access-grants/{id} | ADMIN | Revoke access |
| POST | /v1/admin/import | ADMIN | Bulk import from parsed roster |

### Reports & Audit

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /v1/audit | ADMIN/AUDITOR | Paginated audit trail with filters |
| GET | /v1/reports/summary | ADMIN/AUDITOR/RC | KPI summary for date range |
| GET | /v1/reports/locations | ADMIN/AUDITOR/RC | Per-location breakdown |
| GET | /v1/reports/actors | ADMIN/AUDITOR/RC | Per-actor breakdown (Operator / Controller / DGM) |
| GET | /v1/reports/exceptions | ADMIN/AUDITOR/RC | Variance exceptions list |
| GET | /v1/reports/section-trends | RC | Section trend data for charts |
| GET | /v1/reports/export | ADMIN/AUDITOR/RC | CSV download |
| GET | /health | Public | Health check |

### Compliance Dashboard

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /v1/compliance/dashboard | ADMIN/RC | All locations with 3-track status |

---

## 8. Non-Functional Requirements

### 8.1 Performance
- All list endpoints must support pagination (default page size: 10 or 15 as per screen spec)
- Dashboard/compliance endpoints should respond within 2 seconds for up to 50 locations
- Compliance dashboard query must be optimised with appropriate indexes

### 8.2 Security
- Passwords hashed with bcrypt (cost factor ≥ 10)
- JWT tokens expire in 24 hours
- All protected endpoints require `Authorization: Bearer <token>`
- Role-based access control enforced server-side on every endpoint (do not rely on frontend-only gating)
- SQL injection prevention via parameterised queries / ORM
- CORS restricted to known frontend origins via environment variable

### 8.3 Data Integrity
- Currency values stored as NUMERIC(12,2) — never as floats
- Variance calculation done server-side, not trusted from client
- Expected cash snapshot stored at submission time (not resolved from current location config)
- Unique constraints enforce one-submission-per-day and one-DGM-visit-per-month at DB level
- `signature_data` column in verifications stores base64 PNG. Max accepted size: 200 KB. Reject if larger.

### 8.4 Audit Completeness
- Every state-changing endpoint MUST write an audit_event record before returning a 2xx response
- Audit events must be written in the same database transaction as the state change
- actor_name must be snapshotted at write time

### 8.5 Availability & Deployment
- Backend: FastAPI on AWS ECS Fargate (Dockerized)
- Database: Amazon RDS PostgreSQL 16
- Frontend: AWS Amplify
- File storage (Excel uploads): Amazon S3 with SSE-S3 encryption
- Email: Amazon SES (v2 feature, future)
- All infrastructure behind HTTPS (ACM SSL)

---

## 9. Email Notification Requirements

**Scope: v2 (deferred — implement after core system is live)**

| Trigger | Recipient | Subject | Body Summary |
|---|---|---|---|
| Submission created | Controller (assigned to that location) | "New cash count awaiting approval — [Location]" | Submission date, total, variance, link to Daily Report Dashboard |
| Submission approved | Operator | "Your cash count was approved — [Location] [Date]" | Confirmation details, approving controller name |
| Submission rejected | Operator | "Your cash count was rejected — action required" | Rejection reason, resubmit link |
| Submission overdue >SLA | Controller (assigned to that location) | "OVERDUE: Cash count pending approval — [Location]" | Location, hours overdue, link to Daily Report Dashboard |
| Daily reminder (no submission yet) | Operator | "Reminder: Cash count not yet submitted today" | Sent at configured Daily Reminder Time |

> All notifications previously sent to Manager are now sent to the Controller assigned to that location.

Infrastructure: Amazon SES. Request production access early (SES sandbox blocks external emails by default).

---

## 10. Out of Scope

The following are explicitly NOT part of this release:

- **Mobile native app** — web only (responsive design encouraged but not a primary requirement for v1)
- **Real-time collaboration** — no WebSockets / live updates; page refresh or re-fetch is acceptable
- **Multi-currency** — system uses a single currency throughout (configured at deployment time)
- **Role-based data encryption at rest** — standard RDS encryption is sufficient
- **SSO / SAML / OAuth** — email + password authentication only in v1
- **Two-factor authentication** — v1 only
- **Excel export of individual submissions** — CSV export of reports is sufficient
- **In-app notifications** — email notifications are v2; v1 has no in-app notification bell
- **Scheduled job management UI** — cron configuration is infrastructure-level only
- **Manager role** — permanently removed; all Manager functionality has been merged into the Controller role

---

*End of PRD — Version 2.0*

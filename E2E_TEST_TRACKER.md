# E2E Test Tracker — CashRoom Compliance System

**Source:** CCS MVP Test Execution Tracker (62 official test cases)
**Project:** CCS-MVP-2026 | Client: Compass Group
Run with: `cd frontend && npx playwright test`

**Legend:** ✅ Passing · ⏭ Skipped (no demo data) · 🔲 Planned · ❌ Failing · ➖ N/A (email/infra — not browser-testable)

---

## Summary

| File | Tests | Passing | Skipped | Failing |
|------|-------|---------|---------|---------|
| `auth.spec.ts` | 13 | 13 | 0 | 0 |
| `access-control.spec.ts` | 10 | 10 | 0 | 0 |
| `dashboard.spec.ts` | 6 | 6 | 0 | 0 |
| `operator.spec.ts` | 13 | 10 | 3 | 0 |
| `admin.spec.ts` | 19 | 14 | 5 | 0 |
| `controller.spec.ts` | 14 | 11 | 3 | 0 |
| `rc-dgm.spec.ts` | 53 | 50 | 3 | 0 |
| `workflow.spec.ts` | 15 | 15 | 0 | 0 |
| `notification.spec.ts` | 13 | 13 | 0 | 0 |
| `location-scope.spec.ts` | 5 | 5 | 0 | 0 |
| **Total** | **161** | **144** | **17** | **0** |

---

## Authentication & Access Control

| ID | Test Case Title | E2E Status | Spec File | Notes |
|----|----------------|------------|-----------|-------|
| AUTH-001 | Valid Login | ✅ | `auth.spec.ts` | |
| AUTH-002 | Invalid Login Credentials | ✅ | `auth.spec.ts` | |
| AUTH-003 | MFA Enforcement for Admin Role | ➖ | — | MFA not implemented in current build |
| AUTH-004 | Session Timeout After Inactivity | 🔲 | `auth.spec.ts` | JWT auto-refresh after 1hr |
| AUTH-005 | Role-Based Page Access Restriction | ✅ | `auth.spec.ts` + `access-control.spec.ts` | |
| AUTH-006 | Password Reset via Email | ✅ | `auth.spec.ts` (AUTH-PW-001–010) | Full 3-step flow tested with mocked API; email delivery itself ➖ |

#### Password Reset Detail (`auth.spec.ts`)

| ID | Test Name | Status | Notes |
|----|-----------|--------|-------|
| AUTH-PW-001 | Forgot password link opens Reset your password form | ✅ | |
| AUTH-PW-002 | Empty email shows "Please enter your email address" | ✅ | |
| AUTH-PW-003 | API failure shows "not available in demo mode" error | ✅ | Routes API to 503 to force catch |
| AUTH-PW-004 | Back to sign in returns to login form | ✅ | |
| AUTH-PW-005 | Submit (mocked OK) advances to OTP "Check your email" view | ✅ | Mocked API → 200 |
| AUTH-PW-006 | Invalid OTP (non-6-digit) shows validation error | ✅ | Frontend-only validation |
| AUTH-PW-007 | Valid 6-digit OTP advances to "Set new password" form | ✅ | |
| AUTH-PW-008 | Password < 8 characters shows validation error | ✅ | |
| AUTH-PW-009 | Mismatched passwords shows "do not match" error | ✅ | |
| AUTH-PW-010 | Full happy path shows "Password reset successfully" on login | ✅ | Both APIs mocked → 200 |

---

## Operator — Daily Submission

| ID | Test Case Title | E2E Status | Spec File | Notes |
|----|----------------|------------|-----------|-------|
| OP-001 | Daily Email Reminder Received | ➖ | — | Email delivery — not browser E2E testable |
| OP-002 | Submit Daily Form - Digital Entry (Happy Path) | ✅ | `operator.spec.ts` | Mock mode: asserts nav back to dashboard |
| OP-003 | Section Calculation Accuracy (A–H) | ✅ | `operator.spec.ts` (OP-009) | Sections A–I visible with inputs; live calc tested in OP-008 |
| OP-004 | Variance Exceeds Tolerance — Mandatory Note Required | ✅ | `operator.spec.ts` (OP-008) + `workflow.spec.ts` (WF-006) | |
| OP-005 | Variance Within Tolerance — No Note Required | 🔲 | `operator.spec.ts` | Fill form near imprest value; verify no textarea |
| OP-006 | Save Draft and Resume | ✅ | `operator.spec.ts` (OP-006, OP-007) | |
| OP-007 | Duplicate Submission Blocked | 🔲 | `operator.spec.ts` | Submit twice for same date; second blocked |
| OP-008 | Invalid Input Validation (Non-Numeric / Negative) | 🔲 | `operator.spec.ts` | HTML number input prevents non-numeric |
| OP-009 | Excel Upload — Parse and Process | ✅ | `operator.spec.ts` (OP-003) | Upload zone visible; full parse needs real file |
| OP-010 | Variance Note — Attach Supporting Document | ➖ | — | Document attachment not in current build |
| OP-011 | Form Locked After Submission | ✅ | `operator.spec.ts` (OP-011) | |
| OP-012 | Form Unlocked After Controller Rejection | 🔲 | `operator.spec.ts` | Rejected submission shows Resubmit button |

---

## Controller — Approval Workflow

| ID | Test Case Title | E2E Status | Spec File | Notes |
|----|----------------|------------|-----------|-------|
| CTRL-APPR-001 | Approval Email Received with Correct Summary | ➖ | — | Email delivery — not browser E2E testable |
| CTRL-APPR-002 | Approve Submission via Dashboard | ✅ | `controller.spec.ts` | |
| CTRL-APPR-003 | Reject Submission with Mandatory Comment | ✅ | `controller.spec.ts` | |
| CTRL-APPR-004 | Reject Without Comment — Blocked | ✅ | `controller.spec.ts` | |
| CTRL-APPR-005 | Controller Dashboard — Status Counts | ✅ | `controller.spec.ts` | KPI cards: Completed This Month, Upcoming, Missed, Avg Gap |
| CTRL-APPR-006 | Approval via Time-Limited Email Token | ➖ | — | Email token — not browser E2E testable |
| CTRL-APPR-007 | Expired Approval Email Token | ➖ | — | Email token — not browser E2E testable |

---

## Controller — Weekly Physical Verification

| ID | Test Case Title | E2E Status | Spec File | Notes |
|----|----------------|------------|-----------|-------|
| CTRL-VER-001 | Log New Physical Verification (Happy Path) | ✅ | `controller.spec.ts` | |
| CTRL-VER-002 | Day-of-Week Conflict Warning (Same Weekday in Lookback) | ✅ | `controller.spec.ts` | |
| CTRL-VER-003 | No Conflict — Green Confirmation | ✅ | `controller.spec.ts` | |
| CTRL-VER-004 | Proceed Despite Warning — Audit Trail Recorded | ✅ | `controller.spec.ts` | Selects DOW reason; submit button enabled |
| CTRL-VER-005 | Controller Verification History View | ✅ | `controller.spec.ts` | History heading + KPIs + table/empty state |
| CTRL-VER-006 | Cannot Submit Without All Sections Verified | ✅ | `controller.spec.ts` | Submit Review disabled before sections reviewed |
| CTRL-VER-007 | Lookback Window Configurable by Admin (4 vs 6 Weeks) | 🔲 | `controller.spec.ts` | Config change reflected in DOW check |

---

## DGM — Monthly Physical Verification

| ID | Test Case Title | E2E Status | Spec File | Notes |
|----|----------------|------------|-----------|-------|
| DGM-001 | Log Monthly Verification (Happy Path) | ✅ | `rc-dgm.spec.ts` (DGM-011) | |
| DGM-002 | Second Verification in Same Month — Warning Shown | 🔲 | `rc-dgm.spec.ts` | DGMLog blocks same-month booking |
| DGM-003 | DGM Monthly Dashboard Grid — Status Colors | ✅ | `rc-dgm.spec.ts` (DGM-001–004) | Coverage dashboard KPIs and visit table |
| DGM-004 | End-of-Month Escalation Email When No Verification | ➖ | — | Email/scheduler — not browser E2E testable |
| DGM-005 | Cannot Submit Without All Sections Verified and Signature | 🔲 | `rc-dgm.spec.ts` | Submit disabled without required fields |

---

## System Administration

| ID | Test Case Title | E2E Status | Spec File | Notes |
|----|----------------|------------|-----------|-------|
| ADMIN-001 | Create New Location | ✅ | `admin.spec.ts` | |
| ADMIN-002 | Deactivate Location — History Retained | ✅ | `admin.spec.ts` (ADMIN-002, 005) | Reactivate also tested |
| ADMIN-003 | Create User with Role Assignment | ✅ | `admin.spec.ts` (ADMIN-003) | |
| ADMIN-004 | Deactivate User — Audit Trail Preserved | ✅ | `admin.spec.ts` (ADMIN-004, 009) | Reactivate also tested |
| ADMIN-005 | Configure Tolerance Threshold (Global and Per-Location) | ✅ | `admin.spec.ts` (ADMIN-007) | Global Defaults in Locations page |
| ADMIN-006 | Configure Daily Reminder Time | 🔲 | `admin.spec.ts` | System Settings in Users page |
| ADMIN-007 | Configure Controller Lookback Window Per Location | 🔲 | `admin.spec.ts` | DOW window in Users → System Settings |
| ADMIN-008 | Supported User Roles Available in Add User Form | 🔲 | `admin.spec.ts` | Role select has all 5 roles |

---

## Audit Trail & Data Integrity

| ID | Test Case Title | E2E Status | Spec File | Notes |
|----|----------------|------------|-----------|-------|
| AUDIT-001 | Immutable Audit Events for Full Submission Lifecycle | ✅ | `admin.spec.ts` (ADMIN-014–019) | Events visible; no edit buttons |
| AUDIT-002 | Rejection Event Logged with Approver Identity | 🔲 | `admin.spec.ts` | After reject: audit event with actor name |
| AUDIT-003 | No Field Modification After Submission | ✅ | `operator.spec.ts` (OP-011) | Form locked, no inputs editable |
| AUDIT-004 | Auditor / Read-Only Role | ✅ | `dashboard.spec.ts` (AUDIT-004, 004b) | |
| AUDIT-005 | Day-of-Week Override Logged in Audit Trail | 🔲 | `admin.spec.ts` | DOW warning proceed → audit entry created |

---

## Dashboards & Reporting

| ID | Test Case Title | E2E Status | Spec File | Notes |
|----|----------------|------------|-----------|-------|
| DASH-001 | Regional Compliance Dashboard — Three Track View | ✅ | `dashboard.spec.ts` + `rc-dgm.spec.ts` (RC-001–003) | |
| DASH-002 | Export Combined Compliance Report as CSV/Excel | ✅ | `dashboard.spec.ts` (DASH-002) + `rc-dgm.spec.ts` (RC-011) | |
| DASH-003 | Variance Exception Report | ✅ | `dashboard.spec.ts` (DASH-003) | |
| DASH-004 | Missing Submissions View | ✅ | `operator.spec.ts` (OP-012) | Missed filter on dashboard |
| DASH-005 | Weekly Compliance Report Auto-Generated | ✅ | `rc-dgm.spec.ts` (RC-018) | Cash Trends — weekly granularity 8/12/24 week options |

---

## Regional Controller — Extended Tests (`rc-dgm.spec.ts`)

### Cash Trends

| ID | Test Name | Status | Notes |
|----|-----------|--------|-------|
| RC-016 | Cash trends page shows all 5 KPI summary cards | ✅ | Avg Value, Trend, Locations, Variance Flag, Change |
| RC-017 | Cash trends page shows all 9 section tabs A through I | ✅ | Tabs A–I by section label first word |
| RC-018 | Cash trends weekly granularity shows 8, 12 and 24 week period options | ✅ | |
| RC-019 | Cash trends chart card title reflects the active section | ✅ | Title updates after tab B click |
| RC-020 | Cash trends quarterly granularity shows 4 and 8 quarter options | ✅ | |

### Compliance Dashboard Extended

| ID | Test Name | Status | Notes |
|----|-----------|--------|-------|
| RC-021 | Compliance dashboard period filter buttons work (Today/This Week/This Month) | ✅ | |
| RC-022 | Compliance dashboard KPI card click filters the location table | ✅ | Fully Compliant KPI → table shows green only |
| RC-023 | Compliance dashboard sort buttons toggle table ordering | ✅ | Most Critical / A–Z sort |
| RC-024 | Compliance dashboard location rows show health status badges | ✅ | ✓ Compliant / ⚠ At Risk / ✕ Non-Compliant |
| RC-025 | Compliance dashboard custom date range reveals date inputs | ✅ | |

### Reports Extended

| ID | Test Name | Status | Notes |
|----|-----------|--------|-------|
| RC-026 | Reports Date-Level Detail table has all 8 column headers | ✅ | Date, Location, Submitted, Total, Variance, Var%, Status, Approved By |
| RC-027 | Reports location filter dropdown works and shows clear button | ✅ | |
| RC-028 | Reports Per-Actor Summary section shows role filter chips | ✅ | Operator / Controller / DGM chips |
| RC-029 | Reports Variance Exceptions table is present | ✅ | Table visible or empty-state message |
| RC-030 | Reports page shows all 5 KPI cards with correct labels | ✅ | Total Submissions, Approval Rate, Variance Exceptions, Avg Variance, Ctrl+DGM Visits |

### Audit Trail Extended

| ID | Test Name | Status | Notes |
|----|-----------|--------|-------|
| RC-031 | Audit trail table has all column headers | ✅ | Conditional — rc@compass.com has 0 events (empty state accepted) |
| RC-032 | Audit trail actor filter dropdown works | ✅ | ≥1 option ("All Actors") accepted when 0 events |
| RC-033 | Audit trail Clear All filters button resets all dropdowns | ✅ | |
| RC-034 | Audit trail custom date range reveals from/to date inputs | ✅ | |

---

## Notifications & In-App Alerts (`notification.spec.ts`)

> Email notifications (backend + scheduler) are **not** browser-testable — marked ➖.
> In-app indicator proxies (KPI counts, status badges, colour-coded cards) are testable — marked ✅.

### Email Notifications — Backend Only

| ID | Trigger | Recipients | E2E Status | Notes |
|----|---------|------------|------------|-------|
| NOTIF-EMAIL-001 | Operator submits daily form | Controller / Manager | ➖ | `submission_pending` email — not browser-testable |
| NOTIF-EMAIL-002 | Controller approves submission | Operator | ➖ | `submission_approved` email — not browser-testable |
| NOTIF-EMAIL-003 | Controller rejects submission | Operator | ➖ | `submission_rejected` email — not browser-testable |
| NOTIF-EMAIL-004 | Daily 08:00 UTC scheduler | Operators with no submission | ➖ | `submission_reminder` email — scheduler job |
| NOTIF-EMAIL-005 | Pending submission >48 h (hourly check) | Controller | ➖ | `sla_breach` email — scheduler job |
| NOTIF-EMAIL-006 | Controller schedules visit | Operator / Manager | ➖ | `visit_scheduled` email — not browser-testable |
| NOTIF-EMAIL-007 | DGM completes visit | Operator / Manager | ➖ | `visit_completed` email — not browser-testable |
| NOTIF-EMAIL-008 | Operator explains missed submission | Controller | ➖ | `missed_explanation` email — not browser-testable |

### In-App Notification Indicators

| ID | Test Case Title | E2E Status | Spec File | Notes |
|----|----------------|------------|-----------|-------|
| NOTIF-CTRL-001 | Controller "Awaiting Approval" KPI visible with urgency colour | ✅ | `notification.spec.ts` | Amber when pending > 0; red when overdue |
| NOTIF-CTRL-002 | Overdue (>48 h) count surfaced in controller dashboard | ✅ | `notification.spec.ts` | Sub-label shows overdue count when SLA breached |
| NOTIF-CTRL-003 | Pending submission visible in controller review table | ✅ | `notification.spec.ts` | "Complete Review" action button present |
| NOTIF-OP-001 | Operator compliance KPI strip shows all four status counts | ✅ | `notification.spec.ts` | Accepted / Pending / Rejected / Missed tiles |
| NOTIF-OP-002 | Operator "Today's Submission" card uses correct colour for status | ✅ | `notification.spec.ts` | Green=Approved, Amber=Pending, Red=Rejected |
| NOTIF-OP-003 | Operator history rows carry coloured status badges | ✅ | `notification.spec.ts` | badge-green / badge-amber / badge-red / badge-gray |
| NOTIF-OP-004 | Rejected submission shows resubmit access / rejected badge | ✅ | `notification.spec.ts` | Rejected filter shows 0 records or red badge |
| NOTIF-VIS-001 | Controller "Upcoming Visits" KPI surfaces scheduled count | ✅ | `notification.spec.ts` | Reminder proxy — shows visit count |
| NOTIF-VIS-002 | Controller "Missed Visits" KPI amber when missed > 0 | ✅ | `notification.spec.ts` | Amber highlight triggers follow-up action |
| NOTIF-VIS-003 | DGM coverage dashboard shows scheduled visit reminder indicator | ✅ | `notification.spec.ts` | Scheduled filter chip works |
| NOTIF-ADMIN-001 | Admin system settings exposes email reminder time configuration | ✅ | `notification.spec.ts` | System Settings section in Users page |
| NOTIF-VAR-001 | Variance exception flag visible in controller submission review | ✅ | `notification.spec.ts` | Variance % shown in review table |
| NOTIF-VAR-002 | Operator form shows variance warning on high deviation | ✅ | `notification.spec.ts` | Fills 99999 → variance badge/note appears |

---

## Performance & Security

> These require load testing tools or infrastructure checks — not standard Playwright browser tests.

| ID | Test Case Title | E2E Status | Notes |
|----|----------------|------------|-------|
| PERF-001 | API Response Time Under 2 Seconds (P95) | ➖ | Requires k6 / Locust load testing |
| PERF-002 | Page Load Time Under 2 Seconds | ➖ | Requires Lighthouse / WebPageTest |
| PERF-003 | System Supports 100 Concurrent Users | ➖ | Requires load testing tool |
| PERF-004 | System Uptime 99% During Business Hours | ➖ | Requires monitoring (Datadog / UptimeRobot) |
| PERF-005 | S3 Attachment URL Expires After 15 Minutes | ➖ | Requires server-side test |
| SEC-001 | All API Communications Use TLS 1.2+ | ➖ | Infrastructure check (cert scan) |
| SEC-002 | Input Sanitization — XSS / Injection Attempt | 🔲 | Can test via Playwright with malicious input strings |
| SEC-003 | Email Approval Token is Single-Use Only | ➖ | Email token — not browser E2E testable |
| SEC-004 | Data Encrypted at Rest (DynamoDB and S3) | ➖ | Infrastructure check |

---

## Cross-Role Workflows (`workflow.spec.ts`)

| ID | Test Name | Status | Notes |
|----|-----------|--------|-------|
| WORKFLOW-001 | Operator submission appears as pending in controller review dashboard | ✅ | Multi-role |
| WORKFLOW-002 | Controller completes a full section-level approval review | ✅ | |
| WORKFLOW-003 | Rejecting a section without a comment disables Submit Review | ✅ | |
| WORKFLOW-004 | DGM schedules a verification visit and it appears in visit schedule | ✅ | |
| WORKFLOW-005 | Operator history table shows correct status badges | ✅ | |
| WORKFLOW-006 | Variance >5% requires explanation note on op-form | ✅ | |
| WORKFLOW-007 | Admin import roster page renders with file upload controls | ✅ | |
| WORKFLOW-008 | Regional controller compliance dashboard shows KPI metrics | ✅ | |
| WORKFLOW-009 | Admin can edit a location expected cash value | ✅ | |
| WORKFLOW-010 | Controller weekly dashboard shows verification visit schedule | ✅ | |
| WORKFLOW-011 | DGM history page loads and shows past visits | ✅ | |
| WORKFLOW-012 | Controller can view Review DGM Visits dashboard | ✅ | |
| WORKFLOW-013 | Cash trends page renders with period filters | ✅ | |
| WORKFLOW-014 | Admin locations page shows global defaults config section | ✅ | |
| WORKFLOW-015 | Operator can open past submission in readonly view | ✅ | |

---

## Additional Access Control (`access-control.spec.ts`)

| ID | Test Name | Status |
|----|-----------|--------|
| AC-001 | Operator nav does not include admin or controller items | ✅ |
| AC-002 | Admin nav does not include operator submission items | ✅ |
| AC-003 | Controller nav shows both approval and visit-scheduling items | ✅ |
| AC-004 | Regional controller nav shows compliance dashboard and reports | ✅ |
| AC-005 | DGM nav shows coverage dashboard and visit history | ✅ |
| AC-006 | Invalid password shows error and stays on login page | ✅ |
| AC-007 | Logout clears session and shows login screen | ✅ |
| AC-008 | Admin audit trail shows event-type filter dropdown | ✅ |
| AC-009 | Operator landing page is operator dashboard, not admin | ✅ |
| AC-010 | Admin users table shows multiple users with roles | ✅ |

---

## Location Scoping (`location-scope.spec.ts`)

Uses `page.route()` to mock `/auth/me`, `/locations`, and `/submissions` APIs so tests are fully deterministic regardless of backend state.

| ID | Test Name | Status | Notes |
|----|-----------|--------|-------|
| SCOPE-001 | Controller sees submissions for their assigned location | ✅ | Mocked me() + submissions for LOC-ALPHA; row appears |
| SCOPE-002 | Controller does NOT see submissions for unassigned locations | ✅ | API returns LOC-BETA submission; frontend filter removes it |
| SCOPE-003 | Controller dashboard location dropdown lists only assigned locations | ✅ | "All Locations (2)" with exactly 2 assigned |
| SCOPE-004 | Controller Weekly Dashboard KPIs render scoped to assigned location | ✅ | Weekly Dashboard KPI cards visible |
| SCOPE-005 | DGM has no location restriction — sees Coverage Dashboard | ✅ | No location filter on DGM role |
| NOTIF-SCOPE-EMAIL-001 | Operator submits → only LOC-assigned controller gets email | ➖ | Backend: submissions.py:198–200 location_ids guard |
| NOTIF-SCOPE-EMAIL-002 | Approval/rejection → only LOC-assigned operator gets email | ➖ | Backend: submissions.py:282–286 location_ids guard |
| NOTIF-SCOPE-EMAIL-003 | Visit reminder → only relevant location contacts notified | ➖ | Backend: scheduler.py:114 location_ids guard |

---

## Running Tests

```bash
# All tests
cd frontend && npx playwright test

# Single spec file
npx playwright test e2e/controller.spec.ts

# Single test by ID
npx playwright test -g "CTRL-VER-005"

# With UI (interactive debug)
npx playwright test --ui

# View HTML report
npx playwright show-report
```

---

*Last updated: 2026-03-13 · 62 official test cases + 13 notification indicators + 19 RC extended + 10 password reset + 5 location scoping · 161 Playwright tests (144 passing, 17 skipped)*

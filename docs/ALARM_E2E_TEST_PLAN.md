# Alarm Monitoring — Comprehensive E2E Test Plan

> Planning document for the end-to-end Playwright test suite covering the Alarm Monitoring & Testing system. Pick this up later to execute.

---

## 1. Stakeholders with Alarm Screens (3 primary)

All seeded with password `demo1234`. Verified present and active in `backend/cashroom.db`.

| Role | Email | Screens |
|---|---|---|
| `ALARM_ADMIN` | `alarmadmin@alarm.compass.com` | 6 admin screens: Building Setup, Zone Config, User Management, User Access, Compliance Rules, Audit Trail |
| `ALARM_TESTER` | `tester@alarm.compass.com` | 3 screens: Test Form, History, Upload |
| `ALARM_APPROVER` | `approver@alarm.compass.com` | 3 screens: Approval, Review, Escalation |

**Secondary consumers (read-only alarm dashboards, no write actions):** CONTROLLER, DGM, REGIONAL_CONTROLLER.

### Admin Screen Inventory

| # | Screen | File | Purpose |
|---|---|---|---|
| 1 | Building Setup | `frontend/src/pages/alarm/admin/AlarmBuildingSetup.tsx` | CRUD buildings (region, security company, tester/approver assignment, status) |
| 2 | Zone Config | `frontend/src/pages/alarm/admin/AlarmZoneConfig.tsx` | CRUD zones per building (type, area, active toggle) |
| 3 | User Management | `frontend/src/pages/alarm/admin/AlarmUserManagement.tsx` | CRUD alarm-scoped users |
| 4 | User Access | `frontend/src/pages/alarm/admin/AlarmUserAccess.tsx` | Grant/revoke building access (bulk CSV import) |
| 5 | Compliance Rules | `frontend/src/pages/alarm/admin/AlarmComplianceRules.tsx` | Monthly deadline, SLA, escalation tiers, biannual config |
| 6 | Audit Trail | `frontend/src/pages/alarm/admin/AlarmAuditTrail.tsx` | Immutable event log |

---

## 2. Expanded User Matrix (for this test plan)

### Pre-seeded (reuse)

| Email | Role | Used As |
|---|---|---|
| `alarmadmin@alarm.compass.com` | ALARM_ADMIN | Admin (setup + audit) |
| `tester@alarm.compass.com` | ALARM_TESTER | **Tester A** — Building A happy path |
| `approver@alarm.compass.com` | ALARM_APPROVER | **Approver 1** — shared for Building A + B |
| `rc@compass.com` | REGIONAL_CONTROLLER | Tier 3 escalation recipient |
| `dgm@compass.com` | DGM | Tier 3 biannual escalation recipient |

### Created by Admin during E2E (via User Management screen)

| Email | Role | Purpose / Scenario |
|---|---|---|
| `tester_b@alarm.compass.com` | ALARM_TESTER | **Tester B** — Building B rejection loop |
| `tester_c@alarm.compass.com` | ALARM_TESTER | **Tester C** — Scenario D (mid-cycle handoff) |
| `tester_unauth@alarm.compass.com` | ALARM_TESTER | RBAC negative (no building grants) |
| `approver_2@alarm.compass.com` | ALARM_APPROVER | Approver reassignment test |
| `approver_unauth@alarm.compass.com` | ALARM_APPROVER | RBAC negative |

---

## 3. Core Scenario — Two Buildings (user's original ask)

### Setup (by Admin)

1. Create **Building A** (region X, security company X) with **~10 zones** spread across areas and multiple zone types (ENTRY_EXIT, INTERIOR_MOTION, PANIC_SILENT, FIRE_SMOKE, HOLDUP, OTHER).
2. Create **Building B** (different region/security company) with **~10 zones** similarly.
3. Create Tester A, Tester B, one shared Approver 1.
4. Grant Tester A → Building A; Tester B → Building B. Grant Approver 1 → both buildings.
5. Configure Compliance Rules (monthly deadline day, approval SLA, Tier 1/2/3 offsets, biannual frequency, notification channels).

### Building A — Happy Path

- Tester A marks **all 10 zones = TESTED**.
- Tester A fills the **biannual check** (cellular + camera backup) with attachments.
- Tester A uploads the **security report**.
- Submits. Approver 1 **APPROVES**.
- Expected: APPROVED status, audit trail entries for every step, no escalation fired.

### Building B — Rejection Loop (6 cycles)

| Cycle | Tester B submits | Approver 1 action | Rejection reason |
|---|---|---|---|
| 1 | 5 TESTED, 3 NOT_TESTED, 2 ISSUE_FOUND, biannual empty, no report | REJECT | "Non-tested zones present" |
| 2 | 5 TESTED, 5 ISSUE_FOUND (each with reasoning — approver must see same reasoning) | REJECT | "Too many issues / remediation required" |
| 3 | 10 TESTED, biannual empty | REJECT | "Biannual check missing" |
| 4 | 10 TESTED + biannual filled, **no biannual docs** | REJECT | "Biannual documents not uploaded" |
| 5 | 10 TESTED + biannual filled + biannual docs, **no security report** | REJECT | "Security report not uploaded" |
| 6 | All docs + reports + biannual complete | **APPROVE** | — |

### Escalation (woven into Building B cycle)

- Admin configures Tier 1/2/3 days in Compliance Rules.
- Simulate time passing (invoke escalation job directly with mocked "today" dates — deterministic).
- Verify **monthly alarm** escalation tiers:
  - Tier 1 (7 days before deadline) → Tester only
  - Tier 2 (deadline day) → Tester + Approver
  - Tier 3 (3 days after) → Tester + Approver + Regional Controller
- Verify **biannual** escalation tiers:
  - Tier 1 (7 days overdue) → Tester + Approver
  - Tier 2 (14 days) → Tester + Approver + Regional Controller
  - Tier 3 (30 days) → Tester + Approver + RC + DGM
- Assert via MailCatcher SMTP intercept: recipients, subject, body content.

### Audit Log Assertions

Every create / update / submit / approve / reject / upload / escalation must produce an `AlarmAuditEvent` row and render in `AlarmAuditTrail.tsx`. Assert actor + action + timestamp per step.

---

## 4. Additional Scenarios (gaps to cover)

Covered by expanding the stakeholder set (additional testers/approvers — user-approved).

| ID | Scenario | Users |
|---|---|---|
| **A** | Building A happy path (10/10 tested + biannual + docs) | Admin, Tester A, Approver 1 |
| **B** | Building B rejection loop (6 cycles) | Admin, Tester B, Approver 1 |
| **C** | Issues-with-remediation happy path (8 TESTED + 2 ISSUE_FOUND with remediation plan + photo, approver approves) | Tester A, Approver 1 |
| **D** | Tester handoff mid-cycle (deactivate B → reassign to C → C sees existing draft, continues) | Admin, Tester B, Tester C |
| **E** | Approver reassignment mid-cycle (Admin swaps Approver 1 → Approver 2; Approver 2 sees pending test) | Admin, Approver 1, Approver 2 |
| **F** | RBAC negative — unauthorized access (unauth tester must NOT see buildings; direct API call returns 403) | Tester Unauth, Approver Unauth |
| **G** | Escalation — monthly Tier 1/2/3 emails | System job, Tester B, Approver 1, RC |
| **H** | Escalation — biannual Tier 1/2/3 emails | System job, Tester A/B, Approver 1, RC, DGM |
| **I** | Audit trail assertions at every step | Admin |
| **J** | Attachment validation (wrong file type, oversized, empty) | Tester A |
| **K** | Draft save + resume across sessions (4 zones saved, logout, login, data persists) | Tester A |
| **L** | Late submission — monthly deadline breach flag in audit | Tester B |
| **M** | Building status = exempt/closed — no escalation fires | Admin, Tester A |

### Extra guards worth asserting

- **Data isolation** — Tester B's rejection reason must not leak to Tester A's UI.
- **Zone edit while submitted** — Tester cannot edit after submit (only after reject).
- **Concurrent approver action** — approver opening an already-approved test sees stale-state warning.
- **Biannual cadence** — if biannual done last month, admin shouldn't require it again (cellular=6mo, camera=30d).
- **Escalation de-duplication** — Tier 1 fires once; Tier 2 doesn't re-send Tier 1.
- **Bulk access grant CSV import** — on User Access screen.

---

## 5. Locked-In Decisions

1. **Escalation mechanism** → invoke the job function directly with mocked "today" dates inside Playwright (deterministic, keeps suite under ~2 min). No system clock manipulation.
2. **Email assertions** → use `backend/mailcatcher.py` local SMTP to capture and assert recipients, subject, body content per tier.
3. **Excel structure** → single workbook, multiple sheets:
   - `Overview` — stakeholder matrix + scenario index
   - One sheet per scenario (`Scenario A – Happy`, `Scenario B – Rejection Loop`, … `Scenario M`)
   - `Escalation Emails` — expected subject/body/recipients per tier
   - `Audit Log Expectations` — expected audit events per scenario
   - `Summary` — pass/fail rollup after run
4. **Existing `Alarm_E2E_TestCases.xlsx` handling** → the current file is a smaller earlier run (20 TCs, 1 building, 6 zones, from 2026-04-09). Rename existing builder to `create_alarm_e2e_testcases_v1.py` for reference, then generate the expanded workbook.

---

## 6. Excel Row Schema

Each test-case row has these columns:

| Column | Content |
|---|---|
| `TC_ID` | e.g. `TC-ALM-A-01` |
| `Scenario` | A–M |
| `Stakeholder` | Admin / Tester A / Approver 1 / … |
| `Screen` | Building Setup / Test Form / Approval / Audit Trail / … |
| `Preconditions` | What must be true before the step |
| `Steps` | Numbered user actions |
| `Expected` | UI + DB + audit expectations |
| `Actual` | Filled post-run |
| `Status` | Pass / Fail / Skipped (filled post-run) |
| `Evidence` | Screenshot path + Playwright trace link (filled post-run) |
| `Notes` | Freeform |

---

## 7. Deliverable Plan (3 steps)

### Step 1 — Excel scaffold (~90 test cases)
- Generate `Alarm_E2E_TestCases.xlsx` with all 13 scenario sheets + overview + escalation emails sheet.
- Share for review before writing any Playwright code.

### Step 2 — Playwright spec
- File: `frontend/e2e/alarm-comprehensive.spec.ts` (serial mode).
- Pre-flight seed script: reset DB, seed base users, ensure MailCatcher running.
- Use `playwright.config.ts` (already present — `2378dab chore: Playwright config for running specs against already-up dev servers`).
- Helpers for common flows (login, navigate to panel, upload file, assert audit event).

### Step 3 — Populate results
- After suite runs, parse Playwright JSON reporter output.
- Fill `Actual`, `Status`, `Evidence` columns per TC.
- Regenerate `Summary` sheet rollup.
- Commit the filled workbook for manual review.

---

## 8. Open Questions / Assumptions to Confirm Before Step 1

1. ~~Same approver for both buildings~~ — **confirmed**: Approver 1 covers A + B.
2. **Biannual docs upload slot** — is there a separate upload slot for biannual evidence vs. the monthly security report? To verify against `AlarmUpload.tsx` / `AlarmTestAttachment` when coding.
3. **Expected email content in Excel** — include subject + body snippet per tier (recommended yes, for manual verification).
4. **Zone count per building** — user said "roughly 10"; going with exactly 10 per building for parity.

---

## 9. File Paths Reference

**Frontend screens:** `frontend/src/pages/alarm/{admin,tester,approver,management}/`
**Backend routers:** `backend/app/api/v1/alarm_*.py`
**Escalation router:** `backend/app/api/v1/alarm_escalation.py`
**Email template:** `backend/app/templates/email/alarm_escalation.html`
**Models:** `backend/app/models/alarm_*.py`
**Seed:** `backend/seed.py` (DEMO_PASSWORD = "demo1234")
**Existing E2E specs:** `frontend/e2e/alarm-full-workflow.spec.ts`, `frontend/e2e/alarm-history.spec.ts`
**Playwright config:** `frontend/playwright.config.ts`
**MailCatcher:** `backend/mailcatcher.py`

---

_Saved 2026-04-17. Pick up at Step 1 when ready to execute._

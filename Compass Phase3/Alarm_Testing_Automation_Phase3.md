# Compass Phase 3 — Alarm Testing Compliance Module

**Version:** 1.1
**Date:** 2026-03-30
**Status:** Requirements Discovery

---

## 1. Project Overview

### What Is This Project?

Compass Group (client) operates **hundreds of food-service facilities** (Canteen Vending locations, cafeterias, etc.) across the United States. Every building has a **security alarm system** managed by a third-party monitoring company (e.g., AES — Allied Emergency Signals). These alarm systems include:

- **Entry/Exit zones** — doors (main entry, employee doors, overhead doors, vehicle storage doors)
- **Interior motion zones** — hallway motion detectors, office motion sensors
- **Panic buttons / Hold-ups** — silent alarm buttons in coolers, freezers, secure offices, front offices
- **Secure area zones** — restricted rooms with their own alarm areas

Each building's alarm system is divided into **zones** (e.g., Zone 3 = Main Entry Door, Zone 21 = Cooler Panic Alarm). A single building can have 15–25+ zones across multiple areas.

### What Happens Today (Current Process)

Every month, each building must complete a **full alarm test** to verify that every zone, hold-up, and panic button is functioning correctly. Here is the current manual workflow:

1. **Schedule the test** — An on-site manager (DGM, Controller, or Safety Manager) decides to run the monthly test.
2. **Call the security company** — They phone the alarm monitoring company (e.g., AES at 920-735-6132) to put the system into "Test Mode" so the security company knows not to dispatch police/fire.
3. **Walk the building** — The tester physically walks through the building triggering every zone: opening doors, walking past motion sensors, pressing panic buttons. This takes ~15–20 minutes per building.
4. **Security company logs everything** — The monitoring company records every alarm signal in a **Customer Activity Report** (PDF). Each entry shows: timestamp, zone number, zone name, alarm type (burglar, panic, silent), and whether the alarm triggered AND restored properly.
5. **End the test** — Tester calls back to take the system off test mode.
6. **Request the report** — Tester calls or emails the security company to get the PDF report emailed to them.
7. **Save to Teams** — Tester saves the PDF report to a shared Microsoft Teams folder for their area.
8. **Update the Excel tracker** — Tester opens the shared "Alarm Test Flash 2026" spreadsheet on Teams and marks their building as complete for that month.
9. **Management reviews (maybe)** — Regional managers and Division Safety Managers periodically check the Excel file to see which buildings have completed testing. There is no automated alerting for overdue buildings.
10. **Biannual items** — Separately, each building must verify **cellular backup** (every 6 months) and **minimum 30-day camera storage backup**. These are tracked ad-hoc and frequently fall through the cracks, resulting in compliance findings during audits.

### What's Wrong With This Process?

| Problem | Impact |
|---|---|
| **No visibility for leadership** | Regional/Division heads must manually open an Excel file to check status — no dashboards, no alerts |
| **No zone-level verification** | Even if a tester marks "complete," nobody systematically checks if *every* zone was actually tested |
| **Reports scattered across Teams** | Each area saves PDFs in different Teams folders — no central repository |
| **No automated reminders** | If a building misses their monthly test, nobody is automatically notified |
| **Biannual items forgotten** | Cellular backup and camera backup checks slip through — discovered only during audits |
| **No approval workflow** | A tester self-certifies completion — no independent review by Safety Manager |
| **Manual, error-prone tracking** | Excel file can have wrong data, missed updates, version conflicts |

### What We Want to Build (Phase 3)

An **Alarm Testing Compliance Module** inside the existing Compass web application that:

1. **Digitizes the entire workflow** — from test initiation to zone-by-zone logging to report upload to approval
2. **Brings transparency to leadership** — real-time dashboards showing compliance status across all buildings by region/division with traffic-light indicators
3. **Automates compliance checks** — system knows every zone per building and flags if any zone was not tested
4. **Enforces approval workflow** — Division Safety Managers review and approve/reject each monthly test
5. **Sends automated notifications** — reminders before deadlines, escalations for overdue buildings
6. **Tracks biannual items** — cellular backup tests and camera backup verification with due dates and alerts
7. **Centralizes all reports** — uploaded alarm test PDFs stored in one place, accessible by role

### Sample Alarm Test Report (What We're Working With)

The PDF from the Wausau, WI building (Canteen Vending, Customer ID: AES9925) shows a typical test from 02/09/2026:

```
Time      Zone  Name                        Type              Result
──────────────────────────────────────────────────────────────────────
10:59:40  3     Main Entry Door             ENTRY/EXIT        Alarm + Restore
11:00:22  14    Motion South End Hallway    INTERIOR          Alarm + Restore
11:00:22  15    Motion North End Hallway    INTERIOR          Alarm + Restore
11:00:40  24    Main Office Motion          INTERIOR          Alarm + Restore
11:00:40  21    Cooler Panic Alarm          SILENT/PANIC      Alarm + Restore
11:01:03  9     South Vehicle OH Door       ENTRY/EXIT        Alarm + Restore
11:01:23  20    Freezer Panic Alarm         SILENT/PANIC      Alarm + Restore
11:01:23  17    Cooler Door Motion          ENTRY/EXIT        Alarm + Restore
11:01:54  19    Secure Office Panic         SILENT/PANIC      Alarm + Restore (Area 2)
11:02:04  13    South OHD                   ENTRY/EXIT        Alarm + Restore
11:02:04  6     East Employee Door          ENTRY/EXIT        Alarm + Restore
11:02:08  12    East OH Door South          ENTRY/EXIT        Alarm + Restore
11:02:58  10    East OH Door North          ENTRY/EXIT        Alarm + Restore
11:02:58  11    East OH Door Central        ENTRY/EXIT        Alarm + Restore
11:03:17  5     North Door Vehicle Storage  ENTRY/EXIT        Alarm + Restore
11:03:20  7     North OHD                   ENTRY/EXIT        Alarm + Restore
11:03:38  8     Secure Office Door          ENTRY/EXIT        Alarm + Restore (Area 2)
11:04:23  18    Panic Button Front Office 1 SILENT/PANIC      Alarm + Restore
```

**Key observations:**
- Each zone must show both an **alarm trigger** AND an **alarm restore** (confirms the zone resets properly)
- The test covers all types: entry/exit doors, interior motion, panic buttons
- The building has zones across **2 areas** (Area 1 and Area 2)
- Total test duration: ~7 minutes for 18 zones
- The tester (Terri Serrano) called the security company before and after the test

### Users of the System

| User Role | Who They Are | What They Do |
|---|---|---|
| **Tester** | DGM, Controller, Safety Manager (on-site) | Conduct monthly tests, log results zone-by-zone, upload alarm company reports |
| **Management** | Regional Controller, Divisional leadership | View dashboards, review compliance status across their area, drill into building details |
| **Approver / Admin** | Division Safety Manager | Review submitted tests, approve/reject, add/remove/update zones and building config |

---

## 2. Background & Problem Statement

Compass Group buildings are required to complete **monthly alarm tests** covering every security zone, hold-up, and panic button. Currently this process is:

- **Manual**: On-site managers (DGM, Controller, Safety Mgr) physically trigger each zone, call the security company to put the system "on test," then save PDF/Excel reports to Teams.
- **Tracked in Excel**: A shared "Alarm Test Flash" spreadsheet on Teams is updated monthly per building.
- **No real-time visibility**: Leadership has no dashboard or automated way to see which buildings are compliant, overdue, or have untested zones.
- **Biannual items slip through**: Cellular backup tests and 30-day camera backup verification are tracked ad-hoc with frequent compliance findings.

**Goal**: Build an Alarm Testing Compliance module inside the existing Compass application (Phase 3) that brings **transparency to leadership**, automates compliance tracking, and eliminates the manual Excel/Teams workflow.

---

## 2. How It Fits Into the Existing Compass App

The current Compass app (CashRoom Compliance System) is a **role-based SPA** with state-based navigation. The alarm testing module extends the existing role hierarchy with new panels/screens.

### Existing Architecture (for reference)

```
App.tsx → AuthState → AppShell → NavCtx → renderPanel() switch
```

- **No React Router** — all navigation is panel-based via `onNavigate(panel, ctx)`
- **Backend**: FastAPI + SQLAlchemy (SQLite dev / PostgreSQL prod)
- **Roles**: Operator, Controller, DGM, Regional Controller, Admin, Auditor

### Where Alarm Testing Slots In

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EXISTING SCREENS (Phase 1 & 2)                  │
│                                                                     │
│  Operator       Controller      DGM         RC          Admin       │
│  ─────────     ──────────     ───────     ────────    ─────────     │
│  OpStart       CtrlDash       DGMDash     RcTrends    AdmLocations  │
│  OpForm        CtrlLog        DGMLog                  AdmUsers      │
│  OpExcel       CtrlHist       DGMHist                 AdmCompliance │
│  ...           DailyRpt                               AdmReports    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     NEW SCREENS (Phase 3 — Alarm Testing)           │
│                                                                     │
│  Tester (*)    Approver (**)   Management    Admin                  │
│  ───────────   ──────────────  ──────────    ──────────────────     │
│  AlarmTestForm AlarmApproval   AlarmOverview  AlarmZoneConfig       │
│  AlarmUpload   AlarmReview     AlarmTrends    AlarmBuildingSetup    │
│  AlarmHistory  AlarmEscalation AlarmDrillDown AlarmComplianceRules  │
│  BiannualCheck                 BiannualStatus AlarmUserAccess       │
│                                                                     │
│  (*) Tester = DGM / Controller / Safety Mgr (on-site)              │
│  (**) Approver = Division Safety Mgr                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. User Roles & Mapping to Existing Roles

| Alarm Role | Maps To (Existing) | Capabilities |
|---|---|---|
| **Tester** | Operator / Controller / DGM | Conduct monthly tests, upload alarm reports, log zone-by-zone results, complete biannual checks |
| **Approver / Admin** | New: Division Safety Mgr (or Admin) | Add/remove zones per building, approve monthly tests as compliant, manage compliance rules |
| **Management** | Regional Controller / DGM | View-only dashboard for their region, drill into building-level detail, see trends |
| **Super Admin** | Admin | Full CRUD on buildings, zones, users, compliance config |

> **Key Decision**: Do we create a new "Safety Manager" role, or extend existing DGM/Controller roles with an `alarm_tester` permission flag (similar to existing `access_grants`)?

---

## 4. Screen-by-Screen Breakdown

### 4.1 Tester Screens (DGM / Controller / Safety Mgr)

#### `alarm-test-form`
- Select building (from assigned locations)
- System shows **all configured zones** for that building (pre-populated by admin)
- Tester marks each zone as: Tested / Not Tested / Issue Found
- Fields: date tested, tester name (auto-filled), notes per zone
- Upload alarm report (PDF from security company)
- Submit for approval

#### `alarm-upload`
- Drag-and-drop or file picker for alarm company PDF/Excel reports
- **Future enhancement**: Auto-parse the PDF to extract zone data and cross-reference against configured zones (flag any missed zones automatically)

#### `alarm-history`
- View past submissions for assigned buildings
- Filter by month, building, status (Pending / Approved / Rejected)
- Download attached reports

#### `biannual-check`
- Form for cellular backup test (due every 6 months)
- Camera backup verification (confirm minimum 30-day retention)
- Attach evidence/documentation

### 4.2 Approver Screens (Division Safety Mgr)

#### `alarm-approval`
- Queue of pending alarm test submissions for their division
- View submitted zone checklist vs. configured zones
- View uploaded alarm report (inline PDF viewer)
- **Compliance check**: System highlights if any configured zones are missing from the submission
- Actions: Approve / Reject (with reason)

#### `alarm-review`
- Deep-dive view of a single submission
- Side-by-side: configured zones (left) vs. tested zones from submission (right)
- Flag discrepancies

#### `alarm-escalation`
- List of buildings that are **overdue** for the current month
- One-click to send reminder notification to assigned tester

### 4.3 Management Screens (Regional Controller / DGM)

#### `alarm-overview`
- Dashboard showing compliance status across all buildings in their region
- Traffic-light view: Green (tested & approved), Yellow (submitted, pending approval), Red (overdue / not submitted)
- Current month + rolling 12-month summary
- Biannual compliance status row

#### `alarm-trends`
- Monthly compliance % over time (line chart)
- Buildings with recurring issues
- Average time from test to approval

#### `alarm-drilldown`
- Click a building from overview to see full detail
- Zone-level results, attached reports, approval history

#### `biannual-status`
- Table of all buildings showing last cellular backup test date and next due date
- Camera backup compliance status
- Red flag for any building past due

### 4.4 Admin Screens

#### `alarm-zone-config`
- Per-building zone management (CRUD)
- Zone fields: zone number, name, type (Entry/Exit, Interior, Panic, Hold-Up), area
- Import zones from a CSV/template
- Flexible — admin can add/remove zones as buildings change

#### `alarm-building-setup`
- Assign buildings to testers and approvers
- Set security company info per building
- Configure test frequency (monthly default, customizable)

#### `alarm-compliance-rules`
- Define what constitutes a "compliant" test (e.g., all zones tested, report uploaded, approved by deadline)
- Set monthly deadline (e.g., by the 15th of each month)
- Configure escalation rules (auto-notify at 7 days before deadline, on deadline, 3 days past)

#### `alarm-user-access`
- Manage which users can test/approve for which buildings
- Leverages existing `access_grants` pattern from Phase 1

---

## 5. Data Model (New Tables)

```
buildings (extends existing locations table or new)
├── id
├── location_id (FK → locations)
├── security_company_name
├── security_customer_id (e.g., "AES9925")
└── security_company_phone

alarm_zones
├── id
├── building_id (FK → buildings)
├── zone_number
├── zone_name (e.g., "Main Entry Door")
├── zone_type (ENTRY_EXIT | INTERIOR | PANIC | HOLDUP)
├── area_number
├── is_active
├── created_by / updated_by
└── created_at / updated_at

alarm_tests (monthly test header)
├── id
├── building_id (FK → buildings)
├── test_date
├── test_month (YYYY-MM, for easy querying)
├── tester_id (FK → users)
├── status (DRAFT | SUBMITTED | APPROVED | REJECTED)
├── submitted_at
├── approved_by (FK → users, nullable)
├── approved_at
├── rejection_reason
├── notes
└── created_at / updated_at

alarm_test_zones (zone-level results per test)
├── id
├── alarm_test_id (FK → alarm_tests)
├── alarm_zone_id (FK → alarm_zones)
├── result (TESTED | NOT_TESTED | ISSUE_FOUND)
├── alarm_triggered_at (timestamp from report, nullable)
├── alarm_restored_at (timestamp from report, nullable)
└── notes

alarm_test_attachments
├── id
├── alarm_test_id (FK → alarm_tests)
├── file_name
├── file_path (S3 key or local path)
├── file_type (PDF | EXCEL | IMAGE)
└── uploaded_at

biannual_checks
├── id
├── building_id (FK → buildings)
├── check_type (CELLULAR_BACKUP | CAMERA_BACKUP)
├── check_date
├── next_due_date
├── checked_by (FK → users)
├── status (COMPLIANT | NON_COMPLIANT | PENDING)
├── evidence_path
├── notes
└── created_at
```

---

## 6. API Endpoints (New Routes)

```
POST   /api/v1/alarm/zones                    # Admin: create zone
GET    /api/v1/alarm/zones?building_id=        # List zones for building
PUT    /api/v1/alarm/zones/{id}                # Admin: update zone
DELETE /api/v1/alarm/zones/{id}                # Admin: deactivate zone

POST   /api/v1/alarm/tests                     # Tester: create/submit test
GET    /api/v1/alarm/tests?building_id=&month=  # List tests (filtered)
GET    /api/v1/alarm/tests/{id}                 # Get test detail + zones
PUT    /api/v1/alarm/tests/{id}                 # Update draft
POST   /api/v1/alarm/tests/{id}/submit          # Submit for approval
POST   /api/v1/alarm/tests/{id}/approve         # Approver: approve
POST   /api/v1/alarm/tests/{id}/reject          # Approver: reject

POST   /api/v1/alarm/tests/{id}/attachments     # Upload report file
GET    /api/v1/alarm/tests/{id}/attachments      # List attachments
GET    /api/v1/alarm/attachments/{id}/download   # Download file

GET    /api/v1/alarm/compliance/overview         # Dashboard data
GET    /api/v1/alarm/compliance/trends           # Historical trends
GET    /api/v1/alarm/compliance/overdue          # Overdue buildings

POST   /api/v1/alarm/biannual                    # Submit biannual check
GET    /api/v1/alarm/biannual?building_id=       # List biannual checks
GET    /api/v1/alarm/biannual/status             # All buildings due/overdue
```

---

## 7. Automation & Notifications

| Trigger | Action | Recipient |
|---|---|---|
| Monthly deadline approaching (7 days) | Email reminder | Assigned tester |
| Monthly deadline reached, no submission | Escalation email | Tester + Approver |
| 3 days past deadline | Critical alert | Regional Controller + Division Safety Mgr |
| Test submitted | Notification to approve | Division Safety Mgr |
| Test approved/rejected | Status notification | Tester |
| Biannual check due in 30 days | Reminder | Tester + Approver |
| Biannual check overdue | Escalation | Regional Controller |

> Leverages existing **APScheduler + fastapi-mail** infrastructure from Phase 1/2.

---

## 8. PDF Report Parsing (Future Enhancement)

The alarm company (e.g., AES) generates Customer Activity Reports like the Wausau sample. These contain structured data:

```
Zone 3  → Main Entry Door       → ENTRY/EXIT BURGLAR (BA4) + Restore
Zone 14 → Motion South Hallway  → INTERIOR BURGLAR (BA2) + Restore
Zone 21 → Cooler Panic Alarm    → Silent (PA2) + Restore
...
```

**Phase 3a (MVP)**: Manual zone-by-zone checklist + PDF upload
**Phase 3b (Enhancement)**: Parse uploaded PDFs to auto-extract tested zones and cross-match against configured zones, auto-flagging gaps.

---

## 9. Questions to Confirm with Client

### A. Building & Zone Setup

**Q1. How many buildings are in scope?**
We need the total count to plan for data model scale, dashboard performance, and initial setup effort. Is it 50? 200? 500+?

**Q2. Is there an existing master list of buildings with their zone details?**
Do you have a spreadsheet or document listing every building along with its zones (zone number, zone name, type)? If so, we can use it to pre-populate the system. If not, who will enter the zone data — admin or each site manager?

**Q3. Do all buildings use the same security monitoring company (AES), or are there multiple vendors?**
The Wausau sample uses AES. If different buildings use different vendors (ADT, SimpliSafe, Brinks, etc.), the report formats will differ, which impacts how we handle report uploads and any future auto-parsing.

**Q4. How often do zones change within a building?**
Do zones get added/removed frequently (e.g., when a building renovates or adds a door), or is the zone layout mostly static? This determines how flexible the admin zone management needs to be.

**Q5. Are there buildings with unique zone types beyond the standard ones (Entry/Exit, Interior Motion, Panic, Hold-Up)?**
The Wausau sample shows Entry/Exit Burglar, Interior Burglar, Silent Panic, and Hold-Up. Are there any other zone types across other buildings we need to account for?

### B. Testing Process & Compliance

**Q6. What defines a "compliant" monthly test?**
Is it: (a) every single zone must be tested, (b) a minimum percentage threshold, or (c) all zones tested + report uploaded + approved by Safety Mgr? What about a zone that is temporarily out of service — can it be excluded?

**Q7. What is the monthly submission deadline?**
By which day of the month must the test be completed and submitted? (e.g., by the 15th, by the last business day). Is this the same for all buildings or does it vary?

**Q8. What happens if a zone fails during testing (triggers but doesn't restore, or doesn't trigger at all)?**
Is there a remediation workflow? Does the tester log a maintenance ticket? Should the system track open issues per zone until they are resolved and re-tested?

**Q9. Can a building be tested in multiple sessions, or must all zones be tested in a single visit?**
For larger buildings, does the tester sometimes test half the zones one day and the rest another day? Should the system allow partial saves / drafts?

**Q10. Is the phone call to put the system "on test" something we should track, or does it remain outside the system?**
Currently testers call the security company before and after. Should we log the test window (start/end time) in the system, or is that out of scope?

### C. Users, Roles & Approval Workflow

**Q11. Should we create a new "Division Safety Manager" role, or extend existing roles (DGM/Controller) with an alarm approval permission?**
The existing Compass app uses `access_grants` to give cross-role permissions. We could follow the same pattern, or introduce a dedicated Safety Manager role if these users don't overlap with existing roles.

**Q12. Can a tester self-certify, or must every test be approved by a Division Safety Manager?**
Is the approval step mandatory for compliance, or is it a "spot check" where only a percentage of tests are reviewed? If mandatory, what is the SLA for approval (e.g., 3 days after submission)?

**Q13. What is the organizational hierarchy for approvers?**
Which Division Safety Manager covers which buildings/regions? Is this the same as the existing Controller/DGM assignment in Compass, or is it a separate hierarchy?

**Q14. How many testers per building? Is it always one person, or can multiple people share the responsibility?**
If a DGM is on vacation, can a Controller submit the test instead? Should the system allow any authorized user at that location to submit?

### D. Reporting, Dashboards & Transparency

**Q15. What specific dashboards does senior leadership need?**
Examples: (a) traffic-light map of all buildings by region, (b) monthly compliance percentage trend, (c) list of overdue buildings, (d) buildings with recurring zone failures. Which of these are most critical?

**Q16. Do they want real-time visibility or is a daily/weekly summary sufficient?**
Should the dashboard update the moment a test is submitted/approved, or is a nightly refresh acceptable?

**Q17. Should the system send automated alerts for non-compliance?**
For example: (a) 7 days before deadline — reminder to tester, (b) on deadline day if not submitted — escalation to Safety Mgr, (c) 3 days past deadline — alert to Regional Controller. What are the preferred escalation tiers and timings?

**Q18. Do they need the ability to export compliance reports (e.g., PDF/Excel summary for auditors or regulators)?**
If there are external audits, what format do they need the compliance data in?

### E. Biannual Items

**Q19. For the cellular backup test — what does "pass" look like?**
What evidence is required? Is it a report from the security company, a screenshot, or a manual attestation? How is this test currently performed?

**Q20. For the 30-day camera backup requirement — how is this currently verified?**
Is there a camera system (NVR/DVR) that has an API or dashboard we can check, or is it a manual process where someone checks the system and attests? What evidence do they save today?

**Q21. What are the specific "findings regarding security" from biannual reviews that they want to track?**
The notes mention "many findings regarding security." Are these specific audit items beyond cellular and camera backup? Examples: fire panel inspection, access control review, key management audit?

### F. Integration & Technical

**Q22. Can the security monitoring company (AES or others) provide alarm test reports in a machine-readable format (CSV, Excel, API)?**
If they can, we could auto-import reports and automatically verify zone coverage. If not, PDF upload with manual checklist is the MVP approach.

**Q23. Should this module live inside the existing Compass app (same deployment, same login) or as a separate application?**
Our recommendation is to integrate into the existing app to leverage the role system, authentication, and notification infrastructure already built.

**Q24. Should we integrate with Microsoft Teams (where reports are currently stored) or fully replace that workflow?**
Options: (a) replace Teams entirely — all reports live in Compass, (b) hybrid — Compass sends a notification/link to Teams when a test is submitted, (c) pull existing reports from Teams as historical data.

**Q25. Do they want historical data migrated from the current "Alarm Test Flash 2026" Excel tracker?**
If so, how far back? Just 2026, or previous years too? Is the Excel data reliable enough to import, or should we start fresh?

### G. Future Scope & Edge Cases

**Q26. Should the system support multiple tests per building per month (e.g., re-test after a failure)?**
If a test is rejected by the approver, does the tester re-submit a new test, or edit the existing one?

**Q27. Is there a need for mobile-friendly access?**
Testers are walking through buildings during the test. Would they benefit from a mobile form to log results in real-time, or do they always complete the form back at their desk?

**Q28. Are there any buildings with shared alarm systems (multiple Compass locations on one alarm panel)?**
This would affect how zones are mapped to buildings in the data model.

**Q29. What happens during building renovations or temporary closures?**
Should there be a way to mark a building as "exempt" or "temporarily inactive" for alarm testing so it doesn't show as non-compliant on dashboards?

**Q30. Who is the primary point of contact for ongoing zone updates?**
As buildings change (new doors, removed sensors), who is responsible for updating the zone list in the system — the on-site manager, Division Safety Mgr, or a central admin?

---

## 10. Our Recommended Answers & Assumptions

Below are our recommended defaults for each question based on the documents provided, the Wausau sample report, and our experience building the Compass CashRoom module. These serve as **starting assumptions** — the client call should confirm or override each one.

### A. Building & Zone Setup

| # | Question | Our Recommendation | Reasoning |
|---|---|---|---|
| Q1 | How many buildings? | **Design for 200–500 buildings**, but start rollout with one region as pilot (10–20 buildings). | The Excel tracker ("Alarm Test Flash 2026") suggests a company-wide program. Building for scale upfront is cheap; retrofitting is expensive. A pilot lets us validate the workflow before mass rollout. |
| Q2 | Master list of zones? | **Ask the client to provide an initial CSV export** from their security company contracts. If unavailable, build a CSV import template so Division Safety Mgrs can bulk-upload zones per building. Admin can then fine-tune. | The Wausau building has 18+ zones with clear numbering. This data likely exists in security company records. Manually entering 18 zones x 200 buildings = 3,600 entries is not viable without bulk import. |
| Q3 | Same security vendor? | **Assume multiple vendors** but design the system vendor-agnostic. Store vendor name/ID per building but don't tie any logic to a specific vendor format. For MVP, reports are uploaded as-is (PDF/Excel). | Large enterprises rarely use a single vendor nationwide. The system should accept any file format as an attachment and not depend on parsing a specific vendor's report layout in Phase 3a. |
| Q4 | How often do zones change? | **Assume zones are mostly static** (change a few times per year). Provide admin CRUD for zones but don't over-engineer real-time sync. Add an "effective date" field so we track when zones were added/removed. | Zones change when buildings renovate (new doors, removed sensors). This is infrequent. The key is that historical tests reference the zones as they existed at the time, not the current zone list. |
| Q5 | Unique zone types? | **Start with 5 types: Entry/Exit, Interior Motion, Panic/Silent, Hold-Up, Fire/Smoke.** Add an "Other" type with free-text description as a catch-all. Allow admin to add new types if needed. | The Wausau sample covers 4 types. Fire/Smoke is a common alarm type we should anticipate. An "Other" catch-all prevents the system from blocking unusual zone types at edge-case buildings. |

### B. Testing Process & Compliance

| # | Question | Our Recommendation | Reasoning |
|---|---|---|---|
| Q6 | What is "compliant"? | **All active zones must be tested + alarm report uploaded + approved by Safety Mgr.** If a zone is out of service, it should be marked as "Exempt" with a reason (admin-only action), so it doesn't count against compliance. | The notes say "testing every zone, hold up, panic button." This implies 100% coverage is the expectation. The exemption mechanism handles real-world scenarios (broken sensor awaiting repair) without letting buildings cheat compliance. |
| Q7 | Monthly deadline? | **Default: last business day of the month.** Make this configurable at the system level (admin setting) so it can be changed without code deployment. | The Excel tracker is organized by month. Setting the deadline at month-end gives testers the full month. Making it configurable lets the client tighten it later (e.g., 15th of the month) without a code change. |
| Q8 | Zone failure workflow? | **Track it in the system.** If a zone is marked "Issue Found," require a notes field and auto-create a follow-up item. The zone stays flagged until a subsequent test shows it passing. Dashboard shows buildings with open issues. | This is where the system adds real value over Excel. Currently, if a panic button is broken, it might not get fixed for months because nobody tracks it. A persistent "open issue" flag with visibility to Safety Mgr and RC creates accountability. |
| Q9 | Multiple sessions? | **Yes — allow draft/partial saves.** A test starts in "Draft" status. Tester can save progress and return later. Only when all zones are marked (Tested / Not Tested / Issue Found) can they submit for approval. | Larger buildings may need more than one visit. Forcing a single-session completion would lead to testers rushing or fabricating results. Drafts also protect against browser crashes or interruptions mid-test. |
| Q10 | Track the phone call? | **Yes — capture test window (start time, end time) as optional fields.** Don't make it mandatory, but encourage it. This data becomes useful for auditing (does the test window match the alarm report timestamps?). | The Wausau PDF shows "Temp On Test - 10:57 to 12:02." If we capture this, we can cross-reference: did the alarm report fall within the declared test window? This adds a layer of verification without burdening the tester. |

### C. Users, Roles & Approval Workflow

| # | Question | Our Recommendation | Reasoning |
|---|---|---|---|
| Q11 | New role or extend existing? | **Extend existing roles using `access_grants`** — add a new grant type `alarm_tester` and `alarm_approver`. Division Safety Mgrs get the `alarm_approver` grant. DGM/Controller/Safety Mgr get `alarm_tester`. | This follows the established pattern from Phase 1/2 and avoids fragmenting the role model. The client's notes say testers are "DGM, Controller, Safety Mgr" — these already exist in the system. Adding a grant is simpler than a new role. |
| Q12 | Self-certify or mandatory approval? | **Mandatory approval by Division Safety Mgr for every test.** This is the whole point of the "transparency to leadership" requirement. Set an approval SLA of 5 business days — if not reviewed, auto-escalate to RC. | The current process has no approval gate, which is exactly why compliance gaps go unnoticed. Making it mandatory forces Safety Mgrs to actually review the results. The auto-escalation prevents approvers from being the new bottleneck. |
| Q13 | Approver hierarchy? | **Ask the client to provide a mapping of Safety Mgr → buildings/regions.** In the system, model this as an assignment table (similar to how Controllers are assigned to locations in Phase 1). One Safety Mgr per building, but a Safety Mgr covers many buildings. | This is data we cannot assume — it must come from the client. The data model is straightforward (many-to-one), but the actual mapping is an organizational decision. |
| Q14 | Multiple testers per building? | **Allow multiple authorized testers per building.** Any user with `alarm_tester` grant for that location can submit a test. Only one test per building per month can be in "Submitted" or "Approved" status. | People take vacations, get reassigned, or leave. Tying a building to a single tester creates a single point of failure. The Wausau example shows "Terri Serrano" as the tester — but if Terri is out, someone else should be able to step in. |

### D. Reporting, Dashboards & Transparency

| # | Question | Our Recommendation | Reasoning |
|---|---|---|---|
| Q15 | Dashboard priorities? | **Priority 1: Traffic-light overview** (Red/Yellow/Green per building, filterable by region/division). **Priority 2: Overdue buildings list** (sorted by days overdue). **Priority 3: Monthly trend chart.** Zone-failure drill-down is Priority 4. | Leadership's immediate need is "which buildings are compliant right now?" The traffic-light view answers this at a glance. The overdue list is the actionable follow-up. Trends are valuable but secondary — you need a few months of data before trends are meaningful. |
| Q16 | Real-time or batch? | **Real-time.** Dashboard queries the live database — no nightly batch. This is technically simple (we already do this for CashRoom compliance dashboards) and matches the "transparency" requirement. | The existing Compass app already serves real-time dashboards for CashRoom. There's no technical reason to introduce batch processing. Leadership wants to see updates the moment a test is submitted or approved. |
| Q17 | Automated alerts? | **Yes — implement a 3-tier escalation.** Tier 1: Email reminder 7 days before deadline → Tester. Tier 2: Deadline day, no submission → Tester + Safety Mgr. Tier 3: 3 days past deadline → RC + Safety Mgr + DGM. All configurable by admin. | Automated reminders are the single biggest improvement over the current process. Today, nobody gets reminded — they just hope people check the Excel. The 3-tier model matches common compliance escalation patterns and is already proven in our CashRoom reminder system. |
| Q18 | Export for auditors? | **Yes — build a compliance summary export (Excel + PDF).** Columns: Building, Region, Month, Test Date, Tester, Zones Tested/Total, Approval Status, Approver, Biannual Status. Filterable by date range and region. | Compliance programs always get audited. If we don't build export, someone will screenshot the dashboard. A proper export is low-effort (we already have export infrastructure) and makes audits painless. |

### E. Biannual Items

| # | Question | Our Recommendation | Reasoning |
|---|---|---|---|
| Q19 | Cellular backup — what is "pass"? | **Assume it's a test where the primary communication line is disconnected and the system successfully communicates via cellular backup.** Evidence: a report from the security company confirming cellular signal was received. Store as file upload + pass/fail attestation. | This is a standard industry test. The security company monitors whether the signal came through cellular. We don't need to automate the test itself — just track that it happened, when, and store the evidence. Ask the client to confirm the exact process. |
| Q20 | Camera backup verification? | **Build as a manual attestation with evidence upload.** Tester logs into the camera system, verifies recordings go back 30+ days, takes a screenshot, and uploads it. The system stores the attestation date and calculates next due date (30 days later or per policy). | Camera systems vary wildly (Axis, Hikvision, Milestone, etc.). API integration is not feasible for MVP. A simple "I verified 30-day retention on [date], here's my screenshot" is sufficient and matches how it's likely done today (if at all). |
| Q21 | Other biannual findings? | **Build the biannual module with configurable check types.** Start with Cellular Backup and Camera Backup. Allow admin to add new check types (e.g., "Fire Panel Inspection," "Access Control Audit," "Key Management Review") without code changes. | The notes say "many findings regarding security" but don't list specifics. A configurable check-type system means we don't need to know every item upfront. When the client identifies additional items during the call, we simply say "admin can add those as check types." |

### F. Integration & Technical

| # | Question | Our Recommendation | Reasoning |
|---|---|---|---|
| Q22 | Machine-readable reports from security company? | **Don't depend on this for MVP.** Ask the question, but assume PDF upload + manual checklist. If the client confirms AES can provide CSV/API, earmark it for Phase 3b as an enhancement. | Security companies are notoriously slow to modernize. The Wausau report is a PDF generated from their internal system. Even if AES offers data export, other vendors may not. Building the MVP on manual entry ensures we're not blocked by third-party dependencies. |
| Q23 | Inside Compass or separate? | **Inside the existing Compass app.** Add alarm testing as a new section in the navigation for each role. Same login, same deployment, same database. | Reuses authentication, role management, `access_grants`, email infrastructure, deployment pipeline, and the user base already trained on the app. A separate app would mean duplicate login, duplicate user management, and a fragmented experience. |
| Q24 | Teams integration? | **Fully replace the Teams workflow for new tests going forward.** Don't build a Teams integration — it adds complexity with little value. Optionally, allow bulk-import of historical PDFs from Teams as a one-time migration. | The whole point is to move away from scattered Teams folders. A hybrid approach ("some reports in Teams, some in Compass") defeats the purpose and confuses users. Clean break is better. Historical data can be migrated if the client wants it. |
| Q25 | Migrate historical data? | **Migrate 2026 data only (current year) as a one-time CSV import.** Older years: store a summary (building X completed month Y) without zone-level detail, since that data likely doesn't exist in structured form. | The Excel tracker has building-level completion data but no zone-level results. Importing "Building A completed January 2026" is easy and gives the dashboard historical context. Going further back has diminishing returns and the data quality is questionable. |

### G. Future Scope & Edge Cases

| # | Question | Our Recommendation | Reasoning |
|---|---|---|---|
| Q26 | Re-test after rejection? | **Create a new test linked to the rejected one.** The rejected test stays in history (for audit trail). The new test pre-populates from the rejected submission so the tester only needs to fix the flagged issues. | Editing a rejected submission destroys the audit trail (what was wrong, when was it rejected). A new submission linked to the rejection preserves history while keeping the workflow simple for the tester. |
| Q27 | Mobile-friendly? | **Yes — design the tester form as mobile-responsive from day one.** Use a simple checklist UI that works on phone/tablet screens. Don't build a native app — responsive web is sufficient. | Testers walk through buildings triggering alarms. If they can check off zones on their phone in real-time, data quality improves dramatically vs. going back to their desk and trying to remember. The existing Compass frontend uses React — making a responsive checklist is straightforward. |
| Q28 | Shared alarm systems? | **Model as one alarm panel → one building (1:1).** If two Compass locations share a panel, create one "building" in the alarm module that maps to both locations. The location mapping table handles this. | Shared panels are rare but possible. A 1:1 model is simpler and covers 95% of cases. The edge case of shared panels is solved at the data level (mapping table) without complicating the UI. |
| Q29 | Renovations / closures? | **Add a building status field: Active / Temporarily Exempt / Permanently Closed.** Temporarily Exempt requires a reason and an expected reactivation date. Exempt buildings show as grey (not red) on dashboards. | Without this, a building under renovation would show as perpetually non-compliant, creating noise on the dashboard and eroding trust in the data. The "expected reactivation date" triggers an auto-reminder to remove the exemption. |
| Q30 | Who updates zones? | **Division Safety Mgr (Approver) should own zone configuration for their buildings.** They already validate test results, so they are the right person to know when zones change. Admin retains override access for bulk operations. | On-site managers may not understand zone taxonomy well enough. Central admin is too far removed from individual buildings. The Safety Mgr sits in the middle — close enough to know the buildings, senior enough to be accountable for accurate configuration. |

### Summary of Key Assumptions for the Client Call

If the client has limited time, these are the **5 most important assumptions** to validate:

| # | Assumption | If Wrong, Impact |
|---|---|---|
| 1 | **100% zone coverage required for compliance** (not a threshold) | Changes the compliance engine logic and what "Green" means on the dashboard |
| 2 | **Mandatory approval by Safety Mgr for every test** | If self-certification is acceptable, we can simplify the workflow significantly |
| 3 | **Module lives inside the existing Compass app** (not standalone) | If standalone, we need to budget for separate auth, deployment, and infrastructure |
| 4 | **PDF upload + manual checklist for MVP** (no auto-parsing) | If auto-parsing is a hard requirement for launch, timeline and complexity increase significantly |
| 5 | **Multiple security vendors across buildings** | If it's AES-only nationwide, we could invest in AES-specific PDF parsing earlier |

---

## 11. Implementation Approach (Phased Delivery)

### Phase 3a — MVP (Recommended First Delivery)

- Admin: Zone config per building
- Tester: Submit monthly test (checklist + file upload)
- Approver: Review & approve/reject
- Dashboard: Traffic-light overview for management
- Notifications: Email reminders for deadlines

### Phase 3b — Enhanced Compliance

- PDF auto-parsing & zone matching
- Biannual checks (cellular backup, camera backup)
- Trend analytics & historical reporting
- Escalation workflows

### Phase 3c — Advanced

- API integration with security company (auto-pull reports)
- Mobile-friendly test form (for on-site use)
- Audit trail for all alarm compliance activities
- Export compliance reports for regulators

---

## 12. End-to-End Alarm Test Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐
│  Tester   │     │   System     │     │  Approver    │     │ Management │
│ (on-site) │     │              │     │ (Div Safety) │     │ (RC/DGM)   │
└─────┬─────┘     └──────┬───────┘     └──────┬───────┘     └─────┬──────┘
      │                  │                    │                   │
      │  1. Start test   │                    │                   │
      │  for building    │                    │                   │
      ├─────────────────►│                    │                   │
      │                  │                    │                   │
      │  2. Shows all    │                    │                   │
      │  configured zones│                    │                   │
      │◄─────────────────┤                    │                   │
      │                  │                    │                   │
      │  3. Mark zones   │                    │                   │
      │  + upload PDF    │                    │                   │
      ├─────────────────►│                    │                   │
      │                  │                    │                   │
      │  4. Submit       │  5. Notify         │                   │
      ├─────────────────►├───────────────────►│                   │
      │                  │                    │                   │
      │                  │  6. Review + check │                   │
      │                  │  zone coverage     │                   │
      │                  │◄───────────────────┤                   │
      │                  │                    │                   │
      │                  │  7. Approve        │                   │
      │  8. Notified     │◄───────────────────┤                   │
      │◄─────────────────┤                    │                   │
      │                  │                    │                   │
      │                  │  9. Dashboard      │                   │
      │                  │  updated (GREEN)   ├──────────────────►│
      │                  │                    │                   │
```

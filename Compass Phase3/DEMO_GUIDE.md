# Compass Phase 3 — Alarm Testing Module: Demo Guide

**Version:** 1.1
**Date:** 2026-04-06
**Status:** Frontend Prototype (Mock Data, No Backend Required for Alarm Screens)

---

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

> **Note:** If the existing Compass backend is running (port 8001), the login uses real user accounts from the database. If the backend is not running, only `admin@compass.com` / `demo1234` works (mock fallback).

---

## Login Credentials

All passwords are **`demo1234`**

### Primary Test Accounts

| Role | Email | Name | Alarm Screens Visible |
|---|---|---|---|
| **Admin** | `admin@compass.com` | T. Admin | Alarm Config, Alarm Approvals |
| **Controller** | `controller@compass.com` | Chris Controller | Alarm Testing |
| **DGM** | `dgm@compass.com` | Diana DGM | Alarm Testing, Alarm Dashboard |
| **Regional Controller** | `jamie.roberts@compass.com` | Jamie Roberts | Alarm Compliance, **Alarm Approvals** |
| **Regional Controller** | `kyle.decker@compass.com` | Kyle Decker | Alarm Compliance, **Alarm Approvals** |
| **Regional Controller** | `laura.davis@compass.com` | Laura Davis | Alarm Compliance, **Alarm Approvals** |
| **Operator** | `operator@compass.com` | Alex Operator | _(no alarm screens — operators don't do alarm tests)_ |

### Additional Test Accounts (all password `demo1234`)

| Role | Email | Name |
|---|---|---|
| Controller | `amanda.randall@compass.com` | Amanda Randall |
| Controller | `amy.patton@compass.com` | Amy Patton |
| Controller | `jessica.sobon@compass.com` | Jessica Sobon |
| DGM | `bill.zonzo@compass.com` | Bill Zonzo |
| DGM | `bob.jorgenson@compass.com` | Bob Jorgenson |
| DGM | `dale.davis@compass.com` | Dale Davis |
| Auditor | `auditor@compass.com` | Audrey Auditor |

### Assigned Roles in Alarm Module

| User | Alarm Role | Region |
|---|---|---|
| Chris Controller (U6) | Tester | All regions |
| Diana DGM (U7) | Tester | All regions |
| Jamie Roberts (U10) | Approver | Midwest |
| Kyle Decker (U11) | Approver | Southeast |
| Laura Davis (U12) | Approver | Northeast |

---

## Screen-by-Screen Guide

### Sidebar Navigation by Role

| Role | Sidebar Items |
|---|---|
| Admin | Cash Audit Trail, Locations, Users, Import Roster, **Alarm Config**, **Alarm Approvals**, **Alarm Audit Trail** |
| Controller | Daily Review Dashboard, Weekly Review Dashboard, Review DGM Visits, **Alarm Testing** |
| DGM | Coverage Dashboard, History, **Alarm Testing**, **Alarm Dashboard** |
| Regional Controller | Business Dashboard, Cash Audit Trail, Reports, Cash Trends, **Alarm Compliance**, **Alarm Approvals**, **Alarm Audit Trail** |

---

## Tester Screens (Controller / DGM)

### Screen 1: Alarm Test Form (`Alarm Testing`)

**What it does:** This is the primary screen where on-site managers conduct their monthly alarm test. They walk through the building triggering every alarm zone and record the results here.

**How to test:**
1. Login as `controller@compass.com` or `dgm@compass.com`
2. Click **Alarm Testing** in the sidebar
3. **Rejection notification banners** — if any of the tester's previous tests were rejected, red banners appear at the top showing building name, test month, and rejection reason. Click "Fix & Resubmit" to **reopen the rejected test for editing** — all previous zone results, dates, and notes are restored so the tester only needs to fix the failing zones. Dismiss with the X button.
4. **Select a building** from the dropdown (e.g., "Canteen Vending - Wausau")
5. The security company info appears below (Company: AES, Customer ID: AES9925, Phone)
6. **Test Details card**: Date is pre-filled to today, tester name is auto-filled. Optionally enter start/end time.
7. **Zone Testing Checklist**: All configured zones for the building appear, grouped by type:
   - Entry/Exit Doors (Main Entry Door, South Vehicle OH Door, etc.)
   - Interior Motion Sensors (Motion South End Main Hallway, etc.)
   - Panic Buttons / Silent Alarms (Cooler Panic, Freezer Panic, etc.)
8. For each zone, click one of three pills: **Tested** (green) / **Not Tested** (red) / **Issue** (amber)
9. Click the expand arrow on any zone to add notes
10. Watch the **progress bar** in the card header update as you mark zones
11. **Upload section**: Drag and drop a PDF file (or click to browse) — this is where the security company's Customer Activity Report goes
12. **Save Draft** (bottom left) — saves progress including zone results, can return later. Shows "Last saved at HH:MM:SS" timestamp. Auto-saves when zone results change.
13. **Submit for Approval** (bottom right) — sends to the Regional Controller for review
    - If any zones are unmarked or marked "Not Tested", a warning confirmation appears
    - After submission, navigates to the History screen

**Key details:**
- The Wausau building has 18 zones matching the real PDF sample (Zone 3: Main Entry Door through Zone 24: Main Office Motion)
- Each building has different zones — the admin configures these
- Drafts persist within the session, including zone-level results
- **Rejected tests are editable** — when selecting a building with a rejected test, the form reopens it as a draft with all zone results pre-filled. The tester fixes the issues and resubmits the same test (no need to start from scratch).
- Uses `useRef` for auto-save timer to avoid stale closure bugs

---

### Screen 2: Alarm Upload (`alarm-upload`)

**What it does:** Dedicated file upload screen for attaching the alarm company's Customer Activity Report (PDF) and any other evidence documents.

**How to test:**
1. From the Alarm Test Form, this is accessible as a sub-panel
2. Drag and drop files onto the upload area, or click to browse
3. Accepts: PDF, Excel, JPG, PNG (up to 25MB)
4. See the list of uploaded files with type icon, name, size, and delete button
5. Click "Back to Test" to return to the test form

---

### Screen 3: Alarm History (`View History` button)

**What it does:** Shows all past alarm test submissions for the tester's assigned buildings. Allows filtering by building, status, year, and month.

**How to test:**
1. From the Alarm Test Form, click **"View History"** button (top right)
2. **Back button** at top to return to Alarm Testing
3. **4 KPI cards** at the top: Tests This Year, Approved, Pending Review, Rejected
4. **Filter bar**: Select a building, click status pills (All / Draft / Submitted / Approved / Rejected), and use **year + month dropdowns**:
   - Year dropdown defaults to current year
   - Month dropdown is optional — leave blank to see the full year
   - Selecting a year resets the month selection
5. **Table** shows: Building, Test Date, Month, Tester, Zones (with mini progress bar), Status badge, Actions
6. Click **"View"** on any row to see the full test review detail
7. Click on a **Draft** row to resume editing in the test form

---

### Screen 4: Biannual Checks (`Biannual Checks` button)

**What it does:** Records the two biannual compliance items that are tracked separately from monthly tests: Cellular Backup verification (every 6 months) and 30-Day Camera Backup verification.

**How to test:**
1. From the Alarm Test Form, click **"Biannual Checks"** button (top right)
2. Select a building from the dropdown
3. **Two side-by-side cards** appear:

   **Left — Cellular Backup Test:**
   - Shows last check info (date, who, status, next due) if a previous check exists
   - Status dot in the header: green = compliant, red = overdue, gray = never checked
   - Fill in: check date, select Pass/Fail, add notes, upload evidence (PDF/image)
   - Click **"Record Cellular Check"**

   **Right — 30-Day Camera Backup:**
   - Same layout as cellular, plus a **"Days of backup verified"** number input
   - If you enter 30 or more: green text "Meets 30-day requirement"
   - If less than 30: red text "Below 30-day requirement"
   - Click **"Record Camera Check"**

4. **History table** below shows all past biannual checks with colored type badges (blue = Cellular, purple = Camera)

---

## Approver Screens (Regional Controller)

> **Note:** Regional Controllers are the primary approvers. Admin also has access to the Alarm Approvals screen. The flow is: **Tester submits -> Regional Controller approves/rejects**.

### Screen 5: Alarm Approvals (`Alarm Approvals`)

**What it does:** The approval queue where Regional Controllers review submitted alarm tests. Shows all tests with status filter tabs.

**How to test:**
1. Login as `jamie.roberts@compass.com` (or any RC, or `admin@compass.com`)
2. Click **Alarm Approvals** in the sidebar
3. **4 KPI cards**: Pending Review (amber if >0), Approved, Rejected (red if >0), Avg Review Time
4. **Status filter tabs**: All | Pending | Approved | Rejected — each with count badge, green underline on active tab
5. **Controls row**: Region dropdown + Oldest/Newest sort toggle
6. **Unified table**: Building, Region, Test Date, Tester, Zones (with mini progress bar), Status badge (in "All" view), Context column (adapts by status):
   - Pending: "Waiting Since" with red text if >3 days
   - Approved: approval date
   - Rejected: truncated rejection reason
7. **Action buttons**: "Review" (primary) for pending tests, "View" (outline) for approved/rejected
8. Click **"Escalations"** button (top right) to see overdue buildings

---

### Screen 6: Alarm Review (`Review` button from any screen)

**What it does:** The detailed view of a single alarm test. Shows zone-by-zone results, auto-checks compliance criteria, displays attached reports, and provides approve/reject actions. This screen is used by both approvers (with action buttons) and testers (view-only).

**How to test:**
1. From Alarm Approvals, click **"Review"** on any pending test
2. **Page header**: Back button, test title with building name and month, status badge
3. **Test Summary card**: Tester name, test date, time window, building info, security company, overall zone coverage bar
4. **Zone-by-Zone Results card**:
   - Every zone listed in read-only mode with result icons
   - Zones marked "Not Tested" have a **red left border**
   - Zones with "Issue Found" have an **amber left border** and notes shown
5. **Compliance Verification card** (4 auto-checks):
   - All configured zones have been tested
   - Alarm company report uploaded
   - Test completed within declared month
   - No unresolved zone issues
   - If any check fails, a warning banner appears
6. **Attached Reports card**: File list with download buttons
7. **Approval Decision card** (only visible for approvers on submitted tests):
   - Reviewer notes textarea
   - **"Approve Test"** button (green) — confirms via dialog, then marks approved + toast notification
   - **"Reject Test"** button (red) — opens a modal requiring a rejection reason. Toast: "Test rejected. Tester and approver will be notified."

---

### Screen 7: Escalation (`Escalations` button)

**What it does:** Shows all buildings that are overdue for their monthly alarm test, organized by escalation tier. Allows sending reminder notifications to specific recipients per tier.

**How to test:**
1. From Alarm Approvals, click **"Escalations"** button (top right)
2. **4 KPI cards**: Total Overdue (red), Tier 1/Reminder (amber), Tier 2/Deadline (orange), Tier 3/Critical (red)
3. **Table**: Building, Region, Assigned Tester, Last Test date, Days Overdue (bold red), Escalation Tier badge, Last Reminder date, "Send Reminder" button
4. **Tier badges** are color-coded: Tier 1 = amber, Tier 2 = orange, Tier 3 = red
5. Click **"Send Reminder"** — confirmation dialog shows building name + tier-specific recipients:
   - Tier 1: Tester
   - Tier 2: Tester + Approver
   - Tier 3: Tester + Approver + Regional Controller
6. Toast shows: "Reminder sent to: [recipient list]"
7. If no buildings are overdue: celebration screen with "All buildings are compliant!"

---

## Management Screens (Regional Controller / DGM)

### Screen 8: Alarm Overview Dashboard (`Alarm Compliance` or `Alarm Dashboard`)

**What it does:** The main leadership dashboard showing alarm compliance status across all buildings at a glance. Uses traffic-light indicators so management can instantly see which buildings are compliant, pending, or overdue. Includes auto-escalation tier indicators on overdue buildings and export functionality.

**How to test:**
1. Login as `jamie.roberts@compass.com` (Regional Controller) or `dgm@compass.com` (DGM)
2. Click **Alarm Compliance** (or **Alarm Dashboard** for DGM) in the sidebar
3. **5 KPI cards**:
   - Compliance Rate (% — green if >=80%, amber 60-79%, red <60%)
   - Compliant (green)
   - Pending Review (amber)
   - Overdue (red, highlighted if >0)
   - Exempt (gray)
4. **Export Compliance Reports card**: Two sections side by side:
   - **Per Building Report** — Export CSV or Export PDF for detailed building-level compliance
   - **Per Region Report** — Export CSV or Export PDF for aggregated region-level summary
   - Both respect the current month and region filters
5. **12-month Compliance Trend chart**: Area chart showing compliance % over time with an 80% target reference line (dashed amber). Tooltip shows "X% (Y of Z buildings)". Click "View Full Trends" to go to the trends page.
6. **Biannual cards** (side by side): **Cellular Backup** card showing X/Y compliant with progress bar, and **Camera Backup** card showing X/Y compliant with progress bar. Click "View Details" on either card for the full biannual status page.
7. **Building Compliance Table**:
   - Traffic-light dot for each building
   - **Auto-escalation tier badges** (T1 amber / T2 orange / T3 red) appear next to overdue buildings — hover for full description with thresholds and recipients
   - Columns: Status, Building, Region, **Testers**, **Approver**, Last Test, Zones (mini bar), Cellular dot, Camera dot, Actions
   - **Search bar** to filter by building name or region
   - **Click column headers** to sort (default: overdue/red buildings first)
   - **Click a KPI card** to filter the table (e.g., click "Overdue" to show only red buildings)
   - **Click "Details"** on any row to drill into that building
   - **Escalation legend** appears below the table when overdue buildings exist, showing T1/T2/T3 definitions with configured day thresholds and recipient lists

---

### Screen 9: Alarm Trends (`View Full Trends`)

**What it does:** Historical analytics showing compliance trends over time, approval turnaround metrics, and buildings with recurring issues. Now shows rolling 12 months of data.

**How to test:**
1. From the Alarm Overview, click **"View Full Trends"** link
2. **Filters**: Region dropdown, date range pills (6mo / 12mo / 24mo), "Export Report" button
3. **4 KPI cards**: Current Compliance (with delta like "+3% vs last month"), 12-Month Average, Avg Days to Approval, Buildings with Issues
4. **Compliance Trend chart**: Line chart showing monthly compliance rate with 80% target line
5. **Approval Turnaround chart**: Bar chart showing average days to approval per month (bars colored: green <3 days, amber 3-5 days, red >5 days) with 5-day SLA reference line
6. **Recurring Issues table**: Buildings with repeated zone failures, showing issue count, last issue date, most common zone type, and "View" link to drill down
7. Click **"Export Report"** to download a CSV file

---

### Screen 10: Building Drill-Down (`Details` link from Overview)

**What it does:** Deep dive into a single building's alarm testing history, zone configuration, biannual compliance, and approval timeline.

**How to test:**
1. From the Alarm Overview, click **"Details"** on any building row
2. **Page header**: Building name, region, security company info, status badge, back button
3. **5 KPI cards**: Tests This Year, Current Month (status), Zone Coverage (avg %), Cellular Backup, Camera Backup
4. **Configured Zones card**: 3-column grid showing every zone with:
   - Zone number badge (green circle)
   - Zone name
   - Type badge (color-coded: blue = Entry/Exit, purple = Interior, red = Panic, amber = Hold-Up, orange = Fire, gray = Other)
   - Area badge if area > 1
5. **Test History (Last 12 Months)**: Visual month grid with clickable boxes
   - Each box shows month abbreviation + traffic-light dot
   - **Click a month** to expand detail: test date, tester, status badge, zone progress bar, "View Full Review" link
   - Green = approved, yellow = submitted, red = rejected/missing, gray = future
6. **Biannual Compliance card**: Cellular + Camera rows showing last check date, status, next due date, days until due (green) or days overdue (red)
7. **Approval Timeline table**: Last 12 months with: Month, Test Date, Tester, Status, Reviewer, Review Date

---

### Screen 11: Biannual Status (`View Details` from Overview)

**What it does:** Shows biannual compliance status (Cellular Backup + Camera Backup) for ALL buildings in one view. Highlights overdue buildings.

**How to test:**
1. From the Alarm Overview biannual summary, click **"View Details"**
2. **Back button** to return to Alarm Overview
3. **4 KPI cards**: Cellular Compliant (green), Cellular Overdue (red), Camera Compliant (green), Camera Overdue (red)
4. **Table**: Building, Region, Cellular Last Check, Cellular Next Due, Cellular Status, Camera Last Check, Camera Next Due, Camera Status
5. **Color-coded cells**:
   - Green background = Compliant
   - Red background = Overdue
   - Amber background = Due within 30 days
   - Gray background = Never checked
6. Overdue rows have a **red left border** (3px)
7. Default sort: overdue first, then by nearest due date
8. Click building name to go to drill-down
9. **"Export"** button to download data

---

## Admin Screens

### Screen 12: Alarm Zone Configuration (`Alarm Config` -> Zones tab)

**What it does:** Admin manages the list of alarm zones for each building. Zones are the individual alarm points (doors, motion sensors, panic buttons) that must be tested monthly.

**How to test:**
1. Login as `admin@compass.com`
2. Click **Alarm Config** in the sidebar
3. **Sub-nav pills** at top: Buildings | **Zones** | Rules | Access | Audit
4. **Select a building** from the dropdown (e.g., "Canteen Vending - Wausau")
5. **Zone table** shows: Zone #, Zone Name, Type (colored badge), Area, Status, Actions
6. **Add Zone**: Click "+ Add Zone" -> modal with fields: zone number, area number, zone name, type dropdown, conditional "Other" description -> Save
7. **Edit Zone**: Click pencil -> modal pre-filled -> modify -> Save
8. **Deactivate**: Click toggle -> confirmation -> zone becomes inactive (gray badge)
9. **Delete**: Click trash -> confirmation (only for zones created this session)
10. **Import CSV**: Click "Import CSV" -> upload a .csv file with columns: zone_number, zone_name, zone_type, area_number -> preview table -> confirm import

---

### Screen 13: Building Setup (`Buildings` tab)

**What it does:** Admin configures building-level settings: security company details, tester/approver assignments, and building status.

**How to test:**
1. Click **"Buildings"** pill in the sub-nav
2. **4 KPI cards**: Total Buildings, Active (green), Exempt (amber), Closed (gray)
3. **Card header actions**: Sample CSV download link (dashed green border) | Import CSV button | + Add Building button | Reset button (red outline)
4. **Search bar** to filter buildings
5. **Table**: Building Name, Region, Security Company, Customer ID, Phone, Testers, Approver, Status, Actions
6. "None" appears in red text where testers or approvers are not assigned
7. Click **"Edit"** -> modal with 3 sections:
   - **Security Company Info**: Company name, Customer ID, Phone
   - **Assignments**: Testers (checkbox list), Approver (dropdown)
   - **Status**: Active / Temporarily Exempt / Closed radio buttons
   - If "Temporarily Exempt": reason textarea + expected reactivation date appear
8. **Import CSV**: Click "Import CSV" -> upload a .csv with columns: name, region, security_company_name, security_customer_id, security_company_phone, status -> preview table -> confirm
9. **Sample CSV**: Click the dashed green link to download `alarm-buildings-sample.csv`
10. **Reset**: Click "Reset" (red outline) -> confirmation -> removes all imported buildings, restores original 12

---

### Screen 14: Compliance Rules (`Rules` tab)

**What it does:** Admin configures the compliance rules: monthly test deadlines, approval SLA, what's required for compliance, escalation tiers, biannual check frequencies, and notification preferences.

**How to test:**
1. Click **"Rules"** pill in the sub-nav
2. **Monthly Test Requirements card**:
   - Monthly Deadline Day (number input, e.g., 28)
   - Approval SLA Days (e.g., 5)
   - Three toggle switches:
     - "Require all zones tested for compliance" (toggle on/off)
     - "Require alarm report upload"
     - "Require approver sign-off"
3. **Escalation Configuration card** (3 tiers with colored left borders):
   - Tier 1 (amber border): "Reminder" — days before deadline + recipients (Tester)
   - Tier 2 (orange border): "Deadline" — days after deadline + recipients (Tester, Approver)
   - Tier 3 (red border): "Critical" — days after deadline + recipients (Tester, Approver, Regional)
4. **Biannual Check Configuration card**:
   - Cellular backup frequency (months)
   - Camera check frequency (days)
   - Reminder days before due
5. **Biannual Check Escalation card** (3 tiers):
   - Tier 1 (amber): days overdue -> Tester, Approver
   - Tier 2 (orange): days overdue -> Tester, Approver, Regional
   - Tier 3 (red): days overdue -> Tester, Approver, Regional, DGM
6. **Notification Settings card**:
   - Toggle: "Send email notifications for escalations and status changes"
   - Toggle: "Show in-app notification banners and alerts"
7. **Change any value** -> "You have unsaved changes" warning appears
8. Click **"Save Rules"** -> toast "Compliance rules updated"

---

### Screen 15: User Access (`Access` tab)

**What it does:** Admin manages who has alarm testing and alarm approval permissions. This is how Controllers/DGMs get tester access and Regional Controllers get approver access.

**How to test:**
1. Click **"Access"** pill in the sub-nav
2. **Summary cards**: Testers count + Approvers count
3. **Card header actions**: Sample CSV download link (dashed green) | Import CSV button | Add Assignment button
4. **Filter pills**: All / Testers / Approvers + search by name
5. **Assignments table**: User (name + role), Access Type badge (blue = Tester, green = Approver), Buildings (comma-separated, "+N more" for long lists), Granted Date, "Revoke" button
6. **Add new assignment**: Click "Add Assignment" -> inline form expands:
   - Select a user from the dropdown
   - Choose access type: "Tester" or "Approver"
   - Check which buildings they should have access to (Select All / Clear)
   - Add optional notes
   - Click Save -> toast "Access granted" -> table updates
7. **Import CSV**: Click "Import CSV" -> upload a .csv with columns: user_name, access_type, building_names -> preview table with match status -> confirm
8. **Sample CSV**: Click the dashed green link to download `alarm-access-sample.csv`
9. **Revoke access**: Click "Revoke" -> confirmation -> removed from table

---

### Screen 16: Alarm Audit Trail (`Audit` tab)

**What it does:** Shows a chronological log of all key actions in the alarm testing module — who changed what and when. Covers access grants/revokes, building changes, test submissions/approvals/rejections, config changes, and escalation events.

**How to test:**
1. Click **"Audit"** pill in the sub-nav
2. **Export CSV** button in the page header — downloads all filtered events as CSV
3. **Category filter pills**: All | Access | Buildings | Testing | Config — each with count badge
4. **Search bar** to search by description, user name, or action type
5. **Date range** filter: from/to date pickers
6. **Table**: Timestamp (formatted), User, Action (color-coded badge by category), Details
7. **Action badge colors**: Access = blue, Buildings = green, Testing = amber, Config = purple
8. **Pagination** (15 rows per page)
9. Events include: ACCESS_GRANTED, ACCESS_REVOKED, BUILDING_ADDED, BUILDING_UPDATED, TEST_SUBMITTED, TEST_APPROVED, TEST_REJECTED, RULES_UPDATED, ZONE_ADDED, ESCALATION_SENT
10. Default sort: newest first
11. Export respects all active filters (category, search, date range)

---

## User Flow Walkthroughs

### Flow A: Complete Monthly Alarm Test (Happy Path)

```
Controller logs in
  -> Clicks "Alarm Testing"
  -> Selects "Canteen Vending - Wausau"
  -> Marks all 18 zones as "Tested"
  -> Uploads the alarm company PDF
  -> Clicks "Submit for Approval"
  -> Test appears as "Pending Review" in history

Regional Controller (Jamie Roberts) logs in
  -> Clicks "Alarm Approvals"
  -> Sees the Wausau test in the queue (Pending tab)
  -> Clicks "Review"
  -> Sees all zones tested, report uploaded, compliance checks all green
  -> Clicks "Approve Test"
  -> Test status changes to "Approved"
  -> Switches to "Alarm Compliance"
  -> Sees Wausau building with green traffic light
  -> Compliance Rate KPI reflects the approval
```

### Flow B: Test with Issues -> Rejection -> Re-test

```
DGM logs in
  -> Clicks "Alarm Testing"
  -> Selects a building
  -> Marks 15 of 18 zones as "Tested", 2 as "Not Tested", 1 as "Issue Found"
  -> Adds note on the issue zone: "Panic button unresponsive, maintenance ticket #12345"
  -> Uploads PDF
  -> Submits (warning appears about untested zones -> confirms)

Regional Controller logs in
  -> Clicks "Alarm Approvals"
  -> Reviews the test
  -> Sees red borders on 2 untested zones, amber border on issue zone
  -> Compliance check shows "All zones tested" failed and "No unresolved issues" failed
  -> Clicks "Reject Test" -> enters reason: "3 zones incomplete, re-test after maintenance"
  -> Toast: "Test rejected. Tester and approver will be notified."

DGM logs in again
  -> Sees red rejection notification banner at top of Alarm Testing screen
  -> Banner shows: building name, test month, rejection reason
  -> Clicks "Fix & Resubmit"
  -> Toast: "Rejected test loaded for editing. Fix the issues and resubmit."
  -> The rejected test reopens with all 18 zones pre-filled (15 Tested, 2 Not Tested, 1 Issue)
  -> Fixes the 2 untested zones -> marks them as Tested
  -> Fixes the issue zone -> marks as Tested, updates notes
  -> Clicks "Submit for Approval" -> same test resubmitted (not a new test)
```

### Flow C: Admin Configures a New Building

```
Admin logs in
  -> Alarm Config -> Buildings tab
  -> Clicks "+ Add Building" or "Import CSV" to bulk-upload
  -> Downloads "Sample CSV" for the correct format
  -> Fills in security company details
  -> Switches to "Zones" tab -> selects the new building
  -> Clicks "+ Add Zone" repeatedly or uses "Import CSV" for bulk zones
  -> Switches to "Access" tab -> grants alarm_tester access to a Controller
  -> Or uses "Import CSV" to bulk-assign testers/approvers
  -> That Controller now sees "Alarm Testing" in their sidebar
```

### Flow D: Biannual Compliance Check

```
Controller logs in
  -> Alarm Testing -> "Biannual Checks" button
  -> Selects building
  -> Cellular Backup card: enters date, selects "Pass", uploads evidence screenshot
  -> Clicks "Record Cellular Check" -> toast success
  -> Camera Backup card: enters date, selects "Pass", enters "45" days verified
  -> Green text: "Meets 30-day requirement"
  -> Clicks "Record Camera Check"

Regional Controller logs in
  -> Alarm Compliance dashboard -> Cellular Backup card shows updated count (e.g., 9/12 compliant)
  -> Camera Backup card also shows updated count
  -> Clicks "View Details" on either card -> sees the building now shows "Compliant" for both checks
```

### Flow E: Export Compliance Reports

```
Regional Controller logs in
  -> Clicks "Alarm Compliance"
  -> Selects month and region filter (optional)
  -> Scrolls to "Export Compliance Reports" card
  -> Clicks "Export CSV" under Per Building Report -> downloads CSV with building-level data
  -> Clicks "Export PDF" under Per Region Report -> opens printable page with aggregated stats
  -> Uses browser Print -> Save as PDF
```

### Flow F: Escalate Overdue Buildings

```
Regional Controller logs in
  -> Clicks "Alarm Approvals"
  -> Clicks "Escalations" button (top right)
  -> Sees overdue buildings with escalation tier badges (T1/T2/T3)
  -> Clicks "Send Reminder" on a Tier 2 building
  -> Confirmation dialog: "Send escalation reminder for [Building Name]? Recipients: Tester + Approver"
  -> Confirms -> toast: "Reminder sent to: Tester + Approver"
  -> "Last Reminder" column updates to "Just now"
  -> If no overdue buildings: celebration screen "All buildings are compliant!"
```

### Flow G: Review Audit Trail

```
Admin logs in
  -> Clicks "Alarm Audit Trail" in the sidebar
  -> Sees all recent actions in chronological order
  -> Clicks "Testing" pill to filter to test-related events only
  -> Searches for "Wausau" to find actions on that building
  -> Uses date range to narrow to last week
```

---

## Technical Notes

- **All alarm data is mock** — stored in `frontend/src/mock/alarmData.ts`. No backend API calls for alarm screens.
- **User directory is shared** — alarm users come from the main `USERS` array in `frontend/src/mock/data.ts` (no separate ALARM_USERS). The `listAlarmUsers()` API maps active users to the AlarmUser format.
- **Changes persist within the browser session** — refreshing the page resets mock data to defaults.
- **The existing CashRoom screens** (Operator, Controller daily review, DGM coverage, Admin audit/users/locations) work as before with the real backend.
- **Compliance history** now shows rolling 12 months (previously 6).
- **Auto-escalation** — overdue buildings on the dashboard show tier badges (T1/T2/T3) computed from the escalation rules configuration. The legend below the table explains thresholds.
- **Notification settings** — configurable in Compliance Rules with toggles for email and in-app notifications. In-app rejection banners are already implemented on the tester home screen.
- **File uploads** are stored in browser memory only — they don't persist across page refreshes and are not sent to any server.
- **CSV exports** — building and region compliance reports can be exported as CSV (direct download) or PDF (opens print-friendly page in new tab).

### Pending Questions for Shivani (Q6, Q7, Q9, Q10)

- Q6: Can a building have multiple tests in the same month (re-tests after rejection)?
- Q7: What is the approval SLA — how many days before it escalates?
- Q9: Are there different zone types that need different test procedures?
- Q10: Should biannual checks be linked to monthly tests or independent?

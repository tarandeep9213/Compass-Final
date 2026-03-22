# Compass CashRoom Compliance System (CCS)
## Complete Developer Handover Document

**Version:** 1.0
**Date:** February 2026
**Frontend Stack:** React 18 + Vite + TypeScript (already built — mock data only)
**Backend to build:** FastAPI + PostgreSQL
**Developer Task:** Replace all mock data with real API calls and deploy to AWS

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Responsibilities](#2-user-roles--responsibilities)
3. [Architecture & File Structure](#3-architecture--file-structure)
4. [Screen-by-Screen Functional Guide](#4-screen-by-screen-functional-guide)
5. [Backend Development Guide](#5-backend-development-guide)
6. [Database Schema](#6-database-schema)
7. [API Endpoints Reference](#7-api-endpoints-reference)
8. [Deployment Guide](#8-deployment-guide)
9. [Manual Test Cases — All Screens](#9-manual-test-cases--all-screens)
10. [Email Notification Specifications](#10-email-notification-specifications)
11. [Edge Case Test Scenarios](#11-edge-case-test-scenarios)

---

## 1. System Overview

### What Is This System?

The Compass CashRoom Compliance System (CCS) is a web application used by Compass Group / Canteen Services to track daily cash reconciliation across multiple cashroom locations (e.g., airport terminals, food courts).

**The problem it solves:**
Every cashroom location must count and report their cash at the end of each business day. Currently this is done on paper or in spreadsheets. CCS digitises the entire process and enforces a 3-layer compliance chain:

1. **Operators** count and submit cash totals daily
2. **Managers** approve or reject each submission
3. **Controllers** physically visit locations to verify cash counts
4. **DGMs** (District General Managers) make monthly oversight visits
5. **Admins** configure the system, manage users and view all compliance data
6. **Auditors** review reports and the full audit trail

### Key Business Rules

| Rule | Detail |
|---|---|
| **Imprest Balance** | Each location maintains a fixed cash fund (£9,575 default). Submissions track deviation from this. |
| **Daily Submission** | Every active location must submit one cash count per day |
| **Variance Tolerance** | If total cash varies by more than 5% from imprest, operator must write an explanation |
| **Approval SLA** | Manager must approve/reject within 48 hours of submission |
| **Controller DOW Rule** | Controller should not visit the same location on the same day-of-week two weeks in a row (detectable pattern risk) — system warns but does not block |
| **DGM Monthly Rule** | DGM must visit each location exactly once per calendar month — system blocks a second visit |
| **One Submission Per Day** | A location cannot have two submissions for the same date |

---

## 2. User Roles & Responsibilities

| Role | What They Do | Screens They Access |
|---|---|---|
| **Operator** | Counts cash and submits daily totals. Can resubmit if rejected. Can explain missed days. | Dashboard, Form Entry, Chat Entry, Excel Upload, View Submission, Missed Explanation |
| **Manager** | Reviews and approves or rejects operator submissions. Sees approval history. | Pending Approvals, Approval History |
| **Controller** | Schedules and logs physical verification visits to locations. | Schedule Visit, My Verification History |
| **DGM** | Schedules monthly oversight visits. Views monthly compliance matrix. | Monthly Dashboard, Log Visit |
| **Admin** | Manages locations, users, system configuration. Views all compliance data. | Compliance Dashboard, Locations, Users, Config, Reports, Audit Trail |
| **Auditor** | Read-only access to reports and audit trail. Cannot modify anything. | Reports, Audit Trail |

### Demo Login Accounts (for testing)

| Role | Email | Password |
|---|---|---|
| Operator | operator@compass.com | demo1234 |
| Manager | manager@compass.com | demo1234 |
| Controller | controller@compass.com | demo1234 |
| DGM | dgm@compass.com | demo1234 |
| Admin | admin@compass.com | demo1234 |
| Auditor | auditor@compass.com | demo1234 |

---

## 3. Architecture & File Structure

### Frontend (Already Built)

```
frontend/src/
├── mock/
│   └── data.ts              ← All fake data (replace with API calls)
├── pages/
│   ├── Login.tsx            ← Login screen
│   ├── operator/
│   │   ├── OpStart.tsx      ← Operator Dashboard
│   │   ├── OpMethod.tsx     ← Choose entry method
│   │   ├── OpForm.tsx       ← Digital form (sections A–I)
│   │   ├── OpChat.tsx       ← Guided chat entry
│   │   ├── OpExcel.tsx      ← Excel upload
│   │   ├── OpReadonly.tsx   ← View submitted (also Manager's approval screen)
│   │   └── OpMissed.tsx     ← Explain missed submission
│   ├── manager/
│   │   ├── MgrApprovals.tsx ← Pending approvals queue
│   │   └── MgrHistory.tsx   ← Past approval decisions
│   ├── controller/
│   │   ├── CtrlLog.tsx      ← Schedule controller visit
│   │   └── CtrlHistory.tsx  ← Controller verification history
│   ├── dgm/
│   │   ├── DgmDash.tsx      ← Monthly compliance matrix
│   │   └── DgmLog.tsx       ← Log DGM visit
│   └── admin/
│       ├── AdmCompliance.tsx ← Unified compliance dashboard
│       ├── AdmLocations.tsx  ← Manage locations
│       ├── AdmUsers.tsx      ← Manage users
│       ├── AdmConfig.tsx     ← System configuration
│       ├── AdmReports.tsx    ← Weekly/monthly reports
│       └── AdmAudit.tsx      ← Audit trail
├── components/
│   └── AppShell.tsx          ← Sidebar + top bar layout
└── App.tsx                   ← Root — auth state, routing, nav
```

### How Navigation Works

The app does NOT use React Router URLs. Instead it uses **panel-state navigation**:
- `App.tsx` holds `currentPanel` (a string like `"op-start"`) and `ctx` (a context object with extra data)
- Clicking a sidebar item or a button calls `onNavigate("panel-name", { key: "value" })`
- `App.tsx` renders the correct component based on `currentPanel`

**Why this matters for the backend developer:**
When you see `onNavigate('op-readonly', { submissionId: 'S123' })`, that means the screen navigates and passes the submission ID to the next screen through the context object — **not through a URL**. The receiving screen reads `ctx.submissionId` from its props.

---

## 4. Screen-by-Screen Functional Guide

---

### SCREEN 1: Login (`Login.tsx`)

**Who uses it:** Everyone
**Purpose:** Authenticate and access the system

**How it works:**
- User enters email and password
- System validates against the Users table
- On success, stores the user's role, name, and assigned location IDs in app state
- The sidebar and available screens change based on the role
- Operators are assigned to specific locations — they do NOT choose their location at login

**Important:** The frontend currently shows 6 quick-fill buttons for demo accounts. In production, remove these or gate them behind an env flag.

**Key fields:**
- Email (text input, validated as non-empty)
- Password (password input, validated as non-empty)

**What happens after login:**
- Operator → goes to `op-start` (Operator Dashboard)
- Manager → goes to `mgr-approvals` (Pending Approvals)
- Controller → goes to `ctrl-log` (Schedule Visit)
- DGM → goes to `dgm-dash` (Monthly Dashboard)
- Admin → goes to `adm-compliance` (Compliance Dashboard)
- Auditor → goes to `adm-reports` (Reports)

---

### SCREEN 2: Operator Dashboard (`OpStart.tsx`)

**Who uses it:** Operators
**Purpose:** The operator's home screen — shows today's status and last 30 days of submission history

**How it works:**

**Today's Status Card (top of screen):**
- Shows a large status card based on what has happened today
- If today is submitted and approved → green card, shows total and variance
- If today is submitted and pending → amber card, "Awaiting manager approval"
- If today is submitted and rejected → red card, "Rejected — resubmit required" + button to resubmit
- If there is a saved draft → amber card, "Draft in progress" + button to resume
- If nothing submitted → amber card with "Submit Today's Count" button

**Summary Chips (below status card):**
- 4 colored chips showing counts: Pending, Rejected, Missing, Approved (for last 30 days)
- Clicking a chip filters the history table below

**History Table:**
- Shows last 30 calendar days (including today)
- Each row: Date | Total Cash | Variance | Status
- Missing days (no submission) show as "Missing" row in red with "Log Missed" link
- Click any row → goes to `op-readonly` (for submitted days) or `op-missed` (for missing days)
- Today's row, if not submitted, shows "Submit Now" link
- Pagination: 10 rows per page

**Jump to Date:**
- Small date input to jump directly to a specific past date

**Business Rules:**
- Operator can only see their assigned location's submissions
- Cannot submit for future dates
- Cannot submit for a date that already has an approved/pending submission
- Can resubmit for a rejected date

---

### SCREEN 3: Choose Entry Method (`OpMethod.tsx`)

**Who uses it:** Operators
**Purpose:** Let the operator choose HOW they want to enter the cash count for a specific date

**How it works:**
- 3 option cards displayed:
  1. **Digital Form** (Recommended) — fill in each section manually, live calculation
  2. **Guided Chat** — chatbot-style, one denomination at a time, easier for new staff
  3. **Excel Upload** — upload the pre-formatted spreadsheet (fastest if already filled)
- Each card shows a description and an estimated time
- Clicking a card navigates to that entry screen

**Also shown:** A reference table listing all 9 form sections (A–I) with descriptions — this helps the operator know what data they need before choosing

**No form fields** — this is purely a navigation screen

---

### SCREEN 4: Digital Cash Form (`OpForm.tsx`)

**Who uses it:** Operators
**Purpose:** The main cash count entry form — 9 sections covering all cash types

**This is the most complex screen in the application.**

**Form Structure (9 Sections):**

| Section | Name | How to Enter | What It Captures |
|---|---|---|---|
| A | Currency Bills | Quantity × face value per denomination | $100, $50, $20, $10, $5, $2, $1 bills |
| B | Coins in Counting Machines | Quantity × face value per denomination | $1, $0.50, $0.25, $0.10, $0.05, $0.01 coins |
| C | Bagged Coin | Quantity × bag value per type | $25 dollar bags, $10 quarter bags, $5 dime bags, $2 nickel bags, $50 bulkers |
| D | Unissued Changer Funds | 4 custom rows, each with qty × amount | Free-form denomination entries |
| E | Rolled Coin | 4 direct dollar amounts | Subtotals for rolled coin by type |
| F | Returned Uncounted Funds | 3 direct dollar amounts | Returned cash that hasn't been counted |
| G | Mutilated / Foreign Currency | 2 direct amounts (currency + coin) | Damaged or foreign money |
| H | Changer Funds Outstanding | 1 direct amount | Cash currently in changers |
| I | Net Unreimbursed Shortage/Overage | 2 amounts (shortage, overage) | Net = Overage − Shortage |

**Live Calculation (sticky bar at top):**
- Total Fund = A + B + C + D + E + F + G + H + I(net)
- Imprest = £9,575 (configured per location)
- Variance = Total Fund − Imprest
- Variance % = (Variance / Imprest) × 100
- Color coding: green ≤ 2%, amber 2–5%, red > 5%
- Completion dots: one dot per section, fills as user enters data

**Variance Note:**
- If |Variance %| > Tolerance (default 5%):
  - A yellow warning appears
  - A required text area appears: "Explain the variance"
  - Cannot submit without explanation

**Buttons:**
- "Save Draft" — saves current state without submitting (can resume later)
- "Submit" — validates, creates submission with `pending` status

**Validation:**
- All quantities must be ≥ 0 (no negative values)
- If variance exceeds tolerance, note is required (min 10 characters)
- At least one section must have a non-zero value

---

### SCREEN 5: Guided Chat Entry (`OpChat.tsx`)

**Who uses it:** Operators (especially new or less technical staff)
**Purpose:** An easier way to enter cash counts — one denomination at a time, chatbot style

**How it works:**
- System walks through 19 denominations one at a time
- Each "message" from the system asks for a specific count
- Operator types the number and presses Enter or clicks Send
- A running total sidebar updates after each entry
- After all 19 items, shows a summary and Submit button

**Denominations covered:**
- $100, $50, $20, $10, $5, $2, $1 bills (Section A)
- $1, $0.50, $0.25, $0.10, $0.05, $0.01 coins (Section B)
- Bagged coins (Section C)
- Rolled coin total (Section E)
- Changer outstanding (Section H)

**Note:** Sections D, F, G, I default to $0 when using the chat — operator can edit after if needed.

**Sidebar shows:** Live fund total, variance vs imprest (color-coded), section progress.

---

### SCREEN 6: Excel Upload (`OpExcel.tsx`)

**Who uses it:** Operators who fill in the Excel spreadsheet offline
**Purpose:** Upload the pre-formatted Sheboygan Excel template and auto-extract section totals

**How it works:**
1. Drag and drop (or click to browse) an .xlsx or .xls file
2. System parses the file and extracts totals for each section A–I
3. Shows a preview table of extracted totals
4. Operator reviews the extracted values
5. If the variance exceeds 5%, requires an explanation note
6. Submit creates a submission

**Important business rule:** The Excel file must match the Sheboygan template format. The backend parser must understand this specific format. (Reference: the original POC had an Excel parser — replicate it in Python using openpyxl.)

**Demo button:** "Use Demo File" fills in mock values (£9,620.50 total, +£45.50 variance) without actually uploading anything — for testing only.

---

### SCREEN 7: View Submission — Read Only (`OpReadonly.tsx`)

**Who uses it:** Operators (view only) + Managers (approve/reject)
**Purpose:** Displays a completed submission in full detail. Doubles as the manager's approval screen.

**Operator view shows:**
- Location name and date
- Status badge (approved/pending/rejected)
- Total cash, imprest, variance, variance %
- Full section-by-section breakdown table (A through I with totals)
- Who approved it and when (if approved)
- Rejection reason (if rejected)
- "Resubmit" button if rejected

**Manager view shows (same screen, different mode):**
- Everything above PLUS:
- "Approve" button (green)
- "Reject" button (red) — clicking opens an inline textarea for the rejection reason
- After approval/rejection, shows result confirmation

**How the screen knows which mode to use:**
The context object passed to this screen includes `fromPanel`. If `fromPanel === 'mgr-approvals'`, it shows manager action buttons.

---

### SCREEN 8: Missed Submission Explanation (`OpMissed.tsx`)

**Who uses it:** Operators
**Purpose:** When a day is missing (no submission), the operator explains why

**How it works:**
- Shows the date that was missed
- Operator fills in:
  1. **Reason** (dropdown, required): Illness, Technical Issue, Emergency, Public Holiday, Training, Other
  2. **Detail** (textarea, required): Full explanation (min 20 characters)
  3. **Supervisor/Manager name** (text, required): Who authorised/is aware
- Submit shows a success confirmation modal
- From modal, operator can go back to dashboard

**Important:** This creates a MISSED_SUBMISSION_EXPLANATION record — it does NOT create a normal cash submission. The day remains marked "Missing" in the compliance view, but the explanation is logged for audit purposes.

---

### SCREEN 9: Pending Approvals (`MgrApprovals.tsx`)

**Who uses it:** Managers
**Purpose:** Queue of all submissions awaiting the manager's approval decision

**KPI Cards at top:**
- Awaiting Approval (turns red if any are overdue >48h)
- Approved (count)
- Rejected (count)
- Avg Variance % (color-coded by band)

**Filter Bar:**
- Location dropdown (all locations, or specific one)
- Status chips: All | Pending | Approved | Rejected
- Date range: Last 7 days | Last 30 days | All time

**Submission Table:**
- Columns: Date | Location | Operator | Total Cash | Variance | Status | Overdue Flag | Actions
- Overdue rows (pending >48h) are highlighted in red
- "View" button → goes to `op-readonly` in manager mode (full detail + approve/reject buttons)
- Inline Approve / Reject buttons on each row (quick action without navigating away)
  - Reject opens an inline text area for rejection reason
  - After action, that row updates its status badge

**Important business rule:** Manager can only approve/reject submissions for locations assigned to them.

---

### SCREEN 10: Approval History (`MgrHistory.tsx`)

**Who uses it:** Managers
**Purpose:** Read-only history of all approval decisions this manager has made

**Filters:** Date range (7d / 30d / All), Status (Approved / Rejected)

**Table columns:** Location | Operator | Submission Date | Total Cash | Variance | Status | Manager Decision | Decision Time | Rejection Reason (excerpt)

**KPIs:** Total actioned | Approval % | Rejection % | Avg variance of submissions reviewed

---

### SCREEN 11: Schedule Controller Visit (`CtrlLog.tsx`)

**Who uses it:** Controllers
**Purpose:** Book a future date (and time slot) to physically visit a location and verify the cash count

**How it works:**

**Step 1 — Choose a Location** (dropdown at top)

**Step 2 — Choose a Date** (calendar widget):
- Can only select future dates (tomorrow or later)
- Already-booked dates show a green dot — cannot select these
- Dates that would trigger a DOW (Day-Of-Week) warning show an amber dot

**Day-of-Week Warning:**
- Before the visit is booked, the system checks the past 6 weeks of completed visits for this location
- If the controller visited on the same day of week (e.g., every Tuesday), it shows an amber warning
- The controller must acknowledge the warning and select a reason from a dropdown:
  - Operational necessity
  - Requested by location manager
  - Follow-up required
  - Other
- The visit is still allowed — the system logs `warningFlag = true` and records the reason
- This data feeds into compliance reports to show visiting pattern risks

**Step 3 — Choose a Time Slot:**
- 5 fixed options: 09:00, 11:00, 13:00, 15:00, 17:00

**Step 4 — Submit:**
- Creates a `scheduled` verification record
- Shows a success confirmation with the booking details

---

### SCREEN 12: Controller Verification History (`CtrlHistory.tsx`)

**Who uses it:** Controllers
**Purpose:** Read-only list of all past verification visits

**KPIs:** Total verified | This month | Pattern warnings | Avg days between visits

**Filters:** Location dropdown

**Table columns:** Date | Day of week | Location | Observed Total | vs Imprest | Variance % | DOW Warning flag | Notes

**Note:** "Observed Total" is what the controller physically counted — it may differ from what the operator submitted.

---

### SCREEN 13: DGM Monthly Dashboard (`DgmDash.tsx`)

**Who uses it:** DGMs (District General Managers)
**Purpose:** Shows which locations have been visited this month (and historical months) in a matrix format

**Matrix View:**
- Rows = Locations
- Columns = Last 12 months
- Each cell shows one of: ✅ Visited | ⏳ Pending | 🔴 Overdue | — (future)
- Click a visited cell → shows a detail panel (date, observed total, variance, notes)
- Click a pending/overdue cell → shows "Schedule Visit" option

**KPIs:** Visited this month | Remaining | Overdue months | Total visits all-time

**History Table (below matrix):**
- Shows all past visits in list form
- Filters: Location | Year | Month | Status | Variance Band

**Year selector:** View current year, or previous 2 years

**Business Rule:** One visit per location per calendar month. If a month is already visited, the DGM cannot add another one.

---

### SCREEN 14: Log DGM Visit (`DgmLog.tsx`)

**Who uses it:** DGMs
**Purpose:** Book a visit date for a specific location in the current or future month

**How it works:**
- Choose a location (dropdown)
- Calendar shows which months already have visits (blocked with "VISITED" badge)
- If the selected month already has a visit, shows a warning with the existing visit date
- Choose a date within the selected month (any day, no time slot required)
- Optional notes field
- Submit creates a scheduled DGM verification record with `monthYear` set

---

### SCREEN 15: Admin — Compliance Dashboard (`AdmCompliance.tsx`)

**Who uses it:** Admins
**Purpose:** Single-page view of ALL locations' compliance status across all 3 tracks (submissions, controller visits, DGM visits)

**KPI Cards (6):**
1. Overall Compliance % (% of locations fully green on all 3 tracks)
2. Submitted Today (X of N locations)
3. Overdue >48h (count in red)
4. Variance Exceptions (locations with >5% variance today)
5. Controller Issues (locations with missed visits or overdue >14 days)
6. DGM Coverage (locations visited this month)

**Action Required Panel:**
- Appears automatically when there are issues
- Color-coded: red border = critical issues present, amber border = advisory only
- Lists every issue with the location name and exact problem
- Collapsible (show/hide button)
- Critical (red) items listed first: overdue approvals, rejected submissions, missed controller visits
- Advisory (amber) items: no submission today, controller >14d overdue, DGM not visited after day 20 of month, variance flag

**Location Status Table:**
- Sort: "Most Critical" (red first) or "A–Z"
- Per location shows:
  - Health badge (✓ Compliant / ⚠ At Risk / ✕ Non-Compliant)
  - Today's submission status + total + variance + 30-day stats
  - 30-day submission rate %
  - Last controller visit + days ago + DOW flag + next visit
  - DGM this month status + observed total

---

### SCREEN 16: Admin — Locations (`AdmLocations.tsx`)

**Who uses it:** Admins
**Purpose:** Full CRUD management of cashroom locations

**Table shows:** Code | Name | City | Expected Cash | Tolerance % | Status | Actions

**Add Location:**
- Click "+ Add Location" → a new blank row appears at the top of the table
- Fields: Name (text), City (text), Expected Cash ($), Tolerance % (number)
- Code is auto-generated by the system
- Save / Cancel buttons inline

**Edit Location:**
- Click "Edit" on any row → an expanded edit panel appears below that row
- Same fields as Add
- Save / Cancel

**Deactivate:**
- Click "Deactivate" → shows a red confirmation strip asking "Are you sure?"
- Confirm → location is soft-deleted (still exists in DB, just marked inactive)
- Inactive rows show at 60% opacity with "INACTIVE" badge
- Can be reactivated with the "Reactivate" button

**Validation:** Name required, City required, Expected Cash must be positive number, Tolerance 1–20%

**Pagination:** 10 rows per page

---

### SCREEN 17: Admin — Users (`AdmUsers.tsx`)

**Who uses it:** Admins
**Purpose:** Full CRUD management of user accounts

**Table shows:** Name | Email | Role | Locations | Status | Actions

**Add User:**
- Inline form row with: Name, Email, Role (dropdown), Location checkboxes (if non-admin role)
- Location assignment is required for Operator, Manager, Controller, DGM
- Admin and Auditor roles do not need location assignment (they see everything)

**Edit User:**
- Expands a row with same fields

**Deactivate / Reactivate:**
- Same soft-delete pattern as Locations

**Validation:** Name required, Email required (must contain @), Role required

**Role color-coding:** Each role shows a different badge color:
- Operator: blue | Manager: yellow | Controller: green | DGM: purple | Admin: dark | Auditor: orange

---

### SCREEN 18: Admin — Configuration (`AdmConfig.tsx`)

**Who uses it:** Admins
**Purpose:** Global system settings + per-location tolerance overrides

**Global Settings:**

| Setting | Default | Description |
|---|---|---|
| Imprest Amount | £9,575 | Fixed cash fund per location |
| Default Tolerance % | 5% | Variance % before note is required |
| Approval SLA | 48 hours | Time for manager to approve before "overdue" |
| DOW Lookback Window | 6 weeks | How far back to check for day-of-week patterns |
| Daily Reminder Time | 08:00 | When automated reminders are sent |
| Data Retention | 7 years | How long records are kept |

**Per-Location Overrides:**
- Table showing each location
- Override % column — admin can set a custom tolerance for a specific location
- Effective % = Override if set, else Global default
- ★ marker appears next to overridden values
- "Remove override" button resets to global

**Save:** One "Save All Changes" button at the bottom. Shows a success confirmation for 3 seconds.

---

### SCREEN 19: Admin — Audit Trail (`AdmAudit.tsx`)

**Who uses it:** Admins and Auditors
**Purpose:** Immutable, filterable log of EVERY action taken in the system

**Event types logged:**
- SUBMISSION_CREATED
- SUBMISSION_APPROVED
- SUBMISSION_REJECTED
- CONTROLLER_VERIFIED
- DGM_VERIFIED
- USER_CREATED
- CONFIG_CHANGED

**Filters (cascading — each filter narrows the next):**
1. Event Type dropdown → narrows Actor options
2. Actor dropdown → narrows Location options
3. Location dropdown
4. Date Range: All Time | Today | Last 7 Days | This Month | Custom (date pickers)

**Cascading behavior:**
- If "SUBMISSION_APPROVED" is selected, only actors who have approved submissions appear
- If both event type and actor are selected, only locations relevant to both appear
- Selecting a filter combination that makes a prior selection invalid auto-resets it

**Table columns:** Timestamp | Event (colored badge) | Actor | Location | Detail | Change (old → new value)

**Pagination:** 15 rows per page

---

### SCREEN 20: Admin — Reports (`AdmReports.tsx`)

**Who uses it:** Admins and Auditors
**Purpose:** Summary reports for a selected date range, with CSV export

**Date Range:**
- This Week | This Month | Custom (default: This Month)

**KPI Cards:**
- Total Submissions | Approval Rate % | Variance Exceptions | Avg Variance | Controller Visits | DGM Visits

**3 Report Tables:**

**Table 1 — Per-Location Summary (10 per page):**
- Columns: Location | Submissions | Approved | Rejected | Overdue | Avg Variance % | Exceptions

**Table 2 — Per-Actor Summary (10 per page):**
- Role filter chips: All Roles | Operator | Manager | Controller | DGM
- Columns vary by role:
  - Operators: Submissions | Approved | Rejected | Pending | Rate % | Avg Variance | Exceptions | Locations
  - Managers: Decisions | Approved | Rejected | Approval Rate % | Avg Variance of reviewed subs
  - Controllers: Verifications | Completed | Missed | Scheduled | Completion Rate %
  - DGMs: Verifications | Completed | Missed | Scheduled | Completion Rate %

**Table 3 — Variance Exceptions >5% (10 per page):**
- All submissions in the date range where |variance %| > 5%
- Columns: Date | Location | Operator | Total Cash | Variance | Status | Rejection Reason

**Export CSV button:** Downloads all three tables as a CSV file.

---

## 5. Backend Development Guide

### Where to Start

Build in this exact order. Each step depends on the previous:

```
Step 1: Project setup + database + auth     (3 days)
Step 2: Locations + Users APIs              (2 days)
Step 3: Submissions API + variance logic    (3 days)
Step 4: Approvals workflow                  (2 days)
Step 5: Verifications (Controller + DGM)   (2 days)
Step 6: Config + Audit trail               (1 day)
Step 7: Reports                             (1 day)
Step 8: Frontend integration               (3 days)
Step 9: Testing + deployment               (3 days)
```

---

### Step 1: Project Setup

**Create the backend folder structure:**

```
backend/
├── app/
│   ├── main.py           ← FastAPI app
│   ├── config.py         ← Settings from .env
│   ├── database.py       ← DB connection
│   ├── auth/
│   │   ├── jwt.py        ← Token creation/validation
│   │   └── dependencies.py ← Depends(get_current_user)
│   ├── models/           ← SQLAlchemy tables
│   ├── schemas/          ← Pydantic request/response models
│   ├── routers/          ← API routes
│   └── services/         ← Business logic (pure functions)
├── alembic/              ← Database migrations
├── tests/
├── requirements.txt
└── .env
```

**Install dependencies:**
```
fastapi, uvicorn, sqlalchemy, alembic, asyncpg,
psycopg2-binary, pyjwt, passlib[bcrypt], pydantic[email],
openpyxl, python-multipart
```

**Start the server:**
```bash
uvicorn app.main:app --reload --port 8000
```

---

### Step 2: Build Authentication First

The auth system gates everything else. Get this working before writing any other endpoint.

**POST /v1/auth/login**
```
Input:  { email: string, password: string }
Output: { access_token: string, token_type: "bearer", user: { id, name, role, locationIds[] } }
```

- Hash passwords with bcrypt on user creation
- JWT tokens expire in 24 hours
- Include `role`, `user_id`, `email` in the JWT payload
- Create a FastAPI dependency `get_current_user` that validates the JWT on every protected route

**Frontend integration point:**
In `App.tsx`, replace the mock login check with a call to `POST /v1/auth/login`. Store the token in memory (or httpOnly cookie). Pass it as `Authorization: Bearer <token>` on all subsequent requests.

---

### Step 3: Core Business Logic — Variance Calculation

Write this as a pure function with no database access. Test it thoroughly.

```python
# services/variance.py

SECTION_BILL_DENOMS = [100, 50, 20, 10, 5, 2, 1]
SECTION_COIN_DENOMS = [1.00, 0.50, 0.25, 0.10, 0.05, 0.01]
SECTION_BAG_VALUES  = [25, 10, 5, 2, 50]  # dollar bags, quarter bags, dime bags, nickel bags, bulkers

def calc_section_a(quantities: dict) -> Decimal:
    """Bills: sum of qty × denomination"""
    return sum(Decimal(str(quantities.get(str(d), 0))) * Decimal(str(d))
               for d in SECTION_BILL_DENOMS)

def calc_section_b(quantities: dict) -> Decimal:
    """Coins in machines: sum of qty × denomination"""
    return sum(Decimal(str(quantities.get(str(d), 0))) * Decimal(str(d))
               for d in SECTION_COIN_DENOMS)

# ... similar for C, D, E, F, G, H

def calc_section_i(shortage: Decimal, overage: Decimal) -> Decimal:
    """Net = overage - shortage"""
    return overage - shortage

def calc_total_fund(sections: dict) -> Decimal:
    return sum(sections[k] for k in ['a','b','c','d','e','f','g','h','i'])

def calc_variance(total_fund: Decimal, expected_cash: Decimal) -> tuple[Decimal, Decimal]:
    variance = total_fund - expected_cash
    variance_pct = (variance / expected_cash * 100) if expected_cash else Decimal(0)
    return variance, variance_pct

def requires_note(variance_pct: Decimal, tolerance_pct: Decimal) -> bool:
    return abs(variance_pct) > tolerance_pct
```

**Unit test reference values:**
The Sheboygan Excel template should produce $9,575.00 (or similar) with $0.00 variance. Your test should parse the template Excel and assert total = $9,575.00.

---

### Step 4: Submissions API

**The most important set of endpoints. Build these carefully.**

```
POST   /v1/submissions              Create new submission (operator)
GET    /v1/submissions              List submissions (with filters)
GET    /v1/submissions/{id}         Get one submission
PUT    /v1/submissions/{id}/draft   Update draft (before submitting)
POST   /v1/submissions/{id}/submit  Finalize draft → pending status
```

**POST /v1/submissions — create a new submission:**
```
Input: {
    location_id: string,
    submission_date: string (YYYY-MM-DD),
    sections: {
        a: { "100": 5, "50": 2, ... },
        b: { "1.00": 10, "0.50": 20, ... },
        ...
        i: { shortage: 0, overage: 0 }
    },
    variance_note: string | null
}

Business logic:
1. Check operator is assigned to this location → 403 if not
2. Check no approved/pending submission exists for this location+date → 409 if exists
3. Calculate section totals (call services/variance.py)
4. Calculate total_fund, variance, variance_pct
5. Check if variance_pct > tolerance → if yes AND no variance_note → 422 error
6. If variance_note provided but variance within tolerance → accept anyway (note is optional for within-tolerance)
7. Create submission with status='PENDING_APPROVAL'
8. Write SUBMISSION_CREATED audit event
9. Return created submission

Output: { id, status, total_cash, variance, variance_pct, submitted_at, ... }
```

**GET /v1/submissions — list with filters:**
```
Query params:
  location_id (optional)
  status (optional: draft|pending_approval|approved|rejected)
  date_from (optional: YYYY-MM-DD)
  date_to (optional: YYYY-MM-DD)
  operator_id (optional — admin only)

Role rules:
  Operator: can only see their own submissions for their locations
  Manager:  can see all submissions for their assigned locations
  Admin:    can see all submissions
```

**Frontend integration — OpStart.tsx:**
Replace `SUBMISSIONS.filter(s => s.locationId === locationId)` with `GET /v1/submissions?location_id=X&date_from=Y&date_to=Z`

---

### Step 5: Approval Workflow

**Manager approves or rejects a submission.**

```
POST /v1/submissions/{id}/approve
POST /v1/submissions/{id}/reject
```

**POST /v1/submissions/{id}/approve:**
```
Input:  { notes?: string }

Business logic:
1. Check caller has role MANAGER
2. Check submission exists and is in PENDING_APPROVAL status → 409 if not
3. Check manager is assigned to the submission's location → 403 if not
4. Update submission: status='APPROVED', approved_by=current_user_id, approved_at=now()
5. Write SUBMISSION_APPROVED audit event
6. (Future v2: send email notification to operator)

Output: updated submission
```

**POST /v1/submissions/{id}/reject:**
```
Input:  { reason: string }  ← reason is required for rejection

Business logic:
1. All same checks as approve
2. Reason must not be empty → 422 if empty
3. Update submission: status='REJECTED', rejection_reason=reason, approved_by=current_user_id
4. Write SUBMISSION_REJECTED audit event
5. (Future v2: send email notification to operator)
```

**Frontend integration — OpReadonly.tsx (manager mode):**
Replace the local `setLocalAction` state with API calls to approve/reject endpoints.

---

### Step 6: Verifications API

**Controller and DGM visit scheduling and logging.**

```
POST /v1/verifications/controller           Schedule a visit
GET  /v1/verifications/controller           List controller verifications
GET  /v1/verifications/controller/check-dow Check day-of-week pattern for a date
POST /v1/verifications/dgm                  Schedule DGM visit
GET  /v1/verifications/dgm                  List DGM verifications
```

**GET /v1/verifications/controller/check-dow:**
```
Query params: location_id, date (YYYY-MM-DD)

Business logic:
1. Get day-of-week of the proposed date (0=Monday ... 6=Sunday)
2. Look back config.dow_lookback_weeks (default 6) weeks from the proposed date
3. Query completed controller verifications for this location in that window
4. Filter to verifications that happened on the same day of week
5. If any found: return { warning: true, previous_dates: [...], day_name: "Tuesday" }
6. If none: return { warning: false }

This endpoint is called LIVE as the controller changes the date in CtrlLog.tsx
```

**POST /v1/verifications/controller:**
```
Input: {
    location_id: string,
    date: string (YYYY-MM-DD),
    scheduled_time: string (HH:MM),
    dow_warning_acknowledged: boolean,
    dow_reason: string | null,
    notes: string | null
}

Business logic:
1. Date must be in the future (tomorrow+)
2. Check no other SCHEDULED verification exists for this location on this date
3. Create verification: type='CONTROLLER', status='SCHEDULED', warning_flag=dow_warning_acknowledged
4. Write CONTROLLER_VERIFIED audit event
```

**POST /v1/verifications/dgm:**
```
Input: {
    location_id: string,
    date: string (YYYY-MM-DD),
    notes: string | null
}

Business logic:
1. Compute month_year from date (e.g., "2026-02")
2. Check no DGM verification exists for this location + month_year
   → If exists: 409 "Already visited this location this month"
3. Create verification: type='DGM', status='SCHEDULED', month_year='2026-02'
4. Write DGM_VERIFIED audit event
```

---

### Step 7: Admin APIs

```
GET    /v1/admin/locations         List all locations
POST   /v1/admin/locations         Create location
PUT    /v1/admin/locations/{id}    Update location
DELETE /v1/admin/locations/{id}    Soft-delete (sets active=false)

GET    /v1/admin/users             List all users
POST   /v1/admin/users             Create user
PUT    /v1/admin/users/{id}        Update user
DELETE /v1/admin/users/{id}        Soft-delete user

GET    /v1/admin/config            Get global config + per-location overrides
PUT    /v1/admin/config            Update global config
PUT    /v1/admin/config/locations/{id}   Set per-location tolerance override
DELETE /v1/admin/config/locations/{id}   Remove per-location override
```

**All Admin endpoints require role = ADMIN.**

---

### Step 8: Audit Trail API

```
GET /v1/audit    Paginated audit trail
```

**Query params:** event_type | actor_id | location_id | date_from | date_to | page | page_size (default 15)

**Every state-changing API endpoint must write an audit event.** The audit service should be called at the end of every POST/PUT/DELETE handler.

```python
# services/audit.py
async def log_event(db, event_type: str, actor_id: str, location_id: str | None,
                    entity_id: str, detail: str, old_value=None, new_value=None):
    event = AuditEvent(
        event_type=event_type,
        actor_id=actor_id,
        location_id=location_id,
        entity_id=entity_id,
        detail=detail,
        old_value=old_value,
        new_value=new_value,
        created_at=datetime.utcnow()
    )
    db.add(event)
    await db.commit()
```

---

### Step 9: Reports API

```
GET /v1/reports/summary    Summary KPIs for a date range
GET /v1/reports/locations  Per-location breakdown
GET /v1/reports/actors     Per-actor breakdown
GET /v1/reports/exceptions Variance exceptions list
GET /v1/reports/export     Download CSV
```

These are all read-only aggregation queries. Build them last — they depend on all other tables being populated.

---

### Step 10: Frontend Integration

**Pattern for replacing mock data:**

Each frontend screen currently imports from `../../mock/data` and filters arrays.
Replace these with `useEffect` + `fetch` (or `axios`) calls to the API.

**Example — converting OpStart.tsx:**

```typescript
// BEFORE (mock):
const subs = SUBMISSIONS.filter(s => s.locationId === locationId)

// AFTER (real API):
const [subs, setSubs] = useState<Submission[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
    fetch(`/api/v1/submissions?location_id=${locationId}&date_from=${thirtyDaysAgo}&date_to=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => { setSubs(data.items); setLoading(false) })
}, [locationId])
```

**Do this screen by screen, testing each one before moving to the next.**

---

## 6. Database Schema

```sql
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('OPERATOR', 'MANAGER', 'CONTROLLER', 'DGM', 'ADMIN', 'AUDITOR');
CREATE TYPE submission_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');
CREATE TYPE submission_source AS ENUM ('FORM', 'CHAT', 'EXCEL_UPLOAD');
CREATE TYPE verification_type AS ENUM ('CONTROLLER', 'DGM');
CREATE TYPE verification_status AS ENUM ('SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED');
CREATE TYPE event_type AS ENUM (
    'SUBMISSION_CREATED', 'SUBMISSION_APPROVED', 'SUBMISSION_REJECTED',
    'CONTROLLER_VERIFIED', 'DGM_VERIFIED', 'USER_CREATED', 'CONFIG_CHANGED',
    'LOCATION_CREATED', 'LOCATION_UPDATED', 'USER_UPDATED', 'MISSED_SUBMISSION_LOGGED'
);

-- ============================================================
-- LOCATIONS
-- ============================================================
CREATE TABLE locations (
    id              VARCHAR(20) PRIMARY KEY,          -- e.g., LHR-T5-01
    name            VARCHAR(200) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    expected_cash   NUMERIC(12,2) NOT NULL DEFAULT 9575.00,
    tolerance_pct   NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    sla_hours       INTEGER NOT NULL DEFAULT 48,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role            user_role NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many-to-many: users assigned to locations
CREATE TABLE user_locations (
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    location_id     VARCHAR(20) REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, location_id)
);

-- ============================================================
-- SUBMISSIONS
-- ============================================================
CREATE TABLE submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id         VARCHAR(20) NOT NULL REFERENCES locations(id),
    operator_id         UUID NOT NULL REFERENCES users(id),
    submission_date     DATE NOT NULL,
    status              submission_status NOT NULL DEFAULT 'DRAFT',
    source              submission_source NOT NULL DEFAULT 'FORM',
    total_cash          NUMERIC(12,2),
    expected_cash       NUMERIC(12,2),          -- snapshot at submission time
    variance            NUMERIC(12,2),          -- total_cash - expected_cash
    variance_pct        NUMERIC(8,4),           -- (variance / expected_cash) * 100
    variance_note       TEXT,                   -- required if |variance_pct| > tolerance
    variance_exception  BOOLEAN NOT NULL DEFAULT FALSE,   -- true if |variance_pct| > tolerance
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    submitted_at        TIMESTAMPTZ,
    excel_filename      VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (location_id, submission_date)       -- one per location per day
);

-- Individual section totals + denomination breakdown
CREATE TABLE submission_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    section_code    CHAR(1) NOT NULL CHECK (section_code IN ('A','B','C','D','E','F','G','H','I')),
    section_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
    denominations   JSONB,                      -- { "100": 5, "50": 2, ... }
    UNIQUE (submission_id, section_code)
);

-- ============================================================
-- MISSED SUBMISSION EXPLANATIONS
-- ============================================================
CREATE TABLE missed_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     VARCHAR(20) NOT NULL REFERENCES locations(id),
    operator_id     UUID NOT NULL REFERENCES users(id),
    missed_date     DATE NOT NULL,
    reason          VARCHAR(50) NOT NULL,
    detail          TEXT NOT NULL,
    supervisor_name VARCHAR(200) NOT NULL,
    logged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (location_id, missed_date)
);

-- ============================================================
-- VERIFICATIONS (Controller + DGM)
-- ============================================================
CREATE TABLE verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id         VARCHAR(20) NOT NULL REFERENCES locations(id),
    verifier_id         UUID NOT NULL REFERENCES users(id),
    verification_type   verification_type NOT NULL,
    status              verification_status NOT NULL DEFAULT 'SCHEDULED',
    verification_date   DATE NOT NULL,
    month_year          CHAR(7),                -- 'YYYY-MM', populated for DGM visits
    scheduled_time      CHAR(5),                -- 'HH:MM', populated for controller visits
    day_of_week         SMALLINT,               -- 0=Monday, 6=Sunday
    warning_flag        BOOLEAN NOT NULL DEFAULT FALSE,
    warning_reason      TEXT,
    observed_total      NUMERIC(12,2),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- DGM: one per location per month
    UNIQUE (location_id, month_year, verification_type)
    -- Note: This constraint only blocks DGM duplicates (month_year is null for controller visits)
);

-- ============================================================
-- SYSTEM CONFIG
-- ============================================================
CREATE TABLE system_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  UUID REFERENCES users(id)
);

-- Per-location tolerance overrides
CREATE TABLE location_config_overrides (
    location_id     VARCHAR(20) REFERENCES locations(id) ON DELETE CASCADE,
    tolerance_pct   NUMERIC(5,2) NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (location_id)
);

-- ============================================================
-- AUDIT TRAIL
-- ============================================================
CREATE TABLE audit_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  event_type NOT NULL,
    actor_id    UUID REFERENCES users(id),
    actor_name  VARCHAR(200),               -- snapshot (in case user is deleted)
    location_id VARCHAR(20) REFERENCES locations(id),
    entity_id   UUID,
    entity_type VARCHAR(50),
    detail      TEXT NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_submissions_location_date  ON submissions(location_id, submission_date DESC);
CREATE INDEX idx_submissions_status         ON submissions(status, submitted_at DESC);
CREATE INDEX idx_submissions_operator       ON submissions(operator_id, submission_date DESC);
CREATE INDEX idx_verifications_loc_type     ON verifications(location_id, verification_type, verification_date DESC);
CREATE INDEX idx_verifications_month        ON verifications(location_id, month_year);
CREATE INDEX idx_audit_actor               ON audit_events(actor_id, created_at DESC);
CREATE INDEX idx_audit_location            ON audit_events(location_id, created_at DESC);
CREATE INDEX idx_audit_event_type          ON audit_events(event_type, created_at DESC);
```

---

## 7. API Endpoints Reference

### Authentication
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /v1/auth/login | Public | Login, get JWT |
| POST | /v1/auth/refresh | Authenticated | Refresh token |
| GET | /v1/auth/me | Authenticated | Get current user info |

### Submissions
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /v1/submissions | Operator | Create/save draft |
| GET | /v1/submissions | Op/Mgr/Admin | List with filters |
| GET | /v1/submissions/{id} | Op/Mgr/Admin | Get single |
| PUT | /v1/submissions/{id} | Operator | Update draft |
| POST | /v1/submissions/{id}/approve | Manager | Approve |
| POST | /v1/submissions/{id}/reject | Manager | Reject with reason |
| POST | /v1/missed-submissions | Operator | Log missed day explanation |

### Verifications
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /v1/verifications/controller | Controller | Schedule controller visit |
| GET | /v1/verifications/controller | Controller/Admin | List controller verifications |
| GET | /v1/verifications/controller/check-dow | Controller | Check DOW pattern for a date |
| POST | /v1/verifications/dgm | DGM | Schedule DGM visit |
| GET | /v1/verifications/dgm | DGM/Admin | List DGM verifications |

### Admin
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /v1/admin/locations | Admin | List all locations |
| POST | /v1/admin/locations | Admin | Create location |
| PUT | /v1/admin/locations/{id} | Admin | Update location |
| DELETE | /v1/admin/locations/{id} | Admin | Soft-delete location |
| GET | /v1/admin/users | Admin | List all users |
| POST | /v1/admin/users | Admin | Create user |
| PUT | /v1/admin/users/{id} | Admin | Update user |
| DELETE | /v1/admin/users/{id} | Admin | Soft-delete user |
| GET | /v1/admin/config | Admin | Get config |
| PUT | /v1/admin/config | Admin | Update global config |
| PUT | /v1/admin/config/locations/{id} | Admin | Set per-location override |
| DELETE | /v1/admin/config/locations/{id} | Admin | Remove override |

### Reports & Audit
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /v1/audit | Admin/Auditor | Paginated audit trail |
| GET | /v1/reports/summary | Admin/Auditor | KPI summary for date range |
| GET | /v1/reports/locations | Admin/Auditor | Per-location breakdown |
| GET | /v1/reports/actors | Admin/Auditor | Per-actor breakdown |
| GET | /v1/reports/exceptions | Admin/Auditor | Variance exceptions |
| GET | /v1/reports/export | Admin/Auditor | CSV download |
| GET | /health | Public | Health check |

---

## 8. Deployment Guide

### Local Development

```bash
# 1. Start PostgreSQL (using Docker):
docker run -d --name ccs-db -e POSTGRES_PASSWORD=ccs -e POSTGRES_DB=ccs -p 5432:5432 postgres:16

# 2. Start backend:
cd backend
pip install -r requirements.txt
alembic upgrade head          # Create tables
python -m uvicorn app.main:app --reload --port 8000

# 3. Start frontend:
cd frontend
npm install
npm run dev                   # Runs on port 5173

# 4. API docs available at: http://localhost:8000/docs
```

### Environment Variables (backend .env)

```env
DATABASE_URL=postgresql+asyncpg://postgres:ccs@localhost:5432/ccs
SECRET_KEY=change-this-to-a-random-64-char-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Production Deployment (AWS)

| Service | Purpose | Notes |
|---|---|---|
| AWS ECS Fargate | Run FastAPI backend | Dockerized, no server management |
| Amazon RDS PostgreSQL | Database | db.t4g.micro ~$15/month |
| Amazon S3 | Excel file uploads, signed docs | SSE-S3 encryption |
| Amazon SES | Email notifications (v2) | Submit production access request early |
| AWS Amplify | Host React frontend | Auto-deploy from Git |
| CloudFront | CDN for frontend | Included with Amplify |
| ALB | Load balancer for backend | Health checks via /health |
| ACM | SSL certificate | Free with AWS |

### Dockerfile (backend)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 9. Manual Test Cases — All Screens

**How to use this section:**
Run through each test case in order. Mark Pass ✓ or Fail ✗. For Fail, note the actual result.

**Test environment setup:**
1. Login as each role using the demo accounts
2. Have at least 3 locations and 1 user per role configured
3. Ensure today has no submission for the operator's location (for submit tests)

---

### TC-001 to TC-010: Login Screen

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-001 | Valid login — Operator | Enter operator@compass.com / demo1234, click Login | Redirected to Operator Dashboard. Sidebar shows operator's location name. |
| TC-002 | Valid login — Manager | Enter manager@compass.com / demo1234 | Redirected to Pending Approvals. Sidebar shows "Manager" role. |
| TC-003 | Valid login — Controller | Enter controller@compass.com / demo1234 | Redirected to Schedule Visit screen. |
| TC-004 | Valid login — DGM | Enter dgm@compass.com / demo1234 | Redirected to DGM Monthly Dashboard. |
| TC-005 | Valid login — Admin | Enter admin@compass.com / demo1234 | Redirected to Compliance Dashboard. Sidebar shows all 6 admin nav items. |
| TC-006 | Valid login — Auditor | Enter auditor@compass.com / demo1234 | Redirected to Reports screen. Sidebar shows only Reports and Audit Trail. |
| TC-007 | Wrong password | Enter operator@compass.com / wrongpassword | Error message: "Invalid email or password". Form stays on screen. |
| TC-008 | Empty email | Click Login with empty email field | Inline validation: "Email is required". No API call made. |
| TC-009 | Empty password | Enter email, leave password empty, click Login | Inline validation: "Password is required". |
| TC-010 | Non-existent email | Enter nobody@compass.com / demo1234 | Error message: "Invalid email or password". |

---

### TC-011 to TC-025: Operator Dashboard (OpStart)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-011 | Dashboard loads with today's status | Login as operator | Today's Status card shows correct state for today (submitted/not submitted/pending/approved) |
| TC-012 | No submission today — Submit button appears | Login when today has no submission | Status card shows amber "Not yet submitted" with "Submit Today's Count" button |
| TC-013 | Submit Now navigates correctly | Click "Submit Today's Count" | Navigates to OpMethod screen. Location and today's date are pre-filled (not selectable). |
| TC-014 | Today submitted + pending — shows correct state | After submitting (before approval) | Status card shows amber "Pending Approval" with submission total and variance |
| TC-015 | Today submitted + approved — shows green | After manager approves | Status card shows green "Approved" with tick |
| TC-016 | Today rejected — shows resubmit button | After manager rejects | Status card shows red "Rejected" with rejection reason and "Resubmit" button |
| TC-017 | Filter "Pending" chip | Click "Pending" chip | Table shows only pending submissions. Chip count matches row count. |
| TC-018 | Filter "Missing" chip | Click "Missing" chip | Table shows only dates with no submission. Each row shows "Missing" badge. |
| TC-019 | Filter "Rejected" chip | Click "Rejected" chip | Table shows only rejected submissions. |
| TC-020 | Filter "Approved" chip | Click "Approved" chip | Table shows only approved submissions. |
| TC-021 | Filter "All" resets | Click any filter, then click "All" | All 30 days shown again. |
| TC-022 | Click approved row | Click an approved submission row | Navigates to OpReadonly showing full submission details (read-only, no action buttons for operator) |
| TC-023 | Click missing row | Click a "Missing" row | Navigates to OpMissed screen with that date pre-filled |
| TC-024 | Pagination works | When more than 10 rows exist | Pagination controls appear. Clicking "Next" shows next 10. Page number highlighted. |
| TC-025 | Jump to date | Enter a specific past date in the date picker | Table scrolls/jumps to that date or filters to show that row |

---

### TC-026 to TC-030: Choose Entry Method (OpMethod)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-026 | Three method cards shown | Navigate to OpMethod | Three cards: Digital Form, Guided Chat, Excel Upload — all visible |
| TC-027 | Location and date displayed | After clicking "Submit Today's Count" | Header shows location name and today's date — neither is editable |
| TC-028 | Select Digital Form | Click "Digital Form" card | Navigates to OpForm with location and date in context |
| TC-029 | Select Guided Chat | Click "Guided Chat" card | Navigates to OpChat with location and date in context |
| TC-030 | Select Excel Upload | Click "Excel Upload" card | Navigates to OpExcel with location and date in context |

---

### TC-031 to TC-050: Digital Cash Form (OpForm)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-031 | Form loads with all sections | Navigate to OpForm | Sections A through I all visible. All inputs blank/zero. Running total bar shows $0. |
| TC-032 | Section A bill entry | Enter 5 in the $100 bill quantity box | Section A total updates to $500. Total Fund bar updates live. |
| TC-033 | Section B coin entry | Enter 20 in the $0.25 coin quantity box | Section B total updates to $5.00. Total Fund updates. |
| TC-034 | Section D changer funds — multiple rows | Enter qty=2, amount=50 in first row | Row total = $100. Section D total = $100. |
| TC-035 | Section I net calculation | Enter shortage $50, overage $20 | Section I net = -$30 (overage minus shortage). Total Fund decreases. |
| TC-036 | Running total bar — green variance | Enter values summing to exactly $9,575 | Variance shows $0.00 (0.00%). Bar color is green. |
| TC-037 | Running total bar — amber variance | Enter values totaling $9,700 | Variance shows +$125 (+1.31%). Bar color is amber (between 2-5%). |
| TC-038 | Running total bar — red variance | Enter values totaling $10,200 | Variance shows +$625 (+6.53%). Bar color is red. |
| TC-039 | Variance note appears when exceeded | Enter values creating >5% variance | A yellow warning appears: "Variance exceeds 5% tolerance. Explanation required." A text area appears. |
| TC-040 | Cannot submit without variance note | With >5% variance, click Submit without filling note | Error: "Variance explanation is required". Form does not submit. |
| TC-041 | Submit with variance note | Enter >5% variance + fill note, click Submit | Submission created with status "Pending". Navigates to OpReadonly. |
| TC-042 | Submit with zero variance | Enter exact imprest amount, click Submit | Submission created. No note required. Navigates to OpReadonly. |
| TC-043 | Submit with within-tolerance variance | Enter values within 5% of imprest | No note required. Can submit directly. |
| TC-044 | Save Draft | Partially fill form, click "Save Draft" | "Draft saved" confirmation. Navigate back to dashboard — draft card appears. |
| TC-045 | Resume Draft | From dashboard, click "Resume Draft" | OpForm opens with previously entered values pre-filled |
| TC-046 | Negative quantity prevented | Enter -5 in any quantity field | Field shows 0 or rejects input. Error message shown. |
| TC-047 | Duplicate date submission blocked | Try to submit for a date that already has an approved submission | Error: "A submission already exists for this date" |
| TC-048 | Section completion dots | Fill Section A then Section B | Dots 1 and 2 in the sticky bar fill in / change color |
| TC-049 | Empty form cannot be submitted | Click Submit with all fields at zero | Error: "Please enter at least one cash value" |
| TC-050 | Variance note cleared when back in tolerance | Enter high variance, then reduce to within 5% | Variance note field hides. Submit enabled without note. |

---

### TC-051 to TC-060: Guided Chat Entry (OpChat)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-051 | Chat starts with welcome message | Navigate to OpChat | Welcome message shown with instructions. First denomination prompt appears. |
| TC-052 | Enter a denomination count | Type "5" when asked for $100 bills | System shows "Got it: $500" and moves to next denomination |
| TC-053 | Enter zero for a denomination | Type "0" for a denomination | System accepts 0 and moves to next prompt |
| TC-054 | Running total updates after each entry | Enter counts for first 3 denominations | Sidebar total increases correctly after each entry |
| TC-055 | Invalid input rejected | Type "abc" in the count field | Error message: "Please enter a number". Same prompt shown again. |
| TC-056 | All 19 denominations complete | Answer all prompts | Summary screen appears showing all entered values and total fund |
| TC-057 | Submit from chat | On summary screen, click Submit | Submission created. Navigate to OpReadonly. |
| TC-058 | Variance warning in chat | Enter values creating >5% variance | Summary screen shows red variance warning and requires explanation before submitting |
| TC-059 | Back navigation between steps | Click back arrow on any step | Returns to previous denomination with prior answer pre-filled |
| TC-060 | Progress indicator | Move through chat steps | Progress bar or step count shows current position (e.g., "Step 5 of 19") |

---

### TC-061 to TC-070: Excel Upload (OpExcel)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-061 | Upload zone visible | Navigate to OpExcel | Drag-and-drop zone with cloud icon and instructions visible |
| TC-062 | Demo file button works | Click "Use Demo File" | Parsed results table appears with pre-populated section totals |
| TC-063 | Upload valid .xlsx file | Drag a valid Sheboygan-format .xlsx onto the zone | "Parsing..." spinner, then results table shows section totals |
| TC-064 | Upload invalid file type | Drag a .pdf onto the drop zone | Error: "Only .xlsx or .xls files are accepted" |
| TC-065 | Wrong Excel format | Upload an Excel file not in Sheboygan format | Error: "Could not parse this file. Please use the standard template." |
| TC-066 | Parsed totals displayed | After successful upload | Table shows Section A total, B total, ..., I total, grand total, variance |
| TC-067 | High variance requires note | Upload file with >5% variance | Note textarea appears below the results table |
| TC-068 | Submit after upload | After parsing, click Submit | Submission created with source='EXCEL_UPLOAD'. Navigate to OpReadonly. |
| TC-069 | Re-upload different file | After first upload, drag a new file | Results table updates with new file's data. Old data cleared. |
| TC-070 | Cancel upload | Click Cancel | Navigate back to OpMethod |

---

### TC-071 to TC-080: View Submission — Operator (OpReadonly)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-071 | Submission details shown | Open a submitted submission | Location, date, status, total cash, imprest, variance, variance % all shown |
| TC-072 | Section breakdown table | Open any submission | Sections A–I all shown with individual totals and grand total |
| TC-073 | Approved submission — read only | Open an approved submission as operator | No action buttons. "Approved by [name] on [date]" shown. |
| TC-074 | Rejected submission — resubmit button | Open a rejected submission as operator | Red "Rejected" badge. Rejection reason shown. "Resubmit" button visible. |
| TC-075 | Resubmit navigates correctly | Click "Resubmit" on rejected submission | Navigate to OpMethod with same location and date |
| TC-076 | Pending submission — no actions for operator | Open a pending submission as operator | "Pending Approval" badge. No action buttons. Shows submission timestamp. |
| TC-077 | Variance note shown | Open a submission that has a variance note | Variance explanation note displayed in a styled block |
| TC-078 | Variance exception flag shown | Open a submission with >5% variance | Red "Variance Exception" badge visible |
| TC-079 | Back button works | Click "← Back" | Returns to Operator Dashboard |
| TC-080 | Correct data for Excel upload source | Open a submission made via Excel upload | Source badge says "Excel Upload" |

---

### TC-081 to TC-090: Manager Approval Mode (OpReadonly in manager mode)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-081 | Manager sees action buttons | Open a pending submission as manager | "Approve" (green) and "Reject" (red) buttons visible |
| TC-082 | Approve a submission | Click "Approve" | Status changes to "Approved". Success confirmation shown. |
| TC-083 | Reject requires a reason | Click "Reject" without entering reason, click Confirm | Error: "Rejection reason is required". Does not reject. |
| TC-084 | Reject with reason | Click "Reject", enter reason, click Confirm | Status changes to "Rejected". Reason saved. Success confirmation. |
| TC-085 | Already approved — no buttons | Open an approved submission as manager | No action buttons. "Approved" status shown. |
| TC-086 | Already rejected — no buttons | Open a rejected submission as manager | No action buttons. "Rejected" status and reason shown. |
| TC-087 | Manager can only see assigned locations | Log in as manager, check submissions list | Only submissions from locations assigned to this manager visible |
| TC-088 | Approve updates dashboard | Approve a submission, go to MgrApprovals | Approved submission no longer in "Pending" filter |
| TC-089 | Overdue flag visible | View a pending submission >48h old | "OVERDUE" badge in red visible next to the status |
| TC-090 | Variance details shown to manager | Manager reviews submission with high variance | Full variance note displayed for manager to review before approving |

---

### TC-091 to TC-098: Missed Submission Explanation (OpMissed)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-091 | Date pre-filled | Navigate to OpMissed from a Missing row | The missed date is shown and cannot be changed |
| TC-092 | Reason dropdown required | Click Submit with no reason selected | Error: "Please select a reason" |
| TC-093 | Detail required | Select a reason, leave detail blank, click Submit | Error: "Please provide details" |
| TC-094 | Supervisor name required | Fill reason + detail, leave supervisor blank | Error: "Supervisor/manager name is required" |
| TC-095 | Short detail rejected | Enter only 5 characters in detail | Error: "Please provide more detail (minimum 20 characters)" |
| TC-096 | Valid submission succeeds | Fill all fields correctly, click Submit | Success modal: "Explanation logged". Options to go back to dashboard. |
| TC-097 | Cannot log for today | Try to access OpMissed for today's date | Either blocked at navigation level, or form shows error (missed explanation is for past dates only) |
| TC-098 | Cannot log if submission exists | Try to navigate to OpMissed for a date with a submission | Either blocked, or form shows "A submission already exists for this date" |

---

### TC-099 to TC-112: Pending Approvals — Manager (MgrApprovals)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-099 | KPIs correct | Login as manager | "Awaiting Approval" count matches pending submissions in table |
| TC-100 | Overdue KPI turns red | Have 1+ submission pending >48h | KPI card background turns red. Count shown in red. |
| TC-101 | Filter by Location | Select a specific location from dropdown | Table shows only submissions for that location |
| TC-102 | Filter by Status — Pending | Click "Pending" chip | Only pending submissions shown |
| TC-103 | Filter by Status — Approved | Click "Approved" chip | Only approved submissions shown |
| TC-104 | Filter by Status — Rejected | Click "Rejected" chip | Only rejected submissions shown |
| TC-105 | Date range — Last 7 days | Click "Last 7 days" | Only submissions in last 7 days shown |
| TC-106 | Date range — Last 30 days | Click "Last 30 days" | Submissions from last 30 days shown |
| TC-107 | Inline approve | Click "Approve" button on a pending row | Row status badge changes to "Approved" immediately |
| TC-108 | Inline reject — reason required | Click "Reject" on a row, click Confirm without reason | Error shown inline. No rejection. |
| TC-109 | Inline reject — with reason | Click "Reject", enter reason, click Confirm | Row status badge changes to "Rejected". |
| TC-110 | View submission | Click "View" on any row | Navigates to OpReadonly in manager mode with action buttons |
| TC-111 | Overdue row highlighted | A pending submission >48h old exists | That row has red background or "OVERDUE" badge |
| TC-112 | Pagination | More than 10 submissions exist | Pagination controls appear and work |

---

### TC-113 to TC-118: Approval History — Manager (MgrHistory)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-113 | History shows only actioned | Login as manager, go to History | Only Approved and Rejected submissions visible (no pending) |
| TC-114 | KPIs calculated correctly | View history | Approval % = (approved / total) × 100. Shown correctly. |
| TC-115 | Filter by 7 days | Click "Last 7 days" | Only decisions made in last 7 days shown |
| TC-116 | Rejection reason shown | View a rejected submission in history | Rejection reason excerpt shown in the table row |
| TC-117 | Filter Approved only | Click "Approved" chip | Only approved submissions shown |
| TC-118 | Filter Rejected only | Click "Rejected" chip | Only rejected submissions shown |

---

### TC-119 to TC-135: Schedule Controller Visit (CtrlLog)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-119 | Location dropdown loads | Navigate to CtrlLog | Dropdown shows all locations assigned to this controller |
| TC-120 | Calendar shows current month | Navigate to CtrlLog | Calendar default shows current month |
| TC-121 | Cannot select past dates | Click on any past date in the calendar | Date not selectable (grayed out, no response to click) |
| TC-122 | Cannot select today | Click on today | Not selectable — must be future dates only |
| TC-123 | Select valid future date | Click on tomorrow or later | Date becomes selected (highlighted). Time slot panel appears. |
| TC-124 | Already booked date blocked | Try to select a date already booked for this location | Date shows green dot. On click, shows "Already booked for this location" error. |
| TC-125 | DOW warning shown | Select a date on the same weekday as a recent visit | Amber warning panel appears: "You visited on [day] on [date]. Consider a different day." |
| TC-126 | DOW warning requires reason | With DOW warning, click Submit without selecting reason | Error: "Please select a reason for visiting on the same day of week" |
| TC-127 | DOW warning acknowledged + reason | With DOW warning, select reason, click Submit | Verification created with warning_flag=true and reason recorded |
| TC-128 | No DOW warning for different weekday | Select date on different weekday | No warning shown. Can proceed without reason. |
| TC-129 | Time slot required | Select date, skip time slot, click Submit | Error: "Please select a time slot" |
| TC-130 | Select 09:00 time slot | Click 09:00, click Submit | Visit booked for 09:00 |
| TC-131 | Valid booking success | Select date + time + no warning, click Submit | Success confirmation screen. Shows "Visit scheduled for [location] on [date] at [time]" |
| TC-132 | Month navigation | Click ">" to go to next month | Calendar shows next month. Past months not navigable to (or past days disabled) |
| TC-133 | Notes field optional | Submit without filling Notes | Verification created with no notes. Succeeds. |
| TC-134 | Notes saved | Fill Notes field and submit | Notes saved with the verification record |
| TC-135 | Back from CtrlLog | Click Cancel or Back | Navigate back to controller dashboard without creating a record |

---

### TC-136 to TC-142: Controller Verification History (CtrlHistory)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-136 | History table loads | Navigate to CtrlHistory | All past verifications for this controller shown |
| TC-137 | Columns correct | View any row | Date, Day-of-week badge, Location, Observed Total, vs Imprest, Variance %, Warning Flag, Notes |
| TC-138 | DOW warning flagged | View a verification with warning_flag=true | Warning badge or icon shown on that row |
| TC-139 | Filter by location | Select a location from filter dropdown | Only verifications for that location shown |
| TC-140 | KPIs calculated correctly | View the KPI cards | "Total Verified" = row count. "This Month" = count for current calendar month. |
| TC-141 | Avg gap correct | Check "Avg Visit Gap" KPI | Correct average number of days between consecutive visits |
| TC-142 | Pagination | More than 10 verifications exist | Pagination controls appear |

---

### TC-143 to TC-158: DGM Monthly Dashboard (DgmDash)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-143 | Matrix loads | Navigate to DgmDash | Grid shows months as columns, locations as rows |
| TC-144 | Visited cell shows green | Click on a month where DGM visited | Cell shows ✅ in green |
| TC-145 | Unvisited current/past month shows amber | Current month not yet visited | Cell shows ⏳ in amber |
| TC-146 | Overdue shows red | Past month where no visit occurred | Cell shows 🔴 in red |
| TC-147 | Future month shows gray | Any month in the future | Cell shows — in gray, not clickable |
| TC-148 | Click visited cell — detail panel | Click a green (visited) cell | Detail panel appears below matrix: Date, Observed Total, Variance, Notes |
| TC-149 | Click pending/overdue cell | Click an amber or red cell | Action strip appears with "Schedule Visit" button |
| TC-150 | Click Schedule Visit from matrix | Click pending cell → "Schedule Visit" | Navigates to DgmLog with that location and month pre-selected |
| TC-151 | Year selector | Click previous year | Matrix updates to show that year's data |
| TC-152 | KPIs correct | View KPI cards | "Visited this month" count matches green cells in current month column |
| TC-153 | History table filter — location | Select a location from dropdown | Only rows for that location shown in history table |
| TC-154 | History table filter — year | Select a year | Only visits from that year shown |
| TC-155 | History table filter — month | Select March | Only March visits shown |
| TC-156 | History table filter — variance band | Select "Over tolerance" | Only visits where DGM observed variance > tolerance |
| TC-157 | Clear all filters | Click "Clear all" | All history rows shown again |
| TC-158 | Pagination in history table | More than 10 verifications | Pagination controls appear |

---

### TC-159 to TC-168: Log DGM Visit (DgmLog)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-159 | Location dropdown loads | Navigate to DgmLog | All locations in this DGM's area shown |
| TC-160 | Already visited month blocked | Select location that has a visit this month | Month shown with "VISITED" banner. Cannot select another date in that month. |
| TC-161 | Select valid date | Select a location + a date in an unvisited month | Date highlights. Submit button activates. |
| TC-162 | Cannot select future month if current not done | Attempt to book next month before current month | No restriction — DGM can book future months |
| TC-163 | Notes field optional | Submit without notes | Visit created. No error. |
| TC-164 | Submit creates DGM visit | Fill form, click Submit | Verification created with type='DGM', monthYear set. |
| TC-165 | Success confirmation | After submitting | Confirmation shown: "Visit scheduled for [location] on [date]" |
| TC-166 | Navigate back | Click Cancel/Back | Return to DgmDash without creating a record |
| TC-167 | Duplicate month blocked | Try to create second visit for already-visited location + month | Error: "Already visited this location this month" |
| TC-168 | Calendar month navigation | Click next/prev month arrow | Calendar shows that month's dates |

---

### TC-169 to TC-180: Admin — Compliance Dashboard (AdmCompliance)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-169 | KPIs load correctly | Navigate to Compliance Dashboard | All 6 KPI cards show numbers. No blank or NaN values. |
| TC-170 | Overall compliance % correct | Check "Overall Compliance %" KPI | Percentage matches count of fully-green locations divided by total |
| TC-171 | Action Required panel appears | When any location has an issue | Red or amber bordered panel appears above the location table |
| TC-172 | Action Required — correct items | Review action items | Items match actual issues in the data (e.g., "LHR-T5-01 — No submission today") |
| TC-173 | Action Required collapsed | Click "Hide" | Panel collapses. "Show" button appears. |
| TC-174 | Action Required expanded | Click "Show" | Panel expands and shows the list again |
| TC-175 | Location table — sort by Most Critical | Default sort | Red (Non-Compliant) locations appear first, then amber, then green |
| TC-176 | Sort by A–Z | Click "A–Z" sort button | Locations sorted alphabetically by name |
| TC-177 | Health badges correct | Check badge on each row | Compliant (green), At Risk (amber), Non-Compliant (red) match the actual data |
| TC-178 | 30d Rate column | View any location's row | Percentage matches submissions in last 30 days / 29 (excluding today) |
| TC-179 | Missing count in submission cell | Location with gaps in last 30 days | "· 3 missing" shown in red in the 30-day stats line |
| TC-180 | DGM pending shows days remaining | Late in month (day > 20), DGM not visited | "February pending — 3d left" shown in amber |

---

### TC-181 to TC-195: Admin — Locations (AdmLocations)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-181 | Locations table loads | Navigate to Locations | All active and inactive locations shown in a table |
| TC-182 | Pagination | More than 10 locations | Pagination controls appear. Page 1 shows 10 rows. |
| TC-183 | Add location — success | Click "+ Add Location", fill all fields, click Save | New location appears in table. "Location added." message shown for 3 seconds. |
| TC-184 | Add location — name required | Click Save without entering name | Error inline: "Name required" |
| TC-185 | Add location — city required | Fill name, skip city, click Save | Error: "City required" |
| TC-186 | Add location — invalid expected cash | Enter -100 in Expected Cash field | Error: "Enter a valid amount" |
| TC-187 | Add location — tolerance out of range | Enter 25 in Tolerance % (max 20) | Error: "1–20%" |
| TC-188 | Edit location — pre-filled | Click "Edit" on any location | Inline edit panel opens with current values pre-filled |
| TC-189 | Edit location — save changes | Modify name, click Save | Table updates immediately. Success message shown. |
| TC-190 | Edit location — cancel | Open edit, make changes, click Cancel | No changes saved. Table unchanged. |
| TC-191 | Deactivate location — confirm prompt | Click "Deactivate" | Red confirmation strip: "Deactivate [name]? Existing data is preserved." |
| TC-192 | Deactivate — confirm | Click "Yes, Deactivate" in confirmation | Row shows "INACTIVE" badge. Opacity reduced. |
| TC-193 | Deactivate — cancel | Click "Cancel" in confirmation | No change. Row remains active. |
| TC-194 | Reactivate | Click "Reactivate" on inactive location | Row shows "ACTIVE" badge again. |
| TC-195 | Inactive locations still show | After deactivating, scroll through all locations | Inactive locations still visible in table (soft delete, not removed) |

---

### TC-196 to TC-210: Admin — Users (AdmUsers)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-196 | Users table loads | Navigate to Users | All users shown with role badges and location counts |
| TC-197 | Add operator — location required | Add user with role=Operator, select no locations, click Save | Error: "Please select at least one location" |
| TC-198 | Add admin — no location required | Add user with role=Admin | No location field shown. Save works without location selection. |
| TC-199 | Add user — invalid email | Enter "notanemail" in email field | Error: "Enter a valid email address" |
| TC-200 | Add user — duplicate email | Enter an email that already exists | Error: "This email is already registered" |
| TC-201 | Add user — success | Fill all valid fields, click Save | New user appears in table with correct role badge |
| TC-202 | Role badge color | Add users with different roles | Operator=blue, Manager=yellow, Controller=green, DGM=purple |
| TC-203 | Edit user — change role | Click Edit on a user, change role from Operator to Manager | Location field disappears (if switching to Manager with different rules). Save updates role. |
| TC-204 | Edit user — change locations | Edit an operator, add/remove location checkboxes | Locations update on save |
| TC-205 | Deactivate user | Click "Deactivate" and confirm | User shows "INACTIVE" badge |
| TC-206 | Deactivated user cannot log in | Deactivate a user, try to login as that user | Login error: "Account is inactive. Contact your administrator." |
| TC-207 | Reactivate user | Click "Reactivate" on inactive user | User shows "ACTIVE" badge. Can log in again. |
| TC-208 | Pagination | More than 10 users | Pagination controls appear |
| TC-209 | Edit auto-jumps to page | Click Edit on user on page 3 | Table scrolls/jumps to show user's page in view |
| TC-210 | Name required | Click Save without entering name | Error: "Name required" |

---

### TC-211 to TC-220: Admin — Configuration (AdmConfig)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-211 | Config loads with defaults | Navigate to Config | All 6 global fields show current values (defaults on fresh install) |
| TC-212 | Change imprest amount | Change value to 10000, click Save | Confirmation: "Changes saved." Reloading page shows 10000. |
| TC-213 | Tolerance out of range | Enter 25 in Default Tolerance %, click Save | Error: "Tolerance must be 1–20%" |
| TC-214 | SLA must be positive | Enter 0 in Approval SLA field | Error: "SLA must be at least 1 hour" |
| TC-215 | DOW lookback — 4 weeks | Click "4 weeks" button | Button highlights. Saves as 4. |
| TC-216 | DOW lookback — 6 weeks | Click "6 weeks" button | Button highlights. Saves as 6. |
| TC-217 | Per-location override | Enter 8 in override column for one location, save | Effective % for that location shows 8% with ★ marker |
| TC-218 | Remove per-location override | Click "Remove override" on an overridden location | Override cleared. Location now shows global default without ★ |
| TC-219 | Save confirmation auto-dismisses | Click Save | "Changes saved." message appears and disappears after 3 seconds |
| TC-220 | Unsaved changes warning | Make changes, navigate away without saving | (If implemented) Warning: "You have unsaved changes." |

---

### TC-221 to TC-235: Admin — Audit Trail (AdmAudit)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-221 | Audit trail loads | Navigate to Audit Trail | Table shows events, most recent first |
| TC-222 | Event type filter | Select "Submission Approved" from Event Type | Only SUBMISSION_APPROVED events shown |
| TC-223 | Cascading actor filter | With Event Type = "Submission Approved", check Actor dropdown | Only actors who have approved submissions appear as options |
| TC-224 | Cascading location filter | With Event Type + Actor selected, check Location | Only relevant locations appear |
| TC-225 | Location disabled for system events | Select Event Type = "Config Changed" | Location dropdown shows "No locations (event has none)" and is disabled |
| TC-226 | Actor auto-resets | Select actor, then change event type to one where actor has no events | Actor dropdown resets to "All Actors" automatically |
| TC-227 | Date range — Today | Click "Today" | Only events from today shown |
| TC-228 | Date range — Last 7 days | Click "Last 7 Days" | Events from last 7 days shown |
| TC-229 | Date range — This month | Click "This Month" | Events from 1st of current month to today |
| TC-230 | Custom date range | Click "Custom", enter from 01 Feb to 15 Feb, | Only events in that range shown |
| TC-231 | Clear all filters | Apply multiple filters, click "✕ Clear all" | All filters reset. Full event list shown. |
| TC-232 | Change column shows old → new | View a CONFIG_CHANGED event | "Change" column shows old value with strikethrough, new value in green |
| TC-233 | Timestamp format | Check timestamp column | Shows date (e.g., "27 Feb 2026") and time (e.g., "14:32") on separate lines |
| TC-234 | Pagination — 15 per page | More than 15 events | Pagination controls appear. "Showing 1–15 of N events" text shown. |
| TC-235 | Filter count shown | Apply a filter | "X of Y events" shown in top right of filter row |

---

### TC-236 to TC-250: Admin — Reports (AdmReports)

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-236 | Reports load | Navigate to Reports | KPI cards and all 3 tables load with data |
| TC-237 | Date range — This Week | Click "This Week" | All data filtered to current week (Mon to today) |
| TC-238 | Date range — This Month | Click "This Month" | All data filtered to current month |
| TC-239 | Custom date range | Click "Custom", enter date range | Data filtered to exact range |
| TC-240 | KPI — Approval Rate % | Check Approval Rate KPI | = Approved count / (Approved + Rejected) × 100 |
| TC-241 | Per-Location table | Check Per-Location Summary | Each location row shows its own submission count, approval rate |
| TC-242 | Per-Location pagination | More than 10 locations | Pagination controls appear on Location table |
| TC-243 | Per-Actor — Operator chip | Click "Operator" role chip | Only Operator rows shown. Chip shows operator count. |
| TC-244 | Per-Actor — Manager chip | Click "Manager" role chip | Only Manager rows shown. Columns show "Decisions" and approval rate. |
| TC-245 | Per-Actor — Controller chip | Click "Controller" role chip | Only Controller rows. Columns show verifications, completed, missed. |
| TC-246 | Per-Actor — DGM chip | Click "DGM" role chip | Only DGM rows. Same columns as controller. |
| TC-247 | Per-Actor — All chip | Click "All Roles" chip | All actor types shown. Role badge distinguishes them. |
| TC-248 | Variance Exceptions table | Check 3rd table | Only submissions with |variance%| > 5% listed |
| TC-249 | Variance Exception count in KPIs | Check KPI vs exceptions table row count | Numbers match |
| TC-250 | Export CSV | Click "Export CSV" | Download starts (or success message if mock). File contains data from all 3 tables. |

---

### TC-251 to TC-260: Role & Permission Boundary Tests

These tests verify that roles CANNOT access screens they should not.

| ID | Test Case | Steps | Expected Result |
|---|---|---|---|
| TC-251 | Operator cannot access admin | Login as operator, manually navigate to admin URL or panel | Redirected to operator dashboard or "Access denied" shown |
| TC-252 | Manager cannot approve own submissions | (If manager is also an operator) Manager cannot approve submissions they submitted | System prevents self-approval |
| TC-253 | Operator can only see own location | Login as operator assigned to LHR-T5-01 | Can only see submissions for LHR-T5-01. Cannot see other locations. |
| TC-254 | Auditor is read-only | Login as auditor | Only Reports and Audit Trail in sidebar. No edit buttons anywhere. |
| TC-255 | Controller can only see their verifications | Login as controller | CtrlHistory shows only this controller's verifications |
| TC-256 | DGM cannot access admin config | Login as DGM | No admin sidebar items visible |
| TC-257 | Manager sees only assigned locations | Manager assigned to 2 of 5 locations | Can only see/approve submissions for those 2 locations |
| TC-258 | Session timeout | Leave browser idle (after token expiry) | On next action, redirected to Login. Token cleared. |
| TC-259 | Logout clears session | Click "Log out" in sidebar | Redirected to Login. Back button does not return to authenticated screen. |
| TC-260 | Token in API calls | Check network tab in browser | All API calls include Authorization: Bearer header |

---

### TC-261 to TC-268: End-to-End Workflow Tests

Run these after all screens are working individually.

| ID | Workflow | Steps | Expected Final State |
|---|---|---|---|
| TC-261 | Full daily submission cycle | Operator submits → Manager approves | Submission status: APPROVED. Audit log: 2 entries (CREATED, APPROVED). Dashboard shows green. |
| TC-262 | Reject and resubmit | Operator submits → Manager rejects with reason → Operator resubmits | Original rejected. New submission created. Audit log: 3 entries. |
| TC-263 | Controller full visit cycle | Controller schedules visit → (date arrives) → marks completed | Verification status: COMPLETED. CtrlHistory updated. Compliance dashboard shows green for controller track. |
| TC-264 | DGM monthly coverage | DGM visits all 5 locations in a month | DGM matrix shows all green for that month. KPI: "5 of 5 visited". |
| TC-265 | Variance exception flagged | Operator submits with 8% variance + note → Manager approves | Submission shows "Variance Exception" badge permanently. Reports Exceptions table includes it. |
| TC-266 | DOW warning cycle | Controller books Tuesday visit after previous Tuesday visit | Warning shown. Reason required. Visit created with warning_flag=true. CtrlHistory shows flag. Compliance reports flag it. |
| TC-267 | Admin adds location → Operator submits | Admin creates new location → assigns operator → operator logs in and submits | New location appears on operator's dashboard. Submission completes normally. |
| TC-268 | Config change reflected | Admin changes global tolerance from 5% to 3% → Operator submits 4% variance | Note field now required (4% > 3% new tolerance). Previous submissions unaffected. |

---

## Appendix A: Mock Data Locations (for testing reference)

| ID | Name | City | Expected Cash | Tolerance |
|---|---|---|---|---|
| LHR-T5-01 | Terminal 5 – Costa Coffee | London | £9,575 | 5% |
| LHR-T5-02 | Terminal 5 – WHSmith | London | £9,575 | 5% |
| LHR-T4-01 | Terminal 4 – Pret A Manger | London | £9,575 | 5% |
| LHR-G-01 | Gatwick North – Upper Crust | Gatwick | £9,575 | 5% |
| LHR-G-02 | Gatwick South – Costa | Gatwick | £9,575 | 5% |

---

## Appendix B: Cash Form Denominations (Section A & B reference)

**Section A — Bills:**
$100 | $50 | $20 | $10 | $5 | $2 | $1

**Section B — Coins:**
$1.00 | $0.50 | $0.25 | $0.10 | $0.05 | $0.01

**Section C — Bagged Coin:**
Dollar bags ($25 each) | Quarter bags ($10 each) | Dime bags ($5 each) | Nickel bags ($2 each) | Bulkers ($50 each)

---

## Appendix C: HTTP Error Code Reference

| Code | Meaning | When Used |
|---|---|---|
| 200 | OK | Successful GET/PUT |
| 201 | Created | Successful POST creating a resource |
| 400 | Bad Request | Malformed request body |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Valid token but wrong role/access |
| 404 | Not Found | Resource ID doesn't exist |
| 409 | Conflict | Duplicate (e.g., same date submission, same DGM month) |
| 422 | Unprocessable Entity | Validation failure (e.g., missing required field, tolerance out of range) |
| 500 | Internal Server Error | Unexpected backend error |

---

---

## 10. Email Notification Specifications

### Overview

The system sends automated emails at key points in every workflow. All emails are transactional (not marketing) and must be sent reliably. Use **AWS SES** in production. Use **Mailtrap** or **MailHog** in development to catch outgoing emails without actually sending them.

### Setup Requirements

**Backend additions needed:**

```
pip install fastapi-mail jinja2
```

**New environment variables:**

```env
# Development (Mailtrap)
MAIL_USERNAME=your_mailtrap_username
MAIL_PASSWORD=your_mailtrap_password
MAIL_FROM=noreply@compassccs.com
MAIL_FROM_NAME=CashRoom Compliance System
MAIL_SERVER=smtp.mailtrap.io
MAIL_PORT=587
MAIL_TLS=True

# Production (AWS SES)
MAIL_SERVER=email-smtp.eu-west-1.amazonaws.com
MAIL_PORT=587
SES_VERIFIED_DOMAIN=compassccs.com

# Shared
FRONTEND_URL=https://ccs.compassgroup.com
DAILY_REMINDER_TIME=08:00     # Pulled from system_config table
```

**File structure for email service:**

```
backend/app/
├── services/
│   └── email.py              ← Email sending service
├── templates/
│   └── email/
│       ├── base.html         ← Base layout with Compass branding
│       ├── submission_received.html
│       ├── submission_approved.html
│       ├── submission_rejected.html
│       ├── approval_reminder.html
│       ├── approval_overdue.html
│       ├── approval_escalation.html
│       ├── daily_reminder.html
│       ├── draft_reminder.html
│       ├── missed_submission_alert.html
│       ├── visit_scheduled_controller.html
│       ├── visit_reminder_controller.html
│       ├── visit_missed_alert.html
│       ├── dgm_visit_scheduled.html
│       ├── dgm_monthly_reminder.html
│       ├── dgm_end_of_month_alert.html
│       ├── variance_exception_alert.html
│       └── weekly_compliance_summary.html
└── tasks/
    └── scheduled.py          ← APScheduler jobs for timed emails
```

**Scheduled job runner** — add APScheduler to run timed emails:

```
pip install apscheduler
```

---

### Email Notification Catalogue

---

#### EN-001: Submission Received Confirmation

| Field | Value |
|---|---|
| **Trigger** | Operator successfully submits a cash count (status changes to PENDING_APPROVAL) |
| **Recipient** | The operator who submitted |
| **Timing** | Immediately on submission |
| **Priority** | Low |

**Subject:**
```
✅ Cash Count Submitted — {location_name} — {submission_date}
```

**Body:**

```
Hi {operator_name},

Your cash count for {location_name} on {submission_date_formatted} has been
successfully submitted and is awaiting manager approval.

SUBMISSION SUMMARY
──────────────────
Location:       {location_name}
Date:           {submission_date_formatted}
Total Fund:     {total_cash}
Imprest:        {expected_cash}
Variance:       {variance} ({variance_pct}%)
Submitted at:   {submitted_at}
Reference:      {submission_id}

{if variance_exception}
⚠️  VARIANCE NOTE RECORDED
Your variance of {variance_pct}% exceeds the {tolerance_pct}% tolerance.
Your explanation has been recorded and will be reviewed by your manager.
{endif}

You will receive another email when your manager makes a decision.

View Submission: {frontend_url}/submission/{submission_id}

---
CashRoom Compliance System | Compass Group
This is an automated message. Do not reply.
```

**Template variables:**
`operator_name`, `location_name`, `submission_date`, `submission_date_formatted`, `total_cash`, `expected_cash`, `variance`, `variance_pct`, `tolerance_pct`, `submitted_at`, `submission_id`, `variance_exception` (boolean), `frontend_url`

---

#### EN-002: Submission Approved

| Field | Value |
|---|---|
| **Trigger** | Manager approves a submission |
| **Recipient** | The operator who submitted |
| **Timing** | Immediately on approval |
| **Priority** | Normal |

**Subject:**
```
✅ Submission Approved — {location_name} — {submission_date}
```

**Body:**

```
Hi {operator_name},

Great news! Your cash count for {location_name} on {submission_date_formatted}
has been approved.

APPROVAL DETAILS
────────────────
Location:       {location_name}
Date:           {submission_date_formatted}
Total Fund:     {total_cash}
Variance:       {variance} ({variance_pct}%)
Approved by:    {manager_name}
Approved at:    {approved_at}

No further action required.

View Submission: {frontend_url}/submission/{submission_id}

---
CashRoom Compliance System | Compass Group
```

**Template variables:**
`operator_name`, `location_name`, `submission_date_formatted`, `total_cash`, `variance`, `variance_pct`, `manager_name`, `approved_at`, `submission_id`, `frontend_url`

---

#### EN-003: Submission Rejected

| Field | Value |
|---|---|
| **Trigger** | Manager rejects a submission |
| **Recipient** | The operator who submitted |
| **Timing** | Immediately on rejection |
| **Priority** | High |

**Subject:**
```
❌ Action Required: Submission Rejected — {location_name} — {submission_date}
```

**Body:**

```
Hi {operator_name},

Your cash count for {location_name} on {submission_date_formatted} has been
rejected and requires your attention.

REJECTION DETAILS
─────────────────
Location:       {location_name}
Date:           {submission_date_formatted}
Total Fund:     {total_cash}
Variance:       {variance} ({variance_pct}%)
Rejected by:    {manager_name}
Rejected at:    {rejected_at}

REASON FOR REJECTION
────────────────────
{rejection_reason}

WHAT TO DO NEXT
───────────────
1. Review the rejection reason above
2. Recount the cash if necessary
3. Resubmit your corrected cash count

Resubmit Now: {frontend_url}/resubmit/{submission_id}

If you believe this rejection is an error, please contact your manager
{manager_name} directly.

---
CashRoom Compliance System | Compass Group
```

**Template variables:**
`operator_name`, `location_name`, `submission_date_formatted`, `total_cash`, `variance`, `variance_pct`, `manager_name`, `rejected_at`, `rejection_reason`, `submission_id`, `frontend_url`

---

#### EN-004: Daily Submission Reminder

| Field | Value |
|---|---|
| **Trigger** | Scheduled job — runs daily at the configured reminder time (default 08:00) |
| **Recipient** | All operators who have NOT yet submitted for today AND whose location is active |
| **Timing** | Daily at `system_config.daily_reminder_time` |
| **Priority** | Normal |
| **Do not send if** | Operator already has a submission for today (any status including draft) |

**Subject:**
```
⏰ Reminder: Cash Count Due Today — {location_name}
```

**Body:**

```
Hi {operator_name},

This is your daily reminder to submit the cash count for {location_name}.

TODAY'S DETAILS
───────────────
Location:       {location_name}
Date:           {today_formatted}
Imprest:        {expected_cash}
Tolerance:      ±{tolerance_pct}%

Submit your count before end of business today to remain compliant.

Submit Now: {frontend_url}

---
CashRoom Compliance System | Compass Group
This is an automated reminder. Do not reply.
```

**Scheduled job logic:**

```python
# tasks/scheduled.py
async def send_daily_reminders():
    """Run at configured reminder time every weekday"""
    today = date.today().isoformat()
    active_operators = await db.get_operators_without_submission_today(today)
    for operator in active_operators:
        await email_service.send_daily_reminder(operator)
```

---

#### EN-005: Draft Reminder

| Field | Value |
|---|---|
| **Trigger** | Scheduled job — runs at end of business (17:00 daily) |
| **Recipient** | Operators who have a DRAFT saved but have not submitted it |
| **Timing** | Daily at 17:00 |
| **Priority** | High |
| **Do not send if** | Draft has already been submitted (status != DRAFT) |

**Subject:**
```
⚠️ Unfinished Cash Count Draft — {location_name} — Submit Before Close
```

**Body:**

```
Hi {operator_name},

You have an unfinished cash count draft for {location_name} that has not
been submitted.

DRAFT DETAILS
─────────────
Location:       {location_name}
Date:           {today_formatted}
Draft saved at: {draft_saved_at}

Please complete and submit your cash count as soon as possible.

Complete Draft: {frontend_url}

If you have already submitted by a different method, please discard this
reminder.

---
CashRoom Compliance System | Compass Group
```

---

#### EN-006: Manager — New Submission Pending Approval

| Field | Value |
|---|---|
| **Trigger** | A new submission is created with status PENDING_APPROVAL |
| **Recipient** | All managers assigned to the submission's location |
| **Timing** | Immediately on submission |
| **Priority** | Normal |

**Subject:**
```
📋 New Cash Count Pending Approval — {location_name} — {submission_date}
```

**Body:**

```
Hi {manager_name},

A new cash count has been submitted for your review.

SUBMISSION DETAILS
──────────────────
Location:       {location_name}
Operator:       {operator_name}
Date:           {submission_date_formatted}
Total Fund:     {total_cash}
Variance:       {variance} ({variance_pct}%)
Submitted at:   {submitted_at}
SLA Deadline:   {sla_deadline}   ← submitted_at + 48 hours

{if variance_exception}
⚠️  VARIANCE EXCEPTION
This submission has a variance of {variance_pct}% which exceeds the
{tolerance_pct}% tolerance. An operator explanation has been provided.
Please review carefully before approving.
{endif}

PENDING IN YOUR QUEUE: {total_pending_count} submission(s) awaiting approval

Review & Approve: {frontend_url}/approvals

---
CashRoom Compliance System | Compass Group
```

**Template variables:**
`manager_name`, `location_name`, `operator_name`, `submission_date_formatted`, `total_cash`, `variance`, `variance_pct`, `submitted_at`, `sla_deadline`, `variance_exception` (bool), `tolerance_pct`, `total_pending_count`, `frontend_url`

---

#### EN-007: Manager — Approval SLA Warning (Approaching Deadline)

| Field | Value |
|---|---|
| **Trigger** | Scheduled job — checks for submissions pending for 36 hours (12 hours before SLA breach) |
| **Recipient** | Manager(s) assigned to the submission's location |
| **Timing** | Run hourly check; fire when `submitted_at + 36h` is passed and submission still PENDING |
| **Priority** | High |
| **Send once** | Use a flag `sla_warning_sent = true` on the submission to avoid repeat sends |

**Subject:**
```
⏰ Approval Due in 12 Hours — {location_name} — {submission_date}
```

**Body:**

```
Hi {manager_name},

A cash count submission is approaching its approval deadline and requires
your urgent attention.

SUBMISSION DETAILS
──────────────────
Location:       {location_name}
Operator:       {operator_name}
Date:           {submission_date_formatted}
Total Fund:     {total_cash}
Variance:       {variance} ({variance_pct}%)
Submitted at:   {submitted_at}
⚠️  SLA Deadline: {sla_deadline}  (in approximately 12 hours)

Please approve or reject this submission as soon as possible to avoid
an SLA breach.

Review Now: {frontend_url}/approvals/{submission_id}

---
CashRoom Compliance System | Compass Group
```

---

#### EN-008: Manager — Approval SLA Breached (Overdue)

| Field | Value |
|---|---|
| **Trigger** | Scheduled job — checks for submissions pending for more than 48 hours |
| **Recipient** | Manager(s) assigned to the location + Admin (CC) |
| **Timing** | Hourly check; fire once when `submitted_at + 48h` is exceeded and still PENDING |
| **Priority** | Critical |
| **CC** | All admin users |
| **Send once** | Use `sla_breach_sent = true` flag |

**Subject:**
```
🚨 OVERDUE: Approval SLA Breached — {location_name} — {submission_date}
```

**Body:**

```
Hi {manager_name},

URGENT: A cash count approval is now OVERDUE. The 48-hour SLA has been
breached.

OVERDUE SUBMISSION
──────────────────
Location:       {location_name}
Operator:       {operator_name}
Date:           {submission_date_formatted}
Total Fund:     {total_cash}
Variance:       {variance} ({variance_pct}%)
Submitted at:   {submitted_at}
SLA Deadline:   {sla_deadline}
⛔ Now Overdue:  {hours_overdue} hours past deadline

This submission is now flagged as overdue in the compliance dashboard and
will appear in the weekly compliance report.

Approve Immediately: {frontend_url}/approvals/{submission_id}

---
CashRoom Compliance System | Compass Group

[This email was copied to system administrators]
```

---

#### EN-009: Variance Exception Alert

| Field | Value |
|---|---|
| **Trigger** | A submission is created where `|variance_pct| > tolerance_pct` |
| **Recipient** | Manager(s) assigned to the location + Admin |
| **Timing** | Immediately on submission |
| **Priority** | High |

**Subject:**
```
⚠️ Variance Exception Flagged — {location_name} — {variance_pct}% Variance
```

**Body:**

```
Hi {recipient_name},

A cash count with an out-of-tolerance variance has been submitted and
requires your attention.

VARIANCE EXCEPTION DETAILS
───────────────────────────
Location:       {location_name}
Operator:       {operator_name}
Date:           {submission_date_formatted}
Total Fund:     {total_cash}
Imprest:        {expected_cash}
Variance:       {variance}
Variance %:     {variance_pct}%
Tolerance:      ±{tolerance_pct}%
Submitted at:   {submitted_at}

OPERATOR'S EXPLANATION
───────────────────────
{variance_note}

This submission requires careful review. The variance exception flag will
remain on this record permanently, even after approval.

Review Submission: {frontend_url}/approvals/{submission_id}

---
CashRoom Compliance System | Compass Group
```

---

#### EN-010: Controller — Visit Scheduled Confirmation

| Field | Value |
|---|---|
| **Trigger** | Controller books a verification visit |
| **Recipient** | The controller who scheduled it |
| **Timing** | Immediately on booking |
| **Priority** | Low |

**Subject:**
```
📅 Controller Visit Scheduled — {location_name} — {visit_date} at {visit_time}
```

**Body:**

```
Hi {controller_name},

Your controller visit has been successfully scheduled.

VISIT DETAILS
─────────────
Location:       {location_name}
Date:           {visit_date_formatted}
Day:            {day_of_week}
Time:           {visit_time}
Reference:      {verification_id}

{if warning_flag}
⚠️  DAY-OF-WEEK PATTERN NOTE
This visit was scheduled on a {day_of_week}, which matches a pattern of
recent visits to this location.
Reason recorded: {warning_reason}
{endif}

WHAT TO DO ON THE DAY
──────────────────────
1. Arrive at {location_name} at {visit_time}
2. Conduct your physical cash verification
3. Record the observed total in the system
4. Note any discrepancies or flags

View My Schedule: {frontend_url}/schedule

---
CashRoom Compliance System | Compass Group
```

---

#### EN-011: Controller — Visit Reminder (Day Before)

| Field | Value |
|---|---|
| **Trigger** | Scheduled job — runs every evening at 18:00, checks for visits scheduled for tomorrow |
| **Recipient** | The controller with the scheduled visit |
| **Timing** | Evening before the visit date |
| **Priority** | Normal |

**Subject:**
```
⏰ Reminder: Controller Visit Tomorrow — {location_name} at {visit_time}
```

**Body:**

```
Hi {controller_name},

This is a reminder that you have a controller verification visit scheduled
for tomorrow.

TOMORROW'S VISIT
────────────────
Location:       {location_name}
Date:           {visit_date_formatted} (Tomorrow)
Time:           {visit_time}
Address:        {location_address}

Please ensure you have access and that the operator at the location is
expecting you.

View Full Schedule: {frontend_url}/schedule

---
CashRoom Compliance System | Compass Group
```

---

#### EN-012: Controller — Missed Visit Alert

| Field | Value |
|---|---|
| **Trigger** | Scheduled job — runs nightly at 23:00, checks for SCHEDULED visits on today's date that were NOT marked completed |
| **Recipient** | The controller + Admin (CC) |
| **Timing** | End of the visit date (23:00) |
| **Priority** | High |
| **Action** | Automatically update verification status from SCHEDULED → MISSED |

**Subject:**
```
🚨 Missed Controller Visit — {location_name} — {visit_date}
```

**Body:**

```
Hi {controller_name},

A scheduled controller visit was not completed today and has been
automatically marked as MISSED.

MISSED VISIT DETAILS
────────────────────
Location:       {location_name}
Scheduled Date: {visit_date_formatted}
Scheduled Time: {visit_time}
Status:         MISSED (auto-updated)

This missed visit has been logged in the compliance dashboard and will
appear in your verification history.

NEXT STEPS
──────────
1. Log in to the system to reschedule this visit
2. Inform your manager if the missed visit was unavoidable
3. Provide an explanation in the Notes field when rescheduling

Reschedule Now: {frontend_url}/schedule

[Administrators have been copied on this alert]

---
CashRoom Compliance System | Compass Group
```

---

#### EN-013: DGM — Monthly Visit Scheduled Confirmation

| Field | Value |
|---|---|
| **Trigger** | DGM schedules a monthly visit |
| **Recipient** | The DGM who scheduled it |
| **Timing** | Immediately on booking |
| **Priority** | Low |

**Subject:**
```
📅 DGM Visit Scheduled — {location_name} — {visit_date} ({month_label})
```

**Body:**

```
Hi {dgm_name},

Your monthly DGM visit has been successfully scheduled.

VISIT DETAILS
─────────────
Location:       {location_name}
Visit Date:     {visit_date_formatted}
Month:          {month_label}
Reference:      {verification_id}

{if notes}
NOTES
─────
{notes}
{endif}

This visit satisfies the monthly coverage requirement for {month_label}.

REMAINING THIS MONTH
────────────────────
{unvisited_count} location(s) still to be scheduled for {month_label}:
{unvisited_locations_list}

View Dashboard: {frontend_url}/dgm

---
CashRoom Compliance System | Compass Group
```

---

#### EN-014: DGM — Monthly Coverage Reminder

| Field | Value |
|---|---|
| **Trigger** | Scheduled job — runs on the 15th of every month |
| **Recipient** | DGMs who have unvisited locations for the current month |
| **Timing** | 15th of the month at 09:00 |
| **Priority** | Normal |
| **Do not send if** | All locations already visited for the month |

**Subject:**
```
📋 Mid-Month Reminder: {unvisited_count} Location(s) Not Yet Visited — {month_label}
```

**Body:**

```
Hi {dgm_name},

You are halfway through {month_label} and the following locations have not
yet been scheduled for your monthly DGM visit.

UNVISITED LOCATIONS ({unvisited_count})
───────────────────────────────────────
{foreach location in unvisited_locations}
  • {location.name} ({location.city})
{endforeach}

VISITED THIS MONTH ({visited_count})
─────────────────────────────────────
{foreach location in visited_locations}
  ✅ {location.name} — {location.visit_date}
{endforeach}

Please schedule your remaining visits to ensure full monthly coverage.

Schedule a Visit: {frontend_url}/dgm/log

---
CashRoom Compliance System | Compass Group
```

---

#### EN-015: DGM — End-of-Month Urgent Alert

| Field | Value |
|---|---|
| **Trigger** | Scheduled job — runs on the 25th of every month |
| **Recipient** | DGMs with unvisited locations + Admin (CC) |
| **Timing** | 25th of the month at 09:00 |
| **Priority** | High |
| **Do not send if** | All locations already visited |

**Subject:**
```
🚨 Urgent: {unvisited_count} DGM Visit(s) Overdue — Only {days_remaining} Days Left in {month_label}
```

**Body:**

```
Hi {dgm_name},

URGENT: {unvisited_count} location(s) have not been visited this month and
only {days_remaining} days remain in {month_label}.

UNVISITED LOCATIONS — OVERDUE ({unvisited_count})
──────────────────────────────────────────────────
{foreach location in unvisited_locations}
  🔴 {location.name} ({location.city}) — No visit scheduled
{endforeach}

Failure to complete these visits by {month_end_date} will be recorded
as missed visits in the compliance report for {month_label}.

Schedule Now: {frontend_url}/dgm/log

[Administrators have been copied on this alert]

---
CashRoom Compliance System | Compass Group
```

---

#### EN-016: Admin — Weekly Compliance Summary

| Field | Value |
|---|---|
| **Trigger** | Scheduled job — every Monday morning |
| **Recipient** | All admin users |
| **Timing** | Monday at 07:00 |
| **Priority** | Normal |

**Subject:**
```
📊 Weekly Compliance Summary — Week of {week_start} to {week_end}
```

**Body:**

```
Hi {admin_name},

Here is your weekly compliance summary for the CashRoom Compliance System.

OVERVIEW — WEEK {week_start} TO {week_end}
────────────────────────────────────────────
Total Submissions:          {total_submissions}
Approved:                   {approved_count} ({approval_rate}%)
Rejected:                   {rejected_count}
Pending at week end:        {pending_count}
Overdue (>48h) at week end: {overdue_count}
Variance Exceptions:        {exception_count}
Missing Submissions:        {missing_count}

LOCATIONS WITH ISSUES
─────────────────────
{foreach location in problem_locations}
  ⚠️  {location.name}
     - {location.issue_summary}
{endforeach}

CONTROLLER VISITS THIS WEEK
───────────────────────────
Completed:    {ctrl_completed}
Missed:       {ctrl_missed}
DOW Warnings: {ctrl_warnings}

DGM MONTHLY COVERAGE (as of today)
────────────────────────────────────
{foreach location in all_locations}
  {location.dgm_status_icon} {location.name} — {location.dgm_status}
{endforeach}

View Full Report: {frontend_url}/admin/reports

---
CashRoom Compliance System | Compass Group
This report covers {week_start} 00:00 to {week_end} 23:59.
```

---

#### EN-017: Admin — New User Created

| Field | Value |
|---|---|
| **Trigger** | Admin creates a new user account |
| **Recipients** | (1) The new user — welcome + login instructions; (2) Admin who created them — confirmation |
| **Timing** | Immediately on user creation |
| **Priority** | Normal |

**Email to new user — Subject:**
```
👋 Welcome to CashRoom Compliance System — Your Account is Ready
```

**Body to new user:**

```
Hi {new_user_name},

Your account for the Compass CashRoom Compliance System has been created.

YOUR ACCOUNT DETAILS
────────────────────
Name:           {new_user_name}
Email:          {new_user_email}
Role:           {new_user_role}
{if locations}
Assigned to:    {locations_list}
{endif}

TO GET STARTED
──────────────
1. Go to: {frontend_url}
2. Enter your email: {new_user_email}
3. Use the temporary password: {temp_password}
4. You will be prompted to change your password on first login

⚠️  For security, please change your password immediately after logging in.

Login Now: {frontend_url}

If you did not expect this account, please contact your administrator
immediately at {admin_contact_email}.

---
CashRoom Compliance System | Compass Group
```

---

#### EN-018: Missed Submission Logged

| Field | Value |
|---|---|
| **Trigger** | Operator submits a missed submission explanation |
| **Recipient** | The manager(s) assigned to the location |
| **Timing** | Immediately on logging |
| **Priority** | Normal |

**Subject:**
```
📝 Missed Submission Explanation Logged — {location_name} — {missed_date}
```

**Body:**

```
Hi {manager_name},

An explanation has been logged for a missed cash count submission.

MISSED SUBMISSION DETAILS
──────────────────────────
Location:       {location_name}
Operator:       {operator_name}
Missed Date:    {missed_date_formatted}
Reason:         {reason_label}
Supervisor:     {supervisor_name}
Logged at:      {logged_at}

OPERATOR'S EXPLANATION
───────────────────────
{detail}

This explanation has been recorded in the audit trail. No cash submission
has been created — the date remains marked as "Missing" in the compliance
view.

View Compliance Dashboard: {frontend_url}/admin/compliance

---
CashRoom Compliance System | Compass Group
```

---

### Email Notification Summary Table

| ID | Email Name | Trigger | Recipient | Timing | Priority |
|---|---|---|---|---|---|
| EN-001 | Submission Received | Submission created | Operator | Instant | Low |
| EN-002 | Submission Approved | Manager approves | Operator | Instant | Normal |
| EN-003 | Submission Rejected | Manager rejects | Operator | Instant | High |
| EN-004 | Daily Reminder | Scheduled (08:00) | Operator (no sub yet) | Daily | Normal |
| EN-005 | Draft Reminder | Scheduled (17:00) | Operator (has draft) | Daily | High |
| EN-006 | Pending Approval Notice | Submission created | Manager | Instant | Normal |
| EN-007 | SLA Warning | Submission pending 36h | Manager | Hourly check | High |
| EN-008 | SLA Breached | Submission pending 48h+ | Manager + Admin CC | Hourly check | Critical |
| EN-009 | Variance Exception Alert | Variance > tolerance | Manager + Admin | Instant | High |
| EN-010 | Visit Scheduled (Ctrl) | Visit booked | Controller | Instant | Low |
| EN-011 | Visit Reminder (Ctrl) | Scheduled (18:00 eve) | Controller | Evening before | Normal |
| EN-012 | Missed Visit Alert | Scheduled (23:00) | Controller + Admin CC | Nightly | High |
| EN-013 | DGM Visit Scheduled | Visit booked | DGM | Instant | Low |
| EN-014 | Monthly Coverage Reminder | Scheduled (15th) | DGM (with gaps) | Monthly | Normal |
| EN-015 | End-of-Month Alert | Scheduled (25th) | DGM + Admin CC | Monthly | High |
| EN-016 | Weekly Summary | Scheduled (Mon 07:00) | Admin | Weekly | Normal |
| EN-017 | New User Welcome | User created | New user + Admin | Instant | Normal |
| EN-018 | Missed Submission Logged | Explanation submitted | Manager | Instant | Normal |

---

### Email Testing Checklist

Before going live, verify every email using Mailtrap (dev) then one real send test per template in staging:

| Check | Description |
|---|---|
| ☐ All 18 emails render correctly | No broken variables (no raw `{variable_name}` visible) |
| ☐ All links work | Frontend URL resolves to correct screen |
| ☐ Conditional blocks correct | `{if variance_exception}` block only shows when true |
| ☐ No duplicate sends | SLA warning not sent twice for same submission |
| ☐ Correct recipients | Manager only gets emails for their locations |
| ☐ Unsubscribe not required | All emails are transactional — unsubscribe link NOT needed |
| ☐ From address verified | AWS SES domain verification complete before production |
| ☐ SPF / DKIM set up | Email auth records set in DNS to avoid spam folders |
| ☐ Temp password on EN-017 | Generated securely and hashed before DB save |
| ☐ Scheduled jobs fire correctly | APScheduler logs confirm each job ran at correct time |

---

## 11. Edge Case Test Scenarios

These supplement the standard test cases (TC-001 to TC-268) and cover unusual but real-world scenarios. Each group targets a specific risk area.

---

### ECT-001 to ECT-015: Date & Time Boundary Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-001 | Submit on last day of month | Log in on 31st Jan, submit cash count | Submission date is 31 Jan. Next day (1 Feb) dashboard shows 31 Jan as "Approved" in previous month. |
| ECT-002 | Submit on 1st of month | Log in on 1st Feb, submit | Submission date is 1 Feb. Previous month (Jan) report does not include this submission. |
| ECT-003 | Leap year — 29 February | Set system date to 29 Feb (leap year), submit | Submission date is 29 Feb. No date parsing error. Displays correctly as "29 Feb". |
| ECT-004 | Non-leap year — Feb 29 blocked | Try to manually enter submission_date=2025-02-29 via API | API returns 400 Bad Request: "Invalid date". |
| ECT-005 | DST clock change — submission at 01:30 (clocks go back) | Submit at 01:30 on a DST change night | Submission saved with UTC timestamp. Display converts correctly to local time. |
| ECT-006 | DGM visit on 31st — last day of month | DGM books visit for 31 Jan, monthYear='2026-01' | Visit created. Blocks second booking for Jan. Shows as January visit in compliance matrix. |
| ECT-007 | Controller visit — tomorrow boundary at midnight | Try to book a visit at 00:01 on the current day | Tomorrow is any day after today's date. Booking for today should be rejected (must be future). |
| ECT-008 | Daily reminder at midnight | Scheduled job fires at 00:00 | Reminder uses today's date (new day), not yesterday's. Sends for locations with no submission today. |
| ECT-009 | Audit trail — year boundary | View audit trail with custom range 28 Dec 2025 – 3 Jan 2026 | Events on both sides of year boundary included. No data cut-off at 31 Dec. |
| ECT-010 | 30-day rate % on 1st of month | Operator dashboard shows "30d Rate" on February 1 | Past 29 days = January 3–31. Rate calculated correctly, no divide-by-zero. |
| ECT-011 | Reports — "This Week" on Monday | Admin opens Reports on a Monday | "This Week" = Monday only (today). Report shows data for just 1 day. |
| ECT-012 | Reports — "This Week" on Sunday | Admin opens Reports on a Sunday | "This Week" = Monday–Sunday. All 7 days included. |
| ECT-013 | Custom date range — same day | Set From and To to same date in Reports | Shows all data for that single day only. No empty result set. |
| ECT-014 | Custom date range — From > To | Set From to a date AFTER To in the Reports date picker | Error: "Start date cannot be after end date". Report not run. |
| ECT-015 | Submission for 2 years ago | Admin tries to view submission from 2 years ago | If within data retention period, displays correctly. Date shown accurately without truncation. |

---

### ECT-016 to ECT-028: Concurrent Access & Race Conditions

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-016 | Two operators submit for same location same date simultaneously | Open app in two browsers, both log in as operator for same location, both click Submit at same time | First submission succeeds. Second receives: "A submission already exists for this date". No duplicate created. |
| ECT-017 | Manager approves while operator resubmits | Manager clicks Approve at the exact same moment operator clicks Resubmit | Either: (a) Approval succeeds and resubmit is blocked, or (b) Resubmit creates a new record and old approval is voided. No data corruption. Only ONE approved record exists. |
| ECT-018 | Two managers approve same submission | Two managers open the same pending submission and both click Approve simultaneously | First approval succeeds. Second receives: "This submission has already been actioned". |
| ECT-019 | Controller books same date twice | Controller opens schedule in two tabs, books same date in both | First booking succeeds. Second receives: "This date is already booked". |
| ECT-020 | Admin deactivates location while operator submits | Admin deactivates location during the exact moment operator is submitting | Submission either: (a) succeeds (deactivation is not retroactive to in-flight request), or (b) fails gracefully. No server crash. |
| ECT-021 | Admin changes tolerance while operator is filling form | Admin changes tolerance from 5% to 3% while operator is on OpForm | When operator submits, the current tolerance from DB is used (3%). If variance 4%, note is now required. |
| ECT-022 | Config change during submission | Admin saves new imprest amount while operator is mid-form | Submission uses the snapshot of expected_cash saved at submit time, not the form's display value. |
| ECT-023 | DGM double-books same month | DGM opens DgmLog in two browser tabs, books same location+month in both tabs | First booking succeeds. Second receives 409: "Already visited this location this month". |
| ECT-024 | Session expiry during form fill | Operator spends 90 minutes filling OpForm, token expires, clicks Submit | API returns 401 Unauthorised. Frontend redirects to Login with a message: "Your session expired. Please log in again. Your draft has been saved." |
| ECT-025 | Rapid page refresh during submit | Operator clicks Submit, then immediately refreshes the browser | API endpoint is idempotent (uses submission_id or location+date deduplication). Refresh does not create a second submission. |
| ECT-026 | Multiple rapid filter changes | Manager clicks location filter, then date filter, then status filter in quick succession | Each filter API call either: (a) debounced (only last call fires), or (b) previous results replaced correctly. No stale data shown. |
| ECT-027 | Long-running Excel parse | Very large Excel file upload takes >30 seconds to parse | Upload progress indicator shown. If timeout, error message: "File processing timed out. Try a smaller file or use the digital form." |
| ECT-028 | Back button after submission | Operator clicks Submit, sees confirmation, then clicks browser Back button | Does not create a second submission. Either shows the confirmation again or redirects to dashboard. |

---

### ECT-029 to ECT-042: Input Validation & Data Edge Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-029 | Very large cash quantity | Enter 999,999 in a bill quantity field (e.g., $100 × 999,999 = $99,999,900) | System accepts the number but shows a warning: "Total fund is unusually high. Please verify before submitting." |
| ECT-030 | Decimal in quantity field | Enter 2.5 in a bill quantity field (bills must be whole numbers) | Field rounds to 2 or shows error: "Quantity must be a whole number". Total calculated correctly. |
| ECT-031 | Negative quantity prevented | Enter -5 in any Section A quantity field | Field resets to 0 or shows error: "Quantity cannot be negative". |
| ECT-032 | Zero imprest — division by zero | Admin sets imprest to £0, operator submits | System should prevent imprest being set to 0 (validate in config). If it somehow happens, variance_pct displays "N/A" instead of crashing. |
| ECT-033 | Maximum variance note length | Enter 5,000 characters in the variance explanation field | Accepted if within DB column size (TEXT). Displays in full in the submission view. |
| ECT-034 | Minimum variance note length | Enter only 2 characters as variance note and submit | Error: "Explanation must be at least 10 characters". |
| ECT-035 | Special characters in location name | Admin creates location with name: "Terminal 4 – Café & Brasserie (T4/B)" | Saved and displayed correctly everywhere. No encoding issues in emails or exports. |
| ECT-036 | Special characters in user name | Admin creates user with name: "O'Brien, Seán" | Apostrophe and accented character saved correctly. No SQL injection risk (parameterised queries). |
| ECT-037 | SQL injection attempt | Enter `'; DROP TABLE submissions; --` in any text field | Input sanitised. No SQL executed. Stored as literal text. |
| ECT-038 | XSS attempt in rejection reason | Manager enters `<script>alert('XSS')</script>` as rejection reason | Stored as escaped text. Not executed when displayed in the operator's view. |
| ECT-039 | Unicode in notes field | Controller enters notes in Arabic or Chinese characters | Saved and retrieved correctly. Database uses UTF-8. No character corruption. |
| ECT-040 | Email with + sign | Admin creates user with email `test+ccs@compass.com` | Accepted as valid email. User can log in. Emails delivered correctly. |
| ECT-041 | Whitespace-only required field | Enter spaces only in "Supervisor Name" in OpMissed | Trimmed to empty string. Error: "Supervisor name is required". |
| ECT-042 | Max page number exceeded | In Reports, 10 rows exist, user manually navigates to page 5 | System shows page 1 (first page) or error message: "Page does not exist". Does not crash. |

---

### ECT-043 to ECT-055: Pagination Boundary Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-043 | Exactly 10 rows — one page | Submissions table has exactly 10 records | Pagination controls not shown (or "Page 1 of 1" shown). All 10 rows visible. |
| ECT-044 | Exactly 11 rows — two pages | Add one more submission to get 11 total | Pagination shows "1 2". Page 1 = 10 rows. Page 2 = 1 row. |
| ECT-045 | Zero rows after filtering | Apply a filter that matches nothing | "No results found" message. Pagination hidden. No crash. |
| ECT-046 | Filter changes — page resets | User is on page 3, then changes a filter | Table jumps back to page 1. Shows correct filtered results. |
| ECT-047 | Edit item on last page | Admin clicks Edit on a location on page 3 | Table auto-jumps to page containing that location. Edit form opens. |
| ECT-048 | Delete last item on a page | Admin deactivates the only item on page 3 | Table jumps to page 2 (previous page). Does not show empty page 3. |
| ECT-049 | Add new item — goes to last page | Admin adds a new location when 20 locations exist | New location added to end. Page jumps to last page (page 3) where new location is visible. |
| ECT-050 | Sort changes — page resets to 1 | Compliance Dashboard: user is on page 2, clicks "A–Z" sort | Table resets to page 1 with re-sorted data. |
| ECT-051 | Page size consistency | Admin checks Users table pagination | Every page shows exactly 10 rows except the last page (which shows the remainder). |
| ECT-052 | Large data set | More than 1000 audit events exist | Audit trail still loads quickly (<3 seconds). Pagination works correctly for all pages. |
| ECT-053 | Rapid page navigation | Click Next rapidly 10 times | Does not skip pages or show wrong data. Each click waits for the previous page to load (or debounced). |
| ECT-054 | Page 1 — Prev button disabled | Navigate to page 1 | "Prev" button is disabled/greyed. Cannot go to page 0. |
| ECT-055 | Last page — Next button disabled | Navigate to last page | "Next" button is disabled/greyed. Cannot go beyond last page. |

---

### ECT-056 to ECT-066: Excel Upload Edge Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-056 | Empty Excel file | Upload an Excel file with no data (blank sheet) | Error: "The uploaded file contains no data. Please use the standard template." |
| ECT-057 | Excel file too large | Upload a 50MB Excel file | Error: "File size exceeds the 10MB limit." (Set a reasonable server-side limit.) |
| ECT-058 | Corrupted Excel file | Upload a file renamed to .xlsx but actually a .jpg | Error: "Could not read this file. Ensure it is a valid Excel file." |
| ECT-059 | Password-protected Excel | Upload a password-protected .xlsx | Error: "This file is password protected. Please remove the password and try again." |
| ECT-060 | Excel with extra sheets | Upload a valid Sheboygan Excel that also has extra sheets | Parser reads only the correct named sheet (e.g., "CashCount"). Extra sheets ignored. |
| ECT-061 | Excel with negative values | Upload Excel where a section total is negative | Error: "Negative values are not permitted in cash counts. Please check your data." |
| ECT-062 | Excel with text in numeric cell | Cash count cell contains "n/a" or "-" instead of a number | Error: "Could not parse cell [A5]: expected a number, found text. Please correct and re-upload." |
| ECT-063 | Excel from wrong template version | Upload an older version of the Sheboygan template | Parser detects missing columns. Error: "Template version mismatch. Please use the current template." |
| ECT-064 | Multiple files dragged | User drags 3 files onto the drop zone at once | Only first file processed, or error: "Please upload one file at a time." |
| ECT-065 | Same file re-uploaded | Upload valid file, then upload same file again without refreshing | Results table updates (same values shown). No duplicate submission created. |
| ECT-066 | Excel with extra rows | Template has extra empty rows at the bottom | Parser handles gracefully — empty rows ignored, totals calculated correctly. |

---

### ECT-067 to ECT-077: DOW Pattern Logic Edge Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-067 | First-ever visit to a location | Controller selects a date for a location with no previous visits | No DOW warning shown (no history to compare against). Visit proceeds without acknowledgement. |
| ECT-068 | Only 1 previous visit | Controller visited once 3 weeks ago on a Tuesday, now selects next Tuesday | With 6-week lookback: 1 Tuesday in 6 weeks does not trigger the warning (pattern = 2+ same-DOW visits). |
| ECT-069 | 2 visits on same DOW within lookback | Visited Tuesday 2 weeks ago and 4 weeks ago. Now selects Tuesday again | Warning triggered. Reason required. |
| ECT-070 | DOW lookback = 4 weeks (configured) | Admin sets DOW window to 4 weeks. Controller visits were 5 weeks ago on same DOW | No warning — 5 weeks ago is outside the 4-week window. |
| ECT-071 | DOW matches but different location | Controller visited Location A on Tuesday last week. Now books Location B on Tuesday | No warning — DOW check is per location, not per controller globally. |
| ECT-072 | Missed visit counts in DOW check | A MISSED visit on a Tuesday 2 weeks ago — does it count? | Only COMPLETED visits should trigger DOW warnings. Missed visits ignored in the DOW pattern check. |
| ECT-073 | Scheduled (not yet completed) counts? | A SCHEDULED upcoming visit on a Tuesday — does it block another Tuesday? | Scheduled visits should NOT count toward DOW pattern (only completed ones). But they block that specific date (duplicate date check). |
| ECT-074 | Warning fires on amber calendar dot | Controller hovers on a date that would trigger DOW warning | Amber dot visible on that date before clicking. Tooltip or indicator explains "Pattern risk". |
| ECT-075 | DOW warning on bank holidays | Select a date that is a bank holiday AND has DOW pattern | DOW warning still fires (system doesn't know about bank holidays). Warning message unrelated to holiday. |
| ECT-076 | DOW reason not required without warning | Controller selects a date with no DOW pattern | No reason dropdown shown. No additional field required. |
| ECT-077 | Change date — warning disappears | Controller sees DOW warning for Tuesday, changes to Wednesday | Warning panel hides automatically when a non-warning date is selected. |

---

### ECT-078 to ECT-088: Permissions & Role Boundary Edge Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-078 | Operator with no locations assigned | Admin creates an operator without assigning any locations | Operator logs in and sees empty dashboard with message: "No locations assigned. Contact your administrator." |
| ECT-079 | Manager with no locations assigned | Admin creates a manager without assigning locations | Manager sees empty approvals queue with message: "No locations assigned to you." |
| ECT-080 | Operator assigned to deactivated location | Operator is assigned to a location that admin deactivates | Operator's dashboard still shows the location (historical data). Cannot submit new records for an inactive location — submit button hidden or shows "Location inactive". |
| ECT-081 | Auditor tries to approve via URL | Auditor manually constructs POST request to /v1/submissions/{id}/approve | 403 Forbidden. Auditor role has read-only access. Action not executed. |
| ECT-082 | API access without token | Any API call made without Authorization header | 401 Unauthorized. Error: "Not authenticated." |
| ECT-083 | Expired token reused | User's JWT expires (after 24 hours), old token used again | 401 Unauthorized. "Token has expired." Frontend redirects to Login. |
| ECT-084 | Tampered JWT | User manually modifies their JWT payload to change role to "ADMIN" | JWT signature verification fails. 401 Unauthorized. |
| ECT-085 | Manager approves submission outside their locations | Manager constructs API call to approve a submission for a location not assigned to them | 403 Forbidden: "You do not have permission to action submissions for this location." |
| ECT-086 | Operator submits for another location | Operator constructs API call with a locationId not assigned to them | 403 Forbidden: "You are not assigned to this location." |
| ECT-087 | Self-approval attempt | An operator who is also a manager tries to approve their own submission | 403 Forbidden: "You cannot approve your own submission." |
| ECT-088 | Deactivated user's token still valid | Admin deactivates a user who is currently logged in (active session) | On next API call, server checks `user.active` field. Returns 401: "Your account has been deactivated." |

---

### ECT-089 to ECT-098: Submission State Machine Edge Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-089 | Approve an already-approved submission | API call: POST /submissions/{id}/approve on an already APPROVED submission | 409 Conflict: "Submission is already approved." |
| ECT-090 | Reject an already-rejected submission | API call: POST /submissions/{id}/reject on an already REJECTED submission | 409 Conflict: "Submission is already rejected." |
| ECT-091 | Approve a draft (not submitted) | API call to approve a DRAFT submission | 409 Conflict: "Cannot approve a draft. Submission must be finalized first." |
| ECT-092 | Resubmit an approved submission | Operator clicks Resubmit on an already-approved submission | Button should not be visible for approved submissions. If API called directly: 409 "Cannot modify an approved submission." |
| ECT-093 | Submit for a past date (historical backfill) | Operator manually tries to submit for a date 10 days ago | If system allows backdating: submission created with correct past date. If not: error "Cannot submit for past dates." (Policy decision — document which behaviour is intended.) |
| ECT-094 | Variance exception flag survives approval | Submit with 8% variance + note, manager approves | `variance_exception = true` remains on the submission permanently. Approval does not clear the flag. |
| ECT-095 | Reject reason not stored if blank | Manager approves after clicking Reject, clearing the reason field | System re-validates: reason required before rejection. Cannot clear reason and still reject. |
| ECT-096 | Draft with zero total | Operator saves draft with all zeros | Draft saved. No error. When operator tries to submit this draft, error: "Please enter at least one cash value." |
| ECT-097 | Missing submission logged twice | Operator tries to log a missed submission for a date already explained | Error: "An explanation for this date already exists." No duplicate created. |
| ECT-098 | Missed submission for a date with a draft | Date has a saved draft AND operator tries to log it as missed | Error: "A draft exists for this date. Please complete or delete the draft before logging it as missed." |

---

### ECT-099 to ECT-106: Email Notification Edge Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-099 | Email with invalid address in DB | User's email in DB has been corrupted (e.g., missing @) | Email service catches the send error, logs it, but does not crash the main API call. |
| ECT-100 | SLA warning sent twice | Server restarts between the 36h check and the 48h check | `sla_warning_sent` flag prevents second warning email. |
| ECT-101 | No managers for a location | Submission created for location with no managers assigned | Variance exception / pending approval emails cannot be sent. Log a warning in the server log. Admin gets the email instead. |
| ECT-102 | Daily reminder not sent on weekends | System is configured for Mon–Fri operations | If today is Saturday or Sunday, daily reminder job skips all sends. |
| ECT-103 | Operator has no email | User created without an email address (unlikely but defensive) | System skips email send silently. Logs: "No email for user {id} — skipping EN-001." |
| ECT-104 | End-of-month alert — all visited | DGM has visited all locations. 25th arrives. | EN-015 not sent (all locations visited). No unnecessary email. |
| ECT-105 | Multiple managers — one email each | Location has 3 assigned managers. Submission created. | Each manager receives their own EN-006 email (not a group email). Each email personalised with their name. |
| ECT-106 | Email bounce handling | A user's email address bounces (mailbox full, invalid domain) | AWS SES bounce notification received. Backend logs the bounce. After 3 bounces, flag user email as invalid and notify admin. |

---

### ECT-107 to ECT-115: Compliance Dashboard Edge Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| ECT-107 | All locations compliant | All locations have submitted + approved today, controller + DGM up to date | Overall Compliance = 100%. Action Required panel does not appear. All rows show "✓ Compliant" in green. |
| ECT-108 | No submissions ever | Fresh install, no data | KPIs all show 0. Table shows all locations as "⚠ At Risk". 30d Rate = 0%. No crash. |
| ECT-109 | Single location setup | System has only 1 location | Compliance % = either 0% or 100%. KPIs show "/1". No divide-by-zero. |
| ECT-110 | Location with no controller verifications | Brand-new location never visited by controller | Controller column shows "No visits yet" in gray. Health badge = At Risk. |
| ECT-111 | Controller visited today | Controller just completed a visit today | "Last: today" shown. dSinceCtrl = 0. Badge shows green. |
| ECT-112 | DGM visited on 1st, now 30th | DGM visited Jan 1. Now it's Jan 30. | DGM column still shows "Visited · 1 Jan". Green. Monthly coverage satisfied. |
| ECT-113 | 30d Rate on day 1 | System launched today. Only 1 possible past day (yesterday). | pastOnly = 1 day. Rate = 0% if no submission yesterday, 100% if one. No divide-by-zero. |
| ECT-114 | Action required panel — more than 20 items | All 5 locations have 4+ issues each | Panel scrolls. All items listed. Count badge shows total (e.g., "22"). |
| ECT-115 | Late DGM alert — only shows after day 20 | Day 19 of month, DGM not visited | "DGM not logged for February (12d remaining)" advisory NOT shown yet (only after day 20). |

---

*End of Developer Handover Document*
*Document version: 1.1 — Added Email Specifications + Edge Case Test Scenarios*
*Document generated: February 2026*
*Frontend version: React 18 + Vite + TypeScript (mock data)*
*Backend to build: FastAPI + PostgreSQL + AWS*

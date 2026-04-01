# CashRoom Compliance System - Changes Summary (March 30 - April 1, 2026)

This document explains the changes made over the past two days from a business and user perspective.

---

## 1. Visit Completion Workflow (Controller & DGM)

### Mark as Completed
When a controller or DGM has physically visited a location, they can mark the scheduled visit as completed. This button appears **only when the visit date is today** (or recent past dates). The completion flow works as follows:

1. **Controller clicks "Mark as Completed"** on their Weekly Visits dashboard
2. An inline panel expands showing:
   - **View & Approve** button — takes the controller to the full cash count form where they can see all the numbers (Sections A through K) and accept or reject each section
   - **Submission status** — shows whether the operator's form has been approved, is pending, or was rejected
   - **Submission Total** — the total cash amount from the approved form
   - **Notes** field (optional)
   - **Digital Signature** — the controller must sign to confirm the visit
   - **Confirm Completion** button (only enabled after signing)
3. The controller cannot complete the visit until the operator's submission is approved
4. Same workflow applies for **DGM**, with the additional requirement that the controller must have approved the submission first

### Mark as Missed
When a scheduled visit was not carried out, it should be marked as missed. This button appears **only for past dates** (the visit day has passed). The user must provide:
- A reason for missing the visit
- Optional notes

Missed visits are tracked in compliance reports and visible in the dashboard with a "View Missed" button that shows the reason and notes.

### Cancel Visit
Scheduled visits that haven't happened yet can be cancelled. This is available for **future dates and today** (before the visit time). Past scheduled visits can also be cancelled since they were never actually carried out. Cancelled visits don't count toward the monthly/weekly scheduling blocks.

---

## 2. Scheduling Rules

### Controller - Business Week Block (Mon-Fri)
- A controller cannot schedule two visits to the same location in the same business week (Monday to Friday)
- **Weekends are blocked** — Saturday and Sunday cannot be selected
- A visit on Wednesday blocks Mon-Fri of that week, but the next Monday is open
- The calendar shows blocked weekdays with a **red dot** and they cannot be clicked
- A **Day-of-Week (DOW) warning** appears in amber when the controller tends to visit on the same weekday — this is advisory only and doesn't prevent scheduling

### DGM - Calendar Month Block
- A DGM cannot schedule two visits to the same location in the same calendar month
- A visit on January 31 allows the next visit on February 1 (different month)
- The calendar shows blocked dates with a **red dot** (matching the controller's style)
- Dates with existing visits show a **green dot** and cannot be clicked
- A "Visit Already Scheduled" message appears if the user selects the existing visit date
- **DOM (Day-of-Month) warning** appears in amber when the same day-of-month pattern is detected — advisory only

---

## 3. Section-by-Section Review (A through K)

### Daily Review (Complete Review)
When a controller reviews an operator's cash count submission:
- Each section (A through K) can be individually **Accepted** or **Rejected**
- Rejected sections require a written note explaining why
- If any section is rejected, the entire submission is rejected
- The rejection notes are stored per section and displayed under each section heading when the operator views their rejected form

### Visit Verification
When completing a visit, the "View & Approve" button takes the controller or DGM to the full submission form where they can:
- See all cash count numbers (denominations, totals, variance)
- Accept or Reject each section (A through K)
- After reviewing, they return to the dashboard to sign and confirm

### Sections Covered
- **A** — Currency (bills by denomination)
- **B** — Rolled Coin
- **C** — Coins in Counting Machines
- **D** — Bagged Coin
- **E** — Unissued Changer Funds
- **F** — Returned but Uncounted Manual Change
- **G** — Mutilated Currency, Foreign, and/or Bent Coin
- **H** — Changer Funds Outstanding
- **I** — Net Unreimbursed Bill Changer Shortage / (Overage)
- **J** — Replenishment
- **K** — Coin Purchase in Transit to / from Bank

---

## 4. Operator Form Changes

### Save Changes vs Save Draft
- **Save Draft**: Available when the operator is working on a new form or editing a draft. Saves progress without submitting.
- **Save Changes**: Available when the operator is editing an already-submitted (pending approval) form. Updates the values while keeping the submission in pending state — the controller will see the updated numbers immediately.

### Discard Button
The Discard button is only shown for **drafts and new forms**. Once a form has been submitted for approval (pending, approved, or rejected), the Discard button is hidden to prevent accidental deletion.

### Draft Handling
- Each operator can only have **one draft per location per date** — saving a draft for the same location and date updates the existing draft instead of creating a duplicate
- Drafts are **private** — only visible to the operator who created them. Other operators, controllers, DGMs, and admins cannot see drafts
- Resuming a draft loads the actual saved data from the server

### Rejection Display
When a controller rejects a submission with per-section notes:
- Only **one** rejection banner is shown (previously showed two)
- Each rejected section's card displays the rejection reason directly below the section header in red
- The "Pre-filled from Previous Submission" banner is hidden when editing a rejected form

---

## 5. Dashboard & Display Fixes

### KPI Cards
- Values no longer truncate with "..." — Total Fund, Variance, and dates now display in full
- Fixed across all screens: Operator, Controller, DGM, Admin, Regional Controller

### DGM Coverage Dashboard KPIs
- **Visited This Month**: Now counts both completed AND scheduled visits (previously only completed)
- **Remaining**: Updated to reflect scheduled visits
- **Overdue Months**: Only counts months where the system had activity — a fresh system with no historical data shows 0 instead of counting all locations as overdue

### RC Business Dashboard
- Removed the 1100px width cap — now uses full screen width
- Location Health table scrolls horizontally on mobile devices

### View Form (OpReadonly)
- All values (Total Cash, Variance, Imprest) come directly from the server — no client-side recalculation
- Added Replenishment (Section K) row in the summary
- Currency changed from British Pounds (£) to US Dollars ($) across all displays

---

## 6. Email Notifications

### Subject Lines Fixed
Email subjects previously showed garbled characters (like `=?utf-8?q?...`) due to special characters. All subjects now use plain ASCII dashes:
- "Submission Pending Approval - Location Name Date"
- "Submission Rejected - Location Name Date"
- "Controller Visit Scheduled - Location Name Date"
- "DGM Visit Scheduled - Location Name Date"
- And all other notification types

### Currency in Emails
Changed from £ (British Pounds) to $ (US Dollars) in all email body content.

---

## 7. Global Default Tolerance

When an admin changes the global default tolerance percentage in System Settings:
- **All** location-specific overrides are cleared
- Every location immediately picks up the new global value
- This ensures consistency — no location retains an old tolerance after a global change

---

## 8. Admin & Import Screen

### Import Roster
- The Reset button is now aligned next to the Import button (was floating toward the middle)

### Location Management
- Error messages are shown when location create/update fails (was silently failing)

---

## 9. Audit Trail

### Per-Section Rejection Data
When a controller rejects a submission, the audit trail stores:
- The global rejection reason
- Per-section decisions (Accept/Reject for each section A-K with individual notes)

### Visit Section Reviews
When a visit is completed, the section-by-section verification decisions are stored on the visit record for audit purposes.

---

## 10. Docker Deployment

- Docker entrypoint now seeds demo data automatically (demo accounts with password `demo1234`)
- Seed data uses the current date instead of a hardcoded date, so dashboards show relevant data on first boot
- Single command deployment: `docker compose up --build`

---

## 11. DGM Review (Controller Screen)

### Review DGM Visits
- "View" button on completed DGM visits now navigates to the **full submission form** showing all cash count numbers — not just an inline summary
- Missed visits show a "View Missed" button with reason and notes in an expand panel
- Notes from missed visits are visible in the table row

---

## Quick Reference: Visit Action Button Logic

### When does each button appear?

For a **scheduled** visit, the action buttons depend on the visit date, time, and configurable SLA window (`approval_sla_hours`, default 48hrs):

#### Controller (has scheduled time)

| Scenario | Mark as Completed | Mark as Missed | Cancel |
|----------|:-----------------:|:--------------:|:------:|
| **Future date** | Yes | - | Yes |
| **Today, before scheduled time** | Yes | - | Yes |
| **Today, after scheduled time, within SLA** | Yes | Yes | - |
| **Today, after SLA window** | - | Yes | - |
| **Past date, within SLA window** | Yes | Yes | - |
| **Past date, after SLA window** | - | Yes | - |

Example with SLA = 48hrs, visit scheduled for Monday 09:00:
- Before Monday 09:00 — Complete + Cancel
- Monday 09:00 to Wednesday 09:00 — Complete + Miss
- After Wednesday 09:00 — Miss only

#### DGM (no scheduled time, SLA from start of visit date)

| Scenario | Mark as Completed | Mark as Missed | Cancel |
|----------|:-----------------:|:--------------:|:------:|
| **Future date** | Yes | - | Yes |
| **Today** | Yes | - | Yes |
| **Past date, within SLA window** | Yes | Yes | - |
| **Past date, after SLA window** | - | Yes | - |

Example with SLA = 48hrs, visit on Monday:
- Monday and Tuesday — Complete + Cancel
- Wednesday (48hrs passed) — Complete + Miss
- Thursday onwards — Miss only

### For completed/missed/cancelled visits

| Visit Status | Button Shown |
|-------------|-------------|
| Completed | View Completed (expands to show notes + signature) |
| Missed | View Missed (expands to show reason + notes) |
| Cancelled | No action — row shown for reference only |

### What happens on each action?

| Action | What It Does | Requirements |
|--------|-------------|-------------|
| **Mark as Completed** | Opens expand panel with View & Approve + Notes + Signature + Confirm | Submission must be approved first |
| **Mark as Missed** | Opens expand panel with reason dropdown + notes + confirm | Reason is required |
| **Cancel** | Immediately cancels the visit (with confirmation) | Visit must be in scheduled state |

### Mark as Completed — detailed gate logic

| Role | Gate Check | If Not Met |
|------|-----------|------------|
| **Controller** | Operator's submission must be approved in Daily Review | Shows lock message with status: pending review / rejected / not yet submitted |
| **DGM** | Operator's submission must be approved | Shows lock message with status: pending review / rejected / not yet submitted |

Once the gate passes, the expand panel shows:
1. **View & Approve** button — navigates to full form with section-by-section Accept/Reject (A-K)
2. **Submission Total** — read-only amount from the approved form
3. **Notes** — optional text field
4. **Digital Signature** — required canvas signature
5. **Confirm Completion** — only enabled after signing

---

## Quick Reference: Operator Form Buttons

| Button | When Visible | What It Does |
|--------|-------------|-------------|
| Save Draft | New form or editing a draft | Saves progress without submitting |
| ~~Save Changes~~ | ~~Editing a pending approval submission~~ | **Removed** — operator cannot modify while under review |
| Submit for Approval | New form, draft, or rejected resubmit | Submits to controller for review |
| Discard | Drafts only | Deletes the draft permanently |
| Submit Review | Controller reviewing a pending submission | Approves or rejects based on section decisions |

---

## Quick Reference: Calendar Date States

### Controller Schedule Visit

| Date State | Appearance | Clickable? |
|-----------|-----------|:----------:|
| Past date | Grey, faded | No |
| Existing visit (booked) | Green background + green dot | No |
| Same-week blocked | Red background + red dot | No |
| Weekend (Sat/Sun) | Grey, faded | No |
| DOW warning | Amber background + amber dot | Yes (warning only) |
| Available | Normal | Yes |
| Selected | Blue | Yes |

### DGM Schedule Visit

| Date State | Appearance | Clickable? |
|-----------|-----------|:----------:|
| Past date | Grey, faded | No |
| Existing visit date | Green background + green dot | No |
| Same month as visit | Red background + red dot | No |
| DOM warning | Amber background + amber dot | Yes (warning only) |
| Available | Normal | Yes |
| Selected | Blue | Yes |

---

## Bug Fixes Summary

| Issue | Before | After |
|-------|--------|-------|
| KPI values truncated ("$10,850....") | Text cut off with ellipsis | Full values always visible |
| Multiple drafts for same location/date | Duplicate drafts created | Existing draft updated instead |
| Resume draft shows wrong data | Loaded empty form | Loads specific draft data from API |
| DGM empty location dropdown | No locations shown | Auto-populated from API |
| Rejection banner shown twice | Two identical red banners | Single rejection banner |
| Prefill banner on rejected edit | "Pre-filled from Previous Submission" shown incorrectly | Hidden when editing existing submissions |
| Global tolerance not applying | Only affected new locations | Clears all overrides, applies to all locations |
| Email subjects garbled | UTF-8 encoded characters in subject | Plain ASCII dashes |
| Currency showing £ | British pounds in emails and UI | US dollars ($) everywhere |
| DGM scheduling on same date | Could book same date twice | Backend blocks duplicate dates |
| DGM reschedule not working | Reschedule was mocked (no API call) | Cancels old visit + schedules new one |
| Overdue months showing 31 | Counted all months since January | Only counts months with system activity |
| View form recalculating totals | Client-side math could differ from API | Uses API values directly |
| Replenishment missing from view | Section K not displayed | Added as separate section card |
| "Go to Daily Review" wrong nav | Navigated to Weekly Review (same page) | Fixed to navigate to Daily Review |
| Cancelled visit no status shown | Showed "—" for cancelled visits | Added ⊘ Cancelled badge, filter, dimmed rows |
| Section review not captured | Only Section A saved on visit completion | All sections A-K now saved via sessionStorage |
| Audit event types misaligned | Filter showed phantom types | Aligned with 22 actual backend event types |
| Audit table cluttered | Location & Change columns mostly blank | Removed — cleaner 4-column table |
| Global defaults not updating | State not refreshed after save | Captures API response, updates immediately |
| Excel import: operators skipped | Used wrong field (daily_reviewer vs cashroom_lead) | Fixed field mapping + role update on re-import |
| Variance hardcoded 5%/2% | All screens used hardcoded thresholds | Now uses configurable `default_tolerance_pct` from admin |
| Operator Update button race condition | Could update while controller reviewing | Hidden when status is pending_approval |
| Users filter ignores access grants | DGM with operator grant not shown under Operator filter | Filter includes users with matching access grants |
| DGM gate checked controller visit | Gate message referenced controller | Now checks operator submission status directly |
| Scheduler log said UTC | Log incorrectly stated "UTC" | Fixed to "local time" (APScheduler already uses local) |
| Controller spacing: 7-day rolling | Rigid 7-day gap | Changed to business week (Mon-Fri) |
| DGM spacing: 30-day rolling | Rigid 30-day gap | Changed to calendar month |
| Completion window: 5hrs hardcoded | Fixed 5-hour window | Uses configurable `approval_sla_hours` (default 48hrs) |
| Time comparisons: UTC | Mixed UTC and local time | All use server local time |
| Complete button: today only | Only shown on visit date | Shown immediately, hidden after SLA expires |
| Variance recalculated client-side | Frontend computed with IMPREST fallback | All variance from API (submission + verification) |

---

## Test Coverage

- **269 automated E2E test cases** across 31 test files
- All passing against the current backend
- Covers: operator workflows, controller/DGM scheduling, audit trail, draft lifecycle, password flows, duplicate prevention, visit cancellation, rejection/resubmit cycles

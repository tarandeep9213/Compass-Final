# Compass Phase 3 — Alarm Testing Module: Test Cases

**Version:** 1.0
**Date:** 2026-04-06
**Status:** Pending implementation (Playwright E2E)

---

## Screen 1: Alarm Test Form (Monthly Alarm Test)

**Login:** `controller@compass.com` or `dgm@compass.com` / `demo1234`
**Navigation:** Sidebar → Alarm Testing

---

### A. Page Load & Header (4)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1 | Page title | Shows "Monthly Alarm Test" |
| 2 | Subtitle | Shows "Complete zone-by-zone testing for your assigned building" |
| 3 | "View History" button | Visible, navigates to `alarm-history` |
| 4 | "Biannual Checks" button | Visible, navigates to `biannual-check` |

### B. Building Selector Card (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 5 | Card title | Shows "Select Building" |
| 6 | Dropdown label | Shows "Building" |
| 7 | Default placeholder | Shows "-- Select a building --" |
| 8 | Dropdown options | Lists all buildings in format "Name — Security Company" |
| 9 | Select a building | Green security info box appears with company name, customer ID, phone |
| 10 | No building selected | Security info box is hidden |
| 11 | Change building | Resets zones, files, notes, dates, start/end time |
| 12 | LocationIds filter | Dropdown filters by user's locationIds (falls back to all in demo mode) |

### C. Rejection Notification Banners (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 13 | Banner visibility | Appears for each rejected test where testerName matches logged-in user |
| 14 | Banner styling | Red left border, red background, error icon |
| 15 | Banner title | Shows "Test Rejected — [Building Name] ([Month])" |
| 16 | Banner reason | Shows "Reason: [rejection reason]" |
| 17 | Empty reason | Shows "No reason provided" when rejectionReason is empty |
| 18 | "Fix & Resubmit" button | Selects the building, dismisses the banner |
| 19 | "Fix & Resubmit" toast | Shows info toast "Rejected test loaded for editing..." |
| 20 | Dismiss (X) button | Hides the banner without selecting the building |

### D. Duplicate Test Block (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 21 | Approved block | Green block banner appears when building has APPROVED test this month |
| 22 | Approved text | "This building already has an approved test for this month." |
| 23 | Approved subtext | "No additional test is needed..." |
| 24 | Submitted block | Amber block banner appears when building has SUBMITTED test this month |
| 25 | Submitted text | "This building already has a test submitted for approval this month." |
| 26 | Submitted subtext | "Please wait for the approver..." |
| 27 | Block "View History" button | Navigates to `alarm-history` |
| 28 | Form hidden | Test form (Details, Zones, Upload, Footer) is completely hidden when block banner shows |

### E. Test Details Card (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 29 | Card title | Shows "Test Details" |
| 30 | Date default | Date input defaults to today's date |
| 31 | Date editable | Date input can be changed |
| 32 | Tester name value | Shows logged-in user name |
| 33 | Tester name disabled | Input is disabled (not editable) |
| 34 | Start time | Editable time input |
| 35 | End time | Editable time input |
| 36 | General notes | Editable textarea with placeholder "Optional notes about this test..." |

### F. Zone Testing Checklist Card (16)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 37 | Card title | Shows "Zone Testing Checklist" |
| 38 | Summary bar | ZoneSummaryBar appears in header when zones exist |
| 39 | Loading state | "Loading zones..." text shows while zones are loading |
| 40 | No zones warning | "No zones configured for this building. Contact admin." for building with 0 zones |
| 41 | No building prompt | "Select a building to view zones." when no building is selected |
| 42 | Zone grouping | Zones grouped by type with section headers (Entry/Exit Doors, Interior Motion, etc.) |
| 43 | Section header | Shows group name and count, e.g. "ENTRY / EXIT DOORS (5)" |
| 44 | Zone row content | Each zone shows zone number badge and zone name |
| 45 | Area badge | Shows area badge if areaNumber > 1 |
| 46 | "Tested" pill | Clicking marks zone green (background + border color change) |
| 47 | "Not Tested" pill | Clicking marks zone red |
| 48 | "Issue" pill | Clicking marks zone amber |
| 49 | Change selection | Clicking a different pill on same zone changes the selection |
| 50 | Expand arrow (▼) | Toggles notes textarea for that zone |
| 51 | Notes textarea | Appears below zone when expanded, with placeholder "Add notes..." |
| 52 | Notes onChange | Typing in notes textarea persists the note text |

### G. ZoneSummaryBar in Header (4)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 53 | Tested segment | Green segment reflects tested count |
| 54 | Not-tested segment | Red segment reflects not-tested count |
| 55 | Issue segment | Amber segment reflects issue count |
| 56 | Real-time update | Bar updates immediately as zones are marked |

### H. File Upload Card (11)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 57 | Card title | Shows "Alarm Company Report" |
| 58 | Drop zone text | Shows "Drag files here or click to browse" |
| 59 | Accepted formats | Shows "Accepted: .pdf,.xlsx,.xls · Max 25 MB" |
| 60 | Click to browse | Clicking drop zone opens file browser |
| 61 | Drag hover | Dragging file over changes border to green, background to light green |
| 62 | Drop valid file | Dropping a valid file adds it to the file list |
| 63 | File list display | Shows file icon, file name, file size, "Remove" button |
| 64 | Remove button | Removes file from list and calls deleteAttachment API |
| 65 | Upload API | Adding file calls uploadAttachment API when draft exists |
| 66 | Oversized file | Files exceeding 25MB show error message with file name |
| 67 | Info box | Shows "Upload the Customer Activity Report from your security company. PDF format preferred." |

### I. Auto-Save (6)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 68 | Debounced trigger | Marking a zone triggers debounced auto-save after 1 second |
| 69 | Create draft | Auto-save creates a new DRAFT test if none exists |
| 70 | Update draft | Auto-save updates existing draft if draftId exists |
| 71 | Zone persistence | Auto-save persists zone results via saveTestZones API |
| 72 | Timestamp | "Saved HH:MM" timestamp appears in status text after auto-save |
| 73 | Zone count | Status text shows "X/Y zones marked" count |

### J. Save Draft Button (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 74 | Button text | Shows "Save Draft" |
| 75 | Disabled no building | Disabled (faded, cursor not-allowed) when no building selected |
| 76 | Disabled saving | Disabled when saving is in progress |
| 77 | Saving text | Text changes to "Saving..." while in progress |
| 78 | Create new | Creates new draft if none exists |
| 79 | Update existing | Updates existing draft if draftId exists |
| 80 | Saves all data | Saves zone results and attachments |
| 81 | Success toast | Toast "Draft saved" on success |
| 82 | Error toast | Toast "Failed to save draft" on error |

### K. Submit for Approval Button (12)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 83 | Button text | Shows "Submit for Approval" |
| 84 | Disabled no zones | Disabled (faded, cursor not-allowed) when no zones are marked |
| 85 | Disabled no files | Disabled when no files are uploaded |
| 86 | Disabled saving | Disabled when saving is in progress |
| 87 | Saving text | Text changes to "Submitting..." while in progress |
| 88 | Unmarked zones dialog | Confirm "X zones have not been marked. Continue?" when unmarked zones exist |
| 89 | Cancel unmarked dialog | Cancelling the dialog aborts submission |
| 90 | Not Tested dialog | Confirm "X zones are marked as Not Tested. Are you sure?" when Not Tested zones exist |
| 91 | Cancel Not Tested dialog | Cancelling the dialog aborts submission |
| 92 | Success toast | Toast "Test submitted for approval" on success |
| 93 | Navigation | Navigates to `alarm-history` after successful submission |
| 94 | Error toast | Toast "Failed to submit test" on error |

### L. Draft Restoration (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 95 | Auto-load draft | Selecting a building with existing DRAFT auto-loads it |
| 96 | Restore date | Draft restoration populates test date |
| 97 | Restore times | Draft restoration populates start time and end time |
| 98 | Restore notes | Draft restoration populates notes |
| 99 | Restore zones | Draft restoration populates zone results (tested/not-tested/issue per zone) |
| 100 | Restore files | Draft restoration populates uploaded files from API |
| 101 | Status text | Shows "Draft loaded" when draft is loaded without a fresh save |
| 102 | DraftId set | DraftId is set so subsequent saves update rather than create |

### M. Rejected Test Restoration (5)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 103 | Reopen status | Selecting a building with REJECTED test reopens it (status changes to DRAFT) |
| 104 | Restore zones | Rejected test zone results are fully restored |
| 105 | Restore metadata | Rejected test dates/times/notes are restored |
| 106 | Restore files | Rejected test attachments are restored |
| 107 | Draft priority | Draft preferred over rejected if both exist for same building |

### N. Continue from History (ctx) (3)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 108 | Auto-select building | When navigated with ctx.buildingId, building auto-selects on load |
| 109 | Full restore | Full draft state restores (zones, dates, notes, files) |
| 110 | Works for rejected | Works for both DRAFT and REJECTED tests |

### O. Status Text Bar (5)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 111 | Empty state | Shows empty when no zones marked and no saves |
| 112 | Zones marked | Shows "X/Y zones marked" when zones are marked |
| 113 | After save | Shows "Saved HH:MM" after a save |
| 114 | Combined | Shows "X/Y zones marked · Saved HH:MM" when both apply |
| 115 | Draft loaded | Shows "Draft loaded" when draft is loaded but not yet saved |

### P. View Button Data Integrity — History → AlarmReview (7)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 116 | View navigates | Clicking "View" on a SUBMITTED test in history opens AlarmReview with correct test data |
| 117 | Building name match | AlarmReview shows correct building name matching the history row |
| 118 | Test date match | AlarmReview shows correct test date matching the history row |
| 119 | Tester name match | AlarmReview shows correct tester name matching the history row |
| 120 | Zone count match | AlarmReview shows correct zone count (tested/total) matching the history row |
| 121 | Status badge match | AlarmReview shows correct status badge matching the history row |
| 122 | Files match | AlarmReview shows correct attached files that were uploaded during test |

### Q. Continue Button Data Integrity — History → AlarmTestForm (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 123 | Building pre-selected | Clicking "Continue" on a DRAFT opens AlarmTestForm with correct building pre-selected |
| 124 | Date match | Restored test date matches the draft's testDate shown in history |
| 125 | Times match | Restored start/end time matches the draft's values |
| 126 | Notes match | Restored notes matches the draft's notes |
| 127 | Zone states match | Restored zone results match — each zone has the same Tested/Not Tested/Issue state as when saved |
| 128 | Zone notes match | Expanded notes on individual zones are preserved |
| 129 | Files match | Restored files match — same file names and count as when draft was saved |
| 130 | Summary bar match | ZoneSummaryBar counts (tested/not-tested/issues) match the history row's zone counts |

### R. Duplicate Submission Prevention — End-to-End (9)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 131 | Submit then reselect | After submitting a test for Building A, re-selecting Building A shows amber "already submitted" block |
| 132 | Submit block hides form | After submission block appears, test form (Details, Zones, Upload, Footer) is hidden |
| 133 | Approve then reselect | After a test is approved for Building A, re-selecting Building A shows green "already approved" block |
| 134 | Approve block hides form | After approved block appears, test form is hidden |
| 135 | Rejected allows edit | After a test is rejected for Building A, re-selecting Building A loads the rejected test for editing (no block) |
| 136 | Resubmit rejected | After editing a rejected test, submitting it changes status back to SUBMITTED |
| 137 | Second rejection edit | After a resubmitted test is rejected again, tester can edit and resubmit again |
| 138 | Different building allowed | After submitting for Building A, selecting Building B still allows a new test |
| 139 | Different month allowed | A building with an approved test last month does not block the current month |

---

**Screen 1 Total: 139 test cases**

---

## Screen 3: Alarm Test History

**Login:** `controller@compass.com` or `dgm@compass.com` / `demo1234`
**Navigation:** Alarm Testing → "View History" button

---

### A. Page Load & Header (3)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1 | Page title | Shows "Alarm Test History" |
| 2 | "← Back" button visible | Back button is displayed in header |
| 3 | "← Back" navigation | Clicking "← Back" navigates to `alarm-test-form` |

### B. KPI Cards (12)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 4 | KPI row visible | 4 KPI cards displayed in a row |
| 5 | "Tests This Year" label | Card shows "Tests This Year" |
| 6 | "Tests This Year" value | Shows count of all tests with testDate in current year |
| 7 | "Approved" label | Card shows "Approved" with green accent |
| 8 | "Approved" value | Shows count of APPROVED tests this year |
| 9 | "Pending Review" label | Card shows "Pending Review" with amber accent |
| 10 | "Pending Review" value | Shows count of SUBMITTED tests this year |
| 11 | "Rejected" label | Card shows "Rejected" with red accent |
| 12 | "Rejected" value | Shows count of REJECTED tests this year |
| 13 | KPI tooltip — Tests This Year | Info icon click shows "Total alarm tests recorded this calendar year." |
| 14 | KPI tooltip — Approved | Info icon click shows "Tests approved by the reviewer." |
| 15 | KPI tooltip — Rejected | Info icon click shows "Tests that were rejected by the reviewer." |

### C. Building Filter Dropdown (6)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 16 | Default value | Shows "All Buildings" as default |
| 17 | Options list | Lists all buildings the tester has access to |
| 18 | Filter by building | Selecting a building filters the table to only that building's tests |
| 19 | Reset to all | Selecting "All Buildings" shows tests for all buildings |
| 20 | Page reset | Changing building filter resets pagination to page 1 |
| 21 | LocationIds filter | Dropdown only shows buildings matching user's locationIds (falls back to all in demo) |

### D. Status Filter Pills (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 22 | All pills visible | 5 pills shown: All, Draft, Submitted, Approved, Rejected |
| 23 | Default active | "All" pill is active (green background) by default |
| 24 | Click "Draft" | Filters table to DRAFT tests only, pill becomes active |
| 25 | Click "Submitted" | Filters table to SUBMITTED tests only, pill becomes active |
| 26 | Click "Approved" | Filters table to APPROVED tests only, pill becomes active |
| 27 | Click "Rejected" | Filters table to REJECTED tests only, pill becomes active |
| 28 | Click "All" again | Removes status filter, shows all tests |
| 29 | Page reset | Changing status filter resets pagination to page 1 |

### E. Year Filter Dropdown (7)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 30 | Default value | Defaults to current year (2026) |
| 31 | Options | Shows "All Years", 2026, 2025, 2024, 2023 |
| 32 | Filter by year | Selecting a year filters to tests with testMonth starting with that year |
| 33 | "All Years" option | Selecting "All Years" removes year filter |
| 34 | Year change resets month | Changing year resets month dropdown to "All Months" |
| 35 | Page reset | Changing year filter resets pagination to page 1 |
| 36 | Year only filter | Selecting year without month shows all tests in that year |

### F. Month Filter Dropdown (7)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 37 | Default value | Shows "All Months" as default |
| 38 | Options | Lists all 12 months (January through December) |
| 39 | Disabled when no year | Month dropdown is disabled when year is "All Years" |
| 40 | Enabled when year selected | Month dropdown is enabled when a specific year is selected |
| 41 | Filter by month | Selecting a month filters to tests with exact testMonth match (e.g., "2026-03") |
| 42 | "All Months" option | Selecting "All Months" shows all tests in the selected year |
| 43 | Page reset | Changing month filter resets pagination to page 1 |

### G. Combined Filters (6)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 44 | Building + Status | Selecting Building A + "Approved" shows only approved tests for Building A |
| 45 | Building + Year + Month | Selecting Building A + 2026 + March shows only that building's March 2026 tests |
| 46 | Status + Year | Selecting "Rejected" + 2026 shows only rejected tests from 2026 |
| 47 | All filters combined | Building + Status + Year + Month all applied simultaneously |
| 48 | No results | When combination yields 0 results, shows empty state |
| 49 | Filter independence | Changing one filter doesn't reset other filters (except year resets month) |

### H. Empty State (3)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 50 | Empty icon | Shows bell icon (🔔) |
| 51 | Empty title | Shows "No tests found" |
| 52 | Empty subtitle | Shows "Adjust your filters or create a new test." |

### I. Table Headers (7)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 53 | Column: Building | Header shows "Building" |
| 54 | Column: Test Date | Header shows "Test Date" |
| 55 | Column: Month | Header shows "Month" |
| 56 | Column: Tester | Header shows "Tester" |
| 57 | Column: Zones | Header shows "Zones" |
| 58 | Column: Status | Header shows "Status" |
| 59 | Column: Actions | Header shows "Actions" |

### J. Table Row Data (9)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 60 | Building name | Shows building name (not ID), font-weight 500 |
| 61 | Test date | Shows test.testDate value |
| 62 | Test month | Shows test.testMonth value |
| 63 | Tester name | Shows test.testerName value |
| 64 | Zone summary bar | Shows ZoneSummaryBar with tested (green), not-tested (red), issues (amber) segments |
| 65 | Zone count text | Shows "tested/total" format (e.g., "15/18") |
| 66 | Status badge | Shows AlarmStatusBadge matching test.status (colored badge) |
| 67 | Sort order | Tests sorted by testDate descending (newest first) |
| 68 | Row data accuracy | Each row's data matches the corresponding test record from the API |

### K. Draft Row Behavior (5)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 69 | Row cursor | DRAFT rows have cursor: pointer (entire row is clickable) |
| 70 | Row click | Clicking a DRAFT row navigates to `alarm-test-form` with testId and buildingId in ctx |
| 71 | "Continue" button | DRAFT rows show green "Continue" button (btn-primary) instead of "View" |
| 72 | Continue click | "Continue" button navigates to `alarm-test-form` with testId and buildingId |
| 73 | Continue stopPropagation | "Continue" button click doesn't trigger row click twice |

### L. Non-Draft Row Behavior (5)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 74 | Row cursor | Non-draft rows have default cursor (not clickable) |
| 75 | Row click | Clicking a non-draft row does nothing |
| 76 | "View" button | SUBMITTED/APPROVED/REJECTED rows show "View" button (btn-ghost) |
| 77 | View click | "View" button navigates to `alarm-review` with testId and fromPanel: 'alarm-history' |
| 78 | View stopPropagation | "View" button click doesn't trigger row click |

### M. Pagination (12)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 79 | Page size | Maximum 10 rows per page |
| 80 | Showing text | Shows "Showing X–Y of Z tests" |
| 81 | Showing accuracy | X, Y, Z values are correct for the current page and total |
| 82 | "← Prev" button | Visible in pagination bar |
| 83 | Prev disabled page 1 | "← Prev" is disabled (faded) on first page |
| 84 | Prev click | Clicking "← Prev" goes to previous page |
| 85 | "Next →" button | Visible in pagination bar |
| 86 | Next disabled last page | "Next →" is disabled (faded) on last page |
| 87 | Next click | Clicking "Next →" goes to next page |
| 88 | Page number buttons | Page number buttons shown with current page highlighted (green bg, white text) |
| 89 | Page number click | Clicking a page number navigates to that page |
| 90 | Ellipsis | Shows "…" for gap in page numbers when total pages > 7 |

### N. Continue → Data Integrity (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 91 | Building pre-selected | After clicking "Continue", AlarmTestForm has the correct building selected |
| 92 | Date match | Restored test date matches the testDate shown in history row |
| 93 | Times match | Restored start/end time match the draft's saved values |
| 94 | Notes match | Restored notes match the draft's saved notes |
| 95 | Zone states match | Each zone has the same Tested/Not Tested/Issue state as when draft was saved |
| 96 | Zone notes match | Individual zone notes are preserved after restore |
| 97 | Files match | Same file names and count appear as when draft was saved |
| 98 | Summary bar match | ZoneSummaryBar counts in test form match the zone counts shown in history row |

### O. View → Data Integrity (7)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 99 | Navigation | Clicking "View" opens AlarmReview screen |
| 100 | Building name match | AlarmReview shows the same building name as history row |
| 101 | Test date match | AlarmReview shows the same test date as history row |
| 102 | Tester name match | AlarmReview shows the same tester name as history row |
| 103 | Zone count match | AlarmReview zone totals match history row's tested/total |
| 104 | Status badge match | AlarmReview status badge matches history row's status |
| 105 | Back navigation | AlarmReview "← Back" returns to alarm-history (fromPanel) |

### P. Status-Specific Behaviors (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 106 | DRAFT badge color | Draft status badge shows correct styling |
| 107 | SUBMITTED badge color | Submitted status badge shows correct styling |
| 108 | APPROVED badge color | Approved status badge shows green styling |
| 109 | REJECTED badge color | Rejected status badge shows red styling |
| 110 | DRAFT action | DRAFT shows "Continue" (green primary button) |
| 111 | SUBMITTED action | SUBMITTED shows "View" (ghost button) |
| 112 | APPROVED action | APPROVED shows "View" (ghost button) |
| 113 | REJECTED action | REJECTED shows "View" (ghost button) |

### Q. After Submission Reflection (6)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 114 | New test appears | After submitting a test from test form, navigating to history shows the new SUBMITTED test |
| 115 | KPI updates | "Pending Review" KPI count increases by 1 after submission |
| 116 | After approval | After a test is approved (via approver), history shows it as APPROVED |
| 117 | KPI after approval | "Approved" count increases, "Pending Review" decreases |
| 118 | After rejection | After a test is rejected, history shows it as REJECTED |
| 119 | KPI after rejection | "Rejected" count increases, "Pending Review" decreases |

### R. Edge Cases (5)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 120 | No tests at all | When user has zero tests, shows empty state with all KPIs at 0 |
| 121 | Building deleted | If a building is removed, test row shows buildingId fallback instead of name |
| 122 | Many tests pagination | With 25+ tests, pagination shows multiple pages with ellipsis |
| 123 | Same building multiple months | Tests for same building across different months all appear |
| 124 | Rejected then resubmitted | After fixing and resubmitting a rejected test, history shows updated SUBMITTED status |

---

**Screen 3 Total: 124 test cases**

---

## Screen 4: Biannual Compliance Checks

**Login:** `controller@compass.com` or `dgm@compass.com` / `demo1234`
**Navigation:** Alarm Testing → "Biannual Checks" button

---

### A. Page Load & Header (4)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1 | Page title | Shows "Biannual Compliance Checks" |
| 2 | Subtitle | Shows "Cellular backup and camera backup verification" |
| 3 | "← Back" button visible | Back button displayed in page header |
| 4 | "← Back" navigation | Clicking navigates to `alarm-test-form` |

### B. Building Selector (7)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 5 | Label | Shows "Select Building" |
| 6 | Default placeholder | Shows "— Choose a building —" |
| 7 | Options format | Lists buildings as "Name — Region" |
| 8 | LocationIds filter | Dropdown filters by user's locationIds (falls back to all in demo) |
| 9 | No building selected | No cards or history table shown below selector |
| 10 | Select a building | Two side-by-side cards (Cellular + Camera) and history table appear |
| 11 | Change building | Resets both forms (dates, results, notes, files, days verified) and resets pagination to page 1 |

### C. Cellular Backup Card — Header & Last Check Info (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 12 | Card title | Shows "Cellular Backup Test" |
| 13 | Status dot — green | Green dot when last check is COMPLIANT and not overdue |
| 14 | Status dot — red | Red dot when next due date has passed (overdue) |
| 15 | Status dot — gray | Gray dot when no previous check exists |
| 16 | Last check info visible | Shows last check box when a previous cellular check exists |
| 17 | Last check date | Shows formatted check date (e.g., "Mar 15, 2026") |
| 18 | Last check by | Shows checkedByName |
| 19 | Last check status + next due | Shows status badge (Compliant/Non-Compliant) and formatted next due date |

### D. Cellular Backup Card — Compliant Block (3)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 20 | Block shown | Green block message shown when last cellular check is COMPLIANT and next due date is in the future |
| 21 | Block text | Shows "Cellular backup is compliant." |
| 22 | Block subtext | Shows "Next check due: [date]. No new check needed until then." |

### E. Cellular Backup Card — New Check Form (11)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 23 | Form visible | "Record New Check" form shown when not blocked (no compliant check or overdue) |
| 24 | Section title | Shows "Record New Check" |
| 25 | Check Date label | Shows "Check Date" |
| 26 | Check Date default | Defaults to today's date |
| 27 | Check Date editable | Date input can be changed |
| 28 | Result label | Shows "Result" |
| 29 | "Pass" pill | Clicking marks green (green background, green border) |
| 30 | "Fail" pill | Clicking marks red (red background, red border) |
| 31 | Pill toggle | Clicking "Fail" after "Pass" switches the selection |
| 32 | Notes label | Shows "Notes" |
| 33 | Notes textarea | Editable with placeholder "Optional notes about this check..." |

### F. Cellular Backup Card — Evidence Upload (6)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 34 | Label | Shows "Evidence Upload" |
| 35 | Drop zone | Shows "Drag files here or click to browse" |
| 36 | Accepted formats | Shows "Accepted: .pdf,.jpg,.png · Max 10 MB" |
| 37 | Add file | Dropping/selecting a file adds it to the file list |
| 38 | File display | Shows file icon, name, size, "Remove" button |
| 39 | Remove file | Clicking "Remove" removes file from list |

### G. Cellular Backup Card — Submit Button (7)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 40 | Button text | Shows "Record Cellular Check" |
| 41 | Button full width | Button spans full card width |
| 42 | Disabled while saving | Disabled when cellSaving is true |
| 43 | Saving text | Shows "Saving..." while saving |
| 44 | Validation — no result | Toast error "Please fill in the check date and select a result." when no Pass/Fail selected |
| 45 | Validation — no date | Toast error when date is empty |
| 46 | Success toast | Toast "Cellular backup check recorded successfully." on success |
| 47 | Error toast | Toast "Failed to record cellular check." on API error |

### H. Cellular Backup Card — After Submit (5)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 48 | Form reset — date | Date resets to today |
| 49 | Form reset — result | Pass/Fail pills reset to unselected |
| 50 | Form reset — notes | Notes textarea cleared |
| 51 | Form reset — files | Files list cleared |
| 52 | History reload | History table reloads and shows the new check at the top |

### I. Camera Backup Card — Header & Last Check Info (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 53 | Card title | Shows "30-Day Camera Backup" |
| 54 | Status dot — green | Green dot when last check is COMPLIANT and not overdue |
| 55 | Status dot — red | Red dot when next due date has passed (overdue) |
| 56 | Status dot — gray | Gray dot when no previous check exists |
| 57 | Last check info visible | Shows last check box when a previous camera check exists |
| 58 | Last check date | Shows formatted check date |
| 59 | Last check by | Shows checkedByName |
| 60 | Last check status + next due | Shows status badge and formatted next due date |

### J. Camera Backup Card — Compliant Block (3)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 61 | Block shown | Green block message shown when last camera check is COMPLIANT and next due date is in the future |
| 62 | Block text | Shows "Camera backup is compliant." |
| 63 | Block subtext | Shows "Next check due: [date]. No new check needed until then." |

### K. Camera Backup Card — New Check Form (15)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 64 | Form visible | "Record New Check" form shown when not blocked |
| 65 | Section title | Shows "Record New Check" |
| 66 | Check Date label | Shows "Check Date" |
| 67 | Check Date default | Defaults to today's date |
| 68 | Check Date editable | Date input can be changed |
| 69 | Days verified label | Shows "Days of backup verified" |
| 70 | Days verified placeholder | Shows "e.g. 30" |
| 71 | Days verified input | Accepts number input, min 0 |
| 72 | Days >= 30 indicator | Green text "Meets 30-day requirement ✓" when value >= 30 |
| 73 | Days < 30 indicator | Red text "Below 30-day requirement ✗" when value < 30 |
| 74 | Days empty — no indicator | No indicator shown when input is empty |
| 75 | Result label | Shows "Result" |
| 76 | "Pass" pill | Clicking marks green |
| 77 | "Fail" pill | Clicking marks red |
| 78 | Notes textarea | Editable with placeholder "Optional notes about this check..." |

### L. Camera Backup Card — Evidence Upload (6)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 79 | Label | Shows "Evidence Upload" |
| 80 | Drop zone | Shows "Drag files here or click to browse" |
| 81 | Accepted formats | Shows "Accepted: .pdf,.jpg,.png · Max 10 MB" |
| 82 | Add file | Dropping/selecting a file adds it to the file list |
| 83 | File display | Shows file icon, name, size, "Remove" button |
| 84 | Remove file | Clicking "Remove" removes file from list |

### M. Camera Backup Card — Submit Button (7)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 85 | Button text | Shows "Record Camera Check" |
| 86 | Button full width | Button spans full card width |
| 87 | Disabled while saving | Disabled when camSaving is true |
| 88 | Saving text | Shows "Saving..." while saving |
| 89 | Validation — no result | Toast error "Please fill in the check date and select a result." when no Pass/Fail selected |
| 90 | Validation — no date | Toast error when date is empty |
| 91 | Success toast | Toast "Camera backup check recorded successfully." on success |
| 92 | Error toast | Toast "Failed to record camera check." on API error |

### N. Camera Backup Card — After Submit (6)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 93 | Form reset — date | Date resets to today |
| 94 | Form reset — result | Pass/Fail pills reset to unselected |
| 95 | Form reset — notes | Notes textarea cleared |
| 96 | Form reset — files | Files list cleared |
| 97 | Form reset — days verified | Days verified input cleared |
| 98 | History reload | History table reloads and shows the new check at the top |

### O. Check History Table — Headers (7)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 99 | Column: Check Type | Header shows "Check Type" |
| 100 | Column: Date | Header shows "Date" |
| 101 | Column: Building | Header shows "Building" |
| 102 | Column: Status | Header shows "Status" |
| 103 | Column: Checked By | Header shows "Checked By" |
| 104 | Column: Next Due | Header shows "Next Due" |
| 105 | Column: Notes | Header shows "Notes" |

### P. Check History Table — Row Data (10)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 106 | Type badge — Cellular | Blue badge "Cellular" for CELLULAR_BACKUP checks |
| 107 | Type badge — Camera | Purple badge "Camera" for CAMERA_BACKUP checks |
| 108 | Date format | Shows formatted date (e.g., "Mar 15, 2026") |
| 109 | Building name | Shows building name (not ID) |
| 110 | Status — Compliant | Green badge "Compliant" |
| 111 | Status — Non-Compliant | Red badge "Non-Compliant" |
| 112 | Status — Pending | Amber badge "Pending" |
| 113 | Checked By | Shows checkedByName value |
| 114 | Next Due | Shows formatted next due date |
| 115 | Notes | Shows notes text, truncated with ellipsis if too long (max 200px), shows "—" if no notes |

### Q. Check History Table — States (4)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 116 | Loading state | Shows "Loading checks..." while fetching |
| 117 | Empty state | Shows "No checks recorded for this building yet." when no checks exist |
| 118 | Sort order | Checks sorted by checkDate descending (newest first) |
| 119 | Record count | Card header shows "X records" (pluralized correctly) |

### R. Check History Table — Pagination (6)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 120 | Page size | Maximum 10 rows per page |
| 121 | "Prev" button | Visible, disabled on page 1 (faded) |
| 122 | "Prev" click | Goes to previous page |
| 123 | "Next" button | Visible, disabled on last page (faded) |
| 124 | "Next" click | Goes to next page |
| 125 | Page indicator | Shows "Page X of Y" |

### S. Duplicate Check Prevention (8)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 126 | Cellular compliant blocks form | When last cellular is COMPLIANT and not overdue, form is replaced with compliant message |
| 127 | Camera compliant blocks form | When last camera is COMPLIANT and not overdue, form is replaced with compliant message |
| 128 | Independent blocking | Cellular can be blocked while camera form is still open (and vice versa) |
| 129 | Overdue allows new check | When last check is COMPLIANT but next due date has passed, form is shown (not blocked) |
| 130 | Non-compliant allows new check | When last check is NON_COMPLIANT, form is shown regardless of next due date |
| 131 | No previous check allows form | When no previous check exists, form is shown |
| 132 | After recording Pass | After recording a Pass, form is replaced with compliant block (history reloads, block recalculates) |
| 133 | After recording Fail | After recording a Fail, form remains open (NON_COMPLIANT doesn't block) |

### T. Cross-Card Independence (4)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 134 | Cellular submit doesn't affect camera | Submitting cellular check doesn't reset camera form |
| 135 | Camera submit doesn't affect cellular | Submitting camera check doesn't reset cellular form |
| 136 | Both can submit independently | Can record a cellular check and then a camera check without page reload |
| 137 | Both appear in history | After recording both, history table shows both new entries |

### U. Data Integrity (6)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 138 | Cellular — next due date | After recording cellular check on date X, next due date is X + 6 months |
| 139 | Camera — next due date | After recording camera check on date X, next due date is X + 6 months |
| 140 | Checked by matches user | The "Checked By" in history matches the logged-in userName |
| 141 | Building matches selection | The "Building" in history matches the selected building name |
| 142 | Pass → COMPLIANT | Recording "Pass" creates a check with COMPLIANT status |
| 143 | Fail → NON_COMPLIANT | Recording "Fail" creates a check with NON_COMPLIANT status |

### V. Dashboard Reflection (3)

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 144 | Cellular compliant count | After recording a cellular Pass, the Alarm Compliance Dashboard Cellular Backup card count increases |
| 145 | Camera compliant count | After recording a camera Pass, the Dashboard Camera Backup card count increases |
| 146 | Biannual Status page | After recording checks, the Biannual Status page shows updated status for the building |

---

**Screen 4 Total: 146 test cases**

---

## Screens 2, 5–16: Test Cases (Pending)

Test cases for the following screens will be added as we proceed:

| Screen | Name | Status |
|--------|------|--------|
| 2 | Alarm Upload | Pending |
| 5 | Alarm Approvals | Pending |
| 6 | Alarm Review | Pending |
| 7 | Escalation | Pending |
| 8 | Alarm Overview Dashboard | Pending |
| 9 | Alarm Trends | Pending |
| 10 | Building Drill-Down | Pending |
| 11 | Biannual Status | Pending |
| 12 | Alarm Zone Configuration | Pending |
| 13 | Building Setup | Pending |
| 14 | Compliance Rules | Pending |
| 15 | User Access | Pending |
| 16 | Alarm Audit Trail | Pending |

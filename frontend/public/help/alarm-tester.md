# Alarm Tester User Guide

As an **Alarm Tester**, you run the monthly alarm test at each building you're assigned to, walking every zone and recording the result. You also record the semi-annual cellular and camera backup checks, upload evidence, and resubmit anything an Approver has flagged.

![Alarm Tester — Test History screen](/help/screenshots/alarm-tester/history-monthly.png)

## What you can do

- Run the **monthly alarm test** — zone-by-zone checklist for every building on your roster.
- Record **biannual checks** — cellular backup and 30-day camera backup.
- Upload **security reports** and **evidence documents** (PDF, Excel, image).
- Save work as a **Draft** and resume later.
- Resubmit after an Approver's feedback without losing prior entries.
- See your own history of every test and check across all assigned buildings.

## Alarm Test History

This is the landing screen when you sign in. It lists every alarm test and biannual check across the buildings you're assigned to, with a toggle between **Monthly Tests** and **Biannual Checks**.

![Monthly Tests tab — history and filters](/help/screenshots/alarm-tester/history-monthly.png)

### What the screen shows

The page opens on the **Monthly Tests** tab. A pair of tab buttons at the top-left switches between monthly and biannual history. At the top-right, two action buttons let you start a new test or biannual check.

| Element | What it does |
|---|---|
| Monthly Alarm Test (button) | Opens the monthly test form for a fresh test entry |
| Biannual Checks (button) | Opens the biannual check form (cellular / camera) |
| Monthly Tests tab | Shows the monthly test history (default) |
| Biannual Checks tab | Shows the biannual history (cellular + camera combined) |

The Monthly tab shows four KPI cards above the filter bar. Each card has a `?` tooltip explaining what it counts.

| KPI | Meaning |
|---|---|
| Tests This Year | All monthly tests recorded in the current calendar year |
| Approved | Tests approved by the reviewer this year |
| Pending Review | Tests submitted and waiting for approval |
| Rejected | Tests the reviewer rejected — these need a fix & resubmit |

The filter bar has a building dropdown, four status pills (**All / Draft / Submitted / Approved / Rejected**), a year selector, and a month selector. Month is disabled until a year is chosen.

| Column | Meaning |
|---|---|
| Building | Building the test was run against |
| Test Date | Date the test was performed |
| Month | Month the test belongs to (YYYY-MM) |
| Tester | Name of the person who ran the test |
| Zones | Progress bar + count: zones tested vs. total |
| Status | Draft / Submitted / Approved / Rejected badge |
| Actions | `Continue` (for drafts), `Fix & Resubmit` (for rejected), or `View` (for everything else) |

The table shows 10 rows per page with a pager at the bottom. Click a draft row anywhere (not just the button) to resume editing it.

## Biannual Check History

Switch to the **Biannual Checks** tab to see the cellular and camera history in the same card layout.

![Biannual Checks tab — history and filters](/help/screenshots/alarm-tester/history-biannual.png)

### What the screen shows

The biannual tab has five KPIs and the same filter bar pattern as Monthly, plus a fifth "Cellular / Camera" split.

| KPI | Meaning |
|---|---|
| Total Checks | Every biannual check across all your buildings |
| Cellular | Count of cellular backup checks |
| Camera | Count of 30-day camera backup checks |
| Pending Review | Submitted checks awaiting approval |
| Rejected | Checks the reviewer rejected |

| Column | Meaning |
|---|---|
| Date | When the check was performed |
| Building | Building the check was run against |
| Type | `Cellular` or `Camera` pill |
| Result | `Compliant`, `Non-Compliant`, or `Pending` pill |
| Status | Draft / Submitted / Approved / Rejected |
| Checked By | Name of the person who ran the check |
| Next Due | Date the next check is expected (six months on) |
| Actions | `Continue` (drafts), `Fix & Resubmit` (rejected), or `View` |

## Monthly Alarm Test

Click **🔔 Monthly Alarm Test** from the history screen to open the test form. This is where you walk each zone, record the result, attach the security company report, and submit for approval.

![Monthly Alarm Test form — empty state](/help/screenshots/alarm-tester/test-form.png)

### What the screen shows

The form is a single long page with four stacked sections and a sticky footer.

| Section | What it holds |
|---|---|
| Select Building | Dropdown listing every building assigned to you. Pick first — the Zone Testing Checklist populates based on this choice. |
| Test Details | Test Date (defaults to today), Tester Name (your name, read-only), Test Start Time, Test End Time, General Notes (free-text) |
| Zone Testing Checklist | Row per zone (populated after Select Building). Each row has a status selector — **Tested**, **Not Tested**, **Issue Found** — and a notes field. |
| Alarm Company Report | File upload for the security company's printed report. Attach before submitting. |

A sticky footer at the bottom holds two buttons:

| Button | When to use |
|---|---|
| Save Draft | Stores the current state so you can resume later. Always enabled. |
| Submit for Approval | Sends the test to the Approver. Disabled until at least one zone is marked. |

A small note on the right of the footer tells you why Submit is disabled — e.g. *"Mark at least one zone to submit"*.

### Running a test

1. From **My Tests**, click **🔔 Monthly Alarm Test**.
2. Pick a **Building** from the dropdown. The Zone Testing Checklist fills in with every zone configured for that site.
3. Adjust the **Test Date** if you're backfilling — otherwise leave it on today.
4. Enter the **Test Start Time** and **Test End Time** once the walk-through is complete.
5. For each **Zone**, pick a status:
   - **Tested** — alarm triggered and logged as expected.
   - **Not Tested** — you skipped this zone (add a note explaining why).
   - **Issue Found** — alarm misbehaved (add a note describing the issue).
6. Upload the **Alarm Company Report** PDF / Excel / image.
7. Use the **General Notes** box for anything the zone-level notes don't cover.
8. Click **Save Draft** as often as you like. The entry appears back on My Tests with status **Draft**; click it to resume.
9. When you're done, click **Submit for Approval**. The test moves to **Submitted** and appears in the Approver's queue.

### Responding to a rejection

If the Approver rejects a test, it shows on **My Tests** with a red **Fix & Resubmit** button. Clicking it reopens the test form with your previous entries preserved so you can fix the specific problem the Approver flagged. The rejection reason is shown at the top of the form. Save & Submit again to send it back.

## Biannual Checks

Use **📋 Biannual Checks** from the history screen to record a cellular-backup or camera-backup check.

The biannual check recording screen is **currently in development** — the button is wired but the form is not yet live. In the meantime, use **Biannual Check History** to see checks already on file for your buildings; a new form will be added in a future release.

## Tips

- Drafts auto-persist — you can close the browser mid-walk and pick up where you left off from **My Tests**.
- Rejection reasons stay in the audit trail even after you resubmit, so you can see the cycle-by-cycle feedback.
- The Alarm Company Report upload accepts PDF, Excel, and image files. If your file type is rejected, convert it to PDF.
- If a zone was inaccessible during the walk (locked room, active work), choose **Not Tested** and say so in the notes — **Issue Found** is reserved for zones that failed to trigger.
- The monthly SLA is tracked against your **Submit** timestamp, not **Save Draft**. Submit before the month-end deadline even if the Approver review runs into the next month.

*Video walkthrough coming soon.*

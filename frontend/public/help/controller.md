# Controller User Guide

As a **Controller**, you review operator submissions, schedule location verification visits, review DGM visits, and use the reasonableness test to catch subtle variances before they become incidents.

![Daily Review Dashboard — full page](/help/screenshots/controller/ctrl-daily-report.png)

## What you can do

- Review and approve / reject **daily operator submissions** on the Daily Review Dashboard.
- **Schedule verification visits** for locations in your portfolio (Mon–Fri only).
- **Complete**, **Miss**, or **Cancel** scheduled visits within the SLA window.
- **Review DGM monthly visits** for your locations.
- Run the **Cash Reasonableness Test** against historical ranges.

## Daily Review Dashboard

This is where every pending operator submission for your assigned locations lands.

### What the screen shows

The screen is a single card with a live KPI strip above the table:

- **KPI row** — three cards: `Pending Approval`, `Approved`, `Rejected`.
- **Filter row** — status chips + date range chips + location dropdown.
- **Submissions table** — paginated, 10 rows per page.

#### Table columns

| Column | Meaning |
|---|---|
| **Date** | Submission date. |
| **Operator** | Name of the operator who submitted. |
| **Location** | Site name. |
| **Total Cash** | The operator's reported total for that day. |
| **Variance** | Difference vs. imprest, colour-coded by tolerance (green / amber / red). |
| **Status** | `Pending Approval` (amber) · `Approved` (green) · `Rejected` (red) badge. |
| **Action** | **View & Approve** or **Review** button. |

Timestamps shown as "time ago" (e.g. `3h 2m ago`). Click any column header to sort.

### Filtering pending submissions

![Daily Review filtered to Pending](/help/screenshots/controller/ctrl-daily-pending.png)

Three filter controls in the header:

- **Status** chips: `All · Pending · Approved · Rejected`. Click Pending to see only what needs your attention.
- **Date range** chips: `7 days · 30 days · All`.
- **Location** dropdown scopes to one site.

The selected chip turns dark green; filters combine, so you can drill in to "Rejected submissions at Appleton in the last 7 days".

### Reviewing a submission

1. Find the pending submission and click **View & Approve**.
2. The full cash count form opens in read-only view. You can mark individual sections as **Approve** or **Flag** using the section toolbar.
3. Click **Approve** to accept the submission, or **Reject** and enter a clear reason. The operator sees your reason on their dashboard and via email.

## Weekly Review Dashboard

Shows your scheduled verification visits and their state.

![Weekly Review Dashboard](/help/screenshots/controller/ctrl-dashboard.png)

### What the screen shows

- **KPI row** — `Scheduled`, `Completed`, `Missed` visit counts for the period.
- **Filter row** — status dropdown + location dropdown.
- **Visits table** — paginated.

#### Visit status badges

| Status | Badge |
|---|---|
| Scheduled | 📅 Scheduled (blue) |
| Completed | ✅ Completed (green) |
| Missed | ❌ Missed (red) |
| Cancelled | ⊘ Cancelled (grey) |

#### Visit table columns

`Location · Date · DOW · Type · Status · Variance`. Type is `Controller` or `DGM`. Click a row to expand inline controls for **Complete / Miss / Cancel**.

### Filtering visits by status

![Weekly Review filtered to Scheduled visits](/help/screenshots/controller/ctrl-dashboard-scheduled.png)

The **status** dropdown lets you narrow to one state: `all · scheduled · completed · missed · cancelled`. The table updates immediately.

### Scheduling a visit

Click **Schedule Visit** (from this screen or the sidebar):

1. Pick a **location** from the dropdown.
2. Pick a **date** on the calendar (Mon–Fri only; weekends are blocked).
3. Optionally add a **note**.
4. If you've visited the same location on the same weekday in the past 2 weeks, a warning modal appears — acknowledge with a reason to proceed.
5. Click **Schedule**.

> The scheduling screen no longer asks for a time slot — only a date.

### Completing a visit

1. Find the scheduled visit on the Weekly Review Dashboard.
2. Click **Mark as Completed**.
3. The system shows the operator's submission for that location and date:
   - If the operator submitted — review the form.
   - If they didn't — fill the cash count form yourself.
4. Optionally capture a digital signature.
5. Click **Confirm Completion**.

The **Complete** action is available only during the SLA window (scheduled time + `approval_sla_hours`). After that it disappears and you must use **Miss** instead.

### Miss and Cancel rules

- **Miss** — available after the scheduled time passes, or for past dates. Choose a reason from the dropdown (6 options: access blocked, staff conflict, emergency, transport, rescheduled, other).
- **Cancel** — available only for future dates and for today before the scheduled time. Once the scheduled time arrives, you can no longer cancel — mark the visit Missed instead.

## Review DGM Visits

A dedicated screen to audit the monthly visits completed by DGMs in your portfolio.

![Review DGM Visits — Month view](/help/screenshots/controller/ctrl-dgm-review-month.png)

### What the screen shows

- Location filter + time window chips (`Today · Week · Month · All`).
- Table of DGM visits with status badges and observed cash totals.

#### Columns

`Location · Month · Date · Verifier · Status · Observed Total · Notes`. Click a row to expand a section-level review — for each of Sections A–I, you can mark the DGM's observations **accept** or **reject** with a comment. Snapshots of the operator's submission at visit-time are visible alongside for cross-reference.

Use this screen to catch DGM visits where the observed cash, section results, or notes warrant follow-up.

## Cash Reasonableness Test

Evaluates whether recent submissions are plausible against historical trends. Saves the result for the Admin's Reasonableness Reports.

![Cash Reasonableness Test — Step 1 parameters](/help/screenshots/controller/ctrl-reasonableness-step1.png)

See the dedicated **Cash Reasonableness** tab in this User Guide for the full walkthrough — formula, per-location action notes, the auto-save trigger, and how the overall report status is decided.

## Tips

- Review pending submissions **within 48 hours** to avoid SLA breaches.
- When rejecting, give a **clear reason** so the operator knows what to fix.
- Spread visits across **different weekdays** — the system warns about same-weekday repeats in the past 2 weeks.
- Use **Query operator** for ambiguous cases instead of an outright rejection (in Cash Reasonableness).
- You can complete a visit even if the operator didn't submit — the form lets you fill in the cash count yourself.

*Video walkthrough coming soon.*

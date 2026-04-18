# Controller User Guide

As a **Controller**, you review operator submissions, schedule location verification visits, review DGM visits, and use the reasonableness test to catch subtle variances.

![Daily Review Dashboard](/help/screenshots/controller/ctrl-daily-report.png)

## What you can do

- Review and approve / reject **daily operator submissions** on the Daily Review Dashboard.
- **Schedule verification visits** for locations in your portfolio (Mon–Fri only).
- **Complete**, **Miss**, or **Cancel** scheduled visits within the SLA window.
- **Review DGM monthly visits** for your locations.
- Run the **Cash Reasonableness Test** against historical ranges.

## Daily Review Dashboard

Every pending operator submission for your assigned locations lands here.

**KPI cards** summarise the period: `Pending Approval · Approved · Rejected`.

**Filters:**

- **Status** chips: `All · Pending · Approved · Rejected`.
- **Date range** chips: `7 days · 30 days · All`.
- **Location** dropdown scopes to one site.

**Submission table columns:** `Date · Operator · Location · Total Cash · Variance · Status · Action`. Status badges use green / amber / red. Variance is colour-coded by the configured tolerance. Timestamps are shown as "time ago" (e.g. `3h 2m ago`).

**Reviewing a submission:**

1. Find the pending submission and click **View & Approve**.
2. The full cash count form opens in read-only view. You can mark individual sections **Approve** or **Flag**.
3. Click **Approve** to accept the submission, or **Reject** and enter a clear reason. The operator sees your reason on their dashboard and via email.

## Weekly Review Dashboard

![Weekly Review Dashboard](/help/screenshots/controller/ctrl-dashboard.png)

Shows your scheduled verification visits and their state.

**KPI cards:** `Scheduled · Completed · Missed`.

**Filters:** status (`all · scheduled · completed · missed · cancelled`) + location.

**Visit table columns:** `Location · Date · DOW · Type · Status · Variance`.

Visit statuses use coloured badges:

| Status | Badge |
|---|---|
| Scheduled | 📅 Scheduled (blue) |
| Completed | ✅ Completed (green) |
| Missed | ❌ Missed (red) |
| Cancelled | ⊘ Cancelled (gray) |

Click a row to expand inline controls for **Complete / Miss / Cancel**.

## Scheduling a visit

Click **Schedule Visit** (from the Weekly Review Dashboard or the sidebar).

1. Pick a **location** from the dropdown.
2. Pick a **date** on the calendar (Mon–Fri only; weekends are blocked).
3. Optionally add a **note**.
4. If you've visited the same location on the same weekday within the past 2 weeks, a warning modal appears — acknowledge with a reason to proceed.
5. Click **Schedule**.

> The scheduling screen no longer asks for a time slot — only a date.

## Completing a visit

1. Find the scheduled visit on the Weekly Review Dashboard.
2. Click **Mark as Completed**.
3. The system shows the operator's submission for that location and date:
   - If the operator submitted — review the form.
   - If they didn't — fill the cash count form yourself.
4. Optionally capture a digital signature.
5. Click **Confirm Completion**.

The **Complete** action is available only during the SLA window (scheduled time + `approval_sla_hours`). After that it disappears and you must use **Miss** instead.

## Miss and Cancel rules

- **Miss** is available after the scheduled time passes, or for past dates. Choose a reason from the dropdown (6 options: access blocked, staff conflict, emergency, transport, rescheduled, other).
- **Cancel** is available only for future dates and for today before the scheduled time. Once the scheduled time arrives, you can no longer cancel — mark the visit Missed instead.

## Review DGM Visits

![Review DGM Visits](/help/screenshots/controller/ctrl-dgm-review.png)

A dedicated screen to audit the monthly visits completed by DGMs in your portfolio.

**Filters:** location + time window (`Today · Week · Month · All`).

**Columns:** `Location · Month · Date · Verifier · Status · Observed Total · Notes`.

Click a row to expand into a **section-level review** — for each of Sections A–I, you can mark the DGM's observations **accept** or **reject** with a comment. Snapshots of the operator's submission at visit-time are visible alongside for cross-reference.

Use this screen to catch DGM visits where the observed cash, section results, or notes warrant follow-up.

## Cash Reasonableness Test

![Cash Reasonableness Test](/help/screenshots/controller/ctrl-reasonableness.png)

Evaluates whether recent submissions are plausible against historical trends before you approve them. The screen is a **two-step flow**:

**Step 1 — parameters:**

- **Location Group** — pick one of your assigned groups.
- **From / To dates** — the period to evaluate.
- **Factor** — the reasonableness multiplier (how many standard-variances wide the expected band is).

**Step 2 — calculated report:**

A table shows, per location in the group: `Expected Fund · Actual (max daily submission) · Over · Cushion · Net`. Rows outside the reasonable band are highlighted.

You can **Accept**, **Query operator** (sends an in-system message), or **Reject with reasoning** from this view. Your reasonableness decision is recorded in the audit trail with full context.

## Tips

- Review pending submissions **within 48 hours** to avoid SLA breaches.
- When rejecting, give a **clear reason** so the operator knows what to fix.
- Spread visits across **different weekdays** — the system warns about same-weekday repeats in the past 2 weeks.
- Use **Query operator** for ambiguous cases instead of an outright rejection.
- You can complete a visit even if the operator didn't submit — the form lets you fill in the cash count yourself.

*Video walkthrough coming soon.*

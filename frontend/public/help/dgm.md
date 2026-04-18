# DGM User Guide

As a **District General Manager**, you own monthly visit coverage across the locations in your district and create downstream audit-ready records.

![DGM Coverage Dashboard](/help/screenshots/dgm/dgm-dash.png)

## What you can do

- View the **Coverage Dashboard** to see the month's visit picture at a glance.
- **Schedule a monthly visit** for any location in your district (one visit per location per calendar month).
- **Complete** a scheduled visit with the operator's cash count, notes, and an optional digital signature.
- **Miss** past-due visits (with a reason) or **Cancel** upcoming ones.
- Review your full **Visit History**.

## Coverage Dashboard

Your primary screen — shows the month's visits across your assigned locations.

**KPI cards:** `Scheduled · Overdue · Completed · Missed`.

**Filters:** status (`all · scheduled · overdue · completed · missed`) + location.

**Table columns:** `Location · Month-Year · Scheduled Date · Status · Observed Total`.

Status badges:

| Status | Badge |
|---|---|
| Scheduled | 📅 Scheduled (blue) |
| Overdue | ⚠️ Overdue (amber) — scheduled date has passed |
| Completed | ✅ Completed (green) |
| Missed | ❌ Missed (red) |

Click a row to expand inline controls for **Complete / Miss / Cancel**.

> **Overdue vs. Missed:** a visit becomes **Overdue** automatically once the scheduled date passes without action. You can still complete it (within the SLA window) or mark it Missed. Overdue is a transitional state, not a final one.

## Scheduling a monthly visit

From the Coverage Dashboard sidebar or via the **Schedule** action:

1. Pick a **location** from the dropdown.
2. Pick a **date** on the calendar. The calendar shows month/year navigation.
3. Optionally add a **note**.
4. Click **Schedule**.

Constraints the system enforces:

- **One visit per location per calendar month.** If a visit already exists for the chosen location in that month, you'll see a validation error.
- The scheduling screen does **not** ask for a time slot — only a date.

## Completing a visit

1. Find the scheduled (or overdue) visit on the Coverage Dashboard.
2. Click **Mark as Completed**.
3. Review the operator's submission for that date:
   - If they submitted — review the form.
   - If not — fill the cash count yourself.
4. Enter the **Observed Total** (your cash count).
5. Optionally capture a **digital signature**.
6. Click **Confirm Completion**.

The operator's submission **must be approved** by the controller before you can complete the visit — this is the submission gate.

## Miss and Cancel rules

- **Miss** is available for past dates, or for today after the scheduled time has passed. Choose a reason from the dropdown: access blocked, staff conflict, emergency, transport, rescheduled, other.
- **Cancel** is available for today (before the scheduled time) and any future date.
- **Complete** is available from scheduling through the SLA window (visit date + configured approval SLA hours). After the SLA expires, you can only Miss the visit.

## Visit History

![DGM Visit History](/help/screenshots/dgm/dgm-history.png)

View every visit you've logged — completed, missed, or scheduled.

**Filters:** location · year · month · status.

**Columns:** `Location · Date · Verifier · Status · Observed Total` (with variance colour-coded by tolerance).

The history is view-only — to take action on a visit, return to the Coverage Dashboard.

## Tips

- Complete at least **one visit per location per month** — the Coverage Dashboard's Overdue card is your early-warning signal.
- Check the dashboard at the start of the month to plan your visit schedule; the further you plan ahead, the more you avoid end-of-month scrambles.
- Add **thorough notes** when completing a visit — these feed the Controller's Review DGM Visits screen and the audit trail.
- Don't delay — once the SLA window closes, you can only mark the visit Missed.

*Video walkthrough coming soon.*

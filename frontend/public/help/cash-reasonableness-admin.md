# Cash Reasonableness Reports — Admin Guide

The **Reasonableness Reports** screen is the admin's roll-up of every reasonableness test that controllers have saved. One row per saved test. Click View on any row for the full per-location financial breakdown.

![Reasonableness Reports — full page, default view](/help/screenshots/admin/reasonableness-reports.png)

## What you can do

- Browse every saved reasonableness test across all cost centers.
- **Filter** by status (Reasonable / Overfunded) using the clickable KPI cards.
- Open the **detail modal** for any report to see the per-location financial breakdown and the controller's action notes.
- **Re-download** a report's HTML version for an audit pack or external distribution.

## What the screen shows

The screen is a single content stack:

1. **KPI strip** (top) — three clickable cards that double as status filters.
2. **Reports table** — paginated, 10 rows per page.
3. **Detail modal** — opens on top when you click a row's **View** button.

### KPIs — clickable filters

| KPI | Colour | What it does |
|---|---|---|
| **Total Reports** | neutral | Shows every saved report. Click to clear any active filter. |
| **Reasonable** | green | Click to narrow the table to reports whose overall status is Reasonable. |
| **Overfunded** | red | Click to narrow the table to reports flagged for follow-up. |

Clicking a KPI adds a subtle outline and narrows the table below. Click the same card again (or click **Total Reports**) to clear.

### Filter applied example

![KPI filter — Overfunded selected, table narrows to flagged reports](/help/screenshots/admin/reasonableness-filter-overfunded.png)

The screenshot shows the **Overfunded** card clicked — the table now lists only reports flagged for attention.

### Reports table columns

| Column | Meaning |
|---|---|
| **Location** | Cost center label (e.g. `APPLETON / WAUSAU` for a 2-location group). |
| **Cost Center** | Numeric cost center code (e.g. `5082`). |
| **Last Test Date** | When the report was saved. |
| **Period Tested** | The date range the controller evaluated. |
| **Status** | `Reasonable` (green) or `Overfunded` (red) badge. |
| **Required Action** | The action note the controller attached. |
| **Factor** | The multiplier used (typically `1.25×` single-location, `1.50×` multi-location). |
| **Prepared By** | The controller who saved the report. |

Every row ends with a **View** action — click to open the detail modal.

## Overall status — "worst-case wins"

A report's overall status is **Overfunded if any single location in the group is Overfunded**. Otherwise it's Reasonable.

So a report tagged Overfunded doesn't necessarily mean every location is — it means at least one is. Open the detail modal to see which.

## The detail modal

![Reasonableness Report detail modal — per-location financial breakdown](/help/screenshots/admin/reasonableness-detail-modal.png)

Click **View** on any row to open the modal — this is where the meaningful report lives.

### Header meta

Location(s), Cost Center, Period tested, Test Date, Prepared By, Overall Status badge.

### Per-location sub-cards

One sub-card per location in the group. Each sub-card has a six-column financial breakdown:

| Column | Meaning |
|---|---|
| **Total** (`F+H+J+K`) | `max(F) + max(H) + max(J) + max(K)` across approved submissions in the period. |
| **Expected Fund** | `Total × Factor`. |
| **Actual Fund** | The highest `total_cash` among approved submissions. |
| **Over / (Under)** | Raw variance, `Actual − Expected`. |
| **Less Cushion** | Tolerance cushion applied (default −$5,000). |
| **Net** | Residual variance after cushion. **Drives** the Reasonable/Overfunded decision per location. |

### Below the sub-cards

- **Conclusion** — free-text the controller wrote when running the test.
- **Required Actions** — free-text the controller wrote per location (e.g. "Recount overage", "No action").
- **Footer** — unique Report ID (UUID), save timestamp, and the preparer's user ID. Useful for cross-referencing in the Audit Trail.

### Re-downloading the report

The **⬇ Re-download Report** button in the modal footer regenerates the saved report's HTML version — useful when distributing the report by email or attaching to an audit pack. The HTML is a standalone document that doesn't require a CashRoom login to view.

### Closing the modal

Click the **✕** in the top-right, or click anywhere on the dark overlay outside the modal panel.

## Using these reports in practice

- **Recurring red flags at a single location** are a strong signal to schedule a DGM visit or a re-audit.
- **Controller query patterns** — if one controller is generating many Overfunded reports, it may indicate a training gap or an overly-tight band.
- **No CSV export** from this screen today; use the main **Reports** screen for CSV extracts that include the reasonableness decision per submission.

*Video walkthrough coming soon.*

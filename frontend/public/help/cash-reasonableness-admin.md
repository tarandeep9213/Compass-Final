# Cash Reasonableness Reports — Admin Guide

The **Reasonableness Reports** page gives Admins a cross-location view of how often submissions fall outside expected ranges, who responded to them, and where intervention may be needed.

![Reasonableness Reports](/help/screenshots/admin/reasonableness-reports.png)

## What you can do

- Review **every reasonableness test** that has been run, across all locations.
- Filter by **status** (`all · Reasonable · Overfunded`) using the KPI cards or the status filter.
- Drill into any report row to see the underlying per-location calculations.
- **Re-download** the generated HTML report for a saved test.

## Understanding the KPI cards

The three KPI cards at the top are **clickable filters**:

- **Total Reports** — all reports in scope.
- **Reasonable** (green highlight) — tests where the observed cash fell within the expected range.
- **Overfunded** (red highlight) — tests where the observed cash exceeded the expected fund threshold.

Clicking any card filters the table below to that status.

## The Reports table

Each row shows one saved reasonableness test:

| Column | Meaning |
|---|---|
| **Location** | Location name |
| **Cost Center** | Accounting code |
| **Last Test Date** | Date the test was generated |
| **Period Tested** | The date range the test covers |
| **Status** | `Reasonable` (green) or `Overfunded` (red) badge |
| **Required Action** | Follow-up required, if any |
| **Factor** | The reasonableness factor applied |
| **Prepared By** | The controller who generated the test |

Click **View** on any row to open the detail modal.

## The detail modal

Click **View** on any row to open the detail modal — this is where the meaningful report lives. It shows the full financial analysis that drove the Reasonable / Overfunded decision.

![Reasonableness Report detail modal](/help/screenshots/admin/reasonableness-detail-modal.png)

**What the modal shows:**

- **Header meta** — Location(s), Cost Center, Period tested, Test Date, Prepared By, Overall Status badge.
- **One sub-card per location** covered by the report (reasonableness tests can span multiple locations sharing a cost center).
- **Six-column financial breakdown per location:**

| Column | Meaning |
|---|---|
| **Total** (`F+H+J+K`) | Sum of Section F (Returned Manual Change) + H (Changer Outstanding) + Holdover + Coin in Transit |
| **Expected Fund** | The imprest-adjusted expected amount for the period |
| **Actual Fund** | What the operator reported |
| **Over / (Under)** | Raw variance (Actual − Expected) |
| **Less Cushion** | Tolerance cushion applied to absorb acceptable variance |
| **Net** | Residual variance after cushion — this drives the Reasonable/Overfunded decision |

- **Conclusion** — free-text field where the preparer recorded their narrative reasoning.
- **Required Actions** — free-text field listing any follow-up needed (e.g., "No" if nothing required, or specific actions otherwise).
- **Footer** — unique Report ID, save timestamp, and the preparer's user ID. Useful when referencing this report in the audit trail.

**⬇ Re-download Report** at the modal's footer regenerates the HTML version of the test — useful for audit packs and email distribution.

**Closing the modal:** click the **✕** in the top-right, or click anywhere on the dark overlay outside the modal panel.

## Tuning reasonableness bands

Reasonableness bands are configured globally and per-location elsewhere in the Admin panels (see **Locations → Global Defaults** for the global tolerance percentage, and per-row **Tolerance** on individual locations). Every change is captured in the **Audit Trail**.

## Using this in practice

- **Recurring red flags** at a single location are a strong signal to schedule a DGM visit or re-audit.
- **Controller query patterns** — if one controller is querying many submissions, it may indicate a training gap or an overly-tight band.
- **Export** — there's no CSV export from this screen today; use the main **Reports** screen for CSV extracts that include the reasonableness decision column.

*Video walkthrough coming soon.*

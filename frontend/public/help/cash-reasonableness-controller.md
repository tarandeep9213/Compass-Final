# Cash Reasonableness Test — Controller Guide

The **Cash Reasonableness Test** evaluates whether each cost center's operating cash fund is plausible against historical activity. As a controller, you generate the test for one cost center group at a time, review the per-location math, attach action notes, and save the report. Saved reports surface on the Admin's **Reasonableness Reports** screen.

## What you can do

- Run a reasonableness test for any **cost center group** you cover.
- Pick the date range and the **Factor** (multiplier).
- Review per-location calculations: Total · Expected Fund · Actual Fund · Over · Cushion · Net.
- Add **per-location action notes** explaining your decision.
- **Auto-save** to the Admin Reasonableness Reports once every location row is marked complete.

## Step 1 — Parameters

The screen opens on the parameters form.

- **Location Group** — pick one of your assigned cost center groups (e.g. `5082 · APPLETON / WAUSAU`). Groups list every active location sharing the same cost center.
- **From / To dates** — the period to evaluate. All approved submissions in this window are considered.
- **Factor** — the reasonableness multiplier. Defaults to **1.50** for a multi-location group, **1.25** for single-location. You can override.

Click **Calculate** to compute the rows.

## Step 2 — The calculation

For each location in the group, the test computes:

| Field | What it is |
|---|---|
| **Total** | `max(F) + max(H) + max(J) + max(K)` across every approved submission in the date range. F and H are read from the section's `total` field. J = max of Section J total or the standalone Replenishment field. K = max of Section K total or Coin in Transit. |
| **Expected Fund** | `Total × Factor` |
| **Actual Fund** | The **highest** `total_cash` across all approved submissions for that location in the period. |
| **Over** | `Actual Fund − Expected Fund`. Negative means under expected (no concern). |
| **Cushion** | A fixed deduction. Defaults to **−$5,000** per location. Editable per row in the UI. |
| **Net** | `Over + Cushion` |
| **Status** | **Overfunded** if `Net > 0`, otherwise **Reasonable**. |

> **Only APPROVED submissions count.** Rejected or pending submissions are ignored. The role of the submitter (operator, controller verifier, DGM verifier, RC verifier) does **not** matter — every approved row in the period contributes to the maxes.

### Worked example

Cost center 5082 · two locations · Factor 1.50 · Cushion −5,000.

**Appleton — 2 days of approved submissions:**

| | Day 1 | Day 2 | max |
|---|---:|---:|---:|
| F | 500 | 600 | **600** |
| H | 800 | 900 | **900** |
| Replenishment (J) | 200 | 300 | **300** |
| Coin in Transit (K) | 100 | 200 | **200** |
| total_cash | 6,600 | 7,000 | **7,000** |

- Total = 600+900+300+200 = **2,000**
- Expected = 2,000 × 1.50 = **3,000**
- Over = 7,000 − 3,000 = **+4,000**
- Net = 4,000 − 5,000 = **−1,000** → 🟢 **Reasonable**

## Step 3 — Per-location action notes

For each row, you must:

1. Enter an **action note** (minimum 5 characters). This is the narrative captured in the saved report.
2. Mark the row **Completed**.

Examples:

- For a Reasonable row: "On track. Continue current process."
- For an Overfunded row: "Recount overage on 04-16; confirm with bank deposit by 04-25."

## Step 4 — Auto-save

Once **every** location row is marked Completed, the report auto-saves to the Admin's Reasonableness Reports panel.

- The save records: who prepared it (you), the parameters used, the per-location calculations, and your action notes.
- A **"Reports Saved"** KPI on this screen increments.
- A regenerable **HTML report** is attached to the saved record for later download.

## Overall report status — "worst-case wins"

The saved report's overall status is **Overfunded if any single location is Overfunded**, otherwise Reasonable. One red row flips the whole report red.

The intent is conservative: don't let a clean location hide a problem at its sibling.

## Tips

- Use the **rolling band** mentally — bands are derived from the *maxima* of recent submissions, so a single high day can shift Expected upward and absorb a small overage on another day.
- The **Cushion** is your discretionary buffer — adjust it per row if a location has a known operational reason to hold extra cash.
- If you mark every location complete but you spot an issue afterwards, you cannot un-save the report — generate a new one with corrected notes.
- Saved reports are visible to **Admin** on their Reasonableness Reports screen. Every action note you write is what they see.

*Video walkthrough coming soon.*

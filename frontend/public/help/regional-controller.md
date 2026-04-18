# Regional Controller User Guide

As a **Regional Controller (RC)**, you oversee compliance at scale — across every location in your region — and provide executive-level visibility. You are not location-scoped; you see everything.

## What you can do

- See regional compliance at a glance on the **Business Dashboard**.
- Drill into any day-at-a-location via **Location Review**.
- Fill a **verifier cash count form** yourself for any location/day.
- Analyze **Cash Trends** across locations and time.
- Generate and export **Reports**.
- View the **Audit Trail** across your region.

## Business Dashboard

Your primary screen — the headline view of regional compliance for the current month, with drill-downs into the exceptions that need attention.

![Business Dashboard — full page, default month view](/help/screenshots/admin/biz-dash.png)

### What the screen shows

The screen is a long scrolling layout with these blocks top to bottom:

1. **KPI row** — four headline cards with delta indicators vs. previous month.
2. **Visit coverage strips** — Controller Visits This Month + DGM Visits This Month with progress bars.
3. **Alert banners** — red / amber expandable banners for locations in trouble (only rendered when there's something to flag).
4. **Compliance Trend** — 8-week line chart.
5. **Top At-Risk Locations** — the 5 worst composite-risk locations.
6. **Operator Behaviour** — Late Submitters card + Platform Usage bar chart.
7. **Most Rejected Operators** — top offenders with rejection counts.
8. **Top Rejection Reasons** — grouped reason analysis.
9. **Controller Activity** — per-controller table.
10. **DGM Coverage** — DGM-by-DGM status table.

### KPI cards

| KPI | Meaning |
|---|---|
| **Compliance Rate** | Percentage of locations in "green" status. Red if below 70%, amber below 80%. |
| **Approval Rate** | Submissions approved vs. total. Red below 80%, amber below 85%. |
| **Cash at Risk** | Total dollar variance across exception locations. |
| **Variance Exceptions** | Count of submissions exceeding tolerance. |

Hover the `?` icon on any KPI for the exact calculation.

### Top At-Risk Locations

![Top At-Risk Locations](/help/screenshots/admin/biz-dash-at-risk.png)

Shows the 5 locations with the highest composite risk scores. Risk factors:

- No operator submission today.
- Submission rejected.
- Pending approval > 48 hours (SLA breach).
- High variance.
- No controller visit in 14+ days.
- No DGM visit this month.

Each row shows a health dot (green / amber / red), the risk score, and the flags that contributed.

### Alert banners

Red and amber banners above the KPIs surface any locations in immediate trouble. Click a banner to expand it into its underlying location list — no navigation needed.

## Location Review

A drill-down screen that gives you a single-day, single-location view of all activity — operator submission, controller approval, controller visit, and DGM visit.

![Location Review — full page, role badges per location](/help/screenshots/regional-controller/location-review.png)

### What the screen shows

- **Date picker** at the top left — scopes the whole table to one day (default: today).
- **Table** — one row per location you cover.

#### Table columns

| Column | Meaning |
|---|---|
| **Location** | Site name + cost center. |
| **Operator** | Badge if the operator submitted that day (click to view form). |
| **Controller** | Badge if a controller acted (approval or verifier submission). |
| **DGM** | Badge if the DGM filled a verifier form that day. |
| **RC** (you) | Badge if you filled a verifier form, or a **Fill Form** button if not. |

Click any badge to view that role's submission read-only. Click the Fill Form button (see below) to post your own verifier submission.

### Why it helps

- Faster than jumping across dashboards — one click gives you the full story of one day at one location.
- Role badges make gaps immediately obvious (e.g. operator submitted but controller didn't approve → visible red gap).

## Filling a verifier form (RC's own count)

From the Location Review screen, you can fill a cash count form yourself for any location/day where you haven't already filled one — independent of what the operator, controller, or DGM has done.

### How it works

- For each location row, a **"Fill Form"** button appears in the action column **only if you haven't already filled one for that date**.
- Clicking it opens the cash count form prefilled with the location and date, in **verifier mode** (your role is `REGIONAL_CONTROLLER`).
- Submitting saves your count as your **own row**, separate from the operator's, controller's, and DGM's submissions for the same day.
- Your submission is **auto-approved** — no controller approval needed.

### The 4-row submission model

The system supports up to four submissions per location per day, one per role:

| Role | Status flow |
|---|---|
| **Operator** | Pending Approval → Approved or Rejected by Controller |
| **Controller** (verifier) | Auto-approved on save |
| **DGM** (verifier) | Auto-approved on save |
| **Regional Controller** (verifier) | Auto-approved on save |

Your row is **completely independent** of the other roles. You can fill it whether or not the operator submitted, whether or not the operator was rejected, and whether or not the controller / DGM filled their own. None of those states block you.

### What it doesn't do

- RC's verifier submission is **not visible** on the operator's, controller's, or DGM's dashboards. It's an independent record for your own audit trail.
- It does **not** replace a rejected operator submission. The operator (or someone with operator access grant) still needs to resubmit theirs.
- You cannot fill a second RC row for the same location/date — once you've filled it, the **"Fill Form"** button disappears for that row.

**When to use it:** when you want to record an independent count during a region visit, or when you need an authoritative figure attached to your role for the audit trail.

## Reports

![Reports KPIs](/help/screenshots/admin/reports-kpis.png)

Detailed period-level reporting with KPIs, Date-Level Detail, Per-Actor Summary, and Variance Exceptions tables — plus CSV export.

The full screen walkthrough (period filter, location filter, KPI meanings, each table's columns, export behaviour) is documented under the **Admin** tab of this User Guide — the screen and behaviour are identical for RC and Admin.

## Cash Trends

![Cash Trends](/help/screenshots/admin/cash-trends.png)

Visual trend charts across locations and time — granularity toggles, location pills, section tabs, and multi-sheet Excel export.

Like Reports, the full walkthrough is under the **Admin** tab — identical screen and controls.

## Audit Trail

The immutable system log — every action across every role, searchable and exportable. Full walkthrough under the **Admin** tab.

## Tips

- RCs are **not location-scoped** — you see everything.
- You can grant yourself temporary **Operator** or **Controller** access via Access Grants when you need to stand in for a role.
- Check **Location Review** early in the day — it's the fastest way to spot gaps before they become exceptions.
- Use the **RC verifier form** during a region visit to lock in your own independent count for audit.

*Video walkthrough coming soon.*

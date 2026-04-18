# Regional Controller User Guide

As a **Regional Controller (RC)**, you oversee compliance at scale — across every location in your region — and provide executive-level visibility. You are not location-scoped; you see everything.

## What you can do

- See regional compliance at a glance on the **Business Dashboard**.
- Drill into any day-at-a-location via **Location Review**.
- Analyze **Cash Trends** across locations and time.
- Generate and export **Reports**.
- View the **Audit Trail** across your region.

## Business Dashboard

![Business Dashboard](/help/screenshots/admin/biz-dash.png)

The KPI strip at the top gives the headline picture for the current month, with delta indicators vs. the previous month. Thresholds colour the value:

- **Compliance Rate** — percentage of locations in "green" status. Red if below 70%, amber below 80%.
- **Approval Rate** — submissions approved vs. total. Red below 80%, amber below 85%.
- **Cash at Risk** — total dollar variance across exception locations.
- **Variance Exceptions** — count of submissions exceeding tolerance.

Hover the `?` icon on any KPI for the exact calculation.

Below the KPIs are visit coverage strips for **Controller Visits This Month** and **DGM Visits This Month** with progress bars.

### Top At-Risk Locations

![Top At-Risk Locations](/help/screenshots/admin/biz-dash-at-risk.png)

Shows the 5 locations with the highest risk scores. Risk is a composite of:

- No operator submission today.
- Submission rejected.
- Pending approval > 48 hours (SLA breach).
- High variance.
- No controller visit in 14+ days.
- No DGM visit this month.

Each row shows a health dot (green / amber / red), the risk score, and the flags that contributed.

### Other panels on the Business Dashboard

- **Compliance Trend** — 8-week line chart showing Submission Rate, Approval Rate, and Exceptions.
- **Operator Behaviour** — Late Submitters card + Platform Usage bar chart (Form / Excel / Chat).
- **Most Rejected Operators** — top offenders with rejection counts.
- **Top Rejection Reasons** — grouped reason analysis.
- **Controller Activity** — per-controller completion rate, average variance found, DOW warnings acknowledged.
- **DGM Coverage** — which DGMs have hit their monthly targets and which locations are still pending.

Red and amber alert banners can be clicked to expand into their underlying location lists.

## Location Review

![Location Review](/help/screenshots/regional-controller/location-review.png)

A drill-down screen that gives you a single-day, single-location view of all activity — operator submission, controller approval, controller visit, and DGM visit.

**What you see:**

- Pick a **date**. The table lists every location with a **role badge** for each role that submitted or acted that day (Operator ✓, Controller ✓, DGM ✓).
- Click a location to expand its full activity panel: submitted cash count form, approval chain, visit records, and any controller / DGM notes.

**Why it helps:**

- Faster than jumping across dashboards — one click gives you the full story of one day at one location.
- Role badges make gaps immediately obvious (e.g. operator submitted but controller didn't approve → visible red gap).

## Reports

![Reports KPIs](/help/screenshots/admin/reports-kpis.png)

Detailed reporting with date-range filtering. Includes:

- **Date-Level Detail** — one row per location per day, showing who submitted, who approved, and which controller/DGM/RC was involved.
- **Per-Actor Summary** — per-actor approval/completion rates, average variance, exceptions flagged. Filter with role chips.
- **Variance Exceptions** — submissions whose variance exceeded tolerance.
- **CSV export** via the top-right **Export CSV** button.

## Cash Trends

![Cash Trends](/help/screenshots/admin/cash-trends.png)

Visual charts over time:

- **Granularity** toggles: daily · weekly · monthly · quarterly.
- **Location** pills let you scope to "All" or compare specific sites.
- **Section tabs** (A–I plus the standalone fields) colour-coded — pick a section to analyse.
- **KPI strip** shows Latest / Average / Peak / Total for the selected section.
- **CSV / multi-sheet Excel export** via the top-right Download buttons.

## Audit Trail

Same log available to Admin — every action across the system. Use it to trace any dispute to the underlying event. See the Admin guide for details on filters, period selector, and export options.

## Tips

- RCs are **not location-scoped** — you see everything.
- You can grant yourself temporary **Operator** or **Controller** access via Access Grants when you need to stand in for a role.
- Check **Location Review** early in the day — it's the fastest way to spot gaps before they become exceptions.

*Video walkthrough coming soon.*

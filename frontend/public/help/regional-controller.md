# Regional Controller User Guide

As a **Regional Controller (RC)**, you oversee cashroom compliance at scale — every location in your region, every day. Unlike Operators / Controllers / DGMs, you are **not location-scoped** — you see everything. Your job is to catch gaps before they become exceptions and, when you need to, record your own independent cash count during a region visit.

![Business Dashboard — full page overview](/help/screenshots/regional-controller/biz-dash-full.png)

## What you can do

- See regional compliance at a glance on the **Business Dashboard**.
- Drill into any day-at-a-location via **Location Review**.
- Fill a **verifier cash count form** yourself for any location/day.
- Analyse **Cash Trends** across locations and time.
- Generate and export **Reports**.
- Investigate every action across your region in the **Audit Trail**.

## Business Dashboard — Headline KPIs

The four headline KPIs at the top of the Business Dashboard give you the single-number view of regional health for the current month, each with a delta vs. the previous month.

![KPI row — Compliance, Approval, Cash at Risk, Variance Exceptions](/help/screenshots/regional-controller/biz-dash-kpis.png)

| KPI | What it counts | When it turns red / amber |
|---|---|---|
| **Compliance Rate** | Share of locations whose current-month status is *green* | Red below 70%, amber below 80% |
| **Approval Rate** | Approved submissions ÷ total submissions this month | Red below 80%, amber below 85% |
| **Cash at Risk** | Sum of absolute variance across exception locations | Red when above configured threshold |
| **Variance Exceptions** | Count of submissions whose variance exceeds tolerance | Red when count rises month-over-month |

Hover the `?` icon on any KPI for the exact calculation. The arrow under each value (↑ / ↓) compares against the same KPI from the previous month — a red downward arrow on Compliance is the fastest single signal that your region has slipped.

## Business Dashboard — Visit Coverage

A thin strip below the KPIs shows Controller and DGM visit coverage for the month at a glance. This is where you check whether the people you rely on have actually been doing their visits.

![Coverage Strip — Controller + DGM visits this month](/help/screenshots/regional-controller/biz-dash-coverage.png)

Each side of the strip shows:
- **Count** — completed visits this month.
- **Progress bar** — completed ÷ expected visits for the month.
- **Unvisited locations** (if any) — small list of sites that haven't yet been visited.

Controllers are expected to visit each location at least once per business week (Mon–Fri); DGMs once per calendar month. If either bar stays flat well into the month, follow up with those teams before month-end — this strip is the early warning.

## Business Dashboard — Compliance Trend

An 8-week line chart that shows whether your region is trending up or down. One data point per week.

![Compliance Trend — 8-week line chart](/help/screenshots/regional-controller/biz-dash-compliance-trend.png)

Hover a point to see the exact weekly compliance rate. A **sustained flat or downward slope** is more important than a single bad week — use this chart to decide whether a month's drop is a blip or a pattern.

## Business Dashboard — Top At-Risk Locations

The five locations with the highest composite-risk scores, each with the specific flags that earned them the spot.

![Top At-Risk Locations — flagged locations with risk factors](/help/screenshots/regional-controller/biz-dash-at-risk.png)

Each row shows:
- **Health dot** — red / amber / green based on overall risk.
- **Location name** (uppercase).
- **Risk flags** — chip-style badges for each contributing factor.
- **Risk label** (right side) — `High Risk`, `Medium Risk`, etc.

Flags that drive the score include:

| Flag | Meaning |
|---|---|
| No submission | Operator has not submitted today |
| No ctrl visit | No controller visit in the past 14 days |
| No DGM visit | No DGM visit this month |
| Rejected | Most recent submission was rejected |
| SLA breach | A submission has been waiting for approval > 48 hours |
| High variance | A submission exceeded the variance tolerance |

Use this card as your action list — these are the locations most likely to hurt next month's Compliance Rate. Click into each via Location Review to see the full day-by-day picture.

## Business Dashboard — Operator Behaviour

Two side-by-side cards inside the Operator Behaviour section: **Late submitters** and **Platform usage**.

![Operator Behaviour — late submitters + platform split](/help/screenshots/regional-controller/biz-dash-op-behaviour.png)

| Card | Meaning |
|---|---|
| **Late submitters** | Count of operators whose submission landed after 18:00 or rolled into the next day. Amber-highlighted when > 0. |
| **Platform usage** | Share of submissions via the Form vs. the Excel upload path this month. |

Below these two cards, the same section also renders **Most Rejected Operators** (top offenders with a running rejection count and their most common reason) and **Top Rejection Reasons** (reason-by-reason bar breakdown) when any rejections exist in the current month. Use Most Rejected Operators to identify who needs retraining, and Top Rejection Reasons to spot systemic issues (e.g. "missing denomination" shows up everywhere → the form UX likely needs work, not the operators).

## Business Dashboard — Controller Activity

A per-controller table showing how active each controller in your region has been this month.

![Controller Activity — per-controller monthly stats](/help/screenshots/regional-controller/biz-dash-controller.png)

The table gives you per-controller columns for approvals handled, rejections issued, visits scheduled / completed / missed, and the average SLA time to approval. A controller with a high rejection rate *and* slow SLA is the one to talk to — either their locations need help or they're blocking the queue.

## Business Dashboard — DGM Coverage

A DGM-level view of monthly visit completion: who's covered their locations, who has pending visits, and what findings they've logged.

![DGM Coverage — per-DGM monthly status](/help/screenshots/regional-controller/biz-dash-dgm.png)

For each DGM: locations assigned, visits completed, visits pending, and the count of "findings" (flagged issues). DGMs are on a monthly cadence (one visit per location per calendar month), so any DGM still showing a big pending count by week 3 of the month needs a nudge before the month closes.

## Business Dashboard — Slowest Approvers

The approvers (controllers, typically) with the longest average SLA time this month — ranked worst-first.

![Slowest Approvers — SLA table](/help/screenshots/regional-controller/biz-dash-slowest.png)

Rows show the approver name, their average approval time (in hours), and the count of submissions that breached the 48-hour SLA on their watch. The approver at the top of this list is directly responsible for your **Approval Rate** dropping or the **SLA breach** flag appearing on Top At-Risk Locations.

## Business Dashboard — Location Compliance Detail

A collapsible full-region table at the bottom of the page — the "long tail" view for auditing every location one row at a time.

![Location Compliance Detail — collapsible table](/help/screenshots/regional-controller/biz-dash-loc-detail.png)

Click the header to expand. Each row is one location with columns for health, name, region, last test-related activity, zones, and biannual status where applicable. Useful when you want to look beyond the top-5 at-risk list and scan every location in one place — green counts on the right tell you how many are still compliant.

## Business Dashboard — Alert Banners

When a location is in immediate trouble, the Dashboard surfaces a red or amber banner above the KPIs. These only render when there's something to flag, so their absence is good news.

- **Red banner** — urgent: no submission today at a covered location, SLA breach, critical variance.
- **Amber banner** — warning: trending toward red (e.g. three late submissions in a row).

Click a banner row to expand it into the underlying list of locations — no navigation needed.

## Location Review

A one-day, one-location-per-row view of cashroom activity across your entire region. This is the fastest way to see exactly what happened at every site on a given date.

![Location Review — daily per-location table](/help/screenshots/regional-controller/location-review.png)

### What the screen shows

The header has the page title, a date context line, and a single card titled **"All Locations — Today"** with a live count on the right (`22 locations` in the screenshot).

| Column | Meaning |
|---|---|
| **Location** | Site name (uppercase) plus the underlying location ID in monospace |
| **CC** | Cost centre code for the site, or `—` if none assigned |
| **Submissions Today** | Compact pill list — one clickable chip per role that has submitted today (e.g. `OP · approved`, `CTRL · submitted`, `DGM · approved`, `RC · approved`). Each chip is colour-coded by status. If nothing has been submitted yet, the cell shows *"No submissions yet"* in grey. |
| **Operator Total** | The operator's submitted total cash for today (currency). Shown only if the operator has submitted. |
| **Operator Variance** | Variance from imprest — green when within 2.5%, amber up to 5%, red above 5%. Value is shown both as a currency delta (e.g. `+$150`) and a percentage (e.g. `+1.25%`). |
| **Actions** | **Fill Form** button if you haven't yet filed your own RC verifier count today; otherwise shows *"✓ RC filled"* confirmation. |

Click any chip in **Submissions Today** to open that role's submission in read-only view. Click **Fill Form** to file your own RC verifier count for that location.

### Why Location Review is your day-one tool

Most RCs open Location Review before the Business Dashboard. Reason: the Business Dashboard aggregates, which means problems show up after they've propagated. Location Review shows you the raw facts — who submitted, who didn't, who has variance — minutes after it happens. If you spot an issue here, you can act on it before it ever reaches a KPI.

## Filling a verifier form (RC's own count)

From Location Review, you can file your own cash count for any location/day where you haven't already filed one — independent of what the operator, controller, or DGM has done.

### How it works

- For each row, the **"Fill Form"** button in the Actions column appears **only if you haven't already filed an RC submission for that date**.
- Clicking it opens the cash count form prefilled with the location and date, in **verifier mode** (your role is `REGIONAL_CONTROLLER`).
- Submitting saves your count as **your own row**, independent of the operator's, controller's, and DGM's submissions for the same day.
- Your submission is **auto-approved** — no controller approval required.
- After filing, the Actions column flips to *"✓ RC filled"* for that row.

### The 4-row submission model

The system allows up to four submissions per location per day — one per role. Your RC submission lives alongside the others, not instead of them.

| Role | Status flow |
|---|---|
| **Operator** | Pending Approval → Approved or Rejected by Controller |
| **Controller** (verifier) | Auto-approved on save |
| **DGM** (verifier) | Auto-approved on save |
| **Regional Controller** (verifier) | Auto-approved on save |

Your row is **completely independent** of the others. You can fill it whether or not the operator submitted, whether or not the operator was rejected, and whether or not the controller or DGM filed their own count. None of those states block you.

### What it doesn't do

- Your RC verifier submission is **not visible** on the operator's, controller's, or DGM's dashboards. It's an independent record for your own audit.
- It does **not** replace a rejected operator submission. The operator (or someone with operator access grant) still needs to resubmit their own.
- You cannot file a second RC row for the same location/date — once you've filed, the **Fill Form** button disappears for that row.

**When to use it:** during a region visit when you want to record an independent count, or any time you need an authoritative RC-role figure in the audit trail for a specific date.

## Reports

Detailed period-level reporting — KPIs, Date-Level Detail, Per-Actor Summary, and Variance Exceptions tables, plus CSV export. The screen and its behaviour are identical to the Admin view.

For the full walkthrough — period filter, location filter, each KPI's meaning, each table's columns, export behaviour — see the **Admin** tab in this User Guide. Everything in the Admin guide's Reports section applies to RC unchanged.

## Cash Trends

Visual trend charts across locations and time — granularity toggles (day / week / month), per-location pills, section tabs for deposits / variance / submissions, and a multi-sheet Excel export.

Like Reports, the full walkthrough lives under the **Admin** tab. RC sees the same controls and data; the only difference is RC is not location-scoped, so the default location pill selection is *All*.

## Audit Trail

The immutable system log — every action across every role, searchable and exportable. Same screen as Admin; full walkthrough under the **Admin** tab.

Use Audit Trail when you need to reconstruct exactly what happened at a location on a specific day — every submission edit, approval, rejection, visit log, and access grant is recorded with actor + timestamp.

## Tips

- RCs are **not location-scoped** — every dashboard and table defaults to all-locations.
- Use **Location Review** before the **Business Dashboard** each morning — it surfaces problems hours before aggregates reflect them.
- When you stand in for an operator or controller, request a temporary **access grant** from Admin rather than using your RC verifier form — access grants give you the full role's rights (including approve / reject) that the verifier form can't.
- The **Top At-Risk Locations** card is your daily action list — walk it top to bottom before anything else on the dashboard.
- **Late submitters** is a leading indicator — three days of late submissions at the same location almost always precede a rejection or variance.

*Video walkthrough coming soon.*

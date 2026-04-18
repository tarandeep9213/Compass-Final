---
role: admin
feature: reports
outputFile: admin/reports.webm
estimatedDuration: 55s
viewport: 1440x900
---

# Admin — Reports Walkthrough

A tour of the Reports screen: the KPI strip, the Date-Level Detail table, Per-Actor Summary, and Variance Exceptions.

## Scene 1 — Opening (0:00 – 0:12)

> The Reports screen gives you a period-level view of submissions, approvals, and visits across every location. Switch the period, filter by location, and export the results when you need them.

```json
[
  { "type": "login", "role": "admin" },
  { "type": "wait", "ms": 600 },
  { "type": "nav", "panel": "adm-reports" },
  { "type": "wait", "ms": 2500 }
]
```

## Scene 2 — Period and filters (0:12 – 0:25)

> The period buttons let you jump to today, this week, this month, or any custom date range. The location dropdown narrows the data to a single site.

```json
[
  { "type": "hover", "selector": "button:has-text('This Month')" },
  { "type": "wait", "ms": 1500 },
  { "type": "hover", "selector": "button:has-text('Custom')" },
  { "type": "wait", "ms": 2000 }
]
```

## Scene 3 — Date-Level Detail (0:25 – 0:38)

> The first table breaks every day down by location — who submitted, who approved, and which controller or DGM was involved. Status badges make it easy to spot rejected or pending rows.

```json
[
  { "type": "scroll", "selector": ".card:has(.card-title:has-text('Date-Level Detail'))" },
  { "type": "wait", "ms": 500 },
  { "type": "hover", "selector": ".card:has(.card-title:has-text('Date-Level Detail'))" },
  { "type": "wait", "ms": 2500 }
]
```

## Scene 4 — Per-Actor Summary (0:38 – 0:48)

> The Per-Actor Summary rolls up each user's activity for the period. Use the role chips to narrow to operators, controllers, or DGMs only.

```json
[
  { "type": "scroll", "selector": ".card:has(.card-title:has-text('Per-Actor Summary'))" },
  { "type": "wait", "ms": 500 },
  { "type": "hover", "selector": ".card:has(.card-title:has-text('Per-Actor Summary'))" },
  { "type": "wait", "ms": 2500 }
]
```

## Scene 5 — Export (0:48 – 0:55)

> Finally, the Export CSV button in the top right downloads the current filtered view for leadership packs or further analysis.

```json
[
  { "type": "scroll", "selector": ".fade-up" },
  { "type": "wait", "ms": 500 },
  { "type": "hover", "selector": "button:has-text('Export')" },
  { "type": "wait", "ms": 2000 }
]
```

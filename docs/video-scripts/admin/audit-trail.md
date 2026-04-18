---
role: admin
feature: audit-trail
outputFile: admin/audit-trail.webm
estimatedDuration: 45s
viewport: 1440x900
---

# Admin — Audit Trail Walkthrough

A short tour of the Audit Trail: how it lays out, what the filters do, and how to export.

## Scene 1 — Opening (0:00 – 0:10)

> Welcome to the CashRoom Audit Trail. As an admin, you have full visibility into every action taken across the system — user logins, submissions, approvals, visits, and configuration changes.

```json
[
  { "type": "login", "role": "admin" },
  { "type": "wait", "ms": 800 },
  { "type": "nav", "panel": "adm-audit" },
  { "type": "wait", "ms": 2000 }
]
```

## Scene 2 — Filter bar (0:10 – 0:22)

> The top row of filters lets you narrow the log by event type, actor, or location. Below that, the period selector scopes the view to today, the last seven days, this month, or a custom range.

```json
[
  { "type": "hover", "selector": ".fade-up select" },
  { "type": "wait", "ms": 1500 },
  { "type": "hover", "selector": "button:has-text('Last 7 Days')" },
  { "type": "wait", "ms": 1200 },
  { "type": "hover", "selector": "button:has-text('This Month')" },
  { "type": "wait", "ms": 1200 }
]
```

## Scene 3 — Sort and read a row (0:22 – 0:35)

> Click any column header to sort. Every row shows the timestamp, the event type, the actor, and the specific detail — everything you need to trace an action back to its source.

```json
[
  { "type": "click", "selector": "th:has-text('Timestamp')" },
  { "type": "wait", "ms": 1500 },
  { "type": "click", "selector": "th:has-text('Timestamp')" },
  { "type": "wait", "ms": 1500 },
  { "type": "hover", "selector": "tbody tr" },
  { "type": "wait", "ms": 1500 }
]
```

## Scene 4 — Export (0:35 – 0:45)

> When you need to hand the audit data to external reviewers, the Export button in the top right lets you download the currently filtered view as CSV or Excel. That's the Admin Audit Trail.

```json
[
  { "type": "hover", "selector": "button:has-text('Export')" },
  { "type": "wait", "ms": 2500 }
]
```

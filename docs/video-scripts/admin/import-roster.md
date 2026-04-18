---
role: admin
feature: import-roster
outputFile: admin/import-roster.webm
estimatedDuration: 40s
viewport: 1440x900
---

# Admin — Import Users and Locations Walkthrough

How to bulk-onboard users and locations from a single Excel or CSV file.

## Scene 1 — Opening (0:00 – 0:12)

> The Import screen lets you create many users and locations at once, from a single Excel or CSV upload. It is the fastest path to onboard a new region or replace a roster.

```json
[
  { "type": "login", "role": "admin" },
  { "type": "wait", "ms": 600 },
  { "type": "nav", "panel": "adm-import" },
  { "type": "wait", "ms": 2500 }
]
```

## Scene 2 — Sample template (0:12 – 0:22)

> If you need a starting point, the Sample Excel link at the top right downloads a template with the exact columns the importer expects.

```json
[
  { "type": "hover", "selector": "text=Sample Excel" },
  { "type": "wait", "ms": 2500 }
]
```

## Scene 3 — Upload zone (0:22 – 0:32)

> Drop your file onto the upload zone, or click Browse File to pick it. The system auto-detects both wide format and tall format, and handles either without manual mapping.

```json
[
  { "type": "hover", "selector": "button:has-text('Browse File')" },
  { "type": "wait", "ms": 2500 }
]
```

## Scene 4 — Confirm import (0:32 – 0:40)

> Once parsed, a preview shows KPI counts per role and every row with its assignment. When it looks right, click Confirm Import — welcome emails are sent automatically.

```json
[
  { "type": "wait", "ms": 2500 }
]
```

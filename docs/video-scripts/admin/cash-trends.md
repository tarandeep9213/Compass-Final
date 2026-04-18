---
role: admin
feature: cash-trends
outputFile: admin/cash-trends.webm
estimatedDuration: 45s
viewport: 1440x900
---

# Admin — Cash Trends Walkthrough

Visual trend charts across locations and sections — daily, weekly, or monthly.

## Scene 1 — Opening (0:00 – 0:12)

> The Cash Trends screen shows how your cash figures move over time. Pick a granularity, pick one or more locations, and drill into any section to see the trend at a glance.

```json
[
  { "type": "login", "role": "admin" },
  { "type": "wait", "ms": 600 },
  { "type": "nav", "panel": "rc-trends" },
  { "type": "wait", "ms": 3000 }
]
```

## Scene 2 — Granularity and period (0:12 – 0:22)

> Start with the granularity buttons at the top — daily, weekly, monthly, or quarterly. The period dropdown to the right adjusts the window to match.

```json
[
  { "type": "hover", "selector": "button:has-text('weekly')" },
  { "type": "wait", "ms": 1500 },
  { "type": "hover", "selector": "button:has-text('monthly')" },
  { "type": "wait", "ms": 2000 }
]
```

## Scene 3 — Section tabs (0:22 – 0:35)

> The section tabs let you focus on one area at a time — Currency, Rolled Coin, Coins in Machines, Bagged Coin, and so on. Each tab paints the chart below with just that section's data.

```json
[
  { "type": "hover", "selector": "button:has-text('Rolled Coin')" },
  { "type": "wait", "ms": 1500 },
  { "type": "hover", "selector": "button:has-text('Coins')" },
  { "type": "wait", "ms": 2500 }
]
```

## Scene 4 — Export (0:35 – 0:45)

> When you need the numbers behind the chart, the Download CSV button exports the current view, and the Export All Sections button produces a multi-sheet Excel covering every section in one file.

```json
[
  { "type": "wait", "ms": 2000 },
  { "type": "hover", "selector": "button:has-text('Download CSV')" },
  { "type": "wait", "ms": 2000 }
]
```

---
role: admin
feature: locations
outputFile: admin/locations.webm
estimatedDuration: 45s
viewport: 1440x900
---

# Admin — Locations Walkthrough

A tour of the Locations screen: how to add, edit, sort, and set a default tolerance that applies to every site.

## Scene 1 — Opening (0:00 – 0:10)

> Locations are the backbone of every submission and visit in the system. Here you can add a new site, edit an existing one, or tune the global defaults that apply across your estate.

```json
[
  { "type": "login", "role": "admin" },
  { "type": "wait", "ms": 600 },
  { "type": "nav", "panel": "adm-locations" },
  { "type": "wait", "ms": 2000 }
]
```

## Scene 2 — Add and edit (0:10 – 0:25)

> To add a new location, use the plus button at the top right and fill in its cost center, name, imprest amount, and tolerance. To edit an existing one, click the row to expand an inline form.

```json
[
  { "type": "hover", "selector": "button:has-text('+ Add Location')" },
  { "type": "wait", "ms": 1800 },
  { "type": "hover", "selector": "table tbody tr" },
  { "type": "wait", "ms": 2000 }
]
```

## Scene 3 — Sort by column (0:25 – 0:35)

> Each column header is sortable. One click sorts ascending, a second click reverses, and a third clears the sort.

```json
[
  { "type": "click", "selector": "th:has-text('Imprest')" },
  { "type": "wait", "ms": 1500 },
  { "type": "click", "selector": "th:has-text('Imprest')" },
  { "type": "wait", "ms": 1500 }
]
```

## Scene 4 — Global Defaults (0:35 – 0:45)

> Below the table, the Global Defaults card sets the default tolerance percentage applied to any location that does not specify its own. Every change here is captured in the audit trail.

```json
[
  { "type": "scroll", "selector": ".card:has(.card-title:has-text('Global Defaults'))" },
  { "type": "wait", "ms": 500 },
  { "type": "hover", "selector": ".card:has(.card-title:has-text('Global Defaults'))" },
  { "type": "wait", "ms": 2500 }
]
```

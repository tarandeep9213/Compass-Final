---
role: admin
feature: users
outputFile: admin/users.webm
estimatedDuration: 50s
viewport: 1440x900
---

# Admin — Users Walkthrough

How to add users, filter and sort the list, tune system-wide behaviour, and delegate screen access.

## Scene 1 — Opening (0:00 – 0:10)

> The Users screen lets you manage every account in the system. You can add new users, change their roles, and assign them to locations.

```json
[
  { "type": "login", "role": "admin" },
  { "type": "wait", "ms": 600 },
  { "type": "nav", "panel": "adm-users" },
  { "type": "wait", "ms": 2000 }
]
```

## Scene 2 — Search, filter, and add (0:10 – 0:25)

> Use the search box to find someone by name or email, or narrow the list by role or location. The plus button at the top right opens the add-user form.

```json
[
  { "type": "hover", "selector": "input[placeholder*='Search']" },
  { "type": "wait", "ms": 1500 },
  { "type": "hover", "selector": "button:has-text('+ Add User')" },
  { "type": "wait", "ms": 2000 }
]
```

## Scene 3 — Sort columns (0:25 – 0:35)

> Every column header is sortable. Click once for ascending, a second click to reverse. A third click clears the sort.

```json
[
  { "type": "click", "selector": "th:has-text('Role')" },
  { "type": "wait", "ms": 1500 },
  { "type": "click", "selector": "th:has-text('Role')" },
  { "type": "wait", "ms": 1500 }
]
```

## Scene 4 — System Settings (0:35 – 0:50)

> Below the table, the System Settings card holds preferences that apply to every user — the day-of-week lookback window for controller visits, the daily reminder time, and how long historical data is retained.

```json
[
  { "type": "scroll", "selector": ".card:has(.card-title:has-text('System Settings'))" },
  { "type": "wait", "ms": 500 },
  { "type": "hover", "selector": ".card:has(.card-title:has-text('System Settings'))" },
  { "type": "wait", "ms": 3000 }
]
```

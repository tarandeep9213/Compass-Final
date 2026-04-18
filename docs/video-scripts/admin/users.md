---
role: admin
feature: users
outputFile: admin/users.webm
estimatedDuration: 55s
viewport: 1440x900
---

# Admin — Users Walkthrough

A live demo of searching, filtering by role, filtering by location, and where to add a new user.

## Scene 1 — Opening (0:00 – 0:10)

> The Users screen lets you manage every account in the system — who they are, what role they hold, and which locations they cover.

```json
[
  { "type": "login", "role": "admin" },
  { "type": "wait", "ms": 600 },
  { "type": "nav", "panel": "adm-users" },
  { "type": "wait", "ms": 2500 }
]
```

## Scene 2 — Search (0:10 – 0:24)

> Use the search box to find someone by name or email. For example, typing "laura" narrows the list instantly to Laura Diehl — an operator at APPLETON.

```json
[
  { "type": "highlight", "selector": "input[placeholder*='Search']", "ms": 800 },
  { "type": "fill", "selector": "input[placeholder*='Search']", "value": "laura" },
  { "type": "wait", "ms": 3000 },
  { "type": "fill", "selector": "input[placeholder*='Search']", "value": "" },
  { "type": "wait", "ms": 1500 }
]
```

## Scene 3 — Role filter (0:24 – 0:38)

> The role dropdown lets you narrow to a single role. Pick Operator, for example, and the table filters down to just operators.

```json
[
  { "type": "highlight", "selector": "select.f-inp:has(option:has-text('All roles'))", "ms": 800 },
  { "type": "selectOption", "selector": "select.f-inp:has(option:has-text('All roles'))", "value": "operator" },
  { "type": "wait", "ms": 3500 },
  { "type": "selectOption", "selector": "select.f-inp:has(option:has-text('All roles'))", "value": "" },
  { "type": "wait", "ms": 1500 }
]
```

## Scene 4 — Location filter (0:38 – 0:50)

> The location dropdown works the same way. Pick a site to see only the users assigned there.

```json
[
  { "type": "highlight", "selector": "select.f-inp:has(option:has-text('All locations'))", "ms": 800 },
  { "type": "selectOption", "selector": "select.f-inp:has(option:has-text('All locations'))", "index": 1 },
  { "type": "wait", "ms": 3500 },
  { "type": "selectOption", "selector": "select.f-inp:has(option:has-text('All locations'))", "value": "" },
  { "type": "wait", "ms": 1500 }
]
```

## Scene 5 — Add user (0:50 – 0:55)

> And when you need to create a new user, the plus button in the top right opens the add-user form, where you set their name, email, role, and locations.

```json
[
  { "type": "highlight", "selector": "button:has-text('+ Add User')", "ms": 2500 }
]
```

# Role & URL Architecture

This document describes the multi-URL deployment model and role-based access matrix for the Compass platform.

## Overview

The Compass platform is **one codebase** deployed at **two URLs**:

| URL | Purpose | Users |
|---|---|---|
| `cashroom.compass.com` | Cash submission & verification workflow | Operators, Controllers, DGMs, Regional Controllers, Cashroom Admins |
| `alarm.compass.com` | Alarm testing & compliance workflow | Alarm Testers, Alarm Approvers, Alarm Admins |

Each user logs into **one URL only**. Cross-functional roles (Controller, DGM, RC) see alarm compliance dashboards inside the cashroom app — they never need to visit the alarm URL.

## Role Access Matrix

| Role | URL | Submit Tests | Approve | Buildings/Zones | Compliance Dashboards | Audit | User Mgmt |
|---|---|---|---|---|---|---|---|
| OPERATOR | cashroom | - | - | - | - | - | - |
| CONTROLLER | cashroom | - | - | - | read | read | - |
| DGM | cashroom | - | - | - | read | read | - |
| REGIONAL_CONTROLLER | cashroom | - | - | - | read | read | - |
| ADMIN | cashroom | - | - | - | - | - | cashroom users only |
| ALARM_TESTER | alarm | yes | - | - | - | - | - |
| ALARM_APPROVER | alarm | - | yes | - | read | read | - |
| ALARM_ADMIN | alarm | - | - | full | read | read | alarm users only |

### Key Rules
- **ALARM_ADMIN does NOT approve tests** — only `ALARM_APPROVER` approves.
- **ALARM_APPROVER sees compliance dashboards** in their nav.
- **CONTROLLER, DGM, REGIONAL_CONTROLLER** get alarm compliance dashboards (read-only) inside the cashroom app.
- **Role/URL mismatch is rejected at login** with a clear error message.

## Demo Login Credentials

All demo users use password: **`demo1234`**

### Cashroom URL (`cashroom.compass.com`)

| Role | Email | Name |
|---|---|---|
| ADMIN | admin@compass.com | Adam Admin |
| OPERATOR | operator@compass.com | Alex Operator |
| CONTROLLER | controller@compass.com | Chris Controller |
| DGM | dgm@compass.com | Diana DGM |
| REGIONAL_CONTROLLER | rc@compass.com | Rachel RC |
| AUDITOR | auditor@compass.com | Audrey Auditor |

### Alarm URL (`alarm.compass.com`)

| Role | Email | Name |
|---|---|---|
| ALARM_TESTER | tester@alarm.compass.com | Tara Tester |
| ALARM_APPROVER | approver@alarm.compass.com | Aaron Approver |
| ALARM_ADMIN | alarmadmin@alarm.compass.com | Alice Alarm Admin |

## Backend RBAC Guards

| Endpoint Group | Allowed Roles |
|---|---|
| `/v1/alarm/tests` (create/edit/submit) | `ALARM_TESTER` |
| `/v1/alarm/tests/{id}/approve\|reject` | `ALARM_APPROVER` |
| `/v1/alarm/biannual` (create/edit/submit) | `ALARM_TESTER` |
| `/v1/alarm/biannual/{id}/approve\|reject` | `ALARM_APPROVER` |
| `/v1/alarm/buildings` (CRUD) | `ALARM_ADMIN` |
| `/v1/alarm/zones` (CRUD) | `ALARM_ADMIN` |
| `/v1/alarm/rules` (PUT) | `ALARM_ADMIN` |
| `/v1/alarm/access` (CRUD) | `ALARM_ADMIN` |
| `/v1/alarm/escalation/remind` | `ALARM_APPROVER` |
| `/v1/alarm/dashboard/*` | `ALARM_APPROVER`, `ALARM_ADMIN`, `CONTROLLER`, `DGM`, `REGIONAL_CONTROLLER` |
| `/v1/alarm/audit` | `ALARM_APPROVER`, `ALARM_ADMIN`, `CONTROLLER`, `DGM`, `REGIONAL_CONTROLLER` |
| `/v1/alarm/users` (NEW) | `ALARM_ADMIN` |
| `/v1/admin/users` | `ADMIN` (cashroom users only — rejects `ALARM_*` role create requests) |
| `/v1/submissions/*` | `OPERATOR`, `CONTROLLER`, `DGM`, `REGIONAL_CONTROLLER`, `ADMIN` (rejects `ALARM_*`) |
| `/v1/verifications/*` | `CONTROLLER`, `DGM`, `REGIONAL_CONTROLLER`, `ADMIN` (rejects `ALARM_*`) |

## Frontend URL Detection

```typescript
const APP_MODE: 'cashroom' | 'alarm' =
  window.location.hostname.startsWith('alarm.') ? 'alarm' : 'cashroom'
```

- Default mode is `cashroom` (also covers `localhost`, IP addresses, EC2 hostnames).
- For local dev, use `?mode=alarm` query param to test alarm UI on `localhost`.

## Login Validation Rules

| Hostname | Allowed Roles | Mismatch Error |
|---|---|---|
| `alarm.*` | `ALARM_TESTER`, `ALARM_APPROVER`, `ALARM_ADMIN` | "This URL is for alarm system users only. Please use cashroom.compass.com" |
| Others (cashroom default) | `OPERATOR`, `CONTROLLER`, `DGM`, `REGIONAL_CONTROLLER`, `ADMIN`, `AUDITOR` | "This URL is for cashroom users only. Please use alarm.compass.com" |

## Deployment

- **Single EC2 / single Docker stack** serves both URLs.
- DNS: both `alarm.compass.com` and `cashroom.compass.com` point to the same IP.
- nginx serves the same SPA bundle to both — frontend code branches on hostname.
- Backend is shared (one database, one set of APIs).

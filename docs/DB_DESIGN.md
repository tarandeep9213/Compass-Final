# CashRoom Compliance System — Database Design

**Version:** 1.0
**Date:** 2026-03-06
**Engine:** SQLite (development) / PostgreSQL (production)
**ORM:** SQLAlchemy 2.x (mapped_column style)

---

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                          users                               │
│  PK  id              VARCHAR(36)   UUID                      │
│      name            VARCHAR(200)                            │
│  UK  email           VARCHAR(200)  UNIQUE + INDEX            │
│      hashed_password VARCHAR(200)                            │
│      role            ENUM          OPERATOR|CONTROLLER|DGM|  │
│                                    ADMIN|AUDITOR|             │
│                                    REGIONAL_CONTROLLER        │
│      location_ids    JSON          list[str]  (FK-like)      │
│      access_grants   JSON          list['operator'|'controller']│
│      active          BOOLEAN       default TRUE              │
│      created_at      TIMESTAMPTZ                             │
│      updated_at      TIMESTAMPTZ                             │
└──────────────┬───────────────────────────────────────────────┘
               │ location_ids[] references locations.id (logical)
               │
┌──────────────▼───────────────────────────────────────────────┐
│                        locations                             │
│  PK  id                    VARCHAR(36)  slug e.g. loc-appleton│
│      name                  VARCHAR(200)                      │
│      city                  VARCHAR(100) default ""           │
│      address               VARCHAR(500) default ""           │
│      tolerance_pct_override FLOAT       NULL = use global    │
│      expected_cash         FLOAT        default 0.0          │
│      sla_hours             INTEGER      default 24           │
│      active                BOOLEAN      default TRUE         │
│      created_at            TIMESTAMPTZ                       │
│      updated_at            TIMESTAMPTZ                       │
└──────────┬───────────────────────┬───────────────────────────┘
           │                       │
           │                       │
┌──────────▼──────────┐  ┌─────────▼──────────────────────────┐
│  location_tolerance │  │            submissions              │
│  _overrides         │  │  PK  id              VARCHAR(36)    │
│  PK location_id     │  │      location_id     VARCHAR(36) IX │
│     tolerance_pct   │  │      location_name   VARCHAR(200)   │
│     updated_at      │  │      operator_id     VARCHAR(36) IX │
└─────────────────────┘  │      operator_name   VARCHAR(200)   │
                         │      submission_date VARCHAR(10) IX  │
                         │                      YYYY-MM-DD      │
                         │      status  ENUM    draft|           │
                         │                      pending_approval│
                         │                      approved|        │
                         │                      rejected         │
                         │      source  ENUM    FORM|CHAT|EXCEL  │
                         │      sections        JSON             │
                         │                      {A:{total,denom},│
                         │                       B:..., ...I}    │
                         │      total_cash      FLOAT            │
                         │      expected_cash   FLOAT            │
                         │      variance        FLOAT            │
                         │      variance_pct    FLOAT            │
                         │      variance_exception BOOLEAN       │
                         │      variance_note   TEXT  NULL       │
                         │      approved_by     VARCHAR(36) NULL │
                         │      approved_by_name VARCHAR(200)    │
                         │      approved_at     TIMESTAMPTZ NULL │
                         │      rejection_reason TEXT  NULL      │
                         │      submitted_at    TIMESTAMPTZ NULL │
                         │      created_at      TIMESTAMPTZ      │
                         │      updated_at      TIMESTAMPTZ      │
                         └─────────────────────────────────────-┘

┌──────────────────────────────────────────────────────────────┐
│                     missed_submissions                       │
│  PK  id              VARCHAR(36)                             │
│      location_id     VARCHAR(36)  INDEX                      │
│      missed_date     VARCHAR(10)  YYYY-MM-DD                 │
│      reason          VARCHAR(100) predefined reason code     │
│      detail          TEXT         operator's explanation     │
│      supervisor_name VARCHAR(200)                            │
│      logged_by       VARCHAR(36)  references users.id        │
│      logged_at       TIMESTAMPTZ                             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       verifications                          │
│  PK  id                  VARCHAR(36)                         │
│      verification_type   ENUM        CONTROLLER|DGM  INDEX   │
│      location_id         VARCHAR(36) INDEX                   │
│      location_name       VARCHAR(200)                        │
│      verifier_id         VARCHAR(36)                         │
│      verifier_name       VARCHAR(200)                        │
│      verification_date   VARCHAR(10) INDEX  YYYY-MM-DD       │
│      scheduled_time      VARCHAR(5)  NULL   HH:MM            │
│      day_of_week         INTEGER     0=Mon … 6=Sun           │
│      day_name            VARCHAR(10) Monday … Sunday         │
│      status              ENUM        scheduled|completed|    │
│                                      missed|cancelled  INDEX │
│      warning_flag        BOOLEAN     DOW pattern warning     │
│      warning_reason      VARCHAR(50) NULL                    │
│      observed_total      FLOAT       NULL (set on complete)  │
│      variance_vs_imprest FLOAT       NULL                    │
│      variance_pct        FLOAT       NULL                    │
│      notes               TEXT        default ""              │
│      missed_reason       TEXT        NULL                    │
│      signature_data      TEXT        NULL  base64 PNG        │
│      month_year          VARCHAR(7)  NULL  YYYY-MM (DGM only)│
│      created_at          TIMESTAMPTZ                         │
│      updated_at          TIMESTAMPTZ                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       audit_events                           │
│  PK  id            VARCHAR(36)                               │
│      event_type    VARCHAR(60)   INDEX  (see Event Types)    │
│      actor_id      VARCHAR(36)   INDEX                       │
│      actor_name    VARCHAR(200)                              │
│      actor_role    VARCHAR(30)                               │
│      location_id   VARCHAR(36)   NULL  INDEX                 │
│      location_name VARCHAR(200)  NULL                        │
│      entity_id     VARCHAR(36)   NULL                        │
│      entity_type   VARCHAR(60)   NULL                        │
│      detail        TEXT                                      │
│      old_value     TEXT          NULL                        │
│      new_value     TEXT          NULL                        │
│      ip_address    VARCHAR(45)   NULL                        │
│      created_at    TIMESTAMPTZ   INDEX                       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       access_grants                          │
│  PK  id             VARCHAR(36)                              │
│      user_id        VARCHAR(36)  INDEX                       │
│      user_name      VARCHAR(200)                             │
│      user_email     VARCHAR(200)                             │
│      user_role      VARCHAR(30)                              │
│      access_type    VARCHAR(20)  'operator' | 'controller'   │
│      note           TEXT                                     │
│      granted_by     VARCHAR(36)                              │
│      granted_by_name VARCHAR(200)                            │
│      granted_at     TIMESTAMPTZ                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       system_config                          │
│  PK  id                    INTEGER   always = 1 (singleton)  │
│      default_tolerance_pct FLOAT     default 5.0             │
│      approval_sla_hours    INTEGER   default 24              │
│      dow_lookback_weeks    INTEGER   default 4               │
│      daily_reminder_time   VARCHAR(5) default "08:00"        │
│      data_retention_years  INTEGER   default 7               │
│      updated_at            TIMESTAMPTZ                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Table Descriptions

### `users`
Stores all system users across all roles. Location assignments are stored as a JSON array of `location_id` strings (denormalised for simplicity; no join table). `access_grants` JSON list records additional role access (e.g., a DGM granted operator access).

### `locations`
A physical cashroom site. `id` is a human-readable slug (e.g., `loc-appleton`, `loc-1`). `tolerance_pct_override` is NULL when the global default applies; the effective tolerance is resolved in application code.

### `location_tolerance_overrides`
Separate table for per-location tolerance overrides managed via the Admin Config screen. `location_id` is the PK, ensuring one override per location.

### `submissions`
One record per submission attempt. The same operator may have multiple records for the same date (e.g., rejected then resubmitted — each is a new record). The `sections` JSON stores a map of section codes `A`–`I`, each with `{total: float, denominations: {}}`. `source` distinguishes digital form, chat-guided, and Excel upload paths.

### `missed_submissions`
Logged when an operator explains a missed submission day. Separate from `submissions` to keep the submissions table clean.

### `verifications`
Covers both Controller (bi-weekly) and DGM (monthly) cash room inspection visits. `verification_type` discriminates the two types. `warning_flag` is set when the DOW pattern check detects the same weekday being used repeatedly within the lookback window. `month_year` (YYYY-MM) is populated only for DGM visits to support monthly coverage tracking.

### `audit_events`
Immutable append-only log. Every state-changing API call writes a row via `app/services/audit.py`. No updates or deletes are permitted.

### `access_grants`
Records when an Admin grants a DGM or Regional Controller the ability to act as an Operator or Controller. Referenced by the frontend to show/hide extra nav items.

### `system_config`
Singleton row (id=1). Global defaults for tolerance, SLA, DOW lookback, daily reminder time, and data retention.

---

## Audit Event Types

| event_type | Triggered by |
|---|---|
| `LOGIN` | Successful authentication |
| `SUBMISSION_CREATED` | POST /submissions |
| `SUBMISSION_SUBMITTED` | POST /submissions/{id}/submit |
| `SUBMISSION_APPROVED` | POST /submissions/{id}/approve |
| `SUBMISSION_REJECTED` | POST /submissions/{id}/reject |
| `VERIFICATION_SCHEDULED` | POST /verifications/controller or /dgm |
| `VERIFICATION_COMPLETED` | PATCH /verifications/{type}/{id}/complete |
| `VERIFICATION_MISSED` | PATCH /verifications/{type}/{id}/miss |
| `ROSTER_IMPORT` | POST /admin/import |
| `LOCATION_CREATED` | POST /admin/locations |
| `LOCATION_UPDATED` | PUT /admin/locations/{id} |
| `LOCATION_DEACTIVATED` | DELETE /admin/locations/{id} |
| `USER_CREATED` | POST /admin/users |
| `USER_UPDATED` | PUT /admin/users/{id} |
| `USER_DEACTIVATED` | DELETE /admin/users/{id} |
| `CONFIG_UPDATED` | PUT /admin/config |
| `ACCESS_GRANT_CREATED` | POST /admin/access-grants |
| `ACCESS_GRANT_REVOKED` | DELETE /admin/access-grants/{id} |

---

## Indexes Summary

| Table | Column(s) | Type |
|---|---|---|
| users | email | UNIQUE |
| users | (implied by PK) | PRIMARY |
| submissions | location_id | INDEX |
| submissions | operator_id | INDEX |
| submissions | submission_date | INDEX |
| submissions | status | INDEX |
| verifications | verification_type | INDEX |
| verifications | location_id | INDEX |
| verifications | verification_date | INDEX |
| verifications | status | INDEX |
| audit_events | event_type | INDEX |
| audit_events | actor_id | INDEX |
| audit_events | location_id | INDEX |
| audit_events | created_at | INDEX |
| access_grants | user_id | INDEX |

---

## Design Notes & Constraints

1. **No FK constraints defined** — location_id relationships are logical only; enforced in application code. This keeps SQLite compatibility.
2. **JSON fields** — `location_ids`, `access_grants`, `sections` use SQLAlchemy's JSON type (TEXT in SQLite, JSONB in PostgreSQL).
3. **Soft deletes** — Users and Locations use `active=False`; no records are hard-deleted.
4. **Submission uniqueness** — Not enforced at DB level. Application logic uses upsert (find by location+date → replace) to prevent duplicates per location per day in demo mode; the API allows multiple records for flexibility (reject → resubmit scenario creates a new record).
5. **Password hashing** — bcrypt (cost factor 12) via `passlib`. Default imported-user password: `demo1234`.
6. **Timezone** — All timestamps stored as UTC (`TIMESTAMPTZ`). Dates (submission_date, verification_date, missed_date) stored as `VARCHAR(10)` in `YYYY-MM-DD` format for portability.

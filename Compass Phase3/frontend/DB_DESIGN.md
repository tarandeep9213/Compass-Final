# Database Design
# Compass CashRoom Compliance System (CCS)

**Version:** 1.0
**Based on:** PRD v2.0
**Database:** PostgreSQL 16
**ORM:** SQLAlchemy (async) with Alembic migrations

---

## Table of Contents

1. [Enums](#1-enums)
2. [Tables](#2-tables)
   - 2.1 locations
   - 2.2 users
   - 2.3 user_locations
   - 2.4 submissions
   - 2.5 submission_sections
   - 2.6 missed_submissions
   - 2.7 verifications
   - 2.8 system_config
   - 2.9 location_config_overrides
   - 2.10 access_grants
   - 2.11 audit_events
3. [Indexes](#3-indexes)
4. [Relationships Diagram](#4-relationships-diagram)
5. [Migration Order](#5-migration-order)
6. [Seed Data](#6-seed-data)
7. [Design Notes](#7-design-notes)

---

## 1. Enums

All enums are created as PostgreSQL native `ENUM` types before any table creation.

```sql
-- User roles (Manager removed in v2.0)
CREATE TYPE user_role AS ENUM (
    'OPERATOR',
    'CONTROLLER',
    'DGM',
    'ADMIN',
    'AUDITOR',
    'REGIONAL_CONTROLLER'
);

-- Submission lifecycle states
CREATE TYPE submission_status AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED'
);

-- How the submission was created
CREATE TYPE submission_source AS ENUM (
    'FORM',
    'CHAT',
    'EXCEL_UPLOAD'
);

-- Which type of compliance visit
CREATE TYPE verification_type AS ENUM (
    'CONTROLLER',
    'DGM'
);

-- Visit lifecycle states
CREATE TYPE verification_status AS ENUM (
    'SCHEDULED',
    'COMPLETED',
    'MISSED',
    'CANCELLED'
);

-- Immutable audit event types
CREATE TYPE audit_event_type AS ENUM (
    'SUBMISSION_CREATED',
    'SUBMISSION_APPROVED',
    'SUBMISSION_REJECTED',
    'CONTROLLER_VERIFIED',
    'DGM_VERIFIED',
    'USER_CREATED',
    'USER_UPDATED',
    'LOCATION_CREATED',
    'LOCATION_UPDATED',
    'CONFIG_CHANGED',
    'MISSED_SUBMISSION_LOGGED',
    'ACCESS_GRANTED',
    'ACCESS_REVOKED'
);
```

---

## 2. Tables

---

### 2.1 `locations`

Cashroom locations. Soft-deleted via `active = false`.

```sql
CREATE TABLE locations (
    id              VARCHAR(20)     PRIMARY KEY,
    -- Human-readable code, e.g. "LHR-T5-01", "ORD-F3-02"
    -- Set by admin at creation. Immutable after creation.

    name            VARCHAR(200)    NOT NULL,
    city            VARCHAR(100)    NOT NULL,

    expected_cash   NUMERIC(12,2)   NOT NULL DEFAULT 9575.00,
    -- The imprest (fixed fund) for this location.
    -- Used to compute variance on every submission.
    -- Snapshot is taken at submission time — changing this does not
    -- retroactively alter existing submissions.

    tolerance_pct   NUMERIC(5,2)    NOT NULL DEFAULT 5.00,
    -- Variance % above which an explanation note is required.
    -- Can be overridden per-location in location_config_overrides.
    -- Range enforced by application: 1.00 – 20.00

    sla_hours       INTEGER         NOT NULL DEFAULT 48,
    -- Hours after submission before it is flagged as overdue.
    -- Global default stored in system_config; per-location override here.

    active          BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
```

**Constraints:**
- `id` is set once at creation and never changed.
- Application must enforce `tolerance_pct` between 1 and 20.
- `expected_cash` must be > 0 (application-level validation).

---

### 2.2 `users`

All system users across all roles. Soft-deleted via `active = false`.

```sql
CREATE TABLE users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    name            VARCHAR(200)    NOT NULL,

    email           VARCHAR(255)    NOT NULL,
    CONSTRAINT uq_users_email UNIQUE (email),

    hashed_password VARCHAR(255)    NOT NULL,
    -- bcrypt hash. Never store plaintext.

    role            user_role       NOT NULL,

    active          BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
```

**Notes:**
- Password reset is out of scope for v1. Admin can update `hashed_password` via the update user endpoint.
- `email` is case-insensitive in practice — store and compare lowercased.

---

### 2.3 `user_locations`

Many-to-many join between users and locations. Defines which locations each user is responsible for.

```sql
CREATE TABLE user_locations (
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id     VARCHAR(20)     NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

    PRIMARY KEY (user_id, location_id)
);
```

**Notes:**
- Operators: can only submit for their assigned locations.
- Controllers: can only approve/reject submissions and schedule visits for their assigned locations.
- DGMs: can only log oversight visits for their assigned locations.
- Admins, Auditors, Regional Controllers: location assignment has no access restriction effect (they see all locations), but may still be populated for display context.

---

### 2.4 `submissions`

One record per operator cash count submission. One active (non-DRAFT) submission per location per day.

```sql
CREATE TABLE submissions (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),

    location_id         VARCHAR(20)         NOT NULL REFERENCES locations(id),
    operator_id         UUID                NOT NULL REFERENCES users(id),

    submission_date     DATE                NOT NULL,
    -- The business date this count covers. Not the wall-clock time of submission.

    status              submission_status   NOT NULL DEFAULT 'DRAFT',

    source              submission_source   NOT NULL DEFAULT 'FORM',
    -- How the operator entered the data.

    -- ── Calculated totals (all computed server-side) ─────────────────────
    total_cash          NUMERIC(12,2),
    -- NULL while in DRAFT. Populated on submit.

    expected_cash       NUMERIC(12,2),
    -- Snapshot of locations.expected_cash at submit time.
    -- Immutable after submit. Protects historical data if location config changes.

    variance            NUMERIC(12,2),
    -- total_cash - expected_cash. NULL while in DRAFT.

    variance_pct        NUMERIC(8,4),
    -- (variance / expected_cash) * 100. NULL while in DRAFT.

    variance_exception  BOOLEAN             NOT NULL DEFAULT FALSE,
    -- TRUE if |variance_pct| > tolerance at submit time.

    variance_note       TEXT,
    -- Required when variance_exception = TRUE. Min 10 chars enforced at application level.

    -- ── Approval fields ──────────────────────────────────────────────────
    approved_by         UUID                REFERENCES users(id),
    -- References the Controller who approved or rejected.

    approved_at         TIMESTAMPTZ,

    rejection_reason    TEXT,
    -- Populated only when status = 'REJECTED'. Min 10 chars enforced at application level.

    -- ── Timestamps ───────────────────────────────────────────────────────
    submitted_at        TIMESTAMPTZ,
    -- NULL while in DRAFT. Set when status changes from DRAFT to PENDING_APPROVAL.

    excel_filename      VARCHAR(500),
    -- Original filename when source = 'EXCEL_UPLOAD'.

    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    -- One non-DRAFT submission per location per day.
    -- DRAFT submissions do not participate in this constraint.
    -- Enforced by partial unique index (see indexes section).
    CONSTRAINT uq_submissions_location_date UNIQUE (location_id, submission_date)
);
```

**Business logic notes:**
- The `UNIQUE (location_id, submission_date)` constraint means only one record can exist per location per day. When an operator resubmits after rejection, the old REJECTED record must be deleted or updated before the new one is inserted.
- Recommended approach on resubmit: UPDATE the existing REJECTED record back to DRAFT, then re-populate it. This preserves the `id` and avoids constraint violations.
- `expected_cash` and `tolerance_pct` are snapshotted at submit time from the location (with override check). Never re-read from locations after submission is finalised.

---

### 2.5 `submission_sections`

Section-level breakdown for each submission. One row per section (A–I) per submission.

```sql
CREATE TABLE submission_sections (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id   UUID            NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,

    section_code    CHAR(1)         NOT NULL,
    CONSTRAINT chk_section_code CHECK (section_code IN ('A','B','C','D','E','F','G','H','I')),

    section_total   NUMERIC(12,2)   NOT NULL DEFAULT 0.00,
    -- Calculated total for this section.

    denominations   JSONB,
    -- Raw denomination breakdown. Structure varies by section:
    --
    -- Section A (Currency Bills):
    --   { "100": 5, "50": 2, "20": 10, "10": 0, "5": 4, "2": 0, "1": 3 }
    --   Keys are denomination face values (as strings). Values are quantities.
    --
    -- Section B (Coins in Counting Machines):
    --   { "1.00": 20, "0.50": 10, "0.25": 40, "0.10": 5, "0.05": 2, "0.01": 0 }
    --
    -- Section C (Bagged Coin):
    --   { "25_dollar_bags": 2, "10_quarter_bags": 1, "5_dime_bags": 0,
    --     "2_nickel_bags": 0, "50_bulkers": 0 }
    --
    -- Section D (Unissued Changer Funds):
    --   { "rows": [{"qty": 2, "amount": 50.00}, {"qty": 1, "amount": 20.00},
    --              {"qty": 0, "amount": 0}, {"qty": 0, "amount": 0}] }
    --
    -- Section E (Rolled Coin):
    --   { "row1": 120.00, "row2": 55.00, "row3": 0.00, "row4": 0.00 }
    --
    -- Section F (Returned Uncounted Funds):
    --   { "amount1": 200.00, "amount2": 0.00, "amount3": 0.00 }
    --
    -- Section G (Mutilated / Foreign Currency):
    --   { "currency": 15.00, "coin": 3.50 }
    --
    -- Section H (Changer Funds Outstanding):
    --   { "amount": 500.00 }
    --
    -- Section I (Net Unreimbursed Shortage/Overage):
    --   { "shortage": 50.00, "overage": 20.00 }
    --   section_total = overage - shortage (can be negative)

    CONSTRAINT uq_submission_section UNIQUE (submission_id, section_code)
);
```

---

### 2.6 `missed_submissions`

Formal explanation records for days where an operator did not submit. Does NOT create a submission — the day remains "Missing" in compliance tracking.

```sql
CREATE TABLE missed_submissions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    location_id     VARCHAR(20)     NOT NULL REFERENCES locations(id),
    operator_id     UUID            NOT NULL REFERENCES users(id),

    missed_date     DATE            NOT NULL,
    -- The calendar date that was missed.

    reason          VARCHAR(50)     NOT NULL,
    -- One of: 'Illness', 'Technical Issue', 'Emergency',
    --         'Public Holiday', 'Training', 'Other'
    -- Enforced at application level.

    detail          TEXT            NOT NULL,
    -- Min 20 chars enforced at application level.

    supervisor_name VARCHAR(200)    NOT NULL,
    -- Name of the supervisor who authorised or is aware of the missed day.

    logged_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_missed_location_date UNIQUE (location_id, missed_date)
    -- Only one explanation per location per day.
);
```

---

### 2.7 `verifications`

Physical visit records for both Controller verification visits and DGM monthly oversight visits.

```sql
CREATE TABLE verifications (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),

    location_id         VARCHAR(20)             NOT NULL REFERENCES locations(id),

    verifier_id         UUID                    NOT NULL REFERENCES users(id),
    -- The Controller or DGM who owns this visit.

    verification_type   verification_type       NOT NULL,
    -- 'CONTROLLER' or 'DGM'.

    status              verification_status     NOT NULL DEFAULT 'SCHEDULED',

    verification_date   DATE                    NOT NULL,
    -- The scheduled or actual date of the visit.

    month_year          CHAR(7),
    -- Format: 'YYYY-MM'. Populated ONLY for DGM visits.
    -- Derived from verification_date on create: LEFT(verification_date::TEXT, 7)
    -- Used for the DGM one-visit-per-month uniqueness constraint.

    scheduled_time      CHAR(5),
    -- Format: 'HH:MM'. Populated ONLY for Controller visits.
    -- One of: '09:00', '11:00', '13:00', '15:00', '17:00'

    day_of_week         SMALLINT,
    -- 0 = Sunday, 1 = Monday, ... 6 = Saturday (PostgreSQL EXTRACT(DOW ...))
    -- Computed from verification_date on create and stored for DOW pattern queries.

    -- ── DOW warning fields (Controller only) ────────────────────────────
    warning_flag        BOOLEAN                 NOT NULL DEFAULT FALSE,
    -- TRUE if a day-of-week pattern warning was triggered on scheduling or completion.

    warning_reason      TEXT,
    -- Reason selected by controller when acknowledging the DOW warning.
    -- One of: 'operational', 'requested', 'followup', 'other'

    -- ── Completion fields ────────────────────────────────────────────────
    observed_total      NUMERIC(12,2),
    -- Cash total physically observed by the verifier. Populated on completion.

    signature_data      TEXT,
    -- Base64-encoded PNG from the digital signature canvas.
    -- Populated on completion. Max 200 KB enforced at application level.

    missed_reason       TEXT,
    -- Reason selected when marking as MISSED. Application-level enum:
    -- 'Location access unavailable', 'Operational conflict — staff not available',
    -- 'Personal / medical emergency', 'Travel or transport issue',
    -- 'Rescheduled by area manager', 'Other (documented separately)'

    notes               TEXT,
    -- Free-text notes entered by the verifier on completion or when missing.

    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- Prevents duplicate DGM visits per location per month.
    -- month_year is NULL for Controller visits, so this constraint only
    -- fires for DGM rows (NULL != NULL in SQL unique constraints).
    CONSTRAINT uq_dgm_location_month UNIQUE (location_id, month_year, verification_type)
);
```

**Business logic notes:**
- `day_of_week` and `month_year` must be derived server-side from `verification_date` — never trust client-supplied values for these.
- DOW lookback window (4 or 6 weeks) is read from `system_config` key `dow_lookback_weeks` at query time.
- When marking a visit COMPLETED: set `status='COMPLETED'`, `observed_total`, `signature_data`, `notes`. Also check DOW pattern and set `warning_flag`/`warning_reason` if applicable.
- When marking a visit MISSED: set `status='MISSED'`, `missed_reason`, `notes`.

---

### 2.8 `system_config`

Key-value store for global system settings. One row per setting.

```sql
CREATE TABLE system_config (
    key             VARCHAR(100)    PRIMARY KEY,
    value           TEXT            NOT NULL,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_by      UUID            REFERENCES users(id)
);
```

**Predefined keys and their types:**

| Key | Type | Default | Description |
|---|---|---|---|
| `default_tolerance_pct` | NUMERIC string | `"5.00"` | Default variance tolerance % for new locations |
| `approval_sla_hours` | INTEGER string | `"48"` | Hours before a pending submission is flagged overdue |
| `dow_lookback_weeks` | INTEGER string | `"6"` | How many weeks back to check DOW patterns (4 or 6) |
| `daily_reminder_time` | TIME string | `"08:00"` | HH:MM time to send daily operator reminders |
| `data_retention_years` | INTEGER string | `"7"` | How many years of data to retain |

All values stored as text strings. Application layer parses to the appropriate type. Update via `PUT /v1/admin/config`.

---

### 2.9 `location_config_overrides`

Per-location overrides for tolerance. When present, overrides the global `default_tolerance_pct`.

```sql
CREATE TABLE location_config_overrides (
    location_id     VARCHAR(20)     PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
    tolerance_pct   NUMERIC(5,2)    NOT NULL,
    -- Range: 1.00 – 20.00 (enforced at application level)
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_by      UUID            REFERENCES users(id)
);
```

**Lookup logic (application layer):**
```python
async def get_effective_tolerance(db, location_id: str) -> Decimal:
    override = await db.get(LocationConfigOverride, location_id)
    if override:
        return override.tolerance_pct
    config = await db.get(SystemConfig, 'default_tolerance_pct')
    return Decimal(config.value) if config else Decimal('5.00')
```

---

### 2.10 `access_grants`

Server-side storage for screen access delegation. Grants DGM or Regional Controller users access to Operator or Controller screens.

```sql
CREATE TABLE access_grants (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Must have role DGM or REGIONAL_CONTROLLER (enforced at application level).

    access_type     VARCHAR(20)     NOT NULL,
    CONSTRAINT chk_access_type CHECK (access_type IN ('operator', 'controller')),

    note            TEXT,
    -- Optional reason/note entered by admin when granting.

    granted_by      UUID            NOT NULL REFERENCES users(id),
    -- Admin user who granted this access.

    granted_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_access_grant UNIQUE (user_id, access_type)
    -- One grant per user per access type. Upsert on re-grant.
);
```

**Notes:**
- Included in `GET /v1/auth/me` response as `access_grants: ["operator", "controller"]`.
- Frontend uses this list to show/hide sidebar nav items.
- Revoking = DELETE the row.

---

### 2.11 `audit_events`

Immutable append-only log of all state-changing actions. Never updated or deleted.

```sql
CREATE TABLE audit_events (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),

    event_type      audit_event_type    NOT NULL,

    actor_id        UUID                REFERENCES users(id),
    -- NULL only for system-generated events (e.g., automated reminders).

    actor_name      VARCHAR(200),
    -- Snapshot of users.name at event time.
    -- Preserved even if the user is later renamed or deactivated.

    actor_role      user_role,
    -- Snapshot of users.role at event time.

    location_id     VARCHAR(20)         REFERENCES locations(id),
    -- NULL for events not tied to a specific location (e.g., USER_CREATED).

    entity_id       UUID,
    -- ID of the primary entity affected (submission_id, verification_id, user_id, etc.)

    entity_type     VARCHAR(50),
    -- E.g., 'submission', 'verification', 'user', 'location', 'config', 'access_grant'

    detail          TEXT                NOT NULL,
    -- Human-readable description of what happened.
    -- E.g., "Submission approved for 2026-03-05, total $9,620.50, variance +$45.50"

    old_value       TEXT,
    -- Previous value, for CONFIG_CHANGED and USER_UPDATED events.
    -- JSON string or simple scalar.

    new_value       TEXT,
    -- New value after the change.

    ip_address      VARCHAR(45),
    -- IPv4 or IPv6 address of the actor. Captured from request.

    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
```

**Example detail strings by event type:**

| Event Type | Example `detail` |
|---|---|
| SUBMISSION_CREATED | `"Submission created for 2026-03-05 at LHR-T5-01, total $9,620.50 (FORM)"` |
| SUBMISSION_APPROVED | `"Submission approved for 2026-03-05 at LHR-T5-01, total $9,620.50, variance +$45.50"` |
| SUBMISSION_REJECTED | `"Submission rejected for 2026-03-05 at LHR-T5-01, reason: Cash count does not match physical"` |
| CONTROLLER_VERIFIED | `"Controller visit completed at LHR-T5-01 on 2026-03-05, observed $9,580.00"` |
| DGM_VERIFIED | `"DGM visit completed at LHR-T5-01 for March 2026, observed $9,600.00"` |
| USER_CREATED | `"User created: jane.doe@compass.com (CONTROLLER)"` |
| CONFIG_CHANGED | `"approval_sla_hours changed"` (old_value: `"48"`, new_value: `"72"`) |
| ACCESS_GRANTED | `"Operator access granted to john.smith@compass.com (DGM)"` |
| ACCESS_REVOKED | `"Operator access revoked from john.smith@compass.com (DGM)"` |

---

## 3. Indexes

```sql
-- ── users ────────────────────────────────────────────────────────────────
CREATE INDEX idx_users_email         ON users(lower(email));
CREATE INDEX idx_users_role          ON users(role) WHERE active = TRUE;

-- ── user_locations ───────────────────────────────────────────────────────
CREATE INDEX idx_ul_location         ON user_locations(location_id);
-- (user_id, location_id) already covered by PRIMARY KEY

-- ── submissions ──────────────────────────────────────────────────────────
CREATE INDEX idx_sub_location_date   ON submissions(location_id, submission_date DESC);
CREATE INDEX idx_sub_operator_date   ON submissions(operator_id, submission_date DESC);
CREATE INDEX idx_sub_status          ON submissions(status, submitted_at DESC)
    WHERE status IN ('PENDING_APPROVAL', 'REJECTED');
-- Partial index: only pending/rejected rows for the approval queue

CREATE INDEX idx_sub_overdue         ON submissions(submitted_at, location_id)
    WHERE status = 'PENDING_APPROVAL';
-- For the overdue check: WHERE submitted_at < NOW() - INTERVAL 'X hours'

-- ── submission_sections ──────────────────────────────────────────────────
-- (submission_id, section_code) covered by UNIQUE constraint
-- No additional indexes needed — always accessed by submission_id

-- ── missed_submissions ───────────────────────────────────────────────────
CREATE INDEX idx_missed_location     ON missed_submissions(location_id, missed_date DESC);
CREATE INDEX idx_missed_operator     ON missed_submissions(operator_id);

-- ── verifications ────────────────────────────────────────────────────────
CREATE INDEX idx_ver_location_type   ON verifications(location_id, verification_type, verification_date DESC);
CREATE INDEX idx_ver_verifier        ON verifications(verifier_id, verification_date DESC);
CREATE INDEX idx_ver_month           ON verifications(location_id, month_year)
    WHERE verification_type = 'DGM';
-- For DGM monthly coverage checks

CREATE INDEX idx_ver_scheduled       ON verifications(location_id, verification_date)
    WHERE status = 'SCHEDULED';
-- For "already booked" checks in the schedule flow

CREATE INDEX idx_ver_dow             ON verifications(location_id, day_of_week, verification_date DESC)
    WHERE verification_type = 'CONTROLLER' AND status = 'COMPLETED';
-- For DOW pattern lookback queries

-- ── access_grants ────────────────────────────────────────────────────────
CREATE INDEX idx_ag_user             ON access_grants(user_id);

-- ── audit_events ─────────────────────────────────────────────────────────
CREATE INDEX idx_audit_actor         ON audit_events(actor_id, created_at DESC);
CREATE INDEX idx_audit_location      ON audit_events(location_id, created_at DESC);
CREATE INDEX idx_audit_event_type    ON audit_events(event_type, created_at DESC);
CREATE INDEX idx_audit_entity        ON audit_events(entity_id, entity_type);
```

---

## 4. Relationships Diagram

```
locations (1) ─────────────── (*) user_locations (*) ─────────────── (1) users
    │                                                                      │
    │ (1)                                                                  │ (1)
    │                                                                      │
    ├──── (*) submissions ──── approved_by ────────────────────────────────┤
    │         │                                                            │
    │         └──── (*) submission_sections                                │
    │                                                                      │
    ├──── (*) missed_submissions ── operator_id ───────────────────────────┤
    │                                                                      │
    ├──── (*) verifications ── verifier_id ────────────────────────────────┤
    │                                                                      │
    ├──── (0..1) location_config_overrides                                 │
    │                                                                      │
    └──── (referenced by) audit_events                                     │
                                                                           │
              access_grants ── user_id ─────────────────────────────────── │
              access_grants ── granted_by ──────────────────────────────── ┘

system_config  (standalone key-value, no FK)
audit_events   (references users and locations via FK, but append-only)
```

---

## 5. Migration Order

Run Alembic migrations in this order to respect foreign key dependencies:

```
001_create_enums.sql
002_create_locations.sql
003_create_users.sql
004_create_user_locations.sql
005_create_submissions.sql
006_create_submission_sections.sql
007_create_missed_submissions.sql
008_create_verifications.sql
009_create_system_config.sql
010_create_location_config_overrides.sql
011_create_access_grants.sql
012_create_audit_events.sql
013_create_indexes.sql
014_seed_system_config.sql
```

---

## 6. Seed Data

### system_config (required — must exist before any API call that reads config)

```sql
INSERT INTO system_config (key, value, updated_by) VALUES
    ('default_tolerance_pct', '5.00',  NULL),
    ('approval_sla_hours',    '48',    NULL),
    ('dow_lookback_weeks',    '6',     NULL),
    ('daily_reminder_time',   '08:00', NULL),
    ('data_retention_years',  '7',     NULL);
```

### Demo users (development/testing only — remove or gate behind ENV flag in production)

```sql
-- Passwords: all 'demo1234' hashed with bcrypt cost 12
-- Hash: $2b$12$... (generate fresh hashes — do not reuse the string below)

INSERT INTO users (id, name, email, hashed_password, role) VALUES
    (gen_random_uuid(), 'Alex Operator',    'operator@compass.com',           '<bcrypt>', 'OPERATOR'),
    (gen_random_uuid(), 'Chris Controller', 'controller@compass.com',         '<bcrypt>', 'CONTROLLER'),
    (gen_random_uuid(), 'Dana DGM',         'dgm@compass.com',                '<bcrypt>', 'DGM'),
    (gen_random_uuid(), 'Admin User',       'admin@compass.com',              '<bcrypt>', 'ADMIN'),
    (gen_random_uuid(), 'RC User',          'regionalcontroller@compass.com', '<bcrypt>', 'REGIONAL_CONTROLLER'),
    (gen_random_uuid(), 'Audit User',       'auditor@compass.com',            '<bcrypt>', 'AUDITOR');
```

---

## 7. Design Notes

### 7.1 Resubmission handling

When an operator resubmits after rejection:
- The existing REJECTED submission row is **updated** back to DRAFT status.
- All section rows (submission_sections) are deleted and re-inserted with new values.
- `submitted_at` and `approved_by` are reset to NULL.
- On final submit, status moves to PENDING_APPROVAL and `submitted_at` is set.
- This preserves the original `id` and avoids the UNIQUE constraint on `(location_id, submission_date)`.

### 7.2 Effective tolerance resolution

For any submission or DOW check, the effective tolerance is resolved as:
1. Check `location_config_overrides` for this `location_id`.
2. If found, use `override.tolerance_pct`.
3. If not found, use `system_config['default_tolerance_pct']`.
4. Default fallback: `5.00`.

### 7.3 DGM uniqueness constraint

The constraint `UNIQUE (location_id, month_year, verification_type)` only fires for DGM rows because `month_year` is NULL for Controller visits. In SQL, `NULL != NULL`, so Controller rows never conflict on this constraint. This is intentional design — Controllers can have multiple visits to the same location per month.

### 7.4 Signature data storage

`signature_data` in `verifications` stores a base64 PNG string from the canvas element. Maximum accepted size is 200 KB (application-level check before INSERT). If long-term archival is needed, consider moving this to S3 in a future version and storing only the S3 key here.

### 7.5 Currency precision

All money values use `NUMERIC(12,2)`. This supports up to $9,999,999,999.99. **Never use FLOAT or DOUBLE for currency** — floating-point rounding will corrupt variance calculations.

### 7.6 Cascade behaviour

| Relationship | On parent DELETE |
|---|---|
| `user_locations` → `users` | CASCADE (remove assignments) |
| `user_locations` → `locations` | CASCADE (remove assignments) |
| `submission_sections` → `submissions` | CASCADE (remove sections with submission) |
| `access_grants` → `users` | CASCADE (revoke grants if user deleted) |
| `location_config_overrides` → `locations` | CASCADE (remove override if location deleted) |
| `submissions` → `locations` | RESTRICT (cannot delete a location with submissions) |
| `verifications` → `locations` | RESTRICT (cannot delete a location with verifications) |
| `missed_submissions` → `locations` | RESTRICT |
| `audit_events` → `users` / `locations` | SET NULL (preserve audit trail even if actor deleted) |
```

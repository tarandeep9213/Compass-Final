# CashRoom Compliance System — Architecture Document

**Version:** 1.0
**Date:** 2026-03-06
**Status:** Current (reflects implemented and tested state)

---

## 1. System Overview

CashRoom Compliance System (CCS) is a role-based cash management and compliance tracking platform for Compass Group food-service facilities. It digitises the daily cashroom counting process, enforces submission SLAs, and provides controller/DGM verification visit scheduling with day-of-week (DOW) pattern warnings.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React SPA)                        │
│                                                                     │
│  ┌───────────┐  ┌────────────────────────────────────────────────┐  │
│  │  Login    │  │  AppShell (role-based nav + state routing)     │  │
│  │  Page     │  │                                                │  │
│  │           │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  Dynamic  │  │  │ Operator │ │Controller│ │    Admin     │  │  │
│  │  demo     │  │  │  Pages   │ │  Pages   │ │    Pages     │  │  │
│  │  hints    │  │  │          │ │          │ │              │  │  │
│  │  from     │  │  │ OpStart  │ │CtrlDash  │ │AdmLocations  │  │  │
│  │  USERS[]  │  │  │ OpMethod │ │CtrlLog   │ │AdmUsers      │  │  │
│  └───────────┘  │  │ OpForm   │ │CtrlHist  │ │AdmImport     │  │  │
│                 │  │ OpExcel  │ │DailyRpt  │ │AdmCompliance │  │  │
│                 │  │ OpChat   │ │          │ │AdmAudit      │  │  │
│                 │  │ OpReadonly│ ├──────────┤ │AdmReports    │  │  │
│                 │  │ OpDrafts │ │  DGM     │ └──────────────┘  │  │
│                 │  │ OpMissed │ │  Pages   │                   │  │
│                 │  └──────────┘ │ DGMDash  │ ┌──────────────┐  │  │
│                 │               │ DGMLog   │ │  Regional    │  │  │
│                 │               │ DGMHist  │ │  Controller  │  │  │
│                 │               └──────────┘ │  RcTrends    │  │  │
│                 │                            └──────────────┘  │  │
│                 └────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  src/api/  (fetch wrapper + JWT token management)             │  │
│  │  client.ts · auth.ts · submissions.ts · verifications.ts      │  │
│  │  admin.ts  · compliance.ts · reports.ts · audit.ts            │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
│                                  │ HTTP/JSON (VITE_API_URL)         │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────────┐
│                    BACKEND (FastAPI + Python 3.13)                   │
│                                  │                                  │
│  ┌───────────────────────────────▼──────────────────────────────┐   │
│  │  app/main.py — CORS middleware + lifespan scheduler          │   │
│  │                                                              │   │
│  │  app/api/v1/router.py                                        │   │
│  │  ┌──────────┬────────────┬────────────┬──────────────────┐  │   │
│  │  │  auth    │ submissions│verifications│     admin        │  │   │
│  │  │  login   │ POST /sub  │ ctrl/dgm   │ locations/users  │  │   │
│  │  │  me      │ GET  /sub  │ schedule   │ config/import    │  │   │
│  │  │  refresh │ approve    │ complete   │ access-grants    │  │   │
│  │  │          │ reject     │ miss       │                  │  │   │
│  │  │          │ submit     │ check-dow  │                  │  │   │
│  │  ├──────────┼────────────┼────────────┼──────────────────┤  │   │
│  │  │locations │ compliance │  reports   │     audit        │  │   │
│  │  │ CRUD     │ dashboard  │ summary    │ event log        │  │   │
│  │  │          │            │ export     │ filter-options   │  │   │
│  │  └──────────┴────────────┴────────────┴──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────┐   ┌─────────────────────────────────┐  │
│  │  app/services/          │   │  app/core/                      │  │
│  │  email.py  (fastapi-mail│   │  security.py  (bcrypt + JWT)    │  │
│  │  + Jinja2 templates)    │   │  deps.py      (get_current_user) │  │
│  │  scheduler.py           │   │  config.py    (env settings)    │  │
│  │  audit.py               │   └─────────────────────────────────┘  │
│  └─────────────────────────┘                                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SQLAlchemy ORM → SQLite (dev) / PostgreSQL (prod)           │   │
│  │                                                              │   │
│  │  users · locations · submissions · missed_submissions        │   │
│  │  verifications · audit_events · system_config                │   │
│  │  location_tolerance_overrides · access_grants                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────┐   ┌─────────────────────────────────────┐ │
│  │  APScheduler         │   │  SMTP (fastapi-mail)                │ │
│  │  Daily reminder job  │   │  submission_pending.html            │ │
│  │  08:00 UTC           │   │  submission_approved.html           │ │
│  └──────────────────────┘   │  submission_rejected.html           │ │
│                             │  missed_explanation.html            │ │
│                             │  visit_scheduled.html               │ │
│                             │  visit_completed.html               │ │
│                             └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Role & Permission Matrix

| Role | Submit | Approve/Reject | Schedule Visit | View All | Admin |
|------|--------|---------------|----------------|----------|-------|
| Operator | Own location only | — | — | — | — |
| Controller | — | Assigned locations | Controller visits | Assigned locations | — |
| DGM | — | — | DGM monthly visits | Assigned locations | — |
| Regional Controller | — | — | — | All locations | — |
| Admin | — | — | — | All | Full CRUD |
| Auditor | — | — | — | Read-only | — |

**Access Grants** — An Admin can grant a DGM or Regional Controller the `operator` or `controller` access type, allowing them to use those role's screens in addition to their own.

---

## 4. Navigation Model (Frontend)

There is **no React Router**. All navigation is state-based:

```
App.tsx
  └── AuthState { userId, role, name, locationIds }
        └── AppShell
              └── NavCtx { panel: string, ctx: Record<string,string> }
                    └── renderPanel() switch → component tree
```

Context keys passed via `onNavigate(panel, ctx)`:

| Panel | Context Keys |
|-------|-------------|
| `op-form` | `locationId`, `date`, `method`, `draftId?` |
| `op-readonly` | `locationId`, `date`, `submissionId`, `fromPanel?` |
| `op-missed` | `locationId`, `date`, `viewOnly?` |
| `ctrl-schedule` | `locationId`, `date` |

---

## 5. Submission Lifecycle

```
         Operator
            │
            ▼
    ┌───────────────┐     save_as_draft=true    ┌────────┐
    │  POST /sub    │──────────────────────────► │ DRAFT  │
    │  (FORM/EXCEL) │                            └───┬────┘
    └───────────────┘     save_as_draft=false        │ PUT /sub/{id}
            │                                        │ (update sections)
            │                                        │
            ▼                                        │ POST /sub/{id}/submit
    ┌──────────────────┐ ◄───────────────────────────┘
    │ PENDING_APPROVAL │
    │  (email → ctrl)  │
    └───────┬──────────┘
            │
     Controller reviews
            │
    ┌───────┴───────────┐
    │                   │
    ▼                   ▼
┌────────┐         ┌──────────┐
│APPROVED│         │ REJECTED │
│(email  │         │(email →  │
│→ oper) │         │ operator)│
└────────┘         └────┬─────┘
                        │
                   Operator resubmits
                        │
                        ▼
                ┌──────────────────┐
                │ PENDING_APPROVAL │  (new submission record)
                └──────────────────┘
```

---

## 6. Notification Map

| Event | Trigger | Recipient | Template |
|-------|---------|-----------|----------|
| N-01 | Submission created (not draft) via POST /submissions | Controllers at that location | `submission_pending.html` |
| N-02 | Draft submitted via POST /submissions/{id}/submit | Controllers at that location | `submission_pending.html` |
| N-03 | Submission approved | Operator | `submission_approved.html` |
| N-04 | Submission rejected | Operator | `submission_rejected.html` |
| N-05 | Controller visit scheduled | All DGMs | `visit_scheduled.html` |
| N-06 | Controller visit completed | All DGMs | `visit_completed.html` |
| N-07 | DGM visit scheduled | All Regional Controllers | `visit_scheduled.html` |
| N-08 | DGM visit completed | All Regional Controllers | `visit_completed.html` |
| N-09 | Missed submission explanation | Controllers at that location | `missed_explanation.html` |

All notifications are sent via `BackgroundTasks` (non-blocking).

---

## 7. Data Persistence Model

### Production
- **Backend DB:** SQLite (dev) / PostgreSQL (prod) via SQLAlchemy ORM
- **Sessions:** JWT access token (1h) + refresh token (7d), stored in `localStorage`

### Demo / Mock Mode
- **Frontend mock data** (`src/mock/data.ts`): static arrays loaded from `localStorage` via `loadStored()` / `saveStored()`
- API calls are attempted first; on failure, the frontend falls back to mock data
- Import roster: calls `POST /v1/admin/import` → on failure, populates `localStorage`

---

## 8. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend routing | State-based (no React Router) | Simpler for POC; single `renderPanel()` switch |
| State management | Local component state only | No Redux/Zustand needed at current scale |
| Auth | JWT (HS256) + bcrypt | Standard, stateless, easy to extend |
| Email | fastapi-mail + BackgroundTasks | Non-blocking; Jinja2 templates for HTML emails |
| DB | SQLite → PostgreSQL | Easy dev setup; migration path via Alembic |
| Submission upsert | Replace by index (same date) | Prevents duplicate submissions per location per day |
| DOW warning | Lookback window (configurable, default 4 weeks) | Flags predictable visit patterns to improve security |
| Roster import | Name → auto-email (`first.last@compass.com`) | Excel contains names not emails; default password `demo1234` |

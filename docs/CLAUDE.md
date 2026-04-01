# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CashRoom Compliance System (CCS)** — a full-stack web app for Compass Group facilities to digitise daily cash reconciliation. Operators submit cash counts, managers approve them, controllers/DGMs schedule physical verification visits, and admins oversee the whole system.

## Commands

### Frontend (`cd frontend`)
```bash
npm run dev       # Start Vite dev server (port 3000, auto-opens browser)
npm run build     # tsc -b (type-check) then vite build → dist/
npm run lint      # Run ESLint
npm run preview   # Preview production build
```
No test runner is configured for the frontend.

### Backend (`cd backend`)
```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --reload   # Dev server on port 8000
pytest                                    # Run tests
alembic upgrade head                      # Apply DB migrations
alembic revision --autogenerate -m "..."  # Generate new migration
```

### Full Stack (Docker)
```bash
docker compose up --build                     # Dev with SQLite
docker compose --profile prod up --build      # Prod with PostgreSQL
```

## Architecture

```
frontend/  (React 19 + TypeScript + Vite)   → port 3000 in dev
backend/   (FastAPI + Python 3.13)          → port 8000 in dev
```

Backend API base URL: `VITE_API_URL` env var (defaults to `http://localhost:8001/v1`).
API docs (Swagger UI): `http://localhost:8000/docs`

### Frontend Architecture

**No React Router** — navigation is entirely state-based:
- `App.tsx` holds auth state; on login renders `AppShell`
- `AppShell` tracks `{ panel: string, ctx: object }` in local state
- All screens receive `onNavigate(panel, ctx?)` to switch views
- `renderPanel()` switch statement maps panel names → components
- Screen context (locationId, submissionId, date) passed via `ctx`

**API layer** (`src/api/`):
- `client.ts` — JWT fetch wrapper; token stored in `localStorage` as `ccs_token`
- `auth.ts` — login/logout/me/refresh; refresh token as `ccs_refresh_token`
- `types.ts` — **canonical source of truth** for all API request/response TypeScript types
- Feature modules: `submissions.ts`, `verifications.ts`, `admin.ts`, `compliance.ts`, `audit.ts`, `reports.ts`
- Login falls back to mock data (`src/mock/data.ts`) for demo accounts (password: `demo1234`)

**State**: No global state — all local to components.

**Styling**: Custom CSS design system in `src/index.css` (no CSS-in-JS). CSS custom properties: `--g0`–`--g9` greens, `--amb`, `--red`, `--ow`. Fonts: DM Serif Display (headings) + DM Sans (body). Ant Design 6 is installed but the custom CSS is primary.

**TypeScript**: Strict mode with `noUnusedLocals` and `noUnusedParameters` — unused imports will break `npm run build`.

**Roles & page directories** (`src/pages/<role>/`):

| Role | Dir | Notes |
|------|-----|-------|
| `operator` | `operator/` | 8 screens: dashboard, method select, form, chat, excel, readonly, drafts, missed |
| `controller` | `controller/` | Verification scheduling; reuses `manager/MgrApprovals` for daily-report panel |
| `dgm` | `dgm/` | Monthly coverage dashboard and visit logging |
| `admin` | `admin/` | Users, locations, import, config, audit, reports, compliance |
| `regional-controller` | `regional-controller/` | Compliance dashboard, audit, reports, cash trends |

`manager/` pages (`MgrApprovals`, `MgrHistory`) are rendered for the `controller` role, not a standalone role.
DGM/Regional-Controller users can receive additional `operator`/`controller` access via `access_grants`; managed by `src/utils/operatorAccess.ts`.

### Backend Architecture

```
backend/app/
├── main.py              # FastAPI app + CORS + APScheduler lifespan
├── api/v1/              # Route modules: auth, submissions, verifications,
│                        #   locations, users, config, compliance, reports,
│                        #   audit, admin
├── core/                # config.py (Settings), security.py (JWT/bcrypt), deps.py
├── db/                  # session.py, base.py
├── models/              # SQLAlchemy ORM models
├── schemas/             # Pydantic request/response schemas
├── services/            # email.py, scheduler.py, audit.py
└── templates/email/     # Jinja2 HTML email templates
```

**Database**: SQLite (`cashroom.db`) in dev; PostgreSQL in prod (set `DATABASE_URL`).
**Background jobs**: APScheduler (daily submission reminders at configured time, local timezone).
**Auth**: JWT access token (1 hr) + refresh token (7 days).

### Key Business Rules

| Rule | Detail |
|------|--------|
| Imprest Balance | Fixed cash fund per location ($9,575 default); submissions track deviation |
| Variance Tolerance | Configurable via admin (`default_tolerance_pct`); red > tolerance, amber > tolerance/2 |
| Approval SLA | Configurable `approval_sla_hours` (default 48hrs); used for visit completion window |
| One Submission Per Day | Location cannot have two submissions for the same date |
| Controller DOW Rule | Warn (don't block) if controller visits same location on same weekday two weeks running |

### Controller Visit Rules

| Rule | Detail |
|------|--------|
| Scheduling | One visit per location per business week (Mon-Fri). Weekends blocked. |
| Complete | Available immediately after scheduling. SLA window: scheduled_time + `approval_sla_hours` (today only). Hidden after SLA expires. |
| Miss | Available after scheduled time has passed (today) or for past dates. Hidden for future. |
| Cancel | Available for future dates and today before scheduled time. Hidden after scheduled time arrives. |
| DOW Warning | Warn if same weekday visited in past 2 weeks (configurable `dow_lookback_weeks`). Must acknowledge to proceed. |
| Submission Gate | Operator's cash count submission must be approved before visit can be completed. |
| Signature | Digital signature required for completion. |

### DGM Visit Rules

| Rule | Detail |
|------|--------|
| Scheduling | One visit per location per calendar month. No time slots. |
| Complete | Available immediately after scheduling. SLA window: visit_date + `approval_sla_hours`. Hidden after SLA expires. |
| Miss | Available for past dates only. Hidden for today and future. |
| Cancel | Available for today and future dates. Hidden for past. |
| DOM Warning | Informational warning if same day-of-month visited in past 3 months. No acknowledgement required. |
| Submission Gate | Operator's cash count submission must be approved before visit can be completed. |
| Signature | Digital signature required for completion. |

### Time & Timezone

All backend time comparisons use server local time (`datetime.now()`). Scheduler jobs run in local timezone.

## Key Documentation Files

- `ARCHITECTURE.md` — system diagram, roles, submission lifecycle, notification map
- `API_DOC.md` — complete API reference
- `DB_DESIGN.md` — database ERD and schema details
- `DEVELOPER_HANDOVER.md` — developer onboarding, screen-by-screen guide, test cases
- `frontend/CLAUDE.md` — frontend-specific Claude guidance (more detail than here)

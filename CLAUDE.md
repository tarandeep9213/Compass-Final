# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Compass CashRoom Compliance System (CCS)** — full-stack web app for Compass Group facilities to digitize daily cash reconciliation. Operators submit cash counts, managers approve, controllers/DGMs schedule verification visits, admins oversee the system.

## Commands

### Frontend (`cd frontend`)
```bash
npm install           # Install dependencies
npm run dev           # Vite dev server (port 3000, auto-opens browser)
npm run build         # tsc -b (type-check) then vite build → dist/
npm run lint          # ESLint
npm run preview       # Preview production build
```

### Backend (`cd backend`)
```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --reload   # Dev server on port 8000
pytest                                    # Run all tests
pytest tests/test_auth.py -v              # Run single test file
pytest -k "test_login" -v                 # Run tests matching name
alembic upgrade head                      # Apply DB migrations
alembic revision --autogenerate -m "..."  # Generate migration from model changes
python seed.py                            # Seed base data (admin, roles)
python seed_demo.py                       # Seed demo data (test accounts, submissions)
python clean_db.py                        # Clear all tables
python mailcatcher.py                     # Local SMTP server for email testing
```

### Full Stack (Docker)
```bash
docker compose up --build                     # Dev with SQLite
docker compose --profile prod up --build      # Prod with PostgreSQL
```

## Architecture

```
frontend/  React 19 + TypeScript + Vite    → port 3000
backend/   FastAPI + Python 3.13           → port 8000
```

API docs (Swagger): http://localhost:8000/docs
Frontend API base: `VITE_API_URL` env var (defaults to `http://localhost:8001/v1`)

### Frontend

**No React Router** — navigation is state-based:
- `App.tsx` holds auth state → renders `AppShell` on login
- `AppShell` tracks `{ panel: string, ctx: object }` in local state
- All screens receive `onNavigate(panel, ctx?)` to switch views
- `renderPanel()` switch statement maps panel names → components

**API layer** (`src/api/`):
- `client.ts` — JWT fetch wrapper; tokens in `localStorage` (`ccs_token`, `ccs_refresh_token`)
- `types.ts` — canonical TypeScript types for all API request/response shapes
- Feature modules: `submissions.ts`, `verifications.ts`, `admin.ts`, `compliance.ts`, `audit.ts`, `reports.ts`, `businessDashboard.ts`
- Demo fallback: mock accounts (password: `demo1234`) in `src/mock/data.ts`

**State**: No Redux/Zustand — all local component state. Access grants managed via `src/utils/operatorAccess.ts` (localStorage).

**Styling**: Custom CSS design system in `src/index.css`. CSS vars: `--g0`–`--g9` (greens), `--amb`, `--red`, `--ow`. Fonts: DM Serif Display (headings) + DM Sans (body). Ant Design 6 installed but custom CSS is primary.

**TypeScript**: Strict mode with `noUnusedLocals` and `noUnusedParameters` — unused imports break `npm run build`.

**Page directories** (`src/pages/<role>/`):
- `operator/` — 8 screens: dashboard, method select, form, chat, excel, readonly, drafts, missed
- `manager/` — `MgrApprovals`, `MgrHistory` (rendered for controller role, not standalone)
- `controller/` — verification scheduling; reuses manager pages for daily-report panel
- `dgm/` — monthly coverage dashboard and visit logging
- `admin/` — users, locations, import, config, audit, reports, compliance
- `regional-controller/` — compliance dashboard, audit, reports, cash trends, business dashboard

### Backend

- **Auth**: JWT access token (1hr) + refresh token (7 days), bcrypt password hashing
- **Database**: SQLite in dev (`cashroom.db`), PostgreSQL in prod (`DATABASE_URL`)
- **Models**: SQLAlchemy ORM — users, locations, submissions, missed_submissions, verifications, audit_events, system_config, access_grants
- **Background jobs**: APScheduler — daily submission reminders (08:00 UTC), hourly SLA breach check
- **Email**: fastapi-mail + Jinja2 templates in `templates/email/`
- **Dependencies**: `core/deps.py` — `get_current_user`, `require_roles()` for route protection

### RBAC & Location Scoping

| Role | Scope |
|------|-------|
| OPERATOR, MANAGER, CONTROLLER, DGM | Assigned locations only |
| ADMIN, REGIONAL_CONTROLLER | All locations |

DGM/RC users can receive temporary `operator`/`controller` access via `access_grants`.

### Key Business Rules

- **Imprest Balance**: Fixed cash fund per location (£9,575 default); submissions track deviation
- **Variance Tolerance**: >5% from imprest requires written explanation (configurable per location)
- **Approval SLA**: Manager must approve/reject within 24-48 hours (configurable)
- **One Submission Per Day**: per location per date
- **Controller DOW Rule**: Warn if same location visited on same weekday two weeks running
- **DGM Monthly Rule**: Block second DGM visit to same location in same calendar month

## Git Conventions

- Branch naming: `feat/`, `fix/`, `docs/`, `chore/` prefixes
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- Never commit: `.env`, `*.pem`, `*.db`, `__pycache__/`, `test-results/`, `*.zip`
- Run `npm run lint` (frontend) and `pytest` (backend) before opening PRs

## Documentation

Detailed docs live in `/docs/`:
- `ARCHITECTURE.md` — system diagram, roles, submission lifecycle
- `API_DOC.md` — complete API endpoint reference
- `DB_DESIGN.md` — database ERD and schema
- `DEVELOPER_HANDOVER.md` — screen-by-screen guide, troubleshooting
- `TEST_CASES.md` — E2E test scenarios

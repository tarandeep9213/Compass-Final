# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (port 3000, auto-opens browser)
npm run build     # Type-check (tsc -b) then build to dist/
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

### E2E Tests (Playwright)
```bash
npx playwright test                          # Run all E2E specs
npx playwright test e2e/rc-reports.spec.ts   # Run a single spec file
npx playwright test -g "BIZ-011"             # Run tests matching a pattern
npx playwright test --headed                 # Run with visible browser
```
Config: `playwright.config.ts` — single worker, auto-starts dev server, base URL `http://localhost:3000`. No unit test runner is configured.

## Architecture

**CashRoom Compliance System** — a role-based cash management and compliance tracking frontend for Compass Group facilities.

### Routing

There is **no React Router**. Navigation is entirely state-based:
- `App.tsx` holds auth state; on login it renders `AppShell`
- `AppShell` tracks `{ panel: string, ctx: object }` in local state
- All screens receive `onNavigate(panel, ctx?)` to switch views
- The `renderPanel()` switch statement maps panel names to components
- Screen-to-screen context (locationId, submissionId, date) is passed via `ctx`

### Auth & API Layer

The app connects to a REST backend at `http://localhost:8000/v1` (overridable via `VITE_API_URL`).

- `src/api/client.ts` — JWT fetch wrapper (`api.get/post/put/patch/delete`), `ApiError` class, token stored in `localStorage` as `ccs_token`
- `src/api/auth.ts` — `login`, `logout`, `me`, `refresh` (refresh token stored as `ccs_refresh_token`)
- `src/api/types.ts` — **canonical source of truth** for all API request/response shapes
- Other modules: `submissions.ts`, `verifications.ts`, `admin.ts`, `compliance.ts`, `audit.ts`, `reports.ts`
- `App.tsx` auto-schedules JWT refresh 1 minute before expiry using `setTimeout`

The Login page attempts API login first and falls back to mock data for demo accounts. Demo password for all mock users is `demo1234`; emails come from `src/mock/data.ts` (USERS array).

### State Management

No global state — all state is local to each component. `src/mock/data.ts` exports static fixtures (Locations, Submissions, Drafts, Verifications, Users, Audit Events) still used by many pages. Key helpers: `getSubmission()`, `getLocation()`, `formatCurrency()`, `todayStr()`, `isPastDate()`, `isFutureDate()`.

### Roles & Pages

Five frontend roles, each with their own page set under `src/pages/<role>/`:

| Role | Dir | Key responsibility |
|------|-----|--------------------|
| `operator` | `operator/` | Submit cash counts (7 screens: start, method select, form, chat, excel, readonly, drafts, missed) |
| `controller` | `controller/` | Schedule/complete verification visits; daily report reuses `MgrApprovals` |
| `dgm` | `dgm/` | Monthly coverage dashboard and visit logging |
| `admin` | `admin/` | Users, locations, import roster, config, audit trail, reports, compliance |
| `regional-controller` | `regional-controller/` | Compliance dashboard, audit trail, reports, cash trends (reuses `adm-*` panels + `rc-trends`) |

> `manager/` pages (`MgrApprovals`, `MgrHistory`) exist but `manager` is not a frontend role — they are rendered for the `controller` role's daily-report panel and manager-approval flows.

DGM and Regional Controller users can be granted additional `operator` or `controller` access via `access_grants` on their user object, surfaced in the sidebar as extra nav items. `src/utils/operatorAccess.ts` manages these grants.

### Styling

Custom CSS design system in `src/index.css` — no CSS-in-JS. CSS custom properties define the palette (`--g0`–`--g9` greens, `--amb`, `--red`, `--ow`). Fonts: DM Serif Display (headings) + DM Sans (body). Ant Design 6 is a declared dependency but the custom CSS is the primary styling mechanism.

### TypeScript Config

Strict mode is fully enabled including `noUnusedLocals` and `noUnusedParameters`. Unused imports will cause build errors (`tsc -b` runs before Vite in `npm run build`).

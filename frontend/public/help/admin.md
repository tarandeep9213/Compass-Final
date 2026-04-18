# Admin User Guide

As an **Admin**, you maintain the backbone of the system — users, locations, configuration — and you have full audit visibility across every cashroom in the network.

## What you can do

- Manage **users** (create, deactivate, change roles, assign locations).
- Manage **locations** (add, edit, set imprest amount and tolerance).
- **Import rosters** via Excel for bulk onboarding.
- Tune **global defaults** and **system settings** (DOW lookback, reminder time, data retention).
- View the immutable **Audit Trail** for every action in the system.

## Audit Trail

The Audit Trail is the immutable log of every action taken in the system — user logins, submissions, approvals, visit completions, roster imports, settings updates, password resets. Treat it as the single source of truth during any dispute or external audit.

![Audit Trail — full page, default state](/help/screenshots/admin/audit-trail.png)

### What the screen shows

The screen is one card titled **Audit Trail** with a sub-line showing the immutable-log promise and the total event count (e.g. `603 total events`).

The header bar contains three filter rows:

- **Filter row** (event type / actor / location dropdowns).
- **Period row** (chips for All Time / Today / Last 7 Days / This Month / Custom).
- **Export ▼** button (top-right of the card).

#### The events table — columns

| Column | Meaning |
|---|---|
| **Timestamp** | Date + time of the event (server local time). Sortable. |
| **Event** | Coloured badge — e.g. `User Login`, `Submission Approved`, `Verification Completed`. |
| **Actor** | The user (and their role) who performed the action. |
| **Detail** | One-line description of the event, including any relevant entity (location, submission ID, etc.). |

Click any column header to sort ascending; a second click reverses; a third click clears the sort. Default sort is Timestamp descending (newest first). Pagination is 15 rows per page.

### Filtering by event type

![Event-type filter applied — table narrowed to USER_LOGIN events](/help/screenshots/admin/audit-eventtype-applied.png)

The **All Event Types** dropdown lists every event type observed in the system. Common values include:

- `User Login`, `User Created`, `User Deactivated`
- `Submission Created`, `Submission Submitted`, `Submission Approved`, `Submission Rejected`, `Submission Updated`
- `Verification Completed`, `Verification Cancelled`, `Verification Missed`
- `Location Created`, `Roster Import`
- `Password Reset`, `Password Reset Requested`, `Password Reset OTP Verified`
- `Admin Reset Executed`

Pick one and the table narrows to just that event type (the example above shows `User Login` selected). The events count in the sub-line updates to reflect the filter (e.g. `87 of 603 events`).

> **The filters are cascading.** Selecting a specific event type narrows the **Actors** and **Locations** dropdowns to only those that actually appear with that event type — so you can drill in without picking an actor/location combination that has zero results.

### Filtering by actor and location

The **All Actors** and **All Locations** dropdowns work the same way as event type. Each narrows to a single actor or a single location respectively. Combine all three to drill into "what did Adam Admin do at APPLETON during Last 7 Days?"

### Filtering by period

![Period filter applied — Last 7 Days highlighted, table narrowed to recent activity](/help/screenshots/admin/audit-period-applied.png)

The period chip row sits below the dropdowns:

- **All Time** — default; no date filter.
- **Today** — events from today only.
- **Last 7 Days** — rolling 7-day window.
- **This Month** — calendar-month window.
- **Custom** — reveals two date inputs (`From` / `To`) so you can pick any range.

The selected chip turns dark green; the table updates immediately.

### Exporting

![Export menu open — CSV and Excel options visible](/help/screenshots/admin/audit-export-menu.png)

Click the green **Export ▼** button in the top-right of the card. A small menu opens with two options:

- **Export as CSV** — quick text export, opens cleanly in any spreadsheet or terminal tool.
- **Export as Excel (.xlsx)** — formatted spreadsheet with column headers and event-type styling preserved.

The export contains **the currently filtered view** — any active filters (event type, actor, location, period) shape what gets exported. Apply your filters first, then export.

The button is disabled if the filtered view is empty.

## Locations

The Locations screen is where you manage every site in the system — adding new ones, editing existing ones, deactivating closed sites, and tuning the global defaults that apply across your estate.

![Locations screen — full page](/help/screenshots/admin/locations.png)

### What the screen shows

The screen has two cards stacked vertically:

- **All Locations** (top) — the master table. The card header shows a live count (e.g. `15 total · 13 active`).
- **Global Defaults** (bottom) — system-wide tolerance settings that locations inherit unless overridden.

#### The All Locations card — table columns

| Column | Meaning |
|---|---|
| **Cost Center** | Business accounting code (e.g. `5082`). Multiple locations can share the same cost center. |
| **Location** | Display name (e.g. `APPLETON`). |
| **Imprest Amount** | Expected daily cash fund for this location (e.g. `$9,575`). |
| **Tolerance** | Variance percentage allowed before a submission is flagged. Empty cell means the location inherits the global default. |
| **Status** | `Active` or `Inactive` badge. Inactive locations are hidden from operator/controller pickers but kept in history. |

Click any column header to sort ascending; a second click reverses; a third click clears the sort. Use the page controls at the bottom to navigate when there are more than 10 rows.

### Filtering by location

The **location filter** in the top-right of the All Locations card lets you narrow the table to a single site instead of scrolling 20+ rows. It's a dropdown that lists every active location alphabetically.

#### Default state — all rows shown

![Location filter — closed, default 'All locations'](/help/screenshots/admin/locations-filter-dropdown.png)

The dropdown starts at `All locations` and the table shows every active location across all cost centers.

The dropdown contains one option per active location — currently 22 entries. Examples include `APPLETON`, `BELVIDERE`, `BLOOMINGDALE`, `CEDAR RAPIDS`, `MADISON`, `MILWAUKEE`, `WAUSAU`, etc. The list updates automatically when locations are added or deactivated.

#### After selecting a location — table narrows

![Location filter — APPLETON selected, table shows only that row](/help/screenshots/admin/locations-filter-applied.png)

Pick any location from the dropdown and the table immediately shows only that row. Notice three changes:

1. The dropdown chip now displays the selected location's name (e.g. `APPLETON`).
2. A **Clear** chip appears to the right of the dropdown.
3. The table contains only the one row you picked.

> The `total · active` count in the sub-line still reflects the **whole estate**, not the filtered view — so you always know how many locations exist overall.

To return to all rows, either click **Clear** or change the dropdown back to `All locations`.

### Adding a location

![Add Location form — appears as the top row of the table](/help/screenshots/admin/locations-add-form.png)

1. Click **+ Add Location** at the top-right of the All Locations card. The button greys out while the form is open.
2. A new row appears at the top of the table with input fields:
   - **Cost Center** — accounting code (e.g. `5082`).
   - **Location** — display name (e.g. `APPLETON`).
   - **Imprest Amount** — expected daily cash fund (e.g. `9575`). Pre-filled with the imprest default.
   - **Tolerance %** — acceptable variance percentage. Pre-filled with the global default; override per-location if needed.
3. Click **Save** to commit, or **Cancel** to discard.

After Save, the new row appears in the table and the `total` count in the subtitle increases by one.

### Editing a location

![Edit form — expands inline below the row](/help/screenshots/admin/locations-edit-form.png)

- Click the **Edit** button on any active row. An inline form expands directly below it with the current values pre-filled.
- Change any field, then click **Save** to commit or **Cancel** to discard.
- Closing the form collapses the row back into the table with the new values.

### Deactivating / reactivating

![Inactive row showing the Reactivate action](/help/screenshots/admin/locations-status-toggle.png)

- The Status column shows an **ACTIVE** badge (green) for live locations and the row's actions show **Edit** + **Deactivate**.
- Click **Deactivate** to archive a location. The row updates immediately:
  - Status badge flips to **INACTIVE** (red/grey).
  - The action button changes to **Reactivate**.
  - The location is hidden from operator and controller pickers but its full submission history is preserved.
- Click **Reactivate** to restore a previously deactivated location.
- The subtitle's `active` count reflects the change in real time.

Use Deactivate when a site closes — never delete a location, since deletions break historical submissions.

### Global Defaults

![Global Defaults card — Default Tolerance edited to 0.75% (not yet saved)](/help/screenshots/admin/locations-global-defaults.png)

Below the All Locations card, the **Global Defaults** card sets the **Default Tolerance %** applied to any location that doesn't have its own Tolerance value.

In the screenshot above, the Default Tolerance has been edited from `0.5%` to `0.75%` — the green **Save Defaults** button commits the change.

- Type a new value in the Default Tolerance % input.
- Click **Save Defaults** to commit. The change is captured in the Audit Trail with the before/after values.
- Per-location tolerance overrides (set in a location's edit form) take precedence over this global default — locations with their own value are unaffected by changes here.

## Users

The Users screen is where you manage every account in the system — adding new accounts, changing roles, assigning locations, deactivating departed staff, and tuning system-wide operational settings.

![Users screen — full page](/help/screenshots/admin/users.png)

### What the screen shows

The screen has three cards stacked vertically:

- **All Users** (top) — the master table. The card header shows a live count (e.g. `77 total · 76 active`).
- **System Settings** (middle) — global behaviour parameters that apply to every user.
- **Screen Access Delegation** (bottom) — per-user temporary access grants for DGM and Regional Controller users.

#### The All Users card — table columns

| Column | Meaning |
|---|---|
| **Name** | The user's full display name. |
| **Email** | Login email. Unique per user. |
| **Role** | Coloured badge — `Operator`, `Controller`, `DGM`, `Regional Controller`, or `Admin`. |
| **Assigned Locations** | One or more location names. `All locations` for Admin / RC who aren't location-scoped. Operators are restricted to a single location. |
| **Status** | `ACTIVE` (green) or `INACTIVE` (grey) badge. |

Click any column header to sort ascending; a second click reverses; a third click clears the sort.

### Filtering and searching

Three controls in the All Users card header narrow the list. They combine — apply two or three at once to drill in further.

#### Search by name or email

![Search applied — list filters as you type](/help/screenshots/admin/users-search-applied.png)

Type into the **Search** input (top-left of the card). The table filters live as you type. The query matches against both the Name and Email columns.

To clear, delete the text from the input.

#### Role filter

![Role filter applied — table narrowed to Operators](/help/screenshots/admin/users-role-filter-applied.png)

The **All roles** dropdown lists every defined role — `All roles` (default), `Operator`, `Controller`, `DGM`, `Regional Controller`, `Admin`.

Pick one and the table immediately narrows to just that role. The example above shows `Operator` selected — only operator users remain visible. Reset by switching back to `All roles`.

#### Location filter

The **All locations** dropdown works the same way — pick a location and the table shows only users assigned to that site. Default is `All locations`. Useful for "who covers Appleton?" lookups.

### Adding a user

![Add User form — appears as the top row of the table](/help/screenshots/admin/users-add-form.png)

1. Click **+ Add User** at the top-right of the All Users card. The button greys out while the form is open.
2. A new row opens at the top of the table with input fields:
   - **Name** — full name.
   - **Email** — must be unique; used for login.
   - **Role** — pick from the dropdown.
   - **Assigned Locations** — single location for operators (radio buttons appear), multiple for others (checkboxes). Admin and Regional Controller are not location-scoped, so this control is hidden for those roles.
   - **Temporary Password** — auto-generated. Use the **↺** button to regenerate if you want a different value.
3. Click **Save** to commit, or **Cancel** to discard.

After Save, the new row appears in the table and the user receives a welcome email with their login credentials.

### Editing a user

![Edit form — expands inline below the row](/help/screenshots/admin/users-edit-form.png)

- Click the **Edit** button on any active row. An inline form expands directly below it with the current values pre-filled.
- Change any field, then click **Save** to commit or **Cancel** to discard.

### Deactivating / reactivating

![Inactive user showing the Reactivate action](/help/screenshots/admin/users-status-toggle.png)

- The Status column shows an **ACTIVE** badge (green) for live users; the row's actions show **Edit** + **Deactivate**.
- Click **Deactivate** to archive a user. The row updates immediately:
  - Status badge flips to **INACTIVE** (grey).
  - The action button changes to **Reactivate**.
  - The user can no longer log in — but their full activity history is preserved.
- Click **Reactivate** to restore login access.
- The subtitle's `active` count reflects the change in real time.

Use Deactivate when staff leave — never delete a user, since deletions break historical submissions, approvals, and audit-trail attribution.

### System Settings

![System Settings card](/help/screenshots/admin/users-system-settings.png)

The middle card holds three global behaviour parameters that apply to every user:

| Setting | Values | What it does |
|---|---|---|
| **DOW Lookback Window** | `4 weeks` or `6 weeks` | How far back the "same-weekday visit" warning looks for controllers. |
| **Daily Reminder Time** | Time picker (24h) | Local time when the scheduler sends daily submission reminders to operators. |
| **Data Retention** | Years (integer) | How many years of historical data to keep online. |

Change any value and click **Save Settings**. The change is captured in the Audit Trail.

### Screen Access Delegation

The bottom card lists every DGM and Regional Controller user with two extra controls per row — **Operator Access** and **Controller Access** — each labelled `NONE` (no grant) or shown with a **Grant** action.

- Click **Grant** to give that user a temporary elevated view, useful when a DGM needs to stand in for an operator or controller (e.g. during staff absence or for an audit walkthrough).
- The grant adds the relevant secondary nav items ("Operator View" / "Controller View") to that user's sidebar at next login.
- Every grant and revoke is recorded in the Audit Trail.

## Import Users & Locations

The Import screen lets you bulk-onboard users and locations from a single Excel or CSV upload. It's the fastest path to onboard a new region or replace a roster, and it's the only place to wipe all imported data and start fresh.

![Import landing — empty upload zone](/help/screenshots/admin/import-roster.png)

### What the screen shows

The screen is built around a single **Upload Roster File** card with two affordances at the top-right of the page header:

- **⬇ Sample Excel** (top-right) — downloads a template with the expected column layout.
- **↺ Reset (Users + Locations)** (top-right) — destructive control to wipe everything imported.

Inside the Upload Roster File card you see a drop zone with:

- An icon and the prompt **"Drag & drop your file here, or click to browse"**.
- A line listing the expected columns: `District (Location), Cashroom Lead (Operator), Controller, DGM/RD, Regional Controller`.
- A green **Browse File** button and a secondary **⬇ Sample Excel** button (mirroring the page-header link).

After you upload a file, the page swaps the empty zone for a **Preview — N rows** card containing a KPI strip and a per-row preview table — see "Review the preview" below.

### Step 1 — Get a sample template

If you don't have a roster file already, click **⬇ Sample Excel** at the top-right (or the same button inside the upload zone). It downloads an Excel file with the exact columns the importer expects. Fill it in and re-upload.

### Step 2 — Upload a roster file

Drop your file onto the upload zone or click **Browse File**. The importer accepts `.xlsx`, `.xls`, and `.csv`. It auto-detects two layouts:

- **Wide format** — one column per role (`District`, `Cashroom Lead`, `Controller`, `DGM/RD`, `Regional Controller`).
- **Tall format** — a `Designation` column + a `Name` column, repeated per row. Missing District / Location values carry forward from the previous row.

You don't need to choose between formats — the importer figures it out.

### Step 3 — Review the preview

Once parsed, the page replaces the upload zone with a **Preview — N rows** card containing:

- A KPI strip showing counts detected per role: `Locations`, `Operators`, `Controllers`, `DGMs / RDs`, `Regional Controllers`.
- A row-by-row preview table with role-coloured badges so you can spot misclassifications at a glance.

Verify the counts and the badge mapping are what you expect. If something's wrong, fix the source file and re-upload — the import has not yet been committed.

### Step 4 — Confirm the import

When the preview looks right, click **✓ Confirm Import (N rows)** at the top-right of the preview card.

- All new users receive a welcome email with their login credentials.
- New locations appear in the Locations screen immediately.
- The Audit Trail records the import event with the row counts.

### Resetting all imported data

![Reset confirmation banner — appears above the upload zone](/help/screenshots/admin/import-reset-confirm.png)

The **↺ Reset (Users + Locations)** button at the top-right is the destructive escape hatch. Click it and an amber confirmation banner appears at the top of the page warning:

> ↺ This will permanently delete ALL users (except your admin account) and ALL locations. Cannot be undone.

Two actions appear in the banner:

- **Yes, Reset Everything** (red text, gold border) — proceeds with the wipe.
- **Cancel** — dismisses the banner without doing anything.

After confirmation, the system deletes every non-admin user and every location, then surfaces a result message like `Reset complete — 42 users and 18 locations removed. Ready for new import.`

Use this when:

- A first-pass import was wrong and you want to start over before any submissions are recorded.
- You're cycling between staging datasets in dev/test environments.

**Do not** use this against a production environment with live submission history — submissions, approvals, and audit-trail attribution all reference the deleted users and locations and will look orphaned afterwards.

## Reports

The Reports screen rolls up submissions, approvals, and verification visits across every location for any period you pick. Use it for weekly compliance reviews, leadership packs, and CSV exports for external analysis.

![Reports — full page with KPIs and tables](/help/screenshots/admin/reports.png)

### What the screen shows

The screen is a single content stack with three layers:

1. **Header bar** — period chips, location filter, and the Export button.
2. **KPI strip** — four cards summarising the period (Total Submissions, Approval Rate, Variance Exceptions, Ctrl / DGM Visits).
3. **Three stacked tables** — Date-Level Detail, Per-Actor Summary, Variance Exceptions.

### KPIs

![KPI strip](/help/screenshots/admin/reports-kpis.png)

The KPIs give a period-level snapshot:

| KPI | Meaning |
|---|---|
| **Total Submissions** | How many operator submissions in the period. |
| **Approval Rate** | Percentage approved. Red if below 60%, amber below 80%, green otherwise. |
| **Variance Exceptions** | Count of submissions exceeding the configured tolerance. |
| **Ctrl / DGM Visits** | Completed verification visits — controller / DGM. |

### Filtering by period

![Period filter — This Month selected, KPIs and tables update](/help/screenshots/admin/reports-period-applied.png)

The period chip row at the top:

- **Today** — events from today only.
- **This Week** — Monday-to-today rolling window.
- **This Month** — current calendar month (default).
- **Custom** — reveals two date inputs (`From` / `To`) for any range.

The selected chip turns dark green; KPIs and all three tables update immediately.

### Filtering by location

![Location filter — one location selected, table narrows](/help/screenshots/admin/reports-location-applied.png)

The **Location** dropdown sits in its own labelled container next to the period chips. Default is `All Locations`. Pick a single location and the KPIs + tables narrow to just that site.

### Date-Level Detail

![Date-Level Detail table](/help/screenshots/admin/reports-date-detail.png)

One row per location per day with these columns: `Date · Location · Submitted By · Sub Status · Approved By · Controller · DGM · Regional Controller`.

Status badges colour-code each cell:

- Approved → green
- Rejected → red
- Pending → amber
- Draft → grey

Click any column header to sort. Pagination is 20 rows per page.

### Per-Actor Summary

![Per-Actor Summary](/help/screenshots/admin/reports-per-actor.png)

Roll-up of every actor's activity during the period. Use the role chips (**All Roles · Operator · Controller · DGM**) to narrow.

Columns: `Name · Role · Actions · Approved/Completed · Rejected/Missed · Pending/Scheduled · Rate · Avg Variance · Exceptions · Locations`.

- Operators are rated on submissions (their daily counts).
- Controllers and DGMs are rated on verifications (their visit completions).

Sorted by activity count descending. Pagination is 10 rows per page.

### Variance Exceptions

![Variance Exceptions table](/help/screenshots/admin/reports-variance-exceptions.png)

Only submissions whose variance exceeded the tolerance threshold (configurable; default `0.5%`). Each row shows: `Date · Location · Submitted By · Total Cash · Variance · Status · Note`.

The "(>X%)" in the section title shows the active tolerance. Pagination is 10 rows per page.

### Exporting

The **⬇ Export CSV** button in the top-right downloads the **currently filtered view** as CSV — apply your period and location filters first, then export. The CSV includes one row per Date-Level Detail row in the current view.

## Cash Trends

Visual trend charts across locations and time. Drill into a single section (Currency, Rolled Coin, Coins in Counting Machines, etc.) and watch how it moves daily, weekly, monthly, or quarterly across one location or every location combined.

![Cash Trends — full page, default daily granularity, all locations](/help/screenshots/admin/cash-trends.png)

### What the screen shows

The screen has four control rows above the chart, then the chart and a KPI strip below it:

1. **Granularity** chips — `daily · weekly · monthly · quarterly`.
2. **Period** dropdown — auto-adjusts to the granularity (e.g. `7 days` / `14 days` / `30 days` for daily).
3. **Custom range** toggle — reveals From/To date inputs.
4. **Location** pills — `All` or any individual location.
5. **Section** tabs — A through L (Currency, Rolled Coin, Coins in Machines, Bagged Coin, Unissued Funds, etc.), each colour-coded.
6. **KPI strip** — Latest, Average, Peak, Total for the active section.
7. **Download** buttons at the top-right — `↓ Download CSV` and `📥 Export All Sections`.

### Switching granularity

![Granularity switched to weekly — chart and period dropdown adapt](/help/screenshots/admin/cash-trends-weekly.png)

Pick `daily`, `weekly`, `monthly`, or `quarterly`. The chart x-axis re-buckets and the **Period** dropdown auto-adjusts to fit the granularity (e.g. switching to weekly shows period options like `4 weeks` / `8 weeks` / `12 weeks`).

The selected granularity chip turns dark green.

### Switching sections

![Section tab "Rolled Coin" selected — chart paints just that section's data](/help/screenshots/admin/cash-trends-section-b.png)

Below the granularity row sits a tab strip with one tab per section (A–I plus the standalone fields). Each tab is colour-coded (e.g. blue for Currency, green for Rolled Coin, purple for Coins in Counting Machines).

Pick a tab and the chart re-paints with just that section's data over the selected period. The KPI strip updates to show that section's Latest / Average / Peak / Total.

### Filtering by location

The **Location** pill row above the section tabs lets you focus the chart on a single site. Default is `All` — every location aggregated.

Click a location pill to scope the chart to just that site. Click `All` again to return to the aggregated view.

### Exporting

Two export options at the top-right:

- **↓ Download CSV** — current view (selected section + selected granularity + selected period + selected location). Quick single-section extract.
- **📥 Export All Sections** — produces a multi-sheet `.xlsx` with one tab per section across every section A–L. Single file covering the whole estate.

## Reasonableness Reports

Cross-location roll-up of reasonableness tests saved by controllers. Each saved report covers one cost center group over a date range and is tagged Reasonable or Overfunded.

For the full walkthrough — KPI filters, the table columns, the detail modal with per-location financial breakdown, and the worst-case-wins status rule — open the **Cash Reasonableness** tab inside this User Guide.

## Tips

- Keep user info up to date — deactivate departed users promptly.
- Set appropriate **imprest amounts** and **tolerance percentages** per location; use **Global Defaults** for bulk.
- Monitor the **Audit Trail** for unusual activity — it's the authoritative record for disputes.
- Use **Import Roster** when onboarding multiple locations at once.

*Video walkthrough coming soon.*

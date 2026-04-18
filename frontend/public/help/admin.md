# Admin User Guide

As an **Admin**, you maintain the backbone of the system — users, locations, configuration — and you have full audit visibility across every cashroom in the network.

## What you can do

- Manage **users** (create, deactivate, change roles, assign locations).
- Manage **locations** (add, edit, set imprest amount and tolerance).
- **Import rosters** via Excel for bulk onboarding.
- Tune **global defaults** and **system settings** (DOW lookback, reminder time, data retention).
- View the immutable **Audit Trail** for every action in the system.

## Audit Trail

![Admin Audit Trail](/help/screenshots/admin/audit-trail.png)

The Audit Trail shows every action taken in the system — user logins, submissions, approvals, visits, roster changes, settings updates.

**Top-row filters:**

- **All Event Types** — narrow by a specific event kind (e.g. `USER_LOGIN`, `SUBMISSION_APPROVED`, `VERIFICATION_COMPLETED`).
- **All Actors** — narrow by who performed the action.
- **All Locations** — narrow by the location the event relates to.

These filters are **cascading** — choosing a specific event type narrows the available actor and location options, and so on.

**Period selector:**

`All Time · Today · Last 7 Days · This Month · Custom` — choose a window; "Custom" reveals date inputs.

**Columns:** `Timestamp · Event · Actor · Detail`. Click any column header to sort ascending/descending.

**Export:** the green **Export ▼** button in the top-right opens a menu: export the current filtered view as **CSV** or **Excel (.xlsx)**.

## Locations

![Locations table](/help/screenshots/admin/locations.png)

### Adding a location

1. Click **+ Add Location**.
2. Fill in:
   - **Cost Center** — business accounting code (e.g. `5082`).
   - **Location** — display name (e.g. `APPLETON`).
   - **Imprest Amount** — expected daily cash fund (e.g. `$9,575`).
   - **Tolerance** — acceptable variance percentage.
3. Click **Save**.

Multiple locations can share the same Cost Center.

### Editing / deactivating

- Click a row to expand an inline edit form. Change any field, then **Save**.
- Use **Deactivate** to archive a location (keeps history but hides from operator/controller pickers). **Reactivate** reverses it.
- Sort any column (Cost Center, Location, Imprest, Tolerance, Status) by clicking its header; click again to reverse; a third click clears the sort.

### Global Defaults

![Global Defaults card](/help/screenshots/admin/locations-global-defaults.png)

Below the main table, the **Global Defaults** card sets the **Default Tolerance %** applied to any location that doesn't override it. Change the value and click **Save Defaults**; the change is captured in the audit trail.

## Users

![Users table](/help/screenshots/admin/users.png)

### Adding a user

1. Click **+ Add User** at the top-right.
2. Fill in:
   - **Name** — full name.
   - **Email** — used for login.
   - **Role** — Operator, Controller, DGM, Regional Controller, or Admin.
   - **Assigned Locations** — single location for operators (radio), multiple for others (checkboxes). Admin and Regional Controller are not location-scoped.
3. A temporary password is generated automatically; use the **↺** button to regenerate.
4. Click **Save**. The user receives a welcome email with their login credentials.

### Filtering and sorting

- **Search** by name or email.
- **All roles / All locations** dropdowns narrow the list.
- Click any column header (Name, Email, Role, Status) to sort; click again for descending; a third click clears.

### System Settings

![System Settings card](/help/screenshots/admin/users-system-settings.png)

Below the user table, the **System Settings** card controls behaviours that apply to every user:

- **DOW Lookback Window** — `4 weeks` / `6 weeks`. Controls how far back the "same-weekday visit" warning looks for controllers.
- **Daily Reminder Time** — the local time at which the scheduler sends daily submission reminders to operators.
- **Data Retention** — how many years of historical data to keep online.

### Screen Access Delegation

On DGM and Regional Controller rows, two extra buttons — **🏧 Operator Access** and **🔍 Controller Access** — grant that user a temporary elevated view (useful when a DGM needs to stand in for an operator or controller). Grants appear in the audit trail and can be revoked from the same buttons.

## Import Users & Locations

![Import wizard](/help/screenshots/admin/import-roster.png)

Bulk-create users and locations from a single Excel or CSV upload.

1. Click **Browse File** (or drag-and-drop). Accepts `.xlsx`, `.xls`, `.csv`.
2. The KPI strip shows counts detected per role (Operators, Controllers, DGMs, Regional Controllers, Locations).
3. The preview table shows each row with role-coloured badges — verify the mapping is correct.
4. Click **✓ Confirm Import (N rows)**. All users receive welcome emails automatically.

Need a sample? Click **⬇ Sample Excel** at the top-right to download the template.

**Reset:** the **↺ Reset (Users + Locations)** button wipes all imported data. Use with caution — it's destructive.

The importer auto-detects two shapes:

- **Wide format** — one column per role.
- **Tall format** — a `Designation` + `Name` pair, repeated per row.

Missing values in the tall format carry forward from the preceding row.

## Reports

![KPI strip](/help/screenshots/admin/reports-kpis.png)

The KPIs give a period-level snapshot:

- **Total Submissions** — how many operator submissions in the period.
- **Approval Rate** — percentage approved (red if below 60%, amber below 80%).
- **Variance Exceptions** — submissions exceeding the configured tolerance.
- **Ctrl / DGM Visits** — completed verification visits vs scheduled.

Pick a period (`Today · This Week · This Month · Custom`) and filter by **Location**.

### Date-Level Detail

![Date-Level Detail table](/help/screenshots/admin/reports-date-detail.png)

One row per location per day, showing who submitted, who approved, and which controller/DGM/RC was involved. Status badges colour-code each stage (Approved green, Rejected red, Pending amber).

### Per-Actor Summary

![Per-Actor Summary](/help/screenshots/admin/reports-per-actor.png)

Roll-up of every actor's activity during the period. Filter with the role chips (**All Roles · Operator · Controller · DGM**). Columns include approval/completion rate, average variance found, and exceptions flagged.

Operators are rated on submissions; Controllers and DGMs on verifications.

### Variance Exceptions

![Variance Exceptions table](/help/screenshots/admin/reports-variance-exceptions.png)

Only submissions whose variance exceeded the tolerance threshold. Each row shows the submitter, the total cash counted, the variance amount, the status, and any note attached.

**Export CSV** in the top-right downloads the currently filtered view.

## Cash Trends

Visual trend charts across locations and time — submission rates, variance patterns, and section-by-section breakdowns. Switch **granularity** between daily / weekly / monthly / quarterly. Use **Location** pills to compare sites or aggregate across "All".

## Reasonableness Reports

Cross-location roll-up of reasonableness test results. See [Cash Reasonableness](user-guide#cash-reasonableness) (open the **Cash Reasonableness** tab inside User Guide) for the full walkthrough.

## Tips

- Keep user info up to date — deactivate departed users promptly.
- Set appropriate **imprest amounts** and **tolerance percentages** per location; use **Global Defaults** for bulk.
- Monitor the **Audit Trail** for unusual activity — it's the authoritative record for disputes.
- Use **Import Roster** when onboarding multiple locations at once.

*Video walkthrough coming soon.*

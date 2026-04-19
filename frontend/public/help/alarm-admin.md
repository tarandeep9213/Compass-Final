# Alarm Admin User Guide

As an **Alarm Admin**, you own the setup of the alarm monitoring system — buildings, zones, alarm users, access grants, and the compliance rules that drive reminders and escalations. You also have read access to the Compliance dashboard and the full Audit Trail.

![Alarm Admin — Building Setup screen](/help/screenshots/alarm-admin/buildings.png)

## What you can do

- Manage **Buildings** — region, security company, assigned tester + approver, active / exempt / closed status.
- Configure **Zones** per building — type (entry, motion, panic), area, and active state.
- Manage **Alarm Users** — create and deactivate Alarm Testers and Approvers.
- Grant or revoke **User Access** to specific buildings, in bulk or one-at-a-time.
- Tune **Compliance Rules** — monthly deadline, approval SLA, Tier 1/2/3 escalation offsets.
- View the **Compliance** dashboard and the immutable **Audit Trail**.

## Buildings

The first screen you land on. Every building in the alarm module is listed here with its region, security company, assigned tester(s), approver, and status.

![Buildings — list and KPI row](/help/screenshots/alarm-admin/buildings.png)

### What the screen shows

At the very top, a pill bar lets you jump between the four admin sub-areas — **Buildings / Zones / Rules / Access** — all of which share the same admin context. Below the page title and KPI row, a single card holds the building list with a search box, CSV import actions, an add button, and a reset control.

| KPI | Meaning |
|---|---|
| Total Buildings | Count of every building in the module |
| Active | Buildings currently enforcing monthly tests |
| Exempt | Buildings temporarily exempt (no reminders, no escalations) |
| Closed | Buildings permanently removed from compliance tracking |

| Header element | What it does |
|---|---|
| Sub-title (`N total`) | Live count inside the Buildings card |
| Search box | Filter by name, region, security company, or customer ID |
| Sample CSV | Download a template CSV for bulk import |
| Import CSV | Open the CSV import modal (see below) |
| + Add Building | Open the Add Building modal (see below) |
| Reset | Restore buildings to the original seed data (destructive — confirmation required) |

| Column | Meaning |
|---|---|
| Building Name | Name of the site |
| Region | Midwest / Northeast / Southeast / etc. |
| Security Company | Monitoring company name |
| Customer ID | Account identifier with the security company |
| Phone | Monitoring company contact number |
| Testers | Name(s) of assigned Alarm Tester(s) (red `None` if unassigned) |
| Approver | Name of the assigned Approver (red `None` if unassigned) |
| Status | `Active`, `Exempt`, or `Closed` badge |
| Actions | **Edit** button — opens the same modal as Add, pre-filled |

The table paginates at 10 rows per page.

### Adding a building

Click **+ Add Building** to open the Add Building modal.

![Add Building modal](/help/screenshots/alarm-admin/building-add-modal.png)

The modal is a stacked form with four sections.

| Section | Fields |
|---|---|
| Building Info | Building Name (required), Region (dropdown, required) |
| Security Company Info | Company Name, Customer ID, Phone — all required |
| Assignments | Testers (multi-select checklist of every alarm user), Approver (single-select dropdown) |
| Status | Radio: **Active** / **Temporarily Exempt** / **Closed**. Picking Exempt reveals an Exempt Reason textarea and Expected Reactivation Date. |

Click **Add Building** to save. The card closes and the new building appears in the list.

### Editing a building

Click **Edit** on any row. The same modal opens pre-filled. Change fields and click **Save Changes**.

### Bulk-importing from CSV

1. Click **Sample CSV** to download the template. The columns are `name, region, security_company_name, security_customer_id, security_company_phone, status`.
2. Fill the template with your buildings.
3. Click **Import CSV** and upload the file. A preview shows the parsed rows.
4. Click **Import N Buildings** to commit. Rows without a `name` are skipped; validation errors stop the whole import.

### Reset

The **Reset** button (red outline) restores the original seed buildings. This deletes any buildings you've added or imported and reverts edits to seeded rows. A confirmation dialog must be acknowledged.

## Zones

Zones are the alarm points inside a building — entry doors, motion sensors, panic buttons, coolers. The Zones tab lets you configure zones for one building at a time.

![Zones — empty state for the selected building](/help/screenshots/alarm-admin/zones.png)

### What the screen shows

The Zones tab has the same sub-nav pills at the top. The right side of the header has a **Building** selector — zones load for the currently-selected building.

| Element | What it does |
|---|---|
| Building selector | Dropdown — pick which building's zones you're editing |
| Sample CSV | Download the zones CSV template |
| Import CSV | Bulk-upload zones from a CSV |
| + Add Zone | Open the Add Zone modal |

When a building has no zones, the card shows an empty state: *"No zones found — Add a zone or import from CSV to get started."* When zones exist, they render as a table with columns: Zone Number, Zone Name, Type (Entry / Motion / Panic / Cooler / etc.), Area, Active toggle, and Edit/Delete actions.

### Adding a zone

1. Pick a building from the **Building** selector.
2. Click **+ Add Zone**.
3. Fill in the zone number, name, type, and area.
4. Save. The zone appears in the list and becomes available for testers on their monthly test form.

### Importing zones in bulk

Use **Sample CSV** to get the template, fill it, then **Import CSV**. Each row must include a zone number, name, and type. Import happens per selected building.

## Compliance Rules

The rules that drive the whole compliance engine — when tests are due, when approvers have to sign off, and when escalations fire.

![Compliance Rules — monthly requirements and escalation tiers](/help/screenshots/alarm-admin/compliance-rules.png)

### What the screen shows

A single **Rules** page with two cards and a save bar.

| Monthly Test Requirements | Meaning |
|---|---|
| Monthly Deadline Day | Day-of-month by which the monthly test must be submitted (e.g. 28) |
| Approval SLA Days | Days the Approver has after submission to approve or reject |
| Require all zones tested for compliance | Toggle — when ON, a test isn't compliant unless every configured zone is marked Tested |
| Require alarm report upload | Toggle — when ON, the Alarm Company Report file is mandatory before submit |
| Require approver sign-off | Toggle — when ON, an Approver decision is required for the test to count (this is typically always ON) |

| Escalation Configuration | Meaning |
|---|---|
| Tier 1 — Reminder | Days **before** deadline to send the first reminder. Recipients: Tester. |
| Tier 2 — Deadline | Days **after** deadline to send the second reminder. Recipients: Tester + Approver. |
| Tier 3 — Critical | Days after deadline for the final escalation. Recipients: Tester + Approver + Regional Controller. |

Below the Escalation block (not shown in the screenshot above) you'll find biannual-check cadence settings (cellular and camera intervals) and the **Save Rules** button.

### Editing rules

1. Change the values or toggles.
2. Click **Save Rules** (bottom-right of the card).
3. A confirmation toast appears. The rule set takes effect immediately — reminders and escalations re-evaluate against the new values on the next scheduler tick.

## Alarm Users

The **Alarm Users** screen lists every user who has access to the alarm module, along with their role and status.

![Alarm Users — role-tagged list](/help/screenshots/alarm-admin/users.png)

### What the screen shows

The sub-nav here includes a fifth pill — **Alarm Users** — active when this screen is open. A single card holds the user list with one action button.

| Element | What it does |
|---|---|
| Sub-line (`N alarm users`) | Live user count |
| + Add User | Open the Add User modal |

| Column | Meaning |
|---|---|
| Name | Full name of the user |
| Email | Email the user signs in with |
| Role | `TESTER`, `APPROVER`, or `ADMIN` pill |
| Status | `Active` / `Inactive` badge |
| Actions | **Edit** and **Deactivate** buttons |

Only alarm-specific roles can be created here — cashroom roles (operator / controller / DGM / RC / admin) are managed on the cashroom side.

### Adding a user

1. Click **+ Add User**.
2. Fill in name, email, and pick a role (Tester / Approver / Admin).
3. Save. The user receives login credentials via the normal onboarding flow and appears in the list as Active.

### Deactivating a user

Click **Deactivate** on the row. The user is marked Inactive — they can no longer sign in, but their history stays in the Audit Trail and in the tests they submitted.

## User Access

Assigning users to buildings. Testers can only test buildings they have Tester access to; Approvers can only approve submissions from buildings they have Approver access to.

![User Access — tester and approver assignments per building](/help/screenshots/alarm-admin/user-access.png)

### What the screen shows

Two KPI cards at the top show the total Tester and Approver user counts. Below, a **Manage Access** card holds the assignment list with filter pills, search, bulk-import, and a quick-add button.

| Manage Access header | What it does |
|---|---|
| Sample CSV | Download a CSV template for bulk-assigning access |
| Import CSV | Upload a CSV of assignments (creates many at once) |
| Add Assignment | Open the single-assignment form |
| All / Testers / Approvers filter | Narrow the list by access type |
| Search | Filter assignments by user name |

| Column | Meaning |
|---|---|
| User | User's name and their base cashroom role (e.g. CONTROLLER, REGIONAL_CONTROLLER) |
| Access Type | `Tester` or `Approver` pill |
| Buildings | Comma-separated list of buildings the user is granted on |
| Granted Date | When the access was granted |
| Actions | **Revoke** button — removes the assignment |

### Granting access

1. Click **Add Assignment**.
2. Pick the user, pick the access type (Tester / Approver), and select one or more buildings.
3. Save. The user can now run tests / approve submissions for those buildings from their next login.

### Revoking access

Click **Revoke** on the row. The user immediately loses access to that building for that role, but historical tests stay on file.

## Compliance Dashboard

The same **Compliance** dashboard the Approver sees — month selector, region filter, KPIs, export buttons, a trend chart, biannual status cards, and a per-building table.

![Compliance Dashboard — admin view](/help/screenshots/alarm-admin/overview.png)

### What the screen shows

| KPI | Meaning |
|---|---|
| Compliance Rate | Share of non-exempt buildings fully compliant this month |
| Compliant | Count of buildings passing all rules |
| Pending Review | Submissions currently in the Approver queue |
| Overdue | Buildings without a logged test past the deadline |
| Exempt | Buildings temporarily exempt |

| Card | Purpose |
|---|---|
| Export Compliance Reports | Per-Building and Per-Region CSV/PDF exports for the selected month |
| Monthly Compliance Trend | 12-month line chart with an 80% target reference line |
| Cellular Backup / Camera Backup | Biannual status counters with View Details links |
| (Scroll below) Per-building table | Sortable by status, name, region, last test, zones, and biannual status |

Use this screen to check the effect of any rule change (e.g. raising the deadline day) on the current month's compliance rate.

## Audit Trail

The immutable log of every meaningful action in the alarm module — who did what, when, with a short description.

![Audit Trail — filterable activity log](/help/screenshots/alarm-admin/audit-trail.png)

### What the screen shows

A single **Activity Log** card with an event count, category filters, a search box, and a date-range picker.

| Element | What it does |
|---|---|
| Export CSV (top-right) | Download the filtered log |
| Event count | Live count of matching events |
| All / Access / Buildings / Testing / Config | Category filter chips with per-category counts |
| Search | Free-text search across user, action, and details |
| Date range | Start and end date inputs |

| Column | Meaning |
|---|---|
| Timestamp | When the action happened |
| User | Actor who performed the action |
| Action | Colored badge — e.g. `ACCESS GRANTED`, `BUILDING UPDATED`, `TEST REJECTED` — plus its category underneath |
| Details | Free-text description — often includes the affected entity name |

Every entry is append-only. Use **Export CSV** to archive a snapshot for compliance reviews.

## Tips

- Set a building's status to **Exempt** (not Closed) during renovations — this suppresses reminders and escalations without breaking historical reporting.
- Grant each Tester access to only the buildings they actually cover. A misassigned Tester can't submit for the right building, which surfaces as a Tier 3 escalation.
- Keep Approver assignments broad — one Approver per region is common. Testers should be tightly scoped, Approvers less so.
- When tuning **Escalation Configuration**, raise Tier 1's "Days Before Deadline" before blaming testers for overdue submissions — sometimes the reminder is simply firing too late.
- Use the **Reset** button on Buildings sparingly — it's a destructive operation that also wipes import history.
- The Audit Trail is your record of compliance evidence. Export monthly if your organisation requires a paper trail.

*Video walkthrough coming soon.*

# Alarm Approver User Guide

As an **Alarm Approver**, you are the reviewer of every monthly alarm test and biannual backup check submitted by testers. You approve what's complete and evidenced, reject anything that isn't with a clear reason, and keep an eye on buildings that are sliding toward an escalation.

![Alarm Approver — Pending Approvals screen](/help/screenshots/alarm-approver/approval.png)

## What you can do

- Review **submitted alarm tests** and biannual checks across the buildings assigned to you.
- **Approve** complete, well-evidenced submissions.
- **Reject** with a reason — the tester sees your note and can fix & resubmit.
- Monitor **Compliance**, **Trends**, and **Escalations** dashboards.
- Access the immutable **Audit Trail** for full history.
- Send **Tier 1 / 2 / 3 escalation reminders** when a building is overdue.

## Pending Approvals

The default screen when you sign in. Every test and biannual check waiting for a decision is listed here, grouped by type.

![Pending Approvals — monthly tests tab](/help/screenshots/alarm-approver/approval.png)

### What the screen shows

The page header reads **Alarm Test Approvals** with an **Escalations** button on the right (shortcut to the Escalations screen). A tab toggle switches between **🔔 Monthly Tests** and **📋 Biannual Checks** — each has its own KPIs, filters, and table.

| KPI (Monthly tab) | Meaning |
|---|---|
| Pending Review | Tests submitted and awaiting your decision |
| Approved | Tests you've approved so far |
| Rejected | Tests you've rejected (the tester can resubmit) |
| Avg Review Time | Average days between submission and approval |

Below the KPIs, a second row of **status sub-tabs** narrows the list: **All / Pending Review / Approved / Rejected**. A count pill next to each label shows how many tests are in that bucket.

| Filter / sort | What it does |
|---|---|
| Region dropdown | Filter by region (All Regions by default) |
| Oldest / Newest toggle | Sort the queue by submission time |

| Column | Meaning |
|---|---|
| Building | The building the test was run against |
| Region | Region the building sits in |
| Test Date | When the test was performed |
| Tester | Who ran the test |
| Zones | Progress bar + count: zones tested vs. total |
| Report | Link pill — `Report` if an alarm-company report was attached, `⚠ None` if missing |
| Status | Pending / Approved / Rejected badge |
| Waiting | Days the submission has been waiting (red + bold when stale), or the approval date once actioned |
| Actions | `Review` (pending submissions) or `View` (decided submissions) |

The Biannual tab mirrors this layout with KPIs for cellular vs. camera checks and a table showing Date / Building / Type / Result / Status / Checked By / Next Due / Actions.

### Reviewing a test

1. From **Pending Approvals**, click the **Review** button on the row you want to action. This opens the **Alarm Test Review** screen with the full submission laid out.
2. Read the Test Summary, walk the Zone-by-Zone Results, and check the Compliance Verification block.
3. Approve or Reject — see the next section for what the Review screen contains.

## Alarm Test Review

The detail screen you land on after clicking Review on any row. This is where you read the submission and approve or reject it.

![Alarm Test Review — test detail](/help/screenshots/alarm-approver/review-detail.png)

### What the screen shows

| Section | What it holds |
|---|---|
| Header | Test title, test ID and test month, **Back** button, live status badge (Pending / Approved / Rejected) |
| Test Summary | Tester, Test Date, Test Window, Submitted timestamp, Building, Security Company. A status bar below shows `N tested · N issues · N not tested`. |
| Zone-by-Zone Results | Every zone grouped by type (Entry/Exit Doors, Interior Motion, Panic Buttons, etc.). Each zone row shows the tester's result — a green tick for **Tested**, an amber warning for **Issue Found**, and a grey state for **Not Tested**. Any notes the tester added appear alongside. |
| Compliance Verification | Rule-based summary — e.g. *"All configured zones have been tested"* with a red ✗ or green ✓ status. |
| Alarm Company Report | Preview / download link for the uploaded evidence document. |
| Decision footer | When the test is still **Pending**, two buttons appear: **Reject with Reason** and **Approve**. For decided tests, this footer is hidden and the decision + decider name shows in the header. |

The screenshot above is an already-approved test (no pending tests existed at capture time), so the decision footer is not shown. On a submitted test you'll see the Approve / Reject buttons sticking to the bottom of the card.

### Approving

1. After reading the Test Summary and zone results, click **Approve**.
2. A confirmation toast appears and the status flips to **Approved**. The tester sees it as Approved on their My Tests screen on their next load.

### Rejecting

1. Click **Reject with Reason**. A prompt asks for a short reason — this is the message the tester sees, so be specific about what they need to fix.
2. Save. The status flips to **Rejected**; the tester's My Tests row turns red with a **Fix & Resubmit** button.
3. Every rejection is kept in the Audit Trail even after the tester resubmits.

## Compliance Dashboard

The **Compliance** screen gives you an at-a-glance view of where every building stands this month and lets you export a snapshot for sharing.

![Compliance dashboard — current month](/help/screenshots/alarm-approver/overview.png)

### What the screen shows

The header reads **Alarm Compliance Dashboard** with a month selector and region filter on the right. Under that, a five-KPI strip and three cards stacked below.

| KPI | Meaning |
|---|---|
| Compliance Rate | Percentage of non-exempt buildings that are fully compliant this month |
| Compliant | Buildings passing all rules for the selected month |
| Pending Review | Submissions that are in the queue for the selected month |
| Overdue | Buildings with no test logged and past the deadline |
| Exempt | Buildings temporarily exempt from compliance checks |

| Card | What it holds |
|---|---|
| Export Compliance Reports | Per-Building and Per-Region export buttons — CSV and PDF — for the selected month |
| Monthly Compliance Trend | 12-month line chart with an orange 80% dashed target line. Hover a point to see that month's exact rate. |
| Cellular Backup / Camera Backup | Two stacked summary cards — `N / total compliant` with a filled progress bar and a **View Details** link |

Scrolling further reveals a per-building table (not shown in the screenshot above) with sortable columns for building name, region, last test date, zone count, cellular / camera status, and escalation tier.

### Exporting a report

1. Set the **month** and (optionally) a **region** at the top of the page.
2. In the Export Compliance Reports card, click **Export CSV** or **Export PDF** under Per Building or Per Region.
3. The file downloads immediately — no email step.

## Trends

The **Trends** screen is the historical view — use it to spot patterns over 6, 12, or 24 months.

![Trends — compliance rate and approval turnaround over 12 months](/help/screenshots/alarm-approver/trends.png)

### What the screen shows

The header has an **All Regions** selector, three range pills (**6mo / 12mo / 24mo**), and an **Export Report** button.

| KPI | Meaning |
|---|---|
| Current Compliance | This month's compliance rate with a `+/- X%` delta vs. last month |
| 12-Month Average | Average compliance rate across the selected range |
| Avg Days to Approval | Mean time between submission and approval across the range |
| Buildings w/ Issues | Count of buildings with at least one rejected or flagged test in the range |

| Chart | Meaning |
|---|---|
| Compliance Rate Over Time | Line chart with a dashed 80% target reference. Hover to see the exact monthly rate. |
| Approval Turnaround (Days) | Bar chart — average days from submission to approval, per month. Useful for spotting slowdowns in your own review cadence. |

## Escalations

The **Escalations** screen lists every building that has slipped past its monthly deadline and lets you send the next reminder email.

![Escalations — overdue buildings with tier breakdown](/help/screenshots/alarm-approver/escalation.png)

### What the screen shows

The header reads **Overdue Buildings** with a short subtitle and a **Back** button. Four KPI cards summarise the queue:

| KPI | Meaning |
|---|---|
| Total Overdue | All buildings without a completed test this period |
| Tier 1 (Reminder) | Overdue by less than 30 days — reminder emails Tester |
| Tier 2 (Deadline) | Overdue 30–44 days — emails Tester + Approver |
| Tier 3 (Critical) | Overdue 45+ days — emails Tester + Approver + Regional Controller |

| Column | Meaning |
|---|---|
| Building | Building name |
| Region | Region the building sits in |
| Assigned Tester | Who is supposed to run the monthly test |
| Last Test | Date of the most recent completed test, or `Never` if none on file |
| Days Overdue | Days past the monthly deadline (shown as `999+` for very old) |
| Escalation Tier | `Tier 1`, `Tier 2`, or `Tier 3` pill |
| Last Reminder | Timestamp of the last reminder sent, or `Never` |
| Action | **Send Reminder** button |

### Sending a reminder

1. Pick the building you want to escalate.
2. Click **Send Reminder** in the Action column.
3. A confirmation prompt appears — *"Send Tier N escalation email for <Building>? Recipients: ..."* — showing who will receive the email based on the tier.
4. Confirm. The reminder is logged, the **Last Reminder** column updates, and the reminder is added to the Audit Trail.

## Audit Trail

The **Audit Trail** is the immutable log of every action in the alarm module — test submissions, approvals, rejections, access grants, building changes, config edits.

![Audit Trail — filterable activity log](/help/screenshots/alarm-approver/audit-trail.png)

### What the screen shows

The page header reads **Alarm Audit Trail** with an **Export CSV** button on the right. A single **Activity Log** card contains the full event list with live filters.

| Element | What it does |
|---|---|
| Event count | Top-right of the card — live count of matching events |
| Category chips | **All / Access / Buildings / Testing / Config** — filter by event category. Count pill shows matches per category. |
| Search | Free-text search across user, action, and details |
| Date range | Start date and end date inputs for narrowing the window |

| Column | Meaning |
|---|---|
| Timestamp | When the action happened (date + time) |
| User | Who performed the action |
| Action | Tagged badge — e.g. `ACCESS GRANTED`, `BUILDING UPDATED`, `TEST APPROVED` — plus the category underneath |
| Details | Free-text description of what changed |

The log is append-only — entries are never edited or deleted, only added. Use **Export CSV** to send a snapshot for compliance or legal requests.

## Tips

- Treat a missing **Alarm Company Report** (the `⚠ None` pill on the queue) as an automatic reason to reject — the report is the evidence of the test actually happening.
- Rejection reasons are preserved in the Audit Trail cycle-by-cycle, so you can see how a building's submissions have evolved over time.
- **Waiting** time in the queue is the clock the SLA runs against — submissions turning red are already outside the target window.
- Sending a Tier 3 reminder also loops in the Regional Controller — only escalate to Tier 3 once you've given the tester a fair chance to respond to Tier 1 and Tier 2 reminders.
- Use the Compliance dashboard's **Per Region** export to prepare monthly reports for regional stakeholders.

*Video walkthrough coming soon.*

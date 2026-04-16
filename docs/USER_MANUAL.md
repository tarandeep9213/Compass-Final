# CashRoom Compliance System — User Manual

## 1. Introduction

### What is CashRoom?
CashRoom is a web-based application that digitizes the daily cash reconciliation process for Compass Group facilities. Instead of paper-based cash counts and manual Excel tracking, CashRoom provides a streamlined digital workflow where operators submit cash counts, controllers verify and approve them, and management has full visibility into compliance.

### Purpose and Key Benefits
- **Eliminate paper-based processes** — all cash counts are submitted digitally
- **Real-time compliance visibility** — management can see submission status across all locations instantly
- **Automated notifications** — email alerts for pending approvals, rejections, and visit schedules
- **Audit trail** — every action is logged and traceable
- **Variance tracking** — automatic calculation of cash variances against imprest amounts
- **Visit scheduling** — controllers and DGMs can schedule and track verification visits

### User Roles
| Role | What They Do |
|------|-------------|
| **Operator** | Submits daily cash count forms for their assigned location |
| **Controller** | Reviews/approves operator submissions, schedules weekly verification visits |
| **DGM (District General Manager)** | Schedules monthly verification visits, oversees multiple locations |
| **Regional Controller (RC)** | Views compliance dashboards and reports across all locations |
| **Admin** | Manages users, locations, system settings, and has full dashboard access |

---

## 2. Getting Started

### How to Access the Application
1. Open your web browser (Chrome, Edge, or Firefox recommended)
2. Navigate to the application URL provided by your administrator
3. You will see the CashRoom login screen

> [Screenshot placeholder: Login screen showing email and password fields with "Sign In" button]

### How to Login
1. Enter your **email address** in the "Email address" field
2. Enter your **password** in the "Password" field
3. Click **"Sign In"**

> [Screenshot placeholder: Login screen with fields filled in]

### Forgot Password
If you forget your password:
1. Click **"Forgot password?"** on the login screen
2. Enter your email address
3. Click **"Send"** — a 6-digit code will be sent to your email
4. Enter the code on the verification screen
5. Click **"Continue"**
6. Enter your new password (minimum 8 characters)
7. Click **"Reset"** — you can now sign in with your new password

> [Screenshot placeholder: Forgot password flow — email entry, OTP entry, new password]

### Change Password
Once logged in:
1. Click **"Change Password"** in the top-right corner
2. Enter your current password
3. Enter your new password
4. Confirm the new password
5. Click **"Change"**

### Basic Navigation
After logging in, you will see:
- **Sidebar (left)** — navigation menu with your available screens
- **Header (top)** — your name, role, Change Password and Sign Out buttons
- **Main area (center)** — the active screen content

> [Screenshot placeholder: Main application layout with sidebar, header, and content area labeled]

---

## 3. Step-by-Step Usage Guide

---

### FOR OPERATORS

#### Submitting a Daily Cash Count

**Step 1:** Login and view your Dashboard
- Your dashboard shows today's date, your assigned location, and whether you've submitted today
- If "Not yet submitted" appears, click **"Submit Now"**

> [Screenshot placeholder: Operator dashboard showing "Not yet submitted" with Submit Now button]

**Step 2:** Choose your submission method
- **Form** — fill in the digital cash count worksheet (recommended)
- **Excel Upload** — upload a completed Excel file
- **Chat** — guided step-by-step entry via chat interface

> [Screenshot placeholder: Method selection screen with Form, Excel, and Chat options]

**Step 3:** Fill in the Cash Count Form
The form mirrors the paper Cashroom Count Worksheet with these sections:

| Section | What to Enter |
|---------|-------------|
| **Section A** — Changers/Coin | Count all coins and bills in changers |
| **Section B** — Loose Coin | Count loose coins (quarters, dimes, nickels, pennies) |
| **Section C** — Loose Currency | Count loose bills |
| **Section D** — Unissued Fund | Count unissued funds |
| **Section E** — Checks | List any checks |
| **Section F** — Short/Over | Record any known shorts or overs |
| **Section G** — Paid Outs | Record paid outs |
| **Section H** — Deposits | Record deposits |
| **Section I** — Other | Any other items |
| **Section J** — Replenishment | Record replenishment amounts |
| **Section K** — Coin in Transit | Record coin in transit |

For each section:
1. Enter the amounts in the white input fields
2. Yellow fields are auto-calculated — do not type in them
3. The running total updates automatically at the bottom

> [Screenshot placeholder: Cash count form showing sections with input fields and auto-calculated totals]

**Step 4:** Review the Summary
- At the bottom of the form, review:
  - **Total Fund** — your total cash count
  - **Expected (Imprest)** — the expected amount for your location
  - **Variance** — the difference (green = within tolerance, red = exceeds tolerance)
- If the variance exceeds tolerance, you must enter a **Variance Note** explaining why

> [Screenshot placeholder: Form summary showing total, expected, variance, and variance note field]

**Step 5:** Submit
- Click **"Submit for Approval"** to send to your controller for review
- Or click **"Save Draft"** to save and finish later

> [Screenshot placeholder: Submit and Save Draft buttons]

**Step 6:** Confirmation
- After submission, your dashboard will show the submission status:
  - **Pending Approval** (amber) — waiting for controller review
  - **Approved** (green) — controller approved your count
  - **Rejected** (red) — controller rejected, you need to resubmit

> [Screenshot placeholder: Dashboard showing "Pending Approval" status after submission]

#### Viewing a Rejected Submission
If your submission is rejected:
1. You will receive an email notification with the rejection reason
2. On your dashboard, you will see the rejection reason
3. Click **"Submit Now"** to submit a corrected count
4. The form will show the previous values so you can make corrections

#### Saving and Resuming Drafts
- If you saved a draft, click **"Resume Draft"** on your dashboard
- Your previously entered values will be loaded
- Complete the form and submit

---

### FOR CONTROLLERS

#### Daily Review Dashboard
This screen shows all pending operator submissions for your assigned locations.

> [Screenshot placeholder: Daily Review Dashboard showing pending submissions list]

**Reviewing a Submission:**
1. Find the pending submission in the list
2. Click **"View & Approve"** to see the full cash count form
3. Review each section — you can mark sections as "Approve" or "Flag"
4. After reviewing all sections:
   - Click **"Approve"** to approve the submission
   - Click **"Reject"** and enter a reason to reject it

**Understanding the KPI Cards:**
| KPI | What It Means |
|-----|-------------|
| **Pending** | Number of submissions waiting for your review |
| **Approved** | Number approved in the selected time period |
| **Rejected** | Number rejected in the selected time period |
| **Avg Variance** | Average cash variance across submissions (+ means over, - means short) |

> [Screenshot placeholder: KPI cards at top of Daily Review Dashboard]

#### Weekly Review Dashboard
This screen shows your scheduled verification visits and their status.

> [Screenshot placeholder: Weekly Review Dashboard showing visit schedule]

**Scheduling a Visit:**
1. Click the **Schedule** button (or navigate to the schedule screen)
2. Select a **location** from the dropdown
3. Select a **date** (weekdays only, Mon-Fri)
4. Select a **time slot** (09:00, 11:00, 13:00, 15:00, or 17:00)
5. If a day-of-week warning appears (same location visited on same weekday recently), select a reason
6. Click **"Schedule Visit"**

> [Screenshot placeholder: Visit scheduling form with location, date, and time dropdowns]

**Completing a Visit:**
1. On the day of your visit, find the scheduled visit in the list
2. Click **"Mark as Completed"**
3. The system will show the operator's submission for that location and date:
   - **If the operator submitted** — review the form via "View & Approve"
   - **If the operator hasn't submitted** — you can fill the cash count form yourself
4. After reviewing/filling the form:
   - Add any notes (optional)
   - Sign in the digital signature box
   - Click **"Confirm Completion"**

> [Screenshot placeholder: Visit completion panel showing review form and signature]

**Understanding Visit Statuses:**
| Status | Meaning |
|--------|---------|
| **Scheduled** | Visit is planned but not yet done |
| **Completed** | Visit was done and recorded |
| **Missed** | Visit time passed without completion |
| **Cancelled** | Visit was cancelled before the scheduled time |

**Table Columns Explained:**
| Column | What It Shows |
|--------|-------------|
| **Date** | The scheduled/actual visit date |
| **Location** | Which facility was visited |
| **Status** | Current status (see above) |
| **Total Cash** | The observed cash total from the visit |
| **vs Imprest** | Difference between observed cash and expected imprest amount |
| **Notes/Reason** | Any notes from the visit or reason for missed/cancelled |
| **Actions** | Buttons to complete, miss, or cancel the visit |

#### Cash Reasonableness Test
This screen allows you to generate and review reasonableness reports for your locations.

---

### FOR DGM (District General Manager)

#### Coverage Dashboard
This is your main screen showing monthly visit coverage across your assigned locations.

> [Screenshot placeholder: DGM Coverage Dashboard with visit schedule and KPIs]

**KPI Cards:**
| KPI | What It Means |
|-----|-------------|
| **Completed** | Number of visits completed this month |
| **Scheduled** | Number of upcoming scheduled visits |
| **Missed** | Number of visits that were not completed |
| **Avg Visit Gap** | Average days between your consecutive visits |

**Scheduling a Monthly Visit:**
1. Navigate to the schedule screen
2. Select a **location**
3. Select a **date** (one visit per location per month)
4. Add notes if needed
5. Click **"Schedule Visit"**

**Completing a Visit:**
The process is the same as for controllers:
1. Find the scheduled visit
2. Click **"Mark as Completed"**
3. Review the operator's submission or fill the form yourself
4. Sign and confirm

> [Screenshot placeholder: DGM visit completion with signature]

#### History
View all your past visits with their outcomes, variances, and notes.

---

### FOR REGIONAL CONTROLLER (RC)

#### Business Dashboard
Your main overview of compliance across all locations.

> [Screenshot placeholder: RC Business Dashboard with KPIs and charts]

**KPI Cards:**
| KPI | What It Means |
|-----|-------------|
| **Overall Compliance** | Percentage of locations in "green" (compliant) status |
| **Submissions Today** | How many locations have submitted today vs total |
| **Approval Rate** | Percentage of submissions approved |
| **Variance Exceptions** | Count of submissions exceeding variance tolerance |
| **Cash at Risk** | Total dollar amount of variance across exception locations |

**Location Compliance Detail Table:**
This table shows every location's current status:

| Column | What It Shows |
|--------|-------------|
| **Health** | Green (compliant), Amber (at risk), Red (non-compliant) |
| **Location** | Location name and ID |
| **Today's Submission** | Whether the operator submitted today and its status |
| **Controller Approval** | Whether the submission was approved/rejected/pending |
| **Controller Visit** | Days since last controller visit + "Form filled" if controller counted cash |
| **DGM Visit** | DGM visit status for this month + "Form filled" if DGM counted cash |

**Top At-Risk Locations:**
Shows the 5 locations with the highest risk scores. Risk factors include:
- No operator submission today
- Submission rejected
- Pending approval > 48 hours (SLA breach)
- High variance
- No controller visit in 14+ days
- No DGM visit this month

> [Screenshot placeholder: Location Compliance Detail table with health indicators]

**DGM Coverage:**
Shows which DGMs have completed their monthly visits and which locations are still pending.

#### Reports
Detailed reporting with date range selection:
- **Submissions table** — all operator submissions with status and variance
- **Date-Level Detail** — daily breakdown showing who submitted, who approved, visit status
- **Variance Exceptions** — submissions that exceeded the tolerance threshold
- **Download** — export data as CSV for further analysis

> [Screenshot placeholder: Reports screen with date range picker and tables]

#### Cash Trends
Visual charts showing trends over time:
- Submission rates
- Variance patterns
- Section-by-section breakdowns

---

### FOR ADMIN

#### Managing Locations
**Adding a New Location:**
1. Navigate to **Locations** in the sidebar
2. Click the **"+ Add"** button
3. Fill in:
   - **Cost Center** — the business accounting code (e.g., 5082)
   - **Name** — location display name (e.g., "APPLETON")
   - **Imprest Amount** — expected daily cash amount (e.g., $9,575)
   - **Tolerance %** — acceptable variance percentage (e.g., 0.5%)
4. Click **"Save"**

> [Screenshot placeholder: Add Location form with Cost Center, Name, Imprest, and Tolerance fields]

**Editing a Location:**
1. Click on the location row in the table
2. Modify the fields
3. Click **"Save"**

**Note:** Multiple locations can share the same Cost Center.

#### Managing Users
**Adding a New User:**
1. Navigate to **Users** in the sidebar
2. Click **"+ Add User"**
3. Fill in:
   - **Name** — full name
   - **Email** — their email address (used for login)
   - **Role** — Operator, Controller, DGM, Regional Controller, or Admin
   - **Locations** — assign one or more locations (not needed for Admin/RC)
4. Click **"Save"**
5. The user will receive a **welcome email** with their login credentials

> [Screenshot placeholder: Add User form with name, email, role, and location fields]

#### Import Roster
Upload an Excel file to bulk-create locations and users:
1. Navigate to **Import Roster**
2. Click **"Browse File"** or drag-and-drop your Excel file
3. Preview the data — verify the columns are mapped correctly
4. Click **"Confirm Import"**
5. All users will receive welcome emails automatically

> [Screenshot placeholder: Import Roster screen with file upload and preview table]

#### Audit Trail
View a log of every action taken in the system:
- User logins
- Submissions created, approved, rejected
- Visits scheduled, completed, missed
- Users created, modified
- System settings changed

> [Screenshot placeholder: Audit Trail table with event type, actor, location, and timestamp]

#### System Settings
The Admin also has access to:
- **Business Dashboard** — same as RC view, for full Midwest visibility
- **Reports** — detailed submission and compliance reports
- **Cash Trends** — trend analysis charts
- **Reasonableness Reports** — cash reasonableness test results

---

## 4. Features Overview

### Buttons Guide

| Button | Where | What It Does |
|--------|-------|-------------|
| **Submit Now** | Operator Dashboard | Start a new cash count submission |
| **Save Draft** | Cash Count Form | Save your work to finish later |
| **Submit for Approval** | Cash Count Form | Send completed form to controller |
| **Approve** | Controller Daily Review | Approve an operator's cash count |
| **Reject** | Controller Daily Review | Reject with a reason — operator must resubmit |
| **Schedule Visit** | Controller/DGM Schedule | Create a new verification visit |
| **Mark as Completed** | Visit Dashboard | Record that a visit was completed |
| **Mark as Missed** | Visit Dashboard | Record that a visit was not completed (past dates) |
| **Cancel** | Visit Dashboard | Cancel a future scheduled visit |
| **Change Password** | Top-right header | Change your login password |
| **Sign Out** | Top-right header | Log out of the application |
| **Download** | Reports screen | Export data as CSV file |
| **Reset** | Admin Locations | Clear all data (use with caution!) |

### KPI Cards Guide
KPI (Key Performance Indicator) cards appear at the top of dashboards. They show key metrics at a glance.

**How to read them:**
- The **large number** is the current value
- The **label** below explains what it measures
- **Green** = good, **Amber** = needs attention, **Red** = action required
- Hover over the **info icon** (if present) for a detailed explanation including the formula

### Tables Guide
Most screens include data tables. Here's how to use them:

**Filtering:**
- Use the **status chips** (All, Pending, Approved, etc.) to filter by status
- Use the **location dropdown** to filter by location
- Use the **date range** selector to change the time period

**Sorting:**
- Click column headers to sort (where available)

**Pagination:**
- Use the page numbers at the bottom to navigate through large datasets

**Color Coding:**
- **Green badges/text** = approved, compliant, within tolerance
- **Amber badges/text** = pending, at risk, approaching tolerance
- **Red badges/text** = rejected, non-compliant, exceeds tolerance

### Dashboard Guide
Each role's dashboard is designed to show the most important information first:
- **Operator** — "Did I submit today? What's my status?"
- **Controller** — "What needs my review? Where do I need to visit?"
- **DGM** — "Which locations have I visited this month? Where do I still need to go?"
- **RC** — "Are all locations compliant? Where are the problems?"
- **Admin** — "Full visibility plus system management"

---

## 5. Best Practices

### For Operators
- Submit your cash count **early in the day** — don't wait until end of day
- Double-check your counts before submitting — rejections require resubmission
- If your variance is high, always add a **variance note** explaining why
- Use **Save Draft** if you need to step away and finish later

### For Controllers
- Review pending submissions **within 48 hours** to avoid SLA breaches
- When rejecting, provide a **clear reason** so the operator knows what to fix
- Schedule visits for **different weekdays** to avoid patterns (the system will warn you)
- Complete visits on the scheduled day — the system tracks timeliness

### For DGMs
- Complete at least **one visit per location per month**
- Check your Coverage Dashboard regularly to see which locations still need visits
- Review the operator's approved submission before completing your visit

### For Admins
- Keep user information up to date — remove inactive users promptly
- Set appropriate **imprest amounts** and **tolerance percentages** per location
- Monitor the **Audit Trail** for unusual activity
- Use the **Import Roster** feature for bulk user creation when onboarding multiple locations

### Common Mistakes to Avoid
- **Don't share your password** — each user should have their own account
- **Don't submit without counting** — the system tracks variances and they're auditable
- **Don't ignore rejection reasons** — resubmit with the corrections noted
- **Don't forget to sign** — visit completion requires a digital signature
- **Don't schedule visits on weekends** — the system only allows weekday scheduling for controllers

---

## 6. FAQs / Troubleshooting

### Login Issues

**Q: I forgot my password. How do I reset it?**
A: Click "Forgot password?" on the login screen. Enter your email to receive a 6-digit reset code. Enter the code, then set a new password.

**Q: I'm not receiving the password reset email.**
A: Check your spam/junk folder. If still not received, contact your administrator to reset your password.

**Q: My login says "Invalid credentials."**
A: Make sure you're using the correct email address (the one you received in your welcome email). Passwords are case-sensitive. If you've forgotten your password, use the Forgot Password flow.

### Submission Issues

**Q: I see "A submission already exists" when trying to submit.**
A: You can only submit one cash count per day per location. If you need to make changes, use the Update feature on your existing submission.

**Q: My submission was rejected. What do I do?**
A: Read the rejection reason provided by the controller. Make the necessary corrections and submit a new form. The system will replace the rejected submission.

**Q: The form shows the wrong "Counted By" name.**
A: The name shown is based on your login account. If incorrect, contact your administrator to update your profile.

### Visit Issues

**Q: I can't schedule a visit on a weekend.**
A: Controller visits can only be scheduled on weekdays (Monday through Friday).

**Q: I see "Too early" when trying to complete a visit.**
A: The system shows a warning if you're completing before the scheduled time. Click "Acknowledge & Complete" to proceed anyway.

**Q: I can't complete a visit — it says "window has passed."**
A: The completion window is 48 hours after the scheduled time. After that, use "Mark as Missed" instead.

### Display Issues

**Q: I see old data or the screen doesn't look right.**
A: Try a hard refresh: press **Ctrl + Shift + R** (or Cmd + Shift + R on Mac). If that doesn't help, clear your browser cache: Settings > Privacy > Clear browsing data > Cached images and files.

**Q: The page shows "Internal Server Error."**
A: Try refreshing the page. If the error persists, clear your browser cache and try again. If still broken, contact your administrator.

### Email Issues

**Q: I'm not receiving system emails (approvals, rejections, etc.).**
A: Check your spam/junk folder. Ask your IT team to whitelist the system's sending email address.

**Q: I received a welcome email but the password doesn't work.**
A: The temporary password is case-sensitive. Copy and paste it exactly. If still not working, use the Forgot Password flow to set a new one.

---

## Support

For technical issues or questions not covered in this manual, contact your system administrator.

---

*CashRoom Compliance System — Compass Group*
*Version 1.0 — April 2026*

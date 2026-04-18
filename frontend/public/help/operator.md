# Operator User Guide

As an **Operator**, you submit the daily cash count for your assigned location — the first and most important step in the daily compliance workflow.

![Operator Dashboard — full page, default state](/help/screenshots/operator/op-start.png)

## What you can do

- Submit the daily cash count via **Digital Form**, **Excel Upload**, or **Chat**.
- **Save a draft** and resume later in the day.
- **Resubmit** after a controller rejection.
- Jump to any past unsubmitted date to fill in a missed submission.
- See your submission history and status (Accepted, Pending, Rejected, Missed) for the last 90 days.

## Dashboard

The dashboard greets you with `Good [morning / afternoon / evening], [your first name]` and summarises your submission status at a glance.

### What the screen shows

The screen has three stacked sections:

1. **Header** — your name, the location chip (site name + cost center), and today's date.
2. **Today's Submission card** — the headline state for today (Not yet submitted / Pending Approval / Accepted / Rejected) with the appropriate action button.
3. **History block** — KPI cards + filter chips + a date jump + the Submission History table.

#### KPI cards (last 90 days)

| KPI | Meaning |
|---|---|
| **Accepted** (green) | Submissions the controller approved. |
| **Pending** (amber) | Submissions waiting for controller review. |
| **Rejected** (red) | Submissions the controller rejected — read the reason and resubmit. |
| **Missed** (grey) | Days you didn't submit at all. |

> **Label note:** approved submissions show the status **"Accepted"** (not "Approved").

#### Submission History table

The table lists every submission and missed day for the last 90 days. Columns: `Date · Total Cash · Variance · Status · Action`.

### Filtering submission history

![Submission history filtered by Pending](/help/screenshots/operator/op-start-filter-pending.png)

Below the KPI cards sits a row of filter chips: `All · Pending · Rejected · Missed · Accepted`. Click any chip to narrow the table to just that status. The selected chip turns dark green; click `All` to return to the full list.

There's also a **jump-to-date** input + **Go →** button at the right — type a past date and click Go to open that day's submission flow directly. Useful for filling in a missed day.

## Submitting a daily cash count

### Step 1 — Start from the dashboard

If Today's Submission shows **Not yet submitted**, click the green **Submit Now →** button. If you need to fill in a past date you missed, use the jump-to-date input and click **Go →**.

### Step 2 — Choose an entry method

![Choose Entry Method screen — Digital Form, Excel Upload, Chat options](/help/screenshots/operator/op-method.png)

The Method Select screen shows the imprest balance for your location at the top, then three method cards:

| Method | Badge | When to use |
|---|---|---|
| **Digital Form** | Recommended / Most accurate | Default. Full on-screen worksheet. |
| **Excel Upload** | Fast | If you already have the CashRoom Excel template filled in. |
| **Chat** | (no badge) | Guided, denomination-by-denomination conversation. Good for training. |

A reference table at the bottom of the page summarises every section (A–I) and what each one captures.

Click **Select →** under whichever method you want.

### Step 3 — Fill in the Cash Count Form

![Cash Count Form — Section A header visible, white inputs, yellow auto-calc cells](/help/screenshots/operator/op-form.png)

The form mirrors the paper Cashroom Count Worksheet. White cells are inputs; **yellow cells are auto-calculated** — don't type in them. Running totals update at each section footer and at the bottom of the form.

See the **Cash Count Form sections reference** below for what to enter in each section.

### Step 4 — Review the summary

At the bottom of the form: `Total Fund · Expected (Imprest) · Variance`. Variance is colour-coded — green within tolerance, amber approaching, red exceeds. If variance exceeds tolerance, a **Variance Note** input appears and becomes required.

### Step 5 — Submit or Save Draft

- Click **Submit for Approval** to send the count to your controller for review.
- Click **Save Draft** to save your work-in-progress and return later.

### Step 6 — Confirmation

After submission, the dashboard's Today card flips to **Pending Approval** until the controller approves or rejects. You'll receive an email when they act.

## Cash Count Form — sections reference

| Sec | Title | What to enter |
|---|---|---|
| **A** | Currency (Bills) | Quantity of each denomination ($1, $2, $5, $10, $20, $50, $100) + any "Other" loose currency |
| **B** | Rolled Coin | Quantity of rolled coin by denomination |
| **C** | Coins in Counting Machines (Sorter/Counter) | For each denomination, quantity loaded in **No. 1** and **No. 2** counting machines |
| **D** | Bagged Coin (Full for Bank) | Quantity of full bags by type (Dollar, Quarter, Dime, Nickel, Bulker) |
| **E** | Unissued Changer Funds in Cashroom or Vault | Custom rows — description, quantity, amount |
| **F** | Returned but Uncounted Manual Change | Manual change returned but not yet counted |
| **G** | Mutilated Currency, Foreign, and/or Bent Coin | Non-circulatable currency and coin |
| **H** | Changer Funds Outstanding (Form #1841 / #403-1) | Funds issued to changers and not yet returned |
| **I** | Net Unreimbursed Bill Changer Fund Shortage / (Overage) | Auto-pre-filled from your prior in-month submission — see below |

**Below Section I**, three standalone numeric fields:

- **Holdover** — cash held over to tomorrow (deducted from today's total).
- **Replenishment** — cash received from the bank today.
- **Coin in Transit** — coin on its way to/from the bank.

## Section I — "Yesterday" auto-carry

Section I tracks the running shortage/overage across the month. The system **automatically pre-fills "Yesterday's" figure** from your most recent in-month submission for this location. You only enter **today's** count; the cumulative figure is computed for you. If no prior submission exists this month, Section I starts at zero.

## Excel Upload flow

On the **Excel Upload** screen, drag-and-drop your filled worksheet onto the drop zone or click **Browse files**. Accepts `.xlsx` and `.xls`. The banner reminds you to use the official **Daily Cashroom Count Worksheet** template — a sample is available via the **Sample Excel** download link.

Once parsed, the app loads your values into the Digital Form so you can review them before submitting. If parsing fails, a specific error explains which section could not be read — fix the file and re-upload.

## Chat entry flow

The chat walks you through each denomination in turn (27 steps covering Sections A, B, C, E, and H) with a running total shown live in the header. Answer each prompt with a number and press **Send** or Enter. Type **0** when you have none of a denomination. At the end the assistant shows a summary for confirmation before you submit.

## Viewing a rejected submission

If your submission is rejected:

1. You receive an email with the rejection reason.
2. Your dashboard's Today card shows the reason inline.
3. Click **Resubmit** to open the form with your previous values preloaded — fix only what's needed and submit again.

## Drafts

Open **My Drafts** from the dashboard (a Draft card appears whenever you have one in progress) to see any in-progress submissions:

- Each draft card shows its location, date, saved time, and total-so-far.
- **Resume** opens the form with your values.
- **Delete** removes the draft.

Drafts are saved automatically whenever you close a form in progress.

## Tips

- Submit **early in the day** — don't wait until end of day.
- Double-check your counts before submitting. Rejections require a full resubmission.
- If variance is high, always add a Variance Note explaining why.
- The **Coins in Counting Machines** section (C) accepts full-length counts — no 3-digit cap.
- Use **Save Draft** if you need to step away.

*Video walkthrough coming soon.*

# Operator User Guide

As an **Operator**, you submit the daily cash count for your assigned location — the first and most important step in the daily compliance workflow.

![Operator Dashboard](/help/screenshots/operator/op-start.png)

## What you can do

- Submit the daily cash count via **Digital Form**, **Excel Upload**, or **Chat**.
- **Save a draft** and resume later in the day.
- **Resubmit** after a controller rejection.
- Jump to any past unsubmitted date to fill in a missed submission.
- See your submission history and status (Accepted, Pending, Rejected, Missed) for the last 90 days.

## Dashboard

The dashboard greets you with `Good [morning / afternoon / evening], [your first name]` and shows:

- A **location chip** with your assigned site name and cost center.
- A **Today's Submission** card with one of three states:
  - **Not yet submitted** — shows a green `Submit Now →` button.
  - **Pending Approval** — your submission is waiting for the controller.
  - **Accepted** or **Rejected** — the controller has acted; if rejected, the reason appears inline with a **Resubmit** action.
- A **Drafts** card appears when you have a draft in progress, showing how many sections you've counted so far.

Below the Today card:

- **Four KPI cards** (`Accepted · Pending · Rejected · Missed`) covering your last 90 days.
- **Filter chips** (`All · Pending · Rejected · Missed · Accepted`) to narrow the submission history table.
- A **jump-to-date** input + **Go →** button to open an unsubmitted past date directly.

> **Label note:** approved submissions show the status **"Accepted"** (not "Approved").

## Submitting a daily cash count

**Step 1 — Start from the dashboard.**
If Today's Submission shows **Not yet submitted**, click **Submit Now →**. If you need to fill in a past date you missed, use the jump-to-date input and click **Go →**.

**Step 2 — Choose an entry method.**

| Method | When to use |
|---|---|
| **Digital Form** | Default. Full on-screen worksheet. Most accurate. |
| **Excel Upload** | Fastest if you already have the CashRoom Excel template filled. |
| **Chat** | Guided, denomination-by-denomination conversation. Good for training. |

**Step 3 — Fill in the Cash Count Form.**
The form has **9 sections (A–I)** plus three standalone numeric fields. White fields are inputs; **yellow fields are auto-calculated** (don't type in them). Running totals update at each section footer and at the bottom of the form.

**Step 4 — Review the summary.**
At the bottom: `Total Fund · Expected (Imprest) · Variance`. Variance is colour-coded: green within tolerance, amber approaching, red exceeds. If the variance exceeds tolerance, a **Variance Note** becomes required.

**Step 5 — Submit or Save Draft.**
Click **Submit for Approval** to send to the controller, or **Save Draft** to resume later.

**Step 6 — Confirmation.**
After submission, the dashboard status changes to **Pending Approval** until the controller approves or rejects.

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
| **I** | Net Unreimbursed Bill Changer Fund Shortage / (Overage) | Carried forward automatically — see below |

**Below Section I**, three standalone numeric fields:

- **Holdover** — cash held over to tomorrow (deducted from today's total).
- **Replenishment** — cash received from the bank today.
- **Coin in Transit** — coin on its way to/from the bank.

## Section I — "Yesterday" auto-carry

Section I tracks the running shortage/overage across the month. The system **automatically pre-fills "Yesterday's" figure** from your most recent in-month submission for this location. You only enter **today's** count; the cumulative figure is computed for you. If no prior submission exists this month, Section I starts at zero.

## Excel Upload flow

On the **Excel Upload** screen, drag-and-drop your filled worksheet or click **Browse files**. The banner reminds you to use the official **Daily Cashroom Count Worksheet** template — a sample is available via the **Sample Excel** download link.

Once parsed, the app loads your values into the Digital Form so you can review them before submitting. If parsing fails, a specific error explains which section could not be read — fix the file and re-upload.

## Chat entry flow

The chat walks you through each denomination in turn (27 steps covering Sections A, B, C, E, and H) with a running total shown live in the header. Answer each prompt with a number and press **Send** or Enter. Type **0** when you have none of a denomination. At the end the assistant shows a summary for confirmation before submitting.

## Viewing a rejected submission

If your submission is rejected:

1. You receive an email with the rejection reason.
2. Your dashboard shows the reason inline on the Today card.
3. Click **Resubmit** to open the form with your previous values preloaded — fix only what's needed and submit again.

## Drafts

Open **My Drafts** from the dashboard to see any in-progress submissions:

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

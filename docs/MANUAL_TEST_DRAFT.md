# Manual Test Cases — Draft & Delete Draft

Login as **operator@compass.com** / `demo1234` for all tests.
Backend must be running (port 8002). Frontend at http://localhost:3000.

---

## TC-1: Create a Draft

1. Login as operator
2. Click **Submit Now** on today's card (or pick a location)
3. Select **Digital Form**
4. Fill in Section A with some values (e.g., Ones: 500, Fives: 1000)
5. Click **Save Draft** (bottom of form)
6. You should be redirected to Dashboard
7. **Verify:** Today's card shows "Draft In Progress" with the amount you entered
8. **Verify:** "My Drafts" button appears in the header with badge count "1"

---

## TC-2: Resume a Draft

1. From Dashboard, click **My Drafts** button
2. You should see your draft listed with location name, date, total so far, and progress bar
3. Click **Resume**
4. **Verify:** The form opens with your previously saved Section A values pre-filled
5. Add Section B values (e.g., Dollars: 50, Quarters: 25)
6. Click **Save Draft** again
7. Go back to **My Drafts**
8. **Verify:** The total has updated to include Section B values

---

## TC-3: Submit a Draft

1. Go to **My Drafts** and click **Resume** on your draft
2. Click **Submit for Approval** (at the bottom)
3. **Verify:** Redirected to Dashboard
4. **Verify:** Today's card shows "Pending Approval" (not "Draft In Progress")
5. **Verify:** "My Drafts" button either disappears or shows count reduced by 1
6. Go to **My Drafts** (if button still visible)
7. **Verify:** The submitted draft is NOT listed anymore — it's now a submission

---

## TC-4: Delete Draft from My Drafts (Discard Button)

1. Create a new draft (follow TC-1 steps for a different date if today is taken — use the history table to find a date without a submission)
2. Go to **My Drafts**
3. Click **Discard** on the draft
4. Confirm the dialog ("Are you sure?")
5. **Verify:** The draft disappears from the list
6. Navigate away (click Dashboard) then come back to **My Drafts**
7. **Verify:** The draft is still gone (not just hidden — actually deleted from backend)

---

## TC-5: Delete Draft from Form (Discard Button)

1. Create a new draft (TC-1 steps)
2. Go to **My Drafts** and click **Resume**
3. On the form page, click **Discard** (red button at bottom)
4. Confirm the dialog
5. **Verify:** Redirected to Dashboard
6. **Verify:** "My Drafts" count is reduced — the draft is gone
7. Go to **My Drafts** to confirm it's not listed

---

## TC-6: Failed Delete Shows Error (Not Silent)

1. Create a draft and **Submit for Approval** (TC-3)
2. Open browser DevTools → Network tab
3. Try calling DELETE on the submission ID manually via DevTools console:
   ```js
   fetch('http://localhost:8002/v1/submissions/YOUR_SUBMISSION_ID', {
     method: 'DELETE',
     headers: { 'Authorization': 'Bearer ' + localStorage.getItem('ccs_token') }
   }).then(r => console.log(r.status))
   ```
4. **Verify:** Response is 400 (not 204) — you cannot delete a pending submission
5. The frontend Discard button does NOT appear for pending submissions (only on the form when editing a draft)

---

## TC-7: Draft Does Not Appear After Submission

1. Create a draft (TC-1)
2. Go to **My Drafts** — verify it's listed
3. Click **Resume** → Click **Submit for Approval**
4. Go to Dashboard — verify "Pending Approval" shows
5. Go to **My Drafts**
6. **Verify:** The submitted record does NOT appear here
7. Refresh the browser (F5) and check **My Drafts** again
8. **Verify:** Still not showing — it's truly removed from draft status in the backend

---

## TC-8: Save Changes on Pending Submission (Not "Save Draft")

1. Submit a submission (so it's "Pending Approval")
2. On the Dashboard, click **Update →** on today's pending submission
3. Select **Digital Form**
4. **Verify:** The button says **"Save Changes"** (NOT "Save Draft")
5. Modify a value, click **Save Changes**
6. **Verify:** Redirected to Dashboard, submission still shows "Pending Approval"
7. Go to **My Drafts**
8. **Verify:** This submission does NOT appear in drafts — it's still pending, not reverted to draft

---

## TC-9: Save Draft on Rejected Submission Reverts to Draft

1. Need a rejected submission — ask a controller to reject one, or use API:
   ```
   Login as controller@compass.com
   Go to Daily Review Dashboard
   Click Complete Review on a pending submission
   Reject it with a reason
   ```
2. Login as operator
3. Find the rejected submission in history, click **Update**
4. Select **Digital Form**
5. **Verify:** The rejection reason banner is shown at the top
6. Click **Save Draft** (should say "Save Draft" since it's rejected, not pending)
7. Go to **My Drafts**
8. **Verify:** The submission now appears as a Draft (status changed from rejected → draft)
9. Click **Resume** → Click **Submit for Approval**
10. **Verify:** It goes back to "Pending Approval"

---

## TC-10: Multiple Drafts for Different Locations/Dates

1. If operator has access to multiple locations, create drafts for different locations
2. Go to **My Drafts**
3. **Verify:** Each draft shows the correct location name, date, and total
4. Discard one draft
5. **Verify:** Only that specific draft is removed, others remain

---

## TC-11: Values Match Between Dashboard and View Details

1. Submit a submission with known values (e.g., Section A: $500, Section B: $100, Holdover: $50, Coin Transit: $200)
2. On Dashboard table, note the **Total Cash** and **Variance** shown
3. Click **View Details** on that submission
4. **Verify:** The Total Cash and Variance in View Details match exactly what the Dashboard showed
5. Expected total: (A+B+C+D+E+F+G - Holdover) + H + I + Replenishment + CoinTransit

---

## Quick Reference: Expected Behavior Summary

| Action | Draft Status | Appears in My Drafts? | Appears in Dashboard? |
|--------|-------------|----------------------|----------------------|
| Save Draft (new) | draft | Yes | No (not submitted) |
| Submit Draft | pending_approval | No | Yes |
| Discard Draft (My Drafts) | deleted | No | No |
| Discard Draft (Form) | deleted | No | No |
| Save Changes (pending) | pending_approval | No | Yes |
| Save Draft (rejected) | draft | Yes | Yes (as draft) |

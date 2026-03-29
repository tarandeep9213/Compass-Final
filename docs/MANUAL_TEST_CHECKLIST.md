# Manual Test Checklist — Complete Workflow

Execute in order. Each step depends on the previous.

**Backend:** http://localhost:8000 (or 8003 for dev)
**Frontend:** http://localhost:3000
**Demo password:** `demo1234` for all accounts

---

## Step 1: Admin Setup

Login: `admin@compass.com`

- [ ] Locations page shows all seeded locations (loc-1 through loc-5)
- [ ] Users page shows all seeded users (operator, controller, dgm, admin, rc)
- [ ] Create a new test operator: name "Test Operator", assign to loc-1
- [ ] Verify the new user appears in the list with correct role
- [ ] Go to Config (if available) → update global tolerance to 2%
- [ ] Go to Audit Trail → verify "USER_CREATED" and "CONFIG_UPDATED" events logged
- [ ] Deactivate the test operator → verify "USER_DEACTIVATED" in audit

---

## Step 2: Operator — Digital Form Submission

Login: `operator@compass.com`

- [ ] Dashboard shows "Not yet submitted" for today
- [ ] Click **Submit Now →** → method selector appears
- [ ] Click **Digital Form** → Cash Count Form opens
- [ ] Fill Section A: Ones=$100, Fives=$400 (total=$500)
- [ ] Fill Section B: Dollars=$50, Quarters=$25 (total=$75)
- [ ] Verify tolerance shows **±0.5%** (or 2% if admin changed it)
- [ ] Click **Submit for Approval**
- [ ] Dashboard shows today as **Pending Approval** with total $575
- [ ] Verify **Update →** button appears on today's card

---

## Step 3: Operator — Excel Upload (Update)

- [ ] Click **Update →** on today's pending submission
- [ ] Verify **"Updating existing submission"** banner in method selector
- [ ] Click **Excel Upload**
- [ ] Verify **"Re-uploading for existing submission"** banner
- [ ] Upload `Cashroom Count Worksheet.xlsx`
- [ ] Verify form pre-fills with Excel data (Section A=$50, B=$100)
- [ ] Verify Section K (Coin Purchase) shows if present
- [ ] Click **Submit for Approval**

---

## Step 4: Operator — Draft Flow

- [ ] Start a new submission for a different date (use history table)
- [ ] Fill partial data (Section A only)
- [ ] Click **Save Draft**
- [ ] Verify **My Drafts** button appears with badge count
- [ ] Click **My Drafts** → verify draft listed with progress bar
- [ ] Click **Resume** → verify data pre-filled
- [ ] Add Section B data → click **Submit for Approval**
- [ ] Go back to **My Drafts** → verify draft is gone
- [ ] Verify submission appears in dashboard as Pending Approval

---

## Step 5: Operator — Draft Discard

- [ ] Create another draft (Save Draft on new date)
- [ ] Go to **My Drafts** → click **Discard**
- [ ] Confirm dialog → draft removed
- [ ] Navigate away and back → draft still gone (deleted from API)

---

## Step 6: Controller — Daily Review (Approve)

Login: `controller@compass.com`

- [ ] Daily Review Dashboard shows pending submissions
- [ ] KPI cards show counts (Awaiting, Approved, Rejected)
- [ ] Click **Complete Review** on a pending submission
- [ ] Verify review form shows sections A-I with Accept/Reject buttons
- [ ] Accept all 9 sections
- [ ] Click **Submit Review**
- [ ] Verify redirected to dashboard
- [ ] Verify submission now shows **Approved** status

---

## Step 7: Controller — Daily Review (Reject)

- [ ] Find another pending submission
- [ ] Click **Complete Review**
- [ ] Reject Section A with note "Values seem incorrect"
- [ ] Accept remaining sections
- [ ] Click **Submit Review**
- [ ] Verify submission shows **Rejected** status

---

## Step 8: Operator — Resubmit After Rejection

Login: `operator@compass.com`

- [ ] History table shows rejected submission with **Update** button
- [ ] Click **Update** → verify navigates to **method selector** (not directly to form)
- [ ] Select Digital Form
- [ ] Verify rejection reason banner: "Section A values seem incorrect"
- [ ] Modify Section A → Submit for Approval
- [ ] Verify status changes back to **Pending Approval**

---

## Step 9: Controller — Schedule Visit

Login: `controller@compass.com`

- [ ] Click **+ Schedule Visit**
- [ ] Select location from dropdown
- [ ] Calendar shows: past dates grayed, booked dates green dot
- [ ] **7-day block test:** If a visit exists, verify next 6 days show red dot + "not-allowed" cursor
- [ ] Hover over blocked date → tooltip shows "Blocked — must wait 7 days..."
- [ ] **DOW warning test:** Select same weekday as a recent visit → amber dot + warning banner
- [ ] Select an available date
- [ ] Select time slot (e.g., 9:00 AM)
- [ ] Click **Schedule Visit**
- [ ] Verify success screen with date + time

---

## Step 10: Controller — Complete Visit

- [ ] On dashboard, find scheduled visit → click **Mark as Completed**
- [ ] **If submission not approved:** Verify gate message "Submission must be approved..."
- [ ] **After approval:** Verify completion form opens
- [ ] Select **✓ Approve** outcome
- [ ] Sign in signature pad
- [ ] Verify **Confirm Completion** button becomes enabled
- [ ] Click **Confirm Completion**
- [ ] Verify visit status changes to **Completed**

---

## Step 11: Controller — Miss Visit

- [ ] Find another scheduled visit
- [ ] Click **Mark as Missed**
- [ ] Select reason from dropdown
- [ ] Add optional notes
- [ ] Click **Confirm**
- [ ] Verify visit status changes to **Missed**

---

## Step 12: DGM — Schedule Visit

Login: `dgm@compass.com`

- [ ] Click **+ Schedule Visit**
- [ ] Select location
- [ ] **Monthly block test:** If visit exists for this month, verify other dates in month are grayed
- [ ] Hover blocked date → tooltip shows "Blocked — visit already scheduled on X this month"
- [ ] **DOM warning test:** Select same day-of-month as recent visit → amber warning
- [ ] Select available date in a new month
- [ ] Click **Schedule Visit**
- [ ] Verify success screen

---

## Step 13: DGM — Complete Visit

- [ ] On dashboard, click **Mark as Completed** on scheduled visit
- [ ] **Gate test:** Verify "Controller must complete their visit first" if controller hasn't
- [ ] **(After controller completes):** Completion form opens
- [ ] Select **✓ Approve** or **✗ Reject** outcome
- [ ] Sign in signature pad
- [ ] Click **Confirm Completion**
- [ ] Verify completed

---

## Step 14: Regional Controller — Dashboard Review

Login: `rc@compass.com`

- [ ] **Business Dashboard:**
  - [ ] KPI cards show: Compliance Rate, Approval Rate, Cash at Risk, Variance Exceptions
  - [ ] Controller Activity section populated
  - [ ] Operator Behaviour section populated
  - [ ] Rejection Analysis section populated
  - [ ] DGM Coverage section populated

- [ ] **Cash Trends:**
  - [ ] Select Section A → daily → 30 days → chart renders
  - [ ] Switch to weekly/monthly → chart updates
  - [ ] Download CSV → file downloads
  - [ ] Change location filter → data updates

- [ ] **Reports:**
  - [ ] This Month selected by default → submission data shows
  - [ ] KPI cards: Total, Approved, Rejected, Pending counts correct
  - [ ] Date-level detail table populated
  - [ ] Switch to Week → data changes

- [ ] **Audit Trail:**
  - [ ] Events listed with timestamps
  - [ ] Filter by event type → list updates
  - [ ] Filter by location → list updates
  - [ ] Export works

---

## Step 15: Password Flows

Any role:

- [ ] Click **Change Password** in top bar
- [ ] Enter current password + new password (8+ chars)
- [ ] Verify validation: too short shows error, mismatch shows error
- [ ] Successfully change password
- [ ] Logout → login with new password → works
- [ ] Login with old password → fails

- [ ] Click **Forgot password?** on login page
- [ ] Enter email → receive OTP (check mailcatcher at :1080)
- [ ] Enter correct OTP → advance to new password form
- [ ] Set new password → success
- [ ] Login with new password → works

---

## Step 16: Responsive Check

- [ ] Open browser DevTools → toggle mobile view (375px width)
- [ ] Verify hamburger menu (☰) appears
- [ ] Click hamburger → sidebar slides in
- [ ] Click nav item → sidebar closes, page loads
- [ ] Click hamburger → sidebar opens → click ✕ → closes
- [ ] Verify content is readable, no horizontal overflow
- [ ] Switch back to desktop → sidebar always visible, no hamburger

---

## Quick Reference: Test Accounts

| Role | Email | Locations |
|------|-------|-----------|
| Operator | operator@compass.com | loc-1 |
| Controller | controller@compass.com | loc-1, loc-2, loc-3 |
| DGM | dgm@compass.com | all |
| Admin | admin@compass.com | all |
| RC | rc@compass.com | all |
| Auditor | auditor@compass.com | all |

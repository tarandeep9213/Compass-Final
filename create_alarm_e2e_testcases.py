"""
Generate the expanded Alarm System E2E Test Cases workbook.

Scope: 2 buildings (A happy, B rejection loop), 13 scenarios (A-M),
multiple testers/approvers, escalation tiers, audit log, RBAC negative,
attachment validation, draft resume, late submission, exempt buildings.

This script writes TEST CASE STEPS ONLY. Actual/Status/Evidence columns
are intentionally empty — they will be filled after the Playwright run.

Run:
    python create_alarm_e2e_testcases.py

Output:
    Alarm_E2E_TestCases.xlsx
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ── Styles ──────────────────────────────────────────────────────────────────
header_font = Font(bold=True, size=11, color="FFFFFF")
header_fill = PatternFill(start_color="1F6138", end_color="1F6138", fill_type="solid")
scenario_font = Font(bold=True, size=10, color="1F6138")
scenario_fill = PatternFill(start_color="E8F5EC", end_color="E8F5EC", fill_type="solid")
thin = Side(style="thin", color="B0B0B0")
border = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap = Alignment(wrap_text=True, vertical="top")
center = Alignment(horizontal="center", vertical="center", wrap_text=True)

HEADERS = [
    "TC_ID", "Scenario", "Stakeholder", "Screen",
    "Preconditions", "Steps", "Expected",
    "Actual", "Status", "Evidence", "Notes",
]
COL_WIDTHS = [12, 28, 14, 22, 30, 55, 50, 30, 10, 25, 25]


def style_header(ws, row=1):
    for col, h in enumerate(HEADERS, 1):
        c = ws.cell(row=row, column=col, value=h)
        c.font = header_font
        c.fill = header_fill
        c.alignment = center
        c.border = border
    for i, w in enumerate(COL_WIDTHS, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[row].height = 28
    ws.freeze_panes = "A2"


def write_row(ws, row_idx, tc):
    for col_idx, val in enumerate(tc, 1):
        c = ws.cell(row=row_idx, column=col_idx, value=val)
        c.alignment = wrap
        c.border = border


# ── Test Cases ──────────────────────────────────────────────────────────────
# Each TC is a dict; Actual/Status/Evidence are empty strings (filled later).
def tc(tc_id, scenario, stakeholder, screen, preconditions, steps, expected, notes=""):
    return (tc_id, scenario, stakeholder, screen, preconditions, steps, expected,
            "", "", "", notes)


test_cases = []

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO A — Building A Happy Path
# ═══════════════════════════════════════════════════════════════════════════
SA = "A — Building A Happy Path"

test_cases += [
    tc("TC-A-01", SA, "Admin", "Login",
       "Admin account `alarmadmin@alarm.compass.com` exists (seeded).",
       "1. Navigate to /login\n2. Enter email: alarmadmin@alarm.compass.com\n3. Password: demo1234\n4. Click Sign In",
       "Logged in. Redirected to Alarm Admin dashboard."),
    tc("TC-A-02", SA, "Admin", "Building Setup",
       "Admin logged in.",
       "1. Navigate to Alarm → Building Setup\n2. Click '+ Add Building'\n3. Name: 'Building A — Central'\n4. Region: 'North'\n5. Security Company: 'ShieldPro Ltd'\n6. Customer ID: 'SP-A-001'\n7. Phone: '+44 20 7000 0001'\n8. Status: Active\n9. Assign Tester: Tara Tester (tester@alarm.compass.com)\n10. Assign Approver: Aaron Approver (approver@alarm.compass.com)\n11. Save",
       "Building A saved. Appears in buildings table with status=Active and correct assignments. KPI 'Active' incremented by 1."),
    tc("TC-A-03", SA, "Admin", "Zone Config",
       "Building A exists.",
       "1. Navigate to Zone Config\n2. Select 'Building A — Central'\n3. Add 10 zones:\n  Z1 Front Door / ENTRY_EXIT / Area 1\n  Z2 Back Door / ENTRY_EXIT / Area 1\n  Z3 Lobby Motion / INTERIOR_MOTION / Area 2\n  Z4 Corridor Motion / INTERIOR_MOTION / Area 2\n  Z5 Panic Reception / PANIC_SILENT / Area 1\n  Z6 Panic Office / PANIC_SILENT / Area 3\n  Z7 Holdup Cashier / HOLDUP / Area 1\n  Z8 Fire Floor 1 / FIRE_SMOKE / Area 4\n  Z9 Fire Floor 2 / FIRE_SMOKE / Area 4\n  Z10 Warehouse Camera / OTHER / Area 5",
       "All 10 zones listed for Building A. Type breakdown: 2 Entry, 2 Motion, 2 Panic, 1 Holdup, 2 Fire, 1 Other."),
    tc("TC-A-04", SA, "Admin", "User Management",
       "Admin on User Management screen.",
       "1. Verify 'tester@alarm.compass.com' exists as ALARM_TESTER, active\n2. Verify 'approver@alarm.compass.com' exists as ALARM_APPROVER, active",
       "Both seeded users visible and active."),
    tc("TC-A-05", SA, "Admin", "User Access",
       "Tester A & Approver 1 exist.",
       "1. Navigate to User Access\n2. Grant Tester A (tester@alarm.compass.com) → Building A\n3. Grant Approver 1 (approver@alarm.compass.com) → Building A\n4. Save",
       "Grants saved. Access table shows Tester A and Approver 1 linked to Building A."),
    tc("TC-A-06", SA, "Admin", "Compliance Rules",
       "Admin on Compliance Rules screen.",
       "1. Set monthly_deadline_day = 25\n2. Set approval_sla_days = 5\n3. Set Tier 1 = 7 days before deadline (recipients: TESTER)\n4. Set Tier 2 = 0 days (TESTER, APPROVER)\n5. Set Tier 3 = +3 days (TESTER, APPROVER, REGIONAL_CONTROLLER)\n6. Biannual cellular = 6 months; camera = 30 days\n7. Biannual tiers: T1=+7d, T2=+14d, T3=+30d\n8. Save",
       "Rules saved. Audit log entry RULES_UPDATED recorded with actor=admin."),
    tc("TC-A-07", SA, "Tester A", "Login",
       "Grant exists for Building A.",
       "1. Logout admin\n2. Login as tester@alarm.compass.com / demo1234",
       "Tester A dashboard loads. Only Building A visible in building picker."),
    tc("TC-A-08", SA, "Tester A", "Test Form",
       "Tester A logged in.",
       "1. Navigate to Alarm → Monthly Test\n2. Select 'Building A — Central'\n3. Open new test for current month\n4. Mark Z1-Z10 ALL as TESTED with a note per zone (e.g., 'Sensor responded OK')",
       "Zone summary: 10 TESTED, 0 NOT_TESTED, 0 ISSUE_FOUND."),
    tc("TC-A-09", SA, "Tester A", "Test Form (Biannual)",
       "Monthly test in progress.",
       "1. Switch to Biannual tab\n2. Cellular Backup: result=PASS, signal='4/5 bars', notes='Signal test OK'\n3. Camera Backup: result=PASS, days_verified=30, notes='All 30 days of footage verified'\n4. Save biannual",
       "Both biannual checks saved with status SUBMITTED / Compliant."),
    tc("TC-A-10", SA, "Tester A", "Upload",
       "Monthly + biannual ready.",
       "1. Upload security report (valid PDF, ~1 MB)\n2. Upload biannual evidence (PNG + PDF)",
       "All attachments accepted, visible in attachments list with correct file name/size/type."),
    tc("TC-A-11", SA, "Tester A", "Test Form",
       "All zones + biannual + docs complete.",
       "1. Click 'Submit for Approval'\n2. Confirm dialog",
       "Status changes to SUBMITTED. Redirect to History. Audit log: TEST_SUBMITTED, FILE_UPLOADED x N."),
    tc("TC-A-12", SA, "Approver 1", "Approval Queue",
       "Tester A has submitted.",
       "1. Logout\n2. Login as approver@alarm.compass.com / demo1234\n3. Navigate to Approvals",
       "Building A monthly test shows in Pending queue with 10/10 tested and 3 attachments."),
    tc("TC-A-13", SA, "Approver 1", "Review",
       "Approver viewing pending test.",
       "1. Click 'Review'\n2. Inspect zone list, attachments, biannual section",
       "Review page renders all 10 zones TESTED, biannual PASS + PASS, attachments downloadable."),
    tc("TC-A-14", SA, "Approver 1", "Approval",
       "Review looks good.",
       "1. Click 'Approve Test'\n2. Enter approval note: 'All zones verified, docs complete'\n3. Confirm",
       "Status = APPROVED. approved_by=Approver 1, approved_at populated. Audit: TEST_APPROVED."),
    tc("TC-A-15", SA, "Admin", "Audit Trail",
       "Building A flow complete.",
       "1. Logout approver\n2. Login as admin\n3. Navigate to Audit Trail\n4. Filter building = Building A",
       "All events present: BUILDING_ADDED, ZONE_ADDED x10, ACCESS_GRANTED x2, RULES_UPDATED, TEST_SUBMITTED, FILE_UPLOADED x3, TEST_APPROVED. Each row shows actor + timestamp."),
    tc("TC-A-16", SA, "Admin", "Escalation (negative)",
       "Building A test approved before deadline.",
       "1. Invoke escalation job with mocked_today = deadline\n2. Check MailCatcher inbox",
       "NO email sent for Building A. Audit log: ESCALATION_SKIPPED (already approved)."),
    tc("TC-A-17", SA, "Tester A", "History",
       "Approved test exists.",
       "1. Login as Tester A\n2. Navigate to History\n3. Filter Approved",
       "Approved test visible with View button (no Edit). Status badge = green."),
    tc("TC-A-18", SA, "RC", "Alarm Overview (read-only)",
       "At least one approved test exists.",
       "1. Login as rc@compass.com / demo1234\n2. Navigate to Alarm Overview",
       "Building A shows 'Compliant' tile. KPI totals updated. Drill-down renders."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO B — Building B Rejection Loop (6 cycles)
# ═══════════════════════════════════════════════════════════════════════════
SB = "B — Building B Rejection Loop"

test_cases += [
    tc("TC-B-01", SB, "Admin", "Building Setup",
       "Admin logged in.",
       "1. Click '+ Add Building'\n2. Name='Building B — Harbor'\n3. Region='South'\n4. Security Company='GuardWell'\n5. Customer ID='GW-B-002'\n6. Phone='+44 20 7000 0002'\n7. Status=Active\n8. Save (assignments done in later step)",
       "Building B saved."),
    tc("TC-B-02", SB, "Admin", "Zone Config",
       "Building B exists.",
       "1. Select Building B\n2. Add 10 zones: Z1-Z2 ENTRY_EXIT, Z3-Z4 INTERIOR_MOTION, Z5-Z6 PANIC_SILENT, Z7 HOLDUP, Z8-Z9 FIRE_SMOKE, Z10 OTHER",
       "10 zones visible."),
    tc("TC-B-03", SB, "Admin", "User Management",
       "Admin on User Management.",
       "1. Click '+ Add User'\n2. Name='Ben Tester'\n3. Email='tester_b@alarm.compass.com'\n4. Role=ALARM_TESTER\n5. Password=demo1234\n6. Save",
       "Tester B created, active."),
    tc("TC-B-04", SB, "Admin", "User Access",
       "Tester B exists.",
       "1. Grant Tester B → Building B\n2. Grant Approver 1 → Building B\n3. Save",
       "Grants active."),
    # Cycle 1
    tc("TC-B-05", SB, "Tester B", "Test Form",
       "Tester B logged in, Building B available.",
       "1. New monthly test for Building B\n2. Z1-Z5 = TESTED\n3. Z6-Z8 = NOT_TESTED (note='sensor access blocked')\n4. Z9-Z10 = ISSUE_FOUND (Z9 note='fire panel beeping', Z10 note='camera offline')\n5. Biannual: empty\n6. No attachments\n7. Submit",
       "Submitted. Status=SUBMITTED. Summary 5/3/2."),
    tc("TC-B-06", SB, "Approver 1", "Review",
       "Building B test submitted (cycle 1).",
       "1. Open Approvals\n2. Click Review on Building B",
       "Review shows 5 TESTED, 3 NOT_TESTED, 2 ISSUE_FOUND with Tester B's notes. Biannual missing. No attachments."),
    tc("TC-B-07", SB, "Approver 1", "Approval (Reject)",
       "Cycle 1 review open.",
       "1. Click 'Reject'\n2. Reason='Non-tested zones present — please test Z6, Z7, Z8.'\n3. Confirm",
       "Status=REJECTED. Tester B sees rejection banner with reason."),
    # Cycle 2
    tc("TC-B-08", SB, "Tester B", "Test Form",
       "Rejection received.",
       "1. Open rejected test\n2. Re-mark: Z1-Z5=TESTED, Z6-Z10=ISSUE_FOUND (each with distinct remediation reason — 'Z6: stuck panic button', 'Z7: cable fault', 'Z8: panel intermittent', 'Z9: firmware issue', 'Z10: PSU failure')\n3. Biannual: still empty\n4. Submit",
       "Status=SUBMITTED again. Summary 5/0/5."),
    tc("TC-B-09", SB, "Approver 1", "Review",
       "Cycle 2 submitted.",
       "1. Open review",
       "All 5 ISSUE_FOUND reasons exactly as Tester B entered them are shown in review (reason carry-through test)."),
    tc("TC-B-10", SB, "Approver 1", "Approval (Reject)",
       "Cycle 2 review open.",
       "1. Reject with reason='Too many issues — address at least 3 issues before resubmission.'",
       "Rejected. Audit log has rejection #2 reason captured."),
    # Cycle 3
    tc("TC-B-11", SB, "Tester B", "Test Form",
       "Cycle 2 rejected.",
       "1. Re-mark all Z1-Z10 = TESTED (issues now resolved per remediation notes)\n2. Biannual: still empty\n3. Submit",
       "Submitted. 10/0/0 but biannual missing."),
    tc("TC-B-12", SB, "Approver 1", "Approval (Reject)",
       "Cycle 3 review open.",
       "1. Reject with reason='Biannual check is missing — please fill cellular + camera.'",
       "Rejected. Third rejection reason recorded in audit."),
    # Cycle 4
    tc("TC-B-13", SB, "Tester B", "Test Form (Biannual)",
       "Cycle 3 rejected.",
       "1. Fill biannual cellular = PASS, camera = PASS\n2. Do NOT upload biannual evidence\n3. Resubmit",
       "Submitted with biannual filled but no biannual attachments."),
    tc("TC-B-14", SB, "Approver 1", "Approval (Reject)",
       "Cycle 4 review open.",
       "1. Reject with reason='Biannual evidence documents not uploaded.'",
       "Rejected. Fourth reason recorded."),
    # Cycle 5
    tc("TC-B-15", SB, "Tester B", "Upload",
       "Cycle 4 rejected.",
       "1. Upload biannual evidence PDFs (cellular log + camera footage screenshots)\n2. Do NOT upload monthly security report\n3. Resubmit",
       "Submitted. Biannual attachments visible."),
    tc("TC-B-16", SB, "Approver 1", "Approval (Reject)",
       "Cycle 5 review open.",
       "1. Reject with reason='Monthly security report not uploaded.'",
       "Rejected. Fifth reason recorded."),
    # Cycle 6 — approval
    tc("TC-B-17", SB, "Tester B", "Upload",
       "Cycle 5 rejected.",
       "1. Upload security report PDF\n2. Resubmit",
       "Submitted. All evidence present."),
    tc("TC-B-18", SB, "Approver 1", "Approval (Approve)",
       "Cycle 6 review open.",
       "1. Review — all 10 TESTED, biannual complete, all docs attached\n2. Approve\n3. Note='All required evidence provided.'",
       "Status=APPROVED. Building B compliant for this month."),
    tc("TC-B-19", SB, "Admin", "Audit Trail",
       "Cycle 6 complete.",
       "1. Filter audit by Building B\n2. Scroll through history",
       "Audit shows all 5 distinct rejection reasons in order, plus final approval. Rejection reasons are fully readable (not truncated)."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO C — Issues with Remediation (Happy Path variant)
# ═══════════════════════════════════════════════════════════════════════════
SC = "C — Issues with Remediation (Accepted)"

test_cases += [
    tc("TC-C-01", SC, "Tester A", "Test Form",
       "Building A exists; next month test.",
       "1. New test for Building A (next cycle)\n2. Z1-Z8=TESTED\n3. Z9=ISSUE_FOUND note='Fire Floor 2: smoke sensor false-alarmed during test. Work order WO-9012 logged, contractor scheduled for {date+7}.'\n4. Z10=ISSUE_FOUND note='Camera: 2h recording gap. Replacement drive approved, ETA {date+3}.'",
       "Summary 8/0/2 with rich remediation notes."),
    tc("TC-C-02", SC, "Tester A", "Upload",
       "Test with issues in progress.",
       "1. Upload monthly report\n2. Upload 2 evidence photos (one per issue)\n3. Submit",
       "Submitted with 2 issues + photos."),
    tc("TC-C-03", SC, "Approver 1", "Review",
       "Submitted.",
       "1. Review — confirm issues have remediation plans + photos + work order numbers",
       "All remediation metadata visible: plan text, photos inline, WO reference."),
    tc("TC-C-04", SC, "Approver 1", "Approval (Approve)",
       "Review complete.",
       "1. Approve with note='Issues tracked with WO. Approved contingent on remediation by {date+7}.'",
       "APPROVED. Audit log shows approval WITH issues accepted."),
    tc("TC-C-05", SC, "RC", "Alarm Overview",
       "Approved with issues.",
       "1. Login as RC\n2. Check Building A tile",
       "Tile shows 'Compliant' but with issue indicator (e.g., amber dot) noting 2 open issues."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO D — Tester Handoff (mid-cycle)
# ═══════════════════════════════════════════════════════════════════════════
SD = "D — Tester Handoff Mid-Cycle"

test_cases += [
    tc("TC-D-01", SD, "Tester B", "Test Form (Draft)",
       "Building B next-month cycle.",
       "1. Login as Tester B\n2. Start new test, mark Z1-Z4 TESTED, save as Draft\n3. Logout",
       "Draft saved. Status=DRAFT. Zone progress persisted server-side."),
    tc("TC-D-02", SD, "Admin", "User Management",
       "Tester B has draft.",
       "1. Login as admin\n2. Open Tester B record\n3. Set active=false\n4. Save",
       "Tester B deactivated."),
    tc("TC-D-03", SD, "Tester B", "Login",
       "Tester B deactivated.",
       "1. Attempt login as tester_b@alarm.compass.com",
       "Login blocked. Error: 'Account inactive' or equivalent."),
    tc("TC-D-04", SD, "Admin", "User Management + Access",
       "Tester B inactive.",
       "1. Create Tester C: name='Carla Tester', email='tester_c@alarm.compass.com', role=ALARM_TESTER, password=demo1234\n2. Navigate to User Access\n3. Grant Tester C → Building B\n4. (Revoke Tester B grant optional)",
       "Tester C created and granted Building B."),
    tc("TC-D-05", SD, "Tester C", "Test Form",
       "Tester C granted.",
       "1. Login as Tester C\n2. Open Building B monthly test",
       "Tester C sees Tester B's existing DRAFT with Z1-Z4 TESTED preserved."),
    tc("TC-D-06", SD, "Tester C", "Test Form",
       "Draft resumed.",
       "1. Complete Z5-Z10=TESTED\n2. Fill biannual\n3. Upload report\n4. Submit",
       "Submitted as Tester C. submitted_by=Tester C."),
    tc("TC-D-07", SD, "Admin", "Audit Trail",
       "Handoff complete.",
       "1. Filter audit by Building B\n2. Look for USER_DEACTIVATED + ACCESS_GRANTED events",
       "Audit log records: USER_DEACTIVATED (Tester B) by Admin, USER_CREATED (Tester C), ACCESS_GRANTED (Tester C→B), TEST_SUBMITTED by Tester C."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO E — Approver Reassignment Mid-Cycle
# ═══════════════════════════════════════════════════════════════════════════
SE = "E — Approver Reassignment Mid-Cycle"

test_cases += [
    tc("TC-E-01", SE, "Tester A", "Test Form",
       "Fresh cycle for Building A.",
       "1. Login as Tester A\n2. Submit a new monthly test (10 TESTED + biannual + docs)",
       "Pending test exists awaiting Approver 1."),
    tc("TC-E-02", SE, "Admin", "User Management",
       "Pending test exists.",
       "1. Create Approver 2: name='Alex Approver 2', email='approver_2@alarm.compass.com', role=ALARM_APPROVER",
       "Approver 2 created."),
    tc("TC-E-03", SE, "Admin", "Building Setup",
       "Approver 2 exists.",
       "1. Edit Building A\n2. Change Assigned Approver from Approver 1 → Approver 2\n3. Save",
       "Building A.assigned_approver = Approver 2. Audit: BUILDING_UPDATED."),
    tc("TC-E-04", SE, "Approver 1", "Approval Queue",
       "Reassigned.",
       "1. Login as Approver 1\n2. Open Approvals",
       "Building A pending test NO LONGER visible to Approver 1."),
    tc("TC-E-05", SE, "Approver 2", "Approval Queue",
       "Reassigned.",
       "1. Login as Approver 2\n2. Open Approvals",
       "Building A pending test IS visible to Approver 2."),
    tc("TC-E-06", SE, "Approver 2", "Approval (Approve)",
       "Approver 2 reviewing.",
       "1. Review and Approve",
       "Approved by Approver 2. approved_by=Approver 2 ID."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO F — RBAC Negative
# ═══════════════════════════════════════════════════════════════════════════
SF = "F — RBAC Negative"

test_cases += [
    tc("TC-F-01", SF, "Admin", "User Management",
       "Admin logged in.",
       "1. Create Tester Unauth: email='tester_unauth@alarm.compass.com', role=ALARM_TESTER, NO building grants\n2. Create Approver Unauth: email='approver_unauth@alarm.compass.com', role=ALARM_APPROVER, NO grants",
       "Both users created with zero grants."),
    tc("TC-F-02", SF, "Tester Unauth", "Dashboard",
       "No grants.",
       "1. Login as tester_unauth",
       "Dashboard loads. Building picker EMPTY. Message 'No buildings assigned'."),
    tc("TC-F-03", SF, "Tester Unauth", "API direct",
       "No grants.",
       "1. Using browser devtools, call POST /v1/alarm/tests with body for Building A\n2. Record response",
       "API returns 403 Forbidden. No row created."),
    tc("TC-F-04", SF, "Approver Unauth", "Approval Queue",
       "No grants.",
       "1. Login as approver_unauth\n2. Open Approvals",
       "Queue empty. Building A/B invisible."),
    tc("TC-F-05", SF, "Approver Unauth", "API direct",
       "No grants.",
       "1. Call POST /v1/alarm/tests/{id}/approve directly for an existing Building A test",
       "403 Forbidden. DB untouched."),
    tc("TC-F-06", SF, "Tester A", "Test Form",
       "Tester A granted Building A only.",
       "1. Attempt to open test form for Building B via direct URL/API",
       "403 or empty — Building B not visible/accessible."),
    tc("TC-F-07", SF, "Tester A", "Admin screens",
       "Tester role only.",
       "1. Attempt direct URL to /alarm/admin/building-setup",
       "Redirected / 403. Admin screens unreachable for tester."),
    tc("TC-F-08", SF, "Approver 1", "Admin screens",
       "Approver role only.",
       "1. Attempt direct URL to /alarm/admin/compliance-rules",
       "Redirected / 403."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO G — Monthly Escalation Tiers
# ═══════════════════════════════════════════════════════════════════════════
SG = "G — Monthly Escalation (Tier 1/2/3)"

test_cases += [
    tc("TC-G-01", SG, "Admin", "Compliance Rules",
       "Rules configured in TC-A-06. Mailcatcher running.",
       "1. Verify monthly Tier 1=7d before, Tier 2=0d, Tier 3=+3d\n2. Purge MailCatcher inbox",
       "Rules verified, inbox empty."),
    tc("TC-G-02", SG, "System", "Escalation Job",
       "Building B has NO submission for target month.",
       "1. Invoke escalation job with mocked_today = deadline - 7 days",
       "Tier 1 email fires."),
    tc("TC-G-03", SG, "—", "MailCatcher",
       "Tier 1 fired.",
       "1. Read MailCatcher inbox\n2. Assert recipients + subject + body",
       "Exactly 1 email: To=tester_b@alarm.compass.com, Subject contains 'Tier 1', body includes Building B name + deadline date."),
    tc("TC-G-04", SG, "System", "Escalation Job",
       "Still no submission.",
       "1. Invoke job with mocked_today = deadline (Tier 2 day)",
       "Tier 2 email fires."),
    tc("TC-G-05", SG, "—", "MailCatcher",
       "Tier 2 fired.",
       "1. Read inbox",
       "Email: To=tester_b + approver@alarm.compass.com (2 recipients). Subject 'Tier 2'."),
    tc("TC-G-06", SG, "System", "Escalation Job",
       "Still no submission.",
       "1. Invoke job with mocked_today = deadline + 3 days",
       "Tier 3 email fires."),
    tc("TC-G-07", SG, "—", "MailCatcher",
       "Tier 3 fired.",
       "1. Read inbox",
       "Email: To=tester_b + approver + rc@compass.com (3 recipients). Subject 'Tier 3'. Body notes 'escalated to Regional Controller'."),
    tc("TC-G-08", SG, "System", "Escalation Job (de-dup)",
       "Tier 1 already fired today.",
       "1. Re-invoke job same mocked day as Tier 1",
       "No duplicate email sent. MailCatcher count unchanged."),
    tc("TC-G-09", SG, "Admin", "Audit Trail",
       "All 3 tiers fired.",
       "1. Filter audit by Building B, action=ESCALATION_SENT",
       "3 rows: Tier 1, Tier 2, Tier 3 with correct recipient list and timestamps."),
    tc("TC-G-10", SG, "Approver 1", "Escalation Screen",
       "Tier 2 active.",
       "1. Login as Approver 1\n2. Navigate to Escalation screen",
       "Building B appears in overdue queue with Tier 2 badge."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO H — Biannual Escalation Tiers
# ═══════════════════════════════════════════════════════════════════════════
SH = "H — Biannual Escalation (Tier 1/2/3)"

test_cases += [
    tc("TC-H-01", SH, "Admin", "Compliance Rules",
       "Biannual tiers set: T1=+7d, T2=+14d, T3=+30d.",
       "1. Verify biannual config\n2. Purge MailCatcher",
       "Config verified, inbox clean."),
    tc("TC-H-02", SH, "System", "Escalation Job",
       "Building B has no current biannual (due date in past).",
       "1. Invoke biannual escalation with mocked_today = due + 7",
       "Tier 1 biannual email fires."),
    tc("TC-H-03", SH, "—", "MailCatcher",
       "T1 fired.",
       "1. Read inbox",
       "Recipients: tester_b + approver@alarm.compass.com. Subject 'Biannual Tier 1'."),
    tc("TC-H-04", SH, "System", "Escalation Job",
       "Still overdue.",
       "1. Invoke with mocked_today = due + 14",
       "Tier 2 biannual email fires."),
    tc("TC-H-05", SH, "—", "MailCatcher",
       "T2 fired.",
       "1. Read inbox",
       "Recipients: tester_b + approver + rc@compass.com. Subject 'Biannual Tier 2'."),
    tc("TC-H-06", SH, "System", "Escalation Job",
       "Still overdue.",
       "1. Invoke with mocked_today = due + 30",
       "Tier 3 biannual email fires."),
    tc("TC-H-07", SH, "—", "MailCatcher",
       "T3 fired.",
       "1. Read inbox",
       "Recipients: tester_b + approver + rc + dgm@compass.com (4 recipients). Subject 'Biannual Tier 3'."),
    tc("TC-H-08", SH, "Admin", "Audit Trail",
       "Biannual escalation complete.",
       "1. Filter audit by action=BIANNUAL_ESCALATION_SENT",
       "3 rows with correct recipient expansion per tier."),
    tc("TC-H-09", SH, "DGM", "Alarm Management",
       "Tier 3 biannual fired.",
       "1. Login as dgm@compass.com\n2. Open Biannual Status page",
       "Building B visible in DGM's non-compliant biannual tile."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO I — Audit Log Assertions
# ═══════════════════════════════════════════════════════════════════════════
SI = "I — Audit Log Integrity"

test_cases += [
    tc("TC-I-01", SI, "Admin", "Audit Trail",
       "All prior scenarios executed.",
       "1. Login as admin\n2. Open Audit Trail",
       "Audit rows render without error. Pagination works."),
    tc("TC-I-02", SI, "Admin", "Audit Trail",
       "Audit Trail open.",
       "1. Filter by Building A",
       "Only Building A events visible. Count matches expected (≈ setup + Scenario A + C + E events)."),
    tc("TC-I-03", SI, "Admin", "Audit Trail",
       "Audit Trail open.",
       "1. Filter by Building B",
       "Only Building B events visible. 5 distinct rejection reasons visible (Scenario B). Handoff events visible (Scenario D)."),
    tc("TC-I-04", SI, "Admin", "Audit Trail",
       "Audit Trail open.",
       "1. Filter by user=Tester B",
       "All Tester B actions (submits, resubmits, deactivation) present."),
    tc("TC-I-05", SI, "Admin", "Audit Trail",
       "Audit rows exist.",
       "1. For one event row, confirm: actor_email, actor_role, action, category, details_json, timestamp, ip (if tracked)",
       "All metadata populated."),
    tc("TC-I-06", SI, "Admin", "API immutability",
       "Audit row exists.",
       "1. Attempt DELETE /v1/alarm/audit/{id} or PATCH\n2. Record response",
       "405 Method Not Allowed OR 403. Row unchanged in DB."),
    tc("TC-I-07", SI, "Admin", "Audit Trail export",
       "Audit Trail open.",
       "1. Click 'Export CSV' (if available)",
       "CSV downloads with correct columns & rows."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO J — Attachment Validation
# ═══════════════════════════════════════════════════════════════════════════
SJ = "J — Attachment Validation"

test_cases += [
    tc("TC-J-01", SJ, "Tester A", "Upload",
       "Tester A on test form.",
       "1. Attempt to upload 'malware.exe'",
       "Upload rejected with friendly error listing allowed types (PDF/Excel/image)."),
    tc("TC-J-02", SJ, "Tester A", "Upload",
       "On test form.",
       "1. Attempt to upload a 60 MB PDF (over size cap)",
       "Upload rejected with 'File too large' error. Configured cap surfaced."),
    tc("TC-J-03", SJ, "Tester A", "Upload",
       "On test form.",
       "1. Attempt to upload a 0-byte PDF",
       "Upload rejected with 'Empty file' error."),
    tc("TC-J-04", SJ, "Tester A", "Upload",
       "On test form.",
       "1. Upload a valid PDF",
       "Accepted. Appears in attachments list."),
    tc("TC-J-05", SJ, "Tester A", "Upload",
       "On test form.",
       "1. Upload a valid XLSX",
       "Accepted."),
    tc("TC-J-06", SJ, "Tester A", "Upload",
       "On test form.",
       "1. Upload a valid JPG",
       "Accepted."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO K — Draft Save & Resume Across Sessions
# ═══════════════════════════════════════════════════════════════════════════
SK = "K — Draft Save & Resume"

test_cases += [
    tc("TC-K-01", SK, "Tester A", "Test Form",
       "Fresh cycle.",
       "1. Start new test for Building A\n2. Mark Z1-Z4 TESTED with distinctive notes ('Resume-Test-Note-1'…'Resume-Test-Note-4')\n3. Save draft (or rely on autosave)",
       "Draft persisted. Status=DRAFT. Zones 1-4 marked."),
    tc("TC-K-02", SK, "Tester A", "Logout",
       "Draft saved.",
       "1. Click logout",
       "Session ended."),
    tc("TC-K-03", SK, "Tester A", "Login + Test Form",
       "After logout.",
       "1. Login again\n2. Open draft for Building A",
       "Draft re-opens. Z1-Z4 still marked with the distinctive notes."),
    tc("TC-K-04", SK, "Tester A", "Test Form",
       "Draft resumed.",
       "1. Mark Z5-Z10 TESTED\n2. Complete biannual + upload\n3. Submit",
       "Submitted with all 10 zones and original notes intact."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO L — Late Submission Flag
# ═══════════════════════════════════════════════════════════════════════════
SL = "L — Late Submission Flag"

test_cases += [
    tc("TC-L-01", SL, "Tester B", "Test Form",
       "Mock today = deadline + 2 days.",
       "1. Submit a full valid test for Building B after deadline",
       "Submission accepted but audit row carries 'LATE' flag."),
    tc("TC-L-02", SL, "Approver 1", "Review",
       "Late test pending.",
       "1. Open review",
       "UI shows 'Submitted Late' badge with days-late count."),
    tc("TC-L-03", SL, "Admin", "Audit Trail",
       "Late submission recorded.",
       "1. Filter action=TEST_SUBMITTED_LATE",
       "Row visible with days-late detail."),
]

# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO M — Building Status = Exempt
# ═══════════════════════════════════════════════════════════════════════════
SM = "M — Building Status Exempt"

test_cases += [
    tc("TC-M-01", SM, "Admin", "Building Setup",
       "Building A currently Active.",
       "1. Edit Building A\n2. Set status=Exempt\n3. Save",
       "Building A status=Exempt. Audit: BUILDING_STATUS_CHANGED."),
    tc("TC-M-02", SM, "System", "Escalation Job",
       "Exempt + past deadline.",
       "1. Invoke escalation job with mocked_today = deadline + 3",
       "No email fired for Building A. Active buildings still processed."),
    tc("TC-M-03", SM, "—", "MailCatcher",
       "Job ran.",
       "1. Inspect inbox",
       "Zero emails for Building A. Emails for active buildings still present."),
    tc("TC-M-04", SM, "Admin", "Audit Trail",
       "Exempt skip.",
       "1. Filter audit by Building A, action=ESCALATION_SKIPPED",
       "Row with reason='exempt'."),
    tc("TC-M-05", SM, "Admin", "Building Setup",
       "Test complete.",
       "1. Revert Building A status to Active",
       "Status=Active again. Audit updated."),
]


# ── Write Test Cases sheet ──────────────────────────────────────────────────
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Test Cases"
style_header(ws)

for idx, row in enumerate(test_cases, 2):
    write_row(ws, idx, row)

# Add autofilter
ws.auto_filter.ref = f"A1:{get_column_letter(len(HEADERS))}{len(test_cases) + 1}"

# ── Overview sheet ──────────────────────────────────────────────────────────
ws_ov = wb.create_sheet("Overview", 0)
ws_ov.column_dimensions["A"].width = 22
ws_ov.column_dimensions["B"].width = 80

rows = [
    ("Project", "Compass Alarm Monitoring — E2E Test Suite"),
    ("Scope", "13 scenarios (A-M), 2 buildings, ~120 test cases"),
    ("Framework", "Playwright (spec: frontend/e2e/alarm-comprehensive.spec.ts — to be written)"),
    ("Email capture", "backend/mailcatcher.py (local SMTP)"),
    ("Password for all seeded/test accounts", "demo1234"),
    ("", ""),
    ("── STAKEHOLDERS ──", ""),
    ("Admin", "alarmadmin@alarm.compass.com (seeded, ALARM_ADMIN)"),
    ("Tester A", "tester@alarm.compass.com (seeded, ALARM_TESTER) — Building A"),
    ("Tester B", "tester_b@alarm.compass.com (created in test, ALARM_TESTER) — Building B"),
    ("Tester C", "tester_c@alarm.compass.com (created, ALARM_TESTER) — Handoff"),
    ("Tester Unauth", "tester_unauth@alarm.compass.com (created) — RBAC negative"),
    ("Approver 1", "approver@alarm.compass.com (seeded, ALARM_APPROVER) — shared A+B"),
    ("Approver 2", "approver_2@alarm.compass.com (created) — reassignment"),
    ("Approver Unauth", "approver_unauth@alarm.compass.com (created) — RBAC negative"),
    ("Regional Controller", "rc@compass.com (seeded) — Tier 3 recipient"),
    ("DGM", "dgm@compass.com (seeded) — Tier 3 biannual recipient"),
    ("", ""),
    ("── SCENARIOS ──", ""),
    ("A", "Building A Happy Path — Admin setup, 10 zones, full approval"),
    ("B", "Building B Rejection Loop — 6 cycles with distinct reasons"),
    ("C", "Issues with Remediation (Accepted)"),
    ("D", "Tester Handoff Mid-Cycle"),
    ("E", "Approver Reassignment Mid-Cycle"),
    ("F", "RBAC Negative"),
    ("G", "Monthly Escalation Tier 1/2/3"),
    ("H", "Biannual Escalation Tier 1/2/3"),
    ("I", "Audit Log Integrity"),
    ("J", "Attachment Validation"),
    ("K", "Draft Save & Resume"),
    ("L", "Late Submission Flag"),
    ("M", "Building Status Exempt"),
    ("", ""),
    ("── USAGE ──", ""),
    ("1. Run", "python create_alarm_e2e_testcases.py  (regenerates this workbook)"),
    ("2. Execute", "Playwright suite (not yet written) populates Actual/Status/Evidence"),
    ("3. Review", "Open 'Test Cases' sheet, filter by Status=Fail for triage"),
]
for r_idx, (k, v) in enumerate(rows, 1):
    a = ws_ov.cell(row=r_idx, column=1, value=k)
    b = ws_ov.cell(row=r_idx, column=2, value=v)
    a.alignment = wrap
    b.alignment = wrap
    if k.startswith("──") or k == "Project":
        a.font = Font(bold=True, color="1F6138")

# ── Escalation Emails sheet ─────────────────────────────────────────────────
ws_em = wb.create_sheet("Escalation Emails")
em_headers = ["Flow", "Tier", "Trigger (vs deadline/due)", "Recipients", "Subject (expected)", "Body Key Content"]
for col, h in enumerate(em_headers, 1):
    c = ws_em.cell(row=1, column=col, value=h)
    c.font = header_font
    c.fill = header_fill
    c.alignment = center
    c.border = border
em_widths = [15, 8, 28, 45, 40, 55]
for i, w in enumerate(em_widths, 1):
    ws_em.column_dimensions[get_column_letter(i)].width = w

em_rows = [
    ("Monthly", "T1", "Deadline − 7 days", "Tester (Tester B)",
     "[Alarm] Upcoming test deadline — Tier 1",
     "Building name, deadline date, link to test form"),
    ("Monthly", "T2", "Deadline (day of)", "Tester + Approver",
     "[Alarm] Test due today — Tier 2",
     "Building name, deadline = today, call-to-submit"),
    ("Monthly", "T3", "Deadline + 3 days", "Tester + Approver + RC",
     "[Alarm] Overdue test — Tier 3 escalated to RC",
     "Building name, days overdue, RC visibility note"),
    ("Biannual", "T1", "Due + 7 days", "Tester + Approver",
     "[Alarm] Biannual check overdue — Tier 1",
     "Check type (cellular/camera), due date, days overdue"),
    ("Biannual", "T2", "Due + 14 days", "Tester + Approver + RC",
     "[Alarm] Biannual check overdue — Tier 2 (RC)",
     "Same + RC escalation language"),
    ("Biannual", "T3", "Due + 30 days", "Tester + Approver + RC + DGM",
     "[Alarm] Biannual check overdue — Tier 3 (DGM)",
     "Same + DGM escalation language"),
]
for r_idx, row in enumerate(em_rows, 2):
    for c_idx, val in enumerate(row, 1):
        c = ws_em.cell(row=r_idx, column=c_idx, value=val)
        c.alignment = wrap
        c.border = border

# ── Audit Log Expectations sheet ────────────────────────────────────────────
ws_au = wb.create_sheet("Audit Log Expectations")
au_headers = ["Scenario", "Action", "Actor", "Must Include in Details"]
for col, h in enumerate(au_headers, 1):
    c = ws_au.cell(row=1, column=col, value=h)
    c.font = header_font
    c.fill = header_fill
    c.alignment = center
    c.border = border
for i, w in enumerate([20, 30, 22, 55], 1):
    ws_au.column_dimensions[get_column_letter(i)].width = w

au_rows = [
    ("A", "BUILDING_ADDED", "Admin", "building_name, region"),
    ("A", "ZONE_ADDED x10", "Admin", "zone_number, zone_type, area"),
    ("A", "ACCESS_GRANTED x2", "Admin", "user_email, access_type, building_id"),
    ("A", "RULES_UPDATED", "Admin", "monthly_deadline_day, tiers, biannual config"),
    ("A", "TEST_SUBMITTED", "Tester A", "test_id, zones_total, zones_tested"),
    ("A", "FILE_UPLOADED", "Tester A", "file_name, file_type, file_size"),
    ("A", "TEST_APPROVED", "Approver 1", "test_id, approval_note"),
    ("B", "TEST_REJECTED x5", "Approver 1", "rejection_reason (distinct per cycle)"),
    ("B", "TEST_APPROVED (final)", "Approver 1", "approval_note"),
    ("D", "USER_DEACTIVATED", "Admin", "user_id (Tester B)"),
    ("D", "USER_CREATED", "Admin", "user_id (Tester C), role"),
    ("E", "BUILDING_UPDATED", "Admin", "old_approver, new_approver"),
    ("F", "ACCESS_DENIED", "System", "user_id, attempted_action, resource"),
    ("G/H", "ESCALATION_SENT", "System", "tier, recipient_list, building_id, flow"),
    ("L", "TEST_SUBMITTED_LATE", "Tester B", "days_late, deadline"),
    ("M", "ESCALATION_SKIPPED", "System", "building_id, reason='exempt'"),
]
for r_idx, row in enumerate(au_rows, 2):
    for c_idx, val in enumerate(row, 1):
        c = ws_au.cell(row=r_idx, column=c_idx, value=val)
        c.alignment = wrap
        c.border = border

# ── Summary sheet (empty, filled post-run) ──────────────────────────────────
ws_sum = wb.create_sheet("Summary")
ws_sum.column_dimensions["A"].width = 25
ws_sum.column_dimensions["B"].width = 25
sum_rows = [
    ("Total Test Cases", len(test_cases)),
    ("Passed", ""),
    ("Failed", ""),
    ("Skipped", ""),
    ("Pass Rate", ""),
    ("Execution Time", ""),
    ("Playwright Version", ""),
    ("Browser", ""),
    ("Date Executed", ""),
    ("Backend URL", "http://localhost:8000"),
    ("Frontend URL", "http://localhost:3000"),
    ("MailCatcher", "http://localhost:1080 (or backend/mailcatcher.py)"),
]
for r_idx, (k, v) in enumerate(sum_rows, 1):
    a = ws_sum.cell(row=r_idx, column=1, value=k)
    b = ws_sum.cell(row=r_idx, column=2, value=v)
    a.font = Font(bold=True)
    a.border = border
    b.border = border

# ── Save ────────────────────────────────────────────────────────────────────
output_path = r"E:\Master - slave\Damco material\Compass-final-clone\Alarm_E2E_TestCases.xlsx"
wb.save(output_path)
print(f"Saved: {output_path}")
print(f"Total test cases: {len(test_cases)}")
print(f"Sheets: {wb.sheetnames}")

# Per-scenario breakdown
from collections import Counter
by_scenario = Counter(row[1] for row in test_cases)
print("\nBreakdown:")
for sc, n in sorted(by_scenario.items()):
    print(f"  {sc}: {n}")

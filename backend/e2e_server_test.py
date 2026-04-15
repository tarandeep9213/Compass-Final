"""Production E2E Test — run against live server."""
import json
import urllib.request
import urllib.error
import sys

API = sys.argv[1] if len(sys.argv) > 1 else "http://ec2-44-208-172-161.compute-1.amazonaws.com/v1"
# Use server date — fetch from health or use UTC since EC2 is UTC
from datetime import datetime, timezone
today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

def api(method, path, token="", body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def login(email):
    s, d = api("POST", "/auth/login", body={"email": email, "password": "demo1234"})
    return d.get("access_token", "")

results = []
def check(name, ok):
    results.append((name, ok))
    tag = "PASS" if ok else "FAIL"
    print(f"  {tag} {name}")

print("=== Production E2E Test (Clean DB) ===\n")

# Phase 1
print("Phase 1: Login")
op_token = login("operator@compass.com")
ctrl_token = login("controller@compass.com")
dgm_token = login("dgm@compass.com")
rc_token = login("rc@compass.com")
check("Operator login", bool(op_token))
check("Controller login", bool(ctrl_token))
check("DGM login", bool(dgm_token))
check("RC login", bool(rc_token))

# Phase 2
print("\nPhase 2: Operator submits")
s, d = api("POST", "/submissions", op_token, {
    "location_id": "loc-appleton", "submission_date": today, "source": "FORM",
    "sections": {"A": {"total": 5000}, "B": {"total": 200}},
    "variance_note": None, "save_as_draft": False,
})
op_sub_id = d.get("id", "")
check("HTTP 201", s == 201)
check("Status pending_approval", d.get("status") == "pending_approval")
check("Role OPERATOR", d.get("submitted_by_role") == "OPERATOR")

# Phase 3
print("\nPhase 3: Controller rejects")
s, d = api("POST", f"/submissions/{op_sub_id}/reject", ctrl_token, {"reason": "Coin count mismatch"})
check("HTTP 200", s == 200)
check("Status rejected", d.get("status") == "rejected")

# Phase 4
print("\nPhase 4: Controller schedules visit")
s, d = api("POST", "/verifications/controller", ctrl_token, {
    "location_id": "loc-appleton", "date": today,
    "scheduled_time": "09:00", "dow_warning_acknowledged": True,
})
ctrl_visit_id = d.get("id", "")
check("HTTP 201", s == 201)
check("Status scheduled", d.get("status") == "scheduled")

# Phase 5
print("\nPhase 5: Controller Path B + complete")
s, d = api("POST", "/submissions", ctrl_token, {
    "location_id": "loc-appleton", "submission_date": today, "source": "FORM",
    "sections": {"A": {"total": 4800}}, "variance_note": None,
    "save_as_draft": False, "submitted_by_role": "CONTROLLER",
})
ctrl_total = d.get("total_cash", 0)
check("Controller form 201", s == 201)
check("Auto-approved", d.get("status") == "approved")
check("Role CONTROLLER", d.get("submitted_by_role") == "CONTROLLER")

s, d = api("PATCH", f"/verifications/controller/{ctrl_visit_id}/complete", ctrl_token, {
    "observed_total": ctrl_total, "signature_data": "data:image/png;base64,prodTest",
    "notes": "Prod E2E", "early_completion_acknowledged": True,
})
check("Visit completed", d.get("status") == "completed")
check("Observed total matches", d.get("observed_total") == ctrl_total)
check("Variance computed", d.get("variance_vs_imprest") is not None)

# Phase 6
print("\nPhase 6: Operator resubmits (multi-role)")
s, d = api("POST", "/submissions", op_token, {
    "location_id": "loc-appleton", "submission_date": today, "source": "FORM",
    "sections": {"A": {"total": 5200}, "B": {"total": 180}},
    "variance_note": None, "save_as_draft": False,
})
op_sub_id = d.get("id", "")
check("HTTP 201 (not blocked)", s == 201)
check("Status pending_approval", d.get("status") == "pending_approval")
check("Role OPERATOR", d.get("submitted_by_role") == "OPERATOR")

# Phase 7
print("\nPhase 7: Controller approves")
s, d = api("POST", f"/submissions/{op_sub_id}/approve", ctrl_token, {"notes": "Approved"})
check("HTTP 200", s == 200)
check("Status approved", d.get("status") == "approved")

# Phase 8
print("\nPhase 8: DGM schedules visit")
s, d = api("POST", "/verifications/dgm", dgm_token, {
    "location_id": "loc-appleton", "date": today, "notes": "Prod E2E",
})
dgm_visit_id = d.get("id", "")
check("HTTP 201", s == 201)
check("Status scheduled", d.get("status") == "scheduled")

# Phase 9
print("\nPhase 9: DGM completes visit")
s, d = api("GET", f"/submissions?location_id=loc-appleton&date_from={today}&date_to={today}", dgm_token)
op_sub = next((i for i in d.get("items", []) if i.get("submitted_by_role") == "OPERATOR" and i.get("status") == "approved"), None)
check("DGM sees operator approved form", op_sub is not None)
obs = op_sub["total_cash"] if op_sub else 5380

s, d = api("PATCH", f"/verifications/dgm/{dgm_visit_id}/complete", dgm_token, {
    "observed_total": obs, "signature_data": "data:image/png;base64,dgmProd", "notes": "Prod E2E DGM",
})
check("Visit completed", d.get("status") == "completed")
check("Variance computed", d.get("variance_vs_imprest") is not None)

# Phase 10
print("\nPhase 10: RC dashboard verification")
s, d = api("GET", "/compliance/dashboard", rc_token)
locs = d.get("locations", [])
app_loc = next((l for l in locs if l["id"] == "loc-appleton"), None)
if app_loc:
    sub = app_loc.get("submission")
    ctrl_v = app_loc["controller_visit"]
    dgm_v = app_loc["dgm_visit"]
    check("Submission is OPERATOR only", sub is not None and sub.get("submitted_by_role") == "OPERATOR")
    check("Submission approved", sub is not None and sub.get("status") == "approved")
    check("Controller 0d ago", ctrl_v.get("days_since") == 0)
    check("Controller form_filled", ctrl_v.get("form_filled") == True)
    check("DGM completed", dgm_v.get("status") == "completed")
else:
    check("APPLETON found", False)

s, d = api("GET", "/business-dashboard/dgm-coverage", rc_token)
pending = [p["name"] for p in d.get("pendingLocations", [])]
check("APPLETON not in DGM pending", "APPLETON" not in pending)

s, d = api("GET", f"/submissions?location_id=loc-appleton&date_from={today}&date_to={today}", rc_token)
items = d.get("items", [])
roles = [i["submitted_by_role"] for i in items]
check("Has OPERATOR submission", "OPERATOR" in roles)
check("Has CONTROLLER submission", "CONTROLLER" in roles)
for i in items:
    print(f"    {i['submitted_by_role']}: {i['status']} ${i['total_cash']}")

# Summary
passed = sum(1 for _, ok in results if ok)
failed = sum(1 for _, ok in results if not ok)
print(f"\n{'='*50}")
print(f"  TOTAL: {passed} passed, {failed} failed")
if failed:
    print("  FAILURES:")
    for name, ok in results:
        if not ok:
            print(f"    - {name}")
else:
    print("  ALL TESTS PASSED!")
print("=" * 50)

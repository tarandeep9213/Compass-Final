"""
Comprehensive demo seed — generates 90 days of realistic data for every dashboard.
Run from backend/: python seed_demo.py

Covers:
  • Submissions (draft/pending/approved/rejected) for all locations
  • Missed submissions with explanations
  • Audit events (logins, submits, approvals, rejections, verifications)
  • Sets expected_cash on all locations
"""

import sys, os, uuid, random, json
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models.submission import Submission, SubmissionStatus, SubmissionSource, MissedSubmission
from app.models.location import Location
from app.models.audit import AuditEvent
from app.models.user import User, UserRole
from app.core.security import hash_password

# ── Constants ────────────────────────────────────────────────────────────────
TODAY      = date(2026, 3, 6)
DEMO_PASS  = "demo1234"
DAY_NAMES  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

random.seed(42)   # reproducible

# ── Location expected-cash values ────────────────────────────────────────────
LOCATION_CASH = {
    "loc-1":          9575.00,
    "loc-2":         12000.00,
    "loc-3":          8500.00,
    "loc-4":         15000.00,
    "loc-5":          7200.00,
    "loc-cc-101":     6500.00,
    "loc-cc-102":     6500.00,
    "loc-cc-201":     8000.00,
    "loc-cc-202":     8000.00,
    "loc-cc-401":     9000.00,
    "loc-cc-402":     7500.00,
    "loc-appleton":   9575.00,
    "loc-wausau":     7800.00,
    "loc-central-il": 8200.00,
    "loc-bloomingdale":11500.00,
    "loc-romeoville":  6800.00,
    "loc-des-moines":  7900.00,
    "loc-cedar-rapids":6200.00,
    "loc-dynamic":     9000.00,
    "loc-galesburg":   5400.00,
    "loc-grand-rapids":8800.00,
    "loc-kansas-city": 11000.00,
    "loc-la-crosse":   6500.00,
    "loc-lenexa":      7200.00,
    "loc-madison":     5500.00,
    "loc-belvidere":   4800.00,
    "loc-milwaukee":   10500.00,
    "loc-omaha":       6800.00,
    "loc-omaha-ck":    6200.00,
    "loc-rochester":   7400.00,
    "loc-sheboygan":   9575.00,
    "loc-st-louis":    12500.00,
    "loc-st-paul":     8600.00,
}

MISSED_REASONS = [
    ("equipment_failure", "Cash counting machine malfunction — maintenance called"),
    ("sick_leave",        "Operator on approved sick leave — no cover available"),
    ("public_holiday",    "Location closed for public holiday"),
    ("system_outage",     "Backend system outage prevented submission"),
    ("emergency_closure", "Emergency building evacuation — location closed early"),
]

SOURCES = [SubmissionSource.FORM, SubmissionSource.FORM, SubmissionSource.FORM,
           SubmissionSource.CHAT, SubmissionSource.EXCEL]

VARIANCE_NOTES = [
    "Safe audit found discrepancy in coin tray — recount confirmed.",
    "Changer #3 was short due to broken bill acceptor, since repaired.",
    "Public holiday weekend carry-over funds included in count.",
    "New changer loaded overnight, included in unissued fund total.",
    "Till difference caused by training shift — supervisor aware.",
    "Variance due to unprocessed refund vouchers, now cleared.",
]


def uid(): return str(uuid.uuid4())
def dt_utc(d: date, hour=10, minute=0):
    return datetime(d.year, d.month, d.day, hour, minute, 0, tzinfo=timezone.utc)
def past(n): return TODAY - timedelta(days=n)
def future(n): return TODAY + timedelta(days=n)


def realistic_sections(expected: float) -> dict:
    """Generate section totals that approximately sum to expected_cash."""
    # A: ~30%, B: ~10%, C: ~12%, D: ~8%, E: ~25%, H: ~15%
    jitter = lambda x, pct=0.04: round(x * random.uniform(1 - pct, 1 + pct), 2)
    a  = jitter(expected * 0.30)
    b  = jitter(expected * 0.10)
    c  = jitter(expected * 0.12)
    d  = jitter(expected * 0.08)
    e  = jitter(expected * 0.25)
    f  = round(random.uniform(0, expected * 0.005), 2)
    g  = round(random.uniform(0, expected * 0.002), 2)
    h  = jitter(expected * 0.15)
    i  = round(random.uniform(-30, 10), 2)
    return {"A": a, "B": b, "C": c, "D": d, "E": e, "F": f, "G": g, "H": h, "I": i}


def total_from_sections(s: dict) -> float:
    return round(sum(s.values()), 2)


def make_submission(loc_id, loc_name, op_id, op_name, ctrl_id, ctrl_name, sub_date,
                    status, expected, source=None, approved_at_date=None,
                    rejected=False, rejection_reason=None):
    sections = realistic_sections(expected)
    total    = total_from_sections(sections)
    variance = round(total - expected, 2)
    var_pct  = round((variance / expected) * 100, 2) if expected else 0
    exc      = abs(var_pct) > 5.0
    v_note   = random.choice(VARIANCE_NOTES) if exc else None
    src      = source or random.choice(SOURCES)

    s = Submission(
        id=uid(),
        location_id=loc_id,
        location_name=loc_name,
        operator_id=op_id,
        operator_name=op_name,
        submission_date=sub_date.isoformat(),
        status=status,
        source=src,
        sections=sections,
        total_cash=total,
        expected_cash=expected,
        variance=variance,
        variance_pct=var_pct,
        variance_exception=exc,
        variance_note=v_note,
        submitted_at=dt_utc(sub_date, random.randint(7, 10), random.randint(0, 59)),
    )
    if status == SubmissionStatus.APPROVED and approved_at_date:
        s.approved_by      = ctrl_id
        s.approved_by_name = ctrl_name
        s.approved_at      = dt_utc(approved_at_date, random.randint(10, 16))
    if status == SubmissionStatus.REJECTED:
        s.rejection_reason = rejection_reason or "Count totals inconsistent with register tape. Please recount and resubmit."
    return s


def make_audit(event_type, actor_id, actor_name, actor_role,
               loc_id=None, loc_name=None, entity_id=None, entity_type=None,
               detail="", old_val=None, new_val=None, ts: datetime = None):
    return AuditEvent(
        id=uid(),
        event_type=event_type,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        location_id=loc_id,
        location_name=loc_name,
        entity_id=entity_id,
        entity_type=entity_type,
        detail=detail,
        old_value=old_val,
        new_value=new_val,
        ip_address=f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
        created_at=ts or datetime.now(timezone.utc),
    )


def seed():
    db = SessionLocal()
    try:
        # ── 1. Clear existing submissions & audit events ──────────────────────
        print("Clearing existing submissions and audit events…")
        db.query(MissedSubmission).delete()
        db.query(Submission).delete()
        db.query(AuditEvent).delete()
        db.commit()

        # ── 2. Update location expected_cash values ───────────────────────────
        print("Setting expected_cash on all locations…")
        for loc in db.query(Location).all():
            loc.expected_cash = LOCATION_CASH.get(loc.id, 8000.00)
        db.commit()

        # ── 3. Ensure demo locations loc-2..5 have operators ─────────────────
        extra_ops = [
            {"email": "op2@compass.com", "name": "Jordan Lee",   "loc": "loc-2"},
            {"email": "op3@compass.com", "name": "Maya Singh",   "loc": "loc-3"},
            {"email": "op4@compass.com", "name": "Carlos Ruiz",  "loc": "loc-4"},
            {"email": "op5@compass.com", "name": "Emma White",   "loc": "loc-5"},
        ]
        for o in extra_ops:
            u = db.query(User).filter_by(email=o["email"]).first()
            if not u:
                u = User(id=uid(), email=o["email"], name=o["name"],
                         role=UserRole.OPERATOR,
                         hashed_password=hash_password(DEMO_PASS),
                         location_ids=[o["loc"]], active=True)
                db.add(u)
                print(f"  + created {o['email']}")
        db.commit()

        # ── 4. Build operator→location index ─────────────────────────────────
        all_users = db.query(User).all()
        # loc_id -> (operator, controller)
        loc_index: dict[str, dict] = {}
        for u in all_users:
            if u.role == UserRole.OPERATOR:
                for lid in u.location_ids:
                    loc_index.setdefault(lid, {})["op"] = u
            elif u.role == UserRole.CONTROLLER:
                for lid in u.location_ids:
                    loc_index.setdefault(lid, {})["ctrl"] = u

        # Fallback controller (Chris Controller) for any unmapped location
        fallback_ctrl = db.query(User).filter_by(email="controller@compass.com").first()

        all_locs = {l.id: l for l in db.query(Location).all()}

        audit_batch = []
        sub_batch   = []
        missed_batch = []

        # ── 5. Generate 90 days of submissions per location ───────────────────
        print("Generating submissions…")
        for loc_id, loc in all_locs.items():
            info  = loc_index.get(loc_id, {})
            op    = info.get("op")
            ctrl  = info.get("ctrl") or fallback_ctrl
            if not op:
                continue   # skip locations with no operator

            expected = loc.expected_cash or 8000.0
            ctrl_id   = ctrl.id if ctrl else "system"
            ctrl_name = ctrl.name if ctrl else "System"

            for days_ago in range(90, -1, -1):
                d = past(days_ago)
                if d.weekday() >= 6:   # skip Sundays
                    continue

                # Saturdays: 60% chance of submission
                if d.weekday() == 5 and random.random() > 0.60:
                    continue

                # 15% random skip on any remaining day → missed
                if random.random() < 0.12:
                    reason, detail = random.choice(MISSED_REASONS)
                    missed_batch.append(MissedSubmission(
                        id=uid(),
                        location_id=loc_id,
                        missed_date=d.isoformat(),
                        reason=reason,
                        detail=detail,
                        supervisor_name=ctrl_name,
                        logged_by=op.id,
                        logged_at=dt_utc(d, 17),
                    ))
                    audit_batch.append(make_audit(
                        "missed_submission_logged", op.id, op.name, "OPERATOR",
                        loc_id, loc.name, detail=f"Missed submission logged for {d} — {reason}",
                        ts=dt_utc(d, 17),
                    ))
                    continue

                # Determine status
                if days_ago == 0:
                    # Today: 50% pending, 30% draft, 20% approved same-day
                    roll = random.random()
                    if roll < 0.30:
                        status = SubmissionStatus.DRAFT
                    elif roll < 0.80:
                        status = SubmissionStatus.PENDING_APPROVAL
                    else:
                        status = SubmissionStatus.APPROVED
                elif days_ago == 1:
                    # Yesterday: mostly pending/approved
                    status = random.choice([
                        SubmissionStatus.PENDING_APPROVAL,
                        SubmissionStatus.PENDING_APPROVAL,
                        SubmissionStatus.APPROVED,
                        SubmissionStatus.APPROVED,
                        SubmissionStatus.APPROVED,
                    ])
                elif days_ago <= 5:
                    # Last week: ~15% pending, ~80% approved, ~5% rejected
                    roll = random.random()
                    if roll < 0.15:
                        status = SubmissionStatus.PENDING_APPROVAL
                    elif roll < 0.95:
                        status = SubmissionStatus.APPROVED
                    else:
                        status = SubmissionStatus.REJECTED
                else:
                    # Older: ~5% pending, ~88% approved, ~7% rejected
                    roll = random.random()
                    if roll < 0.05:
                        status = SubmissionStatus.PENDING_APPROVAL
                    elif roll < 0.93:
                        status = SubmissionStatus.APPROVED
                    else:
                        status = SubmissionStatus.REJECTED

                approved_date = d + timedelta(days=random.randint(0, 1)) if status == SubmissionStatus.APPROVED else None

                sub = make_submission(
                    loc_id, loc.name, op.id, op.name, ctrl_id, ctrl_name,
                    d, status, expected, approved_at_date=approved_date,
                    rejected=(status == SubmissionStatus.REJECTED),
                )
                sub_batch.append(sub)

                # Audit: submission created
                audit_batch.append(make_audit(
                    "submission_created", op.id, op.name, "OPERATOR",
                    loc_id, loc.name, sub.id, "submission",
                    f"Cash count submitted — total ${sub.total_cash:,.2f}",
                    ts=sub.submitted_at,
                ))

                if status == SubmissionStatus.APPROVED and ctrl:
                    audit_batch.append(make_audit(
                        "submission_approved", ctrl.id, ctrl.name, "CONTROLLER",
                        loc_id, loc.name, sub.id, "submission",
                        f"Submission approved — variance {sub.variance_pct:+.2f}%",
                        ts=sub.approved_at,
                    ))
                elif status == SubmissionStatus.REJECTED:
                    audit_batch.append(make_audit(
                        "submission_rejected", ctrl_id, ctrl_name, "CONTROLLER",
                        loc_id, loc.name, sub.id, "submission",
                        f"Submission rejected — {sub.rejection_reason[:60]}",
                        ts=dt_utc(d, random.randint(11, 17)),
                    ))

        # ── 6. Bulk insert ────────────────────────────────────────────────────
        print(f"  Inserting {len(sub_batch)} submissions…")
        for s in sub_batch: db.add(s)
        print(f"  Inserting {len(missed_batch)} missed submissions…")
        for m in missed_batch: db.add(m)
        db.commit()

        # ── 7. Audit events ───────────────────────────────────────────────────
        print(f"  Inserting {len(audit_batch)} audit events…")

        # Add system-level audit events: user logins (last 14 days)
        for u in all_users[:20]:   # top 20 users
            for days_ago in random.sample(range(1, 30), k=random.randint(4, 12)):
                d = past(days_ago)
                audit_batch.append(make_audit(
                    "user_login", u.id, u.name, u.role.value,
                    detail=f"User logged in",
                    ts=dt_utc(d, random.randint(6, 9), random.randint(0, 59)),
                ))

        # Config change audit
        admin = db.query(User).filter_by(email="admin@compass.com").first()
        if admin:
            for days_ago in [45, 20, 5]:
                audit_batch.append(make_audit(
                    "config_updated", admin.id, admin.name, "ADMIN",
                    detail="System tolerance updated to 5%",
                    old_val="3%", new_val="5%",
                    ts=dt_utc(past(days_ago), 14),
                ))

        # User created audit events
        for u in all_users[-10:]:
            audit_batch.append(make_audit(
                "user_created", admin.id if admin else uid(), admin.name if admin else "System", "ADMIN",
                detail=f"User account created: {u.email}",
                entity_id=u.id, entity_type="user",
                ts=dt_utc(past(random.randint(60, 90)), 10),
            ))

        for a in audit_batch: db.add(a)
        db.commit()

        # ── Summary ───────────────────────────────────────────────────────────
        total_subs   = db.query(Submission).count()
        total_missed = db.query(MissedSubmission).count()
        total_audit  = db.query(AuditEvent).count()
        from app.models.submission import SubmissionStatus as SS
        approved_n = db.query(Submission).filter_by(status=SS.APPROVED).count()
        pending_n  = db.query(Submission).filter_by(status=SS.PENDING_APPROVAL).count()
        rejected_n = db.query(Submission).filter_by(status=SS.REJECTED).count()
        draft_n    = db.query(Submission).filter_by(status=SS.DRAFT).count()

        print(f"""
Done!
  Submissions  : {total_subs}
    approved   : {approved_n}
    pending    : {pending_n}
    rejected   : {rejected_n}
    draft      : {draft_n}
  Missed       : {total_missed}
  Audit events : {total_audit}
""")

    finally:
        db.close()


if __name__ == "__main__":
    seed()

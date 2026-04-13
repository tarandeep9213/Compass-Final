from datetime import datetime, timezone

import os
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads", "alarm")

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.alarm import AlarmTest, AlarmTestZone, AlarmTestAttachment, AlarmComplianceRules, AlarmZone, AlarmBiannualCheck
from app.api.v1.alarm_audit_helper import log_alarm_event
from app.schemas.alarm import (
    AlarmTestOut,
    AlarmTestDetailOut,
    AlarmTestZoneOut,
    AlarmTestAttachmentOut,
    CreateAlarmTestBody,
    SaveZoneResultsBody,
    ApproveRejectBody,
    RejectBody,
)

router = APIRouter(prefix="/alarm/tests", tags=["alarm-tests"])

_TESTER   = [Depends(require_roles(UserRole.ALARM_TESTER))]
_APPROVER = [Depends(require_roles(UserRole.ALARM_APPROVER))]
# Read-only access for tests list / details — testers, approvers, alarm admin, and cross-functional roles
_TEST_READER = [Depends(require_roles(
    UserRole.ALARM_TESTER, UserRole.ALARM_APPROVER, UserRole.ALARM_ADMIN,
    UserRole.CONTROLLER, UserRole.DGM, UserRole.REGIONAL_CONTROLLER,
))]


@router.get("", response_model=list[AlarmTestOut], dependencies=_TEST_READER)
def list_tests(
    building_id: str | None = Query(None),
    month: str | None = Query(None),
    status: str | None = Query(None),
    tester_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AlarmTest)
    if building_id:
        q = q.filter(AlarmTest.building_id == building_id)
    if month:
        q = q.filter(AlarmTest.test_month == month)
    if status:
        q = q.filter(AlarmTest.status == status)
    if tester_id:
        q = q.filter(AlarmTest.tester_id == tester_id)
    tests = q.order_by(AlarmTest.test_date.desc()).all()

    # Bulk-fetch attachment counts for has_attachment flag (one query, not N)
    test_ids = [t.id for t in tests]
    if test_ids:
        from sqlalchemy import func
        rows = db.query(
            AlarmTestAttachment.alarm_test_id, func.count(AlarmTestAttachment.id)
        ).filter(AlarmTestAttachment.alarm_test_id.in_(test_ids)).group_by(
            AlarmTestAttachment.alarm_test_id
        ).all()
        attached_set = {tid for tid, cnt in rows if cnt > 0}
    else:
        attached_set = set()

    out = []
    for t in tests:
        d = AlarmTestOut.model_validate(t).model_dump()
        d["has_attachment"] = t.id in attached_set
        out.append(d)
    return out


@router.get("/{test_id}", response_model=AlarmTestDetailOut, dependencies=_TEST_READER)
def get_test(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    zones = db.query(AlarmTestZone).filter(AlarmTestZone.alarm_test_id == test_id).all()
    attachments = db.query(AlarmTestAttachment).filter(AlarmTestAttachment.alarm_test_id == test_id).all()
    test_out = AlarmTestOut.model_validate(t).model_dump()
    test_out["has_attachment"] = len(attachments) > 0
    return AlarmTestDetailOut(
        test=test_out,
        zones=[AlarmTestZoneOut.model_validate(z) for z in zones],
        attachments=[AlarmTestAttachmentOut.model_validate(a) for a in attachments],
    )


@router.post("", response_model=AlarmTestOut, status_code=201, dependencies=_TESTER)
def create_test(
    body: CreateAlarmTestBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = AlarmTest(
        building_id=body.building_id,
        test_date=body.test_date,
        test_month=body.test_month,
        tester_id=current_user.id,
        tester_name=current_user.name,
        status="DRAFT",
        test_start_time=body.test_start_time,
        test_end_time=body.test_end_time,
        notes=body.notes,
    )
    db.add(t)
    log_alarm_event(db, current_user, "TEST_CREATED", "testing", f"Draft test created for building {body.building_id} on {body.test_date}")
    db.commit()
    db.refresh(t)
    return t


@router.put("/{test_id}", response_model=AlarmTestOut, dependencies=_TESTER)
def update_test(
    test_id: str,
    body: CreateAlarmTestBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    for field in ("test_date", "test_month", "test_start_time", "test_end_time", "notes"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(t, field, val)
    db.commit()
    db.refresh(t)
    return t


@router.post("/{test_id}/zones", dependencies=_TESTER)
def save_zone_results(
    test_id: str,
    body: SaveZoneResultsBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")

    # Delete existing zone results for this test
    db.query(AlarmTestZone).filter(AlarmTestZone.alarm_test_id == test_id).delete()

    tested = 0
    issues = 0
    for zone_id, data in body.results.items():
        tz = AlarmTestZone(
            alarm_test_id=test_id,
            alarm_zone_id=zone_id,
            result=data.get("result", "NOT_TESTED"),
            notes=data.get("notes"),
        )
        db.add(tz)
        if data.get("result") == "TESTED":
            tested += 1
        elif data.get("result") == "ISSUE_FOUND":
            issues += 1

    t.zones_total = len(body.results)
    t.zones_tested = tested
    t.zones_issue = issues
    db.commit()
    return {"saved": len(body.results)}


@router.post("/{test_id}/submit", response_model=AlarmTestOut, dependencies=_TESTER)
def submit_test(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    if t.status != "DRAFT":
        raise HTTPException(400, f"Test is {t.status}, not DRAFT")

    # Load compliance rules
    rules = db.get(AlarmComplianceRules, 1)
    if not rules:
        rules = AlarmComplianceRules(id=1)
        db.add(rules)
        db.commit()
        db.refresh(rules)

    # Validate: require_all_zones_tested
    if rules.require_all_zones_tested:
        building_zones = db.query(AlarmZone).filter(
            AlarmZone.building_id == t.building_id, AlarmZone.is_active == True
        ).all()
        test_zone_results = db.query(AlarmTestZone).filter(
            AlarmTestZone.alarm_test_id == test_id
        ).all()
        result_map = {tz.alarm_zone_id: tz.result for tz in test_zone_results}

        if building_zones:
            for z in building_zones:
                result = result_map.get(z.id)
                if not result or result == "NOT_TESTED":
                    raise HTTPException(400, f"All zones must be tested. Zone '{z.zone_name}' (#{z.zone_number}) is untested.")

    # Validate: require_report_upload
    if rules.require_report_upload:
        attachments = db.query(AlarmTestAttachment).filter(
            AlarmTestAttachment.alarm_test_id == test_id
        ).count()
        if attachments == 0:
            raise HTTPException(400, "A report attachment must be uploaded before submitting.")

    t.status = "SUBMITTED"
    t.submitted_at = datetime.now(timezone.utc).isoformat()
    log_alarm_event(db, current_user, "TEST_SUBMITTED", "testing", f"Test submitted for building {t.building_id} ({t.test_month})")
    db.commit()
    db.refresh(t)
    return t


@router.post("/{test_id}/approve", response_model=AlarmTestOut, dependencies=_APPROVER)
def approve_test(
    test_id: str,
    body: ApproveRejectBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    if t.status != "SUBMITTED":
        raise HTTPException(400, f"Test is {t.status}, not SUBMITTED")

    t.status = "APPROVED"
    t.approved_by = current_user.id
    t.approved_by_name = current_user.name
    t.approved_at = datetime.now(timezone.utc).isoformat()
    if body.notes:
        t.notes = (t.notes or "") + f"\n[Approver] {body.notes}"
    log_alarm_event(db, current_user, "TEST_APPROVED", "testing", f"Test approved for building {t.building_id} ({t.test_month})")
    db.commit()
    db.refresh(t)
    return t


@router.post("/{test_id}/reject", response_model=AlarmTestOut, dependencies=_APPROVER)
def reject_test(
    test_id: str,
    body: RejectBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    if t.status != "SUBMITTED":
        raise HTTPException(400, f"Test is {t.status}, not SUBMITTED")

    t.status = "REJECTED"
    t.rejection_reason = body.reason
    log_alarm_event(db, current_user, "TEST_REJECTED", "testing", f"Test rejected for building {t.building_id} ({t.test_month}): {body.reason}")
    db.commit()
    db.refresh(t)
    return t


# ── Integrated Biannual Endpoints ─────────────────────────────────────────────
# Tester can add/submit biannual checks while filling out a monthly test.
# Approver can approve all (test + linked biannual) in one action.
# Backward-compatible: existing /alarm/biannual endpoints still work.

def _calc_next_due_iso(check_date: str) -> str:
    """Calculate next due date: +6 months, day clamped to 28 to avoid end-of-month issues."""
    from datetime import date as _dt_date
    d = _dt_date.fromisoformat(check_date)
    month = d.month + 6
    year = d.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    day = min(d.day, 28)
    return _dt_date(year, month, day).isoformat()


class CreateBiannualForTestBody(BaseModel):
    check_type: str  # CELLULAR_BACKUP, CAMERA_BACKUP
    check_date: str
    status: str = "COMPLIANT"  # COMPLIANT, NON_COMPLIANT, PENDING
    days_verified: int | None = None
    notes: str | None = None


class BiannualWithTestOut(BaseModel):
    id: str
    building_id: str
    check_type: str
    check_date: str
    next_due_date: str | None
    status: str
    approval_status: str
    days_verified: int | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class BiannualSlot(BaseModel):
    """One slot (cellular or camera) for the test form."""
    check_type: str  # CELLULAR_BACKUP or CAMERA_BACKUP
    due: bool                 # true if a new check is needed (overdue or due this 6-month window)
    overdue: bool             # true if past next_due_date
    days_until_due: int | None  # negative = overdue, null = never checked
    last_check: BiannualWithTestOut | None  # most recent APPROVED check (or null)
    pending_check: BiannualWithTestOut | None  # current DRAFT/SUBMITTED check linked to this test cycle


class BiannualContextOut(BaseModel):
    cellular: BiannualSlot
    camera: BiannualSlot


def _biannual_slot(db: Session, building_id: str, check_type: str) -> BiannualSlot:
    from datetime import date as _dt_date
    today = _dt_date.today()

    # Most recent APPROVED check
    last = db.query(AlarmBiannualCheck).filter(
        AlarmBiannualCheck.building_id == building_id,
        AlarmBiannualCheck.check_type == check_type,
        AlarmBiannualCheck.approval_status == "APPROVED",
    ).order_by(AlarmBiannualCheck.check_date.desc()).first()

    # Current DRAFT or SUBMITTED check (the one being worked on)
    pending = db.query(AlarmBiannualCheck).filter(
        AlarmBiannualCheck.building_id == building_id,
        AlarmBiannualCheck.check_type == check_type,
        AlarmBiannualCheck.approval_status.in_(("DRAFT", "SUBMITTED")),
    ).order_by(AlarmBiannualCheck.created_at.desc()).first()

    days_until = None
    overdue = False
    due = pending is None  # if no pending, due unless we have an unexpired APPROVED

    if last and last.next_due_date:
        try:
            next_due = _dt_date.fromisoformat(last.next_due_date)
            days_until = (next_due - today).days
            if days_until < 0:
                overdue = True
                due = True
            elif days_until <= 30:
                due = True  # due soon
            elif pending is None:
                due = False  # have a recent APPROVED check, not due yet
        except ValueError:
            pass

    return BiannualSlot(
        check_type=check_type,
        due=due,
        overdue=overdue,
        days_until_due=days_until,
        last_check=last,
        pending_check=pending,
    )


@router.get("/{test_id}/biannual-context", response_model=BiannualContextOut, dependencies=_TEST_READER)
def get_biannual_context(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return cellular & camera biannual context for the test's building."""
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    return BiannualContextOut(
        cellular=_biannual_slot(db, t.building_id, "CELLULAR_BACKUP"),
        camera=_biannual_slot(db, t.building_id, "CAMERA_BACKUP"),
    )


@router.post("/{test_id}/biannual", response_model=BiannualWithTestOut, status_code=201, dependencies=_TESTER)
def add_biannual_to_test(
    test_id: str,
    body: CreateBiannualForTestBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add or update a biannual check linked to this test's building (DRAFT state)."""
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    if t.status not in ("DRAFT", "REJECTED"):
        raise HTTPException(400, f"Cannot add biannual to test in {t.status} state")
    if body.check_type not in ("CELLULAR_BACKUP", "CAMERA_BACKUP"):
        raise HTTPException(400, "check_type must be CELLULAR_BACKUP or CAMERA_BACKUP")

    # Look for an existing DRAFT/REJECTED biannual of this type for this building (so update vs create)
    existing = db.query(AlarmBiannualCheck).filter(
        AlarmBiannualCheck.building_id == t.building_id,
        AlarmBiannualCheck.check_type == body.check_type,
        AlarmBiannualCheck.approval_status.in_(("DRAFT", "REJECTED")),
    ).order_by(AlarmBiannualCheck.created_at.desc()).first()

    if existing:
        existing.check_date = body.check_date
        existing.next_due_date = _calc_next_due_iso(body.check_date)
        existing.status = body.status
        existing.days_verified = body.days_verified
        existing.notes = body.notes
        existing.checked_by = current_user.id
        existing.checked_by_name = current_user.name
        existing.approval_status = "DRAFT"
        existing.rejection_reason = None
        check = existing
        action_label = "BIANNUAL_UPDATED"
    else:
        check = AlarmBiannualCheck(
            building_id=t.building_id,
            check_type=body.check_type,
            check_date=body.check_date,
            next_due_date=_calc_next_due_iso(body.check_date),
            status=body.status,
            checked_by=current_user.id,
            checked_by_name=current_user.name,
            days_verified=body.days_verified,
            notes=body.notes,
            approval_status="DRAFT",
        )
        db.add(check)
        action_label = "BIANNUAL_CREATED"

    log_alarm_event(
        db, current_user, action_label, "testing",
        f"{body.check_type} for building {t.building_id} via test {test_id}",
    )
    db.commit()
    db.refresh(check)
    return check


@router.post("/{test_id}/submit-with-biannual", response_model=AlarmTestOut, dependencies=_TESTER)
def submit_test_with_biannual(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit the test AND any DRAFT biannual checks for the same building.

    Soft policy: missing biannual is allowed. Approver/dashboard surfaces gaps.
    """
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    if t.status != "DRAFT":
        raise HTTPException(400, f"Test is {t.status}, not DRAFT")

    # Apply same compliance rules as regular submit
    rules = db.get(AlarmComplianceRules, 1)
    if not rules:
        rules = AlarmComplianceRules(id=1)
        db.add(rules)
        db.commit()
        db.refresh(rules)

    if rules.require_all_zones_tested:
        building_zones = db.query(AlarmZone).filter(
            AlarmZone.building_id == t.building_id, AlarmZone.is_active == True
        ).all()
        test_zone_results = db.query(AlarmTestZone).filter(
            AlarmTestZone.alarm_test_id == test_id
        ).all()
        result_map = {tz.alarm_zone_id: tz.result for tz in test_zone_results}
        if building_zones:
            for z in building_zones:
                result = result_map.get(z.id)
                if not result or result == "NOT_TESTED":
                    raise HTTPException(400, f"All zones must be tested. Zone '{z.zone_name}' (#{z.zone_number}) is untested.")

    if rules.require_report_upload:
        attachments = db.query(AlarmTestAttachment).filter(
            AlarmTestAttachment.alarm_test_id == test_id
        ).count()
        if attachments == 0:
            raise HTTPException(400, "A report attachment must be uploaded before submitting.")

    now_iso = datetime.now(timezone.utc).isoformat()
    t.status = "SUBMITTED"
    t.submitted_at = now_iso

    # Submit any DRAFT biannual checks for the same building
    draft_biannuals = db.query(AlarmBiannualCheck).filter(
        AlarmBiannualCheck.building_id == t.building_id,
        AlarmBiannualCheck.approval_status == "DRAFT",
    ).all()
    for b in draft_biannuals:
        b.approval_status = "SUBMITTED"
        b.submitted_at = now_iso

    log_alarm_event(
        db, current_user, "TEST_SUBMITTED_WITH_BIANNUAL", "testing",
        f"Test submitted for {t.building_id} ({t.test_month}); {len(draft_biannuals)} biannual check(s) included",
    )
    db.commit()
    db.refresh(t)
    return t


class ApproveAllBody(BaseModel):
    notes: str | None = None


@router.post("/{test_id}/approve-all", response_model=AlarmTestOut, dependencies=_APPROVER)
def approve_all(
    test_id: str,
    body: ApproveAllBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve the test AND any SUBMITTED biannual checks for the same building."""
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    if t.status != "SUBMITTED":
        raise HTTPException(400, f"Test is {t.status}, not SUBMITTED")

    now_iso = datetime.now(timezone.utc).isoformat()
    t.status = "APPROVED"
    t.approved_by = current_user.id
    t.approved_by_name = current_user.name
    t.approved_at = now_iso
    if body.notes:
        t.notes = (t.notes or "") + f"\n[Approver] {body.notes}"

    # Approve any SUBMITTED biannual checks for the same building
    submitted_biannuals = db.query(AlarmBiannualCheck).filter(
        AlarmBiannualCheck.building_id == t.building_id,
        AlarmBiannualCheck.approval_status == "SUBMITTED",
    ).all()
    for b in submitted_biannuals:
        b.approval_status = "APPROVED"
        b.approved_by = current_user.id
        b.approved_by_name = current_user.name
        b.approved_at = now_iso

    log_alarm_event(
        db, current_user, "TEST_APPROVED_ALL", "testing",
        f"Test + {len(submitted_biannuals)} biannual approved for {t.building_id} ({t.test_month})",
    )
    db.commit()
    db.refresh(t)
    return t


@router.post("/{test_id}/reopen", response_model=AlarmTestOut, dependencies=_TESTER)
def reopen_test(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    if t.status != "REJECTED":
        raise HTTPException(400, f"Test is {t.status}, not REJECTED")

    t.status = "DRAFT"
    t.rejection_reason = None
    t.submitted_at = None
    log_alarm_event(db, current_user, "TEST_REOPENED", "testing", f"Rejected test reopened for building {t.building_id} ({t.test_month})")
    db.commit()
    db.refresh(t)
    return t


# ── Attachments ──────────────────────────────────────────────────────────────

def _detect_file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("xls", "xlsx", "csv"):
        return "EXCEL"
    if ext in ("png", "jpg", "jpeg", "gif", "webp"):
        return "IMAGE"
    return "PDF"


@router.get("/{test_id}/attachments", response_model=list[AlarmTestAttachmentOut], dependencies=_TEST_READER)
def list_attachments(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    return db.query(AlarmTestAttachment).filter(AlarmTestAttachment.alarm_test_id == test_id).all()


@router.post("/{test_id}/attachments", response_model=AlarmTestAttachmentOut, status_code=201, dependencies=_TESTER)
async def upload_attachment(
    test_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")

    content = await file.read()
    file_size = len(content)

    # Save file to disk
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    stored_name = f"{_uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(file_path, "wb") as f:
        f.write(content)

    att = AlarmTestAttachment(
        alarm_test_id=test_id,
        file_name=file.filename or "unknown",
        file_type=_detect_file_type(file.filename or ""),
        file_size=file_size,
        file_path=stored_name,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.delete("/{test_id}/attachments/{attachment_id}", dependencies=_TESTER)
def delete_attachment(
    test_id: str,
    attachment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    att = db.get(AlarmTestAttachment, attachment_id)
    if not att or att.alarm_test_id != test_id:
        raise HTTPException(404, "Attachment not found")
    # Remove file from disk
    if att.file_path:
        disk_path = os.path.join(UPLOAD_DIR, att.file_path)
        if os.path.exists(disk_path):
            os.remove(disk_path)
    db.delete(att)
    db.commit()
    return {"deleted": attachment_id}


@router.get("/{test_id}/attachments/{attachment_id}/download", dependencies=_TEST_READER)
def download_attachment(
    test_id: str,
    attachment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    att = db.get(AlarmTestAttachment, attachment_id)
    if not att or att.alarm_test_id != test_id:
        raise HTTPException(404, "Attachment not found")
    if not att.file_path:
        raise HTTPException(404, "File not stored on disk")
    disk_path = os.path.join(UPLOAD_DIR, att.file_path)
    if not os.path.exists(disk_path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        path=disk_path,
        filename=att.file_name,
        media_type="application/octet-stream",
    )

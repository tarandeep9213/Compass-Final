from datetime import datetime, timezone

import os
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads", "alarm")

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.alarm import AlarmTest, AlarmTestZone, AlarmTestAttachment, AlarmComplianceRules, AlarmZone
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

_APPROVER = [Depends(require_roles(UserRole.ADMIN, UserRole.REGIONAL_CONTROLLER))]


@router.get("", response_model=list[AlarmTestOut])
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
    return q.order_by(AlarmTest.test_date.desc()).all()


@router.get("/{test_id}", response_model=AlarmTestDetailOut)
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
    return AlarmTestDetailOut(
        test=t,
        zones=[AlarmTestZoneOut.model_validate(z) for z in zones],
        attachments=[AlarmTestAttachmentOut.model_validate(a) for a in attachments],
    )


@router.post("", response_model=AlarmTestOut, status_code=201)
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


@router.put("/{test_id}", response_model=AlarmTestOut)
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


@router.post("/{test_id}/zones")
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


@router.post("/{test_id}/submit", response_model=AlarmTestOut)
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


@router.post("/{test_id}/reopen", response_model=AlarmTestOut)
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


@router.get("/{test_id}/attachments", response_model=list[AlarmTestAttachmentOut])
def list_attachments(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.get(AlarmTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    return db.query(AlarmTestAttachment).filter(AlarmTestAttachment.alarm_test_id == test_id).all()


@router.post("/{test_id}/attachments", response_model=AlarmTestAttachmentOut, status_code=201)
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


@router.delete("/{test_id}/attachments/{attachment_id}")
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


@router.get("/{test_id}/attachments/{attachment_id}/download")
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

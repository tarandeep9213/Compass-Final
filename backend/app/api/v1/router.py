from fastapi import APIRouter, Depends
from app.api.v1 import auth, locations, users, config, submissions, verifications, compliance, reports, audit, admin, business_dashboard, reasonableness, closures, alarm_buildings, alarm_zones, alarm_rules, alarm_access, alarm_tests, alarm_audit, alarm_biannual, alarm_escalation, alarm_dashboard, alarm_users
from app.core.deps import block_alarm_roles

router = APIRouter(prefix="/v1")
router.include_router(auth.router)

# ── Cashroom routers — block ALARM_* roles at the router level ─────────────
_BLOCK_ALARM = [Depends(block_alarm_roles)]
router.include_router(locations.router, dependencies=_BLOCK_ALARM)
router.include_router(users.router, dependencies=_BLOCK_ALARM)
router.include_router(config.router, dependencies=_BLOCK_ALARM)
router.include_router(submissions.router, dependencies=_BLOCK_ALARM)
router.include_router(verifications.router, dependencies=_BLOCK_ALARM)
router.include_router(compliance.router, dependencies=_BLOCK_ALARM)
router.include_router(reports.router, dependencies=_BLOCK_ALARM)
router.include_router(audit.router, dependencies=_BLOCK_ALARM)
router.include_router(admin.router, dependencies=_BLOCK_ALARM)
router.include_router(business_dashboard.router, dependencies=_BLOCK_ALARM)
router.include_router(reasonableness.router, dependencies=_BLOCK_ALARM)
router.include_router(closures.router, dependencies=_BLOCK_ALARM)

# ── Alarm routers — RBAC enforced inside each router ─────────────────────────
router.include_router(alarm_buildings.router)
router.include_router(alarm_zones.router)
router.include_router(alarm_rules.router)
router.include_router(alarm_access.router)
router.include_router(alarm_tests.router)
router.include_router(alarm_audit.router)
router.include_router(alarm_biannual.router)
router.include_router(alarm_escalation.router)
router.include_router(alarm_dashboard.router)
router.include_router(alarm_users.router)

from fastapi import APIRouter
from app.api.v1 import auth, locations, users, config, submissions, verifications, compliance, reports, audit, admin, business_dashboard, reasonableness, alarm_buildings, alarm_zones, alarm_rules

router = APIRouter(prefix="/v1")
router.include_router(auth.router)
router.include_router(locations.router)
router.include_router(users.router)
router.include_router(config.router)
router.include_router(submissions.router)
router.include_router(verifications.router)
router.include_router(compliance.router)
router.include_router(reports.router)
router.include_router(audit.router)
router.include_router(admin.router)
router.include_router(business_dashboard.router)
router.include_router(reasonableness.router)
router.include_router(alarm_buildings.router)
router.include_router(alarm_zones.router)
router.include_router(alarm_rules.router)

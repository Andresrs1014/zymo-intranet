from fastapi import APIRouter

from app.routers.mantenimiento import aprobaciones, config, kpis, mobile, oc_vinculada, portal, solicitudes

router = APIRouter(prefix="/api/mantenimiento")

router.include_router(config.router)
router.include_router(solicitudes.router)
router.include_router(oc_vinculada.router)
router.include_router(aprobaciones.router)
router.include_router(mobile.router)
router.include_router(portal.router)
router.include_router(kpis.router)

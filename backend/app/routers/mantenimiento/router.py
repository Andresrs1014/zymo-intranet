from fastapi import APIRouter

from app.routers.mantenimiento import aprobaciones, config, escalamiento, kpis, mobile, oc_vinculada, pares_externos, pool, portal, solicitudes

router = APIRouter(prefix="/api/mantenimiento")

router.include_router(config.router)
router.include_router(solicitudes.router)
router.include_router(oc_vinculada.router)
router.include_router(aprobaciones.router)
router.include_router(mobile.router)
router.include_router(portal.router)
router.include_router(pares_externos.router)
router.include_router(pool.router)
router.include_router(escalamiento.router)
router.include_router(kpis.router)

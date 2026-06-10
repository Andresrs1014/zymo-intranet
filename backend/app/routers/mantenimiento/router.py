from fastapi import APIRouter

from app.routers.mantenimiento import config, solicitudes, oc_vinculada

router = APIRouter(prefix="/api/mantenimiento")

router.include_router(config.router)
router.include_router(solicitudes.router)
router.include_router(oc_vinculada.router)

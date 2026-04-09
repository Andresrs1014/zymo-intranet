from fastapi import APIRouter

from app.routers.oc import solicitudes, proveedores, webhook, cotizaciones

router = APIRouter(prefix="/api/oc")

router.include_router(solicitudes.router)
router.include_router(cotizaciones.router)
router.include_router(proveedores.router)
router.include_router(webhook.router)

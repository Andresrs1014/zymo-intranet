from fastapi import APIRouter

from app.routers.oc import solicitudes, proveedores, webhook, cotizaciones, documentos, kpis, config, paquetes, shared

router = APIRouter(prefix="/api/oc")

router.include_router(shared.router)
router.include_router(solicitudes.router)
router.include_router(cotizaciones.router)
router.include_router(proveedores.router)
router.include_router(webhook.router)
router.include_router(documentos.router)
router.include_router(kpis.router)
router.include_router(config.router)
router.include_router(paquetes.router)

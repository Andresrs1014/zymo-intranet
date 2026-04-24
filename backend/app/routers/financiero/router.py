from fastapi import APIRouter

from app.routers.financiero import config, facturas

router = APIRouter(prefix="/api/financiero")
router.include_router(facturas.router)
router.include_router(config.router)

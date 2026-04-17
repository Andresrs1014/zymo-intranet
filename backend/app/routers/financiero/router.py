from fastapi import APIRouter

from app.routers.financiero import facturas

router = APIRouter(prefix="/api/financiero")
router.include_router(facturas.router)

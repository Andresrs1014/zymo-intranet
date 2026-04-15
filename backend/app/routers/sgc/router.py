from fastapi import APIRouter

from app.routers.sgc.proveedores import router as proveedores_router

router = APIRouter(prefix="/api/sgc")
router.include_router(proveedores_router)

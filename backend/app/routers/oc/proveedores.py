"""
OC — Proveedores (lectura desde SGC)
=====================================
Este endpoint retorna los proveedores activos gestionados por SGC.
SGC es el dueño del catálogo; OC solo lo consume para el selector de cotizaciones.

Para crear o editar proveedores, usar /api/sgc/proveedores.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.models.sgc import ProveedorSGC
from app.models.user import User
from app.sgc_database import get_sgc_db

router = APIRouter(prefix="/proveedores", tags=["OC - Proveedores"])


class ProveedorRead(BaseModel):
    """Subconjunto de campos del proveedor SGC que necesita OC."""
    id: uuid.UUID
    nombre: str
    nit: str | None
    email: str | None
    telefono: str | None
    categoria: str | None
    activo: bool
    created_at: datetime  # requerido por el tipo Proveedor en types/oc.ts

    class Config:
        from_attributes = True


@router.get("", response_model=list[ProveedorRead])
def list_proveedores(
    solo_activos: bool = Query(default=True),
    _: User = Depends(get_current_user),
    sgc_db: Session = Depends(get_sgc_db),
):
    """Lista proveedores de SGC. Por defecto solo los activos (para el selector de OC)."""
    query = select(ProveedorSGC)
    if solo_activos:
        query = query.where(ProveedorSGC.activo == True)  # noqa: E712
    query = query.order_by(ProveedorSGC.nombre)
    return sgc_db.exec(query).all()

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_oc_config_access
from app.models.mantenimiento import TipoMantenimientoConfig
from app.models.user import User
from app.oc_database import get_oc_db

log = logging.getLogger(__name__)
router = APIRouter(prefix="/config", tags=["Mantenimiento - Config"])


class TipoMantenimientoOut(BaseModel):
    id: int
    nombre: str
    activo: bool
    orden: int


class TipoMantenimientoCreate(BaseModel):
    nombre: str
    orden: int = 0


class TipoMantenimientoUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None
    orden: Optional[int] = None


@router.get("/tipos", response_model=list[TipoMantenimientoOut])
def listar_tipos(
    solo_activos: bool = True,
    db: Session = Depends(get_oc_db),
    _: User = Depends(get_current_user),
):
    """Lista los tipos de mantenimiento configurados. Por defecto solo activos."""
    stmt = select(TipoMantenimientoConfig).order_by(
        TipoMantenimientoConfig.orden, TipoMantenimientoConfig.nombre
    )
    if solo_activos:
        stmt = stmt.where(TipoMantenimientoConfig.activo == True)  # noqa: E712
    return db.exec(stmt).all()


@router.post("/tipos", response_model=TipoMantenimientoOut, status_code=status.HTTP_201_CREATED)
def crear_tipo(
    body: TipoMantenimientoCreate,
    db: Session = Depends(get_oc_db),
    _: User = Depends(require_oc_config_access),
):
    tipo = TipoMantenimientoConfig(nombre=body.nombre.strip(), orden=body.orden)
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    log.info("Tipo de mantenimiento creado: %s", tipo.nombre)
    return tipo


@router.patch("/tipos/{tipo_id}", response_model=TipoMantenimientoOut)
def actualizar_tipo(
    tipo_id: int,
    body: TipoMantenimientoUpdate,
    db: Session = Depends(get_oc_db),
    _: User = Depends(require_oc_config_access),
):
    tipo = db.get(TipoMantenimientoConfig, tipo_id)
    if not tipo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo no encontrado.")
    if body.nombre is not None:
        tipo.nombre = body.nombre.strip()
    if body.activo is not None:
        tipo.activo = body.activo
    if body.orden is not None:
        tipo.orden = body.orden
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    return tipo


@router.delete("/tipos/{tipo_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_tipo(
    tipo_id: int,
    db: Session = Depends(get_oc_db),
    _: User = Depends(require_oc_config_access),
):
    """Soft delete — desactiva el tipo sin borrar historial."""
    tipo = db.get(TipoMantenimientoConfig, tipo_id)
    if not tipo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo no encontrado.")
    tipo.activo = False
    db.add(tipo)
    db.commit()

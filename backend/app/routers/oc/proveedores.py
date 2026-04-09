import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.models.oc import Proveedor
from app.models.user import User

router = APIRouter(prefix="/proveedores", tags=["OC - Proveedores"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProveedorCreate(BaseModel):
    nombre: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    nit: Optional[str] = None
    categoria: Optional[str] = None


class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    nit: Optional[str] = None
    categoria: Optional[str] = None
    activo: Optional[bool] = None


class ProveedorRead(BaseModel):
    id: uuid.UUID
    nombre: str
    email: Optional[str]
    telefono: Optional[str]
    nit: Optional[str]
    categoria: Optional[str]
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProveedorRead])
def list_proveedores(
    solo_activos: bool = Query(default=True),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(Proveedor)
    if solo_activos:
        query = query.where(Proveedor.activo == True)  # noqa: E712
    query = query.order_by(Proveedor.nombre)
    return db.exec(query).all()


@router.post("", response_model=ProveedorRead, status_code=status.HTTP_201_CREATED)
def create_proveedor(
    payload: ProveedorCreate,
    _: User = Depends(require_compras),
    db: Session = Depends(get_db),
):
    existing = db.exec(select(Proveedor).where(Proveedor.nombre == payload.nombre)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un proveedor con el nombre '{payload.nombre}'.",
        )
    proveedor = Proveedor(**payload.model_dump())
    db.add(proveedor)
    db.commit()
    db.refresh(proveedor)
    return proveedor


@router.put("/{proveedor_id}", response_model=ProveedorRead)
def update_proveedor(
    proveedor_id: uuid.UUID,
    payload: ProveedorUpdate,
    _: User = Depends(require_compras),
    db: Session = Depends(get_db),
):
    proveedor = db.get(Proveedor, proveedor_id)
    if not proveedor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado.")

    data = payload.model_dump(exclude_unset=True)

    if "nombre" in data and data["nombre"] != proveedor.nombre:
        conflict = db.exec(select(Proveedor).where(Proveedor.nombre == data["nombre"])).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un proveedor con el nombre '{data['nombre']}'.",
            )

    for field, value in data.items():
        setattr(proveedor, field, value)

    db.add(proveedor)
    db.commit()
    db.refresh(proveedor)
    return proveedor

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.oc_database import get_oc_db
from app.models.oc import PaqueteSolicitud
from app.models.user import User

router = APIRouter(prefix="/paquetes", tags=["OC - Paquetes"])

_ROLES_ADMIN = {"admin", "compras", "administrativo", "directivo"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class PaqueteItemCreate(BaseModel):
    nivel_prioridad: str = "Media"
    categoria: Optional[str] = None
    grupo_articulos: Optional[str] = None
    descripcion: str
    cantidad: int = 1
    plataforma: str
    cliente: Optional[str] = None
    condicion: Optional[str] = None
    placa_ficha: Optional[str] = None
    observaciones_solicitante: Optional[str] = None


class PaqueteCreate(BaseModel):
    nombre: str
    descripcion_uso: Optional[str] = None
    items: list[PaqueteItemCreate]


class PaqueteUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion_uso: Optional[str] = None
    items: Optional[list[PaqueteItemCreate]] = None


class PaqueteRead(BaseModel):
    id: uuid.UUID
    nombre: str
    descripcion_uso: Optional[str]
    creado_por_id: int
    creado_por_nombre: str
    items: list
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_admin_or_compras(user: User) -> bool:
    return user.role in _ROLES_ADMIN or user.area == "Compras"


def _assert_can_modify(paquete: PaqueteSolicitud, current_user: User) -> None:
    """Lanza 403 si el usuario no es el creador ni tiene rol admin/compras."""
    if paquete.creado_por_id != current_user.id and not _is_admin_or_compras(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el creador o un administrador puede modificar este paquete.",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[PaqueteRead])
def list_paquetes(
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
) -> list[PaqueteSolicitud]:
    """Lista paquetes activos.
    - Admin/compras ven todos los paquetes activos.
    - Cualquier otro usuario solo ve sus propios paquetes activos.
    """
    query = select(PaqueteSolicitud).where(PaqueteSolicitud.activo == True)  # noqa: E712
    if not _is_admin_or_compras(current_user):
        query = query.where(PaqueteSolicitud.creado_por_id == current_user.id)
    query = query.order_by(PaqueteSolicitud.created_at.desc())
    return oc_db.exec(query).all()


@router.post("", response_model=PaqueteRead, status_code=status.HTTP_201_CREATED)
def crear_paquete(
    payload: PaqueteCreate,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
) -> PaqueteSolicitud:
    """Crea un nuevo paquete de solicitudes. Cualquier usuario autenticado puede crear paquetes."""
    now = datetime.now(timezone.utc)
    paquete = PaqueteSolicitud(
        nombre=payload.nombre,
        descripcion_uso=payload.descripcion_uso,
        creado_por_id=current_user.id,
        creado_por_nombre=current_user.full_name,
        items=[item.model_dump() for item in payload.items],
        activo=True,
        created_at=now,
        updated_at=now,
    )
    oc_db.add(paquete)
    oc_db.commit()
    oc_db.refresh(paquete)
    return paquete


@router.get("/{paquete_id}", response_model=PaqueteRead)
def get_paquete(
    paquete_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
) -> PaqueteSolicitud:
    paquete = oc_db.get(PaqueteSolicitud, paquete_id)
    if not paquete or not paquete.activo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paquete no encontrado.")
    # Solo el creador o admin/compras puede ver el detalle
    if paquete.creado_por_id != current_user.id and not _is_admin_or_compras(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este paquete.")
    return paquete


@router.patch("/{paquete_id}", response_model=PaqueteRead)
def actualizar_paquete(
    paquete_id: uuid.UUID,
    payload: PaqueteUpdate,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
) -> PaqueteSolicitud:
    paquete = oc_db.get(PaqueteSolicitud, paquete_id)
    if not paquete or not paquete.activo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paquete no encontrado.")
    _assert_can_modify(paquete, current_user)

    if payload.nombre is not None:
        paquete.nombre = payload.nombre
    if payload.descripcion_uso is not None:
        paquete.descripcion_uso = payload.descripcion_uso
    if payload.items is not None:
        paquete.items = [item.model_dump() for item in payload.items]
    paquete.updated_at = datetime.now(timezone.utc)

    oc_db.add(paquete)
    oc_db.commit()
    oc_db.refresh(paquete)
    return paquete


@router.delete("/{paquete_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_paquete(
    paquete_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
) -> None:
    """Soft-delete: marca el paquete como inactivo."""
    paquete = oc_db.get(PaqueteSolicitud, paquete_id)
    if not paquete or not paquete.activo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paquete no encontrado.")
    _assert_can_modify(paquete, current_user)

    paquete.activo = False
    paquete.updated_at = datetime.now(timezone.utc)
    oc_db.add(paquete)
    oc_db.commit()

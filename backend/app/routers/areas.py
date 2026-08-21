from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_admin
from app.database import get_db
from app.models.area import Area
from app.models.user import User
from app.personal_database import PtcPersona, get_personal_engine

router = APIRouter(prefix="/areas", tags=["Areas"])


class AreaCreate(BaseModel):
    name: str


class AreaUpdate(BaseModel):
    name: str


class AreaRead(BaseModel):
    id: int
    name: str


class PersonaAfectada(BaseModel):
    id: int
    nombre: str


class AreaEnUso(BaseModel):
    directorio: list[PersonaAfectada]
    cuentas: list[PersonaAfectada]


@router.get("", response_model=list[AreaRead])
def list_areas(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.exec(select(Area).order_by(Area.name)).all()


@router.post("", response_model=AreaRead, status_code=status.HTTP_201_CREATED)
def create_area(
    payload: AreaCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.exec(select(Area).where(Area.name == payload.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un área con el nombre '{payload.name}'.",
        )
    area = Area(name=payload.name)
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.patch("/{area_id}", response_model=AreaRead)
def update_area(
    area_id: int,
    payload: AreaUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    area = db.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Área no encontrada.")
    conflict = db.exec(select(Area).where(Area.name == payload.name)).first()
    if conflict and conflict.id != area_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un área con el nombre '{payload.name}'.",
        )
    area.name = payload.name
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.get("/{area_id}/en-uso", response_model=AreaEnUso)
def area_en_uso(
    area_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Personas que quedarían sin área si se borra — para el mensaje de confirmación."""
    area = db.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Área no encontrada.")

    cuentas = db.exec(select(User).where(User.area == area.name)).all()
    with Session(get_personal_engine()) as pdb:
        personas = pdb.exec(select(PtcPersona).where(PtcPersona.area_id == area_id)).all()

    return {
        "directorio": [{"id": p.id, "nombre": p.nombre} for p in personas],
        "cuentas": [{"id": u.id, "nombre": u.full_name or u.email} for u in cuentas],
    }


@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    area_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    area = db.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Área no encontrada.")

    # Desvincula en vez de bloquear — el usuario ya confirmó contra /en-uso.
    for user in db.exec(select(User).where(User.area == area.name)).all():
        user.area = None
        db.add(user)
    db.commit()

    with Session(get_personal_engine()) as pdb:
        for persona in pdb.exec(select(PtcPersona).where(PtcPersona.area_id == area_id)).all():
            persona.area_id = None
            pdb.add(persona)
        pdb.commit()

    db.delete(area)
    db.commit()

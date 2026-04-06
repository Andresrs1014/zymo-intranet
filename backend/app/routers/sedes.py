from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_admin
from app.database import get_db
from app.models.sede import Sede
from app.models.user import User

router = APIRouter(prefix="/sedes", tags=["Sedes"])


class SedeCreate(BaseModel):
    name: str


class SedeUpdate(BaseModel):
    name: str


class SedeRead(BaseModel):
    id: int
    name: str


@router.get("", response_model=list[SedeRead])
def list_sedes(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.exec(select(Sede).order_by(Sede.name)).all()


@router.post("", response_model=SedeRead, status_code=status.HTTP_201_CREATED)
def create_sede(
    payload: SedeCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.exec(select(Sede).where(Sede.name == payload.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una sede con el nombre '{payload.name}'.",
        )
    sede = Sede(name=payload.name)
    db.add(sede)
    db.commit()
    db.refresh(sede)
    return sede


@router.patch("/{sede_id}", response_model=SedeRead)
def update_sede(
    sede_id: int,
    payload: SedeUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    sede = db.get(Sede, sede_id)
    if not sede:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sede no encontrada.")
    conflict = db.exec(select(Sede).where(Sede.name == payload.name)).first()
    if conflict and conflict.id != sede_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una sede con el nombre '{payload.name}'.",
        )
    sede.name = payload.name
    db.add(sede)
    db.commit()
    db.refresh(sede)
    return sede


@router.delete("/{sede_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sede(
    sede_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    sede = db.get(Sede, sede_id)
    if not sede:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sede no encontrada.")

    in_use = db.exec(select(User).where(User.sede == sede.name)).first()
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La sede '{sede.name}' está asignada a uno o más usuarios y no puede eliminarse.",
        )

    db.delete(sede)
    db.commit()

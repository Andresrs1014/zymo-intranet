from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_admin
from app.database import get_db
from app.models.area import Area
from app.models.user import User

router = APIRouter(prefix="/areas", tags=["Areas"])


class AreaCreate(BaseModel):
    name: str


class AreaUpdate(BaseModel):
    name: str


class AreaRead(BaseModel):
    id: int
    name: str


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


@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    area_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    area = db.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Área no encontrada.")

    in_use = db.exec(select(User).where(User.area == area.name)).first()
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El área '{area.name}' está asignada a uno o más usuarios y no puede eliminarse.",
        )

    db.delete(area)
    db.commit()

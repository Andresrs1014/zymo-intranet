from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, or_, select

from app.core.deps import require_compras
from app.database import get_db
from app.models.user import User

router = APIRouter(tags=["OC - Shared"])


class UsuarioBasico(BaseModel):
    id: int
    full_name: str
    email: str
    area: Optional[str]
    role: str


_ROLES_COMPRAS = ["admin", "compras", "administrativo", "directivo"]


@router.get("/usuarios-compras", response_model=list[UsuarioBasico])
def list_usuarios_compras(
    current_user: User = Depends(require_compras),
    db: Session = Depends(get_db),
):
    """Lista usuarios activos del equipo de compras (por rol o por área)."""
    usuarios = db.exec(
        select(User)
        .where(
            User.is_active == True,  # noqa: E712
            or_(
                User.role.in_(_ROLES_COMPRAS),
                User.area == "Compras",
            ),
        )
        .order_by(User.full_name)
    ).all()
    return usuarios

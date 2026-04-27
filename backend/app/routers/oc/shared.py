from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, or_, select

from app.core.deps import require_compras
from app.core.permissions import role_names_with_permission
from app.database import get_db
from app.models.user import User

router = APIRouter(tags=["OC - Shared"])


class UsuarioBasico(BaseModel):
    id: int
    full_name: str
    email: str
    area: Optional[str]
    role: str


@router.get("/usuarios-compras", response_model=list[UsuarioBasico])
def list_usuarios_compras(
    current_user: User = Depends(require_compras),
    db: Session = Depends(get_db),
):
    """Lista usuarios activos con permiso de OC (mod_oc_ver) o área Compras (compat.)."""
    role_names = role_names_with_permission(db, "mod_oc_ver")
    usuarios = db.exec(
        select(User)
        .where(
            User.is_active == True,  # noqa: E712
            or_(
                User.role.in_(role_names),
                User.area == "Compras",
            ),
        )
        .order_by(User.full_name)
    ).all()
    return usuarios


import json as _json
from pathlib import Path as _Path

_PLATFORMS_DIR_SHARED = _Path(__file__).parent.parent.parent / "platforms"


@router.get("/plataformas")
def listar_plataformas():
    """Retorna las plataformas OC disponibles (leídas desde el filesystem de platforms/)."""
    plataformas = []
    if not _PLATFORMS_DIR_SHARED.exists():
        return plataformas
    for slug_dir in sorted(_PLATFORMS_DIR_SHARED.iterdir()):
        if not slug_dir.is_dir():
            continue
        cfg_path = slug_dir / "config.json"
        nombre = slug_dir.name.upper()
        if cfg_path.exists():
            try:
                cfg = _json.loads(cfg_path.read_text(encoding="utf-8"))
                nombre = cfg.get("nombre", nombre)
            except Exception:
                pass
        plataformas.append({"slug": slug_dir.name, "nombre": nombre})
    return plataformas

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from jose.exceptions import JWTError
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import Optional

from app.config import settings
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.database import get_db
from app.models.user import User
from app.models.user_tool import UserTool

router = APIRouter(prefix="/api/tasks-v2", tags=["Tareas V2"])


class TaskUserRead(BaseModel):
    id: int
    full_name: str | None
    email: str


def _is_valid_internal_key(key: Optional[str]) -> bool:
    return bool(key and settings.internal_key and key == settings.internal_key)


@router.get("/users", response_model=list[TaskUserRead])
def list_task_users(
    request: Request,
    x_internal_key: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> list[TaskUserRead]:
    """
    Retorna todos los usuarios activos de la intranet.
    Acepta X-Internal-Key (service-to-service) o JWT de usuario autenticado.
    """
    # Permitir acceso con clave interna (task-backend, helix-backend, etc.)
    if _is_valid_internal_key(x_internal_key):
        pass  # authorized
    else:
        # Fallback: validar JWT de usuario
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(status_code=401, detail="No autorizado")
        try:
            payload = decode_token(token)
            email = payload.get("sub")
            user = db.exec(select(User).where(User.email == email, User.is_active == True)).first()  # noqa: E712
            if not user:
                raise HTTPException(status_code=401, detail="No autorizado")
        except JWTError:
            raise HTTPException(status_code=401, detail="Token inválido")

    users = db.exec(select(User).where(User.is_active == True)).all()  # noqa: E712
    return [
        TaskUserRead(id=int(u.id), full_name=u.full_name, email=u.email)
        for u in users
    ]


@router.post("/users/{user_id}/activate-submit")
def activate_submit_tool(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Activa tool_task_submit para un usuario si no lo tiene aún.
    Llamado por task-backend cuando se agrega un miembro a un equipo.
    """
    user = db.exec(select(User).where(User.id == user_id, User.is_active == True)).first()  # noqa: E712
    if not user:
        return {"success": False, "reason": "user_not_found"}

    existing = db.exec(
        select(UserTool).where(
            UserTool.user_id == user_id,
            UserTool.tool_key == "tool_task_submit",
        )
    ).first()

    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.add(existing)
            db.commit()
        return {"success": True}

    db.add(UserTool(user_id=user_id, tool_key="tool_task_submit", is_active=True))
    db.commit()
    return {"success": True}

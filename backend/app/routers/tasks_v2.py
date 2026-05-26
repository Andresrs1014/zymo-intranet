from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.user_tool import UserTool

router = APIRouter(prefix="/api/tasks-v2", tags=["Tareas V2"])


class TaskUserRead(BaseModel):
    id: int
    full_name: str | None
    email: str


@router.get("/users", response_model=list[TaskUserRead])
def list_task_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskUserRead]:
    """
    Retorna todos los usuarios activos de la intranet.
    Usado por task-backend para listar candidatos para agregar a un equipo.
    """
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

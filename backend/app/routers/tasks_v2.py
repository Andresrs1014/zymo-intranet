from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.user_tool import UserTool

router = APIRouter(prefix="/api/tasks-v2", tags=["Tareas V2"])

_TASK_TOOLS = {"tool_task_submit", "tool_task_manage_dev"}


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
    Retorna usuarios activos que tienen tool_task_submit o tool_task_manage_dev.
    Usado por task-backend para listar colaboradores disponibles.
    """
    tool_rows = db.exec(
        select(UserTool.user_id).where(
            UserTool.tool_key.in_(list(_TASK_TOOLS)),
            UserTool.is_active == True,  # noqa: E712
        )
    ).all()
    eligible_ids: set[int] = {int(uid) for uid in tool_rows}

    users = db.exec(select(User).where(User.is_active == True)).all()  # noqa: E712
    return [
        TaskUserRead(id=int(u.id), full_name=u.full_name, email=u.email)
        for u in users
        if u.id in eligible_ids
    ]

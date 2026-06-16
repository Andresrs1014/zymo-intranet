"""
Router — Gestión de UserTools (permisos de herramientas).

Prefijo: /api/admin
Acceso: solo rol 'admin'.
Permite asignar y revocar tools como tool_task_manage_dev / tool_task_submit_dev.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.models.user_tool import UserTool

router = APIRouter(prefix="/api/admin", tags=["Admin - User Tools"])


class AssignUserToolPayload(BaseModel):
    user_id: int
    tool_key: str
    scope: str = "global"


@router.get("/user-tools/{user_id}")
def get_user_tools(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[str]:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol 'admin'.")
    rows = db.exec(
        select(UserTool)
        .where(UserTool.user_id == user_id)
        .where(UserTool.is_active == True)  # noqa: E712
    ).all()
    return [r.tool_key for r in rows]


@router.post("/asignar-tool")
def assign_user_tool(
    payload: AssignUserToolPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol 'admin'.")

    existing = db.exec(
        select(UserTool)
        .where(UserTool.user_id == payload.user_id)
        .where(UserTool.tool_key == payload.tool_key)
        .where(UserTool.scope == payload.scope)
    ).first()

    if existing:
        existing.is_active = True
        existing.updated_at = datetime.now(timezone.utc)
        db.add(existing)
    else:
        db.add(UserTool(user_id=payload.user_id, tool_key=payload.tool_key, scope=payload.scope))

    db.commit()
    return {"ok": True}


@router.delete("/revocar-tool")
def revoke_user_tool(
    payload: AssignUserToolPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol 'admin'.")

    rows = db.exec(
        select(UserTool)
        .where(UserTool.user_id == payload.user_id)
        .where(UserTool.tool_key == payload.tool_key)
        .where(UserTool.is_active == True)  # noqa: E712
    ).all()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Herramienta no encontrada para este usuario.")
    now = datetime.now(timezone.utc)
    for row in rows:
        row.is_active = False
        row.updated_at = now
        db.add(row)
    db.commit()
    return {"ok": True}

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.user import User
from app.models.user_tool import UserTool


def user_has_tool(db: Session, user: User, tool_key: str, scope: str | None = None) -> bool:
    query = select(UserTool).where(
        UserTool.user_id == user.id,
        UserTool.tool_key == tool_key,
        UserTool.is_active == True,  # noqa: E712
    )
    if scope is not None:
        query = query.where(UserTool.scope == scope)
    return db.exec(query).first() is not None


def require_tool_or_403(
    db: "Session",
    user: "User",
    tool_key: str,
    scope: str | None = None,
) -> None:
    """
    Acceso si el usuario tiene la tool activa en user_tools.
    No bypass por rol admin — en herramientas de tareas el admin usa su propio workspace.
    """
    if user_has_tool(db, user, tool_key, scope=scope):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Acceso denegado. Se requiere herramienta '{tool_key}'.",
    )


def ensure_user_has_tool(
    db: "Session",
    user_id: int,
    tool_key: str,
    scope: str = "global",
    *,
    do_commit: bool = True,
) -> None:
    """Crea o reactiva una tool para el usuario."""
    from datetime import datetime, timezone

    existing = db.exec(
        select(UserTool).where(
            UserTool.user_id == user_id,
            UserTool.tool_key == tool_key,
        )
    ).first()

    now = datetime.now(timezone.utc)
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.updated_at = now
            existing.scope = scope
            db.add(existing)
    else:
        db.add(
            UserTool(
                user_id=user_id,
                tool_key=tool_key,
                scope=scope,
                is_active=True,
            )
        )
    if do_commit:
        db.commit()
    else:
        db.flush()


def deactivate_user_tool(
    db: "Session",
    user_id: int,
    tool_key: str,
    *,
    do_commit: bool = True,
) -> None:
    """Desactiva una tool sin borrarla (p. ej. co-gestor)."""
    from datetime import datetime, timezone

    existing = db.exec(
        select(UserTool).where(
            UserTool.user_id == user_id,
            UserTool.tool_key == tool_key,
        )
    ).first()
    if existing and existing.is_active:
        existing.is_active = False
        existing.updated_at = datetime.now(timezone.utc)
        db.add(existing)
    if do_commit:
        db.commit()
    else:
        db.flush()


def ensure_submit_access_on_team_add(db: "Session", user_id: int) -> None:
    """Activa submit al incorporar al equipo; no reactiva si un admin revocó explícitamente."""
    existing = db.exec(
        select(UserTool).where(
            UserTool.user_id == user_id,
            UserTool.tool_key == "tool_task_submit_dev",
        )
    ).first()
    if existing is not None and not existing.is_active:
        return
    ensure_user_has_tool(db, user_id, "tool_task_submit_dev")
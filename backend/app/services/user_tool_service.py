from datetime import datetime, timezone
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


def ensure_user_has_tool(db: Session, user_id: int, tool_key: str, scope: str = "global") -> None:
    """
    Asegura que un usuario tenga la tool activa. La crea si no existe.
    Si ya existe (activa o inactiva), la reactiva y actualiza el scope.
    """
    existing = db.exec(
        select(UserTool).where(
            UserTool.user_id == user_id,
            UserTool.tool_key == tool_key,
        )
    ).first()

    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.scope = scope
            existing.updated_at = datetime.now(timezone.utc)
            db.add(existing)
            db.commit()
    else:
        new_tool = UserTool(
            user_id=user_id,
            tool_key=tool_key,
            scope=scope,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(new_tool)
        db.commit()


def require_tool_or_403(
    db: "Session",
    user: "User",
    tool_key: str,
    scope: str | None = None,
) -> None:
    """
    Permite acceso si el usuario:
    - Es admin (bypass total), O
    - Tiene la tool activa en user_tools (scope ignorado si es None).
    """
    if getattr(user, "role", None) == "admin":
        return

    record = user_has_tool(db, user, tool_key, scope=scope)
    if record:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Acceso denegado. Se requiere herramienta '{tool_key}'.",
    )
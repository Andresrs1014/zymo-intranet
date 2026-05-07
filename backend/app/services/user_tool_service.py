from sqlmodel import Session, select

from app.models.user_tool import UserTool
from app.models.user import User


def user_has_tool(db: Session, user: User, tool_key: str, scope: str = "global") -> bool:
    tool = db.exec(
        select(UserTool)
        .where(UserTool.user_id == user.id)
        .where(UserTool.tool_key == tool_key)
        .where(UserTool.scope == scope)
        .where(UserTool.is_active == True)  # noqa: E712
    ).first()
    return tool is not None


def require_tool_or_403(db: Session, user: User, tool_key: str, scope: str) -> None:
    from fastapi import HTTPException, status

    if not user_has_tool(db, user, tool_key, scope):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes esta herramienta asignada.",
        )

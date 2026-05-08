from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.user import User
from app.models.user_tool import UserTool


def user_has_tool(db: Session, user: User, tool_key: str, scope: str = "global") -> bool:
    tool = db.exec(
        select(UserTool)
        .where(UserTool.user_id == user.id)
        .where(UserTool.tool_key == tool_key)
        .where(UserTool.scope == scope)
        .where(UserTool.is_active == True)  # noqa: E712
    ).first()
    return tool is not None


def require_tool_or_403(
    db: "Session",
    user: "User",
    tool_key: str,
    scope: str,
) -> None:
    """
    Permite acceso si el usuario:
    - Es admin (bypass total), O
    - Tiene la tool activa en user_tools, O
    - Es miembro activo del equipo (para tool_task_submit_dev)
    """
    from app.models.task_team_member import TaskTeamMember
    from app.models.task_team import TaskTeam

    if getattr(user, "role", None) == "admin":
        return

    # Verificar tool directa
    record = db.exec(
        select(UserTool).where(
            UserTool.user_id == user.id,
            UserTool.tool_key == tool_key,
            UserTool.scope == scope,
            UserTool.is_active == True,  # noqa: E712
        )
    ).first()
    if record:
        return

    # Para submit: membresía activa en el equipo también da acceso
    if tool_key == "tool_task_submit_dev":
        team = db.exec(
            select(TaskTeam).where(
                TaskTeam.scope == scope,
                TaskTeam.is_active == True,  # noqa: E712
            )
        ).first()
        if team:
            member = db.exec(
                select(TaskTeamMember).where(
                    TaskTeamMember.team_id == team.id,
                    TaskTeamMember.user_id == user.id,
                    TaskTeamMember.is_active == True,  # noqa: E712
                )
            ).first()
            if member:
                return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Acceso denegado. Se requiere herramienta '{tool_key}' o membresía en el equipo.",
    )

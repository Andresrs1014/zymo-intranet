from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models.task_team import TaskTeam
from app.models.task_team_member import TaskTeamMember
from app.models.user import User

TOOL_MANAGE = "tool_task_manage_dev"
TOOL_SUBMIT = "tool_task_submit_dev"


def get_or_create_manager_team(db: Session, owner_id: int) -> TaskTeam:
    team = db.exec(
        select(TaskTeam)
        .where(TaskTeam.owner_user_id == owner_id)
        .where(TaskTeam.is_active == True)  # noqa: E712
    ).first()
    if team:
        return team

    now = datetime.now(timezone.utc)
    team = TaskTeam(
        owner_user_id=owner_id,
        name="Mi equipo",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


def get_manager_team(db: Session, owner_id: int) -> TaskTeam | None:
    return db.exec(
        select(TaskTeam)
        .where(TaskTeam.owner_user_id == owner_id)
        .where(TaskTeam.is_active == True)  # noqa: E712
    ).first()


def resolve_task_workspace_owner_id(db: Session, user: User) -> int | None:
    """Dueño del workspace: propio equipo, co-gestor (role=manager), o primera visita como gestor."""
    owned = db.exec(
        select(TaskTeam)
        .where(TaskTeam.owner_user_id == user.id)
        .where(TaskTeam.is_active == True)  # noqa: E712
    ).first()
    if owned:
        return user.id

    row = db.exec(
        select(TaskTeamMember, TaskTeam)
        .join(TaskTeam, TaskTeamMember.team_id == TaskTeam.id)
        .where(TaskTeamMember.user_id == user.id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
        .where(TaskTeamMember.role == "manager")
        .where(TaskTeam.is_active == True)  # noqa: E712
    ).first()
    if row:
        return row[1].owner_user_id

    from app.services.user_tool_service import user_has_tool

    if user_has_tool(db, user, TOOL_MANAGE):
        return user.id
    return None


def is_workspace_owner(db: Session, team_owner_id: int, user_id: int) -> bool:
    return team_owner_id == user_id


def get_active_member_ids(db: Session, owner_id: int) -> list[int]:
    team = get_or_create_manager_team(db, owner_id)
    members = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).all()
    return [m.user_id for m in members]


def get_workspace_scope_user_ids(db: Session, owner_id: int) -> list[int]:
    """Responsables cuyas tareas cuentan en el workspace: dueño + miembros activos."""
    ids = set(get_active_member_ids(db, owner_id))
    ids.add(owner_id)
    return list(ids)


def list_team_members(db: Session, owner_id: int) -> list[tuple[TaskTeamMember, User]]:
    team = get_or_create_manager_team(db, owner_id)
    members = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).all()

    member_ids = [m.user_id for m in members]
    users_map: dict[int, User] = {
        u.id: u
        for u in db.exec(select(User).where(User.id.in_(member_ids))).all()  # type: ignore[union-attr]
        if u.id is not None
    }
    return [(m, users_map[m.user_id]) for m in members if m.user_id in users_map]


def list_available_users(db: Session, owner_id: int) -> list[User]:
    active_member_ids = get_active_member_ids(db, owner_id)
    users = db.exec(
        select(User).where(User.is_active == True)  # noqa: E712
    ).all()
    return [u for u in users if u.id is not None and u.id not in active_member_ids]


def rename_workspace(db: Session, owner_id: int, new_name: str) -> TaskTeam:
    team = get_or_create_manager_team(db, owner_id)
    trimmed = new_name.strip()
    if not trimmed:
        return team
    team.name = trimmed[:150]
    team.updated_at = datetime.now(timezone.utc)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


def add_team_member(db: Session, user_id: int, owner_id: int) -> TaskTeamMember:
    from app.services.user_tool_service import ensure_submit_access_on_team_add

    team = get_or_create_manager_team(db, owner_id)
    now = datetime.now(timezone.utc)

    existing = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == user_id)
    ).first()

    if existing:
        existing.is_active = True
        # Reingreso al roster: siempre como miembro; el dueño puede volver a nombrar co-gestor.
        existing.role = "member"
        existing.updated_at = now
        db.add(existing)
        db.commit()
        db.refresh(existing)
        ensure_submit_access_on_team_add(db, user_id)
        return existing

    member = TaskTeamMember(
        team_id=team.id,
        user_id=user_id,
        role="member",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    ensure_submit_access_on_team_add(db, user_id)
    return member


def deactivate_team_member(db: Session, user_id: int, owner_id: int) -> None:
    """Saca al miembro de la vista del equipo; no borra tareas ni revoca tools (salvo co-gestión)."""
    team = get_or_create_manager_team(db, owner_id)
    member = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).first()

    if member:
        if member.role == "manager":
            from app.services.user_tool_service import deactivate_user_tool

            deactivate_user_tool(db, user_id, TOOL_MANAGE)
        member.is_active = False
        member.updated_at = datetime.now(timezone.utc)
        db.add(member)
        db.commit()


def set_member_role_for_owner(
    db: Session,
    owner_id: int,
    target_user_id: int,
    new_role: str,
    _acting_user_id: int,
) -> TaskTeamMember | None:
    """
    Solo el dueño del workspace puede nombrar o quitar co-gestores.
    new_role: 'member' | 'manager'
    """
    from app.services.user_tool_service import (
        deactivate_user_tool,
        ensure_user_has_tool,
    )

    if new_role not in ("member", "manager"):
        return None

    team = get_or_create_manager_team(db, owner_id)
    if team.owner_user_id != _acting_user_id:
        return None

    if target_user_id == owner_id:
        return None

    member = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == target_user_id)
    ).first()
    if not member or not member.is_active:
        return None

    now = datetime.now(timezone.utc)
    member.role = new_role
    member.updated_at = now
    db.add(member)

    if new_role == "manager":
        ensure_user_has_tool(db, target_user_id, TOOL_MANAGE, do_commit=False)
    else:
        deactivate_user_tool(db, target_user_id, TOOL_MANAGE, do_commit=False)

    db.commit()
    db.refresh(member)
    return member

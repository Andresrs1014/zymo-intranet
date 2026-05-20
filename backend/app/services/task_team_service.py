from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models.task_team import TaskTeam
from app.models.task_team_member import TaskTeamMember
from app.models.user import User


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
    return [u for u in users if u.id not in active_member_ids]


def add_team_member(db: Session, user_id: int, owner_id: int) -> TaskTeamMember:
    team = get_or_create_manager_team(db, owner_id)
    now = datetime.now(timezone.utc)

    existing = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == user_id)
    ).first()

    if existing:
        existing.is_active = True
        existing.role = "member"
        existing.updated_at = now
        db.add(existing)
        db.commit()
        db.refresh(existing)
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
    return member


def deactivate_team_member(db: Session, user_id: int, owner_id: int) -> None:
    team = get_or_create_manager_team(db, owner_id)
    member = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).first()

    if member:
        member.is_active = False
        member.updated_at = datetime.now(timezone.utc)
        db.add(member)
        db.commit()


def get_active_member_ids(db: Session, owner_id: int) -> list[int]:
    team = get_or_create_manager_team(db, owner_id)
    members = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).all()
    return [m.user_id for m in members]


def get_user_active_teams(db: Session, user_id: int) -> list[dict]:
    """Retorna todos los equipos donde el usuario tiene membresía activa.
    Un mismo equipo aparece una sola vez aunque existan filas duplicadas en task_team_members.
    """
    memberships = db.exec(
        select(TaskTeamMember, TaskTeam)
        .join(TaskTeam, TaskTeamMember.team_id == TaskTeam.id)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
        .where(TaskTeam.is_active == True)  # noqa: E712
    ).all()
    by_team_id: dict[int, dict] = {}
    for _membership, team in memberships:
        tid = team.id
        if tid is None or tid in by_team_id:
            continue
        by_team_id[tid] = {
            "team_id": team.id,
            "team_name": team.name,
            "owner_id": team.owner_user_id,
        }
    return [by_team_id[k] for k in sorted(by_team_id.keys())]


def update_team_display_name(db: Session, owner_id: int, name: str) -> TaskTeam:
    """Actualiza el nombre visible del equipo del gestor (o co-gestor vía owner_id)."""
    team = get_or_create_manager_team(db, owner_id)
    trimmed = name.strip()
    if not trimmed:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail="El nombre del equipo no puede estar vacío.")
    team.name = trimmed[:150]
    team.updated_at = datetime.now(timezone.utc)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


def get_comanaged_owner_id(db: Session, user_id: int) -> int | None:
    """Si el usuario es co_gestor en algún equipo activo, retorna el owner_user_id de ese equipo.
    Retorna None si el usuario no es co-gestor de ningún equipo.
    """
    membership = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.role == "co_gestor")
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).first()
    if not membership:
        return None
    team = db.get(TaskTeam, membership.team_id)
    return team.owner_user_id if team else None


def promote_to_cogestor(db: Session, user_id: int, owner_id: int) -> TaskTeamMember:
    """Promueve un miembro activo a co_gestor. Solo el gestor primario puede llamar esto."""
    team = get_or_create_manager_team(db, owner_id)
    member = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).first()
    if not member:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Miembro no encontrado en el equipo.")
    member.role = "co_gestor"
    member.updated_at = datetime.now(timezone.utc)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def demote_to_member(db: Session, user_id: int, owner_id: int) -> TaskTeamMember:
    """Degrada un co_gestor a miembro normal. Solo el gestor primario puede llamar esto."""
    team = get_or_create_manager_team(db, owner_id)
    member = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).first()
    if not member:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Miembro no encontrado en el equipo.")
    member.role = "member"
    member.updated_at = datetime.now(timezone.utc)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def get_manager_team_members(db: Session, manager_user_id: int) -> list:
    """Retorna los miembros activos del equipo gestionado por manager_user_id."""
    from app.models.task_team import TaskTeam
    from app.models.task_team_member import TaskTeamMember
    from app.models.user import User as UserModel
    from sqlmodel import select
    from app.schemas.task_team import TaskTeamMemberRead

    team = db.exec(
        select(TaskTeam).where(TaskTeam.owner_user_id == manager_user_id)
    ).first()

    if not team:
        return []

    rows = db.exec(
        select(TaskTeamMember, UserModel).join(
            UserModel, TaskTeamMember.user_id == UserModel.id
        ).where(
            TaskTeamMember.team_id == team.id,
            TaskTeamMember.is_active == True,  # noqa: E712
        )
    ).all()

    return [
        TaskTeamMemberRead(
            id=member.id,
            team_id=member.team_id,
            user_id=member.user_id,
            user_email=user.email,
            user_full_name=user.full_name,
            role=member.role,
            is_active=member.is_active,
            created_at=member.created_at,
        )
        for member, user in rows
    ]


def get_companeros(db: Session, user_id: int) -> list:
    """Retorna los compañeros de equipo activos del usuario, con datos de User."""
    from app.models.task_team_member import TaskTeamMember
    from app.models.user import User as UserModel
    from sqlmodel import select

    mis_memberships = db.exec(
        select(TaskTeamMember).where(
            TaskTeamMember.user_id == user_id,
            TaskTeamMember.is_active == True,  # noqa: E712
        )
    ).all()

    if not mis_memberships:
        return []

    team_ids = [m.team_id for m in mis_memberships]

    rows = db.exec(
        select(TaskTeamMember, UserModel).join(
            UserModel, TaskTeamMember.user_id == UserModel.id
        ).where(
            TaskTeamMember.team_id.in_(team_ids),
            TaskTeamMember.is_active == True,  # noqa: E712
            TaskTeamMember.user_id != user_id,
        )
    ).all()

    from app.schemas.task_team import TaskTeamMemberRead
    return [
        TaskTeamMemberRead(
            id=member.id,
            team_id=member.team_id,
            user_id=member.user_id,
            user_email=user.email,
            user_full_name=user.full_name,
            role=member.role,
            is_active=member.is_active,
            created_at=member.created_at,
        )
        for member, user in rows
    ]

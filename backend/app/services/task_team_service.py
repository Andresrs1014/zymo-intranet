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
    """Retorna todos los equipos donde el usuario tiene membresía activa."""
    memberships = db.exec(
        select(TaskTeamMember, TaskTeam)
        .join(TaskTeam, TaskTeamMember.team_id == TaskTeam.id)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).all()
    return [
        {
            "team_id": team.id,
            "team_name": team.name,
            "owner_id": team.owner_user_id,
        }
        for membership, team in memberships
    ]

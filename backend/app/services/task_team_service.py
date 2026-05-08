from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.constants import SCOPE_DEV
from app.models.task_team import TaskTeam
from app.models.task_team_member import TaskTeamMember
from app.models.user import User


def get_or_create_dev_team(db: Session) -> TaskTeam:
    """Gets or creates the 'Desarrollo e Innovación' team."""
    team = db.exec(
        select(TaskTeam)
        .where(TaskTeam.scope == SCOPE_DEV)
        .where(TaskTeam.is_active == True)  # noqa: E712
    ).first()
    if team:
        return team

    now = datetime.now(timezone.utc)
    team = TaskTeam(
        scope=SCOPE_DEV,
        name="Desarrollo e Innovación",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


def list_team_members(
    db: Session, scope: str = SCOPE_DEV
) -> list[tuple[TaskTeamMember, User]]:
    """Returns active team members with their User objects."""
    team = get_or_create_dev_team(db)
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


def list_available_users(db: Session, scope: str = SCOPE_DEV) -> list[User]:
    """Returns users not already active members of the team."""
    active_member_ids = get_active_member_ids(db, scope)
    users = db.exec(
        select(User).where(User.is_active == True)  # noqa: E712
    ).all()
    return [u for u in users if u.id not in active_member_ids]


def add_team_member(db: Session, user_id: int, scope: str = SCOPE_DEV) -> TaskTeamMember:
    """Adds user to team. Reactivates existing inactive member if found."""
    team = get_or_create_dev_team(db)
    now = datetime.now(timezone.utc)

    existing = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == user_id)
    ).first()

    if existing:
        existing.is_active = True
        existing.updated_at = now
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    member = TaskTeamMember(
        team_id=team.id,
        user_id=user_id,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def deactivate_team_member(db: Session, user_id: int, scope: str = SCOPE_DEV) -> None:
    """Marks member as inactive. Does NOT delete the row."""
    team = get_or_create_dev_team(db)
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


def get_active_member_ids(db: Session, scope: str = SCOPE_DEV) -> list[int]:
    """Returns list of user_ids of active team members."""
    team = get_or_create_dev_team(db)
    members = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).all()
    return [m.user_id for m in members]

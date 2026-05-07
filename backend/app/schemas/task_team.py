from datetime import datetime
from pydantic import BaseModel


class TaskTeamMemberRead(BaseModel):
    id: int
    team_id: int
    user_id: int
    user_email: str
    user_full_name: str | None
    is_active: bool
    created_at: datetime


class TaskTeamMemberCreate(BaseModel):
    user_id: int


class AvailableUserRead(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    area: str | None

from datetime import datetime
from pydantic import BaseModel


class TaskTeamMemberRead(BaseModel):
    id: int
    team_id: int
    user_id: int
    # user_email y user_full_name se rellenan desde User en el service layer (join), no son columnas de TaskTeamMember
    user_email: str
    user_full_name: str | None
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskTeamMemberCreate(BaseModel):
    user_id: int


class AvailableUserRead(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    area: str | None

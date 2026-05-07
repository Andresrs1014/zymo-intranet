from datetime import datetime
from pydantic import BaseModel


class UserToolRead(BaseModel):
    id: int
    user_id: int
    tool_key: str
    scope: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserToolCreate(BaseModel):
    user_id: int
    tool_key: str
    scope: str = "global"

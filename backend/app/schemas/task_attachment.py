from datetime import datetime

from pydantic import BaseModel


class TaskAttachmentRead(BaseModel):
    id: int
    task_id: int
    filename: str
    mime_type: str
    size_bytes: int
    uploaded_by_id: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class TaskAttachmentUploadResponse(BaseModel):
    ok: bool
    attachment: TaskAttachmentRead
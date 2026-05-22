import os
import uuid
from pathlib import Path
from typing import BinaryIO

from fastapi import HTTPException, UploadFile, status
from sqlmodel import Session, select

from app.models.task_attachment import TaskAttachment
from app.models.user import User


MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


def get_upload_dir(task_id: int) -> Path:
    # /app/data está mapeado como volumen persistente en docker-compose
    base = Path("/app/data/uploads/tasks")
    task_dir = base / str(task_id)
    task_dir.mkdir(parents=True, exist_ok=True)
    return task_dir


def validate_file(file: UploadFile) -> str:
    if file.size is not None and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo excede el tamaño máximo de {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    file.file.read(0)  # no-op peek para compatibilidad; el tipo se toma del header
    file.file.seek(0)

    return file.content_type or "application/octet-stream"


def create_attachment(
    db: Session,
    task_id: int,
    file: UploadFile,
    user: User,
) -> TaskAttachment:
    mime_type = validate_file(file)

    ext = os.path.splitext(file.filename or "")[1].lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"

    upload_dir = get_upload_dir(task_id)
    file_path = upload_dir / unique_name

    content = file.file.read()
    file.file.close()

    with open(file_path, "wb") as f:
        f.write(content)

    attachment = TaskAttachment(
        task_id=task_id,
        filename=file.filename or "archivo",
        file_path=str(file_path),
        mime_type=mime_type,
        size_bytes=len(content),
        uploaded_by_id=user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment


def list_attachments(db: Session, task_id: int) -> list[TaskAttachment]:
    return list(
        db.exec(
            select(TaskAttachment)
            .where(TaskAttachment.task_id == task_id)
            .order_by(TaskAttachment.uploaded_at.desc())
        ).all()
    )


def get_attachment(db: Session, attachment_id: int) -> TaskAttachment | None:
    return db.get(TaskAttachment, attachment_id)


def delete_attachment(db: Session, attachment_id: int) -> None:
    attachment = db.get(TaskAttachment, attachment_id)
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adjunto no encontrado.",
        )

    if os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)

    db.delete(attachment)
    db.commit()


def get_attachment_file(attachment: TaskAttachment) -> tuple[BinaryIO, str, int]:
    if not os.path.exists(attachment.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado en el servidor.",
        )

    f = open(attachment.file_path, "rb")
    return f, attachment.mime_type, attachment.size_bytes
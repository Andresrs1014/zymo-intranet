from sqlmodel import Session, select

from app.models.task_list_config import TaskListConfig
from app.schemas.task_list_config import TaskListConfigCreate, TaskListConfigUpdate


def get_lists_by_owner(db: Session, owner_id: int) -> dict[str, list[TaskListConfig]]:
    rows = db.exec(
        select(TaskListConfig)
        .where(TaskListConfig.owner_user_id == owner_id)
        .where(TaskListConfig.is_active == True)  # noqa: E712
        .order_by(TaskListConfig.created_at)
    ).all()

    by_type: dict[str, list[TaskListConfig]] = {
        "estado": [],
        "etiqueta": [],
        "plataforma": [],
    }
    for row in rows:
        by_type.setdefault(row.list_type, []).append(row)
    return by_type


def create_list_item(db: Session, owner_id: int, payload: TaskListConfigCreate) -> TaskListConfig:
    existing = db.exec(
        select(TaskListConfig)
        .where(TaskListConfig.owner_user_id == owner_id)
        .where(TaskListConfig.list_type == payload.list_type)
        .where(TaskListConfig.value == payload.value)
    ).first()
    if existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="Este valor ya existe en la lista.")

    item = TaskListConfig(
        owner_user_id=owner_id,
        list_type=payload.list_type,
        value=payload.value,
        label=payload.label,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_list_item(
    db: Session, owner_id: int, list_type: str, value: str, payload: TaskListConfigUpdate
) -> TaskListConfig:
    item = db.exec(
        select(TaskListConfig)
        .where(TaskListConfig.owner_user_id == owner_id)
        .where(TaskListConfig.list_type == list_type)
        .where(TaskListConfig.value == value)
    ).first()
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Item no encontrado.")

    if payload.label is not None:
        item.label = payload.label
    if payload.is_active is not None:
        item.is_active = payload.is_active

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_list_item(db: Session, owner_id: int, list_type: str, value: str) -> dict:
    item = db.exec(
        select(TaskListConfig)
        .where(TaskListConfig.owner_user_id == owner_id)
        .where(TaskListConfig.list_type == list_type)
        .where(TaskListConfig.value == value)
    ).first()
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Item no encontrado.")

    item.is_active = False
    db.add(item)
    db.commit()
    return {"ok": True}
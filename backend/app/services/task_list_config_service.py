from sqlmodel import Session, select

from app.models.task_list_config import TaskListConfig
from app.schemas.task_list_config import TaskListConfigCreate, TaskListConfigUpdate

_DEFAULT_LIST_ITEMS = [
    ("estado",     "completada",         "Completada"),
    ("estado",     "en_progreso",        "En progreso"),
    ("estado",     "bloqueada",          "Bloqueada"),
    ("etiqueta",   "desarrollos",        "Desarrollos"),
    ("etiqueta",   "actualizaciones",    "Actualizaciones"),
    ("etiqueta",   "auditorias",         "Auditorías"),
    ("etiqueta",   "implementacion_okr", "Implementación OKR"),
    ("etiqueta",   "tareas_diarias",     "Tareas diarias"),
    ("plataforma", "logimat1",           "Logimat 1"),
    ("plataforma", "logimat2",           "Logimat 2"),
    ("plataforma", "imccargo",           "IMC Cargo"),
    ("plataforma", "imcdeposito",        "IMC Depósito"),
    ("plataforma", "transversal",        "Transversal"),
]


def _seed_defaults(db: Session, owner_id: int) -> None:
    """Crea los items de lista por defecto para un manager que aún no tiene ninguno."""
    for list_type, value, label in _DEFAULT_LIST_ITEMS:
        db.add(TaskListConfig(owner_user_id=owner_id, list_type=list_type, value=value, label=label))
    db.commit()


def get_lists_by_owner(db: Session, owner_id: int) -> dict[str, list[TaskListConfig]]:
    rows = db.exec(
        select(TaskListConfig)
        .where(TaskListConfig.owner_user_id == owner_id)
        .where(TaskListConfig.is_active == True)  # noqa: E712
        .order_by(TaskListConfig.created_at)
    ).all()

    if not rows:
        _seed_defaults(db, owner_id)
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
        "prioridad_agenda": [],
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


def mark_estado_especial(
    db: Session, owner_id: int, value: str, tipo: str | None
) -> "TaskListConfig":
    """
    Marks a specific estado value as is_final or is_canceled (tipo='final'|'cancelado'|None).
    Only one estado can be is_final=True and one is_canceled=True at a time per workspace.
    """
    from fastapi import HTTPException

    if tipo not in ("final", "cancelado", "inicial", None):
        raise HTTPException(status_code=422, detail="tipo debe ser 'final', 'cancelado', 'inicial' o null.")

    # Clear previous flag
    if tipo == "final":
        prev = db.exec(
            select(TaskListConfig)
            .where(TaskListConfig.owner_user_id == owner_id)
            .where(TaskListConfig.is_final == True)  # noqa: E712
        ).all()
        for p in prev:
            p.is_final = False
            db.add(p)
    elif tipo == "cancelado":
        prev = db.exec(
            select(TaskListConfig)
            .where(TaskListConfig.owner_user_id == owner_id)
            .where(TaskListConfig.is_canceled == True)  # noqa: E712
        ).all()
        for p in prev:
            p.is_canceled = False
            db.add(p)
    elif tipo == "inicial":
        prev = db.exec(
            select(TaskListConfig)
            .where(TaskListConfig.owner_user_id == owner_id)
            .where(TaskListConfig.is_initial_assignment == True)  # noqa: E712
        ).all()
        for p in prev:
            p.is_initial_assignment = False
            db.add(p)

    target = db.exec(
        select(TaskListConfig)
        .where(TaskListConfig.owner_user_id == owner_id)
        .where(TaskListConfig.list_type == "estado")
        .where(TaskListConfig.value == value)
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Estado no encontrado.")

    if tipo == "final":
        target.is_final = True
        target.is_canceled = False
        target.is_initial_assignment = False
    elif tipo == "cancelado":
        target.is_canceled = True
        target.is_final = False
        target.is_initial_assignment = False
    elif tipo == "inicial":
        target.is_initial_assignment = True
        target.is_final = False
        target.is_canceled = False
    else:  # None — clears all flags
        target.is_final = False
        target.is_canceled = False
        target.is_initial_assignment = False

    db.add(target)
    db.commit()
    db.refresh(target)
    return target
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from sqlmodel import Session, select

if TYPE_CHECKING:
    from app.schemas.work_task import PaginatedTaskFilters, PaginatedTasksResponse

from app.models.work_task import WorkTask
from app.models.user import User
from app.schemas.work_task import WorkTaskCreate, WorkTaskUpdate
from app.services.task_team_service import get_or_create_dev_team

SCOPE_DEV = "desarrollo_innovacion"

VALID_ETIQUETAS = {
    "desarrollos",
    "actualizaciones",
    "auditorias",
    "implementacion_okr",
    "tareas_diarias",
}
VALID_PLATAFORMAS = {
    "logimat1",
    "logimat2",
    "imccargo",
    "imcdeposito",
    "transversal",
}
VALID_ESTADOS = {"completada", "en_progreso", "bloqueada"}


def calcular_minutos(
    hora_inicio: datetime | None,
    hora_cierre: datetime | None,
) -> int | None:
    """Calculates total minutes between start and end time."""
    if hora_inicio is None or hora_cierre is None:
        return None
    if hora_cierre <= hora_inicio:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="hora_cierre debe ser posterior a hora_inicio.",
        )
    delta = hora_cierre - hora_inicio
    return int(delta.total_seconds() // 60)


def validate_task_values(etiqueta: str, plataforma: str, estado: str) -> None:
    """Raises 422 HTTPException if any value is invalid."""
    if etiqueta not in VALID_ETIQUETAS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Etiqueta inválida '{etiqueta}'. Opciones válidas: {sorted(VALID_ETIQUETAS)}",
        )
    if plataforma not in VALID_PLATAFORMAS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Plataforma inválida '{plataforma}'. Opciones válidas: {sorted(VALID_PLATAFORMAS)}",
        )
    if estado not in VALID_ESTADOS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Estado inválido '{estado}'. Opciones válidas: {sorted(VALID_ESTADOS)}",
        )


def create_task(db: Session, user: User, payload: WorkTaskCreate) -> WorkTask:
    """Creates a task for the current user. User cannot create tasks for others."""
    validate_task_values(payload.etiqueta, payload.plataforma, payload.estado)

    team = get_or_create_dev_team(db)
    now = datetime.now(timezone.utc)
    minutos = calcular_minutos(payload.hora_inicio, payload.hora_cierre)

    task = WorkTask(
        scope=SCOPE_DEV,
        team_id=team.id,
        subido_por_id=user.id,
        subido_por_nombre=user.full_name or user.email,
        fecha=payload.fecha if payload.fecha is not None else date.today(),
        hora_inicio=payload.hora_inicio,
        hora_cierre=payload.hora_cierre,
        tiempo_total_minutos=minutos,
        etiqueta=payload.etiqueta,
        plataforma=payload.plataforma,
        titulo=payload.titulo,
        descripcion_tecnica=payload.descripcion_tecnica,
        estado=payload.estado,
        created_at=now,
        updated_at=now,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    log_activity(
        db,
        task_id=task.id,
        user_id=task.subido_por_id,
        user_nombre=task.subido_por_nombre,
        accion="creacion",
        detalle=f"Tarea creada: {task.titulo}",
    )
    db.commit()
    return task


def update_own_task(
    db: Session,
    user: User,
    task_id: int,
    payload: WorkTaskUpdate,
) -> WorkTask:
    """Updates a task. User cannot edit tasks that belong to others."""
    task = db.get(WorkTask, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarea no encontrada.",
        )
    if task.subido_por_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes editar tareas de otros usuarios.",
        )

    if payload.etiqueta is not None or payload.plataforma is not None or payload.estado is not None:
        validate_task_values(
            payload.etiqueta if payload.etiqueta is not None else task.etiqueta,
            payload.plataforma if payload.plataforma is not None else task.plataforma,
            payload.estado if payload.estado is not None else task.estado,
        )

    update_data = payload.model_dump(exclude_unset=True)
    estado_anterior = task.estado
    for field, value in update_data.items():
        setattr(task, field, value)

    hora_inicio = task.hora_inicio
    hora_cierre = task.hora_cierre
    task.tiempo_total_minutos = calcular_minutos(hora_inicio, hora_cierre)
    task.updated_at = datetime.now(timezone.utc)

    db.add(task)
    db.commit()
    db.refresh(task)

    if "estado" in update_data and update_data["estado"] != estado_anterior:
        log_activity(
            db,
            task_id=task.id,
            user_id=user.id,
            user_nombre=task.subido_por_nombre,
            accion="cambio_estado",
            detalle=f"De {estado_anterior} a {update_data['estado']}",
        )
        db.commit()

    return task


def list_own_tasks(
    db: Session,
    user: User,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    estado: str | None = None,
    etiqueta: str | None = None,
    plataforma: str | None = None,
) -> list[WorkTask]:
    """Lists own tasks with optional filters."""
    query = select(WorkTask).where(
        WorkTask.subido_por_id == user.id,
        WorkTask.scope == SCOPE_DEV,
    )

    if fecha_desde is not None:
        query = query.where(WorkTask.fecha >= fecha_desde)
    if fecha_hasta is not None:
        query = query.where(WorkTask.fecha <= fecha_hasta)
    if estado is not None:
        query = query.where(WorkTask.estado == estado)
    if etiqueta is not None:
        query = query.where(WorkTask.etiqueta == etiqueta)
    if plataforma is not None:
        query = query.where(WorkTask.plataforma == plataforma)

    return list(db.exec(query).all())


def own_metrics(db: Session, user: User) -> dict:
    """Returns personal metrics aligned with the frontend KPI contract."""
    tasks = list_own_tasks(db, user)
    completadas = sum(1 for t in tasks if t.estado == "completada")
    en_progreso = sum(1 for t in tasks if t.estado == "en_progreso")
    bloqueadas = sum(1 for t in tasks if t.estado == "bloqueada")
    minutos = sum(t.tiempo_total_minutos for t in tasks if t.tiempo_total_minutos is not None)
    return {
        "tareas_registradas": len(tasks),
        "completadas": completadas,
        "en_progreso": en_progreso,
        "bloqueadas": bloqueadas,
        "horas_registradas": round(minutos / 60, 2),
    }


def log_activity(
    db: "Session",
    task_id: int,
    user_id: int,
    user_nombre: str,
    accion: str,
    detalle: str | None = None,
) -> None:
    from app.models.task_activity_log import TaskActivityLog

    entry = TaskActivityLog(
        task_id=task_id,
        user_id=user_id,
        user_nombre=user_nombre,
        accion=accion,
        detalle=detalle,
    )
    db.add(entry)
    # No hace commit — el llamador es responsable del commit


def get_task_activity(db: "Session", task_id: int) -> list:
    from app.models.task_activity_log import TaskActivityLog
    from sqlmodel import select as sqlmodel_select

    entries = db.exec(
        sqlmodel_select(TaskActivityLog)
        .where(TaskActivityLog.task_id == task_id)
        .order_by(TaskActivityLog.fecha.asc())
    ).all()
    return list(entries)


def get_paginated_tasks(
    db: "Session",
    user_id: int,
    scope: str,
    filters: "PaginatedTaskFilters",
    team_member_ids: list[int] | None = None,
) -> "PaginatedTasksResponse":
    """
    Devuelve tareas paginadas con filtros.
    Si team_member_ids es None, filtra solo por user_id (vista colaborador).
    Si team_member_ids es lista, filtra por todos esos IDs (vista gestor).
    """
    from app.schemas.work_task import PaginatedTaskFilters, PaginatedTasksResponse, PaginatedMeta, WorkTaskRead
    from sqlmodel import func, or_
    from sqlmodel import select as sqlmodel_select
    import math

    query = sqlmodel_select(WorkTask).where(WorkTask.scope == scope)

    if team_member_ids is not None:
        query = query.where(WorkTask.subido_por_id.in_(team_member_ids))
    else:
        query = query.where(WorkTask.subido_por_id == user_id)

    if filters.search:
        term = f"%{filters.search}%"
        query = query.where(
            or_(WorkTask.titulo.ilike(term), WorkTask.descripcion_tecnica.ilike(term))
        )
    if filters.responsable_id:
        query = query.where(WorkTask.subido_por_id == filters.responsable_id)
    if filters.estado:
        query = query.where(WorkTask.estado == filters.estado)
    if filters.etiqueta:
        query = query.where(WorkTask.etiqueta == filters.etiqueta)
    if filters.plataforma:
        query = query.where(WorkTask.plataforma == filters.plataforma)
    if filters.fecha_exacta:
        query = query.where(WorkTask.fecha == filters.fecha_exacta)
    if filters.fecha_desde:
        query = query.where(WorkTask.fecha >= filters.fecha_desde)
    if filters.fecha_hasta:
        query = query.where(WorkTask.fecha <= filters.fecha_hasta)

    # Contar total
    count_query = sqlmodel_select(func.count()).select_from(query.subquery())
    total_items = db.exec(count_query).one()
    total_pages = max(1, math.ceil(total_items / filters.limit))

    # Paginar
    offset = (filters.page - 1) * filters.limit
    query = query.order_by(WorkTask.fecha.desc(), WorkTask.created_at.desc())
    query = query.offset(offset).limit(filters.limit)
    tasks = db.exec(query).all()

    return PaginatedTasksResponse(
        data=[WorkTaskRead.model_validate(t) for t in tasks],
        meta=PaginatedMeta(
            total_items=total_items,
            total_pages=total_pages,
            current_page=filters.page,
            limit=filters.limit,
        ),
    )

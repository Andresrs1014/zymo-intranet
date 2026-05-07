from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

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
    for field, value in update_data.items():
        setattr(task, field, value)

    hora_inicio = task.hora_inicio
    hora_cierre = task.hora_cierre
    task.tiempo_total_minutos = calcular_minutos(hora_inicio, hora_cierre)
    task.updated_at = datetime.now(timezone.utc)

    db.add(task)
    db.commit()
    db.refresh(task)
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

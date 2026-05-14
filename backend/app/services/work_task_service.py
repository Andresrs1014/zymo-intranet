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


def validate_task_values(
    db: Session,
    user: User,
    etiqueta: str,
    plataforma: str,
    estado: str,
    *,
    list_config_owner_id: int | None = None,
) -> None:
    """Valida etiqueta/plataforma/estado contra TaskListConfig en BD.
    Si no hay listas configuradas para el workspace, omite la validación.
    list_config_owner_id: workspace del gestor cuyas listas aplican (p. ej. el dueño del equipo).
    """
    from app.models.task_list_config import TaskListConfig
    from app.models.task_team_member import TaskTeamMember
    from app.models.task_team import TaskTeam
    from app.services.user_tool_service import user_has_tool

    is_admin = getattr(user, "role", None) == "admin"
    has_manage = user_has_tool(db, user, "tool_task_manage_dev")

    if is_admin or has_manage:
        owner_id = user.id
    elif list_config_owner_id is not None:
        owner_id = list_config_owner_id
    else:
        membership = db.exec(
            select(TaskTeamMember)
            .where(TaskTeamMember.user_id == user.id)
            .where(TaskTeamMember.is_active == True)  # noqa: E712
        ).first()
        if not membership:
            return
        team = db.get(TaskTeam, membership.team_id)
        if not team:
            return
        owner_id = team.owner_user_id

    active = db.exec(
        select(TaskListConfig)
        .where(TaskListConfig.owner_user_id == owner_id)
        .where(TaskListConfig.is_active == True)  # noqa: E712
    ).all()

    if not active:
        return  # Sin listas configuradas — no validar

    by_type: dict[str, set[str]] = {}
    for item in active:
        by_type.setdefault(item.list_type, set()).add(item.value)

    if "etiqueta" in by_type and etiqueta and etiqueta not in by_type["etiqueta"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Etiqueta inválida: '{etiqueta}'.",
        )
    if "plataforma" in by_type and plataforma and plataforma not in by_type["plataforma"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Plataforma inválida: '{plataforma}'.",
        )
    if "estado" in by_type and estado and estado not in by_type["estado"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Estado inválido: '{estado}'.",
        )


def create_task(db: Session, user: User, payload: WorkTaskCreate) -> WorkTask:
    """Crea una tarea. Asigna team_id automáticamente si el usuario tiene un solo equipo.
    Si tiene múltiples equipos, el payload debe incluir team_id explícito.
    Los colaboradores sin membresía activa no pueden crear tareas (evita registros invisibles para el gestor).
    """
    from app.models.task_team import TaskTeam
    from app.services.task_team_service import get_user_active_teams
    from app.services.user_tool_service import user_has_tool

    is_admin = getattr(user, "role", None) == "admin"
    has_manage = user_has_tool(db, user, "tool_task_manage_dev")
    is_submit_only = not is_admin and not has_manage

    now = datetime.now(timezone.utc)
    minutos = calcular_minutos(payload.hora_inicio, payload.hora_cierre)

    active_teams = get_user_active_teams(db, user.id)  # type: ignore[arg-type]
    valid_team_ids = {t["team_id"] for t in active_teams}

    team_id = payload.team_id
    if team_id is not None:
        if team_id not in valid_team_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No perteneces al equipo seleccionado.",
            )
    else:
        if len(active_teams) == 1:
            team_id = active_teams[0]["team_id"]
        elif len(active_teams) > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Perteneces a múltiples equipos. Selecciona el equipo para esta tarea.",
            )
        elif is_submit_only:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "No estás asignado a ningún equipo de tareas. "
                    "Pide al gestor que te agregue en Configuración del equipo."
                ),
            )

    if team_id is not None:
        team_row = db.get(TaskTeam, team_id)
        list_owner_id = int(team_row.owner_user_id) if team_row else user.id
    else:
        list_owner_id = user.id

    validate_task_values(
        db,
        user,
        payload.etiqueta,
        payload.plataforma,
        payload.estado,
        list_config_owner_id=(None if (is_admin or has_manage) else list_owner_id),
    )

    task = WorkTask(
        scope="desarrollo_innovacion",
        team_id=team_id,
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
        prioridad=payload.prioridad,
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
        from app.models.task_team import TaskTeam

        list_owner: int | None = None
        if task.team_id is not None:
            tteam = db.get(TaskTeam, task.team_id)
            if tteam:
                list_owner = int(tteam.owner_user_id)
        validate_task_values(
            db,
            user,
            payload.etiqueta if payload.etiqueta is not None else task.etiqueta,
            payload.plataforma if payload.plataforma is not None else task.plataforma,
            payload.estado if payload.estado is not None else task.estado,
            list_config_owner_id=list_owner,
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
    query = select(WorkTask).where(WorkTask.subido_por_id == user.id)

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
    filters: "PaginatedTaskFilters",
    team_member_ids: list[int] | None = None,
    team_id: int | None = None,
) -> "PaginatedTasksResponse":
    """
    Devuelve tareas paginadas con filtros.
    Vista colaborador: solo subido_por_id == user_id.
    Vista gestor (team_id + team_member_ids): tareas con team_id del workspace o huérfanas legadas
    de miembros activos del equipo (subido_por_id en team_member_ids y team_id nulo).
    """
    from app.schemas.work_task import PaginatedTaskFilters, PaginatedTasksResponse, PaginatedMeta, WorkTaskRead
    from sqlmodel import and_, func, or_
    from sqlmodel import select as sqlmodel_select
    import math

    query = sqlmodel_select(WorkTask)

    if team_member_ids is not None and team_id is not None:
        # Vista gestor: todas las tareas con team_id del workspace; más huérfanas legadas de miembros.
        if team_member_ids:
            scope = or_(
                WorkTask.team_id == team_id,
                and_(WorkTask.team_id.is_(None), WorkTask.subido_por_id.in_(team_member_ids)),  # type: ignore[union-attr]
            )
        else:
            scope = WorkTask.team_id == team_id
        query = query.where(scope)
    elif team_id is not None:
        query = query.where(WorkTask.team_id == team_id)
    elif team_member_ids is not None:
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
    fecha_exacta_parsed = date.fromisoformat(filters.fecha_exacta) if filters.fecha_exacta else None
    fecha_desde_parsed = date.fromisoformat(filters.fecha_desde) if filters.fecha_desde else None
    fecha_hasta_parsed = date.fromisoformat(filters.fecha_hasta) if filters.fecha_hasta else None
    if fecha_exacta_parsed:
        query = query.where(WorkTask.fecha == fecha_exacta_parsed)
    if fecha_desde_parsed:
        query = query.where(WorkTask.fecha >= fecha_desde_parsed)
    if fecha_hasta_parsed:
        query = query.where(WorkTask.fecha <= fecha_hasta_parsed)

    count_query = sqlmodel_select(func.count()).select_from(query.subquery())
    total_items = db.exec(count_query).one()
    total_pages = max(1, math.ceil(total_items / filters.limit))

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
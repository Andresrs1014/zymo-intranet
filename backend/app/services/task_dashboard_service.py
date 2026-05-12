from collections import defaultdict
from datetime import date

from sqlmodel import Session, select

from app.models.work_task import WorkTask
from app.models.user import User
from app.schemas.task_dashboard import TaskFilters, TaskKpis, PersonTaskSummary
from app.services.task_team_service import get_active_member_ids


def _get_team_member_ids(db: Session, owner_id: int) -> list[int]:
    return get_active_member_ids(db, owner_id)


def get_team_tasks(db: Session, filters: TaskFilters, owner_id: int) -> list[WorkTask]:
    """Returns team tasks for the manager's workspace applying all filters."""
    active_ids = _get_team_member_ids(db, owner_id)
    if not active_ids:
        return []

    query = select(WorkTask)

    if filters.responsable_id is not None:
        query = query.where(WorkTask.subido_por_id == filters.responsable_id)
    else:
        query = query.where(WorkTask.subido_por_id.in_(active_ids))  # type: ignore[union-attr]

    if filters.fecha_desde is not None:
        query = query.where(WorkTask.fecha >= filters.fecha_desde)
    if filters.fecha_hasta is not None:
        query = query.where(WorkTask.fecha <= filters.fecha_hasta)
    if filters.estado is not None:
        query = query.where(WorkTask.estado == filters.estado)
    if filters.etiqueta is not None:
        query = query.where(WorkTask.etiqueta == filters.etiqueta)
    if filters.plataforma is not None:
        query = query.where(WorkTask.plataforma == filters.plataforma)
    if filters.q is not None and filters.q.strip():
        term = f"%{filters.q.strip()}%"
        query = query.where(
            WorkTask.titulo.ilike(term) | WorkTask.descripcion_tecnica.ilike(term)  # type: ignore[union-attr]
        )

    if filters.sin_registro_hoy:
        hoy = date.today()
        ids_con_registro = db.exec(
            select(WorkTask.subido_por_id).where(
                WorkTask.fecha == hoy,
            )
        ).all()
        ids_sin_registro = [uid for uid in active_ids if uid not in ids_con_registro]
        if not ids_sin_registro:
            return []
        query = query.where(WorkTask.subido_por_id.in_(ids_sin_registro))  # type: ignore[union-attr]

    return list(db.exec(query).all())


def get_team_kpis(db: Session, filters: TaskFilters, owner_id: int) -> TaskKpis:
    """Calculates KPIs from filtered tasks for the manager's workspace."""
    tasks = get_team_tasks(db, filters, owner_id)
    active_ids = _get_team_member_ids(db, owner_id)

    completadas = sum(1 for t in tasks if t.estado == "completada")
    en_progreso = sum(1 for t in tasks if t.estado == "en_progreso")
    bloqueadas = sum(1 for t in tasks if t.estado == "bloqueada")
    minutos = sum(t.tiempo_total_minutos for t in tasks if t.tiempo_total_minutos is not None)
    horas = round(minutos / 60, 2)

    usuarios_activos = len({t.subido_por_id for t in tasks})

    hoy = date.today()
    ids_con_registro_hoy = {
        t.subido_por_id
        for t in db.exec(
            select(WorkTask).where(WorkTask.fecha == hoy)
        ).all()
        if t.subido_por_id in active_ids
    }
    usuarios_sin_registro_hoy = len([uid for uid in active_ids if uid not in ids_con_registro_hoy])

    return TaskKpis(
        tareas_registradas=len(tasks),
        horas_registradas=horas,
        completadas=completadas,
        en_progreso=en_progreso,
        bloqueadas=bloqueadas,
        usuarios_activos=usuarios_activos,
        usuarios_sin_registro_hoy=usuarios_sin_registro_hoy,
    )


def _build_person_summary(user: User, tasks: list[WorkTask]) -> PersonTaskSummary:
    hoy = date.today()
    minutos = sum(t.tiempo_total_minutos for t in tasks if t.tiempo_total_minutos is not None)
    ultima = max((t.created_at for t in tasks), default=None)
    registro_hoy = any(t.fecha == hoy for t in tasks)
    return PersonTaskSummary(
        user_id=user.id,  # type: ignore[arg-type]
        nombre=user.full_name or user.email,
        email=user.email,
        tareas_totales=len(tasks),
        horas=round(minutos / 60, 2),
        completadas=sum(1 for t in tasks if t.estado == "completada"),
        en_progreso=sum(1 for t in tasks if t.estado == "en_progreso"),
        bloqueadas=sum(1 for t in tasks if t.estado == "bloqueada"),
        ultima_actividad=ultima,
        registro_hoy=registro_hoy,
    )


def get_person_summaries(db: Session, filters: TaskFilters, owner_id: int) -> list[PersonTaskSummary]:
    """Returns per-person summary for active team members of the workspace."""
    active_ids = _get_team_member_ids(db, owner_id)
    tasks = get_team_tasks(db, filters, owner_id)

    tasks_by_user: dict[int, list[WorkTask]] = defaultdict(list)
    for task in tasks:
        tasks_by_user[task.subido_por_id].append(task)

    summaries: list[PersonTaskSummary] = []
    for uid in active_ids:
        user = db.get(User, uid)
        if user:
            summaries.append(_build_person_summary(user, tasks_by_user[uid]))
    return summaries


def get_chart_data(db: Session, filters: TaskFilters, owner_id: int) -> dict:
    """Returns chart data for dashboard visualizations of the workspace."""
    tasks = get_team_tasks(db, filters, owner_id)

    tareas_por_responsable: dict[str, int] = defaultdict(int)
    horas_por_responsable: dict[str, float] = defaultdict(float)
    distribucion_estado: dict[str, int] = defaultdict(int)
    tareas_por_etiqueta: dict[str, int] = defaultdict(int)
    completadas_por_fecha: dict[str, int] = defaultdict(int)

    user_cache: dict[int, str] = {}

    for task in tasks:
        uid = task.subido_por_id
        if uid not in user_cache:
            user = db.get(User, uid)
            user_cache[uid] = (user.full_name or user.email) if user else str(uid)
        nombre = user_cache[uid]

        tareas_por_responsable[nombre] += 1
        minutos = task.tiempo_total_minutos or 0
        horas_por_responsable[nombre] += minutos / 60

        distribucion_estado[task.estado] += 1
        tareas_por_etiqueta[task.etiqueta] += 1

        if task.estado == "completada":
            completadas_por_fecha[str(task.fecha)] += 1

    return {
        "tareas_por_responsable": [
            {"nombre": k, "tareas": v} for k, v in sorted(tareas_por_responsable.items())
        ],
        "horas_por_responsable": [
            {"nombre": k, "horas": round(v, 2)} for k, v in sorted(horas_por_responsable.items())
        ],
        "distribucion_estado": [
            {"estado": k, "cantidad": v} for k, v in distribucion_estado.items()
        ],
        "tareas_por_etiqueta": [
            {"etiqueta": k, "cantidad": v} for k, v in tareas_por_etiqueta.items()
        ],
        "evolucion_completadas": [
            {"fecha": k, "completadas": v}
            for k, v in sorted(completadas_por_fecha.items())
        ],
    }


def get_users_without_today_entry(db: Session, owner_id: int) -> list[PersonTaskSummary]:
    """Returns PersonTaskSummary for active members with no task registered today."""
    hoy = date.today()
    active_ids = _get_team_member_ids(db, owner_id)

    ids_con_registro = {
        t.subido_por_id
        for t in db.exec(
            select(WorkTask).where(WorkTask.fecha == hoy)
        ).all()
    }

    summaries: list[PersonTaskSummary] = []
    for uid in active_ids:
        if uid not in ids_con_registro:
            user = db.get(User, uid)
            if user:
                summaries.append(_build_person_summary(user, []))
    return summaries
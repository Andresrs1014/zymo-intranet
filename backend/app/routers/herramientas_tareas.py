"""
Router Módulo Herramientas — Gestión de Tareas.

Prefijo: /api/herramientas/tareas
Acceso: controlado por UserTool (tool_task_submit_dev / tool_task_manage_dev)
Multi-workspace: cada manager tiene su propio equipo y datos.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.models.user_tool import UserTool
from app.schemas.work_task import WorkTaskCreate, WorkTaskRead, WorkTaskUpdate, PaginatedTasksResponse
from app.schemas.task_dashboard import TaskFilters, TaskKpis, PersonTaskSummary
from app.schemas.task_event import TaskEventCreate
from app.schemas.task_team import (
    AvailableUserRead,
    TaskTeamMemberCreate,
    TaskTeamMemberRead,
)
from app.schemas.task_list_config import TaskListConfigCreate, TaskListConfigUpdate, TaskListConfigRead
from app.services.user_tool_service import require_tool_or_403

router = APIRouter(prefix="/api/herramientas/tareas", tags=["Herramientas - Tareas"])

TOOL_SUBMIT = "tool_task_submit_dev"
TOOL_MANAGE = "tool_task_manage_dev"


class AssignUserToolPayload(BaseModel):
    user_id: int
    tool_key: str
    scope: str = "global"


def _team_filters(
    fecha_desde: Optional[date] = Query(default=None),
    fecha_hasta: Optional[date] = Query(default=None),
    responsable_id: Optional[int] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    etiqueta: Optional[str] = Query(default=None),
    plataforma: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    sin_registro_hoy: bool = Query(default=False),
) -> TaskFilters:
    return TaskFilters(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        responsable_id=responsable_id,
        estado=estado,
        etiqueta=etiqueta,
        plataforma=plataforma,
        q=q,
        sin_registro_hoy=sin_registro_hoy,
    )


# ── User endpoints (TOOL_SUBMIT) ───────────────────────────────────────────────

@router.get("/mis-tareas", response_model=PaginatedTasksResponse)
def mis_tareas_paginadas(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    etiqueta: Optional[str] = Query(default=None),
    plataforma: Optional[str] = Query(default=None),
    fecha_exacta: Optional[str] = Query(default=None),
    fecha_desde: Optional[str] = Query(default=None),
    fecha_hasta: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.schemas.work_task import PaginatedTaskFilters
    from app.services.work_task_service import get_paginated_tasks

    require_tool_or_403(db, current_user, TOOL_SUBMIT)

    filters = PaginatedTaskFilters(
        page=page, limit=limit, search=search, estado=estado,
        etiqueta=etiqueta, plataforma=plataforma,
        fecha_exacta=fecha_exacta, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )
    return get_paginated_tasks(db, current_user.id, filters)


@router.post("/", response_model=WorkTaskRead, status_code=status.HTTP_201_CREATED)
def create_task_endpoint(
    payload: WorkTaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkTaskRead:
    require_tool_or_403(db, current_user, TOOL_SUBMIT)

    from app.services.work_task_service import create_task

    task = create_task(db, current_user, payload)
    return WorkTaskRead.model_validate(task)


@router.get("/{task_id}/historial", response_model=None)
def historial_tarea(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.work_task_service import get_task_activity
    from app.models.work_task import WorkTask
    from app.services.user_tool_service import user_has_tool

    task = db.get(WorkTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")

    is_manager = user_has_tool(db, current_user, TOOL_MANAGE)
    is_admin = getattr(current_user, "role", None) == "admin"
    if not is_manager and not is_admin and task.subido_por_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso.")

    logs = get_task_activity(db, task_id)
    return [
        {
            "id": log.id,
            "user_nombre": log.user_nombre,
            "accion": log.accion,
            "detalle": log.detalle,
            "fecha": log.fecha.isoformat(),
        }
        for log in logs
    ]


@router.patch("/{task_id}", response_model=WorkTaskRead)
def update_task_endpoint(
    task_id: int,
    payload: WorkTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkTaskRead:
    require_tool_or_403(db, current_user, TOOL_SUBMIT)

    from app.services.work_task_service import update_own_task

    task = update_own_task(db, current_user, task_id, payload)
    return WorkTaskRead.model_validate(task)


@router.get("/mis-metricas")
def get_mis_metricas(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_tool_or_403(db, current_user, TOOL_SUBMIT)

    from app.services.work_task_service import own_metrics

    return own_metrics(db, current_user)


# ── Manager endpoints (TOOL_MANAGE) ─────────────────────────────────────────

@router.get("/equipo/tareas-paginadas", response_model=PaginatedTasksResponse)
def equipo_tareas_paginadas(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    responsable_id: Optional[int] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    etiqueta: Optional[str] = Query(default=None),
    plataforma: Optional[str] = Query(default=None),
    fecha_exacta: Optional[str] = Query(default=None),
    fecha_desde: Optional[str] = Query(default=None),
    fecha_hasta: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.schemas.work_task import PaginatedTaskFilters
    from app.services.work_task_service import get_paginated_tasks
    from app.services.task_team_service import get_or_create_manager_team
    from app.models.task_team_member import TaskTeamMember

    require_tool_or_403(db, current_user, TOOL_MANAGE)

    team = get_or_create_manager_team(db, current_user.id)
    members = db.exec(
        select(TaskTeamMember).where(
            TaskTeamMember.team_id == team.id,
            TaskTeamMember.is_active == True,  # noqa: E712
        )
    ).all()
    member_ids = [m.user_id for m in members]

    filters = PaginatedTaskFilters(
        page=page, limit=limit, search=search, responsable_id=responsable_id,
        estado=estado, etiqueta=etiqueta, plataforma=plataforma,
        fecha_exacta=fecha_exacta, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )
    return get_paginated_tasks(db, current_user.id, filters, team_member_ids=member_ids)


@router.get("/equipo", response_model=list[WorkTaskRead])
def get_equipo_tasks(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkTaskRead]:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_dashboard_service import get_team_tasks

    tasks = get_team_tasks(db, filters, current_user.id)
    return [WorkTaskRead.model_validate(t) for t in tasks]


@router.get("/equipo/kpis", response_model=TaskKpis)
def get_equipo_kpis(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskKpis:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_dashboard_service import get_team_kpis

    return get_team_kpis(db, filters, current_user.id)


@router.get("/equipo/personas", response_model=list[PersonTaskSummary])
def get_equipo_personas(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PersonTaskSummary]:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_dashboard_service import get_person_summaries

    return get_person_summaries(db, filters, current_user.id)


@router.get("/equipo/graficas")
def get_equipo_graficas(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_dashboard_service import get_chart_data

    return get_chart_data(db, filters, current_user.id)


@router.get("/equipo/sin-registro-hoy", response_model=list[PersonTaskSummary])
def get_sin_registro_hoy(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PersonTaskSummary]:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_dashboard_service import get_users_without_today_entry

    return get_users_without_today_entry(db, current_user.id)


@router.get("/equipo/export/excel")
def export_equipo_excel(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_export_service import build_tasks_excel

    content = build_tasks_excel(db, filters, current_user.id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=tareas.xlsx"},
    )


@router.get("/equipo/export/pdf")
def export_equipo_pdf(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_export_service import build_tasks_pdf

    content = build_tasks_pdf(db, filters, current_user.id)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=tareas.pdf"},
    )


# ── Agenda endpoints ──────────────────────────────────────────────────────────

@router.post("/agenda", response_model=None, status_code=201)
def crear_evento_agenda(
    payload: TaskEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.task_event_service import create_event
    from app.services.user_tool_service import user_has_tool

    is_manager = user_has_tool(db, current_user, TOOL_MANAGE)
    is_admin = getattr(current_user, "role", None) == "admin"
    if not is_manager and not is_admin:
        if not payload.participant_ids or payload.participant_ids != [current_user.id]:
            raise HTTPException(status_code=403, detail="Solo el gestor puede agendar para otros miembros.")

    result = create_event(db, current_user, payload)
    return {"ok": True, "event_id": result["event"].id}


@router.get("/agenda/{fecha}", response_model=None)
def eventos_por_fecha(
    fecha: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.task_event_service import get_events_by_date
    from app.services.user_tool_service import user_has_tool

    is_manager = user_has_tool(db, current_user, TOOL_MANAGE)
    is_admin = getattr(current_user, "role", None) == "admin"

    if is_manager or is_admin:
        result = get_events_by_date(db, fecha, user_id=None)
    else:
        require_tool_or_403(db, current_user, TOOL_SUBMIT)
        result = get_events_by_date(db, fecha, user_id=current_user.id)

    return [
        {
            "id": r["event"].id,
            "titulo": r["event"].titulo,
            "descripcion": r["event"].descripcion,
            "plataforma": getattr(r["event"], "plataforma", None),
            "fecha": r["event"].fecha,
            "hora_inicio": r["event"].hora_inicio,
            "duracion_minutos": r["event"].duracion_minutos,
            "creado_por_nombre": r["event"].creado_por_nombre,
            "participants": [
                {
                    "user_id": p.user_id,
                    "user_nombre": p.user_nombre,
                    "has_conflict": p.has_conflict,
                    "conflict_detail": p.conflict_detail,
                }
                for p in r["participants"]
            ],
        }
        for r in result
    ]


# ── Team config endpoints (TOOL_MANAGE) ───────────────────────────────────────

@router.get("/equipo/config/miembros", response_model=list[TaskTeamMemberRead])
def get_team_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskTeamMemberRead]:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_team_service import list_team_members

    rows = list_team_members(db, current_user.id)
    return [
        TaskTeamMemberRead(
            id=member.id,
            team_id=member.team_id,
            user_id=member.user_id,
            user_email=user.email,
            user_full_name=user.full_name,
            is_active=member.is_active,
            created_at=member.created_at,
        )
        for member, user in rows
    ]


@router.get("/equipo/config/usuarios-disponibles", response_model=list[AvailableUserRead])
def get_available_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AvailableUserRead]:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_team_service import list_available_users

    users = list_available_users(db, current_user.id)
    return [
        AvailableUserRead(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            area=u.area,
        )
        for u in users
    ]


@router.post(
    "/equipo/config/miembros",
    response_model=TaskTeamMemberRead,
    status_code=status.HTTP_201_CREATED,
)
def add_team_member_endpoint(
    payload: TaskTeamMemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskTeamMemberRead:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_team_service import add_team_member
    from app.models.user import User as UserModel

    member = add_team_member(db, payload.user_id, current_user.id)
    user = db.get(UserModel, member.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return TaskTeamMemberRead(
        id=member.id,
        team_id=member.team_id,
        user_id=member.user_id,
        user_email=user.email,
        user_full_name=user.full_name,
        is_active=member.is_active,
        created_at=member.created_at,
    )


@router.delete("/equipo/config/miembros/{user_id}")
def remove_team_member(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_team_service import deactivate_team_member

    deactivate_team_member(db, user_id, current_user.id)
    return {"ok": True}


# ── Admin endpoint ─────────────────────────────────────────────────────────────

@router.post("/admin/asignar-tool")
def assign_user_tool(
    payload: AssignUserToolPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol 'admin'.",
        )

    existing = db.exec(
        select(UserTool)
        .where(UserTool.user_id == payload.user_id)
        .where(UserTool.tool_key == payload.tool_key)
        .where(UserTool.scope == payload.scope)
    ).first()

    if existing:
        from datetime import datetime, timezone
        existing.is_active = True
        existing.updated_at = datetime.now(timezone.utc)
        db.add(existing)
    else:
        db.add(
            UserTool(
                user_id=payload.user_id,
                tool_key=payload.tool_key,
                scope=payload.scope,
            )
        )

    db.commit()
    return {"ok": True}


@router.get("/admin/user-tools/{user_id}")
def get_user_tools(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[str]:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol 'admin'.")
    rows = db.exec(
        select(UserTool)
        .where(UserTool.user_id == user_id)
        .where(UserTool.is_active == True)  # noqa: E712
    ).all()
    return [r.tool_key for r in rows]


@router.delete("/admin/revocar-tool")
def revoke_user_tool(
    payload: AssignUserToolPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol 'admin'.")
    from datetime import datetime, timezone
    existing = db.exec(
        select(UserTool)
        .where(UserTool.user_id == payload.user_id)
        .where(UserTool.tool_key == payload.tool_key)
        .where(UserTool.scope == payload.scope)
    ).first()
    if existing:
        existing.is_active = False
        existing.updated_at = datetime.now(timezone.utc)
        db.add(existing)
        db.commit()
    return {"ok": True}


# ── List config endpoints (TOOL_MANAGE) ─────────────────────────────────────

@router.get("/config/listas")
def get_listas(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_list_config_service import get_lists_by_owner

    return get_lists_by_owner(db, current_user.id)


@router.post(
    "/config/listas",
    response_model=TaskListConfigRead,
    status_code=status.HTTP_201_CREATED,
)
def create_lista_item(
    payload: TaskListConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskListConfigRead:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_list_config_service import create_list_item

    item = create_list_item(db, current_user.id, payload)
    return TaskListConfigRead.model_validate(item)


@router.patch("/config/listas/{list_type}/{value}", response_model=TaskListConfigRead)
def update_lista_item(
    list_type: str,
    value: str,
    payload: TaskListConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskListConfigRead:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_list_config_service import update_list_item

    item = update_list_item(db, current_user.id, list_type, value, payload)
    return TaskListConfigRead.model_validate(item)


@router.delete("/config/listas/{list_type}/{value}")
def delete_lista_item(
    list_type: str,
    value: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_list_config_service import delete_list_item

    return delete_list_item(db, current_user.id, list_type, value)
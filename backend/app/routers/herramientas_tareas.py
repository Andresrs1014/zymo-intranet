"""
Router Módulo Herramientas — Gestión de Tareas.

Prefijo: /api/herramientas/tareas
Acceso: controlado por UserTool (tool_task_submit_dev / tool_task_manage_dev)
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
from app.schemas.work_task import WorkTaskCreate, WorkTaskRead, WorkTaskUpdate
from app.schemas.task_dashboard import TaskFilters, TaskKpis, PersonTaskSummary
from app.schemas.task_team import (
    AvailableUserRead,
    TaskTeamMemberCreate,
    TaskTeamMemberRead,
)
from app.services.user_tool_service import require_tool_or_403

router = APIRouter(prefix="/api/herramientas/tareas", tags=["Herramientas - Tareas"])

SCOPE_DEV = "desarrollo_innovacion"
TOOL_SUBMIT = "tool_task_submit_dev"
TOOL_MANAGE = "tool_task_manage_dev"


# ── Admin payload ──────────────────────────────────────────────────────────────

class AssignUserToolPayload(BaseModel):
    user_id: int
    tool_key: str
    scope: str = "desarrollo_innovacion"


# ── Filter dependency ──────────────────────────────────────────────────────────

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

@router.get("/mis-tareas", response_model=list[WorkTaskRead])
def get_mis_tareas(
    fecha_desde: Optional[date] = Query(default=None),
    fecha_hasta: Optional[date] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    etiqueta: Optional[str] = Query(default=None),
    plataforma: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkTaskRead]:
    require_tool_or_403(db, current_user, TOOL_SUBMIT, SCOPE_DEV)

    from app.services.work_task_service import list_own_tasks

    tasks = list_own_tasks(
        db,
        current_user,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
        etiqueta=etiqueta,
        plataforma=plataforma,
    )
    return [WorkTaskRead.model_validate(t) for t in tasks]


@router.post("/", response_model=WorkTaskRead, status_code=status.HTTP_201_CREATED)
def create_task_endpoint(
    payload: WorkTaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkTaskRead:
    require_tool_or_403(db, current_user, TOOL_SUBMIT, SCOPE_DEV)

    from app.services.work_task_service import create_task

    task = create_task(db, current_user, payload)
    return WorkTaskRead.model_validate(task)


@router.patch("/{task_id}", response_model=WorkTaskRead)
def update_task_endpoint(
    task_id: int,
    payload: WorkTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkTaskRead:
    require_tool_or_403(db, current_user, TOOL_SUBMIT, SCOPE_DEV)

    from app.services.work_task_service import update_own_task

    task = update_own_task(db, current_user, task_id, payload)
    return WorkTaskRead.model_validate(task)


@router.get("/mis-metricas")
def get_mis_metricas(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_tool_or_403(db, current_user, TOOL_SUBMIT, SCOPE_DEV)

    from app.services.work_task_service import own_metrics

    return own_metrics(db, current_user)


# ── Directiva endpoints (TOOL_MANAGE) ─────────────────────────────────────────

@router.get("/equipo", response_model=list[WorkTaskRead])
def get_equipo_tasks(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkTaskRead]:
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_dashboard_service import get_team_tasks

    tasks = get_team_tasks(db, filters)
    return [WorkTaskRead.model_validate(t) for t in tasks]


@router.get("/equipo/kpis", response_model=TaskKpis)
def get_equipo_kpis(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskKpis:
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_dashboard_service import get_team_kpis

    return get_team_kpis(db, filters)


@router.get("/equipo/personas", response_model=list[PersonTaskSummary])
def get_equipo_personas(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PersonTaskSummary]:
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_dashboard_service import get_person_summaries

    return get_person_summaries(db, filters)


@router.get("/equipo/graficas")
def get_equipo_graficas(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_dashboard_service import get_chart_data

    return get_chart_data(db, filters)


@router.get("/equipo/sin-registro-hoy", response_model=list[PersonTaskSummary])
def get_sin_registro_hoy(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PersonTaskSummary]:
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_dashboard_service import get_users_without_today_entry

    return get_users_without_today_entry(db)


@router.get("/equipo/export/excel")
def export_equipo_excel(
    filters: TaskFilters = Depends(_team_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_export_service import build_tasks_excel

    content = build_tasks_excel(db, filters)
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
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_export_service import build_tasks_pdf

    content = build_tasks_pdf(db, filters)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=tareas.pdf"},
    )


# ── Team config endpoints (TOOL_MANAGE) ───────────────────────────────────────

@router.get("/equipo/config/miembros", response_model=list[TaskTeamMemberRead])
def get_team_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskTeamMemberRead]:
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_team_service import list_team_members

    rows = list_team_members(db)
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
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_team_service import list_available_users

    users = list_available_users(db)
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
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_team_service import add_team_member
    from app.models.user import User as UserModel

    member = add_team_member(db, payload.user_id)
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
    require_tool_or_403(db, current_user, TOOL_MANAGE, SCOPE_DEV)

    from app.services.task_team_service import deactivate_team_member

    deactivate_team_member(db, user_id)
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

    # Reactivate existing record if found, otherwise create a new one
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

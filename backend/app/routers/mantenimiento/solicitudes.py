import logging
import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlmodel import Session, func, select

from app.core.deps import get_current_user, require_mantenimiento
from app.database import get_db
from app.models.mantenimiento import (
    ClasificacionMantenimiento,
    EstadoMantenimiento,
    HistorialMantenimiento,
    ModalidadMantenimiento,
    SolicitudMantenimiento,
)
from app.models.user import User
from app.oc_database import get_oc_db

log = logging.getLogger(__name__)
router = APIRouter(prefix="/solicitudes", tags=["Mantenimiento - Solicitudes"])

# ── FSM ───────────────────────────────────────────────────────────────────────

_TRANSICIONES_MANT: dict[str, set[str]] = {
    EstadoMantenimiento.solicitud:  {EstadoMantenimiento.evaluacion, EstadoMantenimiento.cancelado},
    EstadoMantenimiento.evaluacion: {EstadoMantenimiento.programado, EstadoMantenimiento.cancelado},
    EstadoMantenimiento.programado: {EstadoMantenimiento.ejecucion,  EstadoMantenimiento.cancelado},
    EstadoMantenimiento.ejecucion:  {EstadoMantenimiento.completado},
    EstadoMantenimiento.completado: {EstadoMantenimiento.cerrado},
    # cancelado y cerrado son estados terminales — sin transiciones
}

# ── Schemas ───────────────────────────────────────────────────────────────────

class SolicitudMantenimientoCreate(BaseModel):
    titulo:                      str
    descripcion:                 str
    tipo_mantenimiento:          str
    clasificacion:               ClasificacionMantenimiento
    modalidad:                   ModalidadMantenimiento
    fecha_proxima_mantenimiento: Optional[str] = None  # ISO date string "YYYY-MM-DD"

    @field_validator("fecha_proxima_mantenimiento")
    @classmethod
    def validar_fecha_preventivo(cls, v, info):
        clasificacion = info.data.get("clasificacion")
        if clasificacion == ClasificacionMantenimiento.preventivo and not v:
            raise ValueError("fecha_proxima_mantenimiento es requerida para mantenimiento preventivo.")
        if clasificacion == ClasificacionMantenimiento.correctivo:
            return None  # ignorar fecha si es correctivo
        return v


class SolicitudMantenimientoOut(BaseModel):
    id:                          int
    consecutivo:                 str
    titulo:                      str
    descripcion:                 str
    tipo_mantenimiento:          str
    clasificacion:               str
    modalidad:                   str
    fecha_proxima_mantenimiento: Optional[str]
    estado:                      str
    fecha_programada:            Optional[str]
    notas_evaluacion:            Optional[str]
    solicitante_id:              int
    solicitante_nombre:          Optional[str]
    asignado_id:                 Optional[int]
    asignado_nombre:             Optional[str]
    empresa_nombre:              Optional[str]
    created_at:                  str
    updated_at:                  str


class SolicitudesMantenimientoListResponse(BaseModel):
    items:  list[SolicitudMantenimientoOut]
    total:  int
    page:   int
    pages:  int


class CambiarEstadoBody(BaseModel):
    estado_nuevo: str
    nota:         Optional[str] = None


class AsignarBody(BaseModel):
    asignado_id: Optional[int] = None  # None = desasignar


class ActualizarProgramadoBody(BaseModel):
    fecha_programada:  Optional[str] = None
    notas_evaluacion:  Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generar_consecutivo(db: Session) -> str:
    from datetime import date
    anio = date.today().year
    count = db.exec(
        select(func.count(SolicitudMantenimiento.id)).where(
            SolicitudMantenimiento.consecutivo.startswith(f"MNT-{anio}-")
        )
    ).one()
    return f"MNT-{anio}-{count + 1:03d}"


def _enriquecer(sol: SolicitudMantenimiento, users_by_id: dict) -> SolicitudMantenimientoOut:
    sol_user = users_by_id.get(sol.solicitante_id)
    asig_user = users_by_id.get(sol.asignado_id) if sol.asignado_id else None
    return SolicitudMantenimientoOut(
        id=sol.id,
        consecutivo=sol.consecutivo,
        titulo=sol.titulo,
        descripcion=sol.descripcion,
        tipo_mantenimiento=sol.tipo_mantenimiento,
        clasificacion=sol.clasificacion,
        modalidad=sol.modalidad,
        fecha_proxima_mantenimiento=sol.fecha_proxima_mantenimiento.isoformat() if sol.fecha_proxima_mantenimiento else None,
        estado=sol.estado,
        fecha_programada=sol.fecha_programada.isoformat() if sol.fecha_programada else None,
        notas_evaluacion=sol.notas_evaluacion,
        solicitante_id=sol.solicitante_id,
        solicitante_nombre=sol_user.full_name if sol_user else None,
        asignado_id=sol.asignado_id,
        asignado_nombre=asig_user.full_name if asig_user else None,
        empresa_nombre=sol.empresa_nombre,
        created_at=sol.created_at.isoformat(),
        updated_at=sol.updated_at.isoformat(),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/crear", status_code=status.HTTP_201_CREATED, response_model=SolicitudMantenimientoOut)
def crear_solicitud(
    body: SolicitudMantenimientoCreate,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type
    consecutivo = _generar_consecutivo(oc_db)

    fecha_proxima = None
    if body.fecha_proxima_mantenimiento:
        fecha_proxima = date_type.fromisoformat(body.fecha_proxima_mantenimiento)

    sol = SolicitudMantenimiento(
        consecutivo=consecutivo,
        titulo=body.titulo.strip(),
        descripcion=body.descripcion.strip(),
        tipo_mantenimiento=body.tipo_mantenimiento,
        clasificacion=body.clasificacion.value,
        modalidad=body.modalidad.value,
        fecha_proxima_mantenimiento=fecha_proxima,
        solicitante_id=current_user.id,
        empresa_nombre=getattr(current_user, "empresa_nombre", None),
    )
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)

    # Registrar historial
    hist = HistorialMantenimiento(
        solicitud_id=sol.id,
        estado_anterior=None,
        estado_nuevo=EstadoMantenimiento.solicitud,
        nota="Solicitud creada",
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name or current_user.email,
    )
    oc_db.add(hist)
    oc_db.commit()

    log.info("Solicitud de mantenimiento creada: %s por usuario %s", consecutivo, current_user.email)
    return _enriquecer(sol, {current_user.id: current_user})


@router.get("/", response_model=SolicitudesMantenimientoListResponse)
def listar_solicitudes(
    estado:        Optional[str] = Query(None),
    clasificacion: Optional[str] = Query(None),
    modalidad:     Optional[str] = Query(None),
    q:             Optional[str] = Query(None),
    page:          int = Query(1, ge=1),
    limit:         int = Query(20, ge=1, le=100),
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.core.permissions import user_has_permission

    stmt = select(SolicitudMantenimiento)

    # Auxiliar solo ve sus propias solicitudes o las asignadas a él
    puede_ver_todos = (
        current_user.role in ("admin", "directivo")
        or user_has_permission(app_db, current_user, "mod_mantenimiento")
    )
    if not puede_ver_todos:
        stmt = stmt.where(
            (SolicitudMantenimiento.solicitante_id == current_user.id)
            | (SolicitudMantenimiento.asignado_id == current_user.id)
        )

    if estado:
        stmt = stmt.where(SolicitudMantenimiento.estado == estado)
    if clasificacion:
        stmt = stmt.where(SolicitudMantenimiento.clasificacion == clasificacion)
    if modalidad:
        stmt = stmt.where(SolicitudMantenimiento.modalidad == modalidad)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            SolicitudMantenimiento.titulo.ilike(like)
            | SolicitudMantenimiento.consecutivo.ilike(like)
        )

    total = oc_db.exec(select(func.count()).select_from(stmt.subquery())).one()
    items = oc_db.exec(
        stmt.order_by(SolicitudMantenimiento.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()

    # Resolver nombres de usuarios
    user_ids = {s.solicitante_id for s in items} | {s.asignado_id for s in items if s.asignado_id}
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    users_by_id = {u.id: u for u in users}

    return SolicitudesMantenimientoListResponse(
        items=[_enriquecer(s, users_by_id) for s in items],
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 1,
    )


@router.get("/{solicitud_id}", response_model=SolicitudMantenimientoOut)
def obtener_solicitud(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    # Verificar acceso
    from app.core.permissions import user_has_permission
    puede_ver_todos = current_user.role in ("admin", "directivo") or user_has_permission(app_db, current_user, "mod_mantenimiento")
    if not puede_ver_todos and sol.solicitante_id != current_user.id and sol.asignado_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    user_ids = {sol.solicitante_id}
    if sol.asignado_id:
        user_ids.add(sol.asignado_id)
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    return _enriquecer(sol, {u.id: u for u in users})


@router.patch("/{solicitud_id}/estado", response_model=SolicitudMantenimientoOut)
def cambiar_estado(
    solicitud_id: int,
    body: CambiarEstadoBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(require_mantenimiento),
):
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    transiciones_validas = _TRANSICIONES_MANT.get(sol.estado, set())
    if body.estado_nuevo not in transiciones_validas:
        raise HTTPException(
            status_code=400,
            detail=f"Transición inválida: {sol.estado} → {body.estado_nuevo}. "
                   f"Permitidas: {sorted(transiciones_validas)}",
        )

    estado_anterior = sol.estado
    sol.estado = body.estado_nuevo
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)

    hist = HistorialMantenimiento(
        solicitud_id=sol.id,
        estado_anterior=estado_anterior,
        estado_nuevo=body.estado_nuevo,
        nota=body.nota,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name or current_user.email,
    )
    oc_db.add(hist)
    oc_db.commit()
    oc_db.refresh(sol)

    log.info("Estado %s → %s en solicitud %s por %s", estado_anterior, body.estado_nuevo, sol.consecutivo, current_user.email)

    users_by_id = {current_user.id: current_user}
    if sol.asignado_id and sol.asignado_id != current_user.id:
        asig = app_db.get(User, sol.asignado_id)
        if asig:
            users_by_id[asig.id] = asig
    return _enriquecer(sol, users_by_id)


@router.patch("/{solicitud_id}/asignar", response_model=SolicitudMantenimientoOut)
def asignar_auxiliar(
    solicitud_id: int,
    body: AsignarBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(require_mantenimiento),
):
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    sol.asignado_id = body.asignado_id
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)

    user_ids = {sol.solicitante_id}
    if sol.asignado_id:
        user_ids.add(sol.asignado_id)
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    return _enriquecer(sol, {u.id: u for u in users})


@router.patch("/{solicitud_id}/programar", response_model=SolicitudMantenimientoOut)
def actualizar_programacion(
    solicitud_id: int,
    body: ActualizarProgramadoBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(require_mantenimiento),
):
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    if body.fecha_programada is not None:
        sol.fecha_programada = datetime.fromisoformat(body.fecha_programada) if body.fecha_programada else None
    if body.notas_evaluacion is not None:
        sol.notas_evaluacion = body.notas_evaluacion
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)

    user_ids = {sol.solicitante_id}
    if sol.asignado_id:
        user_ids.add(sol.asignado_id)
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    return _enriquecer(sol, {u.id: u for u in users})


@router.get("/{solicitud_id}/historial")
def obtener_historial(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    _: User = Depends(get_current_user),
):
    items = oc_db.exec(
        select(HistorialMantenimiento)
        .where(HistorialMantenimiento.solicitud_id == solicitud_id)
        .order_by(HistorialMantenimiento.fecha.asc())
    ).all()
    return [
        {
            "id": h.id,
            "estado_anterior": h.estado_anterior,
            "estado_nuevo": h.estado_nuevo,
            "nota": h.nota,
            "usuario_id": h.usuario_id,
            "usuario_nombre": h.usuario_nombre,
            "fecha": h.fecha.isoformat(),
        }
        for h in items
    ]

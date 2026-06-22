import logging
import math
import os
import secrets
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
    MntAprobacion,
    MntConfig,
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
}

# ── Schemas ───────────────────────────────────────────────────────────────────

class SolicitudMantenimientoCreate(BaseModel):
    titulo:                      str
    descripcion:                 str
    tipo_mantenimiento:          str
    clasificacion:               ClasificacionMantenimiento
    modalidad:                   ModalidadMantenimiento
    fecha_proxima_mantenimiento: Optional[str] = None
    origen:                      str = "intranet"
    prioridad:                   str = "media"
    monto_estimado:              Optional[float] = None
    activo_qr_id:                Optional[int] = None

    @field_validator("fecha_proxima_mantenimiento")
    @classmethod
    def validar_fecha_preventivo(cls, v, info):
        clasificacion = info.data.get("clasificacion")
        if clasificacion == ClasificacionMantenimiento.preventivo and not v:
            raise ValueError("fecha_proxima_mantenimiento es requerida para mantenimiento preventivo.")
        if clasificacion == ClasificacionMantenimiento.correctivo:
            return None
        return v


class SolicitudRetroactivaCreate(BaseModel):
    titulo:             str
    descripcion:        str
    tipo_mantenimiento: str
    clasificacion:      ClasificacionMantenimiento
    modalidad:          ModalidadMantenimiento
    nota_cierre:        str
    monto_real:         Optional[float] = None
    evidencia_url:      Optional[str] = None
    asignado_id:        Optional[int] = None


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
    origen:                      str
    prioridad:                   str
    monto_estimado:              Optional[float]
    monto_real:                  Optional[float]
    evidencia_url:               Optional[str]
    activo_qr_id:                Optional[int]
    requiere_aprobacion:         bool
    aprobaciones_count:          int
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
    asignado_id: Optional[int] = None


class ActualizarProgramadoBody(BaseModel):
    fecha_programada: Optional[str] = None
    notas_evaluacion: Optional[str] = None
    monto_estimado: Optional[float] = None


class SubirEvidenciaBody(BaseModel):
    evidencia_url: str
    monto_real:    Optional[float] = None
    nota:          Optional[str] = None


class AccesoMovilOut(BaseModel):
    url_qr:            str
    url_jwt:           str
    whatsapp_numero:   Optional[str]
    mensaje_whatsapp:  str


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


def _enriquecer(
    sol: SolicitudMantenimiento,
    users_by_id: dict,
    aprobaciones_count: int = 0,
) -> SolicitudMantenimientoOut:
    sol_user  = users_by_id.get(sol.solicitante_id)
    asig_user = users_by_id.get(sol.asignado_id) if sol.asignado_id else None
    monto_est = float(sol.monto_estimado) if sol.monto_estimado is not None else None
    requiere  = monto_est is not None and monto_est > 2_000_000
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
        origen=getattr(sol, "origen", "intranet") or "intranet",
        prioridad=getattr(sol, "prioridad", "media") or "media",
        monto_estimado=monto_est,
        monto_real=float(sol.monto_real) if getattr(sol, "monto_real", None) is not None else None,
        evidencia_url=getattr(sol, "evidencia_url", None),
        activo_qr_id=getattr(sol, "activo_qr_id", None),
        requiere_aprobacion=requiere,
        aprobaciones_count=aprobaciones_count,
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
        origen=body.origen,
        prioridad=body.prioridad,
        monto_estimado=body.monto_estimado,
        activo_qr_id=body.activo_qr_id,
        mobile_access_token=secrets.token_urlsafe(32),
    )
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)

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


@router.post("/retroactivo", status_code=status.HTTP_201_CREATED, response_model=SolicitudMantenimientoOut)
def registrar_retroactivo(
    body: SolicitudRetroactivaCreate,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra un trabajo de mantenimiento que ya fue resuelto informalmente."""
    consecutivo = _generar_consecutivo(oc_db)

    sol = SolicitudMantenimiento(
        consecutivo=consecutivo,
        titulo=body.titulo.strip(),
        descripcion=body.descripcion.strip(),
        tipo_mantenimiento=body.tipo_mantenimiento,
        clasificacion=body.clasificacion.value,
        modalidad=body.modalidad.value,
        solicitante_id=current_user.id,
        asignado_id=body.asignado_id,
        empresa_nombre=getattr(current_user, "empresa_nombre", None),
        origen="telefonico_retroactivo",
        prioridad="media",
        monto_real=body.monto_real,
        evidencia_url=body.evidencia_url,
        estado=EstadoMantenimiento.completado,
        mobile_access_token=secrets.token_urlsafe(32),
    )
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)

    hist = HistorialMantenimiento(
        solicitud_id=sol.id,
        estado_anterior=None,
        estado_nuevo=EstadoMantenimiento.completado,
        nota=f"Registro retroactivo: {body.nota_cierre}",
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name or current_user.email,
    )
    oc_db.add(hist)
    oc_db.commit()

    log.info("Registro retroactivo creado: %s por %s", consecutivo, current_user.email)
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

    from app.core.permissions import user_has_permission
    puede_ver_todos = current_user.role in ("admin", "directivo") or user_has_permission(app_db, current_user, "mod_mantenimiento")
    if not puede_ver_todos and sol.solicitante_id != current_user.id and sol.asignado_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    user_ids = {sol.solicitante_id}
    if sol.asignado_id:
        user_ids.add(sol.asignado_id)
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()

    aprobaciones_count = oc_db.exec(
        select(func.count(MntAprobacion.id)).where(
            MntAprobacion.solicitud_id == solicitud_id,
            MntAprobacion.aprobado == True,
        )
    ).one()

    return _enriquecer(sol, {u.id: u for u in users}, aprobaciones_count=aprobaciones_count)


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

    # Gate 1: evaluacion → programado con monto > $2M requiere 3 aprobaciones
    if sol.estado == EstadoMantenimiento.evaluacion and body.estado_nuevo == EstadoMantenimiento.programado:
        monto = float(getattr(sol, "monto_estimado", 0) or 0)
        if monto > 2_000_000:
            count = oc_db.exec(
                select(func.count(MntAprobacion.id)).where(
                    MntAprobacion.solicitud_id == sol.id,
                    MntAprobacion.aprobado == True,
                )
            ).one()
            if count < 3:
                raise HTTPException(
                    status_code=400,
                    detail=f"Este mantenimiento supera $2.000.000. Requiere 3 aprobaciones. "
                           f"Actualmente tiene {count}/3.",
                )

    # Gate 2: ejecucion → completado requiere foto de evidencia
    if sol.estado == EstadoMantenimiento.ejecucion and body.estado_nuevo == EstadoMantenimiento.completado:
        if not getattr(sol, "evidencia_url", None):
            raise HTTPException(
                status_code=400,
                detail="Para completar el mantenimiento debe subir una foto de evidencia del trabajo realizado.",
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
    if body.monto_estimado is not None:
        sol.monto_estimado = body.monto_estimado
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)

    user_ids = {sol.solicitante_id}
    if sol.asignado_id:
        user_ids.add(sol.asignado_id)
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    return _enriquecer(sol, {u.id: u for u in users})


@router.post("/{solicitud_id}/evidencia", response_model=SolicitudMantenimientoOut)
def subir_evidencia(
    solicitud_id: int,
    body: SubirEvidenciaBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sube la URL de la foto de evidencia del trabajo completado."""
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    from app.core.permissions import user_has_permission
    puede = (
        current_user.role == "admin"
        or sol.asignado_id == current_user.id
        or user_has_permission(app_db, current_user, "mod_mantenimiento")
    )
    if not puede:
        raise HTTPException(status_code=403, detail="Sin permiso para subir evidencia.")

    sol.evidencia_url = body.evidencia_url
    if body.monto_real is not None:
        sol.monto_real = body.monto_real
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)

    if body.nota:
        hist = HistorialMantenimiento(
            solicitud_id=sol.id,
            estado_anterior=sol.estado,
            estado_nuevo=sol.estado,
            nota=f"Evidencia subida: {body.nota}",
            usuario_id=current_user.id,
            usuario_nombre=current_user.full_name or current_user.email,
        )
        oc_db.add(hist)
    oc_db.commit()
    oc_db.refresh(sol)

    return _enriquecer(sol, {current_user.id: current_user})


def _acceso_movil_out(sol: SolicitudMantenimiento, oc_db: Session) -> AccesoMovilOut:
    from app.routers.mantenimiento.mobile import (
        ensure_mobile_access_token,
        frontend_base_url,
        generar_magic_token,
        url_acceso_qr,
    )

    access = ensure_mobile_access_token(oc_db, sol)
    url_qr = url_acceso_qr(access)
    jwt = generar_magic_token(sol.id)
    url_jwt = f"{frontend_base_url()}/m/{jwt}"
    cfg = oc_db.get(MntConfig, "whatsapp_numero_default")
    whatsapp = cfg.value if cfg and cfg.value else None
    mensaje = (
        f"Mantenimiento {sol.consecutivo}\n"
        f"{sol.titulo}\n\n"
        f"Gestiona desde el celular (sin login):\n{url_qr}"
    )
    return AccesoMovilOut(
        url_qr=url_qr,
        url_jwt=url_jwt,
        whatsapp_numero=whatsapp,
        mensaje_whatsapp=mensaje,
    )


@router.get("/{solicitud_id}/acceso-movil", response_model=AccesoMovilOut)
def obtener_acceso_movil(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    _: User = Depends(require_mantenimiento),
):
    """URL estable para QR + JWT temporal + datos para WhatsApp."""
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    if sol.estado in (EstadoMantenimiento.cerrado, EstadoMantenimiento.cancelado):
        raise HTTPException(status_code=400, detail="La solicitud está cerrada o cancelada.")
    return _acceso_movil_out(sol, oc_db)


@router.post("/{solicitud_id}/regenerar-acceso", response_model=AccesoMovilOut)
def regenerar_acceso_movil(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    _: User = Depends(require_mantenimiento),
):
    """Invalida el QR anterior y genera un token nuevo."""
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    sol.mobile_access_token = secrets.token_urlsafe(32)
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)
    return _acceso_movil_out(sol, oc_db)


@router.post("/{solicitud_id}/magic-link")
def generar_magic_link(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    current_user: User = Depends(require_mantenimiento),
):
    """Genera un magic link JWT para que el auxiliar acceda desde su celular sin login."""
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    from app.routers.mantenimiento.mobile import frontend_base_url, generar_magic_token

    token = generar_magic_token(solicitud_id)
    url = f"{frontend_base_url()}/m/{token}"
    return {"url": url, "token": token}


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

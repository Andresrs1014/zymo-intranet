"""Vista móvil para el auxiliar de mantenimiento.
Acceso vía JWT (24h) o token estable por solicitud (QR / WhatsApp).
Hub: lista todas las solicitudes activas del auxiliar asignado.
"""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic import BaseModel
from sqlmodel import Session, select

log = logging.getLogger(__name__)
router = APIRouter(prefix="/m", tags=["Mantenimiento - Mobile"])

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

_ESTADOS_TERMINALES = {"completado", "cancelado", "cerrado"}
_ESTADOS_ACTIVOS = {"solicitud", "programado", "ejecucion"}


def generar_magic_token(solicitud_id: int) -> str:
    payload = {
        "scope": "mnt_mobile",
        "solicitud_id": solicitud_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _solicitud_id_desde_jwt(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("scope") != "mnt_mobile":
            return None
        return int(payload["solicitud_id"])
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Este enlace expiró (los enlaces temporales duran 24h). Pide uno nuevo al equipo administrativo.")
    except JWTError:
        return None


def ensure_mobile_access_token(oc_db: Session, sol) -> str:
    from app.models.mantenimiento import SolicitudMantenimiento

    if isinstance(sol, SolicitudMantenimiento) and sol.mobile_access_token:
        return sol.mobile_access_token
    token = secrets.token_urlsafe(32)
    sol.mobile_access_token = token
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)
    return token


def _lookup_solicitud_por_token(token: str, oc_db: Session):
    from app.models.mantenimiento import SolicitudMantenimiento

    jwt_id = _solicitud_id_desde_jwt(token)
    if jwt_id is not None:
        sol = oc_db.get(SolicitudMantenimiento, jwt_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        return sol

    sol = oc_db.exec(
        select(SolicitudMantenimiento).where(
            SolicitudMantenimiento.mobile_access_token == token
        )
    ).first()
    if not sol:
        raise HTTPException(status_code=401, detail="Enlace inválido o expirado.")
    return sol


def resolve_solicitud_id(token: str, oc_db: Session) -> int:
    sol = _lookup_solicitud_por_token(token, oc_db)
    if sol.estado in _ESTADOS_TERMINALES:
        raise HTTPException(status_code=403, detail="Esta solicitud ya está finalizada.")
    return sol.id


def _solicitudes_visibles(token: str, oc_db: Session) -> tuple:
    """Retorna (ancla, lista de solicitudes accesibles para el auxiliar)."""
    from app.models.mantenimiento import SolicitudMantenimiento

    ancla = _lookup_solicitud_por_token(token, oc_db)
    if ancla.asignado_id:
        items = oc_db.exec(
            select(SolicitudMantenimiento)
            .where(SolicitudMantenimiento.asignado_id == ancla.asignado_id)
            .order_by(SolicitudMantenimiento.updated_at.desc())
        ).all()
    else:
        items = [ancla]
    return ancla, items


def _assert_acceso_solicitud(token: str, solicitud_id: int, oc_db: Session):
    _, visibles = _solicitudes_visibles(token, oc_db)
    ids = {s.id for s in visibles}
    if solicitud_id not in ids:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta solicitud.")


def frontend_base_url() -> str:
    return os.environ.get("FRONTEND_URL", "https://zymointranet.com").rstrip("/")


def url_acceso_qr(access_token: str) -> str:
    return f"{frontend_base_url()}/m/q/{access_token}"


class AccionMobileBody(BaseModel):
    accion:        str
    evidencia_url: Optional[str] = None
    monto_real:    Optional[float] = None
    nota:          Optional[str] = None


class CrearOCMobileBody(BaseModel):
    descripcion:               str
    categoria:                 Optional[str] = None
    nivel_prioridad:           str = "Media"
    observaciones_solicitante: Optional[str] = None


class MobileOut(BaseModel):
    solicitud_id:       int
    consecutivo:        str
    titulo:             str
    descripcion:        str
    estado:             str
    asignado_nombre:    Optional[str]
    solicitante_nombre: Optional[str]


class MobileSolicitudResumen(BaseModel):
    solicitud_id:       int
    consecutivo:        str
    titulo:             str
    estado:             str
    prioridad:          str
    fecha_programada:   Optional[str]


class MobileHubOut(BaseModel):
    auxiliar_nombre:    Optional[str]
    ancla_id:           int
    activas:            list[MobileSolicitudResumen]
    recientes:          list[MobileSolicitudResumen]


class MobileDetalleOut(MobileOut):
    prioridad:          str
    tipo_mantenimiento: str
    fecha_programada:   Optional[str]
    monto_estimado:     Optional[float]
    evidencia_url:      Optional[str]
    ocs:                list[dict]


def _users_for_solicitudes(app_db: Session, solicitudes) -> dict:
    from app.models.user import User

    user_ids: set[int] = set()
    for s in solicitudes:
        user_ids.add(s.solicitante_id)
        if s.asignado_id:
            user_ids.add(s.asignado_id)
    if not user_ids:
        return {}
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    return {u.id: u for u in users}


def _mobile_out(sol, by_id: dict) -> MobileOut:
    return MobileOut(
        solicitud_id=sol.id,
        consecutivo=sol.consecutivo,
        titulo=sol.titulo,
        descripcion=sol.descripcion,
        estado=sol.estado,
        asignado_nombre=by_id[sol.asignado_id].full_name if sol.asignado_id and sol.asignado_id in by_id else None,
        solicitante_nombre=by_id[sol.solicitante_id].full_name if sol.solicitante_id in by_id else None,
    )


def _resumen(sol) -> MobileSolicitudResumen:
    return MobileSolicitudResumen(
        solicitud_id=sol.id,
        consecutivo=sol.consecutivo,
        titulo=sol.titulo,
        estado=sol.estado,
        prioridad=getattr(sol, "prioridad", "media") or "media",
        fecha_programada=sol.fecha_programada.isoformat() if sol.fecha_programada else None,
    )


def _ejecutar_accion(sol, body: AccionMobileBody, oc_db: Session) -> dict:
    from app.models.mantenimiento import HistorialMantenimiento, EstadoMantenimiento

    if sol.estado in _ESTADOS_TERMINALES:
        raise HTTPException(status_code=400, detail="La solicitud ya está finalizada.")

    estado_anterior = sol.estado

    if body.accion == "en_camino":
        if sol.estado not in (EstadoMantenimiento.solicitud, EstadoMantenimiento.programado):
            raise HTTPException(
                status_code=400,
                detail=f"No se puede iniciar desde estado '{sol.estado}'.",
            )
        sol.estado = EstadoMantenimiento.ejecucion

    elif body.accion == "completado":
        if not body.evidencia_url:
            raise HTTPException(
                status_code=400,
                detail="Se requiere foto de evidencia para completar.",
            )
        if sol.modalidad == "externo":
            from app.services.mnt_evidencia import evidencia_antes_de, registrar_evidencia_externa
            if not evidencia_antes_de(sol):
                raise HTTPException(
                    status_code=400,
                    detail="Falta evidencia inicial (antes) del mantenimiento externo.",
                )
            registrar_evidencia_externa(sol, "despues", body.evidencia_url)
        else:
            sol.evidencia_url = body.evidencia_url
        if body.monto_real is not None:
            sol.monto_real = body.monto_real
        sol.estado = EstadoMantenimiento.completado

    elif body.accion == "necesita_repuesto":
        nota_extra = body.nota or "El auxiliar indica que necesita repuesto o proveedor externo."
        hist = HistorialMantenimiento(
            solicitud_id=sol.id,
            estado_anterior=sol.estado,
            estado_nuevo=sol.estado,
            nota=f"[MOBILE] Necesita repuesto: {nota_extra}",
            usuario_id=sol.asignado_id or sol.solicitante_id,
            usuario_nombre="Auxiliar (mobile)",
        )
        oc_db.add(hist)
        oc_db.commit()
        return {"ok": True, "mensaje": "Notificación registrada."}

    else:
        raise HTTPException(status_code=400, detail="Acción inválida.")

    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)

    hist = HistorialMantenimiento(
        solicitud_id=sol.id,
        estado_anterior=estado_anterior,
        estado_nuevo=sol.estado,
        nota=f"[MOBILE] {body.nota or body.accion}",
        usuario_id=sol.asignado_id or sol.solicitante_id,
        usuario_nombre="Auxiliar (mobile)",
    )
    oc_db.add(hist)
    oc_db.commit()

    log.info("Acción mobile '%s' en solicitud %s", body.accion, sol.consecutivo)
    return {"ok": True, "estado_nuevo": sol.estado}


@router.get("/{token}/redirect")
def redirect_portal(token: str):
    """Redirige links legacy al portal permanente del auxiliar."""
    from app.oc_database import get_oc_engine
    from app.routers.mantenimiento.portal_tokens import ensure_portal_token, portal_url

    with Session(get_oc_engine()) as oc_db:
        sol = _lookup_solicitud_por_token(token, oc_db)
        if sol.asignado_id:
            pt = ensure_portal_token(oc_db, sol.asignado_id)
            return {"url": portal_url(pt, sol.id), "permanente": True}
        access = ensure_mobile_access_token(oc_db, sol)
        return {"url": url_acceso_qr(access), "permanente": False}


@router.get("/{token}/hub", response_model=MobileHubOut)
def obtener_hub_mobile(token: str):
    """Lista solicitudes activas del auxiliar (mismo asignado_id que el token ancla)."""
    from app.oc_database import get_oc_engine
    from app.database import get_engine
    from app.models.mantenimiento import SolicitudMantenimiento

    with Session(get_oc_engine()) as oc_db:
        ancla, visibles = _solicitudes_visibles(token, oc_db)
        activas = [s for s in visibles if s.estado in _ESTADOS_ACTIVOS]
        recientes = [s for s in visibles if s.estado in _ESTADOS_TERMINALES][:10]

        with Session(get_engine()) as app_db:
            by_id = _users_for_solicitudes(app_db, visibles)
            auxiliar = by_id.get(ancla.asignado_id) if ancla.asignado_id else None

        return MobileHubOut(
            auxiliar_nombre=auxiliar.full_name if auxiliar else None,
            ancla_id=ancla.id,
            activas=[_resumen(s) for s in activas],
            recientes=[_resumen(s) for s in recientes],
        )


@router.get("/{token}/solicitudes/{solicitud_id}", response_model=MobileDetalleOut)
def obtener_detalle_mobile(token: str, solicitud_id: int):
    """Detalle completo de una solicitud accesible para el auxiliar."""
    from app.oc_database import get_oc_engine
    from app.database import get_engine
    from app.models.mantenimiento import SolicitudMantenimiento
    from app.models.oc import SolicitudOC
    from app.routers.mantenimiento.oc_vinculada import oc_vinculada_out

    with Session(get_oc_engine()) as oc_db:
        _assert_acceso_solicitud(token, solicitud_id, oc_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

        ocs = oc_db.exec(
            select(SolicitudOC)
            .where(SolicitudOC.mantenimiento_id == solicitud_id)
            .order_by(SolicitudOC.fecha_solicitud.asc())
        ).all()

        with Session(get_engine()) as app_db:
            by_id = _users_for_solicitudes(app_db, [sol])
            base = _mobile_out(sol, by_id)

        return MobileDetalleOut(
            **base.model_dump(),
            prioridad=getattr(sol, "prioridad", "media") or "media",
            tipo_mantenimiento=sol.tipo_mantenimiento,
            fecha_programada=sol.fecha_programada.isoformat() if sol.fecha_programada else None,
            monto_estimado=float(sol.monto_estimado) if sol.monto_estimado is not None else None,
            evidencia_url=sol.evidencia_url,
            ocs=[oc_vinculada_out(oc).model_dump() for oc in ocs],
        )


@router.post("/{token}/solicitudes/{solicitud_id}/accion")
def ejecutar_accion_mobile_hub(token: str, solicitud_id: int, body: AccionMobileBody):
    """Acción del auxiliar sobre una solicitud del hub."""
    from app.oc_database import get_oc_engine
    from app.models.mantenimiento import SolicitudMantenimiento

    acciones_validas = {"en_camino", "completado", "necesita_repuesto"}
    if body.accion not in acciones_validas:
        raise HTTPException(status_code=400, detail=f"Acción inválida. Permitidas: {acciones_validas}")

    with Session(get_oc_engine()) as oc_db:
        _assert_acceso_solicitud(token, solicitud_id, oc_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        return _ejecutar_accion(sol, body, oc_db)


@router.post("/{token}/solicitudes/{solicitud_id}/oc-vinculada")
def crear_oc_mobile(token: str, solicitud_id: int, body: CrearOCMobileBody):
    """Crea solicitud de compra vinculada desde el celular del auxiliar."""
    from app.oc_database import get_oc_engine
    from app.database import get_engine
    from app.models.mantenimiento import SolicitudMantenimiento, HistorialMantenimiento
    from app.models.user import User
    from app.routers.mantenimiento.oc_vinculada import (
        CrearOCVinculadaBody,
        crear_oc_vinculada_core,
        oc_vinculada_out,
    )

    with Session(get_oc_engine()) as oc_db:
        _assert_acceso_solicitud(token, solicitud_id, oc_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        if sol.estado in _ESTADOS_TERMINALES:
            raise HTTPException(status_code=400, detail="No se puede crear OC en solicitud finalizada.")

        with Session(get_engine()) as app_db:
            auxiliar = app_db.get(User, sol.asignado_id) if sol.asignado_id else None
            if auxiliar:
                nombre = auxiliar.full_name or auxiliar.email
                email = auxiliar.email
            else:
                nombre = "Auxiliar (mobile)"
                email = "auxiliar@zymo.local"

        oc_body = CrearOCVinculadaBody(
            descripcion=body.descripcion,
            categoria=body.categoria,
            nivel_prioridad=body.nivel_prioridad,
            observaciones_solicitante=body.observaciones_solicitante,
        )
        oc = crear_oc_vinculada_core(oc_db, sol, oc_body, nombre, email)

        hist = HistorialMantenimiento(
            solicitud_id=sol.id,
            estado_anterior=sol.estado,
            estado_nuevo=sol.estado,
            nota=f"[MOBILE] OC creada: {oc.consecutivo_os}",
            usuario_id=sol.asignado_id or sol.solicitante_id,
            usuario_nombre=nombre,
        )
        oc_db.add(hist)
        oc_db.commit()

        log.info("OC mobile %s desde mantenimiento %s", oc.consecutivo_os, sol.consecutivo)
        return oc_vinculada_out(oc)


@router.get("/{token}", response_model=MobileOut)
def obtener_solicitud_mobile(token: str):
    """Datos básicos para la vista móvil (sin login) — compatibilidad."""
    from app.oc_database import get_oc_engine
    from app.database import get_engine
    from app.models.mantenimiento import SolicitudMantenimiento

    with Session(get_oc_engine()) as oc_db:
        sol = _lookup_solicitud_por_token(token, oc_db)
        if sol.estado in _ESTADOS_TERMINALES:
            raise HTTPException(status_code=403, detail="Esta solicitud ya está finalizada.")

        with Session(get_engine()) as app_db:
            by_id = _users_for_solicitudes(app_db, [sol])

        return _mobile_out(sol, by_id)


@router.post("/{token}/accion")
def ejecutar_accion_mobile(token: str, body: AccionMobileBody):
    """Acción del auxiliar — compatibilidad con enlace de una sola solicitud."""
    from app.oc_database import get_oc_engine
    from app.models.mantenimiento import SolicitudMantenimiento

    acciones_validas = {"en_camino", "completado", "necesita_repuesto"}
    if body.accion not in acciones_validas:
        raise HTTPException(status_code=400, detail=f"Acción inválida. Permitidas: {acciones_validas}")

    with Session(get_oc_engine()) as oc_db:
        solicitud_id = resolve_solicitud_id(token, oc_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        return _ejecutar_accion(sol, body, oc_db)

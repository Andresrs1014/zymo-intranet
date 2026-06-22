"""Vista m?vil para el auxiliar de mantenimiento.
Acceso v?a JWT (24h) o token estable por solicitud (QR / WhatsApp).
"""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlmodel import Session, select

log = logging.getLogger(__name__)
router = APIRouter(prefix="/m", tags=["Mantenimiento - Mobile"])

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

_ESTADOS_BLOQUEADOS = {"cerrado", "cancelado"}


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


def resolve_solicitud_id(token: str, oc_db: Session) -> int:
    from app.models.mantenimiento import SolicitudMantenimiento

    jwt_id = _solicitud_id_desde_jwt(token)
    if jwt_id is not None:
        sol = oc_db.get(SolicitudMantenimiento, jwt_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        if sol.estado in _ESTADOS_BLOQUEADOS:
            raise HTTPException(status_code=403, detail="Esta solicitud ya est? cerrada.")
        return sol.id

    sol = oc_db.exec(
        select(SolicitudMantenimiento).where(
            SolicitudMantenimiento.mobile_access_token == token
        )
    ).first()
    if not sol:
        raise HTTPException(status_code=401, detail="Enlace inv?lido o expirado.")
    if sol.estado in _ESTADOS_BLOQUEADOS:
        raise HTTPException(status_code=403, detail="Esta solicitud ya est? cerrada.")
    return sol.id


def frontend_base_url() -> str:
    return os.environ.get("FRONTEND_URL", "https://zymointranet.com").rstrip("/")


def url_acceso_qr(access_token: str) -> str:
    return f"{frontend_base_url()}/m/q/{access_token}"


class AccionMobileBody(BaseModel):
    accion:        str
    evidencia_url: Optional[str] = None
    monto_real:    Optional[float] = None
    nota:          Optional[str] = None


class MobileOut(BaseModel):
    solicitud_id:       int
    consecutivo:        str
    titulo:             str
    descripcion:        str
    estado:             str
    asignado_nombre:    Optional[str]
    solicitante_nombre: Optional[str]


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


@router.get("/{token}", response_model=MobileOut)
def obtener_solicitud_mobile(token: str):
    """Datos b?sicos para la vista m?vil (sin login)."""
    from app.oc_database import get_oc_engine
    from app.database import get_engine
    from app.models.mantenimiento import SolicitudMantenimiento
    from app.models.user import User

    with Session(get_oc_engine()) as oc_db:
        solicitud_id = resolve_solicitud_id(token, oc_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

        with Session(get_engine()) as app_db:
            user_ids = {sol.solicitante_id}
            if sol.asignado_id:
                user_ids.add(sol.asignado_id)
            users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
            by_id = {u.id: u for u in users}

        return _mobile_out(sol, by_id)


@router.post("/{token}/accion")
def ejecutar_accion_mobile(token: str, body: AccionMobileBody):
    """Acci?n del auxiliar desde celular (sin login)."""
    from app.oc_database import get_oc_engine
    from app.models.mantenimiento import SolicitudMantenimiento, HistorialMantenimiento, EstadoMantenimiento

    acciones_validas = {"en_camino", "completado", "necesita_repuesto"}
    if body.accion not in acciones_validas:
        raise HTTPException(status_code=400, detail=f"Acci?n inv?lida. Permitidas: {acciones_validas}")

    with Session(get_oc_engine()) as oc_db:
        solicitud_id = resolve_solicitud_id(token, oc_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

        estado_anterior = sol.estado

        if body.accion == "en_camino":
            if sol.estado not in (
                EstadoMantenimiento.programado,
                EstadoMantenimiento.evaluacion,
                EstadoMantenimiento.solicitud,
            ):
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
            return {"ok": True, "mensaje": "Notificaci?n registrada. El equipo administrativo crear? la OC."}

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

        log.info("Acci?n mobile '%s' en solicitud %s", body.accion, sol.consecutivo)
        return {"ok": True, "estado_nuevo": sol.estado}

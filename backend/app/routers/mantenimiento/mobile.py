"""Vista móvil para el auxiliar de mantenimiento.
Magic link JWT con scope=mnt_mobile — no requiere sesión de usuario.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel

log = logging.getLogger(__name__)
router = APIRouter(prefix="/m", tags=["Mantenimiento - Mobile"])

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def generar_magic_token(solicitud_id: int) -> str:
    payload = {
        "scope": "mnt_mobile",
        "solicitud_id": solicitud_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _validar_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("scope") != "mnt_mobile":
            raise HTTPException(status_code=401, detail="Token inválido.")
        return int(payload["solicitud_id"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expirado o inválido.")


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


@router.get("/{token}", response_model=MobileOut)
def obtener_solicitud_mobile(token: str):
    """Retorna datos básicos de la solicitud para la vista móvil (sin login)."""
    from app.oc_database import get_oc_engine
    from app.database import get_engine
    from app.models.mantenimiento import SolicitudMantenimiento
    from app.models.user import User
    from sqlmodel import Session, select

    solicitud_id = _validar_token(token)

    with Session(get_oc_engine()) as oc_db:
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

        with Session(get_engine()) as app_db:
            user_ids = {sol.solicitante_id}
            if sol.asignado_id:
                user_ids.add(sol.asignado_id)
            users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
            by_id = {u.id: u for u in users}

        return MobileOut(
            solicitud_id=sol.id,
            consecutivo=sol.consecutivo,
            titulo=sol.titulo,
            descripcion=sol.descripcion,
            estado=sol.estado,
            asignado_nombre=by_id[sol.asignado_id].full_name if sol.asignado_id and sol.asignado_id in by_id else None,
            solicitante_nombre=by_id[sol.solicitante_id].full_name if sol.solicitante_id in by_id else None,
        )


@router.post("/{token}/accion")
def ejecutar_accion_mobile(token: str, body: AccionMobileBody):
    """El auxiliar ejecuta una acción desde su celular (sin login)."""
    from app.oc_database import get_oc_engine
    from app.models.mantenimiento import SolicitudMantenimiento, HistorialMantenimiento, EstadoMantenimiento
    from sqlmodel import Session

    solicitud_id = _validar_token(token)
    acciones_validas = {"en_camino", "completado", "necesita_repuesto"}
    if body.accion not in acciones_validas:
        raise HTTPException(status_code=400, detail=f"Acción inválida. Permitidas: {acciones_validas}")

    with Session(get_oc_engine()) as oc_db:
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

        estado_anterior = sol.estado

        if body.accion == "en_camino":
            if sol.estado not in (EstadoMantenimiento.programado, EstadoMantenimiento.evaluacion, EstadoMantenimiento.solicitud):
                raise HTTPException(status_code=400, detail=f"No se puede iniciar desde estado '{sol.estado}'.")
            sol.estado = EstadoMantenimiento.ejecucion

        elif body.accion == "completado":
            if not body.evidencia_url:
                raise HTTPException(status_code=400, detail="Se requiere foto de evidencia para completar.")
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
            return {"ok": True, "mensaje": "Notificación registrada. El equipo administrativo creará la OC."}

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

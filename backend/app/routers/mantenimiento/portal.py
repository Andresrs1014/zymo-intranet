"""API del portal móvil permanente — mismos datos que intranet, auth por token."""
import logging
import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.permissions import user_has_permission
from app.database import get_engine
from app.models.mantenimiento import (
    EstadoMantenimiento,
    HistorialMantenimiento,
    MntAprobacion,
    SolicitudMantenimiento,
)
from app.models.oc import SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_engine
from app.routers.mantenimiento.mobile import AccionMobileBody, _ejecutar_accion
from app.routers.mantenimiento.oc_vinculada import (
    CrearOCVinculadaBody,
    crear_oc_vinculada_core,
    oc_vinculada_out,
)
from app.routers.mantenimiento.portal_tokens import (
    portal_url,
    resolve_portal_user,
)
from app.routers.mantenimiento.solicitudes import (
    ActualizarProgramadoBody,
    AsignarBody,
    CambiarEstadoBody,
    SolicitudMantenimientoOut,
    SolicitudesMantenimientoListResponse,
    SubirEvidenciaBody,
    _TRANSICIONES_MANT,
    _enriquecer,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/portal/{portal_token}", tags=["Mantenimiento - Portal"])


class PortalSessionOut(BaseModel):
    user_id:       int
    full_name:     str
    email:         str
    role:          str
    app_permissions: list[str]
    url_portal:    str
    can_manage:    bool
    can_operate:   bool
    can_approve:   bool
    can_see_tablero: bool
    is_auxiliar:   bool


def _caps(user: User, app_db: Session) -> dict:
    is_aux = user.role == "auxiliar_mantenimiento"
    can_manage = (
        user.role in ("admin", "directivo")
        or (not is_aux and user_has_permission(app_db, user, "mod_mantenimiento"))
    )
    return {
        "can_manage": can_manage,
        "can_operate": is_aux or can_manage,
        "can_approve": user.role in ("admin", "directivo"),
        "can_see_tablero": user.role in ("admin", "directivo"),
        "is_auxiliar": is_aux,
    }


def _actor(portal_token: str) -> tuple[User, dict]:
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        return user, _caps(user, app_db)


def _assert_access(user: User, sol: SolicitudMantenimiento, caps: dict):
    if caps["can_manage"]:
        return
    if user.role == "auxiliar_mantenimiento" and sol.asignado_id == user.id:
        return
    if sol.solicitante_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Acceso denegado.")


def _require_manage(caps: dict):
    if not caps["can_manage"]:
        raise HTTPException(status_code=403, detail="Solo gestores pueden realizar esta acción.")


@router.get("/session", response_model=PortalSessionOut)
def portal_session(portal_token: str):
    from app.models.role import Role

    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        role = app_db.exec(select(Role).where(Role.name == user.role)).first()
        perms = list(role.app_permissions) if role and role.app_permissions else []
        return PortalSessionOut(
            user_id=user.id,
            full_name=user.full_name or user.email,
            email=user.email,
            role=user.role,
            app_permissions=perms,
            url_portal=portal_url(portal_token),
            **caps,
        )


@router.get("/solicitudes", response_model=SolicitudesMantenimientoListResponse)
def portal_listar_solicitudes(
    portal_token: str,
    estado:        Optional[str] = Query(None),
    clasificacion: Optional[str] = Query(None),
    modalidad:     Optional[str] = Query(None),
    q:             Optional[str] = Query(None),
    page:          int = Query(1, ge=1),
    limit:         int = Query(20, ge=1, le=100),
):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        stmt = select(SolicitudMantenimiento)

        if caps["can_manage"] and user.role in ("admin", "directivo"):
            pass
        elif caps["can_manage"]:
            pass
        elif user.role == "auxiliar_mantenimiento":
            stmt = stmt.where(SolicitudMantenimiento.asignado_id == user.id)
        else:
            stmt = stmt.where(
                (SolicitudMantenimiento.solicitante_id == user.id)
                | (SolicitudMantenimiento.asignado_id == user.id)
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


@router.get("/solicitudes/{solicitud_id}", response_model=SolicitudMantenimientoOut)
def portal_obtener_solicitud(portal_token: str, solicitud_id: int):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        _assert_access(user, sol, caps)

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


@router.patch("/solicitudes/{solicitud_id}/estado", response_model=SolicitudMantenimientoOut)
def portal_cambiar_estado(portal_token: str, solicitud_id: int, body: CambiarEstadoBody):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        _require_manage(caps)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

        transiciones_validas = _TRANSICIONES_MANT.get(sol.estado, set())
        if body.estado_nuevo not in transiciones_validas:
            raise HTTPException(status_code=400, detail=f"Transición inválida: {sol.estado} → {body.estado_nuevo}")

        if sol.estado == EstadoMantenimiento.solicitud and body.estado_nuevo == EstadoMantenimiento.programado:
            monto = float(getattr(sol, "monto_estimado", 0) or 0)
            if monto > 2_000_000:
                count = oc_db.exec(
                    select(func.count(MntAprobacion.id)).where(
                        MntAprobacion.solicitud_id == sol.id,
                        MntAprobacion.aprobado == True,
                    )
                ).one()
                if count < 3:
                    raise HTTPException(status_code=400, detail=f"Requiere 3 aprobaciones. Tiene {count}/3.")

        if sol.estado == EstadoMantenimiento.ejecucion and body.estado_nuevo == EstadoMantenimiento.completado:
            if not getattr(sol, "evidencia_url", None):
                raise HTTPException(status_code=400, detail="Se requiere evidencia fotográfica.")

        estado_anterior = sol.estado
        sol.estado = body.estado_nuevo
        sol.updated_at = datetime.now(timezone.utc)
        oc_db.add(sol)
        hist = HistorialMantenimiento(
            solicitud_id=sol.id,
            estado_anterior=estado_anterior,
            estado_nuevo=body.estado_nuevo,
            nota=body.nota,
            usuario_id=user.id,
            usuario_nombre=user.full_name or user.email,
        )
        oc_db.add(hist)
        oc_db.commit()
        oc_db.refresh(sol)
        return _enriquecer(sol, {user.id: user})


@router.patch("/solicitudes/{solicitud_id}/asignar", response_model=SolicitudMantenimientoOut)
def portal_asignar(portal_token: str, solicitud_id: int, body: AsignarBody):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        _require_manage(caps)
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


@router.patch("/solicitudes/{solicitud_id}/programar", response_model=SolicitudMantenimientoOut)
def portal_programar(portal_token: str, solicitud_id: int, body: ActualizarProgramadoBody):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        _require_manage(caps)
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


@router.post("/solicitudes/{solicitud_id}/evidencia", response_model=SolicitudMantenimientoOut)
def portal_evidencia(portal_token: str, solicitud_id: int, body: SubirEvidenciaBody):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        _assert_access(user, sol, caps)
        if not caps["can_operate"]:
            raise HTTPException(status_code=403, detail="Sin permiso.")

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
                nota=f"Evidencia: {body.nota}",
                usuario_id=user.id,
                usuario_nombre=user.full_name or user.email,
            )
            oc_db.add(hist)
        oc_db.commit()
        oc_db.refresh(sol)
        return _enriquecer(sol, {user.id: user})


@router.post("/solicitudes/{solicitud_id}/accion-campo")
def portal_accion_campo(portal_token: str, solicitud_id: int, body: AccionMobileBody):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        _assert_access(user, sol, caps)
        if not caps["can_operate"]:
            raise HTTPException(status_code=403, detail="Sin permiso.")
        return _ejecutar_accion(sol, body, oc_db)


@router.get("/solicitudes/{solicitud_id}/historial")
def portal_historial(portal_token: str, solicitud_id: int):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        _assert_access(user, sol, caps)
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


@router.get("/solicitudes/{solicitud_id}/ocs")
def portal_ocs(portal_token: str, solicitud_id: int):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        _assert_access(user, sol, caps)
        ocs = oc_db.exec(
            select(SolicitudOC)
            .where(SolicitudOC.mantenimiento_id == solicitud_id)
            .order_by(SolicitudOC.fecha_solicitud.asc())
        ).all()
        return [oc_vinculada_out(oc) for oc in ocs]


@router.post("/solicitudes/{solicitud_id}/oc-vinculada")
def portal_oc_vinculada(portal_token: str, solicitud_id: int, body: CrearOCVinculadaBody):
    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        _assert_access(user, sol, caps)
        if not caps["can_operate"]:
            raise HTTPException(status_code=403, detail="Sin permiso.")
        oc = crear_oc_vinculada_core(
            oc_db, sol, body,
            user.full_name or user.email,
            user.email,
        )
        hist = HistorialMantenimiento(
            solicitud_id=sol.id,
            estado_anterior=sol.estado,
            estado_nuevo=sol.estado,
            nota=f"[PORTAL] OC creada: {oc.consecutivo_os}",
            usuario_id=user.id,
            usuario_nombre=user.full_name or user.email,
        )
        oc_db.add(hist)
        oc_db.commit()
        return oc_vinculada_out(oc)


@router.get("/solicitudes/{solicitud_id}/aprobaciones")
def portal_aprobaciones(portal_token: str, solicitud_id: int):
    from app.routers.mantenimiento.aprobaciones import AprobacionOut

    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        if not caps["can_approve"]:
            raise HTTPException(status_code=403, detail="Sin permiso.")
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        items = oc_db.exec(
            select(MntAprobacion)
            .where(MntAprobacion.solicitud_id == solicitud_id)
            .order_by(MntAprobacion.fecha.asc())
        ).all()
        return [
            AprobacionOut(
                id=a.id,
                solicitud_id=a.solicitud_id,
                aprobador_nombre=a.aprobador_nombre,
                rol_aprobador=a.rol_aprobador,
                aprobado=a.aprobado,
                nota=a.nota,
                fecha=a.fecha.isoformat(),
            )
            for a in items
        ]


@router.post("/solicitudes/{solicitud_id}/aprobacion")
def portal_aprobar(portal_token: str, solicitud_id: int, body: dict):
    from app.routers.mantenimiento.aprobaciones import AprobacionBody, AprobacionOut, _ROLES_APROBACION

    with Session(get_oc_engine()) as oc_db, Session(get_engine()) as app_db:
        user, _ = resolve_portal_user(portal_token, oc_db, app_db)
        caps = _caps(user, app_db)
        if not caps["can_approve"]:
            raise HTTPException(status_code=403, detail="Sin permiso para aprobar.")
        parsed = AprobacionBody(**body)
        if parsed.rol_aprobador not in _ROLES_APROBACION:
            raise HTTPException(status_code=400, detail="rol_aprobador inválido.")
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        ya = oc_db.exec(
            select(MntAprobacion).where(
                MntAprobacion.solicitud_id == solicitud_id,
                MntAprobacion.rol_aprobador == parsed.rol_aprobador,
            )
        ).first()
        if ya:
            raise HTTPException(status_code=409, detail="Aprobación duplicada.")
        aprobacion = MntAprobacion(
            solicitud_id=solicitud_id,
            aprobador_id=user.id,
            aprobador_nombre=user.full_name or user.email,
            rol_aprobador=parsed.rol_aprobador,
            aprobado=True,
            nota=parsed.nota,
        )
        oc_db.add(aprobacion)
        oc_db.commit()
        oc_db.refresh(aprobacion)
        return AprobacionOut(
            id=aprobacion.id,
            solicitud_id=aprobacion.solicitud_id,
            aprobador_nombre=aprobacion.aprobador_nombre,
            rol_aprobador=aprobacion.rol_aprobador,
            aprobado=aprobacion.aprobado,
            nota=aprobacion.nota,
            fecha=aprobacion.fecha.isoformat(),
        )

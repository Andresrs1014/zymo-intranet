"""Par externo MNT ↔ OC — asignación acoplada por auxiliar de compras."""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models.mantenimiento import HistorialMantenimiento, SolicitudMantenimiento
from app.models.oc import EstadoOC, SolicitudOC
from app.models.user import User
from app.routers.mantenimiento.oc_vinculada import _generar_consecutivo_oc

log = logging.getLogger(__name__)


def oc_par_de_mnt(oc_db: Session, mnt: SolicitudMantenimiento) -> Optional[SolicitudOC]:
    if getattr(mnt, "oc_par_id", None):
        try:
            oc = oc_db.get(SolicitudOC, uuid.UUID(mnt.oc_par_id))
            if oc:
                return oc
        except (ValueError, TypeError):
            pass
    return oc_db.exec(
        select(SolicitudOC)
        .where(SolicitudOC.mantenimiento_id == mnt.id)
        .order_by(SolicitudOC.fecha_solicitud.asc())
    ).first()


def crear_oc_servicio_externo(
    oc_db: Session,
    mnt: SolicitudMantenimiento,
    solicitante_nombre: str,
    solicitante_email: str,
    observaciones: Optional[str] = None,
) -> SolicitudOC:
    """Crea OC de servicio vinculada a mantenimiento externo."""
    consecutivo = _generar_consecutivo_oc(oc_db)
    desc = f"[Servicio externo] {mnt.consecutivo} — {mnt.titulo}"
    oc = SolicitudOC(
        consecutivo_os=consecutivo,
        descripcion=desc,
        cantidad=1,
        nivel_prioridad=getattr(mnt, "prioridad", "media").capitalize()
        if getattr(mnt, "prioridad", None) in ("alta", "urgente")
        else "Media",
        solicitante_nombre=solicitante_nombre,
        solicitante_email=solicitante_email,
        observaciones_solicitante=observaciones or mnt.descripcion,
        estado=EstadoOC.nueva,
        mantenimiento_id=mnt.id,
        tipo_solicitud="servicio",
        modalidad_mantenimiento="externo",
        clasificacion_mantenimiento=mnt.clasificacion,
        tipo_mantenimiento=mnt.tipo_mantenimiento,
        fecha_solicitud=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    oc_db.add(oc)
    oc_db.commit()
    oc_db.refresh(oc)
    mnt.oc_par_id = str(oc.id)
    mnt.updated_at = datetime.now(timezone.utc)
    oc_db.add(mnt)
    oc_db.commit()
    log.info("OC servicio %s creada para MNT externo %s", consecutivo, mnt.consecutivo)
    return oc


def _historial_mnt(
    oc_db: Session,
    mnt: SolicitudMantenimiento,
    nota: str,
    user: User,
    estado_nuevo: Optional[str] = None,
):
    hist = HistorialMantenimiento(
        solicitud_id=mnt.id,
        estado_anterior=mnt.estado,
        estado_nuevo=estado_nuevo or mnt.estado,
        nota=nota,
        usuario_id=user.id,
        usuario_nombre=user.full_name or user.email,
    )
    oc_db.add(hist)


def asignar_par_externo(
    oc_db: Session,
    mnt: SolicitudMantenimiento,
    actor: User,
    coordinador_compras_id: int,
    asignado_mantenimiento_id: Optional[int] = None,
    tipo_asignacion: str = "compras_par",
) -> tuple[SolicitudMantenimiento, SolicitudOC]:
    if mnt.modalidad != "externo":
        raise HTTPException(status_code=400, detail="Solo aplica a solicitudes externas.")

    oc = oc_par_de_mnt(oc_db, mnt)
    if not oc:
        raise HTTPException(
            status_code=400,
            detail="No hay OC vinculada. Cree el par externo primero.",
        )

    mnt.coordinador_compras_id = coordinador_compras_id
    mnt.tipo_asignacion = tipo_asignacion
    oc.auxiliar_id = coordinador_compras_id

    if asignado_mantenimiento_id is not None:
        mnt.asignado_id = asignado_mantenimiento_id

    if oc.estado == EstadoOC.nueva:
        oc.estado = EstadoOC.en_cotizacion
        oc.fecha_asignacion = datetime.now(timezone.utc)

    mnt.updated_at = datetime.now(timezone.utc)
    oc.updated_at = datetime.now(timezone.utc)
    oc_db.add(mnt)
    oc_db.add(oc)

    nota = f"[PAR EXTERNO] Coordinador compras #{coordinador_compras_id}"
    if asignado_mantenimiento_id:
        nota += f", aux. mantenimiento #{asignado_mantenimiento_id}"
    _historial_mnt(oc_db, mnt, nota, actor)
    oc_db.commit()
    oc_db.refresh(mnt)
    oc_db.refresh(oc)
    return mnt, oc


def sincronizar_desde_oc_asignar(
    oc_db: Session,
    oc: SolicitudOC,
    auxiliar_compras_id: int,
    actor: User,
):
    """Al asignar auxiliar en OC vinculada a MNT externo, sincroniza el par."""
    if not oc.mantenimiento_id:
        return
    mnt = oc_db.get(SolicitudMantenimiento, oc.mantenimiento_id)
    if not mnt or mnt.modalidad != "externo":
        return
    mnt.coordinador_compras_id = auxiliar_compras_id
    mnt.tipo_asignacion = "compras_par"
    if not mnt.oc_par_id:
        mnt.oc_par_id = str(oc.id)
    mnt.updated_at = datetime.now(timezone.utc)
    oc_db.add(mnt)
    _historial_mnt(
        oc_db,
        mnt,
        f"[PAR EXTERNO] Sincronizado desde OC {oc.consecutivo_os}",
        actor,
    )


def sincronizar_desde_mnt_asignar(
    oc_db: Session,
    mnt: SolicitudMantenimiento,
    asignado_mnt_id: Optional[int],
    actor: User,
    coordinador_id: Optional[int] = None,
):
    """Al asignar auxiliar mantenimiento en MNT externo, sincroniza OC si hay coordinador."""
    if mnt.modalidad != "externo":
        return
    oc = oc_par_de_mnt(oc_db, mnt)
    if not oc:
        return
    coord = coordinador_id or mnt.coordinador_compras_id or actor.id
    mnt.coordinador_compras_id = coord
    oc.auxiliar_id = coord
    if asignado_mnt_id is not None:
        mnt.asignado_id = asignado_mnt_id
    if oc.estado == EstadoOC.nueva:
        oc.estado = EstadoOC.en_cotizacion
        oc.fecha_asignacion = datetime.now(timezone.utc)
    mnt.updated_at = datetime.now(timezone.utc)
    oc.updated_at = datetime.now(timezone.utc)
    oc_db.add(mnt)
    oc_db.add(oc)
    _historial_mnt(
        oc_db,
        mnt,
        f"[PAR EXTERNO] Asignación acoplada — OC {oc.consecutivo_os}",
        actor,
    )

"""Escalamiento interno → externo (camino A) — crea par OC servicio."""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session

from app.models.mantenimiento import HistorialMantenimiento, SolicitudMantenimiento
from app.models.user import User
from app.services.mnt_pares_externos import crear_oc_servicio_externo, oc_par_de_mnt

log = logging.getLogger(__name__)

_ESTADOS_ESCALABLES = {"solicitud", "programado", "ejecucion"}


def escalar_interno_a_externo(
    oc_db: Session,
    mnt: SolicitudMantenimiento,
    actor: User,
    motivo: str,
    evidencia_url: Optional[str] = None,
    evidencia_urls: Optional[list[str]] = None,
) -> tuple[SolicitudMantenimiento, Optional[object]]:
    if mnt.modalidad != "interno":
        raise HTTPException(status_code=400, detail="Solo se puede escalar desde modalidad interna.")
    if mnt.estado not in _ESTADOS_ESCALABLES:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede escalar desde estado '{mnt.estado}'.",
        )
    if not motivo.strip():
        raise HTTPException(status_code=400, detail="El motivo del escalamiento es obligatorio.")

    es_gestor = actor.role in ("admin", "directivo")
    if es_gestor:
        pass
    elif actor.role == "auxiliar_mantenimiento":
        if mnt.asignado_id != actor.id:
            raise HTTPException(
                status_code=403,
                detail="Debe estar asignado a esta solicitud para escalarla.",
            )
    else:
        raise HTTPException(status_code=403, detail="Sin permiso para escalar esta solicitud.")

    estado_anterior = mnt.estado
    mnt.modalidad = "externo"
    mnt.tipo_asignacion = mnt.tipo_asignacion or "escalado_campo"
    if evidencia_url:
        mnt.evidencia_antes_url = evidencia_url
        if not mnt.evidencia_url:
            mnt.evidencia_url = evidencia_url
    mnt.updated_at = datetime.now(timezone.utc)
    oc_db.add(mnt)

    extras = [u for u in (evidencia_urls or []) if u and u != evidencia_url]
    nota_fotos = ""
    if extras:
        nota_fotos = f" (+{len(extras)} foto(s) adicional(es) en escalamiento)"

    hist = HistorialMantenimiento(
        solicitud_id=mnt.id,
        estado_anterior=estado_anterior,
        estado_nuevo=mnt.estado,
        nota=f"[ESCALADO EXTERNO] {motivo.strip()}{nota_fotos}",
        usuario_id=actor.id,
        usuario_nombre=actor.full_name or actor.email,
    )
    oc_db.add(hist)
    oc_db.commit()
    oc_db.refresh(mnt)

    oc = oc_par_de_mnt(oc_db, mnt)
    if not oc:
        oc = crear_oc_servicio_externo(
            oc_db,
            mnt,
            actor.full_name or actor.email,
            actor.email,
            observaciones=f"Escalado desde interno — {motivo.strip()[:500]}",
        )
        hist2 = HistorialMantenimiento(
            solicitud_id=mnt.id,
            estado_anterior=mnt.estado,
            estado_nuevo=mnt.estado,
            nota=f"Par externo creado — OC servicio {oc.consecutivo_os}",
            usuario_id=actor.id,
            usuario_nombre=actor.full_name or actor.email,
        )
        oc_db.add(hist2)
        oc_db.commit()
        oc_db.refresh(mnt)

    log.info("MNT %s escalado a externo por %s", mnt.consecutivo, actor.email)
    return mnt, oc

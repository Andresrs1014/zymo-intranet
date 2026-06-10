import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, func, select
from typing import Optional

from app.core.deps import get_current_user, require_mantenimiento
from app.database import get_db
from app.models.mantenimiento import SolicitudMantenimiento
from app.models.oc import EstadoOC, SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_db

log = logging.getLogger(__name__)
router = APIRouter(tags=["Mantenimiento - OC Vinculada"])


class CrearOCVinculadaBody(BaseModel):
    descripcion:               str
    categoria:                 Optional[str] = None
    grupo_articulos:           Optional[str] = None
    nivel_prioridad:           str = "Media"
    sede:                      Optional[str] = None
    observaciones_solicitante: Optional[str] = None


class OCVinculadaOut(BaseModel):
    id:              str
    consecutivo_os:  str
    descripcion:     str
    estado:          str
    nivel_prioridad: str
    fecha_solicitud: str


def _generar_consecutivo_oc(db: Session) -> str:
    from datetime import date
    anio = date.today().year
    count = db.exec(
        select(func.count(SolicitudOC.id)).where(
            SolicitudOC.consecutivo_os.startswith(f"OS-{anio}-")
        )
    ).one()
    for intento in range(10):
        candidato = f"OS-{anio}-{count + intento + 1:04d}"
        existe = db.exec(
            select(SolicitudOC.id).where(SolicitudOC.consecutivo_os == candidato)
        ).first()
        if not existe:
            return candidato
    raise RuntimeError("No se pudo generar consecutivo OC único.")


@router.post(
    "/solicitudes/{solicitud_id}/oc-vinculada",
    status_code=status.HTTP_201_CREATED,
    response_model=OCVinculadaOut,
)
def crear_oc_vinculada(
    solicitud_id: int,
    body: CrearOCVinculadaBody,
    oc_db: Session = Depends(get_oc_db),
    _app_db: Session = Depends(get_db),
    current_user: User = Depends(require_mantenimiento),
):
    """Crea una SolicitudOC vinculada a esta solicitud de mantenimiento."""
    mnt = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not mnt:
        raise HTTPException(status_code=404, detail="Solicitud de mantenimiento no encontrada.")

    consecutivo = _generar_consecutivo_oc(oc_db)

    from datetime import datetime, timezone
    oc = SolicitudOC(
        consecutivo_os=consecutivo,
        descripcion=body.descripcion,
        categoria=body.categoria,
        grupo_articulos=body.grupo_articulos,
        cantidad=1,
        nivel_prioridad=body.nivel_prioridad,
        solicitante_nombre=current_user.full_name or current_user.email,
        solicitante_email=current_user.email,
        sede=body.sede,
        observaciones_solicitante=body.observaciones_solicitante,
        estado=EstadoOC.nueva,
        mantenimiento_id=solicitud_id,
        tipo_solicitud="compra",
        fecha_solicitud=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    oc_db.add(oc)
    oc_db.commit()
    oc_db.refresh(oc)

    log.info("OC %s creada desde mantenimiento %s por %s", consecutivo, mnt.consecutivo, current_user.email)

    return OCVinculadaOut(
        id=str(oc.id),
        consecutivo_os=oc.consecutivo_os,
        descripcion=oc.descripcion,
        estado=oc.estado,
        nivel_prioridad=oc.nivel_prioridad,
        fecha_solicitud=oc.fecha_solicitud.isoformat(),
    )


@router.get("/solicitudes/{solicitud_id}/ocs", response_model=list[OCVinculadaOut])
def listar_ocs_vinculadas(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    _: User = Depends(get_current_user),
):
    """Lista todas las OCs de compra vinculadas a esta solicitud de mantenimiento."""
    ocs = oc_db.exec(
        select(SolicitudOC)
        .where(SolicitudOC.mantenimiento_id == solicitud_id)
        .order_by(SolicitudOC.fecha_solicitud.asc())
    ).all()
    return [
        OCVinculadaOut(
            id=str(oc.id),
            consecutivo_os=oc.consecutivo_os,
            descripcion=oc.descripcion,
            estado=oc.estado,
            nivel_prioridad=oc.nivel_prioridad,
            fecha_solicitud=oc.fecha_solicitud.isoformat(),
        )
        for oc in ocs
    ]

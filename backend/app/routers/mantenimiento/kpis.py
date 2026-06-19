from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.models.mantenimiento import EstadoMantenimiento, SolicitudMantenimiento
from app.models.user import User
from app.oc_database import get_oc_db

router = APIRouter(tags=["Mantenimiento - KPIs"])

_ESTADOS_ACTIVOS  = {EstadoMantenimiento.solicitud, EstadoMantenimiento.evaluacion, EstadoMantenimiento.programado, EstadoMantenimiento.ejecucion}
_ESTADOS_CERRADOS = {EstadoMantenimiento.completado, EstadoMantenimiento.cerrado}


class KpisMes(BaseModel):
    total:            int
    cerradas:         int
    en_curso:         int
    canceladas:       int
    informales:       int
    gasto_total:      float
    gasto_preventivo: float
    gasto_correctivo: float
    gasto_interno:    float
    gasto_externo:    float


class KpisOut(BaseModel):
    mes_actual:            KpisMes
    por_origen:            dict
    pendientes_aprobacion: int


@router.get("/kpis", response_model=KpisOut)
def obtener_kpis(
    oc_db: Session = Depends(get_oc_db),
    _: User = Depends(get_current_user),
):
    ahora      = datetime.now(timezone.utc)
    inicio_mes = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    items_mes = oc_db.exec(
        select(SolicitudMantenimiento).where(SolicitudMantenimiento.created_at >= inicio_mes)
    ).all()

    todos = oc_db.exec(select(SolicitudMantenimiento)).all()

    gasto_total = sum(float(s.monto_real or 0) for s in items_mes)
    gasto_prev  = sum(float(s.monto_real or 0) for s in items_mes if s.clasificacion == "preventivo")
    gasto_corr  = sum(float(s.monto_real or 0) for s in items_mes if s.clasificacion == "correctivo")
    gasto_int   = sum(float(s.monto_real or 0) for s in items_mes if s.modalidad == "interno")
    gasto_ext   = sum(float(s.monto_real or 0) for s in items_mes if s.modalidad == "externo")

    por_origen: dict[str, int] = {}
    for s in todos:
        origen = getattr(s, "origen", "intranet") or "intranet"
        por_origen[origen] = por_origen.get(origen, 0) + 1

    pendientes = sum(
        1 for s in todos
        if s.estado == EstadoMantenimiento.evaluacion
        and float(getattr(s, "monto_estimado", 0) or 0) > 2_000_000
    )

    return KpisOut(
        mes_actual=KpisMes(
            total=len(items_mes),
            cerradas=sum(1 for s in items_mes if s.estado in _ESTADOS_CERRADOS),
            en_curso=sum(1 for s in items_mes if s.estado in _ESTADOS_ACTIVOS),
            canceladas=sum(1 for s in items_mes if s.estado == EstadoMantenimiento.cancelado),
            informales=sum(1 for s in items_mes if getattr(s, "origen", "") == "telefonico_retroactivo"),
            gasto_total=gasto_total,
            gasto_preventivo=gasto_prev,
            gasto_correctivo=gasto_corr,
            gasto_interno=gasto_int,
            gasto_externo=gasto_ext,
        ),
        por_origen=por_origen,
        pendientes_aprobacion=pendientes,
    )

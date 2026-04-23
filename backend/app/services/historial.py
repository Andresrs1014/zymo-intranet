import uuid
from typing import Optional

from sqlmodel import Session


def registrar_cambio_estado(
    db: Session,
    solicitud_id: uuid.UUID,
    estado_anterior: Optional[str],
    estado_nuevo: str,
    usuario_id: Optional[int] = None,
    usuario_nombre: Optional[str] = None,
    notas: Optional[str] = None,
    es_reproceso: bool = False,
    tipo_accion: Optional[str] = None,
) -> None:
    """Registra un cambio de estado en el historial. No hace commit — el caller debe hacerlo."""
    from app.models.oc import HistorialEstado

    entrada = HistorialEstado(
        solicitud_id=solicitud_id,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        usuario_id=usuario_id,
        usuario_nombre=usuario_nombre,
        notas=notas,
        es_reproceso=es_reproceso,
        tipo_accion=tipo_accion,
    )
    db.add(entrada)

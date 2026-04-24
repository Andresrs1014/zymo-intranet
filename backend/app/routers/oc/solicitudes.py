import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.oc_database import get_oc_db
from app.models.oc import CotizacionProveedor, EstadoOC, SolicitudOC
from app.models.user import User
from app.services.historial import registrar_cambio_estado
from app.services.email_service import (
    send_aprobacion_directora,
    send_cotizacion_lista,
    send_en_gestion,
    send_nueva_solicitud_interna,
    send_oc_enviada,
    send_solicitud_rechazada,
)

router = APIRouter(prefix="/solicitudes", tags=["OC - Solicitudes"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SolicitudRead(BaseModel):
    id: uuid.UUID
    consecutivo_os: str
    descripcion: str
    categoria: Optional[str]
    grupo_articulos: Optional[str]
    cantidad: int
    nivel_prioridad: str
    solicitante_nombre: str
    solicitante_email: Optional[str]
    area_solicitante: Optional[str]
    sede: Optional[str]
    cliente: Optional[str]
    condicion: Optional[str]
    observaciones_solicitante: Optional[str]
    placa_ficha: Optional[str]
    fecha_proximo_mantenimiento: Optional[date]
    estado: str
    auxiliar_id: Optional[int]
    evidencia_url: Optional[str] = None
    plataforma: Optional[str] = None
    numero_remision: Optional[str] = None
    observaciones_compras: Optional[str] = None
    fecha_estimada_entrega: Optional[date] = None
    fecha_confirmada_entrega: Optional[date] = None
    numero_factura: Optional[str] = None
    aval_compra: Optional[str] = None
    observacion_contabilidad: Optional[str] = None
    fecha_recibida_factura: Optional[date] = None
    fotos_producto: Optional[list] = None
    fecha_solicitud: datetime
    fecha_asignacion: Optional[datetime]
    fecha_cotizacion: Optional[datetime]
    fecha_aprobacion: Optional[datetime]
    fecha_envio_oc: Optional[datetime]
    fecha_en_plataforma: Optional[datetime] = None
    fecha_recibido: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AsignarPayload(BaseModel):
    auxiliar_id: int


class EstadoPayload(BaseModel):
    estado: EstadoOC


class RechazoPayload(BaseModel):
    motivo_rechazo: str


class CancelacionPayload(BaseModel):
    justificacion: str


class CorreccionSolicitudPayload(BaseModel):
    que_corregir: str


class EditarCorreccionPayload(BaseModel):
    descripcion: Optional[str] = None
    cantidad: Optional[int] = None
    observaciones_solicitante: Optional[str] = None


class PrioridadPayload(BaseModel):
    nivel_prioridad: str


class GestionPayload(BaseModel):
    plataforma: Optional[str] = None
    numero_remision: Optional[str] = None
    observaciones_compras: Optional[str] = None
    fecha_estimada_entrega: Optional[date] = None
    fecha_confirmada_entrega: Optional[date] = None
    numero_factura: Optional[str] = None
    aval_compra: Optional[str] = None
    observacion_contabilidad: Optional[str] = None
    fecha_recibida_factura: Optional[date] = None


class SolicitudInternaCreate(BaseModel):
    nivel_prioridad: Literal["Alta", "Media", "Baja"]
    categoria: str
    grupo_articulos: str
    descripcion: str
    cantidad: int
    cliente: Optional[str] = None
    condicion: Optional[str] = None
    plataforma: str
    placa_ficha: Optional[str] = None
    observaciones_solicitante: Optional[str] = None


class HistorialEstadoRead(BaseModel):
    id: uuid.UUID
    estado_anterior: Optional[str]
    estado_nuevo: str
    usuario_nombre: Optional[str]
    notas: Optional[str]
    fecha: datetime

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[SolicitudRead])
def list_solicitudes(
    estado: Optional[str] = Query(default=None),
    plataforma: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    query = select(SolicitudOC)
    if estado:
        query = query.where(SolicitudOC.estado == estado)
    if plataforma:
        query = query.where(SolicitudOC.plataforma == plataforma)
    query = query.order_by(SolicitudOC.fecha_solicitud.desc()).offset(skip).limit(limit)
    return oc_db.exec(query).all()


@router.post("/crear-interna", response_model=SolicitudRead, status_code=status.HTTP_201_CREATED)
async def crear_solicitud_interna(
    payload: SolicitudInternaCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
) -> SolicitudRead:
    """Crea una solicitud de compra desde el formulario interno de la intranet.
    El nombre, email y área del solicitante se toman del usuario autenticado.
    No requiere rol especial — cualquier empleado autenticado puede crear solicitudes."""
    now = datetime.now(timezone.utc)
    anio = now.year
    prefijo = f"OS-{anio}-"

    # Generar consecutivo OS-YYYY-XXXX con reintentos para evitar colisión concurrente
    solicitud: SolicitudOC | None = None
    for intento in range(5):
        count = oc_db.exec(
            select(func.count(SolicitudOC.id)).where(
                SolicitudOC.consecutivo_os.startswith(prefijo)
            )
        ).one()
        consecutivo_os = f"{prefijo}{(count + intento + 1):04d}"

        candidato = SolicitudOC(
            consecutivo_os=consecutivo_os,
            estado=EstadoOC.nueva,
            nivel_prioridad=payload.nivel_prioridad,
            categoria=payload.categoria,
            grupo_articulos=payload.grupo_articulos,
            descripcion=payload.descripcion,
            cantidad=payload.cantidad,
            cliente=payload.cliente,
            condicion=payload.condicion,
            plataforma=payload.plataforma,
            placa_ficha=payload.placa_ficha,
            observaciones_solicitante=payload.observaciones_solicitante,
            solicitante_nombre=current_user.full_name,
            solicitante_email=current_user.email,
            area_solicitante=current_user.area,
            sede=current_user.sede,
            fecha_solicitud=now,
            created_at=now,
            updated_at=now,
        )
        oc_db.add(candidato)
        try:
            oc_db.commit()
            oc_db.refresh(candidato)
            solicitud = candidato
            break
        except IntegrityError:
            oc_db.rollback()

    if solicitud is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo generar un consecutivo único. Intenta de nuevo.",
        )

    background_tasks.add_task(send_nueva_solicitud_interna, solicitud)

    return solicitud


@router.get("/mis-solicitudes", response_model=list[SolicitudRead])
def mis_solicitudes(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    estado: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Solicitudes donde el solicitante_email coincide con el usuario logueado."""
    if not current_user.email:
        return []
    query = select(SolicitudOC).where(SolicitudOC.solicitante_email == current_user.email)
    if estado:
        query = query.where(SolicitudOC.estado == estado)
    query = query.order_by(SolicitudOC.fecha_solicitud.desc()).offset(skip).limit(limit)
    return oc_db.exec(query).all()


@router.get("/{solicitud_id}", response_model=SolicitudRead)
def get_solicitud(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    _OC_ROLES = {"admin", "administrativo", "directivo", "compras"}
    is_compras = current_user.role in _OC_ROLES or current_user.area == "Compras"
    is_solicitante = current_user.email == solicitud.solicitante_email
    if not is_compras and not is_solicitante:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a esta solicitud.")
    return solicitud


@router.patch("/{solicitud_id}/asignar", response_model=SolicitudRead)
def asignar_auxiliar(
    solicitud_id: uuid.UUID,
    payload: AsignarPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_compras),
    db: Session = Depends(get_db),       # intranet.db — para validar que el user existe
    oc_db: Session = Depends(get_oc_db), # oc.db — para actualizar la solicitud
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    auxiliar = db.get(User, payload.auxiliar_id)
    if not auxiliar or not auxiliar.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado o inactivo.")

    estado_anterior = solicitud.estado
    solicitud.auxiliar_id = payload.auxiliar_id
    if solicitud.estado == EstadoOC.nueva:
        solicitud.estado = EstadoOC.en_cotizacion
    solicitud.fecha_asignacion = datetime.now(timezone.utc)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    if solicitud.estado != estado_anterior:
        registrar_cambio_estado(
            oc_db,
            solicitud.id,
            estado_anterior,
            solicitud.estado,
            usuario_id=current_user.id,
            usuario_nombre=current_user.full_name,
        )

    oc_db.commit()
    oc_db.refresh(solicitud)

    background_tasks.add_task(send_en_gestion, solicitud)  # Flujo 1
    return solicitud


_TRANSICIONES: dict[EstadoOC, set[EstadoOC]] = {
    EstadoOC.nueva:                {EstadoOC.en_cotizacion, EstadoOC.rechazada, EstadoOC.cancelada},
    EstadoOC.en_cotizacion:        {EstadoOC.pendiente_aprobacion, EstadoOC.rechazada, EstadoOC.cancelada, EstadoOC.en_correccion},
    EstadoOC.pendiente_aprobacion: {EstadoOC.aprobada, EstadoOC.rechazada, EstadoOC.en_cotizacion, EstadoOC.cancelada, EstadoOC.en_correccion},
    EstadoOC.aprobada:             {EstadoOC.oc_enviada, EstadoOC.rechazada, EstadoOC.cancelada},
    EstadoOC.rechazada:            {EstadoOC.en_cotizacion},
    EstadoOC.cancelada:            set(),
    EstadoOC.en_correccion:        {EstadoOC.en_cotizacion},
    EstadoOC.oc_enviada:           {EstadoOC.oc_en_plataforma},
    EstadoOC.oc_en_plataforma:     {EstadoOC.entregada},
    EstadoOC.entregada:            {EstadoOC.cerrada},
    EstadoOC.cerrada:              set(),
}


@router.patch("/{solicitud_id}/estado", response_model=SolicitudRead)
def cambiar_estado(
    solicitud_id: uuid.UUID,
    payload: EstadoPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    estado_anterior = solicitud.estado
    nuevo_estado = payload.estado

    if nuevo_estado not in _TRANSICIONES.get(estado_anterior, set()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Transición inválida: {estado_anterior} → {nuevo_estado}",
        )

    solicitud.estado = nuevo_estado
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        estado_anterior,
        nuevo_estado,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
    )

    oc_db.commit()
    oc_db.refresh(solicitud)

    if nuevo_estado == EstadoOC.pendiente_aprobacion:
        cotizacion = oc_db.exec(
            select(CotizacionProveedor)
            .where(CotizacionProveedor.solicitud_id == solicitud_id)
            .order_by(CotizacionProveedor.created_at.desc())
        ).first()
        background_tasks.add_task(send_cotizacion_lista, solicitud)             # Flujo 2
        background_tasks.add_task(send_aprobacion_directora, solicitud, cotizacion)  # Flujo 3
    elif nuevo_estado == EstadoOC.oc_enviada:
        background_tasks.add_task(send_oc_enviada, solicitud)                  # Flujo 4

    return solicitud


@router.patch("/{solicitud_id}/rechazar", response_model=SolicitudRead)
def rechazar_solicitud(
    solicitud_id: uuid.UUID,
    payload: RechazoPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    """Rechaza una solicitud directamente (ej. por parte del auxiliar)."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    estado_anterior = solicitud.estado
    if estado_anterior not in (EstadoOC.nueva, EstadoOC.en_cotizacion, EstadoOC.pendiente_aprobacion):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Solo se pueden rechazar solicitudes en etapas iniciales.",
        )

    solicitud.estado = EstadoOC.rechazada
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        estado_anterior,
        EstadoOC.rechazada,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
        notas=payload.motivo_rechazo,
    )

    oc_db.commit()
    oc_db.refresh(solicitud)

    background_tasks.add_task(send_solicitud_rechazada, solicitud, payload.motivo_rechazo, current_user.full_name)
    return solicitud


@router.patch("/{solicitud_id}/prioridad", response_model=SolicitudRead)
def cambiar_prioridad(
    solicitud_id: uuid.UUID,
    payload: PrioridadPayload,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Solo admin y administrativo pueden cambiar la prioridad de una solicitud."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden cambiar la prioridad.",
        )
    _PRIORIDADES = {"Alta", "Media", "Baja"}
    if payload.nivel_prioridad not in _PRIORIDADES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Prioridad inválida. Valores permitidos: {', '.join(_PRIORIDADES)}",
        )
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    solicitud.nivel_prioridad = payload.nivel_prioridad
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)
    oc_db.commit()
    oc_db.refresh(solicitud)
    return solicitud


@router.patch("/{solicitud_id}/gestionar", response_model=SolicitudRead)
def gestionar_solicitud(
    solicitud_id: uuid.UUID,
    payload: GestionPayload,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    """Actualiza los campos de gestión de compras (remisión, factura, aval, etc.)."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(solicitud, field, value)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)
    oc_db.commit()
    oc_db.refresh(solicitud)
    return solicitud


@router.patch("/{solicitud_id}/cancelar", response_model=SolicitudRead)
def cancelar_solicitud(
    solicitud_id: uuid.UUID,
    payload: CancelacionPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    """Cancela definitivamente una solicitud (auxiliar o directivo). KPI: rechazos_solicitud."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    estados_validos = {EstadoOC.nueva, EstadoOC.en_cotizacion, EstadoOC.pendiente_aprobacion, EstadoOC.en_correccion}
    if solicitud.estado not in estados_validos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No se puede cancelar una solicitud en estado '{solicitud.estado}'.",
        )

    estado_anterior = solicitud.estado
    solicitud.estado = EstadoOC.cancelada
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        estado_anterior,
        EstadoOC.cancelada,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
        notas=payload.justificacion,
        tipo_accion="cancelacion_solicitud",
    )

    oc_db.commit()
    oc_db.refresh(solicitud)

    background_tasks.add_task(send_solicitud_rechazada, solicitud, payload.justificacion, current_user.full_name)
    return solicitud


@router.patch("/{solicitud_id}/correccion", response_model=SolicitudRead)
def mandar_a_correccion(
    solicitud_id: uuid.UUID,
    payload: CorreccionSolicitudPayload,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    """Devuelve la solicitud al solicitante para que la corrija. KPI: reprocesos."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    estados_validos = {EstadoOC.nueva, EstadoOC.en_cotizacion, EstadoOC.pendiente_aprobacion}
    if solicitud.estado not in estados_validos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No se puede mandar a corrección una solicitud en estado '{solicitud.estado}'.",
        )

    estado_anterior = solicitud.estado
    solicitud.estado = EstadoOC.en_correccion
    solicitud.observaciones_compras = payload.que_corregir  # visible en la tarjeta del solicitante
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        estado_anterior,
        EstadoOC.en_correccion,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
        notas=payload.que_corregir,
        es_reproceso=True,
        tipo_accion="correccion_solicitud",
    )

    oc_db.commit()
    oc_db.refresh(solicitud)
    return solicitud


@router.patch("/{solicitud_id}/editar-correccion", response_model=SolicitudRead)
def editar_correccion(
    solicitud_id: uuid.UUID,
    payload: EditarCorreccionPayload,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """El solicitante corrige su solicitud y la reenvía a cotización."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    if solicitud.estado != EstadoOC.en_correccion:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Solo se pueden editar solicitudes en estado 'en_correccion'.",
        )

    # Verificar que el solicitante sea el dueño de la solicitud
    if solicitud.solicitante_email and current_user.email != solicitud.solicitante_email:
        if current_user.role not in ("admin", "administrativo", "directivo", "compras"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el solicitante puede editar su propia solicitud.",
            )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(solicitud, field, value)

    solicitud.estado = EstadoOC.en_cotizacion
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        EstadoOC.en_correccion,
        EstadoOC.en_cotizacion,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
        notas="Solicitud corregida por el solicitante",
    )

    oc_db.commit()
    oc_db.refresh(solicitud)
    return solicitud


@router.get("/{solicitud_id}/tiempos")
def get_tiempos_solicitud(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """
    Timeline completo de tiempos por etapa de una solicitud.
    Muestra cuánto tardó cada transición de estado.
    """
    from app.agents.tools.oc_tools import ver_timeline_solicitud
    return ver_timeline_solicitud(str(solicitud_id))


@router.get("/{solicitud_id}/historial", response_model=list[HistorialEstadoRead])
def get_historial_estados(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Retorna el historial de cambios de estado de una solicitud, ordenado cronológicamente."""
    from app.models.oc import HistorialEstado

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    entradas = oc_db.exec(
        select(HistorialEstado)
        .where(HistorialEstado.solicitud_id == solicitud_id)
        .order_by(HistorialEstado.fecha.asc())
    ).all()
    return entradas


# ── Fotos / archivos del producto ─────────────────────────────────────────────

_SOLICITUDES_DIR = Path("/app/data/solicitudes")
_FORMATOS_FOTO = frozenset({"jpg", "jpeg", "png", "gif", "webp", "pdf", "xlsx", "docx"})
_MIME_FOTO = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.post("/{solicitud_id}/fotos", status_code=status.HTTP_201_CREATED)
async def subir_foto_solicitud(
    solicitud_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Sube una foto o archivo de referencia del producto a la solicitud."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    nombre = file.filename or "archivo"
    ext = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else ""
    if ext not in _FORMATOS_FOTO:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Formato no soportado. Use: {', '.join(sorted(_FORMATOS_FOTO))}",
        )

    contenido = await file.read()
    folder = _SOLICITUDES_DIR / str(solicitud_id)
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.{ext}"
    (folder / filename).write_bytes(contenido)

    current_fotos: list = list(solicitud.fotos_producto or [])
    solicitud.fotos_producto = current_fotos + [filename]
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)
    oc_db.commit()
    oc_db.refresh(solicitud)

    return {"filename": filename, "fotos_producto": solicitud.fotos_producto}


@router.get("/{solicitud_id}/fotos/{filename}")
def descargar_foto_solicitud(
    solicitud_id: uuid.UUID,
    filename: str,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Sirve un archivo de referencia del producto."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if filename not in (solicitud.fotos_producto or []):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.")
    path = _SOLICITUDES_DIR / str(solicitud_id) / filename
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado en disco.")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    media_type = _MIME_FOTO.get(ext, "application/octet-stream")
    return FileResponse(str(path), media_type=media_type, filename=filename)


@router.delete("/{solicitud_id}/fotos/{filename}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_foto_solicitud(
    solicitud_id: uuid.UUID,
    filename: str,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Elimina un archivo de referencia del producto."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    _OC_ROLES = {"admin", "administrativo", "directivo", "compras"}
    is_compras = current_user.role in _OC_ROLES or current_user.area == "Compras"
    is_solicitante = current_user.email == solicitud.solicitante_email
    if not is_compras and not is_solicitante:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin permiso para eliminar este archivo.")

    if filename not in (solicitud.fotos_producto or []):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.")
    path = _SOLICITUDES_DIR / str(solicitud_id) / filename
    if path.exists():
        path.unlink()
    solicitud.fotos_producto = [f for f in (solicitud.fotos_producto or []) if f != filename]
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)
    oc_db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

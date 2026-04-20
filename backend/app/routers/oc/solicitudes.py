import uuid
from datetime import date, datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, or_, select

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.oc_database import get_oc_db
from app.models.oc import EstadoOC, SolicitudOC
from app.models.user import User
from app.services.historial import registrar_cambio_estado
from app.services.email_service import (
    send_aprobacion_directora,
    send_cotizacion_lista,
    send_en_gestion,
    send_nueva_solicitud_interna,
    send_oc_enviada,
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


class UsuarioBasico(BaseModel):
    id: int
    full_name: str
    email: str
    area: Optional[str]
    role: str

    class Config:
        from_attributes = True


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
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Solicitudes donde el solicitante_email coincide con el usuario logueado.
    Accesible para cualquier usuario autenticado (coordinadores, líderes, etc.)."""
    if not current_user.email:
        return []
    query = (
        select(SolicitudOC)
        .where(SolicitudOC.solicitante_email == current_user.email)
        .order_by(SolicitudOC.fecha_solicitud.desc())
    )
    return oc_db.exec(query).all()


_ROLES_COMPRAS = ["admin", "compras", "administrativo", "directivo"]


@router.get("/usuarios-compras", response_model=list[UsuarioBasico])
def list_usuarios_compras(
    current_user: User = Depends(require_compras),
    db: Session = Depends(get_db),
):
    """Lista usuarios activos del equipo de compras (por rol o por área)."""
    usuarios = db.exec(
        select(User)
        .where(
            User.is_active == True,  # noqa: E712
            or_(
                User.role.in_(_ROLES_COMPRAS),
                User.area == "Compras",
            ),
        )
        .order_by(User.full_name)
    ).all()
    return usuarios


@router.get("/{solicitud_id}", response_model=SolicitudRead)
def get_solicitud(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
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

    # Emails automáticos según el nuevo estado
    if nuevo_estado == EstadoOC.pendiente_aprobacion:
        background_tasks.add_task(send_cotizacion_lista, solicitud)      # Flujo 2
        background_tasks.add_task(send_aprobacion_directora, solicitud)  # Flujo 3
    elif nuevo_estado == EstadoOC.oc_enviada:
        background_tasks.add_task(send_oc_enviada, solicitud)            # Flujo 4

    return solicitud


@router.patch("/{solicitud_id}/prioridad", response_model=SolicitudRead)
def cambiar_prioridad(
    solicitud_id: uuid.UUID,
    payload: PrioridadPayload,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    """Auxiliar de compras o directivo pueden ajustar la prioridad en cualquier momento."""
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

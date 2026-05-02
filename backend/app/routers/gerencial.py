"""
Router Módulo Gerencial — tareas dev, órdenes directas, KPIs gerenciales.

Prefijo: /api/gerencial
Acceso: gerente, admin (require_gerencial)
Dev (Andrés) puede registrar tareas con cualquier rol autenticado.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, desc, select

from app.agent_database import get_agents_db
from app.gerencial_database import GerencialOrden, GerencialTarea, get_gerencial_db
from app.agents.tools import oc_tools
from app.config import settings
from app.core.deps import get_current_user, require_gerencial
from app.core.permissions import user_has_any_permission
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gerencial", tags=["Gerencial"])


# ── Schemas ───────────────────────────────────────────────────────────────────

_ETIQUETAS_VALIDAS = {
    "desarrollos", "actualizaciones", "auditorias",
    "implementacion_okr", "tareas_diarias",
}
_PLATAFORMAS_VALIDAS = {
    "logimat1", "logimat2", "imccargo", "imcdeposito", "transversal",
}
_ESTADOS_TAREA = {"completada", "en_progreso", "bloqueada"}


class TareaCreate(BaseModel):
    titulo: str
    descripcion_tecnica: str
    etiqueta: str = "tareas_diarias"
    plataforma: str = "transversal"
    hora_inicio: Optional[datetime] = None
    hora_cierre: Optional[datetime] = None
    estado: str = "en_progreso"
    fecha: Optional[str] = None  # ISO date string, default hoy


class TareaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion_tecnica: Optional[str] = None
    etiqueta: Optional[str] = None
    plataforma: Optional[str] = None
    hora_inicio: Optional[datetime] = None
    hora_cierre: Optional[datetime] = None
    estado: Optional[str] = None
    fecha: Optional[str] = None


class TareaRead(BaseModel):
    id: str
    subido_por_id: int
    subido_por_nombre: str
    fecha: str
    hora_inicio: Optional[str]
    hora_cierre: Optional[str]
    tiempo_total_minutos: Optional[int]
    etiqueta: str
    plataforma: str
    titulo: str
    descripcion_tecnica: str
    descripcion_gerencial: Optional[str]
    impacto: Optional[str]
    estado: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class OrdenCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    destinatario_id: int


class OrdenRead(BaseModel):
    id: str
    creada_por_id: int
    creada_por_nombre: str
    destinatario_id: int
    destinatario_nombre: str
    destinatario_area: str
    titulo: str
    descripcion: Optional[str]
    estado: str
    notificacion_enviada: bool
    created_at: str

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calcular_minutos(hora_inicio: Optional[datetime], hora_cierre: Optional[datetime]) -> Optional[int]:
    if hora_inicio and hora_cierre and hora_cierre > hora_inicio:
        delta = hora_cierre - hora_inicio
        return int(delta.total_seconds() / 60)
    return None


def _tarea_to_read(t: GerencialTarea) -> TareaRead:
    return TareaRead(
        id=t.id,
        subido_por_id=t.subido_por_id,
        subido_por_nombre=t.subido_por_nombre,
        fecha=t.fecha.isoformat(),
        hora_inicio=t.hora_inicio.isoformat() if t.hora_inicio else None,
        hora_cierre=t.hora_cierre.isoformat() if t.hora_cierre else None,
        tiempo_total_minutos=t.tiempo_total_minutos,
        etiqueta=t.etiqueta,
        plataforma=t.plataforma,
        titulo=t.titulo,
        descripcion_tecnica=t.descripcion_tecnica,
        descripcion_gerencial=t.descripcion_gerencial,
        impacto=t.impacto,
        estado=t.estado,
        created_at=t.created_at.isoformat(),
        updated_at=t.updated_at.isoformat(),
    )


async def _generar_descripcion_zymo(tarea_id: str, titulo: str, descripcion_tecnica: str) -> None:
    """Background task: ZYMO genera descripcion_gerencial e impacto."""
    api_key = settings.gemini_api_key
    if not api_key:
        return
    try:
        from app.agents.zymo_core import ZymoCore
        from app.gerencial_database import GerencialTarea, get_gerencial_engine
        from sqlmodel import Session

        zymo = ZymoCore(api_key=api_key)
        prompt = (
            f"Tarea técnica registrada por el desarrollador:\n"
            f"Título: {titulo}\n"
            f"Descripción técnica: {descripcion_tecnica}\n\n"
            f"1. Reescribe esto en máximo 3 líneas en lenguaje de negocio para el gerente "
            f"(sin tecnicismos, enfocado en qué problema resuelve para la empresa).\n"
            f"2. En una línea separada, calcula el impacto estimado en horas ahorradas por semana "
            f"o beneficio concreto para la operación.\n\n"
            f"Formato de respuesta (exactamente así):\n"
            f"GERENCIAL: [descripción en lenguaje de negocio]\n"
            f"IMPACTO: [impacto estimado]"
        )
        respuesta = await zymo.chat(prompt)

        gerencial = ""
        impacto = ""
        for line in respuesta.split("\n"):
            if line.startswith("GERENCIAL:"):
                gerencial = line.replace("GERENCIAL:", "").strip()
            elif line.startswith("IMPACTO:"):
                impacto = line.replace("IMPACTO:", "").strip()

        with Session(get_gerencial_engine()) as db:
            tarea = db.get(GerencialTarea, tarea_id)
            if tarea:
                tarea.descripcion_gerencial = gerencial or respuesta[:300]
                tarea.impacto = impacto or None
                tarea.updated_at = datetime.utcnow()
                db.add(tarea)
                db.commit()
    except Exception as e:
        logger.error("Error generando descripción ZYMO para tarea %s: %s", tarea_id, e)


# ── Tareas Dev ─────────────────────────────────────────────────────────────────

@router.post("/tareas-dev", response_model=TareaRead, status_code=status.HTTP_201_CREATED)
async def crear_tarea(
    payload: TareaCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_gerencial_db),
):
    """
    Andrés (o cualquier dev/admin) registra una tarea completada o en progreso.
    ZYMO genera automáticamente la descripción gerencial y el impacto en background.
    """
    if payload.etiqueta not in _ETIQUETAS_VALIDAS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"etiqueta inválida. Valores: {', '.join(sorted(_ETIQUETAS_VALIDAS))}",
        )
    if payload.plataforma not in _PLATAFORMAS_VALIDAS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"plataforma inválida. Valores: {', '.join(sorted(_PLATAFORMAS_VALIDAS))}",
        )
    if payload.estado not in _ESTADOS_TAREA:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"estado inválido. Valores: {', '.join(_ESTADOS_TAREA)}",
        )

    from datetime import date as date_type
    fecha = date_type.fromisoformat(payload.fecha) if payload.fecha else date_type.today()
    tiempo = _calcular_minutos(payload.hora_inicio, payload.hora_cierre)

    tarea = GerencialTarea(
        subido_por_id=current_user.id,
        subido_por_nombre=current_user.full_name or current_user.email,
        fecha=fecha,
        hora_inicio=payload.hora_inicio,
        hora_cierre=payload.hora_cierre,
        tiempo_total_minutos=tiempo,
        etiqueta=payload.etiqueta,
        plataforma=payload.plataforma,
        titulo=payload.titulo,
        descripcion_tecnica=payload.descripcion_tecnica,
        estado=payload.estado,
    )
    db.add(tarea)
    db.commit()
    db.refresh(tarea)

    # ZYMO genera descripción gerencial en segundo plano
    background_tasks.add_task(
        _generar_descripcion_zymo,
        tarea.id,
        tarea.titulo,
        tarea.descripcion_tecnica,
    )

    return _tarea_to_read(tarea)


@router.get("/tareas-dev", response_model=list[TareaRead])
def listar_tareas(
    estado: Optional[str] = Query(default=None),
    etiqueta: Optional[str] = Query(default=None),
    plataforma: Optional[str] = Query(default=None),
    subido_por_id: Optional[int] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    intranet_db: Session = Depends(get_db),
    db: Session = Depends(get_gerencial_db),
):
    """Lista tareas con filtros. Vista amplia si tiene mod_gerencial o mod_oc_aprobar (p. ej. directivo)."""
    if not user_has_any_permission(
        intranet_db, current_user, ["mod_gerencial", "mod_oc_aprobar"]
    ):
        # Sin permiso de vista amplia: solo sus propias tareas
        subido_por_id = current_user.id

    query = select(GerencialTarea)
    if estado:
        query = query.where(GerencialTarea.estado == estado)
    if etiqueta:
        query = query.where(GerencialTarea.etiqueta == etiqueta)
    if plataforma:
        query = query.where(GerencialTarea.plataforma == plataforma)
    if subido_por_id:
        query = query.where(GerencialTarea.subido_por_id == subido_por_id)
    query = query.order_by(desc(GerencialTarea.created_at)).offset(skip).limit(limit)
    return [_tarea_to_read(t) for t in db.exec(query).all()]


@router.get("/tareas-dev/{tarea_id}", response_model=TareaRead)
def get_tarea(
    tarea_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_gerencial_db),
):
    tarea = db.get(GerencialTarea, tarea_id)
    if not tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    return _tarea_to_read(tarea)


@router.patch("/tareas-dev/{tarea_id}", response_model=TareaRead)
def actualizar_tarea(
    tarea_id: str,
    payload: TareaUpdate,
    current_user: User = Depends(get_current_user),
    intranet_db: Session = Depends(get_db),
    db: Session = Depends(get_gerencial_db),
):
    """Actualiza una tarea. Solo el dueño o permisos gerenciales / aprobación OC pueden modificarla."""
    tarea = db.get(GerencialTarea, tarea_id)
    if not tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")

    puede_admin = user_has_any_permission(
        intranet_db, current_user, ["mod_gerencial", "mod_oc_aprobar"]
    )
    if tarea.subido_por_id != current_user.id and not puede_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para modificar esta tarea.")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "fecha" and value:
            from datetime import date as date_type
            setattr(tarea, "fecha", date_type.fromisoformat(value))
        else:
            setattr(tarea, field, value)

    # Recalcular tiempo si cambiaron horas
    if "hora_inicio" in data or "hora_cierre" in data:
        tarea.tiempo_total_minutos = _calcular_minutos(tarea.hora_inicio, tarea.hora_cierre)

    tarea.updated_at = datetime.utcnow()
    db.add(tarea)
    db.commit()
    db.refresh(tarea)
    return _tarea_to_read(tarea)


# ── KPIs Gerenciales ───────────────────────────────────────────────────────────

@router.get("/kpis")
def kpis_gerenciales(
    current_user: User = Depends(require_gerencial),
    db: Session = Depends(get_gerencial_db),
):
    """
    KPIs globales de toda la plataforma para el dashboard del gerente.
    Combina datos de OC, tareas dev y actividad general.
    """
    try:
        oc_kpis = oc_tools.ver_kpis_oc()
    except Exception:
        oc_kpis = {}

    # Métricas de tareas dev
    total_tareas = db.exec(select(GerencialTarea)).all()
    completadas = [t for t in total_tareas if t.estado == "completada"]
    en_progreso = [t for t in total_tareas if t.estado == "en_progreso"]
    bloqueadas = [t for t in total_tareas if t.estado == "bloqueada"]

    # ROI acumulado (suma de impactos con horas)
    tiempo_total_dev = sum(
        (t.tiempo_total_minutos or 0) for t in total_tareas if t.tiempo_total_minutos
    )

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "oc": {
            "total_activas": oc_kpis.get("total_activas", 0),
            "por_estado": oc_kpis.get("solicitudes_por_estado", {}),
            "alertas": oc_kpis.get("alertas", []),
        },
        "desarrollo": {
            "tareas_completadas": len(completadas),
            "tareas_en_progreso": len(en_progreso),
            "tareas_bloqueadas": len(bloqueadas),
            "tiempo_total_invertido_horas": round(tiempo_total_dev / 60, 1),
        },
        "estado_general": "alertas_activas" if oc_kpis.get("alertas") or bloqueadas else "ok",
    }


@router.get("/actividad")
def actividad_reciente(
    limite: int = Query(default=20, le=100),
    current_user: User = Depends(require_gerencial),
    db: Session = Depends(get_gerencial_db),
    agents_db: Session = Depends(get_agents_db),
):
    """
    Feed de actividad reciente de todas las áreas para el dashboard del gerente.
    """
    from app.agent_database import AgentAction, AgentSession

    actividad = []

    # Tareas dev recientes
    tareas = db.exec(
        select(GerencialTarea).order_by(desc(GerencialTarea.created_at)).limit(10)
    ).all()
    for t in tareas:
        actividad.append({
            "tipo": "tarea_dev",
            "timestamp": t.created_at.isoformat(),
            "descripcion": f"{t.subido_por_nombre} registró tarea: {t.titulo}",
            "estado": t.estado,
            "etiqueta": t.etiqueta,
        })

    # Acciones recientes del Agente Administrativo
    acciones = agents_db.exec(
        select(AgentAction)
        .join(AgentSession, AgentAction.session_id == AgentSession.id)
        .where(AgentSession.agente == "administrativo")
        .order_by(desc(AgentAction.timestamp))
        .limit(10)
    ).all()
    for a in acciones:
        actividad.append({
            "tipo": "agente_admin",
            "timestamp": a.timestamp.isoformat(),
            "descripcion": f"Agente Administrativo: {a.input[:80]}..." if len(a.input) > 80 else a.input,
            "estado": "completada",
            "etiqueta": a.tipo,
        })

    # Ordenar por timestamp descendente
    actividad.sort(key=lambda x: x["timestamp"], reverse=True)
    return actividad[:limite]


# ── Órdenes Directas del Gerente ───────────────────────────────────────────────

@router.post("/ordenes", response_model=OrdenRead, status_code=status.HTTP_201_CREATED)
async def crear_orden(
    payload: OrdenCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_gerencial),
    db: Session = Depends(get_gerencial_db),
    users_db: Session = Depends(get_db),
):
    """
    El gerente da una orden directa a un usuario. El destinatario recibe
    notificación en intranet y por email.
    """
    from app.models.user import User as UserModel
    destinatario = users_db.get(UserModel, payload.destinatario_id)
    if not destinatario or not destinatario.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destinatario no encontrado o inactivo.")

    orden = GerencialOrden(
        creada_por_id=current_user.id,
        creada_por_nombre=current_user.full_name or current_user.email,
        destinatario_id=payload.destinatario_id,
        destinatario_nombre=destinatario.full_name or destinatario.email,
        destinatario_area=destinatario.area or "",
        titulo=payload.titulo,
        descripcion=payload.descripcion,
    )
    db.add(orden)
    db.commit()
    db.refresh(orden)

    # Notificación por email en background
    background_tasks.add_task(_notificar_orden, orden, destinatario)

    return OrdenRead(
        id=orden.id,
        creada_por_id=orden.creada_por_id,
        creada_por_nombre=orden.creada_por_nombre,
        destinatario_id=orden.destinatario_id,
        destinatario_nombre=orden.destinatario_nombre,
        destinatario_area=orden.destinatario_area,
        titulo=orden.titulo,
        descripcion=orden.descripcion,
        estado=orden.estado,
        notificacion_enviada=orden.notificacion_enviada,
        created_at=orden.created_at.isoformat(),
    )


@router.get("/ordenes", response_model=list[OrdenRead])
def listar_ordenes(
    estado: Optional[str] = Query(default=None),
    destinatario_id: Optional[int] = Query(default=None),
    current_user: User = Depends(require_gerencial),
    db: Session = Depends(get_gerencial_db),
):
    query = select(GerencialOrden)
    if estado:
        query = query.where(GerencialOrden.estado == estado)
    if destinatario_id:
        query = query.where(GerencialOrden.destinatario_id == destinatario_id)
    query = query.order_by(desc(GerencialOrden.created_at))
    ordenes = db.exec(query).all()
    return [
        OrdenRead(
            id=o.id,
            creada_por_id=o.creada_por_id,
            creada_por_nombre=o.creada_por_nombre,
            destinatario_id=o.destinatario_id,
            destinatario_nombre=o.destinatario_nombre,
            destinatario_area=o.destinatario_area,
            titulo=o.titulo,
            descripcion=o.descripcion,
            estado=o.estado,
            notificacion_enviada=o.notificacion_enviada,
            created_at=o.created_at.isoformat(),
        )
        for o in ordenes
    ]


@router.patch("/ordenes/{orden_id}/estado")
def actualizar_estado_orden(
    orden_id: str,
    estado: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_gerencial_db),
):
    orden = db.get(GerencialOrden, orden_id)
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada.")
    if estado not in {"pendiente", "en_progreso", "completada"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Estado inválido.")
    orden.estado = estado
    orden.updated_at = datetime.utcnow()
    db.add(orden)
    db.commit()
    return {"ok": True, "estado": estado}


# ── Estado del servidor ────────────────────────────────────────────────────────

@router.get("/estado-servidor")
def estado_servidor(
    current_user: User = Depends(require_gerencial),
):
    """Estado de contenedores Docker y recursos del servidor."""
    try:
        import subprocess
        result = subprocess.run(
            ["docker", "stats", "--no-stream", "--format",
             "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}"],
            capture_output=True, text=True, timeout=10,
        )
        contenedores = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(",")
            if len(parts) >= 4:
                contenedores.append({
                    "nombre": parts[0],
                    "cpu": parts[1],
                    "memoria": parts[2],
                    "memoria_pct": parts[3],
                })
        return {"contenedores": contenedores, "disponible": True}
    except Exception as e:
        return {"contenedores": [], "disponible": False, "error": str(e)}


# ── Background helpers ─────────────────────────────────────────────────────────

async def _notificar_orden(orden: GerencialOrden, destinatario) -> None:
    """Envía email de notificación al destinatario de una orden directa."""
    try:
        from app.services.email_service import _send
        asunto = f"[ZYMO] El gerente te ha asignado una tarea: {orden.titulo}"
        cuerpo = (
            f"<p>Hola <strong>{orden.destinatario_nombre}</strong>,</p>"
            f"<p><strong>{orden.creada_por_nombre}</strong> te ha asignado la siguiente tarea:</p>"
            f"<h3>{orden.titulo}</h3>"
            f"{f'<p>{orden.descripcion}</p>' if orden.descripcion else ''}"
            f"<p>Ingresa a la intranet para ver el detalle y actualizar el estado.</p>"
        )
        if destinatario.email:
            await _send(to=destinatario.email, subject=asunto, html=cuerpo)

        # Marcar notificación como enviada
        from app.gerencial_database import get_gerencial_engine
        from sqlmodel import Session
        with Session(get_gerencial_engine()) as db:
            o = db.get(GerencialOrden, orden.id)
            if o:
                o.notificacion_enviada = True
                db.add(o)
                db.commit()
    except Exception as e:
        logger.error("Error enviando notificación de orden %s: %s", orden.id, e)

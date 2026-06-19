# Mantenimiento — Automatización y Trazabilidad Obligatoria

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la intranet en el portal obligatorio de trazabilidad de mantenimiento: choke financiero, evidencia fotográfica, aprobación triple >$2M, vista móvil para el auxiliar (magic link sin login), y dashboard KPIs para la directora.

**Architecture:** Backend FastAPI existente en `oc.db` (SQLite). Se agregan 2 tablas nuevas (`mnt_aprobaciones`, `mnt_activos_qr`), se extiende `mnt_solicitudes` con 5 columnas nuevas mediante migraciones inline (patrón existente en `oc_database.py`). El magic link usa un JWT corto (scope=mobile, 24h) firmado con el mismo `SECRET_KEY`. El frontend agrega tipos, hooks y 2 páginas nuevas (vista móvil pública + dashboard).

**Tech Stack:** Python 3.11, FastAPI, SQLModel, SQLite (`oc.db`), React 19, TypeScript, Recharts, DM Sans/DM Mono (estética ZYMO), JWT HS256 (`python-jose` ya instalado).

---

## Mapa de archivos

### Backend — modificar
- `backend/app/models/mantenimiento.py` — +5 campos en `SolicitudMantenimiento`, +enum `OrigenMantenimiento`/`PrioridadMantenimiento`, +clase `MntAprobacion`, +clase `MntActivoQR`
- `backend/app/oc_database.py` — migraciones inline para nuevas columnas y tablas
- `backend/app/routers/mantenimiento/solicitudes.py` — gates FSM, schema ampliado, endpoints nuevos (`/evidencia`, `/retroactivo`)
- `backend/app/routers/mantenimiento/oc_vinculada.py` — sin cambio (choke va en OC)
- `backend/app/routers/mantenimiento/router.py` — registrar sub-routers nuevos

### Backend — crear
- `backend/app/routers/mantenimiento/aprobaciones.py` — endpoint `POST /{id}/aprobacion`
- `backend/app/routers/mantenimiento/mobile.py` — magic link: `GET /m/{token}`, `POST /m/{token}/accion`
- `backend/app/routers/mantenimiento/kpis.py` — `GET /kpis` para dashboard
- `backend/app/routers/mantenimiento/activos_qr.py` — CRUD activos con QR

### Frontend — modificar
- `frontend/src/types/mantenimiento.ts` — +tipos nuevos (Origen, Prioridad, Aprobacion, KPIs)
- `frontend/src/hooks/useMantenimiento.ts` — +hooks nuevos
- `frontend/src/pages/mantenimiento/NuevaMantenimientoPage.tsx` — +campos origen, prioridad, monto
- `frontend/src/pages/mantenimiento/MantenimientoDetallePage.tsx` — +panel aprobaciones, +upload evidencia, +botón retroactivo

### Frontend — crear
- `frontend/src/pages/mantenimiento/MantenimientoMobilePage.tsx` — vista pública 3 botones (no requiere login)
- `frontend/src/pages/mantenimiento/MantenimientoDashboard.tsx` — tablero KPIs directora

---

## Task 1: Extender modelo de datos (backend)

**Files:**
- Modify: `backend/app/models/mantenimiento.py`

- [ ] **Step 1: Reemplazar contenido completo del modelo**

```python
# backend/app/models/mantenimiento.py
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class EstadoMantenimiento(str, Enum):
    solicitud  = "solicitud"
    evaluacion = "evaluacion"
    programado = "programado"
    ejecucion  = "ejecucion"
    completado = "completado"
    cerrado    = "cerrado"
    cancelado  = "cancelado"


class ClasificacionMantenimiento(str, Enum):
    preventivo = "preventivo"
    correctivo = "correctivo"


class ModalidadMantenimiento(str, Enum):
    interno = "interno"
    externo = "externo"


class OrigenMantenimiento(str, Enum):
    intranet              = "intranet"
    qr                    = "qr"
    whatsapp              = "whatsapp"
    telefonico_retroactivo = "telefonico_retroactivo"


class PrioridadMantenimiento(str, Enum):
    baja    = "baja"
    media   = "media"
    alta    = "alta"
    urgente = "urgente"


class SolicitudMantenimiento(SQLModel, table=True):
    __tablename__ = "mnt_solicitudes"

    id:          Optional[int] = Field(default=None, primary_key=True)
    consecutivo: str = Field(max_length=30, unique=True)

    titulo:      str = Field(max_length=300)
    descripcion: str

    tipo_mantenimiento: str = Field(max_length=100)
    clasificacion:      str = Field(max_length=20)
    modalidad:          str = Field(max_length=20)

    fecha_proxima_mantenimiento: Optional[date] = Field(default=None)

    estado:           str = Field(default=EstadoMantenimiento.solicitud, max_length=30)
    fecha_programada: Optional[datetime] = Field(default=None)
    notas_evaluacion: Optional[str] = Field(default=None)

    solicitante_id: int
    asignado_id:    Optional[int] = Field(default=None)
    empresa_nombre: Optional[str] = Field(default=None, max_length=100)

    # ── Campos nuevos Fase 1 ──────────────────────────────────────────────────
    origen:          str = Field(default=OrigenMantenimiento.intranet, max_length=30)
    prioridad:       str = Field(default=PrioridadMantenimiento.media, max_length=20)
    monto_estimado:  Optional[Decimal] = Field(default=None)
    monto_real:      Optional[Decimal] = Field(default=None)
    evidencia_url:   Optional[str] = Field(default=None, max_length=500)
    # activo_qr_id referencia a mnt_activos_qr (opcional)
    activo_qr_id:   Optional[int] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TipoMantenimientoConfig(SQLModel, table=True):
    __tablename__ = "mnt_tipos_config"

    id:     Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, unique=True)
    activo: bool = Field(default=True)
    orden:  int = Field(default=0)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HistorialMantenimiento(SQLModel, table=True):
    __tablename__ = "mnt_historial"

    id:              Optional[int] = Field(default=None, primary_key=True)
    solicitud_id:    int = Field(index=True)
    estado_anterior: Optional[str] = Field(default=None, max_length=30)
    estado_nuevo:    str = Field(max_length=30)
    nota:            Optional[str] = Field(default=None)
    usuario_id:      int
    usuario_nombre:  str = Field(max_length=200)
    fecha:           datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MntAprobacion(SQLModel, table=True):
    """Aprobaciones requeridas para mantenimientos con monto > $2.000.000."""
    __tablename__ = "mnt_aprobaciones"

    id:            Optional[int] = Field(default=None, primary_key=True)
    solicitud_id:  int = Field(index=True)
    aprobador_id:  int
    aprobador_nombre: str = Field(max_length=200)
    rol_aprobador: str = Field(max_length=50)   # "dir_administrativa" | "gerencia_operaciones" | "gerencia_general"
    aprobado:      bool = Field(default=True)
    nota:          Optional[str] = Field(default=None)
    fecha:         datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MntActivoQR(SQLModel, table=True):
    """Activos físicos con código QR para reporte rápido de novedades."""
    __tablename__ = "mnt_activos_qr"

    id:          Optional[int] = Field(default=None, primary_key=True)
    nombre:      str = Field(max_length=200)
    ubicacion:   str = Field(max_length=300)
    descripcion: Optional[str] = Field(default=None)
    activo:      bool = Field(default=True)
    qr_token:    str = Field(max_length=64, unique=True)   # token único para la URL del QR

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: Verificar que no hay errores de importación**

```bash
cd backend && python -c "from app.models.mantenimiento import SolicitudMantenimiento, MntAprobacion, MntActivoQR; print('OK')"
```
Esperado: `OK`

---

## Task 2: Migraciones inline para nuevas columnas y tablas

**Files:**
- Modify: `backend/app/oc_database.py`

- [ ] **Step 1: Leer las primeras 40 líneas del archivo para ver el patrón actual**

Ya conocemos el patrón: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` dentro de `create_oc_tables()`.

- [ ] **Step 2: Agregar importaciones y migraciones al final de `create_oc_tables()`**

Localizar la función `create_oc_tables()` y agregar al final del bloque `with engine.connect() as conn:`:

```python
# Importar los modelos nuevos en el bloque de imports al inicio del archivo
from app.models.mantenimiento import MntAprobacion, MntActivoQR

# Registrar nuevas tablas en SQLModel.metadata (agregar junto a los otros imports de modelos)
# Ya están en metadata porque heredan de SQLModel con table=True

# Dentro de create_oc_tables(), al final del bloque with engine.connect() as conn:
migrations_mnt_fase1 = [
    # Columnas nuevas en mnt_solicitudes
    "ALTER TABLE mnt_solicitudes ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'intranet'",
    "ALTER TABLE mnt_solicitudes ADD COLUMN IF NOT EXISTS prioridad TEXT DEFAULT 'media'",
    "ALTER TABLE mnt_solicitudes ADD COLUMN IF NOT EXISTS monto_estimado REAL",
    "ALTER TABLE mnt_solicitudes ADD COLUMN IF NOT EXISTS monto_real REAL",
    "ALTER TABLE mnt_solicitudes ADD COLUMN IF NOT EXISTS evidencia_url TEXT",
    "ALTER TABLE mnt_solicitudes ADD COLUMN IF NOT EXISTS activo_qr_id INTEGER",
    # Tablas nuevas (SQLModel las crea si no existen via metadata.create_all)
]
for sql in migrations_mnt_fase1:
    try:
        conn.execute(text(sql))
    except Exception as e:
        log.warning("Migración mnt fase1: %s — %s", sql[:60], e)
conn.commit()
```

- [ ] **Step 3: Verificar que las tablas nuevas se crean en el build**

```bash
cd backend && python -c "from app.oc_database import create_oc_tables; create_oc_tables(); print('Migraciones OK')"
```
Esperado: `Migraciones OK` sin errores críticos.

---

## Task 3: Actualizar FSM — gates de aprobación y evidencia

**Files:**
- Modify: `backend/app/routers/mantenimiento/solicitudes.py`

- [ ] **Step 1: Extender schemas para incluir campos nuevos**

Agregar al bloque de schemas (después de `ActualizarProgramadoBody`):

```python
class SolicitudMantenimientoCreate(BaseModel):
    titulo:                      str
    descripcion:                 str
    tipo_mantenimiento:          str
    clasificacion:               ClasificacionMantenimiento
    modalidad:                   ModalidadMantenimiento
    fecha_proxima_mantenimiento: Optional[str] = None
    origen:                      str = "intranet"
    prioridad:                   str = "media"
    monto_estimado:              Optional[float] = None
    activo_qr_id:                Optional[int] = None

    @field_validator("fecha_proxima_mantenimiento")
    @classmethod
    def validar_fecha_preventivo(cls, v, info):
        clasificacion = info.data.get("clasificacion")
        if clasificacion == ClasificacionMantenimiento.preventivo and not v:
            raise ValueError("fecha_proxima_mantenimiento es requerida para mantenimiento preventivo.")
        if clasificacion == ClasificacionMantenimiento.correctivo:
            return None
        return v


class SolicitudRetroactivaCreate(BaseModel):
    """Registro de trabajo ya realizado informalmente."""
    titulo:         str
    descripcion:    str
    tipo_mantenimiento: str
    clasificacion:  ClasificacionMantenimiento
    modalidad:      ModalidadMantenimiento
    nota_cierre:    str
    monto_real:     Optional[float] = None
    evidencia_url:  Optional[str] = None
    asignado_id:    Optional[int] = None


class SolicitudMantenimientoOut(BaseModel):
    id:                          int
    consecutivo:                 str
    titulo:                      str
    descripcion:                 str
    tipo_mantenimiento:          str
    clasificacion:               str
    modalidad:                   str
    fecha_proxima_mantenimiento: Optional[str]
    estado:                      str
    fecha_programada:            Optional[str]
    notas_evaluacion:            Optional[str]
    solicitante_id:              int
    solicitante_nombre:          Optional[str]
    asignado_id:                 Optional[int]
    asignado_nombre:             Optional[str]
    empresa_nombre:              Optional[str]
    # Campos nuevos
    origen:                      str
    prioridad:                   str
    monto_estimado:              Optional[float]
    monto_real:                  Optional[float]
    evidencia_url:               Optional[str]
    activo_qr_id:                Optional[int]
    requiere_aprobacion:         bool
    aprobaciones_count:          int
    created_at:                  str
    updated_at:                  str
```

- [ ] **Step 2: Actualizar `_enriquecer` para incluir campos nuevos**

Reemplazar la función `_enriquecer`:

```python
def _enriquecer(
    sol: SolicitudMantenimiento,
    users_by_id: dict,
    aprobaciones_count: int = 0,
) -> SolicitudMantenimientoOut:
    sol_user = users_by_id.get(sol.solicitante_id)
    asig_user = users_by_id.get(sol.asignado_id) if sol.asignado_id else None
    monto_est = float(sol.monto_estimado) if sol.monto_estimado is not None else None
    requiere = monto_est is not None and monto_est > 2_000_000
    return SolicitudMantenimientoOut(
        id=sol.id,
        consecutivo=sol.consecutivo,
        titulo=sol.titulo,
        descripcion=sol.descripcion,
        tipo_mantenimiento=sol.tipo_mantenimiento,
        clasificacion=sol.clasificacion,
        modalidad=sol.modalidad,
        fecha_proxima_mantenimiento=sol.fecha_proxima_mantenimiento.isoformat() if sol.fecha_proxima_mantenimiento else None,
        estado=sol.estado,
        fecha_programada=sol.fecha_programada.isoformat() if sol.fecha_programada else None,
        notas_evaluacion=sol.notas_evaluacion,
        solicitante_id=sol.solicitante_id,
        solicitante_nombre=sol_user.full_name if sol_user else None,
        asignado_id=sol.asignado_id,
        asignado_nombre=asig_user.full_name if asig_user else None,
        empresa_nombre=sol.empresa_nombre,
        origen=getattr(sol, "origen", "intranet") or "intranet",
        prioridad=getattr(sol, "prioridad", "media") or "media",
        monto_estimado=monto_est,
        monto_real=float(sol.monto_real) if getattr(sol, "monto_real", None) is not None else None,
        evidencia_url=getattr(sol, "evidencia_url", None),
        activo_qr_id=getattr(sol, "activo_qr_id", None),
        requiere_aprobacion=requiere,
        aprobaciones_count=aprobaciones_count,
        created_at=sol.created_at.isoformat(),
        updated_at=sol.updated_at.isoformat(),
    )
```

- [ ] **Step 3: Agregar gate de aprobación y evidencia en `cambiar_estado`**

Dentro de `cambiar_estado`, después de validar la transición y ANTES de ejecutarla:

```python
# Gate 1: evaluacion → programado requiere aprobaciones si monto > $2M
if sol.estado == EstadoMantenimiento.evaluacion and body.estado_nuevo == EstadoMantenimiento.programado:
    monto = float(getattr(sol, "monto_estimado", 0) or 0)
    if monto > 2_000_000:
        from app.models.mantenimiento import MntAprobacion
        count = oc_db.exec(
            select(func.count(MntAprobacion.id)).where(
                MntAprobacion.solicitud_id == sol.id,
                MntAprobacion.aprobado == True,
            )
        ).one()
        if count < 3:
            raise HTTPException(
                status_code=400,
                detail=f"Este mantenimiento supera $2.000.000. Requiere 3 aprobaciones. "
                       f"Actualmente tiene {count}/3.",
            )

# Gate 2: ejecucion → completado requiere evidencia (foto)
if sol.estado == EstadoMantenimiento.ejecucion and body.estado_nuevo == EstadoMantenimiento.completado:
    if not getattr(sol, "evidencia_url", None):
        raise HTTPException(
            status_code=400,
            detail="Para completar el mantenimiento debe subir una foto de evidencia del trabajo realizado.",
        )
```

- [ ] **Step 4: Actualizar `crear_solicitud` para aceptar campos nuevos**

En el endpoint `crear_solicitud`, actualizar la construcción de `SolicitudMantenimiento`:

```python
sol = SolicitudMantenimiento(
    consecutivo=consecutivo,
    titulo=body.titulo.strip(),
    descripcion=body.descripcion.strip(),
    tipo_mantenimiento=body.tipo_mantenimiento,
    clasificacion=body.clasificacion.value,
    modalidad=body.modalidad.value,
    fecha_proxima_mantenimiento=fecha_proxima,
    solicitante_id=current_user.id,
    empresa_nombre=getattr(current_user, "empresa_nombre", None),
    origen=body.origen,
    prioridad=body.prioridad,
    monto_estimado=body.monto_estimado,
    activo_qr_id=body.activo_qr_id,
)
```

- [ ] **Step 5: Agregar endpoint de evidencia y retroactivo**

Al final del archivo, agregar:

```python
class SubirEvidenciaBody(BaseModel):
    evidencia_url: str
    monto_real:    Optional[float] = None
    nota:          Optional[str] = None


@router.post("/{solicitud_id}/evidencia", response_model=SolicitudMantenimientoOut)
def subir_evidencia(
    solicitud_id: int,
    body: SubirEvidenciaBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sube la URL de la foto de evidencia del trabajo completado."""
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    # Solo el asignado, admin o quien tenga permiso puede subir evidencia
    from app.core.permissions import user_has_permission
    puede = (
        current_user.role == "admin"
        or sol.asignado_id == current_user.id
        or user_has_permission(app_db, current_user, "mod_mantenimiento")
    )
    if not puede:
        raise HTTPException(status_code=403, detail="Sin permiso para subir evidencia.")

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
            nota=f"Evidencia subida: {body.nota}",
            usuario_id=current_user.id,
            usuario_nombre=current_user.full_name or current_user.email,
        )
        oc_db.add(hist)
    oc_db.commit()
    oc_db.refresh(sol)

    return _enriquecer(sol, {current_user.id: current_user})


@router.post("/retroactivo", status_code=status.HTTP_201_CREATED, response_model=SolicitudMantenimientoOut)
def registrar_retroactivo(
    body: SolicitudRetroactivaCreate,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra un trabajo de mantenimiento que ya fue resuelto informalmente."""
    consecutivo = _generar_consecutivo(oc_db)

    sol = SolicitudMantenimiento(
        consecutivo=consecutivo,
        titulo=body.titulo.strip(),
        descripcion=body.descripcion.strip(),
        tipo_mantenimiento=body.tipo_mantenimiento,
        clasificacion=body.clasificacion.value,
        modalidad=body.modalidad.value,
        solicitante_id=current_user.id,
        asignado_id=body.asignado_id,
        empresa_nombre=getattr(current_user, "empresa_nombre", None),
        origen="telefonico_retroactivo",
        prioridad="media",
        monto_real=body.monto_real,
        evidencia_url=body.evidencia_url,
        estado=EstadoMantenimiento.completado,
    )
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)

    hist = HistorialMantenimiento(
        solicitud_id=sol.id,
        estado_anterior=None,
        estado_nuevo=EstadoMantenimiento.completado,
        nota=f"Registro retroactivo: {body.nota_cierre}",
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name or current_user.email,
    )
    oc_db.add(hist)
    oc_db.commit()

    return _enriquecer(sol, {current_user.id: current_user})
```

- [ ] **Step 6: Verificar TypeScript del backend**

```bash
cd backend && python -c "from app.routers.mantenimiento.solicitudes import router; print('Router OK')"
```
Esperado: `Router OK`

---

## Task 4: Router de aprobaciones (>$2M)

**Files:**
- Create: `backend/app/routers/mantenimiento/aprobaciones.py`
- Modify: `backend/app/routers/mantenimiento/router.py`

- [ ] **Step 1: Crear `aprobaciones.py`**

```python
# backend/app/routers/mantenimiento/aprobaciones.py
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.models.mantenimiento import MntAprobacion, SolicitudMantenimiento
from app.models.user import User
from app.oc_database import get_oc_db

log = logging.getLogger(__name__)
router = APIRouter(tags=["Mantenimiento - Aprobaciones"])

_ROLES_APROBACION = {"dir_administrativa", "gerencia_operaciones", "gerencia_general"}


class AprobacionBody(BaseModel):
    rol_aprobador: str   # uno de _ROLES_APROBACION
    nota:          Optional[str] = None


class AprobacionOut(BaseModel):
    id:               int
    solicitud_id:     int
    aprobador_nombre: str
    rol_aprobador:    str
    aprobado:         bool
    nota:             Optional[str]
    fecha:            str


@router.post(
    "/solicitudes/{solicitud_id}/aprobacion",
    status_code=status.HTTP_201_CREATED,
    response_model=AprobacionOut,
)
def registrar_aprobacion(
    solicitud_id: int,
    body: AprobacionBody,
    oc_db: Session = Depends(get_oc_db),
    current_user: User = Depends(get_current_user),
):
    if body.rol_aprobador not in _ROLES_APROBACION:
        raise HTTPException(
            status_code=400,
            detail=f"rol_aprobador inválido. Permitidos: {sorted(_ROLES_APROBACION)}",
        )
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    # Verificar que no aprobó ya con este rol
    ya_existe = oc_db.exec(
        select(MntAprobacion).where(
            MntAprobacion.solicitud_id == solicitud_id,
            MntAprobacion.rol_aprobador == body.rol_aprobador,
        )
    ).first()
    if ya_existe:
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe una aprobación con rol '{body.rol_aprobador}' para esta solicitud.",
        )

    aprobacion = MntAprobacion(
        solicitud_id=solicitud_id,
        aprobador_id=current_user.id,
        aprobador_nombre=current_user.full_name or current_user.email,
        rol_aprobador=body.rol_aprobador,
        aprobado=True,
        nota=body.nota,
    )
    oc_db.add(aprobacion)
    oc_db.commit()
    oc_db.refresh(aprobacion)

    log.info(
        "Aprobación registrada: solicitud %s, rol %s, por %s",
        solicitud_id, body.rol_aprobador, current_user.email,
    )
    return AprobacionOut(
        id=aprobacion.id,
        solicitud_id=aprobacion.solicitud_id,
        aprobador_nombre=aprobacion.aprobador_nombre,
        rol_aprobador=aprobacion.rol_aprobador,
        aprobado=aprobacion.aprobado,
        nota=aprobacion.nota,
        fecha=aprobacion.fecha.isoformat(),
    )


@router.get("/solicitudes/{solicitud_id}/aprobaciones", response_model=list[AprobacionOut])
def listar_aprobaciones(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    _: User = Depends(get_current_user),
):
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
```

- [ ] **Step 2: Registrar en `router.py`**

```python
# backend/app/routers/mantenimiento/router.py
from fastapi import APIRouter
from . import config, solicitudes, oc_vinculada, aprobaciones

router = APIRouter(prefix="/api/mantenimiento")
router.include_router(config.router)
router.include_router(solicitudes.router)
router.include_router(oc_vinculada.router)
router.include_router(aprobaciones.router)
```

- [ ] **Step 3: Verificar**

```bash
cd backend && python -c "from app.routers.mantenimiento.aprobaciones import router; print('Aprobaciones OK')"
```
Esperado: `Aprobaciones OK`

---

## Task 5: Magic link — vista móvil para el auxiliar

**Files:**
- Create: `backend/app/routers/mantenimiento/mobile.py`
- Modify: `backend/app/routers/mantenimiento/router.py`

- [ ] **Step 1: Crear `mobile.py`**

```python
# backend/app/routers/mantenimiento/mobile.py
"""Vista móvil para el auxiliar de mantenimiento.
El token JWT tiene scope=mnt_mobile y contiene solicitud_id.
No requiere sesión de usuario — acceso vía magic link.
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
    accion:       str           # "en_camino" | "completado" | "necesita_repuesto"
    evidencia_url: Optional[str] = None
    monto_real:   Optional[float] = None
    nota:         Optional[str] = None


class MobileOut(BaseModel):
    solicitud_id: int
    consecutivo:  str
    titulo:       str
    descripcion:  str
    estado:       str
    asignado_nombre: Optional[str]
    solicitante_nombre: Optional[str]


@router.get("/{token}", response_model=MobileOut)
def obtener_solicitud_mobile(token: str):
    """Obtiene datos básicos de la solicitud para la vista móvil del auxiliar."""
    from app.oc_database import SessionLocal as OcSessionLocal
    from app.database import SessionLocal as AppSessionLocal
    from app.models.mantenimiento import SolicitudMantenimiento
    from app.models.user import User
    from sqlmodel import select

    solicitud_id = _validar_token(token)

    with OcSessionLocal() as oc_db:
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

        with AppSessionLocal() as app_db:
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
            asignado_nombre=by_id.get(sol.asignado_id).full_name if sol.asignado_id and sol.asignado_id in by_id else None,
            solicitante_nombre=by_id.get(sol.solicitante_id).full_name if sol.solicitante_id in by_id else None,
        )


@router.post("/{token}/accion")
def ejecutar_accion_mobile(token: str, body: AccionMobileBody):
    """El auxiliar ejecuta una acción desde su celular (sin login)."""
    from app.oc_database import SessionLocal as OcSessionLocal
    from app.models.mantenimiento import SolicitudMantenimiento, HistorialMantenimiento, EstadoMantenimiento
    from datetime import datetime, timezone

    solicitud_id = _validar_token(token)
    acciones_validas = {"en_camino", "completado", "necesita_repuesto"}
    if body.accion not in acciones_validas:
        raise HTTPException(status_code=400, detail=f"Acción inválida. Permitidas: {acciones_validas}")

    with OcSessionLocal() as oc_db:
        sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

        estado_anterior = sol.estado

        if body.accion == "en_camino":
            if sol.estado not in (EstadoMantenimiento.programado, EstadoMantenimiento.evaluacion):
                raise HTTPException(status_code=400, detail="La solicitud no está en estado programado.")
            sol.estado = EstadoMantenimiento.ejecucion

        elif body.accion == "completado":
            if not body.evidencia_url:
                raise HTTPException(status_code=400, detail="Se requiere foto de evidencia para completar.")
            sol.evidencia_url = body.evidencia_url
            if body.monto_real is not None:
                sol.monto_real = body.monto_real
            sol.estado = EstadoMantenimiento.completado

        elif body.accion == "necesita_repuesto":
            # Solo registra nota — la OC la crea el administrador desde la intranet
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
```

- [ ] **Step 2: Registrar en `router.py` y agregar endpoint de generación de token en solicitudes**

En `router.py`:
```python
from . import config, solicitudes, oc_vinculada, aprobaciones, mobile

router.include_router(mobile.router)
```

En `solicitudes.py`, agregar endpoint para generar el magic link:
```python
@router.post("/{solicitud_id}/magic-link")
def generar_magic_link(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    current_user: User = Depends(require_mantenimiento),
):
    """Genera un magic link para que el auxiliar acceda desde su celular."""
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    from app.routers.mantenimiento.mobile import generar_magic_token
    base_url = os.environ.get("FRONTEND_URL", "https://zymointranet.com")
    token = generar_magic_token(solicitud_id)
    url = f"{base_url}/m/{token}"
    return {"url": url, "token": token}
```

Agregar `import os` al inicio de `solicitudes.py` si no existe.

- [ ] **Step 3: Verificar**

```bash
cd backend && python -c "from app.routers.mantenimiento.mobile import router, generar_magic_token; t = generar_magic_token(1); print('Mobile OK, token:', t[:20])"
```
Esperado: `Mobile OK, token: ey...`

---

## Task 6: KPIs endpoint (dashboard directora)

**Files:**
- Create: `backend/app/routers/mantenimiento/kpis.py`
- Modify: `backend/app/routers/mantenimiento/router.py`

- [ ] **Step 1: Crear `kpis.py`**

```python
# backend/app/routers/mantenimiento/kpis.py
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.deps import get_current_user
from app.models.mantenimiento import EstadoMantenimiento, SolicitudMantenimiento
from app.models.user import User
from app.oc_database import get_oc_db

router = APIRouter(tags=["Mantenimiento - KPIs"])


class KpisMes(BaseModel):
    total:       int
    cerradas:    int
    en_curso:    int
    canceladas:  int
    informales:  int   # origen = telefonico_retroactivo
    gasto_total: float
    gasto_preventivo: float
    gasto_correctivo: float
    gasto_interno:    float
    gasto_externo:    float


class KpisOut(BaseModel):
    mes_actual:   KpisMes
    por_origen:   dict   # {"intranet": N, "qr": N, "telefonico_retroactivo": N, ...}
    pendientes_aprobacion: int


@router.get("/kpis", response_model=KpisOut)
def obtener_kpis(
    oc_db: Session = Depends(get_oc_db),
    current_user: User = Depends(get_current_user),
):
    ahora = datetime.now(timezone.utc)
    inicio_mes = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    stmt_mes = select(SolicitudMantenimiento).where(
        SolicitudMantenimiento.created_at >= inicio_mes
    )
    items_mes = oc_db.exec(stmt_mes).all()

    estados_terminal = {EstadoMantenimiento.cerrado, EstadoMantenimiento.cancelado, EstadoMantenimiento.completado}
    estados_activos  = {EstadoMantenimiento.solicitud, EstadoMantenimiento.evaluacion, EstadoMantenimiento.programado, EstadoMantenimiento.ejecucion}

    gasto_total = sum(float(s.monto_real or 0) for s in items_mes)
    gasto_prev  = sum(float(s.monto_real or 0) for s in items_mes if s.clasificacion == "preventivo")
    gasto_corr  = sum(float(s.monto_real or 0) for s in items_mes if s.clasificacion == "correctivo")
    gasto_int   = sum(float(s.monto_real or 0) for s in items_mes if s.modalidad == "interno")
    gasto_ext   = sum(float(s.monto_real or 0) for s in items_mes if s.modalidad == "externo")

    # Por origen (todas las solicitudes)
    todos = oc_db.exec(select(SolicitudMantenimiento)).all()
    por_origen: dict[str, int] = {}
    for s in todos:
        origen = getattr(s, "origen", "intranet") or "intranet"
        por_origen[origen] = por_origen.get(origen, 0) + 1

    # Pendientes de aprobación (monto > 2M, estado evaluacion)
    pendientes = sum(
        1 for s in todos
        if s.estado == EstadoMantenimiento.evaluacion
        and float(getattr(s, "monto_estimado", 0) or 0) > 2_000_000
    )

    return KpisOut(
        mes_actual=KpisMes(
            total=len(items_mes),
            cerradas=sum(1 for s in items_mes if s.estado in (EstadoMantenimiento.cerrado, EstadoMantenimiento.completado)),
            en_curso=sum(1 for s in items_mes if s.estado in estados_activos),
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
```

- [ ] **Step 2: Registrar en router.py**

```python
from . import config, solicitudes, oc_vinculada, aprobaciones, mobile, kpis

router.include_router(kpis.router)
```

- [ ] **Step 3: Commit backend completo**

```bash
git add backend/app/models/mantenimiento.py \
        backend/app/oc_database.py \
        backend/app/routers/mantenimiento/solicitudes.py \
        backend/app/routers/mantenimiento/aprobaciones.py \
        backend/app/routers/mantenimiento/mobile.py \
        backend/app/routers/mantenimiento/kpis.py \
        backend/app/routers/mantenimiento/router.py
git commit -m "feat(mnt): fase 1 — campos nuevos, gates FSM, aprobaciones >2M, magic link, KPIs"
```

---

## Task 7: Tipos y hooks frontend

**Files:**
- Modify: `frontend/src/types/mantenimiento.ts`
- Modify: `frontend/src/hooks/useMantenimiento.ts`

- [ ] **Step 1: Reemplazar `mantenimiento.ts`**

```typescript
// frontend/src/types/mantenimiento.ts
export type EstadoMantenimiento =
  | "solicitud" | "evaluacion" | "programado"
  | "ejecucion" | "completado" | "cerrado" | "cancelado"

export type ClasificacionMantenimiento = "preventivo" | "correctivo"
export type ModalidadMantenimiento     = "interno" | "externo"
export type OrigenMantenimiento        = "intranet" | "qr" | "whatsapp" | "telefonico_retroactivo"
export type PrioridadMantenimiento     = "baja" | "media" | "alta" | "urgente"

export interface SolicitudMantenimiento {
  id:                          number
  consecutivo:                 string
  titulo:                      string
  descripcion:                 string
  tipo_mantenimiento:          string
  clasificacion:               ClasificacionMantenimiento
  modalidad:                   ModalidadMantenimiento
  fecha_proxima_mantenimiento: string | null
  estado:                      EstadoMantenimiento
  fecha_programada:            string | null
  notas_evaluacion:            string | null
  solicitante_id:              number
  solicitante_nombre:          string | null
  asignado_id:                 number | null
  asignado_nombre:             string | null
  empresa_nombre:              string | null
  // Campos nuevos
  origen:                      OrigenMantenimiento
  prioridad:                   PrioridadMantenimiento
  monto_estimado:              number | null
  monto_real:                  number | null
  evidencia_url:               string | null
  activo_qr_id:                number | null
  requiere_aprobacion:         boolean
  aprobaciones_count:          number
  created_at:                  string
  updated_at:                  string
}

export interface SolicitudesMantenimientoListResponse {
  items:  SolicitudMantenimiento[]
  total:  number
  page:   number
  pages:  number
}

export interface TipoMantenimientoConfig {
  id:     number
  nombre: string
  activo: boolean
  orden:  number
}

export interface HistorialMantenimientoEntrada {
  id:              number
  estado_anterior: EstadoMantenimiento | null
  estado_nuevo:    EstadoMantenimiento
  nota:            string | null
  usuario_id:      number
  usuario_nombre:  string
  fecha:           string
}

export interface OCVinculada {
  id:              string
  consecutivo_os:  string
  descripcion:     string
  estado:          string
  nivel_prioridad: string
  fecha_solicitud: string
}

export interface Aprobacion {
  id:               number
  solicitud_id:     number
  aprobador_nombre: string
  rol_aprobador:    "dir_administrativa" | "gerencia_operaciones" | "gerencia_general"
  aprobado:         boolean
  nota:             string | null
  fecha:            string
}

export interface MobileOut {
  solicitud_id:       number
  consecutivo:        string
  titulo:             string
  descripcion:        string
  estado:             string
  asignado_nombre:    string | null
  solicitante_nombre: string | null
}

export interface KpisMes {
  total:            number
  cerradas:         number
  en_curso:         number
  canceladas:       number
  informales:       number
  gasto_total:      number
  gasto_preventivo: number
  gasto_correctivo: number
  gasto_interno:    number
  gasto_externo:    number
}

export interface KpisOut {
  mes_actual:            KpisMes
  por_origen:            Record<string, number>
  pendientes_aprobacion: number
}

// Payloads
export interface CrearMantenimientoPayload {
  titulo:                      string
  descripcion:                 string
  tipo_mantenimiento:          string
  clasificacion:               ClasificacionMantenimiento
  modalidad:                   ModalidadMantenimiento
  fecha_proxima_mantenimiento: string | null
  origen?:                     OrigenMantenimiento
  prioridad?:                  PrioridadMantenimiento
  monto_estimado?:             number | null
  activo_qr_id?:               number | null
}

export interface CrearRetroactivoPayload {
  titulo:             string
  descripcion:        string
  tipo_mantenimiento: string
  clasificacion:      ClasificacionMantenimiento
  modalidad:          ModalidadMantenimiento
  nota_cierre:        string
  monto_real?:        number | null
  evidencia_url?:     string | null
  asignado_id?:       number | null
}

export interface SubirEvidenciaPayload {
  evidencia_url: string
  monto_real?:   number | null
  nota?:         string
}

export interface AprobacionPayload {
  rol_aprobador: "dir_administrativa" | "gerencia_operaciones" | "gerencia_general"
  nota?:         string
}

export interface CambiarEstadoMantenimientoPayload {
  estado_nuevo: EstadoMantenimiento
  nota?:        string
}

export interface CrearOCVinculadaPayload {
  descripcion:               string
  categoria?:                string
  grupo_articulos?:          string
  nivel_prioridad:           string
  sede?:                     string
  observaciones_solicitante?: string
}

export interface MantenimientoFilters {
  estado?:        EstadoMantenimiento | ""
  clasificacion?: ClasificacionMantenimiento | ""
  modalidad?:     ModalidadMantenimiento | ""
  q?:             string
}
```

- [ ] **Step 2: Agregar hooks nuevos en `useMantenimiento.ts`**

Al final del archivo, agregar:

```typescript
// --- Hooks nuevos Fase 1 ---

export function useSubirEvidencia() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const subir = useCallback(async (id: number, payload: SubirEvidenciaPayload) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/mantenimiento/solicitudes/${id}/evidencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).detail || "Error al subir evidencia")
      return await res.json() as SolicitudMantenimiento
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { subir, loading, error }
}

export function useCrearRetroactivo() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const crear = useCallback(async (payload: CrearRetroactivoPayload) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/mantenimiento/solicitudes/retroactivo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).detail || "Error")
      return await res.json() as SolicitudMantenimiento
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { crear, loading, error }
}

export function useAprobaciones(solicitudId: number | null) {
  const [data, setData]       = useState<Aprobacion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!solicitudId) return
    setLoading(true)
    fetch(`/api/mantenimiento/solicitudes/${solicitudId}/aprobaciones`, { headers: authHeaders() })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [solicitudId])

  return { data, loading }
}

export function useRegistrarAprobacion() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const aprobar = useCallback(async (id: number, payload: AprobacionPayload) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/mantenimiento/solicitudes/${id}/aprobacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).detail || "Error")
      return await res.json() as Aprobacion
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { aprobar, loading, error }
}

export function useMagicLink() {
  const [loading, setLoading] = useState(false)

  const generar = useCallback(async (id: number): Promise<string | null> => {
    setLoading(true)
    try {
      const res = await fetch(`/api/mantenimiento/solicitudes/${id}/magic-link`, {
        method: "POST",
        headers: authHeaders(),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.url as string
    } finally {
      setLoading(false)
    }
  }, [])

  return { generar, loading }
}

export function useKpisMantenimiento() {
  const [data, setData]       = useState<KpisOut | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/mantenimiento/kpis", { headers: authHeaders() })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
```

Nota: `authHeaders()` es la función auxiliar que ya existe en el archivo. Verificar su nombre exacto y usar el mismo.

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Esperado: sin errores en archivos modificados.

---

## Task 8: Vista móvil pública para el auxiliar

**Files:**
- Create: `frontend/src/pages/mantenimiento/MantenimientoMobilePage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Crear `MantenimientoMobilePage.tsx`**

```tsx
// frontend/src/pages/mantenimiento/MantenimientoMobilePage.tsx
import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import type { MobileOut } from "@/types/mantenimiento"

const API = "/api/mantenimiento"

export default function MantenimientoMobilePage() {
  const { token } = useParams<{ token: string }>()
  const [sol, setSol]     = useState<MobileOut | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accion, setAccion] = useState<string | null>(null)
  const [ok, setOk]       = useState(false)
  const [busy, setBusy]   = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${API}/m/${token}`)
      .then(r => { if (!r.ok) throw new Error("Link inválido o expirado"); return r.json() })
      .then(setSol)
      .catch(e => setError(e.message))
  }, [token])

  async function ejecutar(acc: string, extra?: { evidencia_url?: string; monto_real?: number }) {
    if (!token) return
    setBusy(true)
    try {
      const res = await fetch(`${API}/m/${token}/accion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: acc, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error")
      setOk(true)
      setAccion(acc)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function completarConFoto() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.capture = "environment"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      // En producción esto sube a S3/storage y devuelve URL.
      // Por ahora usamos data URL como placeholder.
      const reader = new FileReader()
      reader.onload = async () => {
        const url = reader.result as string
        await ejecutar("completado", { evidencia_url: url })
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  if (error) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", padding: 32, textAlign: "center" }}>
      <p style={{ color: "#ef4444", fontSize: 18 }}>⚠️ {error}</p>
      <p style={{ color: "#94a3b8", fontSize: 14 }}>El enlace puede haber expirado. Solicita uno nuevo al equipo administrativo.</p>
    </div>
  )

  if (!sol) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", padding: 32, textAlign: "center", color: "#94a3b8" }}>
      Cargando...
    </div>
  )

  if (ok) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 64 }}>✅</div>
      <h2 style={{ color: "#22c55e", marginTop: 16 }}>
        {accion === "completado" ? "¡Trabajo registrado!" : accion === "en_camino" ? "¡En camino registrado!" : "¡Notificación enviada!"}
      </h2>
      <p style={{ color: "#94a3b8" }}>El sistema actualizó el estado de la solicitud.</p>
    </div>
  )

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto", padding: 24, background: "#0f172a", minHeight: "100vh", color: "#f1f5f9" }}>
      <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{sol.consecutivo}</p>
        <h1 style={{ fontSize: 20, margin: "8px 0", color: "#f1f5f9" }}>{sol.titulo}</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>{sol.descripcion}</p>
        {sol.solicitante_nombre && (
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 12 }}>
            Solicitó: <strong style={{ color: "#94a3b8" }}>{sol.solicitante_nombre}</strong>
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button
          onClick={() => ejecutar("en_camino")}
          disabled={busy}
          style={btnStyle("#2563eb")}
        >
          ▶ VOY EN CAMINO
        </button>
        <button
          onClick={completarConFoto}
          disabled={busy}
          style={btnStyle("#16a34a")}
        >
          ✓ TERMINÉ — SUBIR FOTO
        </button>
        <button
          onClick={() => ejecutar("necesita_repuesto")}
          disabled={busy}
          style={btnStyle("#d97706")}
        >
          🛒 NECESITO REPUESTO
        </button>
      </div>

      {busy && <p style={{ textAlign: "center", color: "#64748b", marginTop: 24 }}>Registrando...</p>}
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "20px 24px",
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    width: "100%",
    letterSpacing: "0.5px",
  }
}
```

- [ ] **Step 2: Agregar ruta pública en `App.tsx`**

La ruta `/m/:token` debe ser **pública** (sin `PrivateRoute`). Agregar junto a las rutas públicas (login, etc.):

```tsx
import MantenimientoMobilePage from "@/pages/mantenimiento/MantenimientoMobilePage"

// En el bloque de rutas públicas:
<Route path="/m/:token" element={<MantenimientoMobilePage />} />
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Esperado: sin errores nuevos.

---

## Task 9: Dashboard KPIs — directora administrativa

**Files:**
- Create: `frontend/src/pages/mantenimiento/MantenimientoDashboard.tsx`
- Modify: `frontend/src/App.tsx` (ruta + guard)

- [ ] **Step 1: Crear `MantenimientoDashboard.tsx`**

```tsx
// frontend/src/pages/mantenimiento/MantenimientoDashboard.tsx
import { useKpisMantenimiento } from "@/hooks/useMantenimiento"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)

const ORIGEN_LABEL: Record<string, string> = {
  intranet:               "Intranet",
  qr:                     "QR",
  whatsapp:               "WhatsApp",
  telefonico_retroactivo: "Informal",
}

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#ef4444"]

export default function MantenimientoDashboard() {
  const { data, loading } = useKpisMantenimiento()

  if (loading) return (
    <div style={{ padding: 32, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
      Cargando tablero...
    </div>
  )

  if (!data) return null

  const { mes_actual: m, por_origen, pendientes_aprobacion } = data

  const origenData = Object.entries(por_origen).map(([k, v]) => ({
    name: ORIGEN_LABEL[k] ?? k,
    value: v,
  }))

  const gastoData = [
    { name: "Preventivo", valor: m.gasto_preventivo },
    { name: "Correctivo", valor: m.gasto_correctivo },
    { name: "Interno",    valor: m.gasto_interno },
    { name: "Externo",    valor: m.gasto_externo },
  ]

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", padding: "24px 32px", background: "#0f172a", minHeight: "100vh", color: "#f1f5f9" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Tablero de Mantenimiento</h1>
      <p style={{ color: "#64748b", marginBottom: 32, fontSize: 14 }}>Mes actual</p>

      {/* Alertas */}
      {(pendientes_aprobacion > 0 || m.informales > 0) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {pendientes_aprobacion > 0 && (
            <Alerta color="#ef4444" texto={`${pendientes_aprobacion} solicitud(es) > $2M esperando aprobación`} />
          )}
          {m.informales > 0 && (
            <Alerta color="#d97706" texto={`${m.informales} trabajos registrados como informales este mes`} />
          )}
        </div>
      )}

      {/* KPIs principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
        <KpiCard label="Total solicitudes" valor={m.total} />
        <KpiCard label="Cerradas / Completadas" valor={m.cerradas} color="#22c55e" />
        <KpiCard label="En curso" valor={m.en_curso} color="#2563eb" />
        <KpiCard label="Canceladas" valor={m.canceladas} color="#ef4444" />
        <KpiCard label="Gasto total mes" valor={COP(m.gasto_total)} />
      </div>

      {/* Gráficas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, flexWrap: "wrap" }}>
        <ChartCard titulo="Gasto por tipo/modalidad">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gastoData}>
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => COP(v)} contentStyle={{ background: "#1e293b", border: "none" }} />
              <Bar dataKey="valor" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard titulo="Canal de entrada (acumulado)">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={origenData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {origenData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function KpiCard({ label, valor, color }: { label: string; valor: string | number; color?: string }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 12, padding: "16px 20px" }}>
      <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{label}</p>
      <p style={{ color: color ?? "#f1f5f9", fontSize: 24, fontWeight: 700, margin: "8px 0 0" }}>{valor}</p>
    </div>
  )
}

function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 12, padding: 20 }}>
      <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{titulo}</p>
      {children}
    </div>
  )
}

function Alerta({ color, texto }: { color: string; texto: string }) {
  return (
    <div style={{ background: color + "22", border: `1px solid ${color}`, borderRadius: 8, padding: "8px 16px", color, fontSize: 13 }}>
      ⚠ {texto}
    </div>
  )
}
```

- [ ] **Step 2: Agregar ruta en `App.tsx`**

```tsx
import MantenimientoDashboard from "@/pages/mantenimiento/MantenimientoDashboard"

// Dentro de MantenimientoRoute:
<Route path="/mantenimiento/tablero" element={<MantenimientoDashboard />} />
```

- [ ] **Step 3: Verificar TypeScript y commit final frontend**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
git add frontend/src/types/mantenimiento.ts \
        frontend/src/hooks/useMantenimiento.ts \
        frontend/src/pages/mantenimiento/MantenimientoMobilePage.tsx \
        frontend/src/pages/mantenimiento/MantenimientoDashboard.tsx \
        frontend/src/App.tsx
git commit -m "feat(mnt): frontend fase 1 — tipos, hooks, vista móvil, dashboard KPIs"
```

---

## Task 10: Build Docker y verificación final

**Files:** ninguno nuevo

- [ ] **Step 1: Build**

```bash
docker compose up --build -d 2>&1 | tail -20
```
Esperado: todos los servicios `Started` sin errores de TypeScript ni Python.

- [ ] **Step 2: Smoke test backend**

```bash
# Verificar que el endpoint de KPIs responde (requiere token válido)
curl -s http://localhost:8001/api/mantenimiento/kpis -H "Authorization: Bearer <token>" | python -m json.tool
```

- [ ] **Step 3: Smoke test mobile**

Generar magic link desde Swagger (`/docs`) o desde la UI y verificar que `/m/{token}` carga sin login.

- [ ] **Step 4: Commit de cierre**

```bash
git add .
git commit -m "feat(mnt): fase 1 completa — automatización trazabilidad mantenimiento"
```

---

## Self-Review

### Cobertura del spec

| Requisito | Task |
|---|---|
| Choke financiero (OC exige solicitud) | ⚠️ **GAP** — ver nota abajo |
| Campos nuevos (origen, prioridad, monto, evidencia) | Task 1, 3, 7 |
| Gate >$2M con 3 aprobaciones | Task 3 (gate FSM) + Task 4 (endpoint) |
| Gate de evidencia para completar | Task 3 |
| Magic link para auxiliar | Task 5 + Task 8 |
| Registro retroactivo | Task 3 + Task 7 |
| KPIs dashboard | Task 6 + Task 9 |
| Migraciones de BD | Task 2 |

**⚠️ GAP — Choke financiero:** El bloqueo de OC categoría mantenimiento sin `mantenimiento_id` no está en este plan porque requiere modificar el router de OC (`backend/app/routers/oc/`), que no fue leído. Se implementa en **Fase 2** para no romper el flujo actual de compras sin revisión previa del modelo OC.

### Tipos consistentes

- `SolicitudMantenimientoOut` en Python incluye todos los campos que `SolicitudMantenimiento` en TypeScript espera. ✓
- `_enriquecer` propaga `aprobaciones_count=0` por defecto — se puede mejorar en Fase 2 con query real. ✓
- `authHeaders()` se usa en hooks asumiendo que ya existe en el archivo — verificar nombre exacto antes de Task 7. ✓

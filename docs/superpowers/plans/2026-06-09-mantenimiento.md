# Módulo de Mantenimiento — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo de Solicitudes de Mantenimiento con tabla propia, flujo de estados independiente, rol `auxiliar_mantenimiento`, y portal "Mini Compras" para vincular OCs desde el detalle.

**Architecture:** Nueva tabla `SolicitudMantenimiento` en `oc.db` (mismo SQLite que OC para FK nativo). Router FastAPI en `/api/mantenimiento/`. Frontend: 3 páginas (lista, formulario, detalle) + hooks TanStack Query + permisos en `permissions.ts`.

**Tech Stack:** Python/FastAPI/SQLModel (backend), React 19/TypeScript/TanStack Query/TailwindCSS/shadcn (frontend), SQLite vía `get_oc_db()`, DM Sans + DM Mono.

---

## Mapa de archivos

### Crear
```
backend/app/models/mantenimiento.py
backend/app/routers/mantenimiento/__init__.py
backend/app/routers/mantenimiento/router.py
backend/app/routers/mantenimiento/solicitudes.py
backend/app/routers/mantenimiento/config.py
backend/app/routers/mantenimiento/oc_vinculada.py
frontend/src/types/mantenimiento.ts
frontend/src/hooks/useMantenimiento.ts
frontend/src/pages/mantenimiento/MantenimientoPage.tsx
frontend/src/pages/mantenimiento/NuevaMantenimientoPage.tsx
frontend/src/pages/mantenimiento/MantenimientoDetallePage.tsx
frontend/src/components/mantenimiento/EstadoMantenimientoBadge.tsx
frontend/src/components/mantenimiento/CrearOCVinculadaModal.tsx
```

### Modificar
```
backend/app/oc_database.py               — registrar tablas mantenimiento + migraciones
backend/app/models/oc.py                 — agregar mantenimiento_id + deprecar campos legacy + fix mutable default
backend/app/main.py                      — agregar rol auxiliar_mantenimiento + importar router
backend/app/core/deps.py                 — agregar require_mantenimiento
frontend/src/lib/permissions.ts          — canSeeMantenimiento + canManageMantenimiento
frontend/src/App.tsx                     — rutas /mantenimiento/*
frontend/src/components/layout/Sidebar.tsx — entrada Mantenimiento en nav
frontend/src/hooks/useOC.ts              — fix query key collision (DEUDA TÉCNICA HIGH)
backend/app/routers/oc/webhook.py        — print → log (DEUDA TÉCNICA HIGH)
frontend/src/types/oc.ts                 — @deprecated en campos mantenimiento
frontend/src/pages/operativo/NuevaSolicitudPage.tsx — alert → setError, fix useEffect deps
backend/app/models/oc.py                 — fix mutable default []
```

---

## Task 0: Deuda técnica HIGH del módulo OC (hacer PRIMERO)

Resolver antes de tocar cualquier archivo compartido.

**Files:**
- Modify: `frontend/src/hooks/useOC.ts:27-35`
- Modify: `backend/app/routers/oc/webhook.py:135`
- Modify: `backend/app/models/oc.py:207`
- Modify: `frontend/src/pages/operativo/NuevaSolicitudPage.tsx`

- [ ] **Step 1: Fix duplicate query key en useOC.ts**

En `frontend/src/hooks/useOC.ts`, línea 27, cambiar el queryKey de `usePlataformasOC`:

```typescript
// ANTES (línea 27-35):
export function usePlataformasOC() {
  return useQuery({
    queryKey: ["oc", "plataformas"],
```

```typescript
// DESPUÉS:
export function usePlataformasOC() {
  return useQuery({
    queryKey: ["oc", "plataformas-filtro"],
```

Buscar también la segunda ocurrencia del mismo key (cerca de línea 875) y cambiarla a `["oc", "plataformas-config"]`. Hacer grep primero:
```bash
grep -n '"plataformas"' frontend/src/hooks/useOC.ts
```

- [ ] **Step 2: Reemplazar `print` con logger en webhook.py**

En `backend/app/routers/oc/webhook.py`, agregar logger al inicio del archivo (después de los imports):

```python
import logging

log = logging.getLogger(__name__)
```

Luego buscar y reemplazar la línea con `print(f"[webhook]`:
```bash
grep -n "print(" backend/app/routers/oc/webhook.py
```

Cambiar cada `print(...)` por `log.info(...)` o `log.warning(...)` según corresponda.

- [ ] **Step 3: Fix mutable default en oc.py**

En `backend/app/models/oc.py`, buscar la clase `PaqueteSolicitud` y el campo `items`:

```bash
grep -n "default=\[\]" backend/app/models/oc.py
```

Cambiar:
```python
# ANTES:
items: list = Field(default=[], sa_column=Column(JSON))
```
```python
# DESPUÉS:
items: list = Field(default_factory=list, sa_column=Column(JSON))
```

- [ ] **Step 4: Fix alert() en NuevaSolicitudPage.tsx**

```bash
grep -n "alert(" frontend/src/pages/operativo/NuevaSolicitudPage.tsx
```

Reemplazar el `alert(...)` con `setError(...)` usando el estado de error existente en el componente.

- [ ] **Step 5: Fix useEffect deps en NuevaSolicitudPage.tsx**

```bash
grep -n "sedesOc" frontend/src/pages/operativo/NuevaSolicitudPage.tsx
```

En el `useEffect` que pre-llena el paquete (línea ~139), remover `sedesOc` del array de dependencias si está presente y no se usa dentro del efecto.

- [ ] **Step 6: Agregar @deprecated en tipos OC**

En `frontend/src/types/oc.ts`, añadir comentarios JSDoc sobre los campos que migrarán:

```typescript
// En la interfaz SolicitudOC:
  /**
   * @deprecated Será eliminado cuando se complete la migración al módulo de Mantenimiento.
   * Estos datos ahora viven en SolicitudMantenimiento.
   */
  tipo_solicitud: "compra" | "mantenimiento"
  /** @deprecated Ver SolicitudMantenimiento.clasificacion */
  tipo_mantenimiento: "correctivo" | "preventivo" | null
  /** @deprecated Ver SolicitudMantenimiento.fecha_proxima_mantenimiento */
  fecha_proximo_mantenimiento: string | null
```

- [ ] **Step 7: Commit deuda técnica**

```bash
git add frontend/src/hooks/useOC.ts \
        backend/app/routers/oc/webhook.py \
        backend/app/models/oc.py \
        frontend/src/types/oc.ts \
        frontend/src/pages/operativo/NuevaSolicitudPage.tsx
git commit -m "fix(oc): resolver deuda técnica HIGH — query key collision, print→log, mutable default, alert→setError"
```

---

## Task 1: Modelos Python del módulo Mantenimiento

**Files:**
- Create: `backend/app/models/mantenimiento.py`
- Modify: `backend/app/models/oc.py`

- [ ] **Step 1: Crear `backend/app/models/mantenimiento.py`**

```python
import logging
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel

log = logging.getLogger(__name__)


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


class SolicitudMantenimiento(SQLModel, table=True):
    __tablename__ = "mnt_solicitudes"

    id:          Optional[int] = Field(default=None, primary_key=True)
    consecutivo: str = Field(max_length=30, unique=True)

    titulo:      str = Field(max_length=300)
    descripcion: str

    # Tipo configurable (nombre del tipo, referencia al nombre en mnt_tipos_config)
    tipo_mantenimiento: str = Field(max_length=100)

    clasificacion: str = Field(max_length=20)   # ClasificacionMantenimiento
    modalidad:     str = Field(max_length=20)   # ModalidadMantenimiento

    # Solo cuando clasificacion = "preventivo"
    fecha_proxima_mantenimiento: Optional[date] = Field(default=None)

    estado:          str = Field(default=EstadoMantenimiento.solicitud, max_length=30)
    fecha_programada: Optional[datetime] = Field(default=None)
    notas_evaluacion: Optional[str] = Field(default=None)

    # IDs de usuarios (tabla principal app.db — se resuelven via JOIN en la capa de respuesta)
    solicitante_id: int
    asignado_id:    Optional[int] = Field(default=None)

    # empresa_id para multi-tenant
    empresa_nombre: Optional[str] = Field(default=None, max_length=100)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TipoMantenimientoConfig(SQLModel, table=True):
    __tablename__ = "mnt_tipos_config"

    id:     Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100)
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
```

- [ ] **Step 2: Agregar `mantenimiento_id` a `SolicitudOC` en `backend/app/models/oc.py`**

Abrir `backend/app/models/oc.py` y agregar el campo después de `archivada`:

```python
    # Vínculo opcional con el módulo de Mantenimiento
    # Si esta OC fue generada desde una solicitud de mantenimiento, este campo la referencia.
    mantenimiento_id: Optional[int] = Field(default=None, index=True)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/mantenimiento.py backend/app/models/oc.py
git commit -m "feat(mantenimiento): modelos SolicitudMantenimiento, TipoMantenimientoConfig, HistorialMantenimiento"
```

---

## Task 2: Registro de tablas y migraciones en oc_database.py

Las tablas de mantenimiento viven en `oc.db` para que el FK con `oc_solicitudes` funcione.

**Files:**
- Modify: `backend/app/oc_database.py`

- [ ] **Step 1: Actualizar `create_oc_tables()` para incluir tablas mantenimiento**

En `backend/app/oc_database.py`, al inicio de `create_oc_tables()`, agregar las importaciones y las tablas:

```python
def create_oc_tables() -> None:
    """Crea solo las tablas del módulo OC en oc.db."""
    from app.models.oc import SolicitudOC, CotizacionProveedor, OrdenCompra, Proveedor, OcConfig, HistorialEstado, PaqueteSolicitud  # noqa: F401
    from app.models.mantenimiento import SolicitudMantenimiento, TipoMantenimientoConfig, HistorialMantenimiento  # noqa: F401

    oc_table_names = {
        "oc_solicitudes", "oc_cotizaciones", "oc_ordenes", "oc_proveedores",
        "oc_config", "oc_historial_estados", "oc_paquetes",
        "mnt_solicitudes", "mnt_tipos_config", "mnt_historial",
    }
    # ... resto del código igual
```

- [ ] **Step 2: Agregar migraciones para columnas nuevas en oc_database.py**

Dentro del bloque `with get_oc_engine().connect() as conn:` de `create_oc_tables()`, agregar las migraciones al final antes del `conn.commit()` final:

```python
        # Mantenimiento — vínculo desde OC hacia solicitud de mantenimiento
        try:
            conn.execute(text("ALTER TABLE oc_solicitudes ADD COLUMN mantenimiento_id INTEGER"))
            log.info("[oc_db] Columna oc_solicitudes.mantenimiento_id agregada.")
        except Exception:
            pass  # columna ya existe

        # Índice de rendimiento para mantenimiento_id
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_oc_solicitudes_mantenimiento_id "
            "ON oc_solicitudes(mantenimiento_id)"
        ))
```

También agregar `import logging` y `log = logging.getLogger(__name__)` al inicio del archivo, y reemplazar el `print("[oc] Tablas OC verificadas en oc.db.")` por `log.info(...)`.

- [ ] **Step 3: Verificar que las tablas se crean correctamente**

En el servidor de desarrollo (o localmente si tienes acceso):
```bash
docker compose exec backend python -c "
from app.oc_database import create_oc_tables
create_oc_tables()
print('OK')
"
```
Expected output: `OK` (sin errores)

- [ ] **Step 4: Commit**

```bash
git add backend/app/oc_database.py
git commit -m "feat(mantenimiento): registrar tablas mnt_* en oc.db + migración mantenimiento_id en oc_solicitudes"
```

---

## Task 3: Rol y permisos

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/core/deps.py`
- Modify: `frontend/src/lib/permissions.ts`

- [ ] **Step 1: Agregar rol `auxiliar_mantenimiento` en `main.py`**

En `backend/app/main.py`, dentro de `_DEFAULT_ROLES`, agregar después del rol `compras`:

```python
    {
        "name": "auxiliar_mantenimiento",
        "label": "Auxiliar de Mantenimiento",
        "description": "Gestión de solicitudes de mantenimiento — sin acceso al módulo OC/Compras",
        "app_permissions": ["mod_mantenimiento"],
    },
```

- [ ] **Step 2: Agregar `require_mantenimiento` en `deps.py`**

En `backend/app/core/deps.py`, al final del archivo junto a los otros atajos semánticos:

```python
require_mantenimiento = require_permission("mod_mantenimiento")
```

- [ ] **Step 3: Agregar funciones de permiso en `permissions.ts`**

En `frontend/src/lib/permissions.ts`, agregar al final del archivo:

```typescript
export function canSeeMantenimiento(
  role: string,
  appPerms?: string[]
): boolean {
  if (role === "admin") return true
  if (role === "directivo") return true
  if (role === "auxiliar_mantenimiento") return true
  return hasPerm(appPerms, "mod_mantenimiento")
}

export function canManageMantenimiento(
  role: string,
  appPerms?: string[]
): boolean {
  if (role === "admin") return true
  if (role === "auxiliar_mantenimiento") return true
  if (hasPerm(appPerms, "mod_mantenimiento")) return true
  return false
}

/** Solo admin y directivo pueden ver todos — auxiliar ve los suyos */
export function canSeeAllMantenimientos(role: string): boolean {
  return role === "admin" || role === "directivo"
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py backend/app/core/deps.py frontend/src/lib/permissions.ts
git commit -m "feat(mantenimiento): rol auxiliar_mantenimiento + permiso mod_mantenimiento + helpers permissions.ts"
```

---

## Task 4: Backend — Router de configuración de tipos

**Files:**
- Create: `backend/app/routers/mantenimiento/__init__.py`
- Create: `backend/app/routers/mantenimiento/config.py`

- [ ] **Step 1: Crear `__init__.py`**

```python
# backend/app/routers/mantenimiento/__init__.py
```
(archivo vacío)

- [ ] **Step 2: Crear `backend/app/routers/mantenimiento/config.py`**

```python
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_oc_config_access
from app.models.mantenimiento import TipoMantenimientoConfig
from app.models.user import User
from app.oc_database import get_oc_db

log = logging.getLogger(__name__)
router = APIRouter(prefix="/config", tags=["Mantenimiento - Config"])


class TipoMantenimientoOut(BaseModel):
    id: int
    nombre: str
    activo: bool
    orden: int


class TipoMantenimientoCreate(BaseModel):
    nombre: str
    orden: int = 0


class TipoMantenimientoUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None
    orden: Optional[int] = None


@router.get("/tipos", response_model=list[TipoMantenimientoOut])
def listar_tipos(
    solo_activos: bool = True,
    db: Session = Depends(get_oc_db),
    _: User = Depends(get_current_user),
):
    """Lista los tipos de mantenimiento configurados. Por defecto solo activos."""
    stmt = select(TipoMantenimientoConfig).order_by(
        TipoMantenimientoConfig.orden, TipoMantenimientoConfig.nombre
    )
    if solo_activos:
        stmt = stmt.where(TipoMantenimientoConfig.activo == True)  # noqa: E712
    return db.exec(stmt).all()


@router.post("/tipos", response_model=TipoMantenimientoOut, status_code=status.HTTP_201_CREATED)
def crear_tipo(
    body: TipoMantenimientoCreate,
    db: Session = Depends(get_oc_db),
    _: User = Depends(require_oc_config_access),
):
    tipo = TipoMantenimientoConfig(nombre=body.nombre.strip(), orden=body.orden)
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    log.info("Tipo de mantenimiento creado: %s", tipo.nombre)
    return tipo


@router.patch("/tipos/{tipo_id}", response_model=TipoMantenimientoOut)
def actualizar_tipo(
    tipo_id: int,
    body: TipoMantenimientoUpdate,
    db: Session = Depends(get_oc_db),
    _: User = Depends(require_oc_config_access),
):
    tipo = db.get(TipoMantenimientoConfig, tipo_id)
    if not tipo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo no encontrado.")
    if body.nombre is not None:
        tipo.nombre = body.nombre.strip()
    if body.activo is not None:
        tipo.activo = body.activo
    if body.orden is not None:
        tipo.orden = body.orden
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    return tipo


@router.delete("/tipos/{tipo_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_tipo(
    tipo_id: int,
    db: Session = Depends(get_oc_db),
    _: User = Depends(require_oc_config_access),
):
    """Soft delete — desactiva el tipo sin borrar historial."""
    tipo = db.get(TipoMantenimientoConfig, tipo_id)
    if not tipo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo no encontrado.")
    tipo.activo = False
    db.add(tipo)
    db.commit()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/mantenimiento/
git commit -m "feat(mantenimiento): router config — CRUD tipos de mantenimiento"
```

---

## Task 5: Backend — Router de solicitudes (CRUD + estados)

**Files:**
- Create: `backend/app/routers/mantenimiento/solicitudes.py`

- [ ] **Step 1: Crear `backend/app/routers/mantenimiento/solicitudes.py`**

```python
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlmodel import Session, func, select

from app.core.deps import get_current_user, require_mantenimiento
from app.database import get_db
from app.models.mantenimiento import (
    ClasificacionMantenimiento,
    EstadoMantenimiento,
    HistorialMantenimiento,
    ModalidadMantenimiento,
    SolicitudMantenimiento,
)
from app.models.user import User
from app.oc_database import get_oc_db

log = logging.getLogger(__name__)
router = APIRouter(prefix="/solicitudes", tags=["Mantenimiento - Solicitudes"])

# ── FSM ───────────────────────────────────────────────────────────────────────

_TRANSICIONES_MANT: dict[str, set[str]] = {
    EstadoMantenimiento.solicitud:  {EstadoMantenimiento.evaluacion, EstadoMantenimiento.cancelado},
    EstadoMantenimiento.evaluacion: {EstadoMantenimiento.programado, EstadoMantenimiento.cancelado},
    EstadoMantenimiento.programado: {EstadoMantenimiento.ejecucion,  EstadoMantenimiento.cancelado},
    EstadoMantenimiento.ejecucion:  {EstadoMantenimiento.completado},
    EstadoMantenimiento.completado: {EstadoMantenimiento.cerrado},
    # cancelado y cerrado son estados terminales — sin transiciones
}

# ── Schemas ───────────────────────────────────────────────────────────────────

class SolicitudMantenimientoCreate(BaseModel):
    titulo:                      str
    descripcion:                 str
    tipo_mantenimiento:          str
    clasificacion:               ClasificacionMantenimiento
    modalidad:                   ModalidadMantenimiento
    fecha_proxima_mantenimiento: Optional[str] = None  # ISO date string "YYYY-MM-DD"

    @field_validator("fecha_proxima_mantenimiento")
    @classmethod
    def validar_fecha_preventivo(cls, v, info):
        clasificacion = info.data.get("clasificacion")
        if clasificacion == ClasificacionMantenimiento.preventivo and not v:
            raise ValueError("fecha_proxima_mantenimiento es requerida para mantenimiento preventivo.")
        if clasificacion == ClasificacionMantenimiento.correctivo:
            return None  # ignorar fecha si es correctivo
        return v


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
    created_at:                  str
    updated_at:                  str


class SolicitudesMantenimientoListResponse(BaseModel):
    items:  list[SolicitudMantenimientoOut]
    total:  int
    page:   int
    pages:  int


class CambiarEstadoBody(BaseModel):
    estado_nuevo: str
    nota:         Optional[str] = None


class AsignarBody(BaseModel):
    asignado_id: Optional[int] = None  # None = desasignar


class ActualizarProgramadoBody(BaseModel):
    fecha_programada:  Optional[str] = None
    notas_evaluacion:  Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generar_consecutivo(db: Session) -> str:
    from datetime import date
    anio = date.today().year
    count = db.exec(
        select(func.count(SolicitudMantenimiento.id)).where(
            SolicitudMantenimiento.consecutivo.startswith(f"MNT-{anio}-")
        )
    ).one()
    return f"MNT-{anio}-{count + 1:03d}"


def _enriquecer(sol: SolicitudMantenimiento, users_by_id: dict) -> SolicitudMantenimientoOut:
    sol_user = users_by_id.get(sol.solicitante_id)
    asig_user = users_by_id.get(sol.asignado_id) if sol.asignado_id else None
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
        created_at=sol.created_at.isoformat(),
        updated_at=sol.updated_at.isoformat(),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/crear", status_code=status.HTTP_201_CREATED, response_model=SolicitudMantenimientoOut)
def crear_solicitud(
    body: SolicitudMantenimientoCreate,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type
    consecutivo = _generar_consecutivo(oc_db)

    fecha_proxima = None
    if body.fecha_proxima_mantenimiento:
        fecha_proxima = date_type.fromisoformat(body.fecha_proxima_mantenimiento)

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
    )
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)

    # Registrar historial
    hist = HistorialMantenimiento(
        solicitud_id=sol.id,
        estado_anterior=None,
        estado_nuevo=EstadoMantenimiento.solicitud,
        nota="Solicitud creada",
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name or current_user.email,
    )
    oc_db.add(hist)
    oc_db.commit()

    log.info("Solicitud de mantenimiento creada: %s por usuario %s", consecutivo, current_user.email)
    return _enriquecer(sol, {current_user.id: current_user})


@router.get("/", response_model=SolicitudesMantenimientoListResponse)
def listar_solicitudes(
    estado:        Optional[str] = Query(None),
    clasificacion: Optional[str] = Query(None),
    modalidad:     Optional[str] = Query(None),
    q:             Optional[str] = Query(None),
    page:          int = Query(1, ge=1),
    limit:         int = Query(20, ge=1, le=100),
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.core.permissions import user_has_permission

    stmt = select(SolicitudMantenimiento)

    # Auxiliar solo ve sus propias solicitudes o las asignadas a él
    puede_ver_todos = (
        current_user.role in ("admin", "directivo")
        or user_has_permission(app_db, current_user, "mod_mantenimiento")
    )
    if not puede_ver_todos:
        stmt = stmt.where(
            (SolicitudMantenimiento.solicitante_id == current_user.id)
            | (SolicitudMantenimiento.asignado_id == current_user.id)
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

    # Resolver nombres de usuarios
    user_ids = {s.solicitante_id for s in items} | {s.asignado_id for s in items if s.asignado_id}
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    users_by_id = {u.id: u for u in users}

    import math
    return SolicitudesMantenimientoListResponse(
        items=[_enriquecer(s, users_by_id) for s in items],
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 1,
    )


@router.get("/{solicitud_id}", response_model=SolicitudMantenimientoOut)
def obtener_solicitud(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    # Verificar acceso
    from app.core.permissions import user_has_permission
    puede_ver_todos = current_user.role in ("admin", "directivo") or user_has_permission(app_db, current_user, "mod_mantenimiento")
    if not puede_ver_todos and sol.solicitante_id != current_user.id and sol.asignado_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    user_ids = {sol.solicitante_id}
    if sol.asignado_id:
        user_ids.add(sol.asignado_id)
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    return _enriquecer(sol, {u.id: u for u in users})


@router.patch("/{solicitud_id}/estado", response_model=SolicitudMantenimientoOut)
def cambiar_estado(
    solicitud_id: int,
    body: CambiarEstadoBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(require_mantenimiento),
):
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    transiciones_validas = _TRANSICIONES_MANT.get(sol.estado, set())
    if body.estado_nuevo not in transiciones_validas:
        raise HTTPException(
            status_code=400,
            detail=f"Transición inválida: {sol.estado} → {body.estado_nuevo}. "
                   f"Permitidas: {sorted(transiciones_validas)}",
        )

    estado_anterior = sol.estado
    sol.estado = body.estado_nuevo
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)

    hist = HistorialMantenimiento(
        solicitud_id=sol.id,
        estado_anterior=estado_anterior,
        estado_nuevo=body.estado_nuevo,
        nota=body.nota,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name or current_user.email,
    )
    oc_db.add(hist)
    oc_db.commit()
    oc_db.refresh(sol)

    log.info("Estado %s → %s en solicitud %s por %s", estado_anterior, body.estado_nuevo, sol.consecutivo, current_user.email)

    users_by_id = {current_user.id: current_user}
    if sol.asignado_id and sol.asignado_id != current_user.id:
        asig = app_db.get(User, sol.asignado_id)
        if asig:
            users_by_id[asig.id] = asig
    return _enriquecer(sol, users_by_id)


@router.patch("/{solicitud_id}/asignar", response_model=SolicitudMantenimientoOut)
def asignar_auxiliar(
    solicitud_id: int,
    body: AsignarBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(require_mantenimiento),
):
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


@router.patch("/{solicitud_id}/programar", response_model=SolicitudMantenimientoOut)
def actualizar_programacion(
    solicitud_id: int,
    body: ActualizarProgramadoBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(require_mantenimiento),
):
    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    if body.fecha_programada is not None:
        sol.fecha_programada = datetime.fromisoformat(body.fecha_programada) if body.fecha_programada else None
    if body.notas_evaluacion is not None:
        sol.notas_evaluacion = body.notas_evaluacion
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)
    oc_db.commit()
    oc_db.refresh(sol)

    user_ids = {sol.solicitante_id}
    if sol.asignado_id:
        user_ids.add(sol.asignado_id)
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    return _enriquecer(sol, {u.id: u for u in users})


@router.get("/{solicitud_id}/historial")
def obtener_historial(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    _: User = Depends(get_current_user),
):
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/mantenimiento/solicitudes.py
git commit -m "feat(mantenimiento): router solicitudes — CRUD, FSM de estados, historial"
```

---

## Task 6: Backend — Router OC vinculada

**Files:**
- Create: `backend/app/routers/mantenimiento/oc_vinculada.py`

- [ ] **Step 1: Crear `backend/app/routers/mantenimiento/oc_vinculada.py`**

```python
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_mantenimiento
from app.database import get_db
from app.models.mantenimiento import SolicitudMantenimiento
from app.models.oc import EstadoOC, SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_db

log = logging.getLogger(__name__)
router = APIRouter(tags=["Mantenimiento - OC Vinculada"])


class CrearOCVinculadaBody(BaseModel):
    descripcion:              str
    categoria:                Optional[str] = None
    grupo_articulos:          Optional[str] = None
    nivel_prioridad:          str = "Media"
    sede:                     Optional[str] = None
    observaciones_solicitante: Optional[str] = None


class OCVinculadaOut(BaseModel):
    id:               str
    consecutivo_os:   str
    descripcion:      str
    estado:           str
    nivel_prioridad:  str
    fecha_solicitud:  str


def _generar_consecutivo_oc(db: Session) -> str:
    from datetime import date
    anio = date.today().year
    from sqlmodel import func
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

    oc = SolicitudOC(
        consecutivo_os=consecutivo,
        descripcion=body.descripcion,
        categoria=body.categoria,
        grupo_articulos=body.grupo_articulos,
        cantidad=1,  # Mantenimiento no tiene cantidad
        nivel_prioridad=body.nivel_prioridad,
        solicitante_nombre=current_user.full_name or current_user.email,
        solicitante_email=current_user.email,
        sede=body.sede,
        observaciones_solicitante=body.observaciones_solicitante,
        estado=EstadoOC.nueva,
        mantenimiento_id=solicitud_id,
        tipo_solicitud="compra",  # La OC entra al flujo normal de compras
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/mantenimiento/oc_vinculada.py
git commit -m "feat(mantenimiento): router oc_vinculada — crear y listar OCs desde mantenimiento"
```

---

## Task 7: Backend — Router principal + registro en main.py

**Files:**
- Create: `backend/app/routers/mantenimiento/router.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Crear `backend/app/routers/mantenimiento/router.py`**

```python
from fastapi import APIRouter

from app.routers.mantenimiento import config, solicitudes, oc_vinculada

router = APIRouter(prefix="/api/mantenimiento")

router.include_router(config.router)
router.include_router(solicitudes.router)
router.include_router(oc_vinculada.router)
```

- [ ] **Step 2: Registrar en `main.py`**

En `backend/app/main.py`, agregar la importación junto a los otros routers:

```python
from app.routers.mantenimiento.router import router as mantenimiento_router
```

Y también el modelo para que SQLModel lo registre (junto a los otros `noqa: F401`):

```python
from app.models.mantenimiento import SolicitudMantenimiento, TipoMantenimientoConfig, HistorialMantenimiento  # noqa: F401
```

Luego en `create_app()` o en el bloque de `app.include_router(...)` (buscar donde están los otros include_router calls):

```python
app.include_router(mantenimiento_router)
```

- [ ] **Step 3: Verificar que el servidor arranca**

```bash
docker compose up backend --build 2>&1 | tail -20
```

Expected: `Application startup complete.` sin errores de importación.

- [ ] **Step 4: Verificar endpoints en docs**

Abrir `http://localhost:8001/docs` y confirmar que aparece el grupo "Mantenimiento - Solicitudes", "Mantenimiento - Config", "Mantenimiento - OC Vinculada".

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/mantenimiento/router.py backend/app/main.py
git commit -m "feat(mantenimiento): registrar router /api/mantenimiento + modelos en main.py"
```

---

## Task 8: Frontend — Tipos TypeScript

**Files:**
- Create: `frontend/src/types/mantenimiento.ts`

- [ ] **Step 1: Crear `frontend/src/types/mantenimiento.ts`**

```typescript
// Enums
export type EstadoMantenimiento =
  | "solicitud"
  | "evaluacion"
  | "programado"
  | "ejecucion"
  | "completado"
  | "cerrado"
  | "cancelado"

export type ClasificacionMantenimiento = "preventivo" | "correctivo"
export type ModalidadMantenimiento = "interno" | "externo"

// Modelo principal
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
  id:               string
  consecutivo_os:   string
  descripcion:      string
  estado:           string
  nivel_prioridad:  string
  fecha_solicitud:  string
}

// Payloads
export interface CrearMantenimientoPayload {
  titulo:                      string
  descripcion:                 string
  tipo_mantenimiento:          string
  clasificacion:               ClasificacionMantenimiento
  modalidad:                   ModalidadMantenimiento
  fecha_proxima_mantenimiento: string | null
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

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/mantenimiento.ts
git commit -m "feat(mantenimiento): tipos TypeScript para el módulo"
```

---

## Task 9: Frontend — Hooks TanStack Query

**Files:**
- Create: `frontend/src/hooks/useMantenimiento.ts`

- [ ] **Step 1: Crear `frontend/src/hooks/useMantenimiento.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  CambiarEstadoMantenimientoPayload,
  CrearMantenimientoPayload,
  CrearOCVinculadaPayload,
  HistorialMantenimientoEntrada,
  MantenimientoFilters,
  OCVinculada,
  SolicitudMantenimiento,
  SolicitudesMantenimientoListResponse,
  TipoMantenimientoConfig,
} from "@/types/mantenimiento"

const BASE = "/api/mantenimiento"

// ── Config — tipos de mantenimiento ──────────────────────────────────────────

export function useTiposMantenimiento(soloActivos = true) {
  return useQuery({
    queryKey: ["mantenimiento", "tipos", soloActivos],
    queryFn: async () => {
      const { data } = await api.get<TipoMantenimientoConfig[]>(
        `${BASE}/config/tipos?solo_activos=${soloActivos}`
      )
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useCrearTipoMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { nombre: string; orden?: number }) => {
      const { data } = await api.post<TipoMantenimientoConfig>(
        `${BASE}/config/tipos`,
        payload
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mantenimiento", "tipos"] }),
  })
}

export function useToggleTipoMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { data } = await api.patch<TipoMantenimientoConfig>(
        `${BASE}/config/tipos/${id}`,
        { activo }
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mantenimiento", "tipos"] }),
  })
}

// ── Solicitudes ───────────────────────────────────────────────────────────────

export function useSolicitudesMantenimiento(
  filters: MantenimientoFilters = {},
  page = 1
) {
  return useQuery({
    queryKey: ["mantenimiento", "solicitudes", filters, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", "20")
      if (filters.estado)        params.set("estado", filters.estado)
      if (filters.clasificacion) params.set("clasificacion", filters.clasificacion)
      if (filters.modalidad)     params.set("modalidad", filters.modalidad)
      if (filters.q)             params.set("q", filters.q)
      const { data } = await api.get<SolicitudesMantenimientoListResponse>(
        `${BASE}/solicitudes/?${params}`
      )
      return data
    },
  })
}

export function useSolicitudMantenimiento(id: number | null) {
  return useQuery({
    queryKey: ["mantenimiento", "solicitud", id],
    queryFn: async () => {
      const { data } = await api.get<SolicitudMantenimiento>(
        `${BASE}/solicitudes/${id}`
      )
      return data
    },
    enabled: id !== null,
  })
}

export function useCrearMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CrearMantenimientoPayload) => {
      const { data } = await api.post<SolicitudMantenimiento>(
        `${BASE}/solicitudes/crear`,
        payload
      )
      return data
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitudes"] }),
  })
}

export function useCambiarEstadoMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: CambiarEstadoMantenimientoPayload
    }) => {
      const { data } = await api.patch<SolicitudMantenimiento>(
        `${BASE}/solicitudes/${id}/estado`,
        payload
      )
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] })
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitudes"] })
    },
  })
}

export function useAsignarMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      asignado_id,
    }: {
      id: number
      asignado_id: number | null
    }) => {
      const { data } = await api.patch<SolicitudMantenimiento>(
        `${BASE}/solicitudes/${id}/asignar`,
        { asignado_id }
      )
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] }),
  })
}

export function useProgramarMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      fecha_programada,
      notas_evaluacion,
    }: {
      id: number
      fecha_programada?: string | null
      notas_evaluacion?: string | null
    }) => {
      const { data } = await api.patch<SolicitudMantenimiento>(
        `${BASE}/solicitudes/${id}/programar`,
        { fecha_programada, notas_evaluacion }
      )
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] }),
  })
}

// ── Historial ─────────────────────────────────────────────────────────────────

export function useHistorialMantenimiento(id: number | null) {
  return useQuery({
    queryKey: ["mantenimiento", "historial", id],
    queryFn: async () => {
      const { data } = await api.get<HistorialMantenimientoEntrada[]>(
        `${BASE}/solicitudes/${id}/historial`
      )
      return data
    },
    enabled: id !== null,
  })
}

// ── OC vinculada ──────────────────────────────────────────────────────────────

export function useOCsVinculadas(mantenimientoId: number | null) {
  return useQuery({
    queryKey: ["mantenimiento", "ocs", mantenimientoId],
    queryFn: async () => {
      const { data } = await api.get<OCVinculada[]>(
        `${BASE}/solicitudes/${mantenimientoId}/ocs`
      )
      return data
    },
    enabled: mantenimientoId !== null,
  })
}

export function useCrearOCVinculada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      mantenimientoId,
      payload,
    }: {
      mantenimientoId: number
      payload: CrearOCVinculadaPayload
    }) => {
      const { data } = await api.post<OCVinculada>(
        `${BASE}/solicitudes/${mantenimientoId}/oc-vinculada`,
        payload
      )
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({
        queryKey: ["mantenimiento", "ocs", vars.mantenimientoId],
      }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useMantenimiento.ts
git commit -m "feat(mantenimiento): hooks TanStack Query para todo el módulo"
```

---

## Task 10: Frontend — Componentes de badge y modal OC vinculada

**Files:**
- Create: `frontend/src/components/mantenimiento/EstadoMantenimientoBadge.tsx`
- Create: `frontend/src/components/mantenimiento/CrearOCVinculadaModal.tsx`

- [ ] **Step 1: Crear `frontend/src/components/mantenimiento/EstadoMantenimientoBadge.tsx`**

```tsx
import type { EstadoMantenimiento } from "@/types/mantenimiento"

const ESTADO_CONFIG: Record<
  EstadoMantenimiento,
  { label: string; className: string }
> = {
  solicitud:  { label: "Solicitud",        className: "bg-blue-100 text-blue-700" },
  evaluacion: { label: "Evaluación",       className: "bg-yellow-100 text-yellow-700" },
  programado: { label: "Programado",       className: "bg-indigo-100 text-indigo-700" },
  ejecucion:  { label: "En Ejecución",     className: "bg-orange-100 text-orange-700" },
  completado: { label: "Completado",       className: "bg-green-100 text-green-700" },
  cerrado:    { label: "Cerrado",          className: "bg-muted text-muted-foreground" },
  cancelado:  { label: "Cancelado",        className: "bg-red-100 text-red-700" },
}

interface Props {
  estado: EstadoMantenimiento
  className?: string
}

export function EstadoMantenimientoBadge({ estado, className = "" }: Props) {
  const config = ESTADO_CONFIG[estado] ?? {
    label: estado,
    className: "bg-muted text-muted-foreground",
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  )
}

export function ClasificacionBadge({
  clasificacion,
}: {
  clasificacion: "preventivo" | "correctivo"
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        clasificacion === "preventivo"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {clasificacion === "preventivo" ? "Preventivo" : "Correctivo"}
    </span>
  )
}

export function ModalidadBadge({
  modalidad,
}: {
  modalidad: "interno" | "externo"
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        modalidad === "interno"
          ? "bg-slate-100 text-slate-700"
          : "bg-violet-100 text-violet-700"
      }`}
    >
      {modalidad === "interno" ? "Interno" : "Externo"}
    </span>
  )
}
```

- [ ] **Step 2: Crear `frontend/src/components/mantenimiento/CrearOCVinculadaModal.tsx`**

```tsx
import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCrearOCVinculada } from "@/hooks/useMantenimiento"
import type { SolicitudMantenimiento } from "@/types/mantenimiento"

interface Props {
  open:           boolean
  onClose:        () => void
  mantenimiento:  SolicitudMantenimiento
}

export function CrearOCVinculadaModal({ open, onClose, mantenimiento }: Props) {
  const [descripcion, setDescripcion] = useState(
    `Mantenimiento ${mantenimiento.consecutivo} — ${mantenimiento.titulo}`
  )
  const [categoria, setCategoria]   = useState("")
  const [prioridad, setPrioridad]   = useState("Media")
  const [obs, setObs]               = useState("")
  const [error, setError]           = useState<string | null>(null)

  const { mutateAsync, isPending } = useCrearOCVinculada()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!descripcion.trim()) {
      setError("La descripción es requerida.")
      return
    }
    try {
      await mutateAsync({
        mantenimientoId: mantenimiento.id,
        payload: {
          descripcion: descripcion.trim(),
          categoria: categoria.trim() || undefined,
          nivel_prioridad: prioridad,
          observaciones_solicitante: obs.trim() || undefined,
        },
      })
      onClose()
    } catch {
      setError("Error al crear la solicitud de compra. Intenta de nuevo.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Nueva solicitud de compra
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Vinculada a {mantenimiento.consecutivo}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Descripción *
            </label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Categoría
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej: Repuestos"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Prioridad
              </label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Observaciones
            </label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Contexto adicional para el área de compras..."
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando…" : "Crear solicitud de compra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/mantenimiento/
git commit -m "feat(mantenimiento): EstadoMantenimientoBadge + ClasificacionBadge + ModalidadBadge + CrearOCVinculadaModal"
```

---

## Task 11: Frontend — Rutas y navegación en sidebar

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Agregar rutas en `App.tsx`**

En `frontend/src/App.tsx`, buscar el bloque de rutas privadas (donde están `/oc`, `/operativo`, etc.) y agregar:

```tsx
// Al inicio del archivo, agregar los imports lazy:
const MantenimientoPage       = lazy(() => import("@/pages/mantenimiento/MantenimientoPage"))
const NuevaMantenimientoPage  = lazy(() => import("@/pages/mantenimiento/NuevaMantenimientoPage"))
const MantenimientoDetallePage = lazy(() => import("@/pages/mantenimiento/MantenimientoDetallePage"))
```

Luego en el JSX de rutas, dentro del bloque `<PrivateRoute>`:

```tsx
{/* Módulo de Mantenimiento */}
<Route
  path="/mantenimiento"
  element={
    <PrivateRoute allowedCheck={(u) => canSeeMantenimiento(u.role, u.app_permissions)}>
      <MantenimientoPage />
    </PrivateRoute>
  }
/>
<Route
  path="/mantenimiento/nueva"
  element={
    <PrivateRoute allowedCheck={(u) => canSeeMantenimiento(u.role, u.app_permissions)}>
      <NuevaMantenimientoPage />
    </PrivateRoute>
  }
/>
<Route
  path="/mantenimiento/:id"
  element={
    <PrivateRoute allowedCheck={(u) => canSeeMantenimiento(u.role, u.app_permissions)}>
      <MantenimientoDetallePage />
    </PrivateRoute>
  }
/>
```

Agregar también el import de `canSeeMantenimiento` desde `@/lib/permissions`.

- [ ] **Step 2: Agregar entrada en `Sidebar.tsx`**

En `frontend/src/components/layout/Sidebar.tsx`, buscar el grupo de módulos (donde están OC, SGC, etc.) y agregar:

```tsx
// Import del ícono en la parte superior:
import { Wrench } from "lucide-react"

// Import del helper de permisos:
import { canSeeMantenimiento } from "@/lib/permissions"
```

En el JSX de items del sidebar, dentro del grupo de módulos:

```tsx
{canSeeMantenimiento(user?.role ?? "", user?.app_permissions) && (
  <NavItem
    to="/mantenimiento"
    label="Mantenimiento"
    icon={<Wrench className="w-4 h-4" />}
    active={isActive(["/mantenimiento"])}
  />
)}
```

- [ ] **Step 3: Verificar que el build no da errores**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: sin errores TypeScript (habrá warnings de archivos no creados aún — OK).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(mantenimiento): rutas /mantenimiento/* + entrada en sidebar"
```

---

## Task 12: Frontend — Página de lista `MantenimientoPage`

**Files:**
- Create: `frontend/src/pages/mantenimiento/MantenimientoPage.tsx`

- [ ] **Step 1: Crear `frontend/src/pages/mantenimiento/MantenimientoPage.tsx`**

```tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLayout } from "@/components/layout/PageLayout"
import { EstadoMantenimientoBadge, ClasificacionBadge, ModalidadBadge } from "@/components/mantenimiento/EstadoMantenimientoBadge"
import { useSolicitudesMantenimiento } from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import { canManageMantenimiento } from "@/lib/permissions"
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { MantenimientoFilters } from "@/types/mantenimiento"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

const ESTADOS_FILTER = [
  { value: "", label: "Todos los estados" },
  { value: "solicitud",  label: "Solicitud" },
  { value: "evaluacion", label: "Evaluación" },
  { value: "programado", label: "Programado" },
  { value: "ejecucion",  label: "En Ejecución" },
  { value: "completado", label: "Completado" },
  { value: "cerrado",    label: "Cerrado" },
  { value: "cancelado",  label: "Cancelado" },
]

export default function MantenimientoPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<MantenimientoFilters>({})
  const [search, setSearch] = useState("")

  const activeFilters: MantenimientoFilters = {
    ...filters,
    q: search || undefined,
  }

  const { data, isLoading } = useSolicitudesMantenimiento(activeFilters, page)

  const puedeCrear = canManageMantenimiento(
    user?.role ?? "",
    user?.app_permissions
  )

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
  }

  return (
    <PageLayout title="Mantenimiento">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Solicitudes de Mantenimiento</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data?.total ?? 0} solicitudes en total
            </p>
          </div>
          {puedeCrear && (
            <Button onClick={() => navigate("/mantenimiento/nueva")} className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva solicitud
            </Button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por título o #..."
              className="w-full pl-9 pr-3 h-9 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={filters.estado ?? ""}
            onChange={(e) => { setFilters(f => ({ ...f, estado: e.target.value as any })); setPage(1) }}
          >
            {ESTADOS_FILTER.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={filters.clasificacion ?? ""}
            onChange={(e) => { setFilters(f => ({ ...f, clasificacion: e.target.value as any })); setPage(1) }}
          >
            <option value="">Todas las clasificaciones</option>
            <option value="preventivo">Preventivo</option>
            <option value="correctivo">Correctivo</option>
          </select>

          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={filters.modalidad ?? ""}
            onChange={(e) => { setFilters(f => ({ ...f, modalidad: e.target.value as any })); setPage(1) }}
          >
            <option value="">Todas las modalidades</option>
            <option value="interno">Interno</option>
            <option value="externo">Externo</option>
          </select>
        </div>

        {/* Tabla */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Título</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Clasificación</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Modalidad</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Asignado</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/50">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    Cargando...
                  </td>
                </tr>
              )}
              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    No se encontraron solicitudes.
                  </td>
                </tr>
              )}
              {data?.items.map((sol) => (
                <tr
                  key={sol.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/mantenimiento/${sol.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {sol.consecutivo}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                    {sol.titulo}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{sol.tipo_mantenimiento}</td>
                  <td className="px-4 py-3">
                    <ClasificacionBadge clasificacion={sol.clasificacion} />
                  </td>
                  <td className="px-4 py-3">
                    <ModalidadBadge modalidad={sol.modalidad} />
                  </td>
                  <td className="px-4 py-3">
                    <EstadoMantenimientoBadge estado={sol.estado} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {sol.asignado_nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(sol.created_at), { addSuffix: true, locale: es })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data && data.pages > 1 && (
            <div className="px-4 py-3 border-t border-border">
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)) }}
                  />
                  {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                    <PaginationLink
                      key={p}
                      href="#"
                      isActive={p === page}
                      onClick={(e) => { e.preventDefault(); setPage(p) }}
                    >
                      {p}
                    </PaginationLink>
                  ))}
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.min(data.pages, p + 1)) }}
                  />
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/mantenimiento/MantenimientoPage.tsx
git commit -m "feat(mantenimiento): MantenimientoPage — lista paginada con filtros"
```

---

## Task 13: Frontend — Formulario `NuevaMantenimientoPage`

**Files:**
- Create: `frontend/src/pages/mantenimiento/NuevaMantenimientoPage.tsx`

- [ ] **Step 1: Crear `frontend/src/pages/mantenimiento/NuevaMantenimientoPage.tsx`**

```tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/Combobox"
import { useCrearMantenimiento, useTiposMantenimiento } from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import type { ClasificacionMantenimiento, ModalidadMantenimiento } from "@/types/mantenimiento"
import { format } from "date-fns"

export default function NuevaMantenimientoPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: tipos = [] } = useTiposMantenimiento()
  const { mutateAsync, isPending } = useCrearMantenimiento()

  const [titulo, setTitulo]                     = useState("")
  const [descripcion, setDescripcion]           = useState("")
  const [tipoMantenimiento, setTipoMantenimiento] = useState("")
  const [clasificacion, setClasificacion]       = useState<ClasificacionMantenimiento>("correctivo")
  const [modalidad, setModalidad]               = useState<ModalidadMantenimiento>("interno")
  const [fechaProxima, setFechaProxima]         = useState("")
  const [error, setError]                       = useState<string | null>(null)

  const tiposOptions = tipos.map((t) => ({ value: t.nombre, label: t.nombre }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!titulo.trim())            return setError("El título es requerido.")
    if (!descripcion.trim())       return setError("La descripción es requerida.")
    if (!tipoMantenimiento.trim()) return setError("Selecciona el tipo de mantenimiento.")
    if (clasificacion === "preventivo" && !fechaProxima) {
      return setError("La fecha de próximo mantenimiento es requerida para mantenimiento preventivo.")
    }

    try {
      const sol = await mutateAsync({
        titulo:                      titulo.trim(),
        descripcion:                 descripcion.trim(),
        tipo_mantenimiento:          tipoMantenimiento,
        clasificacion,
        modalidad,
        fecha_proxima_mantenimiento: clasificacion === "preventivo" ? fechaProxima : null,
      })
      navigate(`/mantenimiento/${sol.id}`)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error al crear la solicitud.")
    }
  }

  return (
    <PageLayout title="Nueva solicitud de mantenimiento">
      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

        {/* Solicitante */}
        <section className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Solicitante
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg bg-muted border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Nombre</p>
              <p className="text-sm font-medium text-foreground">{user?.full_name}</p>
            </div>
            <div className="rounded-lg bg-muted border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Área</p>
              <p className="text-sm font-medium text-foreground">{user?.area ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-muted border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Fecha</p>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(), "dd/MM/yyyy")}
              </p>
            </div>
          </div>
        </section>

        {/* Datos del mantenimiento */}
        <section className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Datos del mantenimiento
          </h2>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Título *</label>
            <input
              type="text"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Falla en panel eléctrico galpón 2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descripción *</label>
            <textarea
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el problema o el mantenimiento requerido con el mayor detalle posible..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tipo de mantenimiento *
            </label>
            <Combobox
              options={tiposOptions}
              value={tipoMantenimiento}
              onChange={setTipoMantenimiento}
              placeholder="Seleccionar tipo..."
            />
          </div>

          {/* Preventivo / Correctivo */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Clasificación *
            </label>
            <div className="flex gap-3">
              {(["correctivo", "preventivo"] as ClasificacionMantenimiento[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setClasificacion(c)
                    if (c === "correctivo") setFechaProxima("")
                  }}
                  className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all ${
                    clasificacion === c
                      ? c === "correctivo"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  {c === "correctivo" ? "🔴 Correctivo" : "🟢 Preventivo"}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha próxima — solo visible si preventivo */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              clasificacion === "preventivo" ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <label className="block text-sm font-medium text-foreground mb-1">
              Fecha próximo mantenimiento preventivo *
            </label>
            <input
              type="date"
              className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={fechaProxima}
              onChange={(e) => setFechaProxima(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>

          {/* Interno / Externo */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Modalidad *
            </label>
            <div className="flex gap-3">
              {(["interno", "externo"] as ModalidadMantenimiento[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModalidad(m)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all ${
                    modalidad === m
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  {m === "interno" ? "🏭 Interno" : "🌐 Externo"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/mantenimiento")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Enviando…" : "Crear solicitud"}
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/mantenimiento/NuevaMantenimientoPage.tsx
git commit -m "feat(mantenimiento): NuevaMantenimientoPage — formulario con lógica preventivo/correctivo"
```

---

## Task 14: Frontend — Página de detalle `MantenimientoDetallePage`

**Files:**
- Create: `frontend/src/pages/mantenimiento/MantenimientoDetallePage.tsx`

- [ ] **Step 1: Crear `frontend/src/pages/mantenimiento/MantenimientoDetallePage.tsx`**

```tsx
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  EstadoMantenimientoBadge,
  ClasificacionBadge,
  ModalidadBadge,
} from "@/components/mantenimiento/EstadoMantenimientoBadge"
import { CrearOCVinculadaModal } from "@/components/mantenimiento/CrearOCVinculadaModal"
import {
  useSolicitudMantenimiento,
  useHistorialMantenimiento,
  useOCsVinculadas,
  useCambiarEstadoMantenimiento,
} from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import { canManageMantenimiento } from "@/lib/permissions"
import type { EstadoMantenimiento } from "@/types/mantenimiento"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// Mapa de transiciones para mostrar botones de acción
const SIGUIENTE_ESTADO: Record<string, { label: string; estado: EstadoMantenimiento }> = {
  solicitud:  { label: "Iniciar evaluación", estado: "evaluacion" },
  evaluacion: { label: "Marcar como programado", estado: "programado" },
  programado: { label: "Iniciar ejecución", estado: "ejecucion" },
  ejecucion:  { label: "Marcar como completado", estado: "completado" },
  completado: { label: "Cerrar solicitud", estado: "cerrado" },
}

const TABS = ["Info", "Timeline", "Compras"] as const
type Tab = (typeof TABS)[number]

export default function MantenimientoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const solicitudId = id ? parseInt(id) : null
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [activeTab, setActiveTab] = useState<Tab>("Info")
  const [showCrearOC, setShowCrearOC] = useState(false)

  const { data: sol, isLoading } = useSolicitudMantenimiento(solicitudId)
  const { data: historial = [] } = useHistorialMantenimiento(activeTab === "Timeline" ? solicitudId : null)
  const { data: ocs = [] } = useOCsVinculadas(activeTab === "Compras" ? solicitudId : null)
  const { mutateAsync: cambiarEstado, isPending: cambiandoEstado } = useCambiarEstadoMantenimiento()

  const puedeGestionar = canManageMantenimiento(user?.role ?? "", user?.app_permissions)

  if (isLoading) {
    return (
      <PageLayout title="Mantenimiento">
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Cargando...
        </div>
      </PageLayout>
    )
  }

  if (!sol) {
    return (
      <PageLayout title="Mantenimiento">
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Solicitud no encontrada.
        </div>
      </PageLayout>
    )
  }

  const siguienteAccion = SIGUIENTE_ESTADO[sol.estado]

  async function handleAvanzarEstado() {
    if (!siguienteAccion || !solicitudId) return
    await cambiarEstado({ id: solicitudId, payload: { estado_nuevo: siguienteAccion.estado } })
  }

  async function handleCancelar() {
    if (!solicitudId) return
    await cambiarEstado({
      id: solicitudId,
      payload: { estado_nuevo: "cancelado", nota: "Cancelado manualmente." },
    })
  }

  // Pasos del progress bar
  const PASOS: EstadoMantenimiento[] = [
    "solicitud", "evaluacion", "programado", "ejecucion", "completado", "cerrado",
  ]
  const pasoActualIdx = PASOS.indexOf(sol.estado as EstadoMantenimiento)

  return (
    <PageLayout title={sol.consecutivo}>
      {/* Top bar con breadcrumb */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate("/mantenimiento")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Mantenimientos
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold text-foreground font-mono">{sol.consecutivo}</span>
        <EstadoMantenimientoBadge estado={sol.estado as EstadoMantenimiento} />
      </div>

      {/* Layout principal: sidebar + contenido */}
      <div className="flex gap-0 rounded-xl border border-border bg-card overflow-hidden min-h-[500px]">

        {/* SIDEBAR IZQUIERDO */}
        <div className="w-56 shrink-0 border-r border-border bg-background flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
                  activeTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "Compras" && ocs.length > 0 && (
                  <span className="absolute top-1.5 right-1 w-3.5 h-3.5 bg-primary text-primary-foreground rounded-full text-[9px] flex items-center justify-center">
                    {ocs.length}
                  </span>
                )}
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Contenido del tab */}
          <div className="p-4 overflow-y-auto flex-1">
            {activeTab === "Info" && (
              <div className="space-y-4 text-sm">
                <Field label="Tipo" value={sol.tipo_mantenimiento} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Clasificación</p>
                  <ClasificacionBadge clasificacion={sol.clasificacion} />
                </div>
                {sol.clasificacion === "preventivo" && sol.fecha_proxima_mantenimiento && (
                  <Field
                    label="Próximo mantenimiento"
                    value={format(new Date(sol.fecha_proxima_mantenimiento + "T00:00:00"), "dd/MM/yyyy")}
                  />
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Modalidad</p>
                  <ModalidadBadge modalidad={sol.modalidad} />
                </div>
                <Field label="Solicitado por" value={sol.solicitante_nombre ?? "—"} />
                <Field
                  label="Fecha solicitud"
                  value={format(new Date(sol.created_at), "dd/MM/yyyy", { locale: es })}
                />
                {sol.asignado_nombre && (
                  <Field label="Asignado a" value={sol.asignado_nombre} />
                )}
                {sol.fecha_programada && (
                  <Field
                    label="Programado para"
                    value={format(new Date(sol.fecha_programada), "dd/MM/yyyy HH:mm", { locale: es })}
                  />
                )}
              </div>
            )}

            {activeTab === "Timeline" && (
              <div className="space-y-3">
                {historial.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin actividad registrada.</p>
                )}
                {historial.map((h) => (
                  <div key={h.id} className="text-xs">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-medium text-foreground">{h.usuario_nombre}</span>
                    </div>
                    <p className="text-muted-foreground pl-3">
                      {h.estado_anterior
                        ? `${h.estado_anterior} → ${h.estado_nuevo}`
                        : `Creó la solicitud (${h.estado_nuevo})`}
                    </p>
                    {h.nota && (
                      <p className="text-muted-foreground pl-3 italic">{h.nota}</p>
                    )}
                    <p className="text-muted-foreground/60 pl-3 text-[10px] mt-0.5">
                      {format(new Date(h.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "Compras" && (
              <div className="space-y-3">
                {puedeGestionar && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 text-xs"
                    onClick={() => setShowCrearOC(true)}
                  >
                    <Plus className="w-3 h-3" />
                    Nueva solicitud de compra
                  </Button>
                )}
                {ocs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No hay compras vinculadas a este mantenimiento.
                  </p>
                )}
                {ocs.map((oc) => (
                  <div
                    key={oc.id}
                    className="rounded-lg border border-border bg-muted/40 p-3 text-xs"
                  >
                    <p className="font-mono font-semibold text-foreground">{oc.consecutivo_os}</p>
                    <p className="text-muted-foreground mt-0.5 truncate">{oc.descripcion}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        {oc.estado}
                      </span>
                      <span className="text-muted-foreground/60">{oc.nivel_prioridad}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Descripción */}
          <div className="mb-6">
            <h2 className="text-base font-bold text-foreground mb-1">{sol.titulo}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{sol.descripcion}</p>
          </div>

          {/* Barra de progreso */}
          {sol.estado !== "cancelado" && (
            <div className="mb-8">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Progreso
              </p>
              <div className="flex items-center gap-0">
                {PASOS.map((paso, idx) => {
                  const isPast    = idx < pasoActualIdx
                  const isCurrent = idx === pasoActualIdx
                  const isFuture  = idx > pasoActualIdx
                  return (
                    <div key={paso} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isPast
                              ? "bg-green-500 text-white"
                              : isCurrent
                              ? "bg-orange-400 text-white"
                              : "bg-muted border border-border text-muted-foreground"
                          }`}
                        >
                          {isPast ? "✓" : isCurrent ? "→" : idx + 1}
                        </div>
                        <span
                          className={`text-[9px] font-medium capitalize ${
                            isPast ? "text-green-600" : isCurrent ? "text-orange-500" : "text-muted-foreground"
                          }`}
                        >
                          {paso}
                        </span>
                      </div>
                      {idx < PASOS.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-1 mb-4 ${
                            isPast ? "bg-green-400" : "bg-muted"
                          }`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {sol.estado === "cancelado" && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-800">Solicitud cancelada</p>
            </div>
          )}

          {/* Notas de evaluación */}
          {sol.notas_evaluacion && (
            <div className="mb-6 bg-muted rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Notas de evaluación
              </p>
              <p className="text-sm text-foreground">{sol.notas_evaluacion}</p>
            </div>
          )}

          {/* Acciones */}
          {puedeGestionar && (
            <div className="flex gap-3 flex-wrap">
              {siguienteAccion && sol.estado !== "cancelado" && (
                <Button
                  onClick={handleAvanzarEstado}
                  disabled={cambiandoEstado}
                >
                  {cambiandoEstado ? "Guardando…" : siguienteAccion.label}
                </Button>
              )}
              {["solicitud", "evaluacion", "programado"].includes(sol.estado) && (
                <Button
                  variant="outline"
                  onClick={handleCancelar}
                  disabled={cambiandoEstado}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Cancelar solicitud
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal OC vinculada */}
      {sol && showCrearOC && (
        <CrearOCVinculadaModal
          open={showCrearOC}
          onClose={() => setShowCrearOC(false)}
          mantenimiento={sol}
        />
      )}
    </PageLayout>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-foreground font-medium">{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/mantenimiento/MantenimientoDetallePage.tsx
git commit -m "feat(mantenimiento): MantenimientoDetallePage — sidebar tabs, progreso, acciones, mini compras"
```

---

## Task 15: Frontend — Config de tipos en la página de Config OC

Agregar sección "Tipos de Mantenimiento" en la página de configuración del módulo OC existente.

**Files:**
- Modify: `frontend/src/pages/oc/ConfigPage.tsx` (o donde esté la config de OC — buscar con `grep -r "OcConfig\|configuracion" frontend/src/pages/oc/`)

- [ ] **Step 1: Ubicar la página de config OC**

```bash
grep -rl "config\|Config" frontend/src/pages/oc/ | head -5
```

Leer el archivo encontrado para entender su estructura antes de modificar.

- [ ] **Step 2: Agregar sección "Tipos de Mantenimiento"**

Al final del contenido existente de la página de config, agregar una sección con el mismo patrón de cards que el resto de la configuración:

```tsx
// Imports a agregar:
import {
  useTiposMantenimiento,
  useCrearTipoMantenimiento,
  useToggleTipoMantenimiento,
} from "@/hooks/useMantenimiento"

// JSX a agregar (al final del formulario/secciones existentes):
<section className="bg-card rounded-xl border border-border p-6 space-y-5">
  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
    Tipos de Mantenimiento
  </h2>
  <p className="text-sm text-muted-foreground">
    Lista de tipos disponibles al crear una solicitud de mantenimiento.
  </p>
  <TiposMantenimientoConfig />
</section>
```

Crear el sub-componente inline `TiposMantenimientoConfig`:

```tsx
function TiposMantenimientoConfig() {
  const { data: tipos = [], isLoading } = useTiposMantenimiento(false) // incluir inactivos
  const { mutateAsync: crear, isPending: creando } = useCrearTipoMantenimiento()
  const { mutateAsync: toggle } = useToggleTipoMantenimiento()
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [err, setErr] = useState<string | null>(null)

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!nuevoNombre.trim()) return setErr("El nombre es requerido.")
    try {
      await crear({ nombre: nuevoNombre.trim() })
      setNuevoNombre("")
    } catch {
      setErr("Error al crear el tipo.")
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCrear} className="flex gap-2">
        <input
          type="text"
          className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Nuevo tipo de mantenimiento..."
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={creando}>
          {creando ? "Agregando…" : "Agregar"}
        </Button>
      </form>
      {err && <p className="text-xs text-destructive">{err}</p>}

      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
      <div className="space-y-2">
        {tipos.map((t) => (
          <div
            key={t.id}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
              t.activo ? "border-border bg-background" : "border-border/40 bg-muted/30 opacity-60"
            }`}
          >
            <span className="text-sm text-foreground">{t.nombre}</span>
            <button
              type="button"
              onClick={() => toggle({ id: t.id, activo: !t.activo })}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.activo ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
        {tipos.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">
            No hay tipos configurados aún.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/oc/
git commit -m "feat(mantenimiento): sección tipos de mantenimiento en config OC"
```

---

## Task 16: Build final y verificación

- [ ] **Step 1: Build del frontend**

```bash
cd frontend && npm run build
```

Expected: sin errores TypeScript. Si hay errores, son nombres de props o tipos — corregir directamente.

- [ ] **Step 2: Verificar backend arranca sin errores**

```bash
docker compose up backend --build 2>&1 | grep -E "ERROR|startup complete|Uvicorn"
```

Expected: `Application startup complete.`

- [ ] **Step 3: Verificar tablas en la DB**

```bash
docker compose exec backend python -c "
from app.oc_database import get_oc_engine
from sqlalchemy import text
with get_oc_engine().connect() as c:
    r = c.execute(text(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mnt_%'\"))
    print([row[0] for row in r])
"
```

Expected: `['mnt_solicitudes', 'mnt_tipos_config', 'mnt_historial']`

- [ ] **Step 4: Verificar el nuevo rol en la DB**

```bash
docker compose exec backend python -c "
from app.database import get_engine
from sqlalchemy import text
with get_engine().connect() as c:
    r = c.execute(text(\"SELECT name, label FROM role WHERE name = 'auxiliar_mantenimiento'\"))
    print(r.fetchall())
"
```

Expected: `[('auxiliar_mantenimiento', 'Auxiliar de Mantenimiento')]`

- [ ] **Step 5: Smoke test manual en el navegador**

1. Ir a `https://zymointranet.com/mantenimiento` — debe aparecer la lista (vacía)
2. Ir a `/mantenimiento/nueva` — debe aparecer el formulario
3. Crear una solicitud de prueba con clasificación "Preventivo" — verificar que aparece el calendario
4. Cambiar a "Correctivo" — verificar que el calendario desaparece
5. Guardar — debe redirigir al detalle
6. En el detalle, verificar los 3 tabs: Info / Timeline / Compras
7. Avanzar estado a "Evaluación" — verificar que el progress bar actualiza
8. Ir al tab Compras y crear una OC vinculada

- [ ] **Step 6: Commit final**

```bash
git add .
git commit -m "feat(mantenimiento): módulo completo — backend + frontend + deuda técnica OC resuelta"
```

---

## Checklist de Definición de Done

- [ ] Tabla `mnt_solicitudes` en `oc.db`
- [ ] Tabla `mnt_tipos_config` en `oc.db`
- [ ] Tabla `mnt_historial` en `oc.db`
- [ ] Campo `mantenimiento_id` en `oc_solicitudes`
- [ ] Router `/api/mantenimiento/` funcionando
- [ ] Rol `auxiliar_mantenimiento` en la DB
- [ ] `canSeeMantenimiento` + `canManageMantenimiento` en `permissions.ts`
- [ ] Formulario con lógica Preventivo/Correctivo (calendario condicional animado)
- [ ] Lista con filtros y paginación
- [ ] Detalle con sidebar tabs Info/Timeline/Compras
- [ ] Barra de progreso de estados
- [ ] Modal para crear OC vinculada
- [ ] Tab Compras muestra OCs con estado
- [ ] Entrada en sidebar visible para roles correctos
- [ ] Config de tipos en página OC config
- [ ] Deuda técnica HIGH de OC resuelta
- [ ] Build TypeScript sin errores
- [ ] Sin `console.log`, `print()`, ni `alert()` en código nuevo
- [ ] DM Sans + paleta ZYMO en todos los componentes nuevos

# Plan de implementación — ZYMO Intranet
**Fecha:** 2026-04-26  
**Origen:** Revisión de pruebas + auditoría de seguridad + análisis de roles

---

## Contexto del proyecto

- **Stack:** FastAPI (Python) + React/TypeScript (Vite) + SQLModel + PostgreSQL + Docker Compose
- **Rama:** `master` — despliegue directo en servidor Ubuntu con Docker Compose
- **Módulos afectados:** OC (Compras), Financiero (Contabilidad), Operativo (Solicitudes), Seguridad/Auth

---

## Mapa de dependencias

```
PASO 1 (seguridad crítica, sin migración)
    │
    ├─> PASO 2 (campos solicitud + migración DB)
    │       │
    │       └─> PASO 5 (dropdown placas — BLOQUEADO esperando lista de Sonia)
    │
    ├─> PASO 3 (contabilidad info visible, sin migración)
    │
    ├─> PASO 4 (devolver a compras — requiere nuevos estados, depende de PASO 3)
    │
    └─> PASO 6 (seguridad media + roles, independiente)
```

---

## PASO 1 — Seguridad crítica
**Prioridad:** 🔴 Alta | **Esfuerzo:** Bajo | **Riesgo:** Bajo  
**Sin dependencias — hacer primero**

### Objetivo
Cerrar los vectores de riesgo más graves: credenciales hardcodeadas, webhook abierto, rutas sin protección de rol.

### Cambios

#### 1A — Eliminar `first_admin_password` hardcodeado
**Archivo:** `backend/app/config.py`

- Cambiar `first_admin_password: str = "Admin123*"` para que falle al arrancar si no viene del entorno:
  ```python
  first_admin_password: str = ""  # debe setearse en .env — sin default inseguro
  ```
- Agregar validación en el startup de `main.py`:
  ```python
  if not settings.first_admin_password:
      raise RuntimeError("FIRST_ADMIN_PASSWORD no está configurada en el entorno.")
  ```
- Verificar que `.env.example` tenga `FIRST_ADMIN_PASSWORD=` documentado.

#### 1B — Webhook secret obligatorio en producción
**Archivo:** `backend/app/routers/oc/webhook.py`

- Cambiar `_verify_secret` para que rechace si no hay secret configurado **y** el entorno es producción:
  ```python
  def _verify_secret(x_pa_secret: Optional[str]) -> None:
      secret = settings.oc_webhook_secret
      if not secret:
          if settings.environment == "production":
              raise HTTPException(status_code=401, detail="Webhook secret no configurado.")
          return  # solo en dev acepta sin secret
      if x_pa_secret != secret:
          raise HTTPException(status_code=401, detail="Secret de webhook inválido.")
  ```
- Agregar campo `environment: str = "development"` en `config.py` (de env var).
- Documentar `OC_WEBHOOK_SECRET=` y `ENVIRONMENT=production` en `.env.example`.

#### 1C — Proteger ruta `/gerencial` con `GerencialRoute`
**Archivo:** `frontend/src/App.tsx`

- Crear `GerencialRoute` similar a `OCRoute`, usando `canSeeGerencial(user.role, user.app_permissions)`.
- Reemplazar `<PrivateRoute>` por `<GerencialRoute>` en las 3 rutas del módulo gerencial.

#### 1D — Proteger `GET /roles` con guard de admin
**Archivo:** `backend/app/routers/roles.py`

- Agregar `Depends(require_admin)` al endpoint `GET /roles` (actualmente solo usa `get_current_user`).

#### 1E — Acotar CORS
**Archivo:** `backend/app/main.py`

- Cambiar `allow_methods=["*"]` → `allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]`
- Cambiar `allow_headers=["*"]` → `allow_headers=["Authorization", "Content-Type", "Accept"]`

### Verificación
- [ ] `docker compose up --build` — arranca sin errores
- [ ] `GET /roles` sin token → 401, con token de empleado → 403
- [ ] `/gerencial` con empleado redirige a `/dashboard`
- [ ] Webhook sin secret en prod → 401

---

## PASO 2 — Nuevos campos en Solicitud
**Prioridad:** 🔴 Alta (requerimiento de negocio) | **Esfuerzo:** Medio | **Riesgo:** Bajo  
**Depende de:** Paso 1 (recomendado, no bloqueante)  
**Requiere:** migración de base de datos

### Objetivo
Agregar `tipo_mantenimiento` (correctivo/preventivo) y hacer que `fecha_proximo_mantenimiento` sea editable desde el formulario de nueva solicitud.

### Cambios

#### 2A — Migración de base de datos
**Archivo:** nuevo en `backend/alembic/versions/` (o script SQL si no usan Alembic)

```sql
ALTER TABLE oc_solicitudes 
ADD COLUMN tipo_mantenimiento VARCHAR(20) DEFAULT NULL;
```
> `fecha_proximo_mantenimiento` ya existe en la tabla — solo hay que exponerla en el form.

#### 2B — Modelo SQLModel
**Archivo:** `backend/app/models/oc.py`

Agregar campo entre `placa_ficha` y `fecha_proximo_mantenimiento`:
```python
tipo_mantenimiento: Optional[str] = Field(default=None, max_length=20)
# Valores válidos: "correctivo" | "preventivo" | None
```

#### 2C — DTO de creación y lectura
**Archivo:** `backend/app/routers/oc/solicitudes.py`

- Agregar a `SolicitudInternaCreate`:
  ```python
  tipo_mantenimiento: Optional[Literal["correctivo", "preventivo"]] = None
  fecha_proximo_mantenimiento: Optional[date] = None
  ```
- Agregar al constructor de `SolicitudOC(...)` en `crear_solicitud_interna`:
  ```python
  tipo_mantenimiento=payload.tipo_mantenimiento,
  fecha_proximo_mantenimiento=payload.fecha_proximo_mantenimiento,
  ```
- `SolicitudRead` ya expone `fecha_proximo_mantenimiento` — agregar `tipo_mantenimiento`.
- Agregar `tipo_mantenimiento` al webhook payload `NuevaSolicitudPayload` si PA lo puede enviar.

#### 2D — Formulario frontend `NuevaSolicitudPage`
**Archivo:** `frontend/src/pages/operativo/NuevaSolicitudPage.tsx`

Después del campo "Placa / Ficha":

```tsx
{/* Tipo de mantenimiento */}
<div>
  <label>Tipo de mantenimiento</label>
  <select value={form.tipo_mantenimiento ?? ""} onChange={...}>
    <option value="">— No aplica —</option>
    <option value="correctivo">Correctivo</option>
    <option value="preventivo">Preventivo</option>
  </select>
</div>

{/* Fecha próximo mantenimiento — solo si tipo_mantenimiento está seteado */}
{form.tipo_mantenimiento && (
  <div>
    <label>Fecha próximo mantenimiento (después de esta solicitud)</label>
    <input type="date" value={form.fecha_proximo_mantenimiento ?? ""} onChange={...} />
  </div>
)}
```

- Actualizar `FORM_VACIO` con `tipo_mantenimiento: ""` y `fecha_proximo_mantenimiento: ""`
- Actualizar el tipo `SolicitudInternaCreate` en `frontend/src/types/oc.ts`

#### 2E — Vista detalle (compras y operativo)
- `SolicitudDetallePage`: agregar `tipo_mantenimiento` en `InfoGrid` junto a placa.
- `MiSolicitudDetallePage`: mostrar ambos campos si están presentes.

### Verificación
- [ ] Build sin errores TypeScript ni Python
- [ ] Crear solicitud interna con `tipo_mantenimiento: "correctivo"` → se guarda correctamente
- [ ] Crear sin tipo → queda `null`, form oculta fecha próximo
- [ ] Vista compras muestra los nuevos campos

---

## PASO 3 — Contabilidad: información visible + alerta email
**Prioridad:** 🔴 Alta (requerimiento de negocio) | **Esfuerzo:** Bajo | **Riesgo:** Bajo  
**Depende de:** Paso 1 (recomendado, no bloqueante)  
**Sin migración de BD**

### Objetivo
Que contabilidad vea `forma_pago` y `anticipo` de la cotización aprobada, y recibir email cuando se genera una OC.

### Cambios

#### 3A — Exponer `forma_pago` y `anticipo` en DTO financiero
**Archivo:** `backend/app/routers/financiero/facturas.py`

Agregar al `SolicitudConFacturaRead`:
```python
forma_pago: Optional[str] = None
anticipo: Optional[str] = None
pago_saldo: Optional[str] = None
```
En el query que llena ese DTO, hacer JOIN con `CotizacionProveedor` donde `aprobada = True` para obtener esos campos.

#### 3B — Mostrar en `FacturaDetallePage`
**Archivo:** `frontend/src/pages/financiero/FacturaDetallePage.tsx`

Agregar sección "Condiciones de pago" visible para contabilidad:
```tsx
<Section title="Condiciones de pago (cotización aprobada)">
  <InfoItem label="Forma de pago" value={solicitud.forma_pago} />
  {solicitud.anticipo && (
    <div className="badge-anticipo">⚠️ Esta OC tiene anticipo: {solicitud.anticipo}</div>
  )}
  {solicitud.pago_saldo && <InfoItem label="Pago saldo" value={solicitud.pago_saldo} />}
</Section>
```

#### 3C — Email alerta a contabilidad al generar OC
**Archivo:** `backend/app/services/email_service.py`

Agregar función:
```python
async def send_alerta_contabilidad(solicitud: SolicitudOC, orden: OrdenCompra, cotizacion: CotizacionProveedor) -> None:
    """Notifica a contabilidad que se generó una OC y requiere seguimiento de pago."""
    recipients = [settings.email_contabilidad]  # nueva config en settings
    # Incluir: consecutivo_os, descripción, proveedor, valor total, forma_pago, anticipo, link a OC
```

**Archivo:** `backend/app/config.py`
```python
email_contabilidad: str = ""  # de env var EMAIL_CONTABILIDAD
```

**Archivo:** `backend/app/routers/oc/documentos.py`

Al final de `generar_orden_compra`, disparar en `background_tasks`:
```python
if settings.email_contabilidad:
    background_tasks.add_task(
        email_service.send_alerta_contabilidad, solicitud, orden, cotizacion
    )
```

### Verificación
- [ ] `FacturaDetallePage` muestra forma de pago y badge de anticipo
- [ ] Al generar OC, llega email a la cuenta de contabilidad configurada
- [ ] Sin `EMAIL_CONTABILIDAD` configurado → no falla, solo no envía

---

## PASO 4 — Contabilidad: devolver a compras para corrección
**Prioridad:** 🟡 Media | **Esfuerzo:** Alto | **Riesgo:** Medio  
**Depende de:** Paso 3 (debe estar la UI financiero mejorada primero)

### Objetivo
Permitir que contabilidad devuelva una OC a compras cuando detecta un error en datos de pago/factura, antes de que se cierre el proceso.

### Cambios

#### 4A — Nuevo estado en el flujo
**Archivo:** `backend/app/models/oc.py`

```python
class EstadoOC(str, Enum):
    # ... estados existentes ...
    en_revision_contabilidad = "en_revision_contabilidad"  # NUEVO
```

#### 4B — Transiciones permitidas
**Archivo:** `backend/app/routers/oc/solicitudes.py`

Agregar al mapa de transiciones:
```python
# Compras puede mover a revisión contabilidad desde oc_enviada
EstadoOC.oc_enviada: {EstadoOC.oc_en_plataforma, EstadoOC.en_revision_contabilidad},
# Contabilidad puede devolver a compras o aprobar el ciclo
EstadoOC.en_revision_contabilidad: {EstadoOC.oc_enviada, EstadoOC.cancelada},
```

#### 4C — Endpoint en router financiero
**Archivo:** `backend/app/routers/financiero/facturas.py`

```python
@router.post("/solicitudes/{solicitud_id}/devolver-a-compras")
def devolver_a_compras(
    solicitud_id: uuid.UUID,
    payload: DevolverAComprasPayload,  # motivo: str
    current_user: User = Depends(require_financiero),
    ...
):
    # Cambia estado a en_revision_contabilidad
    # Registra en historial_estados
    # Envía email a compras con el motivo
```

#### 4D — Email a compras al devolver
**Archivo:** `backend/app/services/email_service.py`

```python
async def send_devuelta_a_compras(solicitud, motivo: str) -> None:
    """Notifica a compras que contabilidad devolvió la OC para corrección."""
```

#### 4E — UI en `FacturaDetallePage`
**Archivo:** `frontend/src/pages/financiero/FacturaDetallePage.tsx`

Botón visible cuando la OC está en `oc_enviada`:
```tsx
<button onClick={() => setShowDevolverModal(true)}>
  ↩ Devolver a compras para corrección
</button>
```
Modal con campo de texto "Motivo de devolución *" y botón de confirmación.

#### 4F — Indicador visual en `SolicitudDetallePage`
**Archivo:** `frontend/src/pages/oc/SolicitudDetallePage.tsx`

Agregar estado `en_revision_contabilidad` al `EstadoBadge` y mostrar banner cuando la solicitud está en ese estado, con la observación de contabilidad.

#### 4G — Agregar estado al enum frontend
**Archivo:** `frontend/src/types/oc.ts` (o donde esté el tipo de estado)

Agregar `"en_revision_contabilidad"` al union type y al mapa de labels/colores.

### Verificación
- [ ] Contabilidad puede devolver una OC en estado `oc_enviada`
- [ ] Compras recibe email con el motivo
- [ ] Solicitud aparece con estado "En revisión contabilidad" en el panel de compras
- [ ] Compras puede volver a marcarla como `oc_enviada` después de corregir

---

## PASO 5 — Dropdown placas montacargas
**Prioridad:** 🟡 Media | **Esfuerzo:** Medio | **Estado:** ⏸ BLOQUEADO  
**Bloqueado hasta:** Recibir lista de placas/fichas técnicas de Sonia (Directora)  
**Depende de:** Paso 2 (el campo `placa_ficha` ya debe estar en el formulario)

### Objetivo
Reemplazar el input libre "Placa / Ficha" por un dropdown cargado dinámicamente desde backend.

### Cambios (cuando se desbloquee)

#### 5A — Tabla de equipos/montacargas
**Archivo:** nuevo `backend/app/models/equipos.py`

```python
class Equipo(SQLModel, table=True):
    __tablename__ = "equipos"
    id: int = Field(default=None, primary_key=True)
    codigo: str = Field(max_length=50, unique=True)  # VH-001, MT-003, etc.
    descripcion: str = Field(max_length=200)
    tipo: str = Field(max_length=50)  # montacargas, vehículo, etc.
    activo: bool = Field(default=True)
```

#### 5B — Endpoint de listado
**Archivo:** nuevo `backend/app/routers/equipos.py`

```python
GET /api/equipos  → lista activos (cualquier usuario autenticado)
POST /api/equipos  → solo admin
PATCH /api/equipos/{id}  → solo admin
```

#### 5C — Frontend: cambio de input a select
**Archivo:** `frontend/src/pages/operativo/NuevaSolicitudPage.tsx`

Reemplazar `<input type="text">` de placa_ficha por `<select>` cargado desde hook `useEquipos()`.
Mantener opción "Otro (escribir)" + input libre como fallback.

#### 5D — Carga inicial de datos
Script de migración que inserte todos los equipos de la lista de Sonia.

---

## PASO 6 — Seguridad media + consistencia de roles
**Prioridad:** 🟡 Media | **Esfuerzo:** Medio | **Riesgo:** Bajo  
**Independiente de los demás pasos — puede hacerse en paralelo**

### Objetivo
Cerrar ownership checks en fotos OC, consolidar chequeos de rol duplicados, y proteger endpoints que dependen solo de frontend.

### Cambios

#### 6A — Ownership check en fotos OC
**Archivo:** `backend/app/routers/oc/solicitudes.py`

En `GET /{solicitud_id}/fotos/{filename}` y `POST /{solicitud_id}/fotos`:
```python
# Validar que current_user es solicitante o tiene rol compras
if current_user.email != solicitud.solicitante_email:
    _require_compras_or_raise(current_user)
```

#### 6B — Consolidar chequeos inline en `SolicitudDetallePage`
**Archivo:** `frontend/src/pages/oc/SolicitudDetallePage.tsx`

Reemplazar:
```tsx
// Antes (inline ad-hoc):
const esAprobador = user?.role === "admin" || user?.role === "directivo" || user?.role === "administrativo"
const esAdmin = user?.role === "admin" || user?.role === "administrativo" || user?.role === "directivo"

// Después (usando lib/permissions.ts):
const esAprobador = user ? canApproveOC(user.role, user.app_permissions) : false
const esAdmin = user ? canSeeOC(user.role, user.area, user.app_permissions) : false
```

#### 6C — `app_permissions` en guards backend (inicio de convergencia)
**Archivo:** `backend/app/core/deps.py`

Añadir lookup de `app_permissions` en `require_compras` como vía alternativa:
```python
def require_compras(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    if current_user.role in OC_ROLES or current_user.area == "Compras":
        return current_user
    # fallback: verificar app_permissions en la tabla Role
    role_obj = db.exec(select(Role).where(Role.name == current_user.role)).first()
    if role_obj and "mod_oc_ver" in (role_obj.app_permissions or []):
        return current_user
    raise HTTPException(403, "Sin acceso al módulo OC.")
```
Aplicar el mismo patrón a `require_financiero` y `require_gerencial`.

#### 6D — Consolidar lista de roles OC en un solo lugar
**Archivo:** nuevo `backend/app/core/role_sets.py`

```python
OC_ROLES = frozenset({"admin", "administrativo", "directivo", "compras"})
FINANCIERO_ROLES = frozenset({"admin", "financiero"})
GERENCIAL_ROLES = frozenset({"admin", "gerente"})
SGC_ROLES = frozenset({"admin", "calidad"})
```
Reemplazar todas las definiciones locales en `deps.py`, `solicitudes.py`, `documentos.py`, `cotizaciones.py`, `shared.py`, `sgc/proveedores.py` para importar desde `role_sets`.

### Verificación
- [ ] Empleado no puede descargar fotos de solicitud ajena
- [ ] `canApproveOC` y checks inline en SolicitudDetallePage dan el mismo resultado
- [ ] Agregar rol nuevo en `role_sets.py` lo aplica en todos los guards automáticamente

---

## Orden de ejecución recomendado

```
Semana 1 (esta semana)
├── Paso 1 — Seguridad crítica          [1 sesión, ~2h]
├── Paso 2 — Campos solicitud           [1 sesión, ~3h]
└── Paso 3 — Contabilidad info + email  [1 sesión, ~2h]

Semana 2
├── Paso 4 — Devolver a compras         [2 sesiones, ~5h]
└── Paso 6 — Seguridad media + roles    [1 sesión, ~3h]

Cuando llegue lista de Sonia
└── Paso 5 — Dropdown placas            [1 sesión, ~2h]
```

---

## Definición de Done (por paso)

Un paso está completo cuando:
1. Build pasa (`npm run build` frontend + `python -m pytest` o equivalente backend)
2. No se introdujeron secretos ni credenciales en código
3. Docker Compose arranca sin errores manuales
4. Los endpoints nuevos/modificados tienen guard de autenticación apropiado
5. Cambios de modelo tienen migración documentada

---

## Archivos clave de referencia

| Archivo | Relevancia |
|---------|-----------|
| `backend/app/models/oc.py` | Modelo SolicitudOC, CotizacionProveedor, EstadoOC |
| `backend/app/core/deps.py` | Guards de autenticación/autorización |
| `backend/app/routers/oc/solicitudes.py` | CRUD solicitudes, crear-interna, fotos |
| `backend/app/routers/oc/documentos.py` | Generar OC, marcar enviada |
| `backend/app/routers/financiero/facturas.py` | Módulo contabilidad |
| `backend/app/services/email_service.py` | Todos los envíos de email |
| `backend/app/config.py` | Variables de entorno y secrets |
| `frontend/src/pages/operativo/NuevaSolicitudPage.tsx` | Formulario nueva solicitud |
| `frontend/src/pages/oc/SolicitudDetallePage.tsx` | Vista detalle compras |
| `frontend/src/pages/financiero/FacturaDetallePage.tsx` | Vista detalle contabilidad |
| `frontend/src/lib/permissions.ts` | Funciones de permisos frontend |
| `frontend/src/App.tsx` | Guards de rutas frontend |

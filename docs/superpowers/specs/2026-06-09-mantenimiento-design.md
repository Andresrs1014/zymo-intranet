# Módulo de Mantenimiento — Spec de Diseño
**Fecha:** 2026-06-09
**Autor:** Andres Quintero + Claude
**Estado:** Aprobado para planificación

---

## 1. Contexto y decisiones de diseño

### 1.1 Qué se construye
Un módulo de **Solicitudes de Mantenimiento** completamente independiente del módulo OC/Compras, pero que coexiste en el mismo backend FastAPI y puede generar Solicitudes de Compra vinculadas cuando el mantenimiento lo requiere.

### 1.2 Lo que NO es
- No es una rama de `tipo_solicitud="mantenimiento"` dentro de `SolicitudOC`
- No es un segundo backend
- No tiene los mismos estados ni el mismo flujo que Compras
- No es gestionado por el área de Compras

### 1.3 Relación con el módulo OC existente
Los dos módulos son **independientes pero relacionables**. Un mantenimiento correctivo puede requerir una compra de materiales/insumos. En ese caso:
- El auxiliar de mantenimiento genera una `SolicitudOC` desde el detalle del mantenimiento
- La OC entra al flujo normal de Compras
- El auxiliar solo puede **ver el estado** de esa OC, no gestionarla
- Desde la OC en Compras se puede ver el mantenimiento origen

Vínculo técnico: `SolicitudOC.mantenimiento_id: Optional[int]` FK a `SolicitudMantenimiento.id`.

---

## 2. Arquitectura de datos

### 2.1 Nueva tabla `SolicitudMantenimiento`

```python
class EstadoMantenimiento(str, Enum):
    solicitud   = "solicitud"       # Operativo crea la solicitud
    evaluacion  = "evaluacion"      # Auxiliar revisa técnicamente
    programado  = "programado"      # Fecha agendada
    ejecucion   = "ejecucion"       # Trabajo activo
    completado  = "completado"      # Trabajo finalizado
    cerrado     = "cerrado"         # Registro final

class ClasificacionMantenimiento(str, Enum):
    preventivo  = "preventivo"
    correctivo  = "correctivo"

class ModalidadMantenimiento(str, Enum):
    interno  = "interno"
    externo  = "externo"

class SolicitudMantenimiento(SQLModel, table=True):
    id:                          Optional[int] = Field(default=None, primary_key=True)
    titulo:                      str
    descripcion:                 str
    tipo_mantenimiento:          str           # FK a config — valor de la lista configurable
    clasificacion:               ClasificacionMantenimiento
    modalidad:                   ModalidadMantenimiento
    fecha_proxima_mantenimiento: Optional[date] = None  # Solo si clasificacion=preventivo
    estado:                      str = Field(default=EstadoMantenimiento.solicitud)
    fecha_programada:            Optional[datetime] = None  # Fecha de ejecución programada
    notas_evaluacion:            Optional[str] = None
    solicitante_id:              int = Field(foreign_key="usuario.id")
    asignado_id:                 Optional[int] = Field(default=None, foreign_key="usuario.id")
    empresa_id:                  int = Field(foreign_key="empresa.id")
    created_at:                  datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at:                  datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

**Reglas:**
- `fecha_proxima_mantenimiento` solo aplica si `clasificacion = "preventivo"`. Requerido en ese caso.
- `asignado_id` se asigna al avanzar de `solicitud` → `evaluacion`
- `updated_at` se actualiza automáticamente en cada transición de estado (via `onupdate` trigger o helper de sesión — resolver deuda técnica de OC al mismo tiempo)

### 2.2 Tabla de configuración de tipos

```python
class TipoMantenimientoConfig(SQLModel, table=True):
    id:         Optional[int] = Field(default=None, primary_key=True)
    nombre:     str
    activo:     bool = True
    empresa_id: int = Field(foreign_key="empresa.id")
    orden:      int = 0
```

Esta tabla se alimenta desde la **configuración del módulo OC** (sección nueva "Mantenimiento") — misma pantalla de config que ya existe para Compras.

### 2.3 Vínculo bidireccional con OC

Agregar a `SolicitudOC`:
```python
mantenimiento_id: Optional[int] = Field(default=None, foreign_key="solicitudmantenimiento.id")
```

Esto es opcional — no toda OC proviene de un mantenimiento.

### 2.4 Migración de campos legacy en `SolicitudOC`

Los campos `tipo_solicitud`, `tipo_mantenimiento`, `fecha_proximo_mantenimiento`, `placa_ficha` en `SolicitudOC` deben:
1. Ser anotados con comentarios de deprecación en el código
2. Mantenerse en la DB por compatibilidad con registros históricos
3. No usarse en nuevas solicitudes
4. Ser excluidos de `SolicitudInternaCreate` para nuevas solicitudes

---

## 3. Flujo de estados

```
solicitud → evaluacion → programado → ejecucion → completado → cerrado
```

**Transiciones permitidas:**
```python
_TRANSICIONES_MANT = {
    EstadoMantenimiento.solicitud:  {EstadoMantenimiento.evaluacion,  EstadoMantenimiento.cancelado},
    EstadoMantenimiento.evaluacion: {EstadoMantenimiento.programado,  EstadoMantenimiento.cancelado},
    EstadoMantenimiento.programado: {EstadoMantenimiento.ejecucion,   EstadoMantenimiento.cancelado},
    EstadoMantenimiento.ejecucion:  {EstadoMantenimiento.completado},
    EstadoMantenimiento.completado: {EstadoMantenimiento.cerrado},
    # cancelado y cerrado son estados terminales — sin salida
}
```

El enum `EstadoMantenimiento` incluye `cancelado = "cancelado"` como estado terminal.

**Reglas de negocio:**
- Sin aprobaciones intermedias — el auxiliar avanza libremente
- Al intentar cerrar con OCs vinculadas pendientes → advertencia (no bloqueo)
- Solo `auxiliar_mantenimiento`, `admin`, o `directivo` pueden avanzar estados
- El solicitante original, el auxiliar asignado, `admin` o `directivo` pueden cancelar (hasta estado `programado`)
- Una vez en `ejecucion` no se puede cancelar — solo completar

---

## 4. Roles y permisos

### 4.1 Nuevo rol: `auxiliar_mantenimiento`

| Acción | Puede |
|--------|-------|
| Ver todas las solicitudes de mantenimiento de su empresa | ✅ |
| Crear solicitudes de mantenimiento | ✅ |
| Avanzar estados (evaluacion → cerrado) | ✅ |
| Asignarse una solicitud | ✅ |
| Agregar notas de evaluación | ✅ |
| Generar Solicitud OC vinculada desde el mantenimiento | ✅ |
| Ver estado de OC vinculada (solo lectura) | ✅ |
| Gestionar OCs en el módulo Compras | ❌ |
| Ver el módulo OC/Compras | ❌ |
| Aprobar cualquier cosa | ❌ |

### 4.2 Permisos en `permissions.ts`

Nueva función a agregar:
```typescript
export function canSeeMantenimiento(user): boolean
export function canManageMantenimiento(user): boolean  // auxiliar_mantenimiento + admin + directivo
```

### 4.3 Roles que pueden ver mantenimientos (solo lectura)
- `admin`, `directivo` — visibilidad total
- `auxiliar_mantenimiento` — gestión completa
- El solicitante original — solo sus propias solicitudes

---

## 5. Backend — Endpoints

### Router: `/api/mantenimiento/`

```
POST   /solicitudes/crear              # Crear nueva solicitud
GET    /solicitudes/                   # Listar (paginado, filtros)
GET    /solicitudes/{id}               # Detalle
PATCH  /solicitudes/{id}/estado        # Avanzar estado
PATCH  /solicitudes/{id}/asignar       # Asignar auxiliar
POST   /solicitudes/{id}/oc-vinculada  # Crear OC vinculada (genera SolicitudOC con mantenimiento_id)
GET    /solicitudes/{id}/ocs           # Listar OCs vinculadas con su estado actual

GET    /config/tipos                   # Listar tipos de mantenimiento configurados
POST   /config/tipos                   # Crear tipo (admin)
PATCH  /config/tipos/{id}              # Editar tipo (admin)
DELETE /config/tipos/{id}              # Desactivar tipo (admin, soft delete)
```

### Ubicación en el proyecto
```
backend/app/routers/mantenimiento/
├── __init__.py
├── solicitudes.py     # CRUD + transiciones de estado
├── oc_vinculada.py    # Crear y listar OCs desde mantenimiento
└── config.py          # Tipos de mantenimiento configurables
```

Registrar en `main.py`:
```python
app.include_router(mantenimiento_router, prefix="/api/mantenimiento", tags=["mantenimiento"])
```

---

## 6. Frontend — Estructura de páginas

### 6.1 Rutas nuevas

```
/mantenimiento                    → MantenimientoPage (lista)
/mantenimiento/nueva              → NuevaMantenimientoPage (formulario)
/mantenimiento/:id                → MantenimientoDetallePage (detalle)
```

### 6.2 Acceso en el sidebar

Nueva entrada en el sidebar bajo el grupo de módulos:
```
🔧 Mantenimiento
```
Visible para: `auxiliar_mantenimiento`, `admin`, `directivo`, y el rol solicitante (solo sus solicitudes).

### 6.3 Archivos frontend a crear

```
frontend/src/
├── pages/mantenimiento/
│   ├── MantenimientoPage.tsx           # Lista paginada
│   ├── NuevaMantenimientoPage.tsx      # Formulario de creación
│   └── MantenimientoDetallePage.tsx    # Detalle + sidebar con tabs
├── hooks/
│   └── useMantenimiento.ts             # TanStack Query hooks
└── types/
    └── mantenimiento.ts                # TypeScript types/interfaces
```

---

## 7. Formulario de nueva solicitud (`NuevaMantenimientoPage`)

### 7.1 Campos

| Campo | Tipo | Regla |
|-------|------|-------|
| Título | text input | Requerido |
| Descripción | textarea | Requerido |
| Tipo de mantenimiento | Combobox (lista configurable) | Requerido |
| Clasificación | Toggle Preventivo / Correctivo | Requerido |
| Fecha próximo mantenimiento | date picker (calendario) | Requerido si Preventivo, oculto si Correctivo |
| Modalidad | Toggle Interno / Externo | Requerido |

**Campos eliminados vs. formulario OC:** `cantidad`, `unidad`, `precio_estimado`, `cotización`.

### 7.2 Lógica condicional

```typescript
// Preventivo → mostrar calendario
// Correctivo → ocultar calendario, limpiar fecha si estaba llena
if (clasificacion === "preventivo") {
  showFechaProxima = true
} else {
  showFechaProxima = false
  setFechaProxima(null)
}
```

### 7.3 Sección "Solicitante" (read-only, igual que NuevaSolicitudPage)

```tsx
<section className="bg-card rounded-xl border border-border p-6 space-y-4">
  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Solicitante</h2>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    {/* Nombre, Área, Fecha — read-only blocks */}
  </div>
</section>
```

---

## 8. Página de detalle (`MantenimientoDetallePage`)

### 8.1 Layout general

```
┌─────────────────────────────────────────────────────────┐
│ TopBar: MNT-2026-042  [EN EJECUCIÓN badge]  Juan García │
├──────────────────┬──────────────────────────────────────┤
│  SIDEBAR (240px) │  CONTENIDO PRINCIPAL                 │
│  ┌────────────┐  │                                      │
│  │Info│TL│OC│ │  │  Descripción                         │
│  └────────────┘  │  Barra de progreso de estados        │
│                  │  (6 pasos visuales)                  │
│  [Tab Info]      │                                      │
│  Tipo            │  Acciones (botones según estado)     │
│  Clasificación   │                                      │
│  Modalidad       │                                      │
│  Solicitado por  │                                      │
│  Fecha solicitud │                                      │
│  Programado para │                                      │
└──────────────────┴──────────────────────────────────────┘
```

### 8.2 Tabs del sidebar

**Tab Info:** Metadata de la solicitud (campos del formulario en modo read-only).

**Tab Timeline:** Log cronológico de cambios de estado y notas del auxiliar. Formato similar al log de actividad de Helix.

**Tab Compras (con badge de conteo):**
- Lista de OCs vinculadas con su estado actual (badge de color del módulo OC)
- Botón "Nueva solicitud de compra" → abre Modal `CrearOCVinculadaModal`
- Si no hay OCs → empty state: "No hay compras vinculadas a este mantenimiento"

### 8.3 Modal `CrearOCVinculadaModal`

Formulario simplificado de OC pre-llenado con:
- Descripción: "Mantenimiento #MNT-2026-042 — [titulo del mantenimiento]" (editable)
- Todos los campos estándar de una solicitud de compra (excepto que el origen ya es conocido)
- Al enviar: crea `SolicitudOC` con `mantenimiento_id = id_del_mantenimiento_actual`

### 8.4 Barra de progreso de estados

6 círculos conectados por líneas. Estados pasados: verde con ✓. Estado actual: naranja con →. Estados futuros: gris con número. Patrón idéntico al mockup validado en brainstorming.

---

## 9. Diseño visual — cumplimiento del design system ZYMO

### 9.1 Fuentes
- Cuerpo: `DM Sans` — no sustituir por Inter, Roboto ni ninguna otra
- Datos/código: `DM Mono`

### 9.2 Paleta de estados para Mantenimiento

| Estado | bg | text |
|--------|----|------|
| solicitud | `bg-blue-100` | `text-blue-700` |
| evaluacion | `bg-yellow-100` | `text-yellow-700` |
| programado | `bg-indigo-100` | `text-indigo-700` |
| ejecucion | `bg-orange-100` | `text-orange-700` |
| completado | `bg-green-100` | `text-green-700` |
| cerrado | `bg-muted` | `text-muted-foreground` |
| cancelado | `bg-red-100` | `text-red-700` |

### 9.3 Badges

- Clasificación Preventivo: `bg-emerald-100 text-emerald-700`
- Clasificación Correctivo: `bg-red-100 text-red-700`
- Modalidad Interno: `bg-slate-100 text-slate-700`
- Modalidad Externo: `bg-violet-100 text-violet-700`

### 9.4 Patrones de componentes a reutilizar (no reinventar)

| Componente | Reutilizar de |
|------------|--------------|
| Card section | `bg-card rounded-xl border border-border p-6` |
| Read-only field block | `bg-muted border border-border px-3 py-2.5` |
| Status badge | mismo patrón de `EstadoBadge` en `SolicitudesPage.tsx` |
| Combobox | `src/components/ui/Combobox.tsx` existente |
| Modal | `Dialog` de shadcn/radix — mismo patrón que OC |
| Botones | `Button` con variantes existentes |
| Paginación | `Pagination` de shadcn existente |

### 9.5 Micro-animaciones requeridas
- Transición de estado: fade + slide del badge de estado
- Aparición del calendario de fecha preventiva: `transition-all duration-200` con `max-height` animado
- Tab activo: transición de borde inferior suave
- Modal de OC vinculada: entrada con `animate-in fade-in slide-in-from-bottom-4`

---

## 10. Deuda técnica del módulo OC a resolver en este sprint

Durante la implementación del módulo de Mantenimiento, resolver en paralelo:

### Crítico antes de tocar archivos compartidos

| Archivo | Problema | Acción |
|---------|---------|--------|
| `useOC.ts:27/875` | Duplicate query key `["oc","plataformas"]` — data corruption bug | Rename a `["oc","plataformas-filtro"]` y `["oc","plataformas-config"]` |
| `webhook.py:135` | `print(...)` en producción | Reemplazar con `log.info(...)`, agregar logger de módulo |

### Alto impacto, resolver al tocar esos archivos

| Archivo | Problema | Acción |
|---------|---------|--------|
| `oc.py:43-49` | Campos mantenimiento en `SolicitudOC` sin tracking | Agregar JSDoc `@deprecated` + comentario migration target |
| `oc.ts:30-32` | Mismos campos en el tipo TS | Agregar `/** @deprecated */` y union types en campos string |
| `NuevaSolicitudPage.tsx:191` | `alert(...)` para validación | Reemplazar con `setError(...)` inline |
| `NuevaSolicitudPage.tsx:139` | `sedesOc` innecesario en deps del useEffect | Remover de la dependencia array |
| `oc.py:207` | `default=[]` mutable en SQLModel | Cambiar a `default_factory=list` |

### Resolver antes de cerrar el sprint (no bloqueante)

| Archivo | Problema | Acción |
|---------|---------|--------|
| `SolicitudDetallePage.tsx:140` | 20 `useState` para corrección directiva | Extraer a `CorreccionDirectivaModal.tsx` |
| `useOC.ts` (951 líneas) | Archivo demasiado grande | Split en `useSolicitudesOC`, `useCotizacionesOC`, `useDocumentosOC`, `useKpisOC` |
| `cotizaciones.py` (1370+ líneas) | Lógica de extracción mezclada en el router | Extraer a `app/services/extraction_engine.py` |
| `kpis.py:356-696` | Función `get_kpis` de 340 líneas | Dividir en helpers `_query_*` |
| `kpis.py:470-497` | `func.julianday` SQLite-specific | Abstraer con comentario `# SQLite-only` + helper abstracto |

---

## 11. Configuración de tipos de mantenimiento

### Dónde vive
En la página de configuración del módulo OC — nueva sección "Tipos de Mantenimiento" al final de la pantalla de configuración existente.

### Comportamiento
- Lista de tipos (texto libre) creados por `admin`
- Soft delete (desactivar, no borrar) para mantener historial
- Orden configurable con drag-and-drop (nice to have, no bloqueante)
- El `Combobox` del formulario solo muestra tipos activos

---

## 12. Lista de mantenimientos (`MantenimientoPage`)

### Filtros
- Por estado (todos / solicitud / evaluacion / programado / ejecucion / completado / cerrado)
- Por clasificación (todos / preventivo / correctivo)
- Por modalidad (todos / interno / externo)
- Por asignado
- Búsqueda por texto

### Columnas de la tabla

| Columna | Contenido |
|---------|-----------|
| # | ID correlativo `MNT-YYYY-NNN` |
| Título | texto |
| Tipo | tipo_mantenimiento |
| Clasificación | badge Preventivo / Correctivo |
| Modalidad | badge Interno / Externo |
| Estado | EstadoBadge de mantenimiento |
| Asignado | avatar + nombre del auxiliar |
| Creado | fecha relativa |

---

## 13. Consecutivo de solicitudes de mantenimiento

Formato: `MNT-YYYY-NNN` (e.g., `MNT-2026-001`)

Implementar en `solicitudes.py` del router de mantenimiento usando el mismo patrón que OC pero en la tabla `SolicitudMantenimiento`. Usar un helper compartido para evitar la duplicación ya identificada en la deuda técnica de OC.

---

## 14. Definición de Done para este módulo

- [ ] Tabla `SolicitudMantenimiento` en DB con migración Alembic
- [ ] Tabla `TipoMantenimientoConfig` con migración Alembic
- [ ] Campo `mantenimiento_id` agregado a `SolicitudOC` con migración
- [ ] Router `/api/mantenimiento/` con todos los endpoints documentados
- [ ] Rol `auxiliar_mantenimiento` registrado en el sistema de permisos
- [ ] Formulario `NuevaMantenimientoPage` con lógica Preventivo/Correctivo
- [ ] Lista `MantenimientoPage` con filtros y paginación
- [ ] Detalle `MantenimientoDetallePage` con sidebar tabs y barra de progreso
- [ ] Tab "Compras" con modal `CrearOCVinculadaModal`
- [ ] Entrada en sidebar visible para roles correctos
- [ ] Config de tipos en la página de configuración OC
- [ ] Deuda técnica HIGH de OC resuelta (query key collision + print → log)
- [ ] Campos legacy de OC anotados como `@deprecated`
- [ ] Todos los componentes nuevos usan DM Sans, paleta ZYMO, badges del design system
- [ ] Build pasa sin errores TypeScript
- [ ] No hay `console.log`, `print()`, ni `alert()` en código nuevo

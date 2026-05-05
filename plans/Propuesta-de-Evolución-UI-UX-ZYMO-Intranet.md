# Propuesta de Evolución UI/UX — ZYMO Intranet

> **Filosofía:** Minimalismo funcional. Cada cambio visual debe mejorar la usabilidad real, no solo la estética. Los cambios se implementan en fases para no romper flujos existentes.

---

## Índice

- [Sistema de diseño existente](#0-sistema-de-diseño-existente--reglas-base)
- [FASE 1 — Panel de IA (PRIORIDAD)](#fase-1--panel-de-ia-prioridad)
- [FASE 2 — Navegación y UX global](#fase-2--navegación-y-ux-global)
- [FASE 3 — Mejoras por página](#fase-3--mejoras-por-página)
- [FASE 4 — Funcionalidades avanzadas](#fase-4--funcionalidades-avanzadas)
- [Reglas transversales](#reglas-transversales)

---

## 0. Sistema de diseño existente — Reglas base

Antes de implementar cualquier cambio es obligatorio respetar y extender lo ya establecido. No reemplazar, extender.

### Colores (tailwind.config.js)
```
brand-blue:   #003087   → color primario, sidebar, headers, botones principales
brand-yellow: #FFD700   → logo ZYMO, acentos
brand-red:    #E31E24   → errores, acciones destructivas
```

### Tipografía
- Fuente: **Barlow** (400, 500, 600, 700) — definida en `index.css`
- No introducir fuentes adicionales sin justificación.

### Patrones de componente consolidados
| Patrón | Clase(s) base |
|---|---|
| Tarjeta | `bg-white rounded-xl border border-gray-100 shadow-sm p-4` |
| Botón primario | `rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105` |
| Botón secundario | `rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50` |
| Input / Select | `rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30` |
| Badge estado | `rounded-full px-2 py-0.5 text-[10px] font-bold uppercase` + color semántico |
| Tab activo | `border-b-2 border-brand-blue text-brand-blue` |
| Tab inactivo | `border-transparent text-gray-500 hover:text-gray-700` |

### Layout de página (estructura fija — no romper)
```tsx
<div className="flex h-screen bg-gray-50">
  <Sidebar />
  <div className="flex flex-1 flex-col overflow-hidden">
    <TopBar title="..." />
    <main className="flex-1 overflow-y-auto px-6 py-8">
      {/* contenido */}
    </main>
  </div>
</div>
```
Cualquier cambio de layout debe respetar esta estructura o migrar TODAS las páginas en una sola tarea.

---

## FASE 1 — Panel de IA (PRIORIDAD)

> Las pantallas de IA son las primeras en implementarse. Esta fase se divide en tres subfases: A (mejoras internas sin refactor de layout), B (persistencia), y C (modo anclado, requiere refactor de layout).

---

### FASE 1A — Mejoras al panel flotante actual (sin refactor de layout)

**Archivos afectados:**
- `frontend/src/components/agent/AgentFloatingWindow.tsx`
- `frontend/src/components/agent/AgentMessageStream.tsx`
- `frontend/src/hooks/useAgent.ts`

**No tocar:** `App.tsx > AgentLayer`, permisos, endpoints backend.

#### 1A.1 — Tamaño y posición responsivos

**Problema actual:** Panel fijo de 380×560 px puede quedar fuera de la pantalla en monitores pequeños o laptops con resolución baja.

**Cambio:**
```tsx
// AgentFloatingWindow.tsx — style del panel expandido
// Antes:
style={{ ...posStyle, width: 380, height: 560 }}

// Después: respetar viewport, máximo de 90vh/90vw
style={{
  ...posStyle,
  width: Math.min(400, window.innerWidth * 0.9),
  height: Math.min(600, window.innerHeight * 0.85),
}}
```

**Regla .cursorrules:** Cambio incremental, retrocompatible. Solo afecta estilos.

#### 1A.2 — Botón "Limpiar conversación"

**Qué hace:** Muestra un botón `×` en el header del panel expandido (solo cuando hay mensajes) que llama `clearMessages()` del hook. Ya existe `clearMessages` en `useAgent.ts` — solo falta exponerlo en la UI.

**Cambio en AgentFloatingWindow.tsx:**
```tsx
// En el header del panel expandido, al lado del botón minimizar:
{messages.length > 1 && (
  <button
    onClick={clearMessages}
    className="text-blue-200 hover:text-white transition-colors shrink-0 text-xs"
    title="Limpiar conversación"
    aria-label="Limpiar conversación"
  >
    Nueva
  </button>
)}
```

**Verificación:** `clearMessages` ya existe en el hook — no requiere cambio de backend.

#### 1A.3 — Prompts sugeridos en estado vacío

**Qué hace:** Cuando no hay mensajes, en lugar del texto genérico "¿En qué te ayudo hoy?", mostrar 2-3 chips clicables con preguntas frecuentes contextuales por tipo de agente.

**Cambio en AgentFloatingWindow.tsx:**
```tsx
const PROMPTS_SUGERIDOS: Record<"administrativo" | "zymo", string[]> = {
  administrativo: [
    "¿Qué solicitudes están pendientes de cotizar?",
    "¿Cómo creo una solicitud de compra?",
    "Estado de la última orden de compra",
  ],
  zymo: [
    "Resumen ejecutivo del mes",
    "¿Cómo van los KPIs de compras?",
    "Alertas de operación actuales",
  ],
}
```
Los chips se renderizan como botones con clase `rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 hover:border-brand-blue/40 transition-colors`. Al hacer clic, llaman `sendMessage(prompt)` directamente.

**Regla .cursorrules:** Sin hardcoding de datos de negocio en strings; estos son prompts de UI, no datos operativos.

#### 1A.4 — Indicador de agente activo en los mensajes

**Problema:** Los mensajes del agente no distinguen visualmente si vienen de "Administrativo" o "ZYMO".

**Cambio en AgentMessageStream.tsx:** Recibir un prop opcional `agenteName` y mostrarlo como etiqueta pequeña encima del primer mensaje de cada respuesta. Solo si `isAgent && isFirst`.

**Cuidado:** No cambiar la interfaz `AgentMessage` existente — hacerlo via prop al componente, no al modelo de datos.

#### 1A.5 — Atajo de teclado `Ctrl+K` (o `Cmd+K`)

**Qué hace:** Abre/cierra el panel del agente desde cualquier página sin tocar el mouse.

**Dónde implementar:** `useEffect` global dentro de `AgentFloatingWindow.tsx`.

```tsx
useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault()
      setExpanded((prev) => !prev)
    }
  }
  document.addEventListener("keydown", onKeyDown)
  return () => document.removeEventListener("keydown", onKeyDown)
}, [])
```

**Cuidado:** Verificar que no colisione con atajos del sistema operativo o del navegador (los navegadores reservan `Ctrl+K` para la barra de direcciones — en la mayoría **no** interfiere dentro de la app, pero hacer prueba en Chrome, Firefox y Edge antes de merge).

**Definición de Done FASE 1A:**
- [ ] Todos los cambios en componentes de agente, sin tocar App.tsx ni páginas
- [ ] Build `npm run build` sin errores ni warnings nuevos
- [ ] Prueba manual: abrir/cerrar con `Ctrl+K`, limpiar conversación, chips sugeridos visibles
- [ ] Panel no sale del viewport en 1280×720
- [ ] Estilos consistentes con los patrones de la Sección 0

---

### FASE 1B — Persistencia de conversación (localStorage)

**Archivos afectados:**
- `frontend/src/hooks/useAgent.ts`

**No requiere cambio de backend.**

#### Qué se persiste

El historial de mensajes del agente se pierde al recargar la página o navegar. Se persiste en `localStorage` bajo la clave `zymo_agent_chat_{agente}`.

**Cambio en useAgent.ts:**
```tsx
// Al cargar: leer mensajes previos
const [messages, setMessages] = useState<AgentMessage[]>(() => {
  try {
    const raw = localStorage.getItem(`zymo_agent_chat_${agente}`)
    if (raw) return JSON.parse(raw) as AgentMessage[]
  } catch { /* silencioso */ }
  return []
})

// Al actualizar mensajes: persistir (excepto si se limpia)
useEffect(() => {
  if (messages.length === 0) {
    localStorage.removeItem(`zymo_agent_chat_${agente}`)
    return
  }
  // Guardar solo los últimos 30 mensajes para no sobrecargar localStorage
  const toSave = messages.slice(-30)
  localStorage.setItem(`zymo_agent_chat_${agente}`, JSON.stringify(toSave))
}, [messages, agente])
```

**Cuidados:**
- Los `timestamp` se serializan como string JSON — al deserializar, reconstruir como `new Date(m.timestamp)`.
- `clearMessages()` también debe llamar `localStorage.removeItem(...)`.
- No persistir `bienvenida` ni `error`.

**Regla .cursorrules:** Sin datos sensibles en localStorage (los mensajes de chat son texto de usuario, no tokens ni credentials — aceptable). Documentar en `docs/` si se considera dato sensible por política interna.

**Definición de Done FASE 1B:**
- [ ] Mensajes sobreviven recarga de página
- [ ] `clearMessages` limpia localStorage también
- [ ] Máximo 30 mensajes guardados
- [ ] Sin errores de tipo (timestamps deserializados correctamente)
- [ ] Build limpio

---

### FASE 1C — Panel anclado (modo "docked") — Refactor de layout

> **Prerequisito:** FASE 1A y 1B completas. Esta subfase requiere refactor de layout en todas las páginas. Planificar como sprint separado.

**Problema actual:** El panel flotante se superpone al contenido. Un panel anclado a la derecha que desplace el contenido es la evolución natural — pero requiere cambiar la estructura de **cada página**.

#### Análisis de impacto

El layout actual está en cada página individualmente:
```tsx
// Cada página tiene esto:
<div className="flex h-screen bg-gray-50">
  <Sidebar />
  <div className="flex flex-1 flex-col overflow-hidden">
    ...
  </div>
</div>
```

Para un panel derecho anclado, el layout de App debe convertirse en la fuente de verdad:

**Estrategia de migración (3 pasos):**

**Paso 1 — Crear `PageLayout` wrapper:**
```tsx
// frontend/src/components/layout/PageLayout.tsx (nuevo archivo)
export function PageLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Paso 2 — Migrar páginas una por una** (tarea separada por módulo):
- `DashboardPage`, `AdminPage`, `RolesPage`, `AreasPage`
- `ExtraccionIAPage`
- Módulo OC: `SolicitudesPage`, `SolicitudDetallePage`, `CotizacionFormPage`, `AprobacionPage`, `KPIPage`, `OcConfigPage`
- Módulo Financiero: `FinancieroPage`, `FacturasPage`, `FacturaDetallePage`, `FinancieroConfigPage`
- Módulo Operativo: `OperativoPage`, `MisSolicitudesPage`, `MiSolicitudDetallePage`, `NuevaSolicitudPage`, `PaquetesPage`
- Módulo SGC: `SGCPage`, `ProveedoresPage`
- `GerencialPage`, `AdministrativoPage`

> Total: ~20 páginas. Migrar en lotes por módulo, con prueba visual después de cada lote.

**Paso 3 — Agregar slot de panel derecho en `PageLayout`:**
```tsx
// Con panel anclado opcional
export function PageLayout({ children, title }: Props) {
  const agentDocked = useAgentStore((s) => s.docked)
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
      {agentDocked && <AgentDockedPanel />}
    </div>
  )
}
```

**`AgentDockedPanel`:** Nuevo componente, ancho fijo de 360px, altura 100%, con la misma UI que el panel expandido actual pero sin el drag ni la lógica de posición absoluta. Reutiliza `useAgent` y `AgentMessageStream` sin duplicar lógica.

**Botón de toggle en `TopBar`:** Ícono de IA en la esquina superior derecha que alterna el estado `docked` del store. Solo visible si el usuario tiene acceso a algún agente.

**Store para estado del panel:**
```tsx
// frontend/src/store/agentPanelStore.ts (nuevo)
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AgentPanelStore {
  docked: boolean
  toggleDocked: () => void
}

export const useAgentPanelStore = create<AgentPanelStore>()(
  persist(
    (set) => ({
      docked: false,
      toggleDocked: () => set((s) => ({ docked: !s.docked })),
    }),
    { name: "zymo_agent_panel" }
  )
)
```

**Compatibilidad:** El componente `AgentFloatingWindow` existente permanece activo mientras el panel no esté en modo `docked`. Cuando `docked = true`, `AgentLayer` en `App.tsx` suprime el floating y el `PageLayout` renderiza el docked. Transición sin ruptura.

**Definición de Done FASE 1C:**
- [ ] `PageLayout` creado y todas las páginas migradas (verificar visual en cada módulo)
- [ ] Panel docked funciona con el mismo hook `useAgent` sin duplicar lógica
- [ ] El floating mode sigue funcionando si `docked = false`
- [ ] Toggle en TopBar visible solo para usuarios con acceso a agentes
- [ ] Build limpio
- [ ] Prueba en viewport 1280×720 y 1920×1080
- [ ] Docker build pasa (`docker compose build frontend`)

---

## FASE 2 — Navegación y UX global

> Implementar solo después de que FASE 1 esté completa y estable.

### 2.1 — Skeleton loaders en tablas y listas pesadas

**Páginas objetivo:** `SolicitudesPage`, `FacturasPage`, `MisSolicitudesPage`, `ExtraccionIAPage` (cola de revisión).

**Patrón de implementación:**
```tsx
// Reemplazar spinners genéricos por skeletons que imitan la forma del contenido
function SkeletonRow() {
  return (
    <div className="flex gap-4 px-4 py-3 border-b border-gray-50 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-24" />
      <div className="h-3 bg-gray-200 rounded flex-1" />
      <div className="h-3 bg-gray-200 rounded w-16" />
    </div>
  )
}
```

**Regla .cursorrules:** Los skeletons deben coincidir con el número de columnas de la tabla real. No usar skeletons genéricos que no representen la estructura del contenido.

**Cuidado de estilos:** `animate-pulse` requiere `@tailwindcss/animations` o está incluido en Tailwind v3 core. Verificar versión (`package.json`) — **ya incluido en Tailwind CSS v3.x**, sin dependencias extra.

### 2.2 — Empty States con identidad de marca

**Páginas objetivo:** `MisSolicitudesPage`, `ExtraccionIAPage` (cola vacía), `FacturasPage`, `ProveedoresPage`.

**Patrón:**
```tsx
function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      {/* Logo ZYMO sutil */}
      <div className="w-12 h-12 rounded-xl bg-brand-blue/8 flex items-center justify-center">
        <span className="text-brand-blue font-bold text-xl">Z</span>
      </div>
      <p className="text-sm text-gray-500 text-center max-w-xs">{message}</p>
      {action}
    </div>
  )
}
```

**Regla .cursorrules:** Componente reutilizable en `components/ui/EmptyState.tsx`. No duplicar en cada página.

### 2.3 — Indicador de autoguardado en formularios largos

**Páginas objetivo:** `CotizacionFormPage.tsx`, `NuevaSolicitudPage.tsx`.

**Qué hace:** Muestra un chip pequeño en la barra superior del formulario que indica el estado del borrador (aprovecha la API `borradores.py` ya implementada).

```tsx
// Chip de estado — solo texto, sin spinner bloqueante
function DraftIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  const labels = {
    idle: null,
    saving: <span className="text-[10px] text-gray-400">Guardando...</span>,
    saved: <span className="text-[10px] text-green-600">Borrador guardado</span>,
    error: <span className="text-[10px] text-red-500">No se pudo guardar</span>,
  }
  return labels[status]
}
```

**Integración:** `useFormDraft` hook existente ya expone estado de guardado. Solo conectar el indicador visual.

---

## FASE 3 — Mejoras por página

> Solo iniciar cuando FASE 1 y 2 estén completas.

### 3.1 — Dashboard "Bento Box"

**Página:** `DashboardPage.tsx`

**Concepto:** Reemplazar la lista plana de módulos por una cuadrícula con tarjetas de diferentes tamaños que priorizan la información más relevante para cada rol.

**Layout con Tailwind grid:**
```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
  {/* Tarjeta principal — ocupa 2 columnas */}
  <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
    {/* KPI principal del módulo del usuario */}
  </div>
  {/* Tarjetas pequeñas */}
  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">...</div>
  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">...</div>
</div>
```

**Regla .cursorrules:** Las tarjetas muestran datos reales del backend. No usar datos hardcodeados como ejemplos en producción. Los módulos que el usuario no puede ver no se renderizan (respetar permisos ya implementados).

**Cuidado:** El `DashboardPage` actual muestra los accesos directos condicionalmente por rol. El Bento Box debe mantener esa lógica de permisos.

### 3.2 — Formularios por pasos (Steppers) en CotizacionFormPage

**Contexto:** `CotizacionFormPage.tsx` ya tiene lógica compleja (extracción IA, tabla de ítems, adjuntos). Un stepper reduce la carga cognitiva.

**Propuesta de pasos:**
1. **Adjuntar cotización** → carga PDF/Excel, extracción IA automática (ya implementado)
2. **Verificar campos** → revisar y completar campos extraídos
3. **Tabla de ítems** → editar líneas de la cotización
4. **Confirmar y guardar** → resumen + envío

**Implementación del stepper:**
```tsx
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => (
        <React.Fragment key={i}>
          <div className={`flex items-center gap-2 ${i <= current ? "text-brand-blue" : "text-gray-300"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2
              ${i < current ? "bg-brand-blue border-brand-blue text-white" :
                i === current ? "border-brand-blue text-brand-blue" :
                "border-gray-200 text-gray-300"}`}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span className="text-xs font-medium hidden sm:inline">{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-2 ${i < current ? "bg-brand-blue" : "bg-gray-200"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
```

**Cuidado:** La extracción IA (fase 1 y 2) ocurre en el primer paso. El estado de `phase2Pending` y `phase2Result` debe mantenerse visible aunque el usuario avance al paso 2. No limpiar estado de extracción al cambiar de paso.

---

## FASE 4 — Funcionalidades avanzadas

> Implementar solo si las fases anteriores están estables. Alta complejidad técnica.

### 4.1 — Paleta de comandos `Ctrl+K` (global)

**Alcance:** Barra de búsqueda global que permite navegar entre módulos, buscar solicitudes por número, o lanzar acciones frecuentes sin usar el ratón.

**Librerías candidatas:** `cmdk` (Command Menu) — muy usada en proyectos con Tailwind/shadcn. Verificar que sea compatible con Vite + React 18 antes de instalar.

**Riesgo:** `Ctrl+K` ya se usa en FASE 1A para el agente. Definir prioridad: si el agente está abierto, `Ctrl+K` lo cierra; si está cerrado, `Ctrl+K` abre la paleta de comandos global. Documentar en código con comentario.

**Implementación mínima viable:**
- Rutas y nombres de módulos hardcodeadas inicialmente (pocas, estables)
- Búsqueda de solicitudes OC: consumir `GET /api/oc/solicitudes?q=...` con debounce
- Sin búsqueda de documentos SGC en MVP (complejidad alta)

**Regla .cursorrules:** No introducir librerías pesadas sin justificación. `cmdk` pesa ~10KB gzip — aceptable. Agregar a `package.json` en un commit separado con comentario de por qué se eligió.

### 4.2 — Vista Kanban para aprobación de OC

**Página:** `AprobacionPage.tsx`

**Columnas:** "Pendiente de revisión" | "En revisión" | "Aprobado" | "Rechazado"

**Librería candidata:** `@dnd-kit/core` — más moderna que `react-beautiful-dnd`, compatible con React 18. O implementar Kanban visual sin drag-and-drop (solo columnas agrupadas) para MVP.

**Cuidado de negocio:** El drag-and-drop cambia el estado de una solicitud. Esta operación debe llamar los endpoints existentes de aprobación/rechazo — no cambiar estado solo en frontend. Si el drag falla en backend, el card debe volver a su columna original (optimistic update con rollback).

---

## Reglas transversales

### Checklist .cursorrules.md por cambio

Antes de hacer PR de cualquier cambio de UI/UX:

| Check | Descripción |
|---|---|
| **Seguridad** | ¿El cambio expone datos sensibles en el DOM o localStorage? |
| **Permisos** | ¿Se respetan los guards de permiso existentes (`canSeeX`, `require_permission`)? |
| **No hardcoding** | ¿Hay strings de negocio, IDs, emails o rutas hardcodeadas que deban ir a config o backend? |
| **Responsabilidad** | ¿Los componentes nuevos tienen una sola responsabilidad? ¿Menores de ~150 líneas? |
| **Docker-ready** | ¿El cambio requiere variables de entorno nuevas? ¿Están en `.env.example`? |
| **Build limpio** | ¿`npm run build` pasa sin errores ni warnings nuevos? |
| **No romper contratos API** | ¿Se modifican tipos `interface` o `schema`? ¿Son retrocompatibles? |
| **Docs actualizados** | Si cambia comportamiento visible (nueva pantalla, nuevo flujo), ¿hay entrada en `docs/`? |

### Cómo no romper estilos existentes

1. **Nunca editar `tailwind.config.js` `colors.brand.*`** sin revisar todas las referencias a `brand-blue`, `brand-yellow`, `brand-red` en el proyecto.
2. **No agregar clases de Tailwind personalizadas en `index.css`** sin documentarlas. Preferir clases utilitarias composables.
3. **Probar en 3 breakpoints:** `sm` (768px), `lg` (1280px), `xl` (1920px).
4. **No cambiar la firma de props de `Sidebar`, `TopBar`, `SidebarLink`** — son usados por todas las páginas.
5. **Al agregar un componente nuevo en `components/ui/`**, verificar que no haya uno similar ya existente (DRY — `EmptyState`, `SkeletonRow`, `StepIndicator`).

### Estrategia de rollback

Cada subfase se hace en una rama separada (`feat/ui-fase-1a`, `feat/ui-fase-1b`, etc.) con PR pequeño. Si una subfase introduce regresiones, se puede revertir el PR sin afectar las demás.

No combinar múltiples subfases en el mismo PR.

### Definición de Done global

Un cambio UI/UX se considera listo si:
1. Build pasa en frontend (`npm run build`)
2. Docker build pasa (`docker compose build frontend`)
3. No hay `alert()` ni `console.log` en código nuevo
4. No se rompieron rutas existentes (verificar manualmente las 5 rutas más usadas)
5. Los permisos se respetan (el cambio es invisible para usuarios sin acceso)
6. El PR es revisado por al menos una persona antes de merge a `master`

---

## Resumen de prioridades

| # | Subfase | Complejidad | Impacto | Prerequisito |
|---|---|---|---|---|
| 1 | **1A** — Mejoras panel flotante | Baja | Alto | Ninguno |
| 2 | **1B** — Persistencia localStorage | Baja | Medio | 1A |
| 3 | **2.2** — Empty States reutilizables | Baja | Medio | 1A |
| 4 | **2.1** — Skeleton loaders | Baja | Medio | Ninguno |
| 5 | **2.3** — Indicador autoguardado | Baja | Bajo | Ninguno |
| 6 | **1C** — Panel anclado (docked) | Alta | Alto | 1A, 1B |
| 7 | **3.1** — Dashboard Bento Box | Media | Medio | 1C |
| 8 | **3.2** — Stepper formularios | Media | Medio | Ninguno |
| 9 | **4.1** — Paleta de comandos | Alta | Medio | 1C |
| 10 | **4.2** — Kanban OC | Alta | Medio | Ninguno |

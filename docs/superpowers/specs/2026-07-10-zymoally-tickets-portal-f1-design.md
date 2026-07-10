# Zymo Ally — Portal de Tickets, Fase 1 (Shell + Tickets)

## Contexto

`zymoally-backend` (Tickets PQR + SAC) ya existe: CRUD completo de tickets, encuestas públicas SAC y config de formularios, todo commiteado (`c99c063`). Falta la UI. Este spec cubre solo **Fase 1** de un roadmap más grande:

1. **F1 — Shell + Tickets** (este documento)
2. F2 — SAC UI (dashboard encuestas, botón enviar encuesta, reporte de visita)
3. F3 — SMTP de toda la intranet (proyecto de infraestructura aparte, no solo Zymo Ally)
4. F4 — Fix de alertas/SLA (motor de regex vs. texto configurable en `ZymoConfigList`, ver memoria `project_zymoally.md`)
5. F5 — Panel de administración de `ZymoConfigList`, coherente y simple (la última fase, después de F4)

Cada fase es su propio spec → plan → implementación. Este documento no cubre F2–F5.

## Decisión de alcance — el ticket es de operación interna, no de cliente final

Los tickets que gestiona este portal son **internos a la operación** (novedades de proceso, faltantes/inconsistencias, mantenimiento de instalaciones, capacitaciones, corrección de procedimientos, OKRs, y también PQR de cliente cuando aplique) — los crea y gestiona el propio equipo (auditor interno, supervisor, analista, coordinador), no el cliente externo. El cliente externo ya tiene su propio canal, separado, vía las encuestas SAC (magic-link, ya construido).

El modelo de datos existente (`ZymoPqrTicket`) ya es genérico: de 19 campos solo 7 son obligatorios (`area`, `areaPrefix`, `date`, `type`, `status`, `priority`, `client`) y el resto ya es opcional. El motor (código auto-generado, `type`/`status`/`priority` como listas configurables vía `ZymoConfigList`, bitácora de `actions`, `evidence` con archivos) sirve tal cual para cualquier categoría de ticket, con un solo ajuste de datos (ver abajo).

## Ubicación en la intranet

- Ítem nuevo en el sidebar general, **justo debajo de "Helix Zymo"**, label **"Zymo Ally · Tickets"**.
- Ruta propia `/zymoally/tickets`, guard `ZymoTicketsRoute` (mismo patrón que `HelixRoute`/`OCRoute` en `App.tsx`).
- Permiso nuevo `mod_tickets`, registrado en `frontend/src/lib/permissions.ts` como `canSeeTickets(role, appPerms)` siguiendo el patrón `hasPerm()` existente (bypass para `role === "admin" | "gerente"`).
- **No** depende de Helix ni vive dentro de su navegación interna — son dominios sin relación, solo comparten posición visual en el sidebar.
- El ítem "Zymo Ally · SAC" se agrega al sidebar cuando arranque F2, no ahora (evita un link muerto sin contenido).

## Stack — el mismo que Gestión de Tareas V2, sin librerías nuevas

Confirmado contra `frontend/package.json`, nada que instalar:

- Tailwind CSS (utilidades, sin CSS-in-JS)
- Radix UI primitives (`@radix-ui/react-dialog`, `-select`, `-tabs`, `-dropdown-menu`, `-tooltip`, `-avatar`, `-collapsible`, `-separator`, `-label`) — componentes viven a mano en `frontend/src/components/ui/`, no hay CLI de shadcn instalado
- `class-variance-authority` + `clsx` + `tailwind-merge` (helper `cn()`)
- `lucide-react` para íconos
- `@dnd-kit/core` + `@dnd-kit/sortable` para el drag & drop del tablero
- **Sin** framer-motion ni librería de animación — decisión explícita: cero fondos/luces/animaciones en esta fase, primero funcionalidad

## Shell y navegación interna

`ZymoTicketsShell.tsx`, clon directo del patrón `TaskShell.tsx` / `TaskSidebar.tsx` / `TaskTopbar.tsx` de tareas-v2 (mismos tokens de color `primary` rojo Zymo, mismo tratamiento de `tareas.css`, sin agregar efectos nuevos). Navegación interna **por vistas**, no por rutas anidadas — mismo patrón que ya usan Helix y tareas-v2:

- **Tablero** — kanban por `status`, drag & drop con `@dnd-kit`, patrón `BoardView`.
- **Lista** — tabla con filtros y semáforos de SLA/prioridad, evidencias, bitácora de acciones, envío WhatsApp/correo. Es el "Informe tickets" del ZymoAlly original, tal cual.
- **Dashboard** — KPIs, consume el backend ya existente `pqrDashboard.ts` (solo falta UI).

Botón **"+ Nuevo ticket"** fijo arriba a la derecha del header de Tablero/Lista (no vive en el sidebar interno — el sidebar es solo navegación, no lleva la acción primaria).

## Overlays — Dialog para crear, Drawer para gestionar

Resuelto por precedente directo en el código existente, no por preferencia nueva:

- **Crear ticket** → `Dialog` (Radix, patrón `TaskDialog.tsx`), un solo formulario largo y fiel al original: tipo → área (prefijo + código auto-preview) → responsables (supervisor/analista/coordinador, opcionales) → cliente/afectado → teléfono/correo → fechas → prioridad/impacto/canal/criterio de gestión → descripción → acción inicial → evidencia.
- **Ver/gestionar un ticket existente** (agregar acción, subir evidencia, cambiar estado) → `Drawer` (`Sheet`, patrón `TaskDrawer.tsx`) con tabs **Detalle / Bitácora / Evidencias** — mapea 1:1 con la gestión del "Informe tickets" original.

Accesibilidad de ambos overlays (focus trap, cierre con Escape, restauración de foco, backdrop) ya viene resuelta por Radix — no hay z-index ni manejo de foco manual que escribir.

## Fix de datos requerido

Migración de una línea en `zymoally-backend/prisma/schema.prisma`: `client String` → `client String?` en `ZymoPqrTicket`. La UI relabela el campo dinámicamente según el `type` elegido (ej. "Cliente" para un PQR de cliente, "Ubicación/activo afectado" para un ticket de mantenimiento) — el mapeo exacto tipo→label se define en el plan de implementación, no aquí.

## Reglas de layout aplicadas (investigación de posicionamiento, sin profundidad/motion)

Aplicado de `C:\Gestion_documental\Skills\mixui\references\research\priority-layout-time-dashboards.md` y `layout-overlay-positioning.md` (fuentes: NN/g, MDN, WAI-ARIA, WCAG use-of-color, Material Design) — **excluida explícitamente la investigación de profundidad/transiciones ambientales**, esa se retoma en una fase posterior si hace falta:

- **Zona de trabajo primaria** = contenido de Tablero/Lista + botón "+ Nuevo ticket", ahí vive la próxima decisión del usuario.
- **Zona de contexto** = topbar (filtros, rango de fechas, búsqueda), no compite visualmente con la acción principal.
- **Zona de navegación** = sidebar interno del shell, más quieto que el cuerpo, solo para "¿dónde estoy / a dónde puedo ir?", nunca lleva la acción primaria.
- **Regla del vestido rojo** (Dashboard, cuando se construya esa pestaña): un solo protagonista visual por vista (ej. el cuello de botella de SLA o "tickets vencidos") en el acento rojo reservado, el resto de KPIs neutrales; el dato crítico también se marca con texto, no solo color (WCAG use-of-color). Media y mediana se muestran juntas cuando aplique. Nada de cada tarjeta con su propio color.

## Fuera de alcance de F1

- Panel de administración de `ZymoConfigList` (F5) — los combos de tipo/área/etc. usan lo ya sembrado por `seed.ts`; no hay UI para editarlos todavía.
- SAC (F2), SMTP intranet-wide (F3), fix de alertas/SLA (F4).
- Cualquier fondo, luz, transición ambiental o animación decorativa — se evalúa en una fase posterior, después de validar funcionalidad.

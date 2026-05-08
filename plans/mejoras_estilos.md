# Plan — Gestión de Tareas (Desarrollo e Innovación)

> **Audiencia:** equipo de desarrollo y agentes IA (Cursor, etc.).  
> **Referencias de UI:** catálogo oficial de componentes [shadcn/ui](https://ui.shadcn.com/docs/components) — este módulo es **piloto de estilos**; la meta a medio plazo es replicar el patrón al resto de la intranet.

---

## 1. Objetivo del producto

1. **Piloto visual:** Para **solo** la herramienta “Gestión de Tareas”, adoptar el sistema de componentes **shadcn/ui** (Radix + Tailwind + tokens en CSS variables), alineado a la documentación de componentes anterior. El resto de la intranet **no** cambia en esta fase.
2. **Organización tipo canvas:** Layout principal con cabecera, área central (filtros + tabla + paginación) y **panel lateral derecho** (agenda/calendario redimensionable), como el prototipo aprobado. El **registro** de tareas (formulario) vive en un **panel/Sheet aparte**, no mezclado con la tabla.
3. **Dos mundos de tarea:**
   - **Tarea de colaborador (actual):** Los campos y reglas que ya usa la intranet (`titulo`, `descripcion_tecnica`, `etiqueta`, `plataforma`, `estado`, fechas/horas, tiempos, etc.) deben seguir siendo visibles y editables según permisos en el **detalle** (Tabs estilo canvas: p. ej. resumen/datos operativos, actividad/historial cuando exista).
   - **Tarea tipo reunión (nuevo flujo desde calendario):** Agendar desde el calendario **no** es lo mismo que el registro cotidiano del colaborador. Es un tipo **especial** pensado para dejar trazabilidad de reunión y, si se marca como terminada, habilitar el cierre con **acta**.

---

## 2. Flujo “Reunión” y acta (visión funcional)

| Etapa | Comportamiento esperado |
|--------|-------------------------|
| Agendar desde calendario | Crea un ítem **tipo reunión** con fecha (y opcionalmente hora/duración), título, y **lista de asistentes** (personas del equipo o catálogo autorizado). Diferenciar en UI y en datos de una tarea “normal”. |
| Durante el ciclo de vida | Misma familia de estados que el resto (`en_progreso`, etc.) o subset acordado; el detalle debe mostrar bloque **Asistentes** y metadatos de reunión. |
| Cierre — “Tarea terminada” (reunión completada) | Al pasar a completada (o acción explícita “Cerrar reunión”), abrir flujo de **acta:** campo de texto libre (“qué se vió” / acuerdos) que luego se podrá **formatear según plantilla** que el negocio definirá (v1: guardar texto + timestamp; v2: generación PDF/Markdown con plantilla). |
| Acta | Persistir: vínculo a la tarea reunión, autor del cierre, fecha, cuerpo del acta, y **snapshot o referencia** a asistentes en el momento del cierre (para que no cambie si el equipo muta después). |

**Nota de implementación:** Esto implica **modelo de datos y API nuevos o extendidos** (campo `tipo` / `kind`, tabla de asistentes o JSON validado, tabla o campo `acta_*`, eventos en historial). No es solo front.

---

## 3. Arquitectura de pantalla: pestañas dentro de Gestión de Tareas

Dentro de la misma ruta/herramienta, usar **Tabs** de shadcn como contenedor de alto nivel:

| Pestaña | Contenido |
|---------|-----------|
| **Tablero** (nombre tentativo: `Operación` / `Tablero`) | Todo lo del canvas: header con acciones (exportar, nueva tarea/reunión, toggle panel), filtros de trabajo diario, tabla paginada, panel lateral calendario + “para hoy”, Sheet de alta, detalle lateral con Tabs internos. |
| **Equipo y métricas** | Hoy concentrado en KPIs por persona, gráficas, filtros analíticos, tarjetas tipo “bento”, rankings o tablas agregadas. **Aquí vive** lo que antes competía en scroll con el tablero: visión de “cuántas tareas hizo cada uno”, horas, estados, etc., **con los mismos estilos del piloto** (Card, charts opcionales con componentes recomendados por [Charts en shadcn](https://ui.shadcn.com/docs/components) si se añaden más adelante). |

**Ventaja:** el tablero queda enfocado en ejecutar y agendar; la segunda pestaña en monitoreo sin saturar la vista principal.

---

## 4. Stack técnico (solo este módulo)

- React 19 + TypeScript + Vite (ya en proyecto).  
- Tailwind CSS v3 + variables CSS para tema shadcn.  
- **shadcn/ui** — instalar componentes según necesidad desde la [lista oficial](https://ui.shadcn.com/docs/components) (`button`, `badge`, `card`, `input`, `label`, `textarea`, `sheet`, `tabs`, `pagination`, `popover`, `calendar`, `sonner`, `select` o `combobox`, `table`, etc.).  
- **lucide-react** (iconos).  
- **@tanstack/react-query** para datos remotos, cache e invalidación tras mutaciones (POST agenda, PATCH estado, acta).  
- Zustand: solo donde ya aporta (p. ej. auth); no es obligatorio duplicar estado de servidor.  
- **Resize del panel lateral:** implementación **nativa** (sin librería de paneles), como en el prototipo: `mousedown` / `mousemove` global / `mouseup`, `user-select: none` y cursor `col-resize` durante el arrastre.

**Despliegue:** generar cambios de CLI **en local**, commit + push; el servidor solo instala dependencias y compila.

**Tipografía y color (piloto):** Preferir alinear con la intranet existente (`Barlow`, `brand.red` en `tailwind.config.js`) mapeando esos tokens a las CSS variables de shadcn; si negocio exige paridad exacta con el prototipo (Roboto + rojo genérico), limitar el alcance con una clase contenedora en la herramienta para no romper el resto del sitio.

---

## 5. Contrato backend (resumen — alinear con FastAPI actual)

Prefijo existente: `/api/herramientas/tareas` (ajustar si el proyecto global añade `/v1`).

| Necesidad | Dirección |
|-----------|-----------|
| Listado con paginación y filtros combinados | Extender o añadir endpoint tipo listado paginado; metadatos `{ data, meta: { total_items, total_pages, current_page, limit } }`. Reutilizar filtros ya presentes (`q`, fechas, `responsable_id` mapeado a `subido_por_id`, etc.) y añadir `fecha_exacta` o rango de un día para clic en calendario. |
| KPIs con mismos filtros | Mantener/ extender `.../equipo/kpis`; opcional: deltas vs periodo anterior. |
| Detalle e historial | `GET .../{id}` enriquecido; `GET .../{id}/historial` cuando exista tabla de eventos. |
| Crear tarea normal vs agendar reunión | `POST` puede bifurcarse por `tipo` o endpoints separados (`POST .../reuniones`). Validar miembros del equipo. **Importante:** hoy `create_task` asocia la tarea al usuario autenticado; el agendamiento “para otro” o con asistentes requiere reglas y permisos (`TOOL_MANAGE`) explícitos. |
| Acta al cerrar reunión | `PATCH` o `POST .../{id}/acta` con cuerpo de texto; validar estado previo y permisos. |
| Responsables / asistentes | Reutilizar `.../equipo/config/miembros` y/o `.../usuarios-disponibles` donde aplique; evitar duplicar rutas sin necesidad. |
| Zonas horarias | Fechas “día” como `YYYY-MM-DD`; documentar cómo se combinan con `hora_inicio` (UTC vs America/Bogota) para no desfasar el día guardado. |
| N+1 | En listados, eager load de relaciones necesarias (p. ej. usuario/responsable). |

---

## 6. Fases de implementación sugeridas

### Fase 0 — shadcn en local (piloto)

- [ ] En `frontend/`, seguir la guía oficial de instalación (p. ej. `npx shadcn create` o `npx shadcn@latest init` según la versión vigente del sitio [Installation](https://ui.shadcn.com/docs/installation)).
- [ ] Añadir componentes base: `button`, `badge`, `card`, `input`, `label`, `textarea`, `sheet`, `tabs`, `pagination`, `popover`, `calendar`, `sonner`, `table`, `select` o `combobox` según diseño final.
- [ ] Montar `<Toaster />` de Sonner en layout global o en el layout de la herramienta.
- [ ] Ajustar `index.css` / tokens para **brand** ZYMO y animaciones (`fade-in-up`, delays) si se mantienen.

### Fase 1 — Tema del módulo y `taskTheme`

- [ ] Sustituir progresivamente clases sueltas por componentes shadcn.
- [ ] En `taskTheme` (o equivalente), mapear etiquetas/estados a **variantes de Badge**: incluir variantes **extendidas** si el diseño lo pide (`success`, `brandOutline`, etc.), no solo las cuatro por defecto.

### Fase 2 — Navegación por Tabs (herramienta)

- [ ] Envolver `GestionTareasPage` / contenedor admin en **Tabs**: “Tablero” vs “Equipo y métricas”.
- [ ] Migrar KPIs, gráficas y filtros pesados de análisis a la segunda pestaña.
- [ ] Mantener permisos (`canManageDevTasks`, etc.) en ambas vistas.

### Fase 3 — Tablero (canvas)

- [ ] Layout: header + `main` scroll + `aside` con calendario y lista del día; resize nativo.
- [ ] Filtros en `Card`; tabla en `Card` con cabeceras compactas; paginación conectada a API paginada cuando exista.
- [ ] Sheet de **Nueva tarea** / **Nueva reunión** (formularios distintos o mismo Sheet con pasos según tipo).
- [ ] Detalle: `Sheet` o panel fijo + **Tabs** internos (datos de colaborador existentes + actividad; bloque extra para reunión/acta).

### Fase 4 — Dominio reunión y acta (full-stack)

- [ ] Migraciones: tipo de tarea, asistentes, campos de acta, historial si aplica.
- [ ] Endpoints y validaciones; reglas de quién puede agendar para quién.
- [ ] UI: selección de asistentes, flujo de cierre con acta y toast de confirmación.

### Fase 5 — Pulido y accesibilidad

- [ ] Contraste WCAG 2.1 AA en textos y estados de foco.
- [ ] Pruebas con teclado en calendario, Sheet y Tabs.
- [ ] Documentar decisiones de diseño para **replicar** en otros módulos de la intranet.

---

## 7. Retroalimentación y recomendaciones

1. **Priorizar contrato de datos:** El calendario + reunión + acta exige diseño de modelo antes de pulir pixels; si no, el Tablero quedará bonito pero acoplado a mocks.
2. **Un solo “Nueva tarea” con ramas claras:** Un botón con menú (Dropdown) “Registrar trabajo” vs “Agendar reunión” reduce errores de usuario y simplifica validación.
3. **Acta v1 minimalista:** Texto largo + lista de asistentes congelada + metadatos; el “formato bonito que se pasará luego” puede ser plantilla Mustache/Markdown renderizado en v2 sin reescribir el guardado.
4. **Paginación + React Query:** Evita traer miles de filas al cliente y hace que calendario y tabla se sientan “instantáneos” con invalidación selectiva.
5. **No duplicar fuentes corporativas:** Encajar shadcn con `brand` y `Barlow` evita que el piloto parezca otra aplicación; si querés contraste fuerte “demo”, hacedlo solo con variables bajo un wrapper `.modulo-tareas-shadcn`.
6. **Plan completo:** La visión está madura; el riesgo principal es **alcance en una sola entrega**. Valorar dividir en PRs: (A) shadcn + Tabs + tablero visual, (B) API paginada, (C) reunión + asistentes, (D) acta + historial.

---

## 8. Orden operativo para agentes

1. Fase 0 → 1 (base UI).  
2. Fase 2 (Tabs) antes de microanimar todo el tablero si ayuda a aislar regresiones.  
3. Backend paginado y detalle en paralelo al Tablero (Fase 3) cuando se reemplacen mocks.  
4. Fase 4 (reunión/acta) cuando el producto valide reglas de negocio y plantilla del acta.  
5. Fase 5 al cerrar el piloto.

---

*Última actualización del documento: alineado a visión producto (reuniones/acta), canvas, pestaña de métricas y piloto shadcn/ui según [documentación de componentes](https://ui.shadcn.com/docs/components).*

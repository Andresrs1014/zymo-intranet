# Requisitos maestros — Gestión de tareas

**Fecha:** 2026-05-14  
**Propósito:** Lista única de lo que el módulo debe ofrecer y criterios de “terminado”, después de alinear expectativas y evitar otro gran commit sin checklist.

**Documentos relacionados:**  
`2026-05-12-multi-workspace-gestion-tareas.md`, `2026-05-13-plan-mejora-multi-workspace.md`, `2026-05-11-mejoras-gestion-tareas-sidebar-calendario.md`, `2026-05-12-reorganizacion-tabs-gestion-tareas.md`

---

## 1. Visión

Cada **manager** con herramienta de gestión tiene un **workspace propio**: equipo, miembros, tareas, calendario, KPIs y listas configurables, **aislado** de otros workspaces. Los **miembros** solo ven y operan dentro del workspace al que pertenecen.

---

## 2. Alcance funcional (qué tiene que tener)

### 2.1 Workspace y equipo

- [ ] Un `TaskTeam` por manager (owner), con **nombre** editable (no hardcodeado perpetuo).
- [ ] Miembros del equipo con **rol** coherente (p. ej. miembro / co-gestor) según reglas de negocio acordadas.
- [ ] Al dar de alta un miembro, el flujo debe permitir **registrar tareas** sin pasos manuales fricción (p. ej. asignación automática de `tool_task_submit_dev` o flujo explícito en UI si se prefiere no automático).

### 2.2 Tareas

- [ ] CRUD de tareas con **validación** contra listas en BD (estados, etiquetas, plataformas, etc.), no sets fijos en código si ya existen listas.
- [ ] **Prioridad** y demás campos acordados visibles y usables en formularios (según diseño de producto).
- [ ] Filtros y vistas acordadas (p. ej. por persona, estado, rango de fechas).

### 2.3 Sidebar y personas

- [ ] Lista de **personas del equipo** aunque aún no tengan tareas (no solo quienes tienen tareas abiertas).
- [ ] Filtros / interacción del sidebar alineados al diseño (tabs, selección, etc.).

### 2.4 Calendario y eventos

- [ ] Eventos / `ScheduleSheet` alimentados con **datos de BD** (listas dinámicas), no valores hardcodeados donde ya exista config.
- [ ] Visibilidad por workspace; admin con reglas claras (ver todo el sistema vs solo un equipo).

### 2.5 KPIs y gráficas

- [ ] KPIs y **gráficas** definidas en alcance (qué métricas, qué período, qué comparativas). Hasta que esto esté especificado y maquetado, el hito no se da por cerrado.

### 2.6 Configuración de listas y equipo

- [ ] Pantalla o flujo para **configurar listas** (estados, etiquetas, plataformas, …) por workspace o por política acordada.
- [ ] Tab o sección de **equipo** (miembros, roles, invitaciones) usable sin depender del admin para cada alta.

### 2.7 Permisos y herramientas (tools)

- [ ] Comportamiento claro de `tool_task_manage_dev`, `tool_task_submit_dev`, co-gestión, **sin bypass** no deseado para admin.
- [ ] Coherencia entre backend (`UserTool`, routers) y frontend (`permissions`, rutas).

### 2.8 Datos y migraciones

- [ ] Toda columna nueva en modelos debe tener **migración** en arranque o script documentado para DB existentes (`task_team_members.role`, `task_events`, etc.).
- [ ] Comportamiento definido para admin: `owner_id` / alcance `None` vs filtrado por equipo.

---

## 3. Definition of Done (por entrega)

- [ ] Checklist de esta sección revisada para el **milestone** acordado.
- [ ] Pruebas manuales mínimas: manager nuevo, miembro nuevo, primera tarea, calendario, lista configurada.
- [ ] Sin regresiones conocidas en auth y tools.
- [ ] `origin/master` refleja el estado desplegable (sin depender de reset solo en servidor).

---

## 4. Orden sugerido de implementación (siguiente pasada)

1. **Migraciones y datos:** columnas y datos coherentes en SQLite (y Postgres si aplica).
2. **Sidebar + miembros sin tareas** y validación de listas desde BD.
3. **Flujo miembro:** alta → puede registrar tarea (automático o UI).
4. **Calendario / listas dinámicas** y campos del formulario (prioridad, etc.).
5. **KPIs y gráficas** una vez definidas métricas y mocks.
6. **Pulido** permisos, nombres de workspace, documentación corta en este plan.

---

## 5. Fuera de alcance (hasta nueva decisión)

Cambios no listados arriba o “nice to have” sin criterio de aceptación escrito.

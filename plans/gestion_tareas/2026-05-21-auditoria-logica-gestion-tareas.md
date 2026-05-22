# Auditoría de Lógica — Módulo Gestión de Tareas

**Fecha:** 2026-05-21
**Estado:** En revisión (correcciones en progreso)
**Errores encontrados:** 51 (2 ya corregidos en sesiones anteriores)

---

## Estado de Correcciones

| # | Descripción corta | Severidad | Estado |
|---|-------------------|-----------|--------|
| 1 | Zona horaria inconsistente (fecha local vs UTC) | Alto | Pendiente |
| 2 | `calcular_minutos` no valida mismo día | Medio | Pendiente |
| 3 | Fecha por defecto no sincronizada con horas | Medio | Pendiente |
| 4 | `fecha_referencia` usa `date.today()` sin timezone | Medio | Pendiente |
| 5 | Sin validación de fechas pasadas en creación | Bajo | Pendiente |
| 6 | `AsignarTareaForm` fuerza fecha mínima hoy pero `TaskForm` no | Medio | Pendiente |
| 7 | Tarea sin responsable explícito permitida | Alto | Pendiente |
| 8 | `asignado_a_nombre` desincronizado con `asignado_a_id` | Medio | Pendiente |
| 9 | `subido_por_id` no declarado explícitamente como inmutable | Bajo | Pendiente |
| 10 | Asignado puede modificar `hora_inicio`/`hora_cierre` libremente | Alto | **Pendiente — pregunta #2** |
| 11 | Gestor asigna sin consentimiento del asignado | Bajo | Pendiente |
| 12 | Gestor puede asignar a cualquier usuario activo (sin filtro de equipo) | Medio | Pendiente |
| 13 | Auto-cierre sin máquina de estados (transiciones sin restricción) | Alto | **Pendiente — pregunta #3** |
| 14 | Estado inicial `"en_progreso"` hardcoded para tareas no asignadas | Medio | **Pendiente — pregunta #5** |
| 15 | `is_initial_assignment` solo aplica a tareas con asignado | Medio | **Pendiente — pregunta #5** |
| 16 | Gestor no tiene restricción de transiciones de estado en `update_team_task` | Alto | Pendiente |
| 17 | Estado "bloqueada" sin comportamiento especial ni razón requerida | Bajo | Pendiente |
| 18 | `is_final` e `is_canceled` tienen el mismo comportamiento funcional | Medio | **Pendiente — pregunta #4** |
| 19 | `_require_manage_access` retorna `owner_id` sin validar equipo activo | Crítico | Pendiente |
| 20 | Co-gestores pueden editar configuración del gestor primario | Crítico | Pendiente |
| 21 | Sin validación de team en endpoint `get_equipo_graficas` | Alto | Pendiente |
| 22 | Revocar rol a usuario no maneja sus equipos/tareas pendientes | Medio | Pendiente |
| 23 | `owner_id` en operaciones de team se confía del router sin validar | Medio | Pendiente |
| 24 | `subido_por_nombre` y `asignado_a_nombre` sin trigger de actualización | Bajo | Pendiente |
| 25 | `tiempo_total_minutos` recalculado en cada update (no auditable) | Medio | Pendiente |
| 26 | `updated_at` se actualiza pero no se registra qué campo cambió | Medio | Pendiente |
| 27 | Participantes de eventos sin deduplicación | Bajo | Pendiente |
| 28 | Desactivar estado deja tareas activas huérfanas en ese estado | Alto | Pendiente |
| 29 | Filtro `responsable_id` filtra por **creador**, no por asignado | Alto | **Pendiente — pregunta #1** |
| 30 | Sin índice compuesto `(asignado_a_id, fecha)` para queries de asignados | Bajo | Pendiente |
| 31 | Vista de tareas mezcla creadas y asignadas sin separación clara | Bajo | Pendiente |
| 32 | `team_member_ids` null check con comportamiento poco claro | Bajo | Pendiente |
| 33 | `hora_cierre` puede ser retroactiva sin validación | Medio | Pendiente |
| 34 | Sin rate limiting en creación de tareas | Bajo | Pendiente |
| 35 | `titulo` permite strings de solo espacios | Bajo | Pendiente |
| 36 | `prioridad` acepta cualquier string (no validado contra Enum) | Medio | Pendiente |
| 37 | Race condition: dos usuarios pueden editar la misma tarea | Alto | Pendiente |
| 38 | Gestor puede sobreescribir cambios del colaborador sin aviso | Alto | Pendiente |
| 39 | Sin notificaciones al asignar una tarea | Alto | Pendiente |
| 40 | Activity log solo registra cambios de estado, no de otros campos | Medio | Pendiente |
| 41 | `created_at` guardado pero raramente usado en queries/filtros | Bajo | Pendiente |
| 42 | `TaskActivityLog` usa UTC pero `WorkTask.fecha` usa local | Medio | Pendiente |
| 43 | Frontend calcula minutos por su cuenta (frontend vs backend divergen) | Medio | Pendiente |
| 44 | Frontend no valida estados contra la config del backend antes de enviar | Medio | Pendiente |
| 45 | `AsignarTareaForm` no muestra ni usa los estados configurados del equipo | Bajo | Pendiente |
| 46 | Sin sincronización de cambios entre tabs/ventanas del mismo usuario | Bajo | Pendiente |
| 47 | Usuario eliminado deja tareas huérfanas (sin FK con ON DELETE) | Alto | Pendiente |
| 48 | Equipo eliminado deja tareas huérfanas (sin FK en `team_id`) | Alto | Pendiente |
| 49 | Cambio de rol de usuario no revalida acceso a tareas históricas | Medio | Pendiente |
| 50 | Zona horaria del servidor diferente a la del usuario (sin parámetro TZ) | Alto | Pendiente |
| 51 | Eventos con duración > 24h sin validación de máximo | Bajo | Pendiente |

> **Errores ya corregidos (sesiones anteriores):**
> - Estado inicial de asignación configurable por gestor (`is_initial_assignment`)
> - Restricción de campos editables por destinatario + métricas solo tareas propias

---

## Detalle por Error

### SECCIÓN 1: TIEMPOS, FECHAS Y VENCIMIENTOS

---

#### Error #1 — Zona horaria inconsistente
- **Archivo:** `backend/app/models/work_task.py`
- **¿Qué pasa hoy?** `fecha` usa `default_factory=date.today()` (zona local del servidor), mientras `created_at` y `updated_at` usan `datetime.now(timezone.utc)`. Las horas de inicio/cierre presumiblemente también van a UTC.
- **¿Qué debería pasar?** Todas las fechas/timestamps en UTC internamente. Conversión solo en UI.
- **Impacto:** Reportes de "registro hoy" pueden ser incorrectos según dónde corra el servidor.

---

#### Error #2 — `calcular_minutos` no valida mismo día
- **Archivo:** `backend/app/services/work_task_service.py` líneas 18–31
- **¿Qué pasa hoy?** Solo valida que `hora_cierre > hora_inicio`. Si el inicio es a las 23:00 y el cierre a las 02:00 del día siguiente (datetime reales en UTC), el cálculo sería incorrecto porque `fecha` apunta al primer día.
- **¿Qué debería pasar?** Calcular el delta desde los datetime completos o validar que ambas horas pertenezcan a la misma fecha del registro.

---

#### Error #3 — Fecha por defecto desincronizada con horas proporcionadas
- **Archivo:** `backend/app/services/work_task_service.py` línea 197
- **¿Qué pasa hoy?** Si no se proporciona `fecha`, se usa `date.today()` (local). Si `hora_inicio` viene en UTC con fecha diferente, hay inconsistencia silenciosa.
- **¿Qué debería pasar?** Si se provee `hora_inicio`, derivar `fecha` de ese datetime. Si hay conflicto entre `fecha` y las horas, rechazar.

---

#### Error #4 — `fecha_referencia` en métricas usa `date.today()` sin timezone
- **Archivo:** `backend/app/services/task_dashboard_service.py` líneas 16–19
- **¿Qué pasa hoy?** `date.today()` sin timezone puede divergir del timezone real del usuario.
- **¿Qué debería pasar?** Aceptar timezone del cliente o forzar UTC con conversión explícita.

---

#### Error #5 — Sin validación de fechas pasadas
- **Archivo:** `backend/app/schemas/work_task.py` líneas 17, 30
- **¿Qué pasa hoy?** Backend y frontend no validan si la fecha es pasada o futura.
- **¿Qué debería pasar?** Definir política: ¿se permiten registros retroactivos? Si no, validar en creación.

---

#### Error #6 — Inconsistencia de fecha mínima entre formularios
- **Archivo:** `frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx` líneas 18–22, `TaskForm.tsx` línea 150
- **¿Qué pasa hoy?** `AsignarTareaForm` impone `min=today` pero `TaskForm` no tiene restricción.
- **¿Qué debería pasar?** Unificar la política de fecha mínima en ambos formularios.

---

### SECCIÓN 2: RESPONSABLES Y ASIGNACIÓN

---

#### Error #7 — Tarea sin responsable explícito
- **Archivo:** `backend/app/services/work_task_service.py` líneas 102–224
- **¿Qué pasa hoy?** Si no se provee `asignado_a_id`, queda NULL. No hay validación de que alguien sea responsable.
- **¿Qué debería pasar?** Definir si `asignado_a_id` es obligatorio en ciertas condiciones (ej: tareas de equipo).

---

#### Error #8 — `asignado_a_nombre` desincronizado
- **Archivo:** `backend/app/services/work_task_service.py` líneas 171–176
- **¿Qué pasa hoy?** Si el usuario asignado no existe, el nombre queda vacío. Si cambia de nombre, el campo queda desactualizado.
- **¿Qué debería pasar?** Snapshot histórico documentado, o trigger de actualización, o FK con integridad referencial.

---

#### Error #9 — `subido_por_id` no es explícitamente inmutable
- **Archivo:** `backend/app/services/work_task_service.py` línea 309
- **¿Qué pasa hoy?** El payload no lo incluye por schema, pero no hay validación explícita que lo proteja.
- **¿Qué debería pasar?** Validación defensiva: el servidor debe rechazar cualquier intento de cambiar `subido_por_id`.

---

#### Error #10 — Asignado puede modificar horas libremente
- **Archivo:** `backend/app/services/work_task_service.py` líneas 282–290
- **¿Qué pasa hoy?** `allowed_assignee_fields = {"estado", "hora_inicio", "hora_cierre", "descripcion_tecnica"}` — el asignado puede modificar horas de forma retroactiva.
- **¿Qué debería pasar?** Definir si el asignado puede cambiar horas y bajo qué condiciones (estado en progreso, no retroactivo, etc.).
- **En revisión:** Pregunta #2 al usuario.

---

#### Error #11 — Asignación sin consentimiento del asignado
- **Archivo:** `backend/app/services/work_task_service.py` línea 172–176
- **¿Qué pasa hoy?** Un gestor puede asignar tarea a cualquier usuario sin notificación.
- **¿Qué debería pasar?** Al menos notificación. Opcionalmente, workflow de aceptación.

---

#### Error #12 — Gestor puede asignar a cualquier usuario activo
- **Archivo:** `backend/app/routers/herramientas_tareas.py` líneas 341–342
- **¿Qué pasa hoy?** `get_all_active_users_for_manager` retorna todos los usuarios activos del sistema, sin filtrar por equipo.
- **¿Qué debería pasar?** Solo retornar miembros activos del equipo del gestor.

---

### SECCIÓN 3: ESTADOS Y TRANSICIONES

---

#### Error #13 — Sin máquina de estados: transiciones sin restricción
- **Archivo:** `backend/app/services/work_task_service.py` líneas 227–258, 602–620
- **¿Qué pasa hoy?** No hay validación de transiciones permitidas. Una tarea "completada" puede volver a "en_progreso".
- **¿Qué debería pasar?** Definir qué transiciones son permitidas (ej: final → ningún otro).
- **En revisión:** Pregunta #3 al usuario.

---

#### Error #14 — Estado inicial `"en_progreso"` hardcoded para tareas propias
- **Archivo:** `backend/app/services/work_task_service.py` línea 179
- **¿Qué pasa hoy?** `task_estado = payload.estado or "en_progreso"` — siempre "en_progreso" si no hay estado ni asignado.
- **¿Qué debería pasar?** Respetar configuración de estado inicial también para tareas no asignadas.
- **En revisión:** Pregunta #5 al usuario.

---

#### Error #15 — `is_initial_assignment` solo aplica a tareas asignadas
- **Archivo:** `backend/app/services/work_task_service.py` líneas 180–190
- **¿Qué pasa hoy?** La búsqueda de estado inicial se omite si `asignado_a_id is None`.
- **¿Qué debería pasar?** Definir si hay estado inicial universal vs estado inicial de asignación.
- **En revisión:** Pregunta #5 al usuario.

---

#### Error #16 — Gestor no tiene restricción de transiciones en `update_team_task`
- **Archivo:** `backend/app/services/work_task_service.py` líneas 544–641
- **¿Qué pasa hoy?** Gestor puede cambiar a cualquier estado válido sin respetar flujo.
- **¿Qué debería pasar?** Misma máquina de estados que el colaborador, o restricciones propias del rol gestor.

---

#### Error #17 — Estado "bloqueada" sin comportamiento funcional definido
- **Archivo:** `backend/app/services/task_dashboard_service.py` líneas 87–89
- **¿Qué pasa hoy?** Se cuenta en KPIs pero no impide edición ni requiere razón de bloqueo.
- **¿Qué debería pasar?** Definir semántica: ¿qué se puede hacer con una tarea bloqueada?

---

#### Error #18 — `is_final` e `is_canceled` sin diferencia funcional
- **Archivo:** `backend/app/models/task_list_config.py` líneas 16–17
- **¿Qué pasa hoy?** Ambos disparan el mismo auto-cierre. En reportes, canceladas se mezclan con completadas.
- **¿Qué debería pasar?** Comportamientos distintos: cancelada no suma en métricas de tareas terminadas exitosamente.
- **En revisión:** Pregunta #4 al usuario.

---

### SECCIÓN 4: PERMISOS Y ROLES

---

#### Error #19 — `_require_manage_access` sin validar equipo activo
- **Archivo:** `backend/app/routers/herramientas_tareas.py` líneas 395–429
- **¿Qué pasa hoy?** Retorna `current_user.id` para gestor/admin sin verificar que tenga equipo activo.
- **¿Qué debería pasar?** Validar equipo antes de retornar, o crear equipo si no existe de forma explícita.

---

#### Error #20 — Co-gestores editan configuración del gestor primario
- **Archivo:** `backend/app/routers/herramientas_tareas.py` líneas 995–1035
- **¿Qué pasa hoy?** `_require_manage_access` retorna el `owner_id` del gestor primario para co-gestores, permitiéndoles modificar su config.
- **¿Qué debería pasar?** Co-gestores con config propia (read-only de la primaria) o restricción explícita de escritura.

---

#### Error #21 — Sin validación de team en `get_equipo_graficas`
- **Archivo:** `backend/app/routers/herramientas_tareas.py` línea 478
- **¿Qué pasa hoy?** No se valida que el usuario tenga acceso al `team_id` solicitado.
- **¿Qué debería pasar?** Verificar que `current_user` pertenece o gestiona ese equipo específico.

---

#### Error #22 — Revocar rol sin manejo de equipos/tareas pendientes
- **Archivo:** `backend/app/routers/herramientas_tareas.py` líneas 880–905
- **¿Qué pasa hoy?** Al revocar `tool_task_manage_dev`, el equipo queda sin gestor y las tareas activas quedan sin responsable de gestión.
- **¿Qué debería pasar?** Transferir equipo o bloquear revocación hasta reasignación.

---

#### Error #23 — `owner_id` confiado del router sin revalidar
- **Archivo:** `backend/app/services/work_task_service.py` líneas 567–576
- **¿Qué pasa hoy?** El servicio confía en que el router pasó el `owner_id` correcto.
- **¿Qué debería pasar?** Validar en el servicio que `owner_id` corresponde a `current_user`.

---

### SECCIÓN 5: CONSISTENCIA DE DATOS

---

#### Error #24 — Nombres desnormalizados sin trigger de actualización
- **Archivo:** `backend/app/models/work_task.py` líneas 17, 34
- **¿Qué pasa hoy?** `subido_por_nombre` y `asignado_a_nombre` son snapshots históricos sin sincronización automática.
- **¿Qué debería pasar?** Documentar explícitamente que son históricos, o implementar trigger de actualización.

---

#### Error #25 — `tiempo_total_minutos` recalculado en cada update
- **Archivo:** `backend/app/services/work_task_service.py` líneas 330–331, 622–624
- **¿Qué pasa hoy?** Si se borra `hora_cierre`, el tiempo se pierde. No queda registro del tiempo previo.
- **¿Qué debería pasar?** Definir si es campo calculado (bloqueado a edición manual) o manual con historial.

---

#### Error #26 — `updated_at` se actualiza pero sin registro de qué cambió
- **Archivo:** `backend/app/services/work_task_service.py` línea 332
- **¿Qué pasa hoy?** Solo se loguea en `task_activity_log` cuando cambia el estado. Otros cambios (título, fecha, descripción) son invisibles en auditoría.
- **¿Qué debería pasar?** Registrar todos los cambios de campo con valor anterior y nuevo.

---

#### Error #27 — Participantes de eventos sin deduplicación
- **Archivo:** `backend/app/services/task_event_service.py` líneas 58–91
- **¿Qué pasa hoy?** Llamar dos veces con los mismos `participant_ids` duplica registros.
- **¿Qué debería pasar?** Deduplicar IDs antes de insertar, o UNIQUE constraint en BD `(task_id, user_id)`.

---

#### Error #28 — Desactivar un estado deja tareas activas huérfanas
- **Archivo:** `backend/app/services/work_task_service.py` líneas 95–99
- **¿Qué pasa hoy?** Si un gestor desactiva un estado que aún tiene tareas asignadas, esas tareas quedan en un estado desactivado y no pueden actualizarse.
- **¿Qué debería pasar?** Bloquear la desactivación si hay tareas en ese estado, o reasignarlas primero.

---

### SECCIÓN 6: FILTROS Y QUERIES

---

#### Error #29 — Filtro `responsable_id` filtra creador, no asignado
- **Archivo:** `backend/app/services/work_task_service.py` línea 497
- **¿Qué pasa hoy?**
  ```python
  query = query.where(WorkTask.subido_por_id == filters.responsable_id)
  ```
  El filtro usa `subido_por_id` (creador), no `asignado_a_id`.
- **¿Qué debería pasar?** `responsable_id` debería filtrar por asignado, o incluir ambos.
- **En revisión:** Pregunta #1 al usuario.

---

#### Error #30 — Sin índice compuesto `(asignado_a_id, fecha)`
- **Archivo:** `backend/app/models/work_task.py` línea 33
- **¿Qué pasa hoy?** Solo existe índice simple en `asignado_a_id`. Queries de asignados por fecha pueden ser lentas.
- **¿Qué debería pasar?** Considerar índice compuesto para las queries más comunes.

---

#### Error #31 — Vista de tareas mezcla creadas y asignadas
- **Archivo:** `backend/app/services/work_task_service.py` líneas 362–380
- **¿Qué pasa hoy?** La query retorna tareas donde el usuario es creador O asignado, sin distinción.
- **¿Qué debería pasar?** UI debería separar claramente "mis tareas" vs "asignadas a mí", o documentar que es unión intencional.

---

#### Error #32 — Comportamiento ambiguo de `team_member_ids` cuando es null
- **Archivo:** `backend/app/services/work_task_service.py` líneas 471–480
- **¿Qué pasa hoy?** Si `team_id` está presente pero `team_member_ids` es None, filtra solo por `team_id` sin considerar miembros.
- **¿Qué debería pasar?** Auto-cargar miembros si no se proveen, o documentar el comportamiento explícitamente.

---

### SECCIÓN 7: VALIDACIÓN DE ENTRADA

---

#### Error #33 — `hora_cierre` puede ser retroactiva
- **Archivo:** `backend/app/services/work_task_service.py` línea 25
- **¿Qué pasa hoy?** Solo se valida `hora_cierre > hora_inicio`, pero no que no sea una hora pasada.
- **¿Qué debería pasar?** Definir si se permiten tiempos retroactivos. Si no, validar contra `datetime.now()`.

---

#### Error #34 — Sin rate limiting en creación de tareas
- **Archivo:** `backend/app/routers/herramientas_tareas.py` línea 114–138
- **¿Qué pasa hoy?** Un usuario puede crear tareas sin límite de frecuencia.
- **¿Qué debería pasar?** Rate limiting configurable (ej: máx 50 tareas/hora).

---

#### Error #35 — `titulo` permite strings de solo espacios
- **Archivo:** `backend/app/schemas/work_task.py` línea 10
- **¿Qué pasa hoy?** `titulo: str` no valida longitud mínima ni strip de espacios.
- **¿Qué debería pasar?** `titulo` con `min_length=1` después de strip en Pydantic validator.

---

#### Error #36 — `prioridad` no validado contra Enum
- **Archivo:** `backend/app/schemas/work_task.py` líneas 15, 29
- **¿Qué pasa hoy?** `prioridad: str = Field(default="media")` acepta cualquier string.
- **¿Qué debería pasar?** `Literal["alta", "media", "baja"]` o validación contra configuración.

---

### SECCIÓN 8: MULTI-USUARIO Y CONCURRENCIA

---

#### Error #37 — Race condition en edición simultánea
- **Archivo:** `backend/app/services/work_task_service.py` líneas 275–290
- **¿Qué pasa hoy?** Dos usuarios (creador + asignado) pueden editar la misma tarea simultáneamente. La última escritura gana sin aviso.
- **¿Qué debería pasar?** Optimistic locking con campo `version` o `etag`, rechazo si versión no coincide.

---

#### Error #38 — Gestor sobreescribe cambios del colaborador sin aviso
- **Archivo:** Sin control en BD
- **¿Qué pasa hoy?** Gestor (`update_team_task`) y colaborador (`update_own_task`) pueden actuar en paralelo.
- **¿Qué debería pasar?** Mismo mecanismo de versioning que #37.

---

#### Error #39 — Sin notificaciones al asignar tarea
- **Archivo:** No implementado
- **¿Qué pasa hoy?** El asignado solo ve la tarea si revisa su dashboard activamente.
- **¿Qué debería pasar?** Notificación in-app, email o Slack al momento de asignación.

---

### SECCIÓN 9: AUDITORÍA Y LOGS

---

#### Error #40 — Activity log solo registra cambios de estado
- **Archivo:** `backend/app/services/work_task_service.py` líneas 339–346, 632–639
- **¿Qué pasa hoy?** Solo el campo `estado` genera entrada en `task_activity_log`. Cambios de título, fecha, horas, descripción son invisibles.
- **¿Qué debería pasar?** Registrar todos los campos modificados con valor anterior y nuevo.

---

#### Error #41 — `created_at` raramente usado en queries
- **Archivo:** `backend/app/models/work_task.py` líneas 36–37
- **¿Qué pasa hoy?** Se guarda pero no se expone como filtro útil.
- **¿Qué debería pasar?** Añadir filtro "creadas entre X e Y" o documentar como campo de auditoría.

---

#### Error #42 — `TaskActivityLog` en UTC vs `WorkTask.fecha` en local
- **Archivo:** `backend/app/models/task_activity_log.py` línea 16, `work_task.py` línea 19
- **¿Qué pasa hoy?** Inconsistencia de timezone entre el log y el registro de la tarea.
- **¿Qué debería pasar?** Todo UTC, conversión solo en UI.

---

### SECCIÓN 10: INCONSISTENCIAS FRONTEND–BACKEND

---

#### Error #43 — Frontend calcula minutos independientemente del backend
- **Archivo:** `frontend/src/components/herramientas/tareas/TaskForm.tsx` líneas 21–27
- **¿Qué pasa hoy?** Frontend hace su propio cálculo de minutos desde "HH:MM" string. Backend lo recalcula desde datetime. Si hay diferencia de timezone, divergen.
- **¿Qué debería pasar?** Calcular solo en backend desde datetime ISO completos. Frontend muestra preview no vinculante.

---

#### Error #44 — Frontend no valida estados contra config antes de enviar
- **Archivo:** `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx` líneas 195–199
- **¿Qué pasa hoy?** Si no hay config cargada, el selector de estado queda abierto y el backend devuelve error 422.
- **¿Qué debería pasar?** Deshabilitar selector de estado si no hay listas configuradas, con mensaje explicativo.

---

#### Error #45 — `AsignarTareaForm` no usa estados configurados del equipo
- **Archivo:** `frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx` líneas 24–62
- **¿Qué pasa hoy?** No carga ni muestra selector de estado al asignar. El backend asigna estado por defecto.
- **¿Qué debería pasar?** Mostrar selector de estado (o al menos informar cuál será el estado inicial).

---

#### Error #46 — Sin sincronización de cambios entre tabs/ventanas
- **Archivo:** No implementado
- **¿Qué pasa hoy?** Editar la misma tarea en dos pestañas simultáneas resulta en pérdida silenciosa de cambios.
- **¿Qué debería pasar?** Polling periódico o websocket para detectar cambios externos.

---

### SECCIÓN 11: INTEGRIDAD REFERENCIAL

---

#### Error #47 — Usuario eliminado deja tareas huérfanas
- **Archivo:** `backend/app/models/work_task.py` línea 33, sin FK definida
- **¿Qué pasa hoy?** `asignado_a_id` queda apuntando a un usuario inexistente.
- **¿Qué debería pasar?** FK con `ON DELETE SET NULL`, o soft-delete de usuarios y transferencia de tareas.

---

#### Error #48 — Equipo eliminado deja tareas huérfanas
- **Archivo:** `backend/app/models/work_task.py`, sin FK en `team_id`
- **¿Qué pasa hoy?** Al eliminar equipo, `team_id` queda como referencia inválida.
- **¿Qué debería pasar?** FK con `ON DELETE` o bloquear eliminación si hay tareas activas.

---

#### Error #49 — Cambio de rol sin revalidación de acceso histórico
- **Archivo:** Sin implementación
- **¿Qué pasa hoy?** Si un colaborador pasa a gestor (o viceversa), sus tareas históricas pueden quedar en zona gris de acceso.
- **¿Qué debería pasar?** Política clara: accesos congelados al momento de creación, o migración explícita.

---

#### Error #50 — Timezone del servidor diferente al del usuario
- **Archivo:** Global (`date.today()`, `datetime.now()`)
- **¿Qué pasa hoy?** "Registro de hoy" es relativo al servidor. Usuario en timezone diferente verá datos incorrectos.
- **¿Qué debería pasar?** Todo UTC internamente. Parámetro de timezone en perfil de usuario o en request header.

---

#### Error #51 — Eventos con duración > 24h sin límite
- **Archivo:** `backend/app/models/task_event.py` línea 20
- **¿Qué pasa hoy?** `duracion_minutos: int` sin máximo. Se puede crear evento de 7 días.
- **¿Qué debería pasar?** `duracion_minutos <= 1440` (24h) o soporte real de eventos multi-día.

---

## Notas de Trabajo

- Los errores marcados con **"En revisión"** están pendientes de respuesta del usuario para definir cómo deben quedar.
- Se trabaja en bloques de 5 errores.
- Al resolver cada error, actualizar la tabla de estado al inicio del documento.

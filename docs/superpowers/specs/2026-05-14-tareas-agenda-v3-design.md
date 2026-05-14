# Tareas & Agenda v3 — Design Spec

**Goal:** Add quick task status change with configurable final/canceled states, open scheduling for all users with priority + event detail/cancel/add-participants, and fix the calendar resize layout bug.

**Architecture:** All changes stay within the existing `herramientas_tareas` module. Backend uses SQLModel migrations (Alembic-less pattern: `create_all`). Frontend uses TanStack Query mutations + sheet components consistent with existing patterns.

**Tech Stack:** FastAPI + SQLModel (SQLite), React + TypeScript, TanStack Query, Tailwind CSS, shadcn/ui.

---

## Section 1 — Task Status Quick Change

### Data Layer

`TaskListConfig` model gains two boolean columns:

```python
is_final: bool = Field(default=False, nullable=False)
is_canceled: bool = Field(default=False, nullable=False)
```

Only ONE estado can be `is_final=True` and ONE can be `is_canceled=True` at a time per workspace. Backend validates and clears previous flag before setting new one.

### Backend Behavior

When a task transitions to a "final" or "canceled" estado:
- If `hora_cierre` is `None`, set it to `datetime.now(timezone.utc)`.
- Recalculate `tiempo_total_minutos`.
- Log activity `cambio_estado`.

New endpoint: `PATCH /config/listas/estado/{value}/especial`
```json
{ "tipo": "final" }   // or "cancelado" or null (to clear)
```

Response: updated `TaskListConfigRead` with `is_final`, `is_canceled` fields.

`GET /config/listas` response already returns all config items — add `is_final` and `is_canceled` to `TaskListConfigRead` schema.

### Frontend

- `TaskDetailSheet`: add a `<select>` or pill-chips for estado. Calls `PATCH /mis-tareas/{id}` (own task) or `PATCH /equipo/tareas/{id}` (manager). Shows configured state labels.
- `TaskDataTable`: optional quick-change chip in the estado column (same mutation).
- The "final" and "canceled" estados show a special visual indicator (🏁 / ✗ icons) in the list.

---

## Section 2 — Estado Special Config in ListConfigTab

`ListSection` for "Estados" gets two extra icon buttons per item:

- **🏁 Final** — marks this estado as the "task complete" state. Only one can be marked at a time.
- **✗ Cancelado** — marks this estado as the "canceled" state. Only one can be marked.

Active states show colored badge. Clicking the same icon again clears the flag (sets to null).

`useMarkEstadoEspecial()` mutation: calls `PATCH /config/listas/estado/{value}/especial`.

---

## Section 3 — Agenda Improvements

### A. Any User Can Schedule for Others

Remove restriction in `crear_evento_agenda`. Any user with TOOL_SUBMIT can select any participant from their workspace.

Backend: remove the `if not is_manager and not is_admin` guard that restricts `participant_ids`.

Frontend: change `canSelectOthers` prop in `GestionTareasPage` from `canManage` to `canSubmit || canManage` (always true for any authorized user).

### B. Priority Field on Events

New configurable list type: `"prioridad_agenda"`. Managed in `ListConfigTab` with a new section "Prioridades de agenda".

`TaskEvent` model gains:
```python
prioridad: Optional[str] = Field(default=None, max_length=50)
```

`ScheduleSheet` adds a `<select>` for `prioridad` (optional, loaded from `lists?.prioridad_agenda`).

`TaskEventCreate` schema adds `prioridad: Optional[str] = None`.

### C. Event Detail Sheet (`EventDetailSheet`)

New component `EventDetailSheet.tsx`. Opens when user clicks an event card in `CalendarSidebar`. Shows:
- Título, fecha, hora, duración
- Descripción (full text, not truncated)
- Prioridad badge (if set)
- Participantes list with conflict indicators
- "Cancelar evento" button (DELETE) — only visible to creator or manager
- "Agregar participantes" expandable section — shows UserPickerList

`GestionTareasPage` replaces `onEventClick={() => {}}` with state `selectedEvent` + renders `<EventDetailSheet>`.

### D. Cancel Event

Endpoint: `DELETE /agenda/{event_id}`
- Only the `creado_por_id` or a manager in the same workspace can delete.
- Deletes event + all participants (cascade or manual).

Frontend: `useDeleteEvent()` mutation. On success, closes sheet and invalidates `["tareas", "agenda"]` query.

### E. Add/Remove Participants

Endpoint: `PATCH /agenda/{event_id}/participantes`
```json
{ "add_ids": [1, 2], "remove_ids": [3] }
```
- Only creator or manager can modify participants.
- Re-runs conflict detection for added users.

Frontend: `useUpdateEventParticipants()` mutation. `EventDetailSheet` shows the existing participant list with remove buttons (✕), plus a collapsible user picker to add more.

---

## Section 4 — Calendar Resize Bug Fix

**Root cause:** `transition-all duration-300` on the `aside` transitions ALL CSS properties, causing content to lag. The inner `div.flex-col.h-full` doesn't explicitly fill the parent width, so DayPicker renders at its default width and the extra space appears blank.

**Fix:**
1. Replace `transition-all` with `transition-[width]` on the aside.
2. Add `w-full` to the inner content wrapper div.
3. Add `overflow-x-hidden` to the aside so content doesn't bleed during resize.
4. Wrap DayPicker in a `div` with `w-full` to ensure it stretches.

---

## Non-Goals

- No email/push notifications for scheduled events.
- No recurring events.
- No drag-to-reschedule in the calendar.
- No per-participant RSVP.

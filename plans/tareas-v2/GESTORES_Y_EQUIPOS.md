# Gestores y Equipos — Referencia y Gap de Implementación

## Modelo de roles (según ROLES.md y PLAN_GT_2_0.md)

| Rol V2 | Equivalente V1 | Capacidades |
|---|---|---|
| `OWNER` | Gestor (`tool_task_manage_dev`) | Configura el equipo, asigna miembros, cambia estados, ve todo |
| `CO_MANAGER` | Co-gestor | Mismos permisos que OWNER, sin poder eliminar el equipo |
| `MEMBER` | Colaborador (`tool_task_submit`) | Crea/edita sus propias tareas, acepta asignaciones |

---

## Flujo implementado (estado actual)

```
Usuario autenticado → POST /api/teams  →  crea equipo + queda como OWNER
OWNER              → POST /api/teams/:id/members                → agrega colaboradores
OWNER              → POST /api/teams/:id/members/:userId/promote → sube a CO_MANAGER
OWNER              → POST /api/teams/:id/members/:userId/demote  → baja a MEMBER
```

La vista **Settings** (`/tareas-v2` → engranaje en sidebar) expone estas acciones en UI.

---

## Gap identificado

El plan original (T-005) especificaba:

> `POST /api/teams` solo accesible para usuario con `tool_task_manage` o admin.
> `getOrCreateTeam(userId)` auto-crea equipo **solo si** el usuario tiene `tool_task_manage`.

**Esta validación NO fue implementada** en V2. Actualmente cualquier usuario autenticado puede crear un equipo.

---

## Opciones para resolverlo

### Opción A — Validar `tool_task_manage_dev` en creación (recomendada)

Consultar la tabla `usertool` de la BD principal para verificar permiso antes de crear equipo.

**Archivo a modificar:** `task-backend/src/services/teamService.ts` → función `createTeam()`

```typescript
// Pseudo-código
const hasPerm = await prisma.$queryRaw<[{count:number}]>`
  SELECT COUNT(*) as count FROM usertool
  WHERE user_id = ${userId} AND tool_key = 'tool_task_manage_dev' AND active = true
`
if (hasPerm[0].count === 0) throw new ForbiddenError("Se requiere permiso tool_task_manage_dev")
```

**Requiere:** que task-backend tenga acceso a la BD principal (misma instancia PostgreSQL o variable `MAIN_DB_URL`).

**Pro:** Consistente con V1
**Contra:** Acoplamiento entre las dos BDs

---

### Opción B — Endpoint admin exclusivo

Crear `POST /api/admin/teams` que solo acepte tokens con `role = 'admin'` (claim en JWT).

Los gestores no crean el equipo — un admin lo hace por ellos desde un panel.

**Pro:** Separación de responsabilidades
**Contra:** Requiere UI de admin o uso directo de API (curl/Postman)

---

### Opción C — Dejar como está (pragmática)

El admin crea el equipo ingresando a `/tareas-v2` con la cuenta del usuario que será gestor.
Luego ese usuario invita colaboradores desde Settings.

No requiere cambios de código.

**Pro:** Cero desarrollo
**Contra:** Cualquier usuario puede crear equipos (potencial proliferación)

---

## Recomendación

Para el tamaño actual del equipo Zymo, **Opción C** es suficiente en el corto plazo.
Implementar **Opción A** cuando se quiera controlar formalmente quién puede ser gestor,
vinculándolo al sistema de permisos ya existente en la intranet V1.

---

## Cómo asignar un gestor hoy (sin cambios)

1. El admin (o el futuro gestor) entra a `https://zymointranet.com/tareas-v2`
2. En el sidebar → "Crear equipo" → ingresa nombre y descripción
3. Queda automáticamente como `OWNER` del equipo
4. Desde **Settings** (engranaje) → pestaña Miembros → agrega colaboradores por nombre/email
5. Puede promover a `CO_MANAGER` desde el mismo panel

---

*Creado: 2026-05-25*

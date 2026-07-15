# Changelog — Configuración Intranet

Formato: fecha → cambio → archivos.  
**Sin commits automáticos** — el usuario revisa y commitea cuando decida.

---

## 2026-07-16 — Fase 3a Tareas v2: caché de directorio (Cursor)

### Objetivo

Sincronizar personas y áreas del directorio intranet hacia `task-backend` en una tabla de
**referencia global** (`directory_cache`), sin tocar `ListConfig` ni `TeamMember` (personalización
por equipo). Ver corrección en `AGENT-HANDOFF.md` Fase 3a.

### Cambios implementados

#### 1. Tabla Prisma `DirectoryCache`

- **Archivo:** `task-backend/prisma/schema.prisma`
- **Migración:** `task-backend/prisma/migrations/20260716000000_add_directory_cache/migration.sql`
- Campos: `externalId`, `nombre`, `tipo` (persona|area), `intranetUserId` (opcional, para personas
  con cuenta intranet), `syncedAt`. Unique `[tipo, externalId]`.

#### 2. Fetch helper reutilizado

- **Archivo:** `task-backend/src/utils/intranetFetch.ts`
- `mintServiceToken()` + `fetchIntranet()` — mismo patrón que `zymoally-backend` masterDataSync.

#### 3. Servicio de sync

- **Archivo:** `task-backend/src/services/directoryCacheSync.ts`
- Fuentes: `GET /areas`, `GET /tc/personas?estado=Activo&limit=500`
- Upsert **solo** en `directory_cache`. Lock en memoria anti-solapamiento.

#### 4. API REST

- **Router:** `task-backend/src/routers/directoryCache.ts`
- `GET /api/directory/cache?tipo=&q=&limit=` — búsqueda en caché
- `GET /api/directory/stats` — conteos y última sync
- `POST /api/directory/sync` — sync manual
- **Gate:** `requireDirectoryManager` (admin, owner/co_gestor de algún equipo, o `tool_task_manage_dev`)

#### 5. Cron

- **Archivo:** `task-backend/src/jobs/scheduler.ts`
- Horario `0 6,12,16 * * *` America/Bogota (igual que ZymoAlly).

#### 6. Config

- `task-backend/src/config/env.ts` → `SYNC_SERVICE_EMAIL`
- `docker-compose.yml` → `SYNC_SERVICE_EMAIL` en servicio `task-backend`

#### 7. UI conveniencia (Settings Tareas v2)

- **Hook:** `frontend/src/hooks/useDirectoryCache.ts`
- **UI:** `frontend/src/components/tareas/views/SettingsView.tsx`
- Tab "Directorio T&C" al agregar miembro: busca caché, botón sync, agrega vía `addMember` solo si
  `intranetUserId` existe (acción manual explícita, mismo endpoint de siempre).

### Verificación

- `npx tsc --noEmit` en `task-backend/` — OK
- `npm run build` en `frontend/` — OK

### Prerrequisito operativo

- Variable `SYNC_SERVICE_EMAIL` apuntando a un usuario admin real en la BD Python (igual que ZymoAlly).

### No incluido

- Commits / push.
- Sync de sedes/plataformas a ListConfig (deliberadamente fuera — personalización por equipo).
- Fase 3b (filtros configurables por herramienta).

---

## 2026-07-16 — Hub visual de Configuración + corrección Fase 3a (Claude Code)

### Objetivo

Consolidar el punto de entrada (top-right, solo admin) en un solo lugar bien diseñado y
señalizado, sin tocar la lógica de roles/permisos que dejó Cursor. Además, corregir el plan de
Fase 3a antes de que se implemente mal para Tareas v2.

### Cambios implementados

#### 1. Hub central `/admin/configuracion`

- **Archivo nuevo:** `frontend/src/pages/admin/ConfiguracionIntranetPage.tsx`
- 3 tarjetas animadas (Usuarios, Roles y permisos, Áreas y sedes) + aviso explícito de que esto
  es solo lo GENERAL, cada herramienta mantiene su config propia.

#### 2. `TopBar.tsx` — dropdown de admin consolidado

- Los 3 links sueltos (Usuarios/Roles/Áreas) pasan a un solo item "Configuración de la
  intranet" → hub. Sin cambios al guard (`role === "admin"`).

#### 3. `AdminConfigNav.tsx` rediseñado

- **Nota:** este archivo era un draft de Cursor sin commitear (nunca llegó a git) — se
  reemplazó por completo. Nada se perdió a nivel de git, pero si Cursor tenía esa sesión
  abierta con el archivo en progreso, puede haber choque al retomarlo.
- Ahora con iconos, estado activo, y link "← Configuración de la intranet" de vuelta al hub.

#### 4. Corrección Fase 3a (Tareas v2) — ver `AGENT-HANDOFF.md`

- El patrón de `masterDataSync.ts` (upsert directo) **no aplica** a `ListConfig`/`TeamMember`
  de Tareas v2 porque son datos personalizados **por equipo** — un sync directo pisaría esa
  personalización. Corrección detallada en `AGENT-HANDOFF.md` → Fase 3a.
- SAC descartado como candidato de sync (sus 5 listas no vienen de ningún directorio) — ya
  tiene panel propio (`SacConfigDialog.tsx`).

### Verificación

- `npm run build` en `frontend/` — OK.

### No incluido en este cambio

- Commits / push (pendiente autorización del usuario).
- Implementación de la Fase 3a corregida (caché de referencia para Tareas v2) — queda para
  quien la construya, con la corrección ya documentada.

---

## 2026-07-15 — Fase 1 + Fase 2 parcial

### Objetivo

Completar catálogo de permisos en admin, corregir JWT para backends Node, unificar navegación entre pantallas de configuración.

### Cambios implementados

#### 1. Catálogo completo de permisos agrupados

- **Archivo:** `frontend/src/lib/roles.ts`
- **Qué:** `INTERNAL_MODULE_GROUPS` con todos los `mod_*` usados en código.
- **Agregados a RolesPage:** T&C (4), Tickets (2), SAC (2), Gerencial, Mantenimiento.
- **Comentario:** distinción `app_permissions` vs `user_tools`.

#### 2. JWT incluye app_permissions al login

- **Archivo:** `backend/app/routers/auth.py`
- **Qué:** helper `_permissions_for_role()`; token login incluye `app_permissions`.
- **Por qué:** `zymoally-backend` y `sig-backend` leen permisos del JWT; antes solo tenían `role` → 403 para usuarios no admin/gerente con permiso en BD.

#### 3. Navegación admin unificada

- **Archivo nuevo:** `frontend/src/components/admin/AdminConfigNav.tsx`
- **Integrado en:** `AdminPage.tsx`, `RolesPage.tsx`, `AreasPage.tsx`
- **Links:** Usuarios | Roles y permisos | Áreas y sedes

#### 4. Textos de ayuda en pantallas admin

- RolesPage: aviso re-login tras cambiar permisos.
- AdminPage: Herramientas ≠ permisos del rol.
- AreasPage: áreas/sedes como fuente maestra.

#### 5. Helpers SAC en permissions.ts

- **Archivo:** `frontend/src/lib/permissions.ts`
- **Qué:** `canSeeSAC()`, `canConfigSAC()` (preparación UI futura).

#### 6. Corrección doc interna Cursor

- **Archivo:** `.cursor/rules/01-stack.mdc`
- **Qué:** `mod_tyc` → `mod_tc`

### Verificación

- `npm run build` en `frontend/` — OK.

### No incluido en este cambio

- Commits / push.
- Fase 3 (sync directorio a más módulos, filtros por equipo).
- Ampliar `user_tools` más allá de Tareas v2.
- Actualizar `CLAUDE.md` / `ESTADO_PROYECTO.md`.
- Seed `mod_tc_sensible` en rol `talento_cultura`.

---

## Plantilla para entradas futuras

```markdown
## YYYY-MM-DD — Título breve

### Objetivo
...

### Cambios
- Archivo: descripción

### Verificación
...

### Pendiente
...
```

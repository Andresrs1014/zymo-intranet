# Configuración de la Intranet — documentación para agentes

**Última actualización:** 2026-07-16  
**Audiencia:** agentes IA (Cursor, MiniMax, Claude Code, etc.) que trabajen en zymo-intranet  
**Acceso humano:** solo administradores (`role === "admin"`)

---

## Propósito del módulo

Centralizar la gobernanza de la intranet en dos ejes:

1. **Quién ve qué** — roles (`app_permissions`) y herramientas por usuario (`user_tools`).
2. **De dónde salen los datos** — directorio T&C + catálogos globales (áreas, sedes) como fuente de verdad para los selects de cada herramienta, con filtros por equipo/herramienta.

Este directorio documenta el **estado real del código**, decisiones tomadas y trabajo pendiente. No inventar arquitectura nueva sin leer estos archivos primero.

---

## Índice de documentos

| Archivo | Contenido |
|---------|-----------|
| [00-vision-y-alcance.md](./00-vision-y-alcance.md) | Objetivos del negocio, fases, qué está fuera de alcance |
| [01-mapa-configuracion-admin.md](./01-mapa-configuracion-admin.md) | Rutas, pantallas y configs existentes hoy |
| [02-catalogo-permisos.md](./02-catalogo-permisos.md) | Todos los `mod_*`, `user_tools`, seeds, guards |
| [03-directorio-fuente-de-verdad.md](./03-directorio-fuente-de-verdad.md) | APIs T&C, sync ZymoAlly, gaps por módulo |
| [CHANGELOG.md](./CHANGELOG.md) | Cambios implementados por fecha (sin commits automáticos) |
| [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) | Instrucciones rápidas para retomar el trabajo |

---

## Reglas para agentes

1. **Reutilizar antes de crear** — ver [01-mapa-configuracion-admin.md](./01-mapa-configuracion-admin.md) y [03-directorio-fuente-de-verdad.md](./03-directorio-fuente-de-verdad.md).
2. **Permiso canónico T&C:** `mod_tc` (no `mod_tyc` — nombre obsoleto en docs viejos).
3. **No commitear** salvo que el usuario lo pida explícitamente.
4. **Tras cambiar permisos de rol:** el usuario debe **cerrar sesión y volver a entrar** (JWT incluye `app_permissions` desde 2026-07-15).
5. **Directorio T&C** vive en Python (`/tc/*`, SQLite `personal.db`) — no hay `tyc-backend` Node.

---

## Archivos de código clave

| Área | Ruta |
|------|------|
| Catálogo permisos UI | `frontend/src/lib/roles.ts` |
| Guards frontend | `frontend/src/lib/permissions.ts` |
| Nav admin | `frontend/src/components/admin/AdminConfigNav.tsx` |
| Pantallas admin | `frontend/src/pages/AdminPage.tsx`, `RolesPage.tsx`, `AreasPage.tsx` |
| JWT + `/auth/me` | `backend/app/routers/auth.py` |
| Permisos backend Python | `backend/app/core/permissions.py` |
| Sync maestros Tickets (upsert directo) | `zymoally-backend/src/services/masterDataSync.ts` |
| Caché directorio Tareas v2 (referencia) | `task-backend/src/services/directoryCacheSync.ts` |
| Fetch intranet (compartido) | `task-backend/src/utils/intranetFetch.ts` |
| Spec sync previo | `docs/superpowers/specs/2026-07-15-zymoally-master-data-sync-design.md` |

---

## Estado resumido (2026-07-16)

| Fase | Tema | Estado |
|------|------|--------|
| **Fase 1** | Catálogo permisos + JWT con `app_permissions` + nav admin | ✅ Implementado (sin commit) |
| **Fase 2** | Hub admin visible | ✅ Parcial (nav + hub según agente; ver CHANGELOG) |
| **Fase 3a** | Caché directorio Tareas v2 | ✅ Implementado (sin commit) |
| **Fase 3b** | Filtros configurables por herramienta/equipo | ⏳ Pendiente |

Ver detalle en [CHANGELOG.md](./CHANGELOG.md) y [AGENT-HANDOFF.md](./AGENT-HANDOFF.md).

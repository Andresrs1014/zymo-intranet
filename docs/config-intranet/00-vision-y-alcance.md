# Visión y alcance — Configuración de la Intranet

## Contexto (decisión del negocio)

La intranet necesita un **corazón de datos** (directorio T&C + catálogos globales) y una **capa de configuración admin** donde solo administradores definan:

- Qué módulos/herramientas ve cada rol o usuario.
- Qué datos maestros consume cada herramienta (Área, Plataforma, Personas, Capacitaciones).
- Qué subconjunto de personas aparece en cada herramienta (filtro por equipo — no todos en todos lados).

## Principio rector

> Si un campo se llama "Área" en cualquier herramienta, debe salir del directorio/catálogo intranet, no de listas estáticas duplicadas.

Patrón de referencia ya implementado: sync ZymoAlly Tickets → `docs/superpowers/specs/2026-07-15-zymoally-master-data-sync-design.md`.

## Fases acordadas

### Fase 1 — Roles y permisos operativos ✅

- Completar catálogo en RolesPage (`INTERNAL_MODULES` / grupos).
- Incluir `app_permissions` en el JWT al login (backends Node dependían de esto).
- Nav admin unificada entre Usuarios / Roles / Áreas.

**Implementado 2026-07-15** — ver [CHANGELOG.md](./CHANGELOG.md).

### Fase 2 — Hub admin legible ✅ (parcial)

- Navegación entre pantallas de configuración.
- Textos que distinguen rol vs herramienta por usuario.

**Pendiente:** portal único con todas las configs de módulo (OC SMTP, T&C WA, etc.) — hoy están dispersas.

### Fase 3 — Directorio expuesto a herramientas ⏳

- Clonar patrón `masterDataSync` a otros consumidores (Tareas, SAC, Helix…).
- Capa de **filtro por herramienta/equipo** sobre datos sincronizados.
- Exponer **capacitaciones** donde aplique (hoy solo T&C las consume).

## Fuera de alcance (por ahora)

- Nuevo microservicio `tyc-backend` o BD PostgreSQL para `personal` (plan futuro en `docs/ADMIN_DB_PLAN.md` Fase 2).
- Módulo GH (Gestión Humana) — plan externo, no en repo.
- Portal SAC frontend (backend zymoally existe; UI intranet no).
- Unificar `user_tools` con `app_permissions` en un solo modelo.

## Quién accede

| Recurso | Guard |
|---------|-------|
| `/admin/configuracion/*` | `AdminRoute` → solo `role === "admin"` |
| Config por módulo (OC, T&C, Tickets dialog) | Permisos específicos del módulo |

La **configuración global de intranet** (roles, usuarios, áreas) es **exclusiva de admin**.

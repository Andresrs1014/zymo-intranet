# Directorio T&C — fuente de verdad para herramientas

## Arquitectura de datos

| Dato | API canónica | Almacenamiento |
|------|--------------|----------------|
| Áreas globales | `GET /areas` | PostgreSQL `Area` |
| Sedes / plataformas | `GET /sedes` | PostgreSQL `Sede` |
| Personas | `GET /tc/personas` | SQLite `personal.db` → `ptc_persona` |
| Cargos | `GET /tc/cargos`, `/tc/cargos-sig` | `ptc_cargo` |
| Capacitaciones | `/tc/capacitaciones/*` | `ptc_capacitacion` |

**Backend:** Python FastAPI puerto 8001, routers en `backend/app/routers/personal.py`, `tc_*.py`.  
**No existe** `tyc-backend` Node.

Migración PostgreSQL planificada: `docs/ADMIN_DB_PLAN.md` Fase 2 (no implementada).

---

## Pipeline objetivo (visión Fase 3)

```
Filtro por herramienta/equipo
        ↓
Datos maestros ← Directorio intranet (Python)
        ↓
Copia local del módulo (upsert por externalId)
        ↓
Admin puede ocultar/reordenar (isActive, sortOrder)
        ↓
Selects del formulario de cada herramienta
```

Spec detallada del primer consumidor:  
`docs/superpowers/specs/2026-07-15-zymoally-master-data-sync-design.md`

---

## Implementado hoy — ZymoAlly Tickets

**Código:** `zymoally-backend/src/services/masterDataSync.ts`

| Campo formulario | Fuente | Destino local |
|------------------|--------|---------------|
| Área | `GET /areas` | `ZymoAreaPrefix` |
| Plataforma | `GET /sedes?para_solicitudes_oc=true` | `ZymoConfigList` platforms |
| Supervisor/Analista/Coordinador | `GET /tc/personas?estado=Activo&limit=500` | `ZymoConfigList` (heurística por nombre cargo) |
| Manager | `GET /api/tasks-v2/users` | `ZymoConfigList` managers |

**Disparo:** cron 6/12/16h + `POST /api/tickets/config/sync` (`mod_tickets_config`).  
**Auth sync:** JWT servicio con `SYNC_SERVICE_EMAIL` (usuario admin en BD Python).

**Upsert:** match por `externalId`; no borra; respeta `isActive` y orden manual del admin.

---

## Consumo por módulo (estado 2026-07-16)

| Módulo | Áreas | Sedes | Personas | Capacitaciones | Sync local |
|--------|-------|-------|----------|----------------|------------|
| **T&C UI** | Live `/areas` | Live `/sedes` | Live `/tc/personas` | Solo T&C | — |
| **OC / Operativo** | Live | Live | — | — | — |
| **ZymoAlly Tickets** | Sync | Sync | Sync | — | ✅ upsert directo (lista global, sin personalización por equipo) |
| **ZymoAlly SAC** | — | — | — | — | **N/A** — 5 listas son opciones subjetivas de encuesta, no entidades del directorio. Tienen panel propio editable a mano (`SacConfigDialog.tsx`, 2026-07-16). No clonar el sync acá. |
| **Tareas v2** | Caché sync | Caché sync | Caché sync (referencia) | — | ✅ `directory_cache` — **NO** escribe ListConfig/TeamMember. UI "Directorio T&C" en Settings al agregar miembro. Ver `task-backend/src/services/directoryCacheSync.ts`. |
| **Helix** | — | — | Proxy usuarios *(roto: endpoint incorrecto)* | — | ❌ |
| **SIG** | SigArea local | — | `/tc/cargos-sig` live | — | ❌ |

---

## Filtro por herramienta/equipo — gaps

| Mecanismo existente | Qué filtra |
|---------------------|------------|
| `user_tools` | Acceso a Tareas v2 (no los selects) |
| Task `TeamMember` | Assignees = solo miembros del equipo |
| `ZymoConfigList.isActive` | Ocultar filas post-sync en Tickets |
| Heurística cargo en sync | supervisor/analista/coordinador por nombre |

**No existe:** config admin que diga "en herramienta X solo estos usuarios/áreas".

---

## Capacitaciones

Endpoints: `backend/app/routers/tc_capacitaciones.py`  
Consumidores: solo páginas T&C (`TyCCapacitacionesPage`, persona, eventos, indicadores).

**Pendiente Fase 3:** definir qué herramienta las necesita y exponer vía API o sync.

---

## Referencias cruzadas

- Módulo T&C completo: auditoría en chat 2026-07-15; código en `frontend/src/pages/tc/`
- Plan sync implementado: `docs/superpowers/plans/2026-07-15-zymoally-master-data-sync.md`

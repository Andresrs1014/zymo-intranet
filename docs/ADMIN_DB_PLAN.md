# Plan de Migración de Bases de Datos — ZYMO Intranet
> Creado: 2026-06-29 | Objetivo: eliminar SQLite del backend Python y centralizar en PostgreSQL, con `sig-db` como base principal del agente ZYMO / RAG.

---

## 1. Estado actual

### PostgreSQL — Ya en producción (Node backends via Prisma)

| Servicio | Base | Puerto | Contenido |
|---|---|---|---|
| `sig-backend` | `sig-db` | **5436** | Procedimientos, instructivos, análisis IA, commits, cargos |
| `helix-backend` | `helix-db` | 5433 | Sprints, actividades, ROI, alertas, encuestas |
| `task-backend` | `task-db` | 5434 | Tareas dev, workspaces, equipos, notificaciones |

### SQLite — Pendiente migrar (Python/FastAPI backend)

| Archivo | Contenido | Tablas clave |
|---|---|---|
| `intranet.db` | Usuarios, roles, permisos, sedes, áreas | `users`, `roles`, `sede`, `area` |
| `oc.db` | Compras, cotizaciones, mantenimiento, config SMTP | `solicitudoc`, `cotizacion`, `ordencompra`, `mnt_solicitudes`, `oc_config` |
| `sgc.db` | Catálogo de proveedores | `proveedorsgc` |
| `financiero.db` | Facturas y validaciones | `facturaproveedor`, `validacionfactura` |
| `agents.db` | Sesiones ZYMO, memoria, acciones, reportes, tareas dev | `agent_sessions`, `agent_actions`, `agent_memory`, `zymo_reportes`, `dev_tareas` |
| `personal` (en `intranet.db`) | Directorio T&C: personas, cargos, áreas T&C | `ptc_persona`, `ptc_cargo`, `ptc_area` |

---

## 2. Arquitectura objetivo

```
┌─────────────────────────────────────────────────────────────────┐
│               BASE PRINCIPAL — sig-db  (puerto 5436)            │
│                                                                 │
│  sig_*          → Procedimientos, instructivos, análisis IA     │
│                   (LightRAG se alimenta de aquí)                │
│                                                                 │
│  ZYMO RAG       → Jarvis (rag1) y Ultron (rag2) leen sig-db    │
│                   como fuente primaria de conocimiento          │
└─────────────────────────────────────────────────────────────────┘
         ▲ fuente de verdad documental
         │
┌────────┴────────────────────────────────────────────────────────┐
│               NUEVA BD PRINCIPAL PYTHON — zymo-db (puerto 5435) │
│                                                                 │
│  Schema: intranet   → users, roles, sedes, áreas               │
│  Schema: oc         → solicitudes, cotizaciones, OC, mant.     │
│  Schema: sgc        → proveedores                              │
│  Schema: financiero → facturas, validaciones                   │
│  Schema: personal   → ptc_persona, ptc_cargo, ptc_area         │
│  Schema: agents     → sesiones, memoria, reportes, dev_tareas  │
│  Schema: gerencial  → tareas Andrés, órdenes directas (piloto) │
└─────────────────────────────────────────────────────────────────┘
         │  el agente ZYMO consulta zymo-db para contexto operativo
         │  y sig-db para contexto documental/RAG

helix-db (5433) y task-db (5434) — SIN CAMBIOS — permanecen autónomos
```

### Por qué dos PostgreSQL y no uno

`sig-db` es manejado por `sig-backend` (Node/Prisma) con su propio ciclo de migraciones. Mezclar el dominio del Python backend ahí crearía acoplamiento entre dos runtimes y rompería los Dockerfiles actuales. `zymo-db` centraliza todo lo de Python, y ZYMO tiene acceso de lectura a ambas BDs para construir el grafo RAG completo.

---

## 3. `sig-db` como base principal del RAG

El agente ZYMO con LightRAG necesita conocer:
- **Qué hace la empresa** → procedimientos y instructivos (`sig-db`)
- **Quién lo hace** → cargos T&C (`zymo-db.personal`)
- **Cómo opera hoy** → compras, OC, tiempos (`zymo-db.oc`)

El flujo de indexación RAG queda así:

```
sig-db (Procedimientos + Instructivos)
        ↓  LightRAG indexa
   Jarvis (rag1) — empresa real
   Ultron (rag2) — empresa con procedimientos corregidos
        ↓  ZYMO consulta + enriquece con
zymo-db (personas, OC, agentes, gerencial)
        ↓  respuesta contextualizada al usuario
```

---

## 4. Fases de migración

### Fase 0 — Preparación (sin tocar producción)

- [ ] Crear servicio `zymo-db` en `docker-compose.yml` (PostgreSQL 15, puerto 5435)
- [ ] Agregar `ZYMO_DATABASE_URL` al `.env` del backend Python
- [ ] Crear script de migración base `backend/scripts/migrate_to_postgres.py`
- [ ] Verificar que `docker compose up --build -d` levanta `zymo-db` sin errores

```yaml
# Bloque a agregar en docker-compose.yml
zymo-db:
  image: postgres:15-alpine
  environment:
    - POSTGRES_USER=${ZYMO_DB_USER:-zymo}
    - POSTGRES_PASSWORD=${ZYMO_DB_PASSWORD}
    - POSTGRES_DB=${ZYMO_DB_NAME:-zymodb}
  ports:
    - "5435:5432"
  volumes:
    - zymo_db_data:/var/lib/postgresql/data
  restart: unless-stopped
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${ZYMO_DB_USER:-zymo}"]
    interval: 5s
    timeout: 5s
    retries: 5
```

### Fase 1 — Migrar `intranet.db` (usuarios y roles) 🔴 Alta

**Por qué primero:** todos los demás dominios dependen de `user_id`. Es la llave maestra.

- [ ] Crear `backend/app/database.py` unificado con SQLAlchemy + asyncpg apuntando a `zymo-db`
- [ ] Crear tablas `users`, `roles`, `sede`, `area` en `zymo-db` (schema `intranet`)
- [ ] Script de volcado SQLite → PostgreSQL para datos existentes
- [ ] Actualizar `auth.py` para leer de PostgreSQL
- [ ] Mantener `intranet.db` como fallback read-only hasta pruebas completas
- [ ] Prueba: login + JWT + `/auth/me` funciona contra `zymo-db`

### Fase 2 — Migrar `personal` (T&C directorio) 🔴 Alta

**Por qué segundo:** `ptc_persona` y `ptc_cargo` los referencia `sig-db` (cargos involucrados en procedimientos). Estabilizarlos antes de conectar con SIG.

- [ ] Tablas `ptc_area`, `ptc_cargo`, `ptc_persona` en schema `personal`
- [ ] Script volcado desde `_persona_dict` / `intranet.db`
- [ ] Migrar las 164 personas del archivo fuente `Data_Personal_ZYMO_2026-06-17 (1).js`
- [ ] Actualizar `routers/personal.py` para usar la conexión PostgreSQL
- [ ] Verificar que `sig-db.SigProcedimientoCargo.cargoId` sigue siendo válido (referencia de honor sin FK)

### Fase 3 — Migrar `oc.db` (compras y mantenimiento) 🟡 Media

- [ ] Crear schema `oc` en `zymo-db` con todas las tablas de `oc_database.py`
- [ ] Crear schema `mantenimiento` para `mnt_solicitudes`, `mnt_aprobaciones`, `mnt_activos_qr`
- [ ] Migrar patrón de migration inline (`ALTER TABLE … ADD COLUMN`) a migraciones Alembic propias
- [ ] Script de volcado `oc.db` → `zymo-db`
- [ ] Actualizar `routers/oc/` y `routers/mantenimiento/`
- [ ] Validar magic link (mantenimiento móvil) funciona sin `get_oc_db`

### Fase 4 — Migrar `sgc.db` y `financiero.db` 🟡 Media

- [ ] Schema `sgc` → tabla `proveedorsgc`
- [ ] Schema `financiero` → tablas `facturaproveedor`, `validacionfactura`
- [ ] Scripts de volcado respectivos
- [ ] Actualizar routers de SGC y Financiero

### Fase 5 — Migrar `agents.db` (ZYMO / RAG) 🟢 Alta prioridad estratégica

**Este schema alimenta directamente al agente ZYMO.**

- [ ] Schema `agents` en `zymo-db`: `agent_sessions`, `agent_actions`, `agent_memory`, `zymo_reportes`
- [ ] Schema `gerencial`: `gerencial_tareas` (tareas Andrés + Andrea), `gerencial_ordenes`
- [ ] Actualizar `backend/app/agents/` para usar PostgreSQL
- [ ] Agregar índice en `agent_memory.clave` + `agent_memory.user_id` (consulta frecuente de ZYMO)
- [ ] Agregar índice en `zymo_reportes.leido` + `zymo_reportes.created_at`

### Fase 6 — Limpieza

- [ ] Eliminar archivos `.db` del volumen una vez validado cada schema
- [ ] Remover funciones `_migrate_*_db()` de `main.py`
- [ ] Remover imports de `create_engine` SQLite
- [ ] Actualizar `CLAUDE.md` con nueva tabla de bases de datos
- [ ] Actualizar `ESTADO_PROYECTO.md`

---

## 5. Mapa de puertos final

| Servicio | Base | Puerto | Motor | Quien escribe |
|---|---|---|---|---|
| `sig-backend` | `sig-db` | **5436** | PostgreSQL 15 | Node/Prisma |
| `backend` (Python) | `zymo-db` | **5437** | PostgreSQL 15 | Python/SQLAlchemy |
| `helix-backend` | `helix-db` | 5433 | PostgreSQL 15 | Node/Prisma |
| `task-backend` | `task-db` | 5434 | PostgreSQL 15 | Node/Prisma |

---

## 6. Variables de entorno a agregar en `backend/.env`

```env
# Nueva BD principal Python
ZYMO_DATABASE_URL=postgresql+asyncpg://zymo:password@zymo-db:5432/zymodb

# Credenciales (mismas en docker-compose.yml)
ZYMO_DB_USER=zymo
ZYMO_DB_PASSWORD=cambiar_en_produccion
ZYMO_DB_NAME=zymodb
```

---

## 7. Dependencias Python a agregar

```
asyncpg==0.29.0
alembic==1.13.1
```

`SQLModel` ya está instalado y soporta asyncpg. No se requiere ORM nuevo.

---

## 8. Criterio de done por fase

Cada fase está completa cuando:
1. `npx tsc --noEmit` sin errores (si toca frontend)
2. `docker compose up --build -d` pasa sin errores
3. Los endpoints del dominio migrado responden igual que antes
4. El `.db` de SQLite correspondiente ya no es necesario para levantar el sistema

---

## 9. Impacto en ZYMO RAG (objetivo final)

Una vez completadas las 6 fases, el agente ZYMO puede construir contexto desde:

| Fuente | Qué aporta al RAG |
|---|---|
| `sig-db` (principal documental) | Procedimientos, instructivos, flujogramas, análisis IA de documentos |
| `zymo-db.personal` | Quién es cada cargo, área a la que pertenece, jerarquía |
| `zymo-db.oc` | Historial de compras, proveedores usados, tiempos de proceso |
| `zymo-db.agents` | Memoria de sesiones anteriores, decisiones registradas |
| `zymo-db.gerencial` | Tareas de desarrollo, impacto en negocio, órdenes directas |

**`sig-db` es la base principal** porque contiene el conocimiento documentado de cómo opera la empresa — los procedimientos son el "manual de instrucciones" que LightRAG indexa para que ZYMO entienda la organización.

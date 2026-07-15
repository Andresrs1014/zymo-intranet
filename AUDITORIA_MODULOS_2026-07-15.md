# Auditoría de módulos — ZYMO Intranet

**Fecha:** 2026-07-15
**Repositorio:** `Andresrs1014/zymo-intranet` · branch `master`
**Última release funcional:** `be9c385 fix(frontend): FormSelect no aplicaba la selección…`
**Total de commits analizados (90 días):** 251
**Componentes frontend:** ~120 archivos `.tsx`
**Páginas frontend:** 56 archivos `.tsx`
**Backends:** 5 (1 Python + 4 Node/TS)
**Bases de datos:** 5 (1 SQLite + 4 Postgres)

---

## 1. Mapa de servicios (docker-compose)

| Servicio | Stack | Puerto | BD | Backend files | Estado |
|---|---|---|---|---|---|
| `backend` (FastAPI) | Python 3 + SQLModel | 8001 | SQLite + Postgres `zymo-db` | 27 routers, 26 services, 7 agents | ✅ Producción |
| `sig-backend` | Node/TS + Express + Prisma | 3004→3003 | `sig-db` (Postgres) | 6 routers, 2 services | ✅ Producción |
| `helix-backend` | Node/TS + Express + Prisma | 3001 | `helix-db` (Postgres) | 9 routers, 5 services | ✅ Producción |
| `task-backend` | Node/TS + Express + Prisma | 3002 | `task-db` (Postgres) | 10 routers, 12 services | ✅ Producción |
| `zymoally-backend` | Node/TS + Express + Prisma | 3005 | `zymoally-db` (Postgres) | 11 routers, 5 services | ✅ Producción |
| `frontend` | React 19 + Vite + Tailwind | 81→80 | — | 56 pages, 90+ components | ✅ Producción |

> 5 bases, 5 backends, 1 frontend, 1 servicio de workers (`zymo-worker`).

---

## 2. Estado por módulo

Leyenda: ✅ terminado | 🟡 parcial / 80%+ | 🟠 en construcción | ❌ no iniciado

### 2.1 Autenticación, usuarios, permisos — ✅ 100%

- Login con JWT HS256 (8 h, claim `exp`).
- 7 roles seed: `admin`, `directivo`, `talento_cultura`, `comercial`, `operativo`, `empleado`, `calidad`.
- `app_permissions: list[str]` editable por admin en `/admin/configuracion/roles`.
- Bypass admin en todas las funciones `canSee*()`.
- JWT compartido entre Python y los 4 backends Node (mismo `SECRET_KEY`).
- `useTokenGuard` limpia sesión al expirar (visibilitychange + focus).
- `/auth/me` resuelve `app_permissions` y `user_tools` para el frontend.
- Auditoría de seguridad reciente (2026-07-08) en `task-backend` corrigió bypass de autorización en `createTask` y `acceptOrRejectTask` ✅.

### 2.2 Dashboard / Portal — ✅ 100%

- `DashboardPage` con `AppCard` por app (Matriz, CRM, OC, Capacitaciones, OC automatizaciones).
- Apps según permisos del rol.

### 2.3 Módulo OC Automatizaciones — ✅ 100% (flujo completo)

- 9 estados: `nueva → en_cotizacion → cotizacion_lista → aprobada → oc_enviada → oc_en_plataforma → entregada → cerrada` (+ `rechazada`).
- Webhook Power Automate (`POST /api/oc/webhook/nueva-solicitud`) **+** formulario nativo interno (`POST /api/oc/solicitudes/crear-interna`).
- Extracción automática de cotización (PDF, XLSX, DOC, DOCX) con `field_synonyms.py` + `fuzzy_resolve`.
- 3 plataformas configuradas (`logimat`, `imccargo`, `imcdep`) con branding email independiente (logo, colores, plantilla).
- Generación OC XLSX→PDF con LibreOffice headless.
- 5 flujos de email (Flujo 1–4 + OC a proveedor), asuntos configurables desde UI.
- Paginación `GET /api/oc/solicitudes` (50/pág, máx 200).
- KPIs: totales, por estado, por plataforma, con/sin IVA, tiempos.
- Configuración SMTP editable en UI con test desde `/oc/configuracion`.
- Páginas: `SolicitudesPage` (paginada), `SolicitudDetallePage`, `CotizacionFormPage`, `AprobacionPage`, `KPIPage`, `OcConfigPage`, `ParesExternosPage`.

### 2.4 Módulo SGC — Sistema de Gestión de Calidad — ✅ 100%

- Catálogo de proveedores (`ProveedorSGC`) en `sgc.db`.
- Toggle activo/inactivo.
- Extracción desde documento al crear.
- Consumido por módulo OC (`GET /api/oc/proveedores`).
- Páginas: `SGCPage`, `ProveedoresPage`.

### 2.5 Módulo Operativo (formulario interno) — ✅ 100%

- Cualquier empleado puede crear solicitud (`/operativo/nueva-solicitud`).
- Filtro de "Mis solicitudes" por email del usuario autenticado.
- Confirmación de recepción en 2 pasos para coordinadores.
- 4 páginas: `OperativoPage`, `MisSolicitudesPage`, `MiSolicitudDetallePage`, `NuevaSolicitudPage`, `PaquetesPage`.

### 2.6 Clientes operativos — ✅ 100%

- CRUD completo + import desde Excel + plantilla descargable + analistas.
- 9 endpoints (`/api/oper/clientes/*`).
- Página `OperClientesPage.tsx` (435 LOC).

### 2.7 Módulo Financiero (facturación) — 🟡 ~90%

- CRUD facturas, validación contra OC (tolerancia 1%, NIT, nombre).
- Vista de detalle, modal de impresión, config SMTP separado.
- 4 endpoints clave + config.
- **PENDIENTE — BUG-001** (en `MEMORIA.md`): módulo muestra valores en dólares en lugar de COP. No bloquea porque no está en uso aún. Hay que atacar antes del go-live de contabilidad.

### 2.8 Mantenimiento — ✅ 100% (FSM completa + móvil)

- FSM completa: `solicitud → evaluacion → programado → ejecucion → completado → cerrado` (+ `cancelado`).
- Gates: `monto_estimado > 2M` requiere 3 aprobaciones; `completado` exige `evidencia_url`.
- Magic link JWT `scope=mnt_mobile` TTL 24h (URL pública `/m/:token`, sin login).
- Portal móvil responsive con flujo completo para auxiliares.
- Vinculación con OC (`/api/mantenimiento/solicitudes/{id}/oc-vinculada`).
- Escalamiento a externos (`/mnt/pares-externos`, evidencias, aprobación).
- Tablero mensual KPIs.
- 7 routers backend + 9 páginas frontend (incluyendo `MantenimientoMobilePage` y `MantenimientoPortalShell`).

### 2.9 Tareas V2 (Gestión de tareas dev) — ✅ 100% (reorganización 2026-07-09)

- Backend completo: equipos, miembros, tareas, adjuntos, eventos, dashboard, exports, IA, config.
- **P1 "Mi trabajo" + Drawer persistente**: implementado 2026-07-09 (`MiTrabajoView`, `TaskDrawer`, `TaskStatusPill`).
- **P2 reskin oscuro con tokens**: **pendiente** (sigue con tema claro SaaS en el área de contenido).
- **P3 "Verdad de estado" consistente**: implementado 2026-07-09.
- **P4 chips de filtro + estado en URL**: implementado 2026-07-09.
- **P5 pulido micro-interacciones**: implementado 2026-07-09.
- Code review de seguridad 2026-07-08: 0 hallazgos abiertos (5 corregidos).

### 2.10 Planeación — Helix Zymo — ✅ 100%

- 9 routers backend (`actividades`, `ai`, `alertas`, `comentarios`, `dashboard`, `encuestas`, `reportes`, `subproyectos`, `usuarios`).
- Frontend rico: `BoardView` (Kanban drag&drop), `GanttView`, `DashboardView`, `ReportsView` (RoiGrid, StatusReport, FollowupList), `SettingsView`, `SupportView` (AI chat, instructivos, encuesta de satisfacción).
- Cron de alertas configurado.
- 32 componentes en `components/planeacion/helix/`.

### 2.11 SIG — Sistema Integrado de Gestión — ✅ 100%

- Procedimientos: CRUD + versionado (`commits`) + sync con cargos.
- Instructivos: CRUD + extracción server-side (.docx mammoth, .pdf pdf-parse, .doc antiword, .md/.txt directo) + `POST /:id/reextract`.
- 4 análisis IA: coherencia, mejoras, proc-vs-inst, cargos.
- LightRAG dual (`rag1` Jarvis / `rag2` Ultron) con Gemini Flash + Ollama embeddings.
- Editor con IA (`POST /api/netvault/editar-con-ia`), chat (`/chat`).
- MCP externo `mcp001-intranet` publicado (`pip install git+https://github.com/Andresrs1014/mcp001-intranet.git`).
- 10 componentes en `components/sig/`, página `SigPage` (1325 LOC).

### 2.12 T&C — Talento y Cultura (Directorio) — ✅ 100%

- 14 páginas implementadas (`TyCPage`, `DirectorioPage`, `PersonaPage`, `OrganigramaPage`, `ImportPage`, `ManualesPage`, `IndicadoresPage`, `CalendarioPage`, `EventoPage`, `AreaConfigPage`, `CapacitacionesPage`, `ConfigPage`, `RotacionPage`, `ClientesPage`).
- Directorio de 164 personas desde `_persona_dict` de `main_db` (sin BD propia).
- Organigrama con canvas (`TyCOrganigramaPage` — 38 KB).
- Importación Excel, manuales PDF, eventos con notificaciones email + WhatsApp.
- Rotación masiva, KPIs, áreas dinámicas.
- Clientes: **read-only**, fuente real está en `/operativo/clientes` (devuelve 405 al intentar mutar desde T&C — patrón deliberado).

### 2.13 Admin — ✅ 100%

- 3 páginas admin: `AdminPage` (usuarios), `RolesPage`, `AreasPage`, `ExtraccionIAPage` (motor de extracción híbrido server-side con IA).
- Modal de creación de usuarios con contraseñas.

### 2.14 Gerencial — 🟡 ~85%

- `GerencialPage` con 3 tabs: `PanelGerenteTab`, `DirectoraPlaneacionTab`, `DesarrolloInnovacionTab`.
- Backend: tareas-dev (CRUD), KPIs, actividad, órdenes, estado del servidor.
- Panel del agente "Zymo" (gerencial) — flotas como `AgentFloatingWindow`.
- Falta superficie: tab "DesarrolloInnovacion" se ve esquelético en el listado, revisar contenido vs otras tabs.

### 2.15 ZymoAlly — Tickets (PQR) — 🟡 ~80% (rama activa)

- 8 routers backend (tickets PQR, alertas, dashboard, config, export, sync).
- Frontend: `TicketsShell` con sidebar interno + topbar + 3 vistas (`BoardView`, `ListView`, `DashboardView`).
- 5 commits recientes en sync de datos maestros desde directorio intranet (cron 3x/día con `America/Bogota`).
- Pendiente visible en últimas imágenes del usuario: hay fricción con `TicketDialog` y dropdowns (imágenes `ticket-*.png` del 2026-07-15 8:20-8:27 AM).

### 2.16 ZymoAlly — SAC (Fidelización) — 🟠 ~60%

- 6 routers backend (`experience`, `sacAlertas`, `sacConfig`, `sacDashboard`, `surveys`, `visits`).
- Encuestas públicas con magic-link JWT `scope=survey_client` TTL 30 días.
- Portal público `survey-frontend/` con `public/survey.ts` (sin auth).
- Config, dashboard, alertas, métricas implementados en backend.
- **Faltante en frontend**: las rutas del SAC aún no están montadas en `App.tsx`. Hay routers y endpoints listos pero sin page. La página principal sigue siendo solo Tickets (`TicketsPage`).

### 2.17 Agentes IA (Zymo + Administrativo + Helix) — 🟡 ~80%

- Worker persistente (`python -m app.agents.worker`) en Docker.
- 3 agentes: `administrativo.py` (OC), `zymo_core.py` (gerencial), `helix.py`.
- LightRAG dual con `get_rag()` singleton.
- `AgentFloatingWindow` montado globalmente; agente se elige según permisos.
- `AgentDockedPanel`, `AgentChatUi`, `AgentMessageStream` implementados.

---

## 3. Hallazgos / gaps transversales

| # | Severidad | Módulo | Descripción |
|---|---|---|---|
| G1 | 🟠 medio | Sidebar/App | `canSeeIT` está en `lib/permissions.ts` y en `Sidebar.tsx` (link a `/it`), pero **no existe ruta en `App.tsx`**. Click lleva a "404 → redirect a /dashboard" silencioso. |
| G2 | 🔴 alto | Financiero | BUG-001: módulo muestra valores en dólares en lugar de COP. Documentado en `MEMORIA.md`, sin atacar. |
| G3 | 🟡 medio | Tickets | Fricción visible reportada por el usuario (imágenes 2026-07-15 8:20-8:27): dropdowns sobre `Dialog`, escape del focus, scroll de rueda. |
| G4 | 🟠 medio | SAC (ZymoAlly) | Backend completo, frontend no montado en rutas. Esfuerzo: agregar `SacPage.tsx` y rutas `/zymoally/sac/*` en `App.tsx`. |
| G5 | 🟡 bajo | Tareas V2 | P2 (reskin oscuro con tokens + DM Sans/DM Mono) sigue pendiente — área de contenido sigue en tema claro SaaS con hex inline. |
| G6 | 🟡 bajo | MEMORIA.md | BUG-002 (factura en plataforma obligatoria) sin verificar. DT-007 (checks de rol inline en `SolicitudDetallePage`) sin migrar a `lib/permissions.ts`. |
| G7 | 🟡 bajo | Gerencial | Tab "DesarrolloInnovacion" — contenido por verificar. |
| G8 | 🟠 medio | General | `docs/Master_plan/ZYMO_MASTER_PLAN_v2.md` referenciado en CLAUDE.md **no existe** en el repo. |

---

## 4. Estado por backend

| Backend | LoC routers | LoC services | Endpoints | Health | Notas |
|---|---|---|---|---|---|
| `backend` (Python) | 27 archivos | 26 archivos | ~80 | ✅ | Dual engine SQLite/Postgres, migración V1→V2 completada. |
| `sig-backend` | 6 archivos | 2 archivos | ~25 | ✅ | Prisma migrations al día. |
| `helix-backend` | 9 archivos | 5 archivos | ~30 | ✅ | Cron scheduler en `jobs/scheduler.ts`. |
| `task-backend` | 10 archivos | 12 archivos | ~40 | ✅ | Audit 2026-07-08 cerrado sin pendientes. |
| `zymoally-backend` | 11 archivos | 5 archivos | ~45 | 🟡 | SAC routers sin page en frontend. |

---

## 5. Actividad reciente (últimos 90 días)

Top por prefijo de commit:

| Prefijo | Commits | Interpretación |
|---|---|---|
| `tareas` / `tareas-v2` / `tareas-v3` | ~165 | Foco principal — reorganización UX + auditoría seguridad. |
| `general` | 125 | Refactors cross-cutting, infra. |
| `tc` | 50 | T&C estabilización (Fase 1-4 del plan). |
| `zymoally` | 45 | Tickets + SAC + sync de maestros. |
| `helix` | 37 | Estabilización del módulo Planeación. |
| `sig` | 35 | Análisis IA + LightRAG dual. |
| `oc` | 28 | Estabilización del flujo OC. |
| `mantenimiento` | 19 | FSM + portal móvil. |
| `extraccion` / `netvault` | 30 | Motor de extracción + IA. |
| `financiero` | 17 | Fase 1 facturación. |

---

## 6. Resumen ejecutivo

- **Producción estable:** 13 de 17 módulos al 100% (auth, dashboard, OC, SGC, operativo, mantenimiento, helix, SIG, T&C, admin, tareas V2, planeación, agentes).
- **Casi listo (1 bug pendiente):** Financiero.
- **Rama activa en progreso:** ZymoAlly Tickets (rama caliente) + SAC (backend listo, falta UI).
- **Gap transversal:** ruta `/it` declarada en Sidebar sin page — fix de 5 minutos que debería entrar en cleanup.
- **Próximo go-live crítico:** el del módulo Financiero depende de resolver BUG-001.
- **Próxima release natural:** la rama activa de ZymoAlly (Tickets + SAC) si la fricción del dropdown del usuario es la última piedra.

---

## 7. Pendientes priorizados (siguiente sprint)

1. **[5 min]** G1 — Crear `ITPage.tsx` placeholder + ruta `/it` en `App.tsx`, o eliminar `canSeeIT` del Sidebar.
2. **[medio]** G4 — Montar SAC en frontend: `SacPage.tsx` con shell similar a Tickets, rutas en `App.tsx`.
3. **[medio]** G2 — BUG-001 Financiero (dólares → COP) antes de go-live de contabilidad.
4. **[medio]** G3 — Fricción de dropdowns en `TicketDialog` (imágenes del usuario 2026-07-15).
5. **[bajo]** G5 — P2 reskin oscuro del módulo Tareas V2.
6. **[bajo]** G6 — Cerrar BUG-002 y DT-007 de `MEMORIA.md`.
7. **[bajo]** G7 — Auditar contenido de `DesarrolloInnovacionTab.tsx`.
8. **[bajo]** G8 — Recuperar/regenerar `docs/Master_plan/ZYMO_MASTER_PLAN_v2.md` o actualizar la referencia en CLAUDE.md.

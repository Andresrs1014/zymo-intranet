# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Comandos esenciales

### Despliegue completo
```bash
docker compose up --build -d          # Build y levanta todos los servicios
docker compose logs -f sig-backend    # Seguir logs de un servicio específico
docker compose restart sig-backend    # Reiniciar un servicio sin rebuild
```

### Frontend (React 19 + Vite)
```bash
cd frontend
npm run dev          # Dev server (puerto 5173)
npm run build        # Build de producción — ÚNICO chequeo de TS válido, ver gotcha abajo
```

**Gotcha `tsc --noEmit` no revisa nada en `frontend/`:** el `tsconfig.json` raíz usa `files: []` + `references`, así que `npx tsc --noEmit` (desde la raíz o desde `frontend/`) solo valida la config y sale "limpio" incluso con errores de sintaxis/tipos reales delante. El único chequeo confiable es `npm run build` (corre `tsc -b && vite build`). No reportar un cambio de frontend como verificado solo con `tsc --noEmit`.

### Backend Python (FastAPI)
```bash
cd backend
uvicorn app.main:app --reload --port 8001   # Dev server
python -m app.agents.worker                 # Worker de agentes en background
```

### Node backends (sig-backend / helix-backend / task-backend / zymoally-backend)
```bash
cd sig-backend        # o helix-backend / task-backend / zymoally-backend
npm run dev           # Dev con hot-reload (ts-node / nodemon)
npm run build         # Compilar TS → dist/
npx tsc --noEmit      # Verificar TypeScript — OBLIGATORIO antes de commit

# Prisma
npx prisma migrate dev --name <nombre>   # Nueva migración (solo en dev)
npx prisma migrate deploy                # Aplicar migraciones (producción, en CMD del Dockerfile)
npx prisma generate                      # Regenerar cliente (tras cambios en schema.prisma)
npx prisma studio                        # UI para inspeccionar la BD en dev
```

**Convención de testing:** ningún backend Node de este repo usa jest/vitest. Para lógica con riesgo real (condiciones de carrera, generación de códigos únicos, cálculos), el patrón es un script `ts-node` con `assert` (`src/services/*.selfcheck.ts`, ejecutado vía `npm run selfcheck`) que ejercita el caso límite contra la BD real — ver `zymoally-backend/src/services/pqrCode.selfcheck.ts` (verifica códigos de ticket únicos bajo `Promise.all` concurrente). No introducir un framework de test nuevo para un módulo aislado.

### Checks críticos pre-commit (código de servidor)
```
1. npx tsc --noEmit   — sin errores TS (TS6133 rompe Docker build). En frontend/ no sirve, usar `npm run build` (ver gotcha en la sección Frontend).
2. docker compose up --build -d   — build limpio sin errores
3. Ningún import no usado, ninguna variable declarada sin uso
```

**Gotcha `verbatimModuleSyntax`:** el frontend usa `verbatimModuleSyntax: true` en `tsconfig.json`. Importar un tipo como valor rompe el build en Docker aunque funcione en dev. Siempre usar `import type` para tipos:
```ts
// MAL — rompe Docker build con TS1484
import { fetchProcCargoIds, ProcCargoAsignado } from "@/components/sig/..."
// BIEN
import { fetchProcCargoIds, type ProcCargoAsignado } from "@/components/sig/..."
```

---

## Arquitectura de servicios

### Mapa de puertos y bases de datos

| Servicio | Puerto externo | Puerto interno | BD | Puerto BD |
|---|---|---|---|---|
| `backend` (Python/FastAPI) | 8001 | 8001 | SQLite / PostgreSQL | — |
| `frontend` (React/Nginx) | 81 | 80 | — | — |
| `zymo-worker` | — | — | (comparte backend_data) | — |
| `helix-backend` | 3001 | 3001 | `helix-db` | 5433 |
| `task-backend` | 3002 | 3002 | `task-db` | 5434 |
| `sig-backend` | 3004 | 3003 | `sig-db` | 5436 |
| `zymoally-backend` | 3005 | 3005 | `zymoally-db` | 5438 |
| `libertadora-backend` | 3006 | 3006 | `libertadora-db` | 5439 |

### JWT compartido
El backend Python emite el JWT (HS256) con claims `{id, role, sede, area, email}`. **Todos los backends Node** validan ese mismo token usando `SECRET_KEY` de `./backend/.env`. El campo `app_permissions` **no está en el JWT** — se resuelve en el frontend vía `GET /auth/me` después del login.

**Gotcha `full_name` tampoco está en el JWT:** ningún backend Node debe leer `user.full_name` del payload decodificado para mostrar el nombre de quien ejecuta una acción (creador de una tarea, quien sube un adjunto, etc.) — ese campo siempre es `undefined` en runtime y cualquier fallback tipo `` `Usuario ${userId}` `` queda grabado permanentemente en la fila si se usa al crear/loguear. Resolver el nombre real contra `GET /api/tasks-v2/users` del backend Python (acepta `X-Internal-Key` o JWT). Patrón de referencia: `task-backend/src/utils/userNames.ts` (`resolveActorName`, `enrichUserNames`) — reusar ese archivo en vez de reinventar la resolución en cada backend nuevo. `task-backend` también autorepara nombres viejos guardados como "Usuario N" al leer (`listTasks`/`getTask`/`getTaskHistory`), mismo patrón que ya existía en `eventService.listEvents`.

### Patrón de módulo nuevo
Para agregar un módulo (ej. "Gestión Humana"):
1. **`lib/permissions.ts`** — añadir `canSeeGH(role, perms)` siguiendo el patrón `hasPerm()`
2. **`App.tsx`** — añadir `GHRoute` component + rutas `/gh/*`
3. **`Sidebar.tsx`** — añadir entrada condicionada a `canSeeGH()`
4. **Backend Node** — clonar estructura de `sig-backend` (middleware/auth.ts ya tiene el patrón JWT)
5. **`docker-compose.yml`** — nuevo servicio + BD siguiendo el bloque sig-backend/sig-db

### Middleware de autenticación Node (patrón sig-backend)
`sig-backend/src/middleware/auth.ts` es la plantilla. Define:
- `authenticate` — valida JWT HS256
- `requireSigAccess` — verifica `role === 'admin' | 'gerente'` o `app_permissions.includes('mod_sig')`
- `getUserId(user)` — extrae el `id` numérico del claim `id` o `sub`

Clonar y adaptar para cada nuevo backend Node.

---

## Módulos del frontend

### Rutas y páginas

| Ruta | Módulo | Guard |
|---|---|---|
| `/dashboard` | Panel principal | `PrivateRoute` |
| `/administrativo`, `/oc/*` | Órdenes de Compra | `OCRoute` (`mod_oc_ver`) |
| `/operativo/*` | Módulo operativo | `OperativoRoute` (`mod_operativo`) |
| `/sgc/*` | Gestión de Calidad | `SGCRoute` (`mod_sgc`) |
| `/financiero/*` | Financiero | `FinancieroRoute` (`mod_financiero`) |
| `/gerencial` | Gerencial | `GerencialRoute` (`mod_gerencial`) |
| `/sig/*` | SIG (procedimientos + análisis IA) | `SigRoute` (`mod_sig`) |
| `/planeacion/helix` | Helix (sprints/tareas) | `HelixRoute` (`mod_helix`) |
| `/tareas-v2` | Gestión de tareas dev | `PrivateRoute` + `user_tools` |
| `/mantenimiento/*`, `/mantenimiento/tablero` | Mantenimiento | `MantenimientoRoute` |
| `/tc/*` | Talento y Cultura (directorio, organigrama) | `TyCRoute` (`mod_tc`) |
| `/tc/calendario`, `/tc/eventos/*` | Agenda (T&C) | `AgendaRoute` (`mod_tc_agenda`, independiente de `mod_tc`) |
| `/admin/*` | Administración | `AdminRoute` (role=admin) |
| `/m/:token` | Vista móvil auxiliar mantenimiento | **Sin auth** — JWT de scope corto |

> La ruta `/m/:token` es la única completamente pública (sin `PrivateRoute`). Va antes de `<PrivateRoute>` en `App.tsx`.

### Agente flotante (`AgentLayer`)
`AgentFloatingWindow` se renderiza globalmente sobre todas las rutas. Muestra el agente `"zymo"` (gerencial) o `"administrativo"` (OC) según permisos. El store `agentPanelStore` controla si está flotante o docked.

### Token guard
`useTokenGuard` en `App.tsx` limpia la sesión si el JWT expiró, chequeando `visibilitychange` y `focus` — no hay logout automático por timer.

---

## SIG — Sistema Integrado de Gestión (`sig-backend`)

### Routers
- `procedimientos.ts` — CRUD de procedimientos, versionado, commit de documentos, flujogramas MMD
- `instructivos.ts` — instructivos con extracción de texto servidor-side; `POST /:id/reextract` para re-procesar `.doc` con antiword
- `analisis.ts` — análisis IA (NetVault/LightRAG); store de jobs con estados `running|done|error|cancelled`
- `commits.ts` — historial de versiones de archivos adjuntos a procedimientos

### Extracción de texto (`services/textExtraction.ts`)
| Formato | Herramienta |
|---|---|
| `.docx` | `mammoth` (convierte a Markdown) |
| `.pdf` | `pdf-parse` |
| `.doc` | `antiword -m UTF-8.txt` (requiere `apk add antiword` en Alpine) |
| `.md`, `.txt` | `fs.readFile` directo |

### Análisis IA — cancelación de jobs
Los `AbortController` se guardan en el Map `_jobControllers` a nivel de módulo en `SigAnalisisPanel.tsx`. La función exportada `cancelAnalysisJob(id)` permite que cualquier componente cancele un job sin pasar por el store (que no puede guardar objetos no serializables).

### `GET /sig-api/api/instructivos` — `procedimientoId` opcional
El query param `procedimientoId` es opcional. Sin él retorna todos los instructivos del SIG. Con él filtra por procedimiento. Antes requería el param (400 si faltaba) — ese comportamiento fue eliminado.

---

## LightRAG — Grafo de conocimiento dual

`backend/app/agents/lightrag_service.py` gestiona dos instancias independientes:

| ID | Nombre | Directorio en servidor | Propósito |
|---|---|---|---|
| `rag1` | Jarvis | `/app/data/lightrag` | Empresa tal como opera hoy |
| `rag2` | Ultron | `/app/data/lightrag_rag2` | Empresa con procedimientos corregidos |

- LLM de extracción: **Gemini 2.0 Flash** (`settings.gemini_api_key`)
- Embeddings: **Ollama `nomic-embed-text`** (768 dims, local en servidor, sin cuota)
- `get_rag(rag_id)` — singleton lazy por instancia, con lock asyncio para evitar init concurrente
- `indexar_texto(texto, rag_id)` y `buscar_conocimiento(query, modo, rag_id)` son la API pública

Endpoints en `netvault.py`:
- `POST /api/netvault/indexar-lightrag` — job async, indexa procedimiento + instructivos
- `POST /api/netvault/consultar-rag` — consulta síncrona con modos `local|global|mix`
- `GET /api/netvault/rag-status?rag_id=rag1` — inspecciona archivos del working dir: cuenta docs, chunks, entidades y relaciones del `.graphml`

---

## MCP externo — `mcp001-intranet`

Servidor MCP en `C:\Gestion_documental\mcps\mcp001-intranet` que expone 15 herramientas del SIG a Codex, Claude Code y cualquier cliente MCP. Permite que agentes externos (Codex/GPT) lean y analicen procedimientos usando su propia licencia de LLM, sin consumir la API key del servidor.

- Paquete Python instalable: `pip install git+https://github.com/Andresrs1014/mcp001-intranet.git`
- Comando: `mcp001-intranet` (entry point del paquete)
- Transporte: stdio (default) o HTTP (`ZYMO_MCP_TRANSPORT=http`)
- Credenciales: `~/.config/mcp001-intranet/.env`
- Ver `C:\Gestion_documental\mcps\mcp001-intranet\GUIA.md` para documentación completa

---

## Backend Python (`backend/`)

### Routers clave
- `auth.py` — JWT, registro, `/auth/me` (devuelve `app_permissions` + `user_tools`)
- `roles.py` — gestión de roles con `app_permissions: list[str]` editable
- `netvault.py` — proxy hacia LightRAG/NetVault. Endpoints: `/analizar`, `/analizar-coherencia`, `/analizar-mejoras`, `/analizar-proc-vs-inst`, `/analizar-cargos`, `/editar-con-ia`, `/chat`, `/indexar-lightrag`, `/consultar-rag`, `/rag-status`, `/job/:id`
- `oc/` — flujo completo de órdenes de compra
- `mantenimiento/` — FSM de mantenimiento (ver sección abajo)
- `personal.py` — directorio T&C (164 personas), sin base de datos propia: lee `_persona_dict` desde `main_db`
- `agentes.py` — endpoints del agente ZYMO conversacional
- `zymo.py` — workers y orquestación de agentes

### Modelo de permisos
`Role.app_permissions: list[str]` en PostgreSQL. Los permisos siguen el patrón `mod_<modulo>_<accion>` (ej. `mod_oc_aprobar`, `mod_sig`, `mod_gh_admin`). El admin siempre bypasa los permisos vía `if role === "admin" return true`.

### Base de datos dual en Python
- `get_engine()` / `SessionLocal` → PostgreSQL principal (usuarios, roles, OC, etc.)
- `get_oc_engine()` → SQLite secundario (`oc_database.py`) — aloja OC + **tablas de mantenimiento** (`mnt_solicitudes`, `mnt_aprobaciones`, `mnt_activos_qr`)

**Gotcha — secuencias de Postgres tras migrar datos con `id` explícito:** cualquier script que inserte filas copiando un `id` ya existente (ej. migrar una tabla desde SQLite) deja la secuencia de esa tabla desincronizada — el próximo `INSERT` normal de la app (sin `id`) choca con `IntegrityError: UniqueViolation` en la PK. `_resync_pg_sequences()` en `main.py` corre en cada arranque (dentro de `_migrate_db()`) y resincroniza vía `setval(pg_get_serial_sequence(...), MAX(id))` para las tablas con PK entera — pero cualquier migración de datos *nueva* debe considerar este mismo paso explícitamente, no asumir que el autoreparo cubre tablas que no estén en `_TABLES_WITH_SERIAL_ID`.

### Patrón de migración inline (SQLite)
Las tablas SQLite ya existentes en producción no admiten `DROP`/`CREATE`. Nuevas columnas se agregan al final de `create_oc_tables()` con `try/except pass`:
```python
for col_def in [
    "ALTER TABLE mnt_solicitudes ADD COLUMN origen TEXT DEFAULT 'intranet'",
]:
    try:
        conn.execute(text(col_def))
    except Exception:
        pass  # columna ya existe
```

---

## Mantenimiento — arquitectura FSM

### Estados y transiciones
```
solicitud → evaluacion → programado → ejecucion → completado → cerrado
                                                              ↘ cancelado
```

### Gates que bloquean transiciones
| Transición | Condición bloqueante |
|---|---|
| `evaluacion → programado` | `monto_estimado > 2_000_000` y menos de 3 aprobaciones en `mnt_aprobaciones` |
| `ejecucion → completado` | `evidencia_url` es NULL |

### Magic link (auxiliar sin laptop)
`POST /api/mantenimiento/solicitudes/{id}/magic-link` genera un JWT HS256 con `scope=mnt_mobile`, TTL 24h. La URL resultante (`/m/{token}`) es pública — el auxiliar abre desde el celular sin login. El backend valida solo el scope, no el usuario.

### Endpoints clave
- `POST /solicitudes/retroactivo` — registra trabajo ya realizado (origen=`telefonico_retroactivo`), crea directamente en estado `completado`
- `POST /solicitudes/{id}/evidencia` — sube URL de foto, opcionalmente actualiza `monto_real`
- `POST /solicitudes/{id}/aprobacion` — registra aprobación de rol `dir_administrativa | gerencia_operaciones | gerencia_general` (sin duplicados por rol)
- `GET /kpis` — tablero mensual: gasto total/tipo/modalidad, informales, pendientes aprobación

### Nota sobre `Session` en endpoints públicos
Los routers `mobile.py` y cualquier endpoint sin `Depends(get_current_user)` deben usar `Session(get_oc_engine())` directamente (context manager manual), no `Depends(get_oc_db)`.

---

## T&C — Talento y Cultura (`backend/app/routers/personal.py`, `tc_*.py`)

Directorio completo del grupo (empresas/sedes → áreas → cargos → personas), en SQLite propio (`personal.db`), sin backend Node dedicado. Módulos: Directorio, Organigrama (jerarquía de **cargos**, `PtcCargo.parent_id`, no de personas), Cargos, Capacitaciones (historial por persona, independiente de Agenda), y **Agenda**.

### Jerarquía de personas — `jefe_directo_id`, no el organigrama
`PtcPersona.jefe_directo_id` (self-referencing, con validación anti-ciclo en `personal.py`) resuelve "quién es el jefe de X" persona-a-persona — deliberadamente separado del organigrama de cargos (`PtcCargo.parent_id`), que es ambiguo cuando un cargo tiene varias personas. Usado por `resolver_jerarquia_tickets()` (`services/clientes_cartera.py`) para autocompletar analista→coordinador→supervisor en el formulario de tickets de ZymoAlly a partir de `PtcClienteAnalista` (varios analistas por cliente, distinto de `PtcClienteAsignacion` que es 1 persona por sede).

### Agenda — tipo #1 (inducción), permiso independiente de T&C
Router `tc_agenda.py`. Permiso propio `mod_tc_agenda`, **independiente** de `mod_tc`/`mod_tc_editar` — cualquier líder de área con ese permiso agenda sin necesitar acceso al resto de T&C (entrada propia en el Sidebar cuando no tiene `mod_tc`, guard `AgendaRoute` separado de `TyCRoute` en `App.tsx`). El área del evento **nunca se elige a mano**: se auto-resuelve del `area_id` del perfil T&C del líder (vía `PtcPersona.user_id == current_user.id`) — si el líder no tiene perfil vinculado o sin área, no puede agendar (hay un campo "Usuario vinculado" en la ficha de persona para setear ese link).

**Estados: Agendada → En curso → Finalizada.** Agendada/En curso se **calculan** en cada respuesta a partir de `fecha`+`hora_inicio` (`_calcular_estado()` en `tc_agenda.py`) — nunca se guardan, no hace falta cron. Finalizada es la única transición manual y persistida (`PtcEvento.finalizada_en`). Gate por estado en cada endpoint (`_requerir_estado()`): Agendada permite editar info + participantes; En curso solo permite seguir agregando participantes (no editar info); Finalizada bloquea todo excepto asistencia (con endpoint de "marcar todos" + desmarcar puntual) y evidencia (foto opcional o acta PDF autogenerada con weasyprint, descargable/firmable/resubible — foto y firma son evidencia intercambiable, no se piden las dos).

**Gotcha — descargas de PDF sin auth:** cualquier link de descarga de archivo servido por un endpoint autenticado (no estático) debe usar `openAuthenticatedApiBlob()` de `lib/api.ts`, nunca un `<a href>` plano — un `window.open`/navegación directa no adjunta el header `Authorization`, igual que el gotcha ya conocido en OC/Financiero.

**Gotcha — nginx:** cualquier router nuevo bajo `/tc/` (incluye `/tc/agenda/*`, `/tc/eventos/*`) debe añadirse a la regex de proxy en `frontend/nginx.conf` (~línea 134) o cae al fallback del SPA y devuelve HTML donde el frontend espera JSON (`.forEach`/`.map` truena con un error genérico, no un 404 obvio).

---

## ZymoAlly — Tickets (PQR) + SAC (`zymoally-backend`)

Migrado desde una app standalone HTML/JS (`C:\Proyectos-indexar\ZymoAlly`, sin backend, `localStorage`). Dos dominios sin relación entre sí, compartiendo un solo backend Node + una sola Postgres (la separación es solo lógica — routers/permisos, no infraestructura):
- **Tickets** = PQR completo (`mod_tickets` / `mod_tickets_config` para editar maestros).
- **SAC** = Fidelización de clientes (NPS), Diseñando la Experiencia, Reporte de visita (`mod_sac` / `mod_sac_config`).

### Opciones de formulario configurables
`ZymoConfigList` (tabla genérica `{listType, value, label, sortOrder, isActive}`) sirve ambos dominios sin necesitar migración de esquema por cada lista nueva: los 14 maestros de PQR (`clients`, `platforms`, `impacts`...) y las 5 choice-lists de SAC (`surveyValueChoices`, `surveyIssues`, `experienceFitChoices`, `experienceClarityChoices`, `visitOutcomes`) viven en la misma tabla, filtradas por `listType`. Cada dominio expone `GET .../listas` (agrupado), `POST/PATCH/DELETE`, y `POST .../reset` (restaura defaults de `utils/constants.ts`).

### Encuestas públicas — magic-link sin login
`POST /api/sac/surveys/magic-link` (staff) genera un JWT `scope=survey_client` (TTL 30 días) — mismo patrón que `scope=mnt_mobile` de Mantenimiento. Las rutas públicas (`src/routers/public/survey.ts`) se montan ANTES de `app.use("/api", authenticate)` en `app.ts`: `GET /public/survey/config` (sin auth, solo etiquetas) y `POST /public/survey/{client,experience}` (validan únicamente el `scope` vía `requireSurveyScope`, nunca `app_permissions` — el cliente final no tiene cuenta en la intranet).

### Frontend público (`survey-frontend/`)
React 19 + Vite + Tailwind standalone (mismo stack que `frontend/`, para que portarlo sea copiar la carpeta `src/`, no rediseñar). Layout responsive único vía breakpoints CSS (`lg:`), sin detección de dispositivo por JS: desktop = split-screen con panel de marca oscuro + stats, mobile = banda de header con degradado. Ruta `/e/:surveyType?t=:token`.

---

## Libertadora — CRM Skandia CREA (`libertadora-backend`)

Migrado desde una app standalone HTML/JS (`C:\Proyectos-indexar\Libertadora`, sin backend, `localStorage`) — CRM comercial de un ejecutivo de Libertadora Seguros para el producto Skandia CREA + ARL Colmena (prospectos, citas, KPIs). A diferencia de ZymoAlly/Helix, este módulo se expone también a un **tercero externo** (Skandia) con lectura y edición completa, no solo a staff interno.

### Modelo de datos (`libertadora-db`, Postgres propia)
`LibertadoraProspecto`, `LibertadoraCita`, `LibertadoraMeta` (fila única id=1) y `LibertadoraPartnerUser` (una cuenta por persona del socio externo, con contraseña propia).

### Acceso interno vs. acceso público del socio (Skandia)
Los mismos routers (`prospectos.ts`, `citas.ts`) se montan **dos veces** en `app.ts` con distinto middleware — sin duplicar lógica de negocio:
- `/api/prospectos`, `/api/citas` — staff interno, `authenticate` + `requireLibertadoraAccess` (permiso `mod_libertadora`, pendiente de crear en Roles y permisos).
- `/public/prospectos`, `/public/citas` — socio externo, `requireLibertadoraPartnerScope` (JWT `scope=libertadora_partner` obtenido por login).

### Login del socio externo — usuario y contraseña, una cuenta por persona (no un link)
Primer diseño (descartado antes de desplegar): un link con token sin expiración. El gerente pidió acceso por usuario/contraseña por seguridad — decisión explícita: **una cuenta por persona de Skandia**, contraseña fijada a mano por un admin/gerente interno (sin flujo de recuperación por correo todavía). `LibertadoraPartnerUser` (email + hash `bcryptjs`, igual que `bcrypt` en el backend Python) vive únicamente en `libertadora-db` — deliberadamente separado de `Role`/`app_permissions` de la intranet, nunca pasa por el JWT que emite FastAPI.

`POST /public/login` (email+password) devuelve un JWT `{scope: "libertadora_partner", partnerUserId}` con sesión de 7 días. El middleware `requireLibertadoraPartnerScope` valida el JWT **y además** consulta `active` en `LibertadoraPartnerUser` en cada request — desactivar una cuenta (`PATCH /api/partner-users/:id/desactivar`, solo admin/gerente) corta el acceso al instante, incluso con una sesión ya emitida, sin afectar a otras cuentas ni rotar el `JWT_SECRET` compartido por toda la intranet.

**Frontend:** la gestión de estas cuentas (crear, desactivar, resetear contraseña) va en **Configuración → "Usuarios externos"** de la intranet — sección propia, no escondida dentro de un panel específico de Libertadora, pensada para reusarse si otro módulo necesita el mismo patrón de acceso externo más adelante.

### Respaldo automático hacia SIG (`sig-backend`)
Decisión explícita del usuario: cada creación/edición/borrado se respalda además en `sig-backend` (`services/sigBackup.ts`), fire-and-forget — nunca bloquea ni rompe la escritura real si `sig-backend` está caído. Se autentica con un JWT de servicio autofirmado (`role: "admin"`, TTL 5 min) usando el mismo `JWT_SECRET` compartido, sin inventar una llave interna nueva. Aterriza en `sig-backend`'s `SigLibertadoraBackup` (tabla append-only, no un espejo en vivo) vía `POST /api/libertadora-backup`.

**Pendiente antes de producción:** agregar el permiso `mod_libertadora` en Roles y permisos (Python backend + UI de Configuración) — hoy nadie lo tiene asignado. Frontend aún no existe (fase solo-backend). Sin esto, el módulo queda desplegado pero inaccesible para staff hasta que un admin asigne el permiso.

---

## Estética ZYMO (obligatorio en componentes UI)

- **Fuentes:** DM Sans (cuerpo) + DM Mono (datos numéricos/código). No sustituir.
- **Paleta:** base oscura dominante, acentos de acción saturados. Sin gradientes púrpura.
- **Micro-animaciones:** en carga, transición de estado y feedback de acciones.
- **Prohibido:** Inter, Roboto, Arial, layouts SaaS genéricos.
- Cada módulo debe tener carácter visual propio — no copiar el layout de otro módulo.

---

## Skills activas (aplicar sin instrucción explícita)

### find-skills — antes de implementar seguridad
```
npx skills find owasp top 10
npx skills find jwt hardening
npx skills find xss csrf protection
npx skills find secrets management
```

### frontend-design — antes de cualquier componente UI
Revisar dirección estética del módulo activo contra las reglas de estética ZYMO arriba.

### web-design-guidelines — antes de commit con cambios UI
```
Revisa src/components/[modulo]/ contra las web-design-guidelines
```
Reporte en formato `archivo:linea`.

### agent-browser — flujos críticos antes de despliegue
```bash
agent-browser open https://zymointranet.com --session admin
```
Flujos obligatorios: login/logout, flujo OC completo, análisis SIG, navegación entre módulos.

### mcp-builder — integraciones con agentes IA
MCPs activos: `mcp-zymo-bodega`, `mcp-zymo-oc`, `mcp-zymo-helix`, `mcp-zymo-reportes`.
Patrón: Python/FastMCP, transporte streamable HTTP.

---

## Definición de Done

Un cambio está listo solo si:
- `npx tsc --noEmit` sin errores en todos los módulos tocados
- `docker compose up --build -d` pasa sin errores
- No rompe endpoints existentes sin documentación
- Es desplegable en Docker sin pasos ocultos
- UI auditada con `web-design-guidelines`
- Flujos críticos probados con `agent-browser`
- `docs` actualizado si cambió comportamiento o seguridad

---

## Documentación de referencia
- **`docs/config-intranet/`** — Configuración admin, permisos, directorio como fuente de verdad (handoff agentes)
- `docs/ADMIN_DB_PLAN.md`
- `Master_plan/ZYMO_MASTER_PLAN_v2.md`
- `docs/superpowers/specs/`
- `plans/helix_zymo/PLAN_IMPLEMENTACION_INTRANET.md`
- `C:\Users\andres.quintero\OneDrive - IMC CARGO INTERNATIONAL SAS\Documentos\Diagramas\GH_DIRECTORIO_PLAN\` — plan técnico y ejecutivo del módulo GH (Gestión Humana)

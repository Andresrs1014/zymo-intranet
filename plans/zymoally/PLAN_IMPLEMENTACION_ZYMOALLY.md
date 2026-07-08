# Plan de implementación — ZymoAlly (módulo de Planeación)

**Objetivo:** indexar la herramienta autónoma `C:\Proyectos-indexar\ZymoAlly` como un módulo nativo de la intranet en el área de **Planeación**, con:

- Base de datos propia (PostgreSQL + Prisma).
- Backend Node/TS propio (patrón `helix-backend` / `sig-backend`).
- UI portada a React 19 respetando la estética ZYMO (DM Sans / DM Mono, base oscura, sin copiar el layout de Helix).
- Toda la funcionalidad actual replicada (encuestas, reportes, PQR, dashboard, alertas, exportaciones, instructivos).
- La configuración (hoy "Listas PQR" en `localStorage`) reservada al apartado de configuración del módulo, visible por rol.
- Visibilidad por rol vía `app_permissions` (`mod_zymoally`, `mod_zymoally_config`).

---

## 1. Qué es ZymoAlly hoy (punto de partida)

App estática HTML + CSS + JS vanilla, sin backend, persistencia 100% en `localStorage` (5 claves `zymoally-*`). "IA" = heurísticas locales (promedios/umbrales), sin LLM. Integraciones: `wa.me` y `mailto:` on-click.

### Vistas actuales (nav de `index.html`)
| view | Descripción |
|---|---|
| `dashboard` | Métricas CX + gráficos + análisis IA + estrategias |
| `clientSurvey` | Fidelización de clientes (encuesta NPS, 7 pasos) |
| `commercialSurvey` | Diseñando la Experiencia (8 pasos) |
| `visitReport` | Reporte de diseño de experiencia (interno) |
| `pqrCreate` | Crear ticket PQR |
| `pqrTickets` | Base tickets PQR (dashboard PQR) |
| `pqrReport` | Informe tickets (tabla + histórico + gestión) |
| `pqrConfig` | Listas PQR (maestros) → **se mueve a Configuración** |
| `alerts` | Alertas (encuestas + PQR) |
| `guides` | Instructivos (usuario/admin/gerencial) |

### Modelos de datos (derivados de `app.js`)
- **surveys** (fidelización): `date, company, role, email, phone, nps, npsCategory, satisfaction, delivery, attention, meeting, solution, valuedAspect, issue, comment, nextStep`
- **commercialSurveys** (experiencia): `date, company, contact, email, phone, fit, futureValue, clarity, exceededExpectations, actionToday, professionalSatisfaction, meetingFit, leadershipComment, satisfaction, solution, nextStep`
- **visits** (reporte): `date, commercial, client, contact, outcome, nextDate, quality, clientMood, opportunity, urgency, observations, actionPlan`
- **pqrTickets**: `code, monthKey, area, areaPrefix, client, platform, supervisor, analyst, coordinator, phone, email, owner, date, dueDate, type, status, priority, impact, channel, managementCriteria, closedDate, description, actionsLog[], evidence[]`
- **pqrConfig** (maestros): `clients, platforms, supervisors, analysts, coordinators, generators, phones, emails, impacts, types, statuses, priorities, channels, managementCriteria, areaPrefixes[{area,prefix}]`

---

## 2. Arquitectura destino

Se replica el patrón de un backend Node de la intranet. Nuevo servicio + BD:

| Servicio | Puerto ext | Puerto int | BD | Puerto BD |
|---|---|---|---|---|
| `zymoally-backend` (Node/TS) | 3005 | 3005 | `zymoally-db` | 5438 |

- JWT HS256 compartido: `env_file: ./backend/.env` (mismo `SECRET_KEY`). Sin duplicar el secreto.
- `app_permissions` NO viaja en el JWT → el guard fino de escritura/config se resuelve reenviando el token a `GET /auth/me` del backend Python, o cacheando permisos. (Ver decisión en §6.)
- Migraciones versionadas Prisma + `prisma migrate deploy` en el `CMD` (patrón helix/sig, no `db push`).

### Frontend
- Ruta `/planeacion/zymoally` (+ `/planeacion/zymoally/configuracion`).
- Página React nativa con **shell propio** (no reutilizar `HelixShell`; identidad visual propia por regla de estética).
- Cliente axios `zymoallyApi` con `VITE_ZYMOALLY_API_URL=/zymoally-api` y proxy nginx.

---

## 3. Base de datos (Prisma — `zymoally-backend/prisma/schema.prisma`)

Modelos (prefijo `Zymo` para claridad):

```
model ZymoClientSurvey     { id, createdAt, date, company, role, email, phone,
                             nps, npsCategory, satisfaction, delivery, attention,
                             meeting, solution, valuedAspect, issue, comment, nextStep }

model ZymoExperienceSurvey { id, createdAt, date, company, contact, email, phone,
                             fit, futureValue, clarity, exceededExpectations, actionToday,
                             professionalSatisfaction, meetingFit, leadershipComment,
                             satisfaction, solution, nextStep }

model ZymoVisitReport      { id, createdAt, date, commercial, client, contact, outcome,
                             nextDate, quality, clientMood, opportunity, urgency,
                             observations, actionPlan }

model ZymoPqrTicket        { id, code @unique, createdAt, monthKey, area, areaPrefix,
                             client, platform, supervisor, analyst, coordinator,
                             phone, email, owner, date, dueDate, type, status, priority,
                             impact, channel, managementCriteria, closedDate, description }

model ZymoPqrAction        { id, ticketId FK, createdAt, texto }          // reemplaza actionsLog[]
model ZymoPqrEvidence      { id, ticketId FK, createdAt, filename, url }  // reemplaza evidence[]

model ZymoConfigList       { id, listType, value, label, sortOrder, isActive }  // maestros (patrón task-backend ListConfig)
model ZymoAreaPrefix       { id, area, prefix @unique, isActive, sortOrder }    // areaPrefixes
```

- `actionsLog[]` y `evidence[]` (arrays en localStorage) → tablas hijas relacionadas (normalización; evita JSON blobs y habilita auditoría).
- `evidence`: hoy solo guarda nombres de archivo. Con backend real conviene subir archivos (patrón `UPLOAD_DIR` + `/uploads` estático de helix). Ver §7 (fase evidencias).
- Generación de `code` (`PREFIJO-AAMMDD-NN`) se mueve al backend con transacción para evitar colisiones concurrentes (hoy es best-effort en cliente). **Check ejecutable**: test unitario de `nextPqrCode` con tickets del mismo día/área.

---

## 4. Backend Node (`zymoally-backend/`)

Estructura clonada de `helix-backend`:

```
zymoally-backend/
├── Dockerfile                # FROM node:20-alpine; prisma generate; build; CMD migrate deploy && node dist/app.js
├── package.json              # express, @prisma/client, cors, jsonwebtoken, zod, dotenv, multer (evidencias)
├── tsconfig.json
├── .env.example
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts               # siembra maestros por defecto (defaultPqrConfig)
│   └── migrations/
└── src/
    ├── app.ts                # express, cors, /health, authenticate en /api, montaje routers
    ├── config/{env.ts, prisma.ts}
    ├── middleware/auth.ts    # authenticate + getUserId + requireZymoallyAccess + requireZymoallyConfig
    ├── routers/
    │   ├── surveys.ts        # CRUD fidelización
    │   ├── experience.ts     # CRUD experiencia
    │   ├── visits.ts         # CRUD reportes
    │   ├── pqr.ts            # CRUD tickets + acciones + estado/criterio/cierre + evidencias
    │   ├── dashboard.ts      # métricas CX + PQR (server-side)
    │   ├── alertas.ts        # cálculo de alertas
    │   ├── config.ts         # maestros (Listas PQR) — requireZymoallyConfig
    │   └── export.ts         # CSV/JSON server-side (respeta filtros)
    ├── services/             # métricas, NPS, alertas, generación de código PQR, "IA" heurística
    └── utils/                # formatters, constants
```

- Toda la lógica de `app.js` (promedios, `npsScore`, `alerts()`, `aiSummary()`, `strategies()`, `pqrAiSummary()`, `nextPqrCode`, semáforos por impacto) se **porta a `services/`** en TS. Es lógica pura → fácil de testear.
- Validación con Zod en cada boundary (regla de seguridad: validar input en el boundary).
- `escapeHtml`/XSS: al pasar a React el escapado es automático; los mensajes WhatsApp/mailto se construyen en cliente igual que hoy.

---

## 5. Frontend React (`frontend/src/`)

### Archivos nuevos
```
pages/planeacion/zymoally/
  ZymoAllyPage.tsx            # orquestador + provider + shell propio
  ZymoAllyConfigPage.tsx      # Configuración (Listas PQR) — guard mod_zymoally_config
components/planeacion/zymoally/
  ZymoShell.tsx, ZymoSidebar.tsx, ZymoTopbar.tsx
  dashboard/  surveys/  experience/  visits/  pqr/  alerts/  guides/  config/
context/ZymoAllyContext.tsx   # estado de vista activa (patrón HelixContext)
lib/zymoallyApi.ts            # axios + JWT interceptor
hooks/useZymo*.ts             # dashboard, encuestas, visitas, pqr, alertas, config
types/zymoally.ts
styles/zymoally.css           # tokens propios (DM Sans/DM Mono, base oscura) — NO copiar helix.css
```

### Estética (obligatorio, regla ZYMO)
- El CSS original usa `Montserrat`, base clara y acento `#ef3340`. Se **re-tematiza**: DM Sans (cuerpo), DM Mono (métricas/códigos PQR), base oscura dominante, acento de acción saturado. Micro-animaciones en carga de datos, cambios de estado y feedback (submit/éxito/error).
- Layout con carácter propio, distinto de Helix (no clonar su sidebar/topbar visual).
- Los gráficos (pie/barras) se rehacen: opción lazy = portar el CSS conic-gradient/barras actuales; opción robusta = `recharts` (ya hay skill/были usos). **Decisión por defecto:** portar los gráficos CSS actuales (cero dependencias nuevas); migrar a recharts solo si se piden interacciones.

### Encuestas públicas (decisión importante)
Hoy las encuestas se comparten por link (`?view=clientSurvey`) y las diligencia el **cliente final**, que **no tiene login**. En la intranet las rutas están tras `PrivateRoute`. Dos caminos:

- **A (recomendado):** endpoint/ruta pública para diligenciar encuestas mediante token de scope corto (patrón `/m/:token` de mantenimiento, `scope=zymo_survey`). El link que se envía por WhatsApp/correo apunta a la ruta pública, no a la intranet autenticada.
- **B:** mantener el diligenciamiento solo interno (un colaborador captura la respuesta). Más simple, pierde el flujo de auto-diligenciamiento por el cliente.

> **Bloqueante de producto:** hay que elegir A o B antes de la fase de encuestas. Afecta backend (endpoint público + emisión de token) y frontend (ruta antes de `PrivateRoute`).

---

## 6. Permisos y visibilidad por rol

- `lib/roles.ts` → registrar en `INTERNAL_MODULES`:
  - `mod_zymoally` — ver el módulo.
  - `mod_zymoally_config` — editar Listas/Configuración.
- `lib/permissions.ts` → `canSeeZymoAlly(role, perms)` y `canConfigZymoAlly(role, perms)` (patrón `hasPerm`, admin bypass).
- `App.tsx` → `ZymoAllyRoute` + `ZymoAllyConfigRoute` (patrón `HelixRoute`).
- `Sidebar.tsx` → sección Planeación: añadir `showZymoAlly` y `NavItem` "ZymoAlly"; entrada de Configuración condicionada a `canConfigZymoAlly`.
- Backend: `requireZymoallyAccess` (lectura/escritura de datos) y `requireZymoallyConfig` (maestros).

**Resolución de `app_permissions` en el backend Node:** como no está en el JWT, para `requireZymoallyConfig` se reenvía el token a `GET /auth/me` (patrón `usuarios.ts` de helix) y se cachea por request. Alternativa lazy: gate de config solo por `role in (admin, gerente)` si se acepta esa simplificación. // ponytail: gate por rol; permiso fino `mod_zymoally_config` si se requiere granularidad.

---

## 7. Infraestructura (Docker + nginx + env)

### `docker-compose.yml` (nuevos bloques, patrón helix)
```
zymoally-backend:
  build: ./zymoally-backend
  ports: ["3005:3005"]
  env_file: [./backend/.env]         # SECRET_KEY compartido
  environment:
    - NODE_ENV=production
    - PORT=3005
    - DATABASE_URL=postgresql://${ZYMOALLY_DB_USER:-zymoally}:${ZYMOALLY_DB_PASSWORD}@zymoally-db:5432/${ZYMOALLY_DB_NAME:-zymoallydb}
    - INTRANET_API_URL=http://backend:8001
    - UPLOAD_DIR=/app/uploads
  volumes: [zymoally_uploads:/app/uploads]
  depends_on: { zymoally-db: { condition: service_healthy } }

zymoally-db:
  image: postgres:15-alpine
  ports: ["5438:5432"]
  environment: [POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB]
  volumes: [zymoally_db_data:/var/lib/postgresql/data]
  healthcheck: pg_isready ...

volumes: { zymoally_db_data:, zymoally_uploads: }
```
`backend/.env` → añadir `ZYMOALLY_DB_USER/PASSWORD/NAME`.

### `frontend/nginx.conf`
```
location /zymoally-api/ { proxy_pass http://zymoally-backend:3005/; ... }
location /zymoally-uploads/ { proxy_pass http://zymoally-backend:3005/uploads/; ... }
```

### `frontend/.env.production`
```
VITE_ZYMOALLY_API_URL=/zymoally-api
```

### Instructivos
Los 3 `.md` se sirven desde el módulo (assets en `frontend/public/zymoally/` o endpoint del backend). La vista `guides` enlaza a ellos.

---

## 8. Fases de ejecución (orden sugerido, sub-agente por fase)

0. **Research & reuse** (ya hecho): patrones helix/sig/task confirmados.
1. **Scaffold backend**: clonar helix-backend → zymoally-backend; `env.ts`, `prisma.ts`, `auth.ts`, `/health`. Docker + compose + db arriba. `docker compose up --build` verde.
2. **Schema + migración + seed**: modelos §3, migración inicial, seed de maestros (`defaultPqrConfig`). `prisma migrate deploy` OK.
3. **Routers CRUD + services**: surveys, experience, visits, pqr (con generación de code transaccional), config, dashboard, alertas, export. Zod en boundaries. Tests de lógica pura (NPS, code PQR, alertas).
4. **Frontend base**: `zymoallyApi`, permisos, rutas/guards, Sidebar, shell propio + tokens ZYMO. Navegación entre vistas.
5. **Frontend vistas**: dashboard, encuestas, experiencia, reportes, PQR (crear/base/informe con semáforos e histórico), alertas, exportaciones, guides.
6. **Configuración**: `ZymoAllyConfigPage` (Listas PQR) contra `config.ts`, guard `mod_zymoally_config`.
7. **Encuestas públicas** (si se elige camino A): endpoint público + token scope corto + ruta antes de `PrivateRoute`.
8. **Evidencias PQR**: upload real (multer + `/uploads`) sustituyendo nombres sueltos.
9. **Migración de datos** (opcional): importador de `localStorage` (JSON export actual) → BD, para no perder lo capturado.
10. **Auditoría estética + web-design-guidelines + pruebas de flujos** (agent-browser) + docs.

Cada fase cierra con la Definición de Done: `npx tsc --noEmit` limpio (front y back), `docker compose up --build -d` sin errores, sin imports/vars sin usar (TS6133 rompe Docker).

---

## 9. Decisiones abiertas (requieren tu confirmación)

1. **Encuestas públicas**: ¿camino A (link público con token, cliente diligencia sin login) o B (captura interna)?
2. **Configuración**: ¿página dentro del módulo (`/planeacion/zymoally/configuracion`, patrón OC/financiero) o integrarla en `/admin/configuracion/*`? (Recomendado: dentro del módulo, guardado por `mod_zymoally_config`.)
3. **Gráficos**: ¿portar CSS actual (cero deps) o migrar a `recharts`? (Recomendado: portar CSS.)
4. **Evidencias**: ¿subida real de archivos desde el arranque o mantener solo nombres en fase 1 y subir en fase 8?
5. **Migración de datos**: ¿hay datos reales en `localStorage` que haya que importar, o arranca vacío?

---

## 10. Riesgos

- **Concurrencia de código PQR**: mover a transacción en backend (test obligatorio).
- **Encuestas sin auth**: no exponer datos internos en la ruta pública; el token de scope corto solo permite crear una respuesta.
- **Estética**: no clonar el layout de Helix (regla). Requiere diseño propio → costo de UI real.
- **`verbatimModuleSyntax`** en frontend: usar `import type` para tipos (TS1484 rompe Docker).
- **Volumen de trabajo**: portar 10 vistas + backend + BD es grande; conviene sub-agentes por fase y revisiones incrementales.

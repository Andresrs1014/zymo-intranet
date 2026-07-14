# Zymo Ally — Sincronización de datos maestros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poblar los selects del formulario "Crear ticket PQR" con datos reales de la intranet (áreas, sedes/plataformas, personas) sincronizándolos desde el backend Python hacia las tablas locales de `zymoally-backend`, con upsert que preserva las personalizaciones del admin, disparado por cron 3×/día y por un botón manual.

**Architecture:** `zymoally-backend` firma su propio JWT de servicio (`role: "admin"`, TTL 5 min) con el mismo secreto HS256 que FastAPI, y con él consume `GET /areas`, `GET /sedes?para_solicitudes_oc=true` y `GET /tc/personas?estado=activo&limit=500` del backend Python (fetch nativo de Node 20, sin axios). Cada registro se upsertea contra `ZymoAreaPrefix` / `ZymoConfigList` usando un nuevo campo `externalId` como clave estable de matching — actualiza `label`/`area` + `syncedAt`, nunca toca `isActive`/`prefix`/`sortOrder`/`value`, y nunca borra. El disparo es un `node-cron` interno (primer uso de la dependencia en el repo) + un endpoint `POST /api/tickets/config/sync` gateado por `mod_tickets_config`, expuesto en un botón mínimo dentro del diálogo de creación.

**Tech Stack:** TypeScript, Express, Prisma (Postgres), `jsonwebtoken`, `node-cron` (nuevo), fetch nativo de Node 20; React 19 + Vite, TanStack Query, Zustand, axios (frontend).

---

## Prerrequisito manual — cuenta de servicio (hacer ANTES de la Task 3)

`get_current_user` en el backend Python (`backend/app/core/deps.py`) decodifica el JWT, toma el claim `sub` (email), y carga el usuario **real** desde la base de datos — no confía en claims sueltos como `role`/`id` dentro de un token auto-firmado. El cron (6am/12pm/4pm) no tiene ningún humano logueado detrás, así que `zymoally-backend` necesita poder firmar un token válido para una cuenta que exista de verdad en la BD.

**Antes de ejecutar la Task 3, el usuario debe crear esa cuenta una sola vez**, vía `POST /auth/register` (requiere estar logueado como admin):

```bash
curl -X POST https://zymointranet.com/auth/register \
  -H "Authorization: Bearer <tu JWT de admin>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sync-zymoally@zymologistica.internal",
    "password": "<contraseña aleatoria fuerte, no se va a usar para login nunca>",
    "full_name": "Zymo Ally — Sync de datos maestros",
    "role": "admin",
    "sede": null,
    "area": null
  }'
```

(El JWT de admin se saca de `localStorage.getItem("zymo-auth")` en el navegador ya logueado, o vía la pantalla de Administración si existe ahí un formulario de crear usuario — cualquiera de los dos sirve, el resultado es el mismo registro en la tabla `user`.)

Luego, en el `.env` real del servidor (mismo archivo donde vive `ZYMOALLY_DB_PASSWORD`), agregar:

```
SYNC_SERVICE_EMAIL=sync-zymoally@zymologistica.internal
```

Y en `docker-compose.yml`, agregar esa variable al bloque `environment` de `zymoally-backend` (la Task 3 de este plan ya asume que `env.SYNC_SERVICE_EMAIL` existe en `src/config/env.ts` — falta agregar la línea correspondiente al `environment:` del servicio en `docker-compose.yml`, ya que hoy no está listada ahí; revisar y agregar `- SYNC_SERVICE_EMAIL=${SYNC_SERVICE_EMAIL}` junto a las demás variables de `zymoally-backend` antes de desplegar).

---

## Restricciones del entorno (leer antes de ejecutar cualquier tarea)

- **No hay base de datos ni backend corriendo en este entorno.** Las migraciones de Prisma se escriben **a mano** como archivos `.sql`; NUNCA correr `prisma migrate dev` ni intentar conectarse a una BD. El único chequeo de esquema disponible es `npx prisma generate` (genera el cliente sin tocar la BD).
- **No usar Docker para verificar nada.** No hay Docker disponible.
- **Verificación de `zymoally-backend`:** `npx prisma generate` (cuando cambió el esquema) seguido de `npx tsc --noEmit`. Ambos son chequeos válidos y suficientes para este backend.
- **Verificación de `frontend`:** el único chequeo válido es `npm run build` (corre `tsc -b && vite build`). `npx tsc --noEmit` NO revisa nada real en `frontend/` por el `tsconfig` raíz con `files:[]`+`references`. No usar `tsc --noEmit` para verificar frontend.
- **Commits:** este plan SÍ pide commit por tarea (el usuario lo autorizó explícitamente para este trabajo). Formato: `tipo(zymoally): descripción corta` en español, sin emojis, sin línea `Co-Authored-By` (la atribución está deshabilitada globalmente en el repo).
- Todas las rutas de comandos asumen que el directorio de trabajo es la raíz del backend (`C:\zymo-intranet\zymoally-backend`) o del frontend (`C:\zymo-intranet\frontend`) según indique cada tarea.

---

## Estructura de archivos

**Backend (`zymoally-backend/`):**
- `prisma/schema.prisma` — MODIFICAR: agregar `externalId`/`syncedAt` a `ZymoAreaPrefix` y `ZymoConfigList`.
- `prisma/migrations/20260714120000_master_data_sync_columns/migration.sql` — CREAR: migración manual de las 4 columnas nuevas.
- `src/utils/constants.ts` — MODIFICAR: agregar el listType `"personas"` y su default vacío.
- `src/services/masterDataSync.ts` — CREAR: token de servicio, fetch a la intranet, lógica de upsert, orquestador `syncMasterData()`.
- `src/cron.ts` — CREAR: `startSyncCron()` con `node-cron`.
- `src/routers/tickets/pqrConfig.ts` — MODIFICAR: endpoint `POST /sync`.
- `src/app.ts` — MODIFICAR: arrancar el cron al levantar el servidor.
- `package.json` — MODIFICAR: dependencia `node-cron` + `@types/node-cron`.

**Frontend (`frontend/`):**
- `src/types/ticket.ts` — MODIFICAR: `personas` en `TicketConfigLists` + tipo `SyncMasterDataResult`.
- `src/lib/permissions.ts` — MODIFICAR: `canConfigTickets()`.
- `src/hooks/useTickets.ts` — MODIFICAR: hook `useSyncMasterData()`.
- `src/components/tickets/TicketDialog.tsx` — MODIFICAR: recablear selects Supervisor/Analista/Coordinador a `personas` + botón "Sincronizar ahora".

Orden de ejecución: backend primero (migración → constants → servicio → cron → endpoint), luego frontend (tipos/permisos/hook → UI). Cada tarea compila en verde antes de que la siguiente dependa de ella.

---

## Task 1: Esquema Prisma + migración de columnas de sync

Agrega los campos `externalId` (clave estable de matching) y `syncedAt` (marca de última sincronización) a las dos tablas de maestros. Ambos nullable: las filas semilla existentes en producción no los tienen y no se pueden recrear.

**Files:**
- Modify: `zymoally-backend/prisma/schema.prisma:62-80` (modelos `ZymoConfigList` y `ZymoAreaPrefix`)
- Create: `zymoally-backend/prisma/migrations/20260714120000_master_data_sync_columns/migration.sql`

- [ ] **Step 1: Agregar los campos al modelo `ZymoConfigList`**

En `zymoally-backend/prisma/schema.prisma`, reemplazar el bloque del modelo `ZymoConfigList` (actualmente líneas 62-72) por:

```prisma
model ZymoConfigList {
  id         Int       @id @default(autoincrement())
  listType   String
  value      String
  label      String
  sortOrder  Int       @default(0)
  isActive   Boolean   @default(true)
  externalId String?
  syncedAt   DateTime?

  @@unique([listType, value])
  @@index([listType])
}
```

- [ ] **Step 2: Agregar los campos al modelo `ZymoAreaPrefix`**

En el mismo archivo, reemplazar el bloque del modelo `ZymoAreaPrefix` (actualmente líneas 74-80) por:

```prisma
model ZymoAreaPrefix {
  id         Int       @id @default(autoincrement())
  area       String
  prefix     String    @unique
  isActive   Boolean   @default(true)
  sortOrder  Int       @default(0)
  externalId String?
  syncedAt   DateTime?
}
```

- [ ] **Step 3: Crear la migración SQL manual**

Crear el archivo `zymoally-backend/prisma/migrations/20260714120000_master_data_sync_columns/migration.sql` con exactamente este contenido (sigue el estilo de `20260710185949_ticket_client_optional/migration.sql`):

```sql
-- AlterTable
ALTER TABLE "ZymoConfigList" ADD COLUMN "externalId" TEXT,
ADD COLUMN "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ZymoAreaPrefix" ADD COLUMN "externalId" TEXT,
ADD COLUMN "syncedAt" TIMESTAMP(3);
```

- [ ] **Step 4: Regenerar el cliente Prisma y verificar tipos**

Run (desde `zymoally-backend/`):
```bash
npx prisma generate && npx tsc --noEmit
```
Expected: `prisma generate` imprime "Generated Prisma Client" sin errores; `tsc --noEmit` termina sin salida (exit 0). No debe conectarse a ninguna BD.

- [ ] **Step 5: Commit**

```bash
git add zymoally-backend/prisma/schema.prisma zymoally-backend/prisma/migrations/20260714120000_master_data_sync_columns/migration.sql
git commit -m "feat(zymoally): agregar externalId y syncedAt a maestros para sync"
```

---

## Task 2: Nuevo listType `personas` en las constantes

Los 3 campos de personas (Supervisor/Analista/Coordinador) comparten una sola lista sincronizada `listType: "personas"` (decisión del spec). Hay que registrarla en `PQR_LIST_TYPES` para que `GET /listas` la incluya en su respuesta agrupada, y darle un default vacío (la puebla el sync, no la semilla).

**Files:**
- Modify: `zymoally-backend/src/utils/constants.ts:3-41`

- [ ] **Step 1: Agregar `"personas"` a `PQR_LIST_TYPES`**

En `zymoally-backend/src/utils/constants.ts`, reemplazar el arreglo `PQR_LIST_TYPES` (líneas 3-18) por:

```ts
export const PQR_LIST_TYPES = [
  "clients",
  "platforms",
  "supervisors",
  "analysts",
  "coordinators",
  "personas",
  "generators",
  "phones",
  "emails",
  "impacts",
  "types",
  "statuses",
  "priorities",
  "channels",
  "managementCriteria",
] as const
```

- [ ] **Step 2: Agregar el default vacío en `defaultPqrConfig`**

En el mismo archivo, dentro de `defaultPqrConfig` (líneas 22-41), agregar la clave `personas` inmediatamente después de `coordinators`. El objeto debe quedar así (mostrado completo para evitar ambigüedad):

```ts
export const defaultPqrConfig: Record<PqrListType, string[]> = {
  clients: ["Cliente general"],
  platforms: ["CEDI principal", "Operacion transporte", "Ultima milla", "Almacenamiento"],
  supervisors: ["Supervisor PQR"],
  analysts: ["Analista PQR"],
  coordinators: ["Coordinador logistico"],
  personas: [],
  generators: ["Usuario que genera ticket"],
  phones: ["+57 300 000 0000"],
  emails: ["servicio@cliente.com"],
  impacts: ["Bajo", "Medio", "Alto", "Critico"],
  types: [
    "Peticion", "Queja", "Reclamo", "Solicitud", "Felicitacion", "Hallazgo operativo",
    "Novedad de proceso", "Faltante o inconsistencia", "Mantenimiento de instalaciones",
    "Capacitación de personal", "Corrección de procedimiento", "OKR",
  ],
  statuses: ["Abierto", "En analisis", "En gestion", "Escalado", "Cerrado"],
  priorities: ["Baja", "Media", "Alta", "Critica"],
  channels: ["WhatsApp", "Correo", "Llamada", "Visita de experiencia", "Mesa de ayuda"],
  managementCriteria: ["Contencion inicial", "Causa raiz", "Plan de accion", "Validacion cliente", "Cierre documentado"],
}
```

- [ ] **Step 3: Verificar tipos**

Run (desde `zymoally-backend/`):
```bash
npx tsc --noEmit
```
Expected: sin salida (exit 0). `defaultPqrConfig` satisface `Record<PqrListType, string[]>` con la clave `personas` incluida; `seed.ts` y `pqrConfig.ts` (que iteran `PQR_LIST_TYPES`) siguen compilando.

- [ ] **Step 4: Commit**

```bash
git add zymoally-backend/src/utils/constants.ts
git commit -m "feat(zymoally): registrar listType personas para datos sincronizados"
```

---

## Task 3: Servicio de sincronización `masterDataSync.ts`

El corazón del feature: firma el token de servicio, trae los 3 datasets de la intranet con fetch nativo, y hace upsert por `externalId` sin destruir personalizaciones del admin.

Notas de diseño (leer antes de escribir):
- **Corrección post-revisión (importante):** el token de servicio NO puede llevar claims sueltos como `role`/`id` — `get_current_user` en el backend Python (`backend/app/core/deps.py`) decodifica el JWT, toma el claim `sub` (email), y hace `db.exec(select(User).where(User.email == sub))`. Solo confía en el `role`/permisos del usuario **real** cargado de la base de datos, ignora cualquier `role`/`id` que venga en el payload del token. Por eso el token de servicio debe llevar **únicamente** `sub` (el email de la cuenta de servicio) y `exp`, igual que produce `create_access_token` en Python (`backend/app/core/security.py:20-27`: `{"sub": subject, "exp": expire}` + claims extra que el caller decide, pero `get_current_user` ni siquiera lee esos extra). Ver "Prerrequisito manual" arriba del plan — la cuenta `SYNC_SERVICE_EMAIL` debe existir de verdad en la tabla `user` del backend Python antes de que este código funcione.
- El spec mostraba `jwt.sign(..., env.SECRET_KEY, ...)`, pero `src/config/env.ts` **no expone** una propiedad `SECRET_KEY` — expone `env.JWT_SECRET`, que ya hace fallback a `process.env.SECRET_KEY`. Por eso el código usa `env.JWT_SECRET` (mismo secreto HS256 que firma los JWT de usuarios, así que el backend Python lo valida).
- `env.SYNC_SERVICE_EMAIL` es una variable de entorno **nueva** que este plan agrega a `src/config/env.ts` en el Step 1 de esta misma tarea (no existía antes). Si queda vacía (no seteada), `mintServiceToken()` debe fallar con un error claro en vez de firmar un token con `sub: ""` que el backend Python rechazaría con un 401 confuso.
- `externalId` NO es único global en `ZymoConfigList` (la plataforma con id 5 y la persona con id 5 tendrían el mismo `externalId`), por eso el matching es un `findFirst({ where: { listType, externalId } })` manual, no `prisma.upsert` (que exigiría un campo `@unique`). Para `ZymoAreaPrefix` (sin `listType`) el matching es `findFirst({ where: { externalId } })`.
- Al **crear** hay que respetar las restricciones `@@unique([listType, value])` (ConfigList) y `@unique prefix` (AreaPrefix): helpers `uniqueConfigValue` / `uniqueAreaPrefix` sufijan hasta encontrar un valor libre.
- Al **actualizar** solo se tocan `label`+`syncedAt` (ConfigList) o `area`+`syncedAt` (AreaPrefix). Nunca `value`/`prefix`/`isActive`/`sortOrder` (así una fila que el admin desactivó sigue desactivada, y las referencias `value` guardadas en tickets viejos no se rompen).
- Node 20 provee `fetch`/`Response` globales (tipados por `@types/node ^20.16`); no se agrega axios ni node-fetch.

**Files:**
- Modify: `zymoally-backend/src/config/env.ts`
- Modify: `docker-compose.yml`
- Create: `zymoally-backend/src/services/masterDataSync.ts`

- [ ] **Step 1: Agregar `SYNC_SERVICE_EMAIL` a `env.ts`**

En `zymoally-backend/src/config/env.ts`, agregar la línea `SYNC_SERVICE_EMAIL` dentro del objeto `env`, justo después de `PUBLIC_APP_URL`. El archivo completo debe quedar:

```ts
export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3005", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://zymoally:zymoallypass@zymoally-db:5432/zymoallydb",
  // FastAPI signs tokens with SECRET_KEY; JWT_SECRET is accepted as an alias.
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.SECRET_KEY ?? (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET (or SECRET_KEY) must be set in production");
    }
    return "change-me-same-as-fastapi";
  })(),
  INTRANET_API_URL: process.env.INTRANET_API_URL ?? "http://backend:8001",
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL ?? "http://localhost:8080",
  // Cuenta de servicio en el backend Python (sin login humano) usada por el
  // sync de datos maestros — ver "Prerrequisito manual" al inicio del plan.
  SYNC_SERVICE_EMAIL: process.env.SYNC_SERVICE_EMAIL ?? "",
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./uploads",
  CORS_ORIGIN: process.env.CORS_ORIGIN,
} as const;

export type Env = typeof env;
```

- [ ] **Step 2: Crear el servicio completo**

Crear `zymoally-backend/src/services/masterDataSync.ts` con exactamente este contenido:

```ts
import jwt from "jsonwebtoken"
import { prisma } from "../config/prisma"
import { env } from "../config/env"
import { normalizePrefix } from "../utils/formatters"

// ─── Tipos de respuesta del backend Python (intranet) ───────────────────────
interface IntranetArea {
  id: number
  name: string
}

interface IntranetSede {
  id: number
  name: string
  visible_en_solicitudes_oc?: boolean
}

interface IntranetPersona {
  id: number
  nombre: string
}

interface IntranetPersonasResponse {
  total: number
  items: IntranetPersona[]
}

// ─── Resultado del sync ─────────────────────────────────────────────────────
interface SyncSection {
  fetched: number
  created: number
  updated: number
}

export interface SyncMasterDataResult {
  areas: SyncSection
  platforms: SyncSection
  personas: SyncSection
  ranAt: string
}

// ─── Token de servicio ───────────────────────────────────────────────────────
// get_current_user (backend Python, app/core/deps.py) decodifica el JWT, toma
// el claim "sub" (email), y carga el usuario REAL de la base de datos — no
// confía en role/id sueltos dentro del payload. El token debe llevar
// únicamente sub+exp, igual que create_access_token en Python. La cuenta
// SYNC_SERVICE_EMAIL debe existir de verdad en la tabla `user` (ver
// "Prerrequisito manual" al inicio del plan) con el role/permisos deseados.
function mintServiceToken(): string {
  if (!env.SYNC_SERVICE_EMAIL) {
    throw new Error(
      "SYNC_SERVICE_EMAIL no está configurada — no se puede sincronizar datos maestros sin la cuenta de servicio. Ver 'Prerrequisito manual' en el plan.",
    )
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  return jwt.sign(
    { sub: env.SYNC_SERVICE_EMAIL, exp: nowSeconds + 5 * 60 },
    env.JWT_SECRET,
    { algorithm: "HS256" },
  )
}

// ─── Fetch autenticado contra la intranet (fetch nativo de Node 20) ─────────
async function fetchIntranet<T>(pathAndQuery: string, token: string): Promise<T> {
  const res = await fetch(`${env.INTRANET_API_URL}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Intranet ${pathAndQuery} respondió ${res.status}`)
  }
  return (await res.json()) as T
}

// ─── Helpers de unicidad (respetan las @@unique del schema) ─────────────────
async function uniqueConfigValue(listType: string, base: string): Promise<string> {
  let candidate = base
  let n = 2
  while (await prisma.zymoConfigList.findFirst({ where: { listType, value: candidate } })) {
    candidate = `${base} (${n})`
    n++
  }
  return candidate
}

async function uniqueAreaPrefix(name: string, taken: Set<string>): Promise<string> {
  const base = normalizePrefix(name)
  let candidate = base
  let n = 2
  while (taken.has(candidate)) {
    candidate = `${base}${n}`
    n++
  }
  return candidate
}

// ─── Upsert de un listType de ZymoConfigList por externalId ─────────────────
async function syncConfigList(
  listType: string,
  items: { externalId: string; label: string }[],
): Promise<SyncSection> {
  const section: SyncSection = { fetched: items.length, created: 0, updated: 0 }
  const maxRow = await prisma.zymoConfigList.aggregate({
    where: { listType },
    _max: { sortOrder: true },
  })
  let nextOrder = (maxRow._max.sortOrder ?? -1) + 1
  for (const item of items) {
    const existing = await prisma.zymoConfigList.findFirst({
      where: { listType, externalId: item.externalId },
    })
    if (existing) {
      await prisma.zymoConfigList.update({
        where: { id: existing.id },
        data: { label: item.label, syncedAt: new Date() },
      })
      section.updated++
      continue
    }
    const value = await uniqueConfigValue(listType, item.label)
    await prisma.zymoConfigList.create({
      data: {
        listType,
        value,
        label: item.label,
        externalId: item.externalId,
        sortOrder: nextOrder,
        isActive: true,
        syncedAt: new Date(),
      },
    })
    nextOrder++
    section.created++
  }
  return section
}

// ─── Upsert de áreas → ZymoAreaPrefix por externalId ────────────────────────
async function syncAreas(areas: IntranetArea[]): Promise<SyncSection> {
  const section: SyncSection = { fetched: areas.length, created: 0, updated: 0 }
  const existingPrefixes = await prisma.zymoAreaPrefix.findMany({ select: { prefix: true } })
  const taken = new Set(existingPrefixes.map((p) => p.prefix))
  const maxRow = await prisma.zymoAreaPrefix.aggregate({ _max: { sortOrder: true } })
  let nextOrder = (maxRow._max.sortOrder ?? -1) + 1
  for (const area of areas) {
    const externalId = String(area.id)
    const existing = await prisma.zymoAreaPrefix.findFirst({ where: { externalId } })
    if (existing) {
      await prisma.zymoAreaPrefix.update({
        where: { id: existing.id },
        data: { area: area.name, syncedAt: new Date() },
      })
      section.updated++
      continue
    }
    const prefix = await uniqueAreaPrefix(area.name, taken)
    taken.add(prefix)
    await prisma.zymoAreaPrefix.create({
      data: {
        area: area.name,
        prefix,
        isActive: true,
        sortOrder: nextOrder,
        externalId,
        syncedAt: new Date(),
      },
    })
    nextOrder++
    section.created++
  }
  return section
}

// ─── Orquestador público (compartido por cron y botón manual) ───────────────
export async function syncMasterData(): Promise<SyncMasterDataResult> {
  const token = mintServiceToken()
  const [areas, sedes, personasResp] = await Promise.all([
    fetchIntranet<IntranetArea[]>("/areas", token),
    fetchIntranet<IntranetSede[]>("/sedes?para_solicitudes_oc=true", token),
    fetchIntranet<IntranetPersonasResponse>("/tc/personas?estado=activo&limit=500", token),
  ])

  const areasResult = await syncAreas(areas)
  const platformsResult = await syncConfigList(
    "platforms",
    sedes.map((s) => ({ externalId: String(s.id), label: s.name })),
  )
  const personasResult = await syncConfigList(
    "personas",
    personasResp.items.map((p) => ({ externalId: String(p.id), label: p.nombre })),
  )

  return {
    areas: areasResult,
    platforms: platformsResult,
    personas: personasResult,
    ranAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 3: Agregar `SYNC_SERVICE_EMAIL` al `docker-compose.yml` del repo**

En `docker-compose.yml`, dentro del bloque `zymoally-backend.environment` (líneas 204-210), agregar la variable junto a las demás. El bloque completo debe quedar:

```yaml
    environment:
      - NODE_ENV=production
      - PORT=3005
      - DATABASE_URL=postgresql://${ZYMOALLY_DB_USER:-zymoally}:${ZYMOALLY_DB_PASSWORD}@zymoally-db:5432/${ZYMOALLY_DB_NAME:-zymoallydb}
      - INTRANET_API_URL=http://backend:8001
      - SYNC_SERVICE_EMAIL=${SYNC_SERVICE_EMAIL}
      - UPLOAD_DIR=/app/uploads
      - CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:81}
```

Esto solo referencia la variable — el valor real (`SYNC_SERVICE_EMAIL=sync-zymoally@zymologistica.internal` o el email que se haya usado) va en el `.env` del servidor, que el usuario agrega manualmente (ver "Prerrequisito manual" al inicio del plan), igual que ya pasó con `ZYMOALLY_DB_PASSWORD`.

- [ ] **Step 4: Verificar tipos (con cliente Prisma regenerado)**

Run (desde `zymoally-backend/`):
```bash
npx prisma generate && npx tsc --noEmit
```
Expected: sin errores. Los accesos `prisma.zymoConfigList.findFirst({ where: { ..., externalId } })` y los campos `externalId`/`syncedAt` en `data:` compilan porque el cliente incluye las columnas de la Task 1. `fetch`/`Response` resuelven a los globales de Node 20. `env.SYNC_SERVICE_EMAIL` compila porque se agregó en el Step 1.

- [ ] **Step 5: Commit**

```bash
git add zymoally-backend/src/config/env.ts zymoally-backend/src/services/masterDataSync.ts docker-compose.yml
git commit -m "feat(zymoally): servicio de sincronizacion de datos maestros desde intranet"
```

---

## Task 4: Cron con `node-cron` + arranque en `app.ts`

Programa `syncMasterData()` a las 6am, 12pm y 4pm. `node-cron` es la **primera** dependencia de cron en cualquier backend Node de este repo; queda como patrón a clonar si otro backend necesita un cron interno.

**Files:**
- Modify: `zymoally-backend/package.json:13-32`
- Create: `zymoally-backend/src/cron.ts`
- Modify: `zymoally-backend/src/app.ts:4-6` (imports) y `:74-78` (arranque)

- [ ] **Step 1: Instalar `node-cron` + sus tipos**

Run (desde `zymoally-backend/`):
```bash
npm install node-cron@^3.0.3 && npm install -D @types/node-cron@^3.0.11
```
Expected: `package.json` gana `"node-cron": "^3.0.3"` en `dependencies` y `"@types/node-cron": "^3.0.11"` en `devDependencies`; `package-lock.json` se actualiza. Sin errores de instalación.

Si tras el install `package.json` no reflejara exactamente esas versiones, editarlo a mano para que las secciones queden así:

```json
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/multer": "^1.4.12",
    "@types/node": "^20.16.10",
    "@types/node-cron": "^3.0.11",
    "prisma": "^5.22.0",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.2"
  }
```

- [ ] **Step 2: Crear `src/cron.ts`**

Crear `zymoally-backend/src/cron.ts` con exactamente este contenido:

```ts
import cron from "node-cron"
import { syncMasterData } from "./services/masterDataSync"

/**
 * Programa la sincronización de datos maestros (áreas, plataformas, personas)
 * desde el directorio de la intranet. `node-cron` es el primer uso de esta
 * dependencia en los backends Node del repo — patrón a clonar si otro backend
 * necesita un cron interno. Horario: 6am, 12pm y 4pm (hora del servidor).
 */
export function startSyncCron(): void {
  cron.schedule("0 6,12,16 * * *", () => {
    syncMasterData()
      .then((r) =>
        console.log(
          `[sync] datos maestros ${r.ranAt} — areas +${r.areas.created}/~${r.areas.updated}, ` +
            `platforms +${r.platforms.created}/~${r.platforms.updated}, ` +
            `personas +${r.personas.created}/~${r.personas.updated}`,
        ),
      )
      .catch((err) => console.error("[sync] error en sync programado:", err))
  })
  console.log("[sync] cron de datos maestros programado (0 6,12,16 * * *)")
}
```

- [ ] **Step 3: Importar y arrancar el cron en `app.ts`**

En `zymoally-backend/src/app.ts`, agregar el import junto a los demás imports de la parte superior. Reemplazar la línea 5:

```ts
import { env } from "./config/env"
```

por:

```ts
import { env } from "./config/env"
import { startSyncCron } from "./cron"
```

Luego, en el bloque de arranque del servidor (líneas 74-78), reemplazar:

```ts
if (require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`zymoally-backend listening on port ${env.PORT}`)
  })
}
```

por:

```ts
if (require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`zymoally-backend listening on port ${env.PORT}`)
  })
  startSyncCron()
}
```

- [ ] **Step 4: Verificar tipos**

Run (desde `zymoally-backend/`):
```bash
npx tsc --noEmit
```
Expected: sin errores. `import cron from "node-cron"` resuelve gracias a `@types/node-cron`; `startSyncCron` está tipado y se invoca sin argumentos.

- [ ] **Step 5: Commit**

```bash
git add zymoally-backend/package.json zymoally-backend/package-lock.json zymoally-backend/src/cron.ts zymoally-backend/src/app.ts
git commit -m "feat(zymoally): cron 3x/dia para sincronizar datos maestros"
```

---

## Task 5: Endpoint manual `POST /api/tickets/config/sync`

Botón manual del admin. El router `pqrConfig` se monta bajo `requireTicketsAccess` en `app.ts`; la ruta agrega `requireTicketsConfig` (gate `mod_tickets_config`, admin/gerente bypasan). Reusa el mismo `syncMasterData()`.

**Files:**
- Modify: `zymoally-backend/src/routers/tickets/pqrConfig.ts:1-8` (import) y `:141-143` (nueva ruta antes de `export default`)

- [ ] **Step 1: Importar el servicio**

En `zymoally-backend/src/routers/tickets/pqrConfig.ts`, agregar el import del servicio junto a los demás. Reemplazar la línea 6:

```ts
import { normalizePrefix } from "../../utils/formatters"
```

por:

```ts
import { normalizePrefix } from "../../utils/formatters"
import { syncMasterData } from "../../services/masterDataSync"
```

- [ ] **Step 2: Agregar la ruta `POST /sync`**

En el mismo archivo, insertar la ruta justo antes de `export default router` (línea 143). El final del archivo debe quedar así:

```ts
// POST /sync — sincroniza áreas/plataformas/personas desde el directorio intranet.
// Gate mod_tickets_config (botón temporal; la pantalla de config global es F5).
router.post("/sync", requireTicketsConfig, async (_req, res, next) => {
  try {
    const result = await syncMasterData()
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 3: Verificar tipos**

Run (desde `zymoally-backend/`):
```bash
npx tsc --noEmit
```
Expected: sin errores. `syncMasterData` se importa y se usa; `requireTicketsConfig` ya estaba importado en el archivo.

- [ ] **Step 4: Commit**

```bash
git add zymoally-backend/src/routers/tickets/pqrConfig.ts
git commit -m "feat(zymoally): endpoint manual POST /config/sync gateado por mod_tickets_config"
```

---

## Task 6: Frontend — tipos, permiso y hook de sync

Prepara el andamiaje del frontend antes de tocar la UI: el tipo `personas` en las listas, el tipo del resultado del sync, el helper de permiso y el hook de mutación.

**Files:**
- Modify: `frontend/src/types/ticket.ts:77-92` (interface `TicketConfigLists`) y agregar `SyncMasterDataResult` al final
- Modify: `frontend/src/lib/permissions.ts:124-127` (después de `canSeeTickets`)
- Modify: `frontend/src/hooks/useTickets.ts:1-9` (imports) y agregar `useSyncMasterData` al final

- [ ] **Step 1: Agregar `personas` a `TicketConfigLists`**

En `frontend/src/types/ticket.ts`, reemplazar la interface `TicketConfigLists` (líneas 77-92) por:

```ts
export interface TicketConfigLists {
  clients: TicketListItem[]
  platforms: TicketListItem[]
  supervisors: TicketListItem[]
  analysts: TicketListItem[]
  coordinators: TicketListItem[]
  personas: TicketListItem[]
  generators: TicketListItem[]
  phones: TicketListItem[]
  emails: TicketListItem[]
  impacts: TicketListItem[]
  types: TicketListItem[]
  statuses: TicketListItem[]
  priorities: TicketListItem[]
  channels: TicketListItem[]
  managementCriteria: TicketListItem[]
}
```

- [ ] **Step 2: Agregar el tipo `SyncMasterDataResult`**

En el mismo archivo `frontend/src/types/ticket.ts`, agregar al final del archivo (después de `TicketDashboardResult`):

```ts
export interface SyncSectionResult {
  fetched: number
  created: number
  updated: number
}

export interface SyncMasterDataResult {
  areas: SyncSectionResult
  platforms: SyncSectionResult
  personas: SyncSectionResult
  ranAt: string
}
```

- [ ] **Step 3: Agregar `canConfigTickets` a permisos**

En `frontend/src/lib/permissions.ts`, insertar esta función inmediatamente después de `canSeeTickets` (que termina en la línea 127):

```ts
export function canConfigTickets(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tickets_config")
}
```

- [ ] **Step 4: Agregar el import del tipo en `useTickets.ts`**

En `frontend/src/hooks/useTickets.ts`, reemplazar el bloque de import de tipos (líneas 3-9):

```ts
import type {
  Ticket,
  CreateTicketInput,
  TicketConfigLists,
  TicketAreaPrefix,
  TicketDashboardResult,
} from "@/types/ticket"
```

por:

```ts
import type {
  Ticket,
  CreateTicketInput,
  TicketConfigLists,
  TicketAreaPrefix,
  TicketDashboardResult,
  SyncMasterDataResult,
} from "@/types/ticket"
```

- [ ] **Step 5: Agregar el hook `useSyncMasterData`**

En el mismo archivo `frontend/src/hooks/useTickets.ts`, agregar al final del archivo (después de `useTicketDashboard`):

```ts
// ─── Sincronización de datos maestros (botón manual, gate mod_tickets_config) ─

export function useSyncMasterData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await zymoallyApi.post<SyncMasterDataResult>(
        "/api/tickets/config/sync"
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-config-lists"] })
      qc.invalidateQueries({ queryKey: ["tickets-area-prefixes"] })
    },
  })
}
```

- [ ] **Step 6: Verificar build del frontend**

Run (desde `frontend/`):
```bash
npm run build
```
Expected: `tsc -b && vite build` termina sin errores. (`npx tsc --noEmit` NO sirve para el frontend — ver Restricciones del entorno.) `SyncMasterDataResult` se importa como tipo con `import type` (el frontend usa `verbatimModuleSyntax`, romper esto daría TS1484).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/ticket.ts frontend/src/lib/permissions.ts frontend/src/hooks/useTickets.ts
git commit -m "feat(zymoally): tipos, permiso y hook para sincronizar datos maestros"
```

---

## Task 7: UI — recablear selects de personas + botón "Sincronizar ahora"

Dos cambios en el diálogo de creación:
1. Los selects **Supervisor**, **Analista** y **Coordinador** ahora leen la lista unificada `lists?.personas` (antes leían `supervisors`/`analysts`/`coordinators`, que tras el sync quedan con solo el valor semilla genérico). La **Plataforma** ya lee `lists?.platforms`, así que no cambia.
2. Un botón mínimo "Sincronizar ahora" en el header del diálogo, visible solo si el usuario tiene `mod_tickets_config` (o es admin). NO es una pantalla nueva — es un botón temporal (la config global es F5).

**Files:**
- Modify: `frontend/src/components/tickets/TicketDialog.tsx:1-12` (imports), `:49-58` (estado del componente), `:94-96` (header), `:136-156` (los 3 selects de personas)

- [ ] **Step 1: Agregar imports**

En `frontend/src/components/tickets/TicketDialog.tsx`, reemplazar el bloque de imports (líneas 5-12):

```ts
import { FormSelect } from "@/components/tareas/FormSelect"
import { useTicketsUI } from "@/context/TicketsContext"
import {
  useTicketConfigLists, useTicketAreaPrefixes, useTicketCodePreview, useCreateTicket,
} from "@/hooks/useTickets"
import { currentDateValue } from "@/lib/ticketWork"
import { extractErrorMessage } from "@/lib/ticketErrors"
import { useTicketToast } from "./TicketToast"
```

por:

```ts
import { FormSelect } from "@/components/tareas/FormSelect"
import { useTicketsUI } from "@/context/TicketsContext"
import {
  useTicketConfigLists, useTicketAreaPrefixes, useTicketCodePreview, useCreateTicket,
  useSyncMasterData,
} from "@/hooks/useTickets"
import { currentDateValue } from "@/lib/ticketWork"
import { extractErrorMessage } from "@/lib/ticketErrors"
import { canConfigTickets } from "@/lib/permissions"
import { useAuthStore } from "@/store/authStore"
import { useTicketToast } from "./TicketToast"
```

- [ ] **Step 2: Agregar estado de sync y handler en el componente**

En el mismo archivo, dentro de `TicketDialog()`, reemplazar el bloque de hooks/estado (líneas 50-58):

```ts
  const { dialogOpen, setDialogOpen } = useTicketsUI()
  const { data: lists } = useTicketConfigLists()
  const { data: areas = [] } = useTicketAreaPrefixes()
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const createTicket = useCreateTicket()
  const { data: preview } = useTicketCodePreview(form.date, form.areaPrefix)
  const { showToast } = useTicketToast()
```

por:

```ts
  const { dialogOpen, setDialogOpen } = useTicketsUI()
  const { data: lists } = useTicketConfigLists()
  const { data: areas = [] } = useTicketAreaPrefixes()
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const createTicket = useCreateTicket()
  const syncMasterData = useSyncMasterData()
  const { data: preview } = useTicketCodePreview(form.date, form.areaPrefix)
  const { showToast } = useTicketToast()
  const user = useAuthStore((s) => s.user)
  const canSync = user ? canConfigTickets(user.role, user.app_permissions) : false

  async function handleSync() {
    try {
      const r = await syncMasterData.mutateAsync()
      const created = r.areas.created + r.platforms.created + r.personas.created
      const updated = r.areas.updated + r.platforms.updated + r.personas.updated
      showToast(`Datos maestros sincronizados: ${created} nuevos, ${updated} actualizados`, "success")
    } catch (err) {
      showToast(extractErrorMessage(err, "No se pudo sincronizar los datos maestros."), "error")
    }
  }
```

- [ ] **Step 3: Agregar el botón al header**

En el mismo archivo, reemplazar el `DialogHeader` (líneas 94-96):

```tsx
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
        </DialogHeader>
```

por:

```tsx
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Nuevo ticket</DialogTitle>
            {canSync && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncMasterData.isPending}
                className="mr-6 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {syncMasterData.isPending ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
            )}
          </div>
        </DialogHeader>
```

- [ ] **Step 4: Recablear los selects Supervisor/Analista/Coordinador a `personas`**

En el mismo archivo, reemplazar los tres `FormSelect` de personas (líneas 136-156):

```tsx
              <FormSelect
                label="Supervisor"
                value={form.supervisor}
                onChange={(v) => set("supervisor", v)}
                options={(lists?.supervisors ?? []).map((s) => ({ value: s.value, label: s.label }))}
                noneLabel="Sin asignar"
              />
              <FormSelect
                label="Analista"
                value={form.analyst}
                onChange={(v) => set("analyst", v)}
                options={(lists?.analysts ?? []).map((a) => ({ value: a.value, label: a.label }))}
                noneLabel="Sin asignar"
              />
              <FormSelect
                label="Coordinador"
                value={form.coordinator}
                onChange={(v) => set("coordinator", v)}
                options={(lists?.coordinators ?? []).map((c) => ({ value: c.value, label: c.label }))}
                noneLabel="Sin asignar"
              />
```

por:

```tsx
              <FormSelect
                label="Supervisor"
                value={form.supervisor}
                onChange={(v) => set("supervisor", v)}
                options={(lists?.personas ?? []).map((p) => ({ value: p.value, label: p.label }))}
                noneLabel="Sin asignar"
              />
              <FormSelect
                label="Analista"
                value={form.analyst}
                onChange={(v) => set("analyst", v)}
                options={(lists?.personas ?? []).map((p) => ({ value: p.value, label: p.label }))}
                noneLabel="Sin asignar"
              />
              <FormSelect
                label="Coordinador"
                value={form.coordinator}
                onChange={(v) => set("coordinator", v)}
                options={(lists?.personas ?? []).map((p) => ({ value: p.value, label: p.label }))}
                noneLabel="Sin asignar"
              />
```

- [ ] **Step 5: Verificar build del frontend**

Run (desde `frontend/`):
```bash
npm run build
```
Expected: `tsc -b && vite build` sin errores. `useAuthStore((s) => s.user)` devuelve `User | null`; `canConfigTickets(user.role, user.app_permissions)` tipa correcto; `showToast(msg, "error")` es válido (`TicketToastType = "success" | "error"`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/tickets/TicketDialog.tsx
git commit -m "feat(zymoally): selects de personas unificados + boton Sincronizar ahora"
```

---

## Self-Review

### 1. Cobertura del spec

| Requisito del spec | Tarea que lo cubre |
|---|---|
| Sincronizar Área desde `GET /areas` → `ZymoAreaPrefix` con `externalId`/`syncedAt` | Task 1 (columnas), Task 3 (`syncAreas`) |
| Sincronizar Plataforma desde `GET /sedes?para_solicitudes_oc=true` → `ZymoConfigList listType=platforms` | Task 3 (`syncConfigList("platforms", …)`) |
| Sincronizar personas desde `GET /tc/personas?estado=activo&limit=500` → `ZymoConfigList listType=personas` (lista única compartida por los 3 campos) | Task 2 (registrar listType), Task 3 (`syncConfigList("personas", …)`), Task 7 (recablear los 3 selects) |
| Token de servicio JWT `role:"admin"`, TTL 5 min, secreto HS256 compartido | Task 3 (`mintServiceToken`) |
| Upsert por `externalId`: si existe → actualiza `label`/`area`+`syncedAt`, no toca `isActive`/`prefix`/`sortOrder`; si no → crea `isActive:true`; nunca borra | Task 3 (`syncConfigList`, `syncAreas`) |
| Prefijo automático para área nueva sin mapeo vía `normalizePrefix` | Task 3 (`uniqueAreaPrefix`) |
| Cron `0 6,12,16 * * *` con `node-cron` (dep nueva, documentada) | Task 4 |
| Botón manual `POST /api/tickets/config/sync` gate `mod_tickets_config` | Task 5 (endpoint), Task 6 (hook + permiso), Task 7 (botón) |
| Botón mínimo, no pantalla nueva, visible solo con `mod_tickets_config` | Task 7 |
| Fuera de alcance (portal global, pantalla de edición F5, filtrado por cargo, otros backends) | No se implementa nada de esto — respetado |

### 2. Escaneo de placeholders
Revisado: no hay "TBD", "similar a", "…implementar…", ni pasos que describan sin mostrar código. Todo bloque de código está completo. Los `…` que aparecen son literales de UI (`"Sincronizando…"`, `preview?.code ?? "…"`), no placeholders del plan.

### 3. Consistencia de tipos/nombres entre tareas
- `syncMasterData` — definido/export en Task 3, importado idéntico en Task 4 (`cron.ts`) y Task 5 (`pqrConfig.ts`). ✓
- `SyncMasterDataResult` — export en Task 3 (backend) y definido en paralelo en Task 6 (frontend `types/ticket.ts`, misma forma: `areas/platforms/personas: {fetched,created,updated}` + `ranAt`). Usado por `useSyncMasterData` (Task 6) y `handleSync` (Task 7). ✓
- `startSyncCron` — definido en Task 4 (`cron.ts`), importado/llamado en Task 4 (`app.ts`). ✓
- `useSyncMasterData` — definido en Task 6 (`useTickets.ts`), importado en Task 7 (`TicketDialog.tsx`). ✓
- `canConfigTickets(role, appPerms?)` — definido en Task 6 (`permissions.ts`), llamado en Task 7 con `(user.role, user.app_permissions)`. ✓
- `"personas"` — listType agregado en Task 2 (`PQR_LIST_TYPES` + `defaultPqrConfig`), expuesto por `GET /listas`, tipado en Task 6 (`TicketConfigLists.personas`), consumido en Task 7 (`lists?.personas`), escrito por Task 3. ✓
- `env.JWT_SECRET` (no `env.SECRET_KEY`) — usado consistentemente en Task 3; ver nota de ambigüedad abajo. ✓
- `showToast(message, "error")` — `TicketToastType` admite `"error"` (verificado en `TicketToast.tsx`). ✓

### Ambigüedades del spec resueltas por el planificador
1. **`env.SECRET_KEY` no existe en `env.ts`.** El snippet del spec firmaba con `env.SECRET_KEY`, pero `config/env.ts` solo expone `env.JWT_SECRET` (que ya cae a `process.env.SECRET_KEY`). Resuelto usando `env.JWT_SECRET` — mismo secreto HS256, validable por FastAPI.
2. **`listType:"personas"` era invisible para el formulario.** El spec manda una sola lista `personas`, pero `GET /listas` solo agrupa por `PQR_LIST_TYPES` (que no la incluía) y el formulario leía `supervisors`/`analysts`/`coordinators`. Resuelto agregando `"personas"` a `PQR_LIST_TYPES` + default vacío (Task 2), al tipo `TicketConfigLists` (Task 6), y recableando los 3 selects a `lists?.personas` (Task 7) — sin esto el sync de personas no tendría efecto visible, contradiciendo el objetivo del spec.
3. **`externalId` no puede ser único global en `ZymoConfigList`** (colisión plataforma-id vs persona-id). Resuelto con matching manual `findFirst({ where: { listType, externalId } })` en vez de `prisma.upsert`, sin nueva restricción `@unique`, y helpers `uniqueConfigValue`/`uniqueAreaPrefix` para respetar `@@unique([listType,value])` y `@unique prefix` al crear.
4. **[Corrección post-revisión, no del planificador original] El token de servicio con `role: "admin"` en el payload no funciona.** Verificado leyendo `backend/app/core/deps.py::get_current_user`: decodifica el JWT, toma el claim `sub` (email), y hace `db.exec(select(User).where(User.email == sub))` — el `role`/permisos usados en todo el sistema son los del `User` real cargado de la base de datos, no los claims del token. Un token con `role:"admin"` pero sin `sub`, o con un `sub` que no existe como usuario real, recibe 401. Corregido: (a) el token de servicio ahora solo lleva `sub`+`exp`, igual que `create_access_token` en Python; (b) se agrega un "Prerrequisito manual" al inicio del plan — el usuario debe crear una cuenta de servicio real vía `POST /auth/register` antes de ejecutar la Task 3; (c) nueva variable `SYNC_SERVICE_EMAIL` agregada a `env.ts` (Task 3) y a `docker-compose.yml` (Task 3) apuntando a esa cuenta.

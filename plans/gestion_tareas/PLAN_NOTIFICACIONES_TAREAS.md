# Plan: Notificaciones y Calendar Sync — Gestión de Tareas V2

> **Relacionado con:**
> - `PLAN_GT_2_0.md` sección 9.1 — Extensiones planificadas
> - `2026-05-21-auditoria-logica-gestion-tareas.md` Error #39 — Sin notificaciones al asignar tarea
> - `Funcionalidad y flujo (Gestión tareas).md` — Flujo de asignación y aceptación definido por usuario

**Fecha:** 2026-05-27
**Estado:** En planificación
**Módulo:** task-backend (Node.js) + Frontend Admin + Power Automate

---

## Decisiones Arquitectónicas

### ¿Por qué Node.js para email y webhook?

| Criterio | Node.js (task-backend) | Python (FastAPI backend) |
|---|---|---|
| Dónde vive el evento | ✅ Aquí (task creation/accept) | ❌ Requiere HTTP roundtrip |
| Patrón ya establecido | ✅ Escalación WhatsApp ya hace HTTP POST | — |
| Librería email | `nodemailer` (simple, maduro) | `fastapi-mail` (ya instalado, solo para OC) |
| Acoplamiento | ✅ Ninguno — self-contained | ❌ Agrega dependencia inter-servicio |
| Config en DB | ✅ `SystemConfig` table en taskdb | Necesitaría tabla nueva en otro DB |

**Veredicto: Node.js en task-backend para todo.**

### ¿Por qué no .env para SMTP?

El usuario no quiere gestionar variables de entorno manualmente. La solución es una tabla `SystemConfig` en PostgreSQL (taskdb) que almacena configuraciones clave-valor. La contraseña SMTP se cifra con AES-256 usando el `JWT_SECRET` existente — sin agregar ninguna variable nueva al .env.

### Power Automate vs. Microsoft Graph API

| Opción | Ventajas | Desventajas |
|---|---|---|
| **Power Automate HTTP trigger** | Cero código en Microsoft; UI visual; el equipo puede editarlo | URL del webhook tiene auth embebida; depende de licencia PA |
| **Microsoft Graph API directa** | Control total; sin dependencia de PA | Requiere Azure AD app registration, secretos OAuth, refresh tokens — mucho overhead |

**Veredicto: Power Automate.** El webhook URL se guarda en `SystemConfig` desde la UI. Power Automate se configura una vez y listo.

---

## Alcance del Plan

### Fase 1 — Infraestructura SystemConfig (Base para todo)

> Sin esto, no hay Fase 2 ni Fase 3.

**Prisma: nueva tabla `SystemConfig`**
```prisma
model SystemConfig {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  value     String?  // texto plano o cifrado (marcado con encrypted=true)
  encrypted Boolean  @default(false)
  updatedAt DateTime @updatedAt
  @@map("system_config")
}
```

**Claves que se van a almacenar:**

| key | descripción | encrypted |
|---|---|---|
| `smtp_host` | Servidor SMTP (smtp.office365.com) | false |
| `smtp_port` | Puerto (587) | false |
| `smtp_user` | usuario@zymologistica.com | false |
| `smtp_password` | contraseña SMTP | **true** |
| `smtp_from` | "Zymo Intranet <noreply@...>" | false |
| `smtp_enabled` | "true"/"false" — toggle global | false |
| `webhook_powerautomate_url` | URL del HTTP trigger de PA | false |
| `webhook_enabled` | "true"/"false" | false |

**Archivos nuevos:**
- `task-backend/src/services/systemConfigService.ts` — get/set/getDecrypted + cache 60s
- `task-backend/src/routers/systemConfig.ts` — GET /api/config (admin), PUT /api/config (admin)

**Frontend:**
- Nueva pestaña **"Configuración"** en `AdminPage.tsx`
- Formulario SMTP: host, puerto, usuario, contraseña (input type=password), from, toggle activo
- Formulario Webhook: URL del PA, toggle activo
- Botón **"Probar email"** → llama a `/api/config/test-email` (envía email de prueba a admin)
- Botón **"Probar webhook"** → llama a `/api/config/test-webhook` (envía payload de prueba a PA)

---

### Fase 2 — Email de Asignación de Tareas (Nodemailer)

**Instalar:** `nodemailer` + `@types/nodemailer`

**Archivo nuevo:** `task-backend/src/services/emailService.ts`

```typescript
// Crea transport desde SystemConfig (no .env)
async function getTransport(): Promise<nodemailer.Transporter>

// Emails a implementar:
sendTaskAssignedEmail(to: string, data: TaskAssignedData)
sendTaskAcceptedEmail(to: string, data: TaskResponseData)
sendTaskRejectedEmail(to: string, data: TaskResponseData)
```

**Templates HTML:** branded con colores Zymo, responsive, info mínima:
- Nombre de quien asignó / nombre del asignado
- Título de la tarea
- Fecha, prioridad, equipo
- CTA button → link a la intranet `/herramientas/tareas`

**Triggers en `taskService.ts`:**

| Evento | Email enviado a | Template |
|---|---|---|
| `createTask` con `asignadoAId !== subidoPorId` | Asignado | "Tienes una nueva tarea" |
| `acceptOrRejectTask` con resultado "aceptada" | Creador | "Tu tarea fue aceptada" |
| `acceptOrRejectTask` con resultado "rechazada" | Creador | "Tu tarea fue rechazada" |

**Nota importante:** los emails se envían **fire-and-forget** (`void sendEmail(...)`) — no bloquean la respuesta HTTP. Si falla, se loguea a console.error pero no lanza excepción.

**Para obtener emails:** `emailService.ts` llamará a `INTRANET_API_URL/api/users/{id}` (ya existe el patrón en `getTeamMembers`).

---

### Fase 3 — Webhook Power Automate (Calendar Sync)

**Archivo nuevo:** `task-backend/src/services/webhookService.ts`

```typescript
sendWebhook(payload: WebhookPayload): Promise<void>
// Fire-and-forget, retry 1x en caso de error 5xx
```

**Payload para tarea asignada (bloqueo de agenda):**
```json
{
  "type": "tarea_asignada",
  "titulo": "Nombre de la tarea",
  "descripcion": "Descripción técnica...",
  "fecha": "2026-05-28",
  "horaInicio": "09:00",
  "horaCierre": "10:30",
  "duracionEstimadaMinutos": 120,
  "asignadoEmail": "user@zymologistica.com",
  "asignadoNombre": "Juan Pérez",
  "asignadoPorNombre": "Andres Q.",
  "equipo": "Desarrollo e Innovación",
  "prioridad": "alta",
  "urlTarea": "https://intranet.zymo.com/herramientas/tareas"
}
```

**Payload para evento creado (reunión en Teams):**
```json
{
  "type": "evento_creado",
  "titulo": "Nombre del evento",
  "descripcion": "...",
  "fecha": "2026-05-28",
  "horaInicio": "14:00",
  "duracionMinutos": 60,
  "modalidad": "virtual",
  "sede": null,
  "organizadorNombre": "Andres Q.",
  "equipo": "Desarrollo e Innovación",
  "participantes": [
    { "email": "user1@zymologistica.com", "nombre": "Juan" },
    { "email": "user2@zymologistica.com", "nombre": "María" }
  ]
}
```

**Triggers:**

| Evento | Webhook enviado | Qué hace PA |
|---|---|---|
| `createTask` con asignado diferente | `tarea_asignada` | Crea evento en Outlook del asignado (bloquea agenda) |
| `createEvent` en `eventService.ts` | `evento_creado` | Crea reunión Teams/Outlook e invita participantes |

**Configuración en Power Automate (instrucciones para usuario):**
1. Crear flujo "Automatizado" → trigger: "Cuando se reciba una solicitud HTTP"
2. Copiar la URL del trigger → pegarla en Settings de la intranet
3. Agregar acción: "Crear evento (V4)" en Outlook 365
4. Mapear campos del JSON al evento
5. Si `type == "evento_creado"` → también agregar acción "Crear reunión de Teams"

---

## Resumen de archivos a crear/modificar

### Nuevos archivos
| Archivo | Qué hace |
|---|---|
| `task-backend/prisma/schema.prisma` | + model SystemConfig |
| `task-backend/src/services/systemConfigService.ts` | get/set config desde DB |
| `task-backend/src/services/emailService.ts` | nodemailer + templates |
| `task-backend/src/services/webhookService.ts` | POST a Power Automate |
| `task-backend/src/routers/systemConfig.ts` | endpoints GET/PUT/test |
| `frontend/src/hooks/useSystemConfig.ts` | hooks para leer/escribir config |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `task-backend/src/services/taskService.ts` | Llamar email + webhook en createTask y acceptOrReject |
| `task-backend/src/services/eventService.ts` | Llamar webhook en createEvent |
| `task-backend/src/index.ts` | Registrar router systemConfig |
| `frontend/src/pages/AdminPage.tsx` | Nueva pestaña "Configuración" |

---

## Orden de implementación recomendado

```
1. Fase 1 completa (SystemConfig) — es la base
   1.1 Schema Prisma + migration
   1.2 systemConfigService.ts (get/set/encrypt)
   1.3 Router systemConfig.ts
   1.4 Frontend: pestaña Config en AdminPage

2. Fase 2 (Email)
   2.1 npm install nodemailer
   2.2 emailService.ts con templates
   2.3 Triggers en taskService.ts

3. Fase 3 (Webhook PA)
   3.1 webhookService.ts
   3.2 Trigger en taskService.ts (tarea_asignada)
   3.3 Trigger en eventService.ts (evento_creado)
```

---

## Lo que NO está en este plan (intencional)

- ❌ Notificaciones en el navegador (WebPush) — complejidad alta, baja prioridad
- ❌ Integración directa con Microsoft Graph API — Power Automate lo resuelve más simple
- ❌ Emails para cada cambio de estado de tarea — solo asignación/aceptación/rechazo por ahora
- ❌ Configuración SMTP por equipo — configuración global es suficiente

---

## Estimado de complejidad

| Fase | Archivos | Complejidad |
|---|---|---|
| Fase 1 — SystemConfig | 6 archivos | Media |
| Fase 2 — Email | 2 archivos + triggers | Media |
| Fase 3 — Webhook PA | 2 archivos + triggers | Baja |
| **Total** | **~10 archivos** | **Media-Alta** |

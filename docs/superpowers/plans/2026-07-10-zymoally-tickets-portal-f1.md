# Zymo Ally · Tickets — Fase 1 (Shell + Tickets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, navigable "Zymo Ally · Tickets" portal (sidebar entry, Tablero/Lista/Dashboard, crear/gestionar ticket) on top of the already-built `zymoally-backend`, styled like Gestión de Tareas V2.

**Architecture:** New sidebar item + route (`/zymoally/tickets`, permiso `mod_tickets`) mounts a self-contained shell (`TicketsShell`) that clones the structural pattern of `TaskShell`/`TaskSidebar`/`TaskTopbar` — internal navigation by view (Lista/Tablero/Dashboard), Radix `Dialog` for creación, Radix `Sheet` (Drawer) for gestión de un ticket existente. Todo el estado de datos vive en React Query hooks sobre un nuevo cliente axios (`zymoallyApi`), mismo patrón que `sigApi`/`taskApi`/`helixApi`. Sin animaciones ni fondos decorativos — solo estructura y color, según lo acordado en el spec.

**Tech Stack:** React 19 + Vite + TypeScript, Tailwind CSS, Radix UI primitives (`Dialog`, `Sheet`, `Tabs`, `Select`), `@dnd-kit` (tablero), `@tanstack/react-query`, axios. Backend: Express + Prisma + Zod (`zymoally-backend`, ya existente). Ningún paquete nuevo.

**Spec:** `docs/superpowers/specs/2026-07-10-zymoally-tickets-portal-f1-design.md`

---

### Task 1: Backend — campo `client` opcional

**Files:**
- Modify: `zymoally-backend/prisma/schema.prisma:19`
- Modify: `zymoally-backend/src/routers/tickets/pqr.ts:30`

- [ ] **Step 1: Volver `client` opcional en el schema**

En `zymoally-backend/prisma/schema.prisma`, en el modelo `ZymoPqrTicket`, cambiar:

```prisma
  client             String
```

por:

```prisma
  client             String?
```

- [ ] **Step 2: Migrar la base de datos de desarrollo**

Run: `cd zymoally-backend && npx prisma migrate dev --name ticket_client_optional`
Expected: `Your database is now in sync with your schema.` y el cliente Prisma se regenera automáticamente.

- [ ] **Step 3: Relajar la validación zod**

En `zymoally-backend/src/routers/tickets/pqr.ts`, dentro de `CreateTicketBody`, cambiar:

```ts
  client: z.string().min(1),
```

por:

```ts
  client: z.string().optional(),
```

- [ ] **Step 4: Verificar tipos**

Run: `cd zymoally-backend && npx tsc --noEmit`
Expected: sin errores. (`Prisma.ZymoPqrTicketCreateInput` ya deriva `client?: string` del schema — `services/pqrCode.ts` no necesita cambios porque su tipo `TicketInput` se calcula con `Omit<Prisma.ZymoPqrTicketCreateInput, ...>`.)

- [ ] **Step 5: Commit**

```bash
git add zymoally-backend/prisma/schema.prisma zymoally-backend/prisma/migrations zymoally-backend/src/routers/tickets/pqr.ts
git commit -m "fix(zymoally): client opcional en ZymoPqrTicket para tickets sin cliente externo"
```

---

### Task 2: Backend — sembrar tipos de ticket de operación interna

**Files:**
- Modify: `zymoally-backend/src/utils/constants.ts`
- Create: `zymoally-backend/prisma/backfillTicketTypes.ts`

**Contexto:** `seed.ts` solo siembra `types` si la tabla está vacía para ese grupo — una BD que ya tenía PQR sembrado (dev/sandbox) no recibe los valores nuevos solo por editar `defaultPqrConfig`. Se necesita un backfill idempotente aparte.

- [ ] **Step 1: Agregar los tipos nuevos a la lista por defecto**

En `zymoally-backend/src/utils/constants.ts`, cambiar:

```ts
  types: ["Peticion", "Queja", "Reclamo", "Solicitud", "Felicitacion", "Hallazgo operativo"],
```

por:

```ts
  types: [
    "Peticion", "Queja", "Reclamo", "Solicitud", "Felicitacion", "Hallazgo operativo",
    "Novedad de proceso", "Faltante o inconsistencia", "Mantenimiento de instalaciones",
    "Capacitación de personal", "Corrección de procedimiento", "OKR",
  ],
```

- [ ] **Step 2: Escribir el script de backfill**

Create `zymoally-backend/prisma/backfillTicketTypes.ts`:

```ts
// Ejecutar una sola vez: npx ts-node prisma/backfillTicketTypes.ts
// Agrega los tipos de ticket de operación interna a instalaciones que ya
// tenían sembrado el listType "types" (el guard de seed.ts es todo-o-nada
// por grupo, así que un seed nuevo no los agrega a una BD existente).
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const NEW_TYPES = [
  "Novedad de proceso",
  "Faltante o inconsistencia",
  "Mantenimiento de instalaciones",
  "Capacitación de personal",
  "Corrección de procedimiento",
  "OKR",
]

async function main() {
  const existing = await prisma.zymoConfigList.findMany({ where: { listType: "types" } })
  const maxSortOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder), -1)

  const result = await prisma.zymoConfigList.createMany({
    data: NEW_TYPES.map((value, index) => ({
      listType: "types",
      value,
      label: value,
      sortOrder: maxSortOrder + 1 + index,
    })),
    skipDuplicates: true,
  })

  console.log(`Backfill listo: ${result.count} tipo(s) nuevo(s) insertado(s) (de ${NEW_TYPES.length}, duplicados omitidos).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 3: Ejecutar el backfill**

Run: `cd zymoally-backend && npx ts-node prisma/backfillTicketTypes.ts`
Expected: `Backfill listo: 6 tipo(s) nuevo(s) insertado(s) (de 6, duplicados omitidos).`

- [ ] **Step 4: Verificar idempotencia**

Run: `cd zymoally-backend && npx ts-node prisma/backfillTicketTypes.ts` (otra vez)
Expected: `Backfill listo: 0 tipo(s) nuevo(s) insertado(s) (de 6, duplicados omitidos).`

- [ ] **Step 5: Verificar tipos**

Run: `cd zymoally-backend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add zymoally-backend/src/utils/constants.ts zymoally-backend/prisma/backfillTicketTypes.ts
git commit -m "feat(zymoally): sembrar tipos de ticket de operacion interna (mantenimiento, capacitacion, OKR, etc.)"
```

---

### Task 3: Frontend — cliente API + proxy nginx

**Files:**
- Create: `frontend/src/lib/zymoallyApi.ts`
- Modify: `frontend/nginx.conf`
- Modify: `frontend/.env.production`
- Modify: `frontend/.env.example`

- [ ] **Step 1: Crear el cliente axios**

Create `frontend/src/lib/zymoallyApi.ts`:

```ts
import axios from "axios"
import { useAuthStore } from "@/store/authStore"

// zymoally-backend corre en el puerto 3005 (o /zymoally-api en producción)
export const zymoallyApi = axios.create({
  baseURL: import.meta.env.VITE_ZYMOALLY_API_URL ?? "http://localhost:3005",
})

zymoallyApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

zymoallyApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)
```

- [ ] **Step 2: Agregar el proxy nginx**

En `frontend/nginx.conf`, después del bloque `location /sig-api/ { ... }` (línea ~59), agregar:

```nginx
    # Proxy al zymoally-backend (Node.js — puerto 3005)
    location /zymoally-api/ {
        proxy_pass http://zymoally-backend:3005/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
        client_max_body_size 20m;
    }

    # Evidencias subidas en Zymo Ally
    location /zymoally-uploads/ {
        proxy_pass http://zymoally-backend:3005/uploads/;
        proxy_set_header Host $host;
    }
```

- [ ] **Step 3: Registrar la variable de entorno**

En `frontend/.env.production`, agregar una línea (siguiendo el patrón de `VITE_SIG_API_URL=/sig-api`):

```
VITE_ZYMOALLY_API_URL=/zymoally-api
```

En `frontend/.env.example`, agregar (patrón `VITE_HELIX_API_URL=http://localhost:3001`):

```
VITE_ZYMOALLY_API_URL=http://localhost:3005
```

- [ ] **Step 4: Verificar build**

Run: `cd frontend && npm run build`
Expected: build limpio, sin errores de TypeScript. (`tsc --noEmit` no sirve aquí — ver gotcha en `CLAUDE.md`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/zymoallyApi.ts frontend/nginx.conf frontend/.env.production frontend/.env.example
git commit -m "feat(zymoally): cliente API y proxy nginx para zymoally-backend"
```

---

### Task 4: Frontend — tipos y hooks de datos

**Files:**
- Create: `frontend/src/types/ticket.ts`
- Create: `frontend/src/hooks/useTickets.ts`

- [ ] **Step 1: Definir los tipos**

Create `frontend/src/types/ticket.ts`:

```ts
export type TicketView = "list" | "board" | "dashboard"

export interface TicketAction {
  id: number
  ticketId: number
  createdAt: string
  texto: string
}

export interface TicketEvidence {
  id: number
  ticketId: number
  createdAt: string
  filename: string
  url: string | null
}

export interface Ticket {
  id: number
  code: string
  createdAt: string
  monthKey: string
  area: string
  areaPrefix: string
  client: string | null
  platform: string | null
  supervisor: string | null
  analyst: string | null
  coordinator: string | null
  phone: string | null
  email: string | null
  owner: string | null
  date: string
  dueDate: string | null
  type: string
  status: string
  priority: string
  impact: string | null
  channel: string | null
  managementCriteria: string | null
  closedDate: string | null
  description: string | null
  actions: TicketAction[]
  evidence: TicketEvidence[]
}

export interface CreateTicketInput {
  area: string
  areaPrefix: string
  client?: string
  platform?: string
  supervisor?: string
  analyst?: string
  coordinator?: string
  phone?: string
  email?: string
  owner?: string
  date: string
  dueDate?: string
  type: string
  status: string
  priority: string
  impact?: string
  channel?: string
  managementCriteria?: string
  description?: string
  actionsInitial?: string
  evidence?: File[]
}

export interface TicketListItem {
  id: number
  value: string
  label: string
}

export interface TicketConfigLists {
  clients: TicketListItem[]
  platforms: TicketListItem[]
  supervisors: TicketListItem[]
  analysts: TicketListItem[]
  coordinators: TicketListItem[]
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

export interface TicketAreaPrefix {
  id: number
  area: string
  prefix: string
  isActive: boolean
  sortOrder: number
}

export interface TicketDashboardMetrics {
  total: number
  open: number
  critical: number
  withEvidence: number
  due: number
  overLimit: number
  closed: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  byArea: Record<string, number>
}

export interface TicketDashboardResult {
  metrics: TicketDashboardMetrics
  aiAnalysis: string[]
}
```

- [ ] **Step 2: Escribir los hooks de React Query**

Create `frontend/src/hooks/useTickets.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zymoallyApi } from "@/lib/zymoallyApi"
import type {
  Ticket, CreateTicketInput, TicketConfigLists, TicketAreaPrefix, TicketDashboardResult,
} from "@/types/ticket"

export interface TicketListFilters {
  status?: string
  type?: string
  impact?: string
  area?: string
  client?: string
  supervisor?: string
  search?: string
}

function buildParams(filters: TicketListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.type) params.set("type", filters.type)
  if (filters.impact) params.set("impact", filters.impact)
  if (filters.area) params.set("area", filters.area)
  if (filters.client) params.set("client", filters.client)
  if (filters.supervisor) params.set("supervisor", filters.supervisor)
  if (filters.search) params.set("search", filters.search)
  return params
}

// ─── Listar / detalle ───────────────────────────────────────────────────────

export function useTickets(filters: TicketListFilters = {}) {
  return useQuery<Ticket[]>({
    queryKey: ["tickets", filters],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<Ticket[]>(`/api/tickets/pqr?${buildParams(filters)}`)
      return data
    },
  })
}

export function useTicket(ticketId: number | null) {
  return useQuery<Ticket>({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<Ticket>(`/api/tickets/pqr/${ticketId}`)
      return data
    },
    enabled: ticketId !== null,
  })
}

export function useTicketCodePreview(date: string, areaPrefix: string) {
  return useQuery<{ code: string }>({
    queryKey: ["ticket-code-preview", date, areaPrefix],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<{ code: string }>(
        `/api/tickets/pqr/codigo-preview?date=${date}&areaPrefix=${areaPrefix}`,
      )
      return data
    },
    enabled: Boolean(date && areaPrefix),
  })
}

// ─── Crear / mutar ──────────────────────────────────────────────────────────

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      const form = new FormData()
      Object.entries(input).forEach(([key, value]) => {
        if (key === "evidence" || value === undefined || value === null) return
        form.append(key, String(value))
      })
      input.evidence?.forEach((file) => form.append("evidence", file))
      const { data } = await zymoallyApi.post<Ticket>("/api/tickets/pqr", form)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] })
      qc.invalidateQueries({ queryKey: ["tickets-dashboard"] })
    },
  })
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: number; status: string }) => {
      const { data } = await zymoallyApi.patch<Ticket>(`/api/tickets/pqr/${ticketId}/estado`, { status })
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["tickets"] })
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets-dashboard"] })
    },
  })
}

export function useUpdateTicketCriterio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, managementCriteria }: { ticketId: number; managementCriteria: string }) => {
      const { data } = await zymoallyApi.patch<Ticket>(`/api/tickets/pqr/${ticketId}/criterio`, { managementCriteria })
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets"] })
    },
  })
}

export function useAddTicketAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, texto }: { ticketId: number; texto: string }) => {
      const { data } = await zymoallyApi.post(`/api/tickets/pqr/${ticketId}/acciones`, { texto })
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
    },
  })
}

export function useUploadTicketEvidence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, files }: { ticketId: number; files: File[] }) => {
      const form = new FormData()
      files.forEach((file) => form.append("evidence", file))
      const { data } = await zymoallyApi.post<Ticket>(`/api/tickets/pqr/${ticketId}/evidencia`, form)
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets"] })
    },
  })
}

// ─── Maestros (solo lectura en F1 — el admin de edición es F5) ─────────────

export function useTicketConfigLists() {
  return useQuery<TicketConfigLists>({
    queryKey: ["tickets-config-lists"],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<TicketConfigLists>("/api/tickets/config/listas")
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useTicketAreaPrefixes() {
  return useQuery<TicketAreaPrefix[]>({
    queryKey: ["tickets-area-prefixes"],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<TicketAreaPrefix[]>("/api/tickets/config/areas")
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export function useTicketDashboard(filters: TicketListFilters = {}) {
  return useQuery<TicketDashboardResult>({
    queryKey: ["tickets-dashboard", filters],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<TicketDashboardResult>(`/api/tickets/dashboard?${buildParams(filters)}`)
      return data
    },
  })
}
```

- [ ] **Step 3: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/ticket.ts frontend/src/hooks/useTickets.ts
git commit -m "feat(zymoally): tipos y hooks de React Query para tickets"
```

---

### Task 5: Frontend — permiso `mod_tickets`

**Files:**
- Modify: `frontend/src/lib/permissions.ts:119-122`

- [ ] **Step 1: Agregar `canSeeTickets`**

En `frontend/src/lib/permissions.ts`, justo después de `canSeeHelix` (línea 122), agregar:

```ts
export function canSeeTickets(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tickets")
}
```

- [ ] **Step 2: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/permissions.ts
git commit -m "feat(zymoally): permiso mod_tickets (canSeeTickets)"
```

---

### Task 6: Frontend — contexto de UI y helpers de fecha/tono

**Files:**
- Create: `frontend/src/context/TicketsContext.tsx`
- Create: `frontend/src/lib/ticketWork.ts`

- [ ] **Step 1: Crear el contexto**

Create `frontend/src/context/TicketsContext.tsx`:

```tsx
import { createContext, useContext, useState, type ReactNode } from "react"
import type { TicketView } from "@/types/ticket"

interface TicketsContextValue {
  activeView: TicketView
  setActiveView: (view: TicketView) => void
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
  openTicketId: number | null
  setOpenTicketId: (id: number | null) => void
}

const TicketsContext = createContext<TicketsContextValue | null>(null)

export function TicketsContextProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<TicketView>("list")
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [openTicketId, setOpenTicketId] = useState<number | null>(null)

  return (
    <TicketsContext.Provider
      value={{
        activeView, setActiveView,
        sidebarExpanded, setSidebarExpanded,
        dialogOpen, setDialogOpen,
        openTicketId, setOpenTicketId,
      }}
    >
      {children}
    </TicketsContext.Provider>
  )
}

export function useTicketsUI() {
  const ctx = useContext(TicketsContext)
  if (!ctx) throw new Error("useTicketsUI debe usarse dentro de TicketsContextProvider")
  return ctx
}
```

- [ ] **Step 2: Crear los helpers de fecha/tono**

Create `frontend/src/lib/ticketWork.ts`:

```ts
import type { Ticket } from "@/types/ticket"

export function currentDateValue(): string {
  return new Date().toISOString().slice(0, 10)
}

// Espejo de daysOpen() en zymoally-backend/src/utils/formatters.ts — mismo
// cálculo, mismo comportamiento, para que el badge del cliente coincida con
// lo que el backend usaría si se le pidiera.
export function daysOpen(ticket: Pick<Ticket, "date" | "status" | "closedDate">): number {
  const start = new Date(`${ticket.date}T12:00:00`)
  const endDate = /cerrado/i.test(ticket.status) && ticket.closedDate ? ticket.closedDate : currentDateValue()
  const end = new Date(`${endDate}T12:00:00`)
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
}

export function impactLimit(impact?: string | null): number {
  if (/critico/i.test(impact || "")) return 1
  if (/alto/i.test(impact || "")) return 2
  if (/medio/i.test(impact || "")) return 5
  return 8
}

export type ImpactAgeStatus = "cerrado" | "vencido" | "en-tiempo"

export function impactAgeStatus(ticket: Pick<Ticket, "date" | "status" | "closedDate" | "impact">): ImpactAgeStatus {
  if (/cerrado/i.test(ticket.status)) return "cerrado"
  return daysOpen(ticket) > impactLimit(ticket.impact) ? "vencido" : "en-tiempo"
}

interface Tone {
  text: string
  bg: string
  border: string
}

// Tonos fijos por texto de prioridad — badge visual únicamente, no reemplaza
// el motor de alertas/SLA (ese fix es F4, aparte).
export function priorityTone(priority: string): Tone {
  if (/critica/i.test(priority)) return { text: "#a8172f", bg: "#fce9ed", border: "#f0b8c3" }
  if (/alta/i.test(priority)) return { text: "#b45309", bg: "#fef3c7", border: "#fcd34d" }
  if (/media/i.test(priority)) return { text: "#3f3f46", bg: "#f4f4f5", border: "#d4d4d8" }
  return { text: "#52525b", bg: "#fafafa", border: "#e4e4e7" }
}
```

- [ ] **Step 3: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/TicketsContext.tsx frontend/src/lib/ticketWork.ts
git commit -m "feat(zymoally): contexto de UI y helpers de fecha/tono para tickets"
```

---

### Task 7: Frontend — `TicketDialog` (crear ticket)

**Files:**
- Create: `frontend/src/components/tickets/TicketDialog.tsx`

- [ ] **Step 1: Escribir el formulario de creación**

Create `frontend/src/components/tickets/TicketDialog.tsx`:

```tsx
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormSelect } from "@/components/tareas/FormSelect"
import { useTicketsUI } from "@/context/TicketsContext"
import {
  useTicketConfigLists, useTicketAreaPrefixes, useTicketCodePreview, useCreateTicket,
} from "@/hooks/useTickets"
import { currentDateValue } from "@/lib/ticketWork"

const LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"
const INPUT =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"

// El campo "cliente" del schema original se reusa para cualquier ticket
// interno, con la etiqueta ajustada según el tipo elegido (ver spec F1).
const CLIENT_LABEL_BY_TYPE: Record<string, string> = {
  "Mantenimiento de instalaciones": "Ubicación / activo afectado",
  "Faltante o inconsistencia": "Ubicación / referencia afectada",
  "Capacitación de personal": "Área o equipo capacitado",
  "Novedad de proceso": "Proceso afectado",
  "Corrección de procedimiento": "Procedimiento afectado",
  OKR: "Objetivo / iniciativa relacionada",
}

function clientLabelFor(type: string): string {
  return CLIENT_LABEL_BY_TYPE[type] ?? "Cliente"
}

const EMPTY_FORM = {
  type: "", area: "", areaPrefix: "", client: "", platform: "", supervisor: "",
  analyst: "", coordinator: "", phone: "", email: "", date: currentDateValue(),
  dueDate: "", priority: "", impact: "", channel: "", managementCriteria: "",
  description: "", actionsInitial: "",
}

export function TicketDialog() {
  const { dialogOpen, setDialogOpen } = useTicketsUI()
  const { data: lists } = useTicketConfigLists()
  const { data: areas = [] } = useTicketAreaPrefixes()
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const createTicket = useCreateTicket()
  const { data: preview } = useTicketCodePreview(form.date, form.areaPrefix)

  useEffect(() => {
    if (dialogOpen) {
      setForm(EMPTY_FORM)
      setFiles([])
      setError(null)
    }
  }, [dialogOpen])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleAreaChange(areaName: string) {
    const match = areas.find((a) => a.area === areaName)
    setForm((f) => ({ ...f, area: areaName, areaPrefix: match?.prefix ?? "" }))
  }

  async function handleSubmit() {
    const status = lists?.statuses?.[0]?.value
    if (!form.type || !form.area || !form.date || !form.priority || !status) return
    setError(null)
    try {
      await createTicket.mutateAsync({ ...form, status, evidence: files })
      setDialogOpen(false)
    } catch {
      setError("No se pudo crear el ticket. Revisa los campos requeridos.")
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <FormSelect
            label="Tipo"
            value={form.type}
            onChange={(v) => set("type", v)}
            options={(lists?.types ?? []).map((t) => ({ value: t.value, label: t.label }))}
          />
          <FormSelect
            label="Área"
            value={form.area}
            onChange={handleAreaChange}
            options={areas.map((a) => ({ value: a.area, label: a.area }))}
          />

          <div>
            <label className={LABEL}>{clientLabelFor(form.type)}</label>
            <input className={INPUT} value={form.client} onChange={(e) => set("client", e.target.value)} />
          </div>
          <FormSelect
            label="Plataforma"
            value={form.platform}
            onChange={(v) => set("platform", v)}
            options={(lists?.platforms ?? []).map((p) => ({ value: p.value, label: p.label }))}
            noneLabel="Sin plataforma"
          />

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

          <div>
            <label className={LABEL}>Teléfono</label>
            <input className={INPUT} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Correo</label>
            <input className={INPUT} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>

          <div>
            <label className={LABEL}>Fecha</label>
            <input type="date" className={INPUT} value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Fecha compromiso</label>
            <input type="date" className={INPUT} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>

          <FormSelect
            label="Prioridad"
            value={form.priority}
            onChange={(v) => set("priority", v)}
            options={(lists?.priorities ?? []).map((p) => ({ value: p.value, label: p.label }))}
          />
          <FormSelect
            label="Impacto"
            value={form.impact}
            onChange={(v) => set("impact", v)}
            options={(lists?.impacts ?? []).map((i) => ({ value: i.value, label: i.label }))}
          />
          <FormSelect
            label="Canal"
            value={form.channel}
            onChange={(v) => set("channel", v)}
            options={(lists?.channels ?? []).map((c) => ({ value: c.value, label: c.label }))}
          />
          <FormSelect
            label="Criterio de gestión"
            value={form.managementCriteria}
            onChange={(v) => set("managementCriteria", v)}
            options={(lists?.managementCriteria ?? []).map((m) => ({ value: m.value, label: m.label }))}
          />

          <div className="sm:col-span-2">
            <label className={LABEL}>Código</label>
            <input className={`${INPUT} bg-zinc-50 font-mono`} value={preview?.code ?? "…"} readOnly />
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL}>Descripción</label>
            <textarea className={INPUT} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Acción inicial (opcional)</label>
            <textarea className={INPUT} rows={2} value={form.actionsInitial} onChange={(e) => set("actionsInitial", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Evidencia</label>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </div>
        </div>

        {error && <p className="text-sm text-[#a8172f]">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
          <button
            type="button"
            onClick={() => setDialogOpen(false)}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createTicket.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-95 disabled:opacity-50"
          >
            {createTicket.isPending ? "Creando…" : "Crear ticket"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tickets/TicketDialog.tsx
git commit -m "feat(zymoally): TicketDialog, formulario de creacion de ticket"
```

---

### Task 8: Frontend — `TicketDrawer` (gestionar ticket)

**Files:**
- Create: `frontend/src/components/tickets/TicketDrawer.tsx`

- [ ] **Step 1: Escribir el drawer de detalle/bitácora/evidencias**

Create `frontend/src/components/tickets/TicketDrawer.tsx`:

```tsx
import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FormSelect } from "@/components/tareas/FormSelect"
import { useTicketsUI } from "@/context/TicketsContext"
import {
  useTicket, useTicketConfigLists, useUpdateTicketStatus, useUpdateTicketCriterio,
  useAddTicketAction, useUploadTicketEvidence,
} from "@/hooks/useTickets"

type DrawerTab = "detalle" | "bitacora" | "evidencias"

export function TicketDrawer() {
  const { openTicketId, setOpenTicketId } = useTicketsUI()
  const [tab, setTab] = useState<DrawerTab>("detalle")
  const { data: ticket } = useTicket(openTicketId)
  const { data: lists } = useTicketConfigLists()
  const updateStatus = useUpdateTicketStatus()
  const updateCriterio = useUpdateTicketCriterio()
  const addAction = useAddTicketAction()
  const uploadEvidence = useUploadTicketEvidence()
  const [newAction, setNewAction] = useState("")
  const [newFiles, setNewFiles] = useState<File[]>([])

  if (!ticket) return null

  return (
    <Sheet open={openTicketId !== null} onOpenChange={(open) => !open && setOpenTicketId(null)}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">{ticket.code}</SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as DrawerTab)} className="mt-4">
          <TabsList>
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="bitacora">Bitácora ({ticket.actions.length})</TabsTrigger>
            <TabsTrigger value="evidencias">Evidencias ({ticket.evidence.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="detalle" className="space-y-4 py-3">
            <div className="text-[13px] text-zinc-700">
              <p><strong>Tipo:</strong> {ticket.type}</p>
              <p><strong>Área:</strong> {ticket.area}</p>
              {ticket.client && <p><strong>Referencia:</strong> {ticket.client}</p>}
              <p><strong>Fecha:</strong> {ticket.date}</p>
              {ticket.description && <p className="mt-2 whitespace-pre-wrap">{ticket.description}</p>}
            </div>

            <FormSelect
              label="Estado"
              value={ticket.status}
              onChange={(status) => updateStatus.mutate({ ticketId: ticket.id, status })}
              options={(lists?.statuses ?? []).map((s) => ({ value: s.value, label: s.label }))}
            />
            <FormSelect
              label="Criterio de gestión"
              value={ticket.managementCriteria ?? ""}
              onChange={(managementCriteria) => updateCriterio.mutate({ ticketId: ticket.id, managementCriteria })}
              options={(lists?.managementCriteria ?? []).map((m) => ({ value: m.value, label: m.label }))}
              noneLabel="Sin definir"
            />
          </TabsContent>

          <TabsContent value="bitacora" className="space-y-3 py-3">
            {ticket.actions.map((action) => (
              <div key={action.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-zinc-700">
                {action.texto}
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                placeholder="Agregar acción…"
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={!newAction.trim() || addAction.isPending}
                onClick={() => {
                  addAction.mutate({ ticketId: ticket.id, texto: newAction.trim() })
                  setNewAction("")
                }}
                className="rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </TabsContent>

          <TabsContent value="evidencias" className="space-y-3 py-3">
            {ticket.evidence.map((ev) => (
              <a
                key={ev.id}
                href={ev.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border border-zinc-200 px-3 py-2 text-[13px] text-primary hover:underline"
              >
                {ev.filename}
              </a>
            ))}
            <div className="flex gap-2">
              <input type="file" multiple onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))} />
              <button
                type="button"
                disabled={!newFiles.length || uploadEvidence.isPending}
                onClick={() => {
                  uploadEvidence.mutate({ ticketId: ticket.id, files: newFiles })
                  setNewFiles([])
                }}
                className="rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Subir
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tickets/TicketDrawer.tsx
git commit -m "feat(zymoally): TicketDrawer, gestion de ticket existente (detalle/bitacora/evidencias)"
```

---

### Task 9: Frontend — `ListView`

**Files:**
- Create: `frontend/src/components/tickets/views/ListView.tsx`

- [ ] **Step 1: Escribir la vista de lista**

Create `frontend/src/components/tickets/views/ListView.tsx`:

```tsx
import { useState } from "react"
import { useTickets, useTicketConfigLists } from "@/hooks/useTickets"
import { useTicketsUI } from "@/context/TicketsContext"
import { FormSelect } from "@/components/tareas/FormSelect"
import { impactAgeStatus, daysOpen, priorityTone } from "@/lib/ticketWork"
import type { Ticket } from "@/types/ticket"

export function ListView() {
  const [status, setStatus] = useState("")
  const [type, setType] = useState("")
  const [search, setSearch] = useState("")
  const { data: lists } = useTicketConfigLists()
  const { data: tickets = [], isLoading } = useTickets({
    status: status || undefined,
    type: type || undefined,
    search: search || undefined,
  })
  const { setOpenTicketId } = useTicketsUI()

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <FormSelect
          label="Estado"
          value={status}
          onChange={setStatus}
          options={(lists?.statuses ?? []).map((s) => ({ value: s.value, label: s.label }))}
          noneLabel="Todos"
          triggerClassName="w-44"
        />
        <FormSelect
          label="Tipo"
          value={type}
          onChange={setType}
          options={(lists?.types ?? []).map((t) => ({ value: t.value, label: t.label }))}
          noneLabel="Todos"
          triggerClassName="w-56"
        />
        <div className="ml-auto">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Buscar</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Código, cliente, descripción…"
            className="h-10 w-64 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">Código</th>
              <th className="px-4 py-2.5">Tipo</th>
              <th className="px-4 py-2.5">Área</th>
              <th className="px-4 py-2.5">Prioridad</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Días abierto</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400">Cargando…</td></tr>
            )}
            {!isLoading && tickets.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400">Sin tickets para estos filtros.</td></tr>
            )}
            {tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} onOpen={() => setOpenTicketId(ticket.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const tone = priorityTone(ticket.priority)
  const vencido = impactAgeStatus(ticket) === "vencido"

  return (
    <tr onClick={onOpen} className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
      <td className="px-4 py-2.5 font-mono text-[12px] text-zinc-700">{ticket.code}</td>
      <td className="px-4 py-2.5">{ticket.type}</td>
      <td className="px-4 py-2.5">{ticket.area}</td>
      <td className="px-4 py-2.5">
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: tone.text, background: tone.bg, borderColor: tone.border }}
        >
          {ticket.priority}
        </span>
      </td>
      <td className="px-4 py-2.5">{ticket.status}</td>
      <td className="px-4 py-2.5">
        <span className={vencido ? "font-bold text-[#a8172f]" : "text-zinc-600"}>
          {daysOpen(ticket)} {vencido ? "· vencido" : ""}
        </span>
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tickets/views/ListView.tsx
git commit -m "feat(zymoally): ListView con filtros y semaforo de SLA"
```

---

### Task 10: Frontend — `BoardView`

**Files:**
- Create: `frontend/src/components/tickets/views/BoardView.tsx`

- [ ] **Step 1: Escribir el tablero kanban**

Create `frontend/src/components/tickets/views/BoardView.tsx`:

```tsx
import {
  DndContext, type DragEndEvent, closestCorners, useSensor, useSensors, PointerSensor, useDroppable,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { useTickets, useTicketConfigLists, useUpdateTicketStatus } from "@/hooks/useTickets"
import { useTicketsUI } from "@/context/TicketsContext"
import { priorityTone } from "@/lib/ticketWork"
import type { Ticket } from "@/types/ticket"

function TicketCard({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `ticket-${ticket.id}` })
  const tone = priorityTone(ticket.priority)
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className="relative mb-2 cursor-pointer rounded-lg border border-zinc-200 bg-white px-3.5 py-3 shadow-sm"
        onClick={onOpen}
      >
        <button
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastrar ticket"
          className="absolute right-1.5 top-2 flex cursor-grab border-none bg-transparent p-0.5 text-zinc-300 hover:text-zinc-500"
          style={{ touchAction: "none" }}
        >
          <GripVertical size={15} />
        </button>
        <div className="mb-1.5 font-mono text-[11px] text-zinc-400">{ticket.code}</div>
        <div className="mb-2 pr-[18px] text-[13px] font-medium leading-snug text-zinc-900">{ticket.type}</div>
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: tone.text, background: tone.bg, borderColor: tone.border }}
        >
          {ticket.priority}
        </span>
      </div>
    </div>
  )
}

function Column({
  status, label, tickets, onOpen,
}: {
  status: string
  label: string
  tickets: Ticket[]
  onOpen: (id: number) => void
}) {
  const { setNodeRef } = useDroppable({ id: `column-${status}` })

  return (
    <div ref={setNodeRef} className="flex min-w-[260px] flex-1 flex-col rounded-lg bg-zinc-50 p-3">
      <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">
        <span>{label}</span>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-mono text-zinc-600">{tickets.length}</span>
      </div>
      <SortableContext items={tickets.map((t) => `ticket-${t.id}`)} strategy={verticalListSortingStrategy}>
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} onOpen={() => onOpen(ticket.id)} />
        ))}
      </SortableContext>
    </div>
  )
}

function resolveTargetStatus(overId: string, tickets: Ticket[]): string | null {
  if (overId.startsWith("column-")) return overId.replace("column-", "")
  if (overId.startsWith("ticket-")) {
    const id = Number(overId.replace("ticket-", ""))
    return tickets.find((t) => t.id === id)?.status ?? null
  }
  return null
}

export function BoardView() {
  const { data: lists } = useTicketConfigLists()
  const { data: tickets = [] } = useTickets()
  const updateStatus = useUpdateTicketStatus()
  const { setOpenTicketId } = useTicketsUI()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const columns = lists?.statuses ?? []

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const ticketId = Number(String(active.id).replace("ticket-", ""))
    const targetStatus = resolveTargetStatus(String(over.id), tickets)
    const ticket = tickets.find((t) => t.id === ticketId)
    if (!ticket || !targetStatus || ticket.status === targetStatus) return
    updateStatus.mutate({ ticketId, status: targetStatus })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <Column
            key={col.value}
            status={col.value}
            label={col.label}
            tickets={tickets.filter((t) => t.status === col.value)}
            onOpen={setOpenTicketId}
          />
        ))}
      </div>
    </DndContext>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tickets/views/BoardView.tsx
git commit -m "feat(zymoally): BoardView, tablero kanban con dnd-kit"
```

---

### Task 11: Frontend — `DashboardView`

**Files:**
- Create: `frontend/src/components/tickets/views/DashboardView.tsx`

- [ ] **Step 1: Escribir el dashboard con la Regla del Vestido Rojo**

Create `frontend/src/components/tickets/views/DashboardView.tsx`:

```tsx
import { useTicketDashboard } from "@/hooks/useTickets"

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-[12px] text-zinc-600">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100">
        <div className="h-2 rounded-full bg-zinc-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function DashboardView() {
  const { data, isLoading } = useTicketDashboard()

  if (isLoading || !data) {
    return <p className="text-zinc-400">Cargando dashboard…</p>
  }

  const { metrics, aiAnalysis } = data
  const maxByStatus = Math.max(1, ...Object.values(metrics.byStatus))
  const maxByType = Math.max(1, ...Object.values(metrics.byType))

  return (
    <div>
      {/* Regla del vestido rojo: un solo protagonista (vencidos por SLA), el
          resto de KPIs queda neutral — ver mixui/references/research/
          priority-layout-time-dashboards.md */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Total</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900">{metrics.total}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Abiertos</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900">{metrics.open}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Cerrados</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900">{metrics.closed}</div>
        </div>
        <div className="rounded-lg border-2 border-[#c41e3a] bg-[#fce9ed] p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a8172f]">Vencidos (SLA)</div>
          <div className="mt-1 text-2xl font-bold text-[#a8172f]">{metrics.overLimit}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Por estado</h3>
          {Object.entries(metrics.byStatus).map(([status, count]) => (
            <Bar key={status} label={status} value={count} max={maxByStatus} />
          ))}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Por tipo</h3>
          {Object.entries(metrics.byType).map(([type, count]) => (
            <Bar key={type} label={type} value={count} max={maxByType} />
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-zinc-900">Lectura</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-zinc-700">
          {aiAnalysis.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tickets/views/DashboardView.tsx
git commit -m "feat(zymoally): DashboardView con regla del vestido rojo"
```

---

### Task 12: Frontend — `TicketsShell` (ensamblaje)

**Files:**
- Create: `frontend/src/components/tickets/TicketsSidebar.tsx`
- Create: `frontend/src/components/tickets/TicketsTopbar.tsx`
- Create: `frontend/src/components/tickets/TicketsShell.tsx`
- Create: `frontend/src/pages/tickets/TicketsPage.tsx`

- [ ] **Step 1: Sidebar interno (Lista/Tablero/Dashboard)**

Create `frontend/src/components/tickets/TicketsSidebar.tsx`:

```tsx
import { List, Kanban, LayoutDashboard, ChevronLeft, ChevronRight } from "lucide-react"
import { useTicketsUI } from "@/context/TicketsContext"
import type { TicketView } from "@/types/ticket"

const NAV_ITEMS: { view: TicketView; label: string; icon: React.ReactNode }[] = [
  { view: "list", label: "Lista", icon: <List size={18} /> },
  { view: "board", label: "Tablero", icon: <Kanban size={18} /> },
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
]

export function TicketsSidebar() {
  const { activeView, setActiveView, sidebarExpanded: expanded, setSidebarExpanded: setExpanded } = useTicketsUI()
  const width = expanded ? 200 : 64

  return (
    <aside
      style={{
        display: "flex", flexDirection: "column", gap: 8, padding: "16px 8px",
        background: "#ffffff", borderRight: "1px solid #e4e4e7",
        minHeight: "100vh", width, transition: "width 220ms ease", flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: expanded ? "space-between" : "center", marginBottom: 8 }}>
        {expanded && <div style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>Zymo Ally · Tickets</div>}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            width: 28, height: 28, borderRadius: 6, border: "1px solid #e4e4e7",
            background: "#f4f4f5", color: "#52525b", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV_ITEMS.map(({ view, label, icon }) => {
          const isActive = activeView === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              title={!expanded ? label : undefined}
              style={{
                height: 40, border: "none", borderRadius: 8,
                background: isActive ? "rgba(196,30,58,0.10)" : "transparent",
                color: isActive ? "#c41e3a" : "#52525b", cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: expanded ? "flex-start" : "center",
                gap: expanded ? 10 : 0, paddingLeft: expanded ? 10 : 0,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
              }}
            >
              {icon}
              {expanded && <span>{label}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Topbar**

Create `frontend/src/components/tickets/TicketsTopbar.tsx`:

```tsx
import { useTicketsUI } from "@/context/TicketsContext"
import type { TicketView } from "@/types/ticket"

const VIEW_TITLES: Record<TicketView, string> = {
  list: "Lista de Tickets",
  board: "Tablero de Tickets",
  dashboard: "Dashboard",
}

export function TicketsTopbar() {
  const { activeView, setDialogOpen } = useTicketsUI()

  return (
    <header className="mb-6 flex items-center justify-between gap-4 border border-zinc-200 bg-white px-6 py-4 shadow-sm">
      <div>
        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">Zymo Ally</p>
        <h1 className="m-0 text-xl font-bold leading-tight text-zinc-900">{VIEW_TITLES[activeView]}</h1>
      </div>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-95"
      >
        + Nuevo ticket
      </button>
    </header>
  )
}
```

- [ ] **Step 3: Shell**

Create `frontend/src/components/tickets/TicketsShell.tsx`:

```tsx
import { useTicketsUI } from "@/context/TicketsContext"
import { TicketsSidebar } from "./TicketsSidebar"
import { TicketsTopbar } from "./TicketsTopbar"
import { ListView } from "./views/ListView"
import { BoardView } from "./views/BoardView"
import { DashboardView } from "./views/DashboardView"
import { TicketDialog } from "./TicketDialog"
import { TicketDrawer } from "./TicketDrawer"

export function TicketsShell() {
  const { activeView } = useTicketsUI()

  return (
    <div className="grid min-h-screen bg-background text-foreground" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
      <TicketsSidebar />
      <main className="min-w-0 overflow-auto" style={{ padding: "clamp(14px, 2vw, 24px)" }}>
        <TicketsTopbar />
        {activeView === "list" && <ListView />}
        {activeView === "board" && <BoardView />}
        {activeView === "dashboard" && <DashboardView />}
      </main>
      <TicketDialog />
      <TicketDrawer />
    </div>
  )
}
```

- [ ] **Step 4: Página de entrada**

Create `frontend/src/pages/tickets/TicketsPage.tsx`:

```tsx
import { TicketsContextProvider } from "@/context/TicketsContext"
import { TicketsShell } from "@/components/tickets/TicketsShell"

export function TicketsPage() {
  return (
    <TicketsContextProvider>
      <TicketsShell />
    </TicketsContextProvider>
  )
}
```

- [ ] **Step 5: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/tickets/TicketsSidebar.tsx frontend/src/components/tickets/TicketsTopbar.tsx frontend/src/components/tickets/TicketsShell.tsx frontend/src/pages/tickets/TicketsPage.tsx
git commit -m "feat(zymoally): TicketsShell, ensamblaje del portal (sidebar interno + topbar + vistas)"
```

---

### Task 13: Frontend — ruta y entrada en el sidebar general (queda navegable)

**Files:**
- Modify: `frontend/src/App.tsx:51` (imports), `:184-189` (guard), `:517-525` (rutas)
- Modify: `frontend/src/components/layout/Sidebar.tsx:2-16` (imports), `:250-262` (nav)

- [ ] **Step 1: Importar `TicketsPage` y `canSeeTickets`**

En `frontend/src/App.tsx`, después de la línea `import { HelixPage } from "@/pages/planeacion/helix/HelixPage"` (línea 51), agregar:

```tsx
import { TicketsPage } from "@/pages/tickets/TicketsPage"
```

Y en el import existente de `permissions.ts` (buscar `canSeeHelix` en los imports de `App.tsx`), agregar `canSeeTickets` a la misma línea de import.

- [ ] **Step 2: Guard de ruta**

En `frontend/src/App.tsx`, después de `HelixRoute` (líneas 184-189), agregar:

```tsx
function TicketsRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeTickets(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
```

- [ ] **Step 3: Ruta**

En `frontend/src/App.tsx`, después del bloque de la ruta `/planeacion/helix` (líneas 517-525), agregar:

```tsx
        {/* Zymo Ally — Tickets (dominio sin relación con Helix, solo comparte posición en el sidebar) */}
        <Route
          path="/zymoally/tickets"
          element={
            <TicketsRoute>
              <TicketsPage />
            </TicketsRoute>
          }
        />
```

- [ ] **Step 4: Ícono en Sidebar**

En `frontend/src/components/layout/Sidebar.tsx`, en el import de `lucide-react` (líneas 2-16), agregar `Ticket` a la lista:

```tsx
import {
  LayoutDashboard,
  Monitor,
  ShieldCheck,
  Database,
  Truck,
  Building2,
  Wrench,
  BarChart3,
  LineChart,
  Cpu,
  ListTodo,
  Layers,
  Users,
  Ticket,
} from "lucide-react"
```

- [ ] **Step 5: Item de navegación**

En `frontend/src/components/layout/Sidebar.tsx`, dentro del `SidebarGroup` de "Planeación" (líneas 250-262), justo después del `NavItem` de "Helix Zymo", agregar:

```tsx
                  <NavItem
                    to="/zymoally/tickets"
                    label="Zymo Ally · Tickets"
                    icon={<Ticket className="w-4 h-4" />}
                    active={isActive(["/zymoally/tickets"])}
                  />
```

También importar `canSeeTickets` desde `@/lib/permissions` en `Sidebar.tsx` y envolver el `NavItem` con la misma condición que ya usa el resto del grupo `Planeación` (revisar cómo el `NavItem` de Helix Zymo está condicionado — replicar la misma guarda con `canSeeTickets(user.role, user.app_permissions)` en vez de `canSeeHelix`).

- [ ] **Step 6: Verificar build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 7: Smoke test manual**

1. Levantar el frontend en dev (`npm run dev`) y el `zymoally-backend` (`npm run dev` en esa carpeta, con su Postgres corriendo).
2. Loguearse como `admin` (bypasa el permiso `mod_tickets`).
3. Confirmar que "Zymo Ally · Tickets" aparece en el sidebar, debajo de "Helix Zymo".
4. Entrar, crear un ticket de tipo "Mantenimiento de instalaciones", confirmar que el campo se relabela a "Ubicación / activo afectado" y que el código se previsualiza.
5. Confirmar que el ticket aparece en Lista y en Tablero, que se puede arrastrar entre columnas, y que el Dashboard muestra el KPI de "Vencidos" en rojo.
6. Abrir el ticket (Drawer), agregar una acción y subir una evidencia.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(zymoally): montar Zymo Ally · Tickets en el sidebar y las rutas de la intranet"
```

---

## Self-Review

**Cobertura del spec:**
- Ubicación en sidebar debajo de Helix, ruta propia, permiso propio → Task 13. ✓
- Stack sin dependencias nuevas → confirmado contra `package.json`, ningún Task instala paquetes. ✓
- Shell tipo tareas-v2, navegación por vistas → Task 12. ✓
- Dialog para crear, Drawer para gestionar → Tasks 7, 8. ✓
- Fix de `client` opcional → Task 1. ✓
- Reglas de layout (zonas de prioridad, vestido rojo) → Task 11 (Dashboard). ✓
- Fuera de alcance (Config admin, SAC, SMTP, alertas) → ningún task los toca. ✓
- Extra no cubierto por el spec original pero necesario para que el flujo de creación sea usable: tipos de ticket de operación interna sembrados → Task 2 (justificado: sin esto, el dropdown de "Tipo" solo mostraría categorías de PQR de cliente, y la funcionalidad de crear un ticket de mantenimiento/capacitación/OKR no sería demostrable).

**Placeholders:** ninguno — todo el código de cada step es completo y compilable en el punto en que se ejecuta (verificado el orden: Dialog/Drawer/vistas antes del Shell que los ensambla; Shell antes de la ruta que lo monta).

**Consistencia de tipos:** `Ticket`, `CreateTicketInput`, `TicketConfigLists`, `TicketAreaPrefix`, `TicketDashboardResult` se definen una sola vez en `types/ticket.ts` (Task 4) y se importan igual en todos los tasks posteriores. Nombres de hooks (`useTickets`, `useTicket`, `useTicketCodePreview`, `useCreateTicket`, `useUpdateTicketStatus`, `useUpdateTicketCriterio`, `useAddTicketAction`, `useUploadTicketEvidence`, `useTicketConfigLists`, `useTicketAreaPrefixes`, `useTicketDashboard`) se definen todos en Task 4 y se usan sin variaciones de nombre en Tasks 7–11.

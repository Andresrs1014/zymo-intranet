import assert from "assert"
import { ticketQualityScore } from "./scoreMetrics"

function makeAction(texto: string, createdAt: string) {
  return { id: 0, ticketId: 0, createdAt: new Date(createdAt), texto }
}

function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: "T-1",
    createdAt: new Date("2026-07-01T12:00:00Z"), // lunes 7am local
    monthKey: "202607",
    area: "Compras",
    areaPrefix: "COM",
    client: null,
    platform: "LOGIMAT",
    supervisor: null,
    supervisorEmail: null,
    analysts: [],
    analystEmails: [],
    coordinator: null,
    coordinatorEmail: null,
    manager: null,
    managerEmail: null,
    phone: null,
    email: null,
    owner: null,
    date: "2026-07-01",
    dueDate: null,
    type: "Novedad",
    status: "Abierto",
    priority: "Alta",
    impact: null,
    channel: null,
    managementCriteria: null,
    closedDate: null,
    closedAt: null,
    description: null,
    actions: [],
    evidence: [],
    ...overrides,
  } as never
}

// Silencio total (sin acciones, sin evidencia) — score bajo
const silencio = ticketQualityScore(baseTicket(), 24)
assert.ok(silencio < 40, `silencio total debería dar score bajo, dio ${silencio}`)

// Bien gestionado: respondió, dentro de SLA, con evidencia, cerrado sin reabrir
const bienGestionado = ticketQualityScore(
  baseTicket({
    status: "Cerrado",
    closedAt: new Date("2026-07-01T13:00:00Z"), // 1h laboral después
    actions: [makeAction("2026-07-01 - Estado actualizado a Cerrado", "2026-07-01T13:00:00Z")],
    evidence: [{ id: 1, ticketId: 1, createdAt: new Date(), filename: "foto.jpg", url: "/x" }],
  }),
  24,
)
assert.strictEqual(bienGestionado, 100, `bien gestionado debería dar 100, dio ${bienGestionado}`)

// Cerrado rápido sin documentar y luego reabierto — score bajo pese a "cerrar rápido"
const cerradoYReabierto = ticketQualityScore(
  baseTicket({
    status: "Abierto", // volvió a abrirse
    actions: [
      makeAction("2026-07-01 - Estado actualizado a Cerrado", "2026-07-01T12:10:00Z"),
      makeAction("2026-07-05 - Estado actualizado a Abierto", "2026-07-05T12:00:00Z"),
    ],
  }),
  24,
)
// No está "resuelto" ahora mismo (status volvió a Abierto), así que estabilidad no aplica —
// pero sí debe pesar la falta de documentación (sin evidencia).
assert.ok(cerradoYReabierto < 100, `reapertura sin evidencia no debería dar el máximo, dio ${cerradoYReabierto}`)

// Sin SLA configurado para esa prioridad — no debe reventar, solo omite esa señal
const sinSlaConfigurado = ticketQualityScore(baseTicket({ actions: [makeAction("x", "2026-07-01T12:00:00Z")] }), null)
assert.ok(sinSlaConfigurado >= 0 && sinSlaConfigurado <= 100)

console.log("scoreMetrics: OK")

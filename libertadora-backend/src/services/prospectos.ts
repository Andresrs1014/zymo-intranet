import { z } from "zod"
import { prisma } from "../config/prisma"

// Mismos 5 productos y 5 estados del prototipo original (Dashboard GestionComercial SKANDIA CREA 2026.html)
export const PRODUCTOS = ["CREA PATRIMONIO PJ", "CREA PATRIMONIO PN", "CREA AHORRO", "ARL COLMENA", "PORTAFOLIO"] as const
export const ESTADOS_PROSPECTO = ["CERRADO", "INTERESADO", "EN_PROCESO", "NO_INTERESADO", "CERRADO_NEG"] as const
export const PRIORIDADES = ["ALTA", "MEDIA", "BAJA"] as const

export const ProspectoBody = z.object({
  empresa: z.string().trim().min(1, "Ingresa el nombre de la empresa o cliente"),
  producto: z.enum(PRODUCTOS).default("PORTAFOLIO"),
  gestion: z.string().optional(),
  estado: z.enum(ESTADOS_PROSPECTO).default("EN_PROCESO"),
  monto: z.number().int().nonnegative().default(0),
  prioridad: z.enum(PRIORIDADES).default("MEDIA"),
  accion: z.string().optional(),
  fecha: z.string().optional(),
  trimestre: z.enum(["Q1", "Q2", "Q3", "Q4"]).optional(),
  tipo: z.enum(["PJ", "PN"]).optional(),
})

export const ProspectoPatch = ProspectoBody.partial()

export async function listProspectos() {
  return prisma.libertadoraProspecto.findMany({ orderBy: { id: "asc" } })
}

export async function createProspecto(data: z.infer<typeof ProspectoBody>) {
  return prisma.libertadoraProspecto.create({ data })
}

export async function updateProspecto(id: number, data: z.infer<typeof ProspectoPatch>) {
  return prisma.libertadoraProspecto.update({ where: { id }, data })
}

export async function deleteProspecto(id: number) {
  return prisma.libertadoraProspecto.delete({ where: { id } })
}

// Ported 1:1 de kpis() en app.js del prototipo original.
export async function kpis() {
  const prospectos = await listProspectos()
  const tot = prospectos.length
  const cerrados = prospectos.filter((p) => p.estado === "CERRADO")
  const ci = cerrados.length
  const ii = prospectos.filter((p) => p.estado === "INTERESADO").length
  const ep = prospectos.filter((p) => p.estado === "EN_PROCESO").length
  const ni = prospectos.filter((p) => p.estado === "NO_INTERESADO" || p.estado === "CERRADO_NEG").length
  const mo = cerrados.reduce((sum, p) => sum + p.monto, 0)
  const po = prospectos.filter((p) => p.estado === "INTERESADO").reduce((sum, p) => sum + p.monto, 0)
  const conv = tot > 0 ? Number(((ci / tot) * 100).toFixed(1)) : 0
  return { tot, ci, ii, ep, ni, mo, po, conv }
}

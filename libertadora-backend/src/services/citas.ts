import { z } from "zod"
import { prisma } from "../config/prisma"
import { backupToSig } from "./sigBackup"

export const MODALIDADES = ["Presencial", "Microsoft Teams", "Zoom", "WhatsApp", "Telefónica"] as const
export const ESTADOS_CITA = ["pending", "confirmed", "cancelled"] as const

export const CitaBody = z.object({
  cliente: z.string().trim().min(1, "Ingresa el nombre del cliente"),
  fecha: z.string().min(1, "La fecha es obligatoria"),
  hora: z.string().default("09:00"),
  modalidad: z.enum(MODALIDADES).default("Presencial"),
  producto: z.string().default("PORTAFOLIO"),
  estado: z.enum(ESTADOS_CITA).default("pending"),
  notas: z.string().optional(),
})

export const CitaPatch = CitaBody.partial()

export async function listCitas() {
  return prisma.libertadoraCita.findMany({ orderBy: { fecha: "asc" } })
}

export async function createCita(data: z.infer<typeof CitaBody>) {
  const cita = await prisma.libertadoraCita.create({ data })
  void backupToSig("cita", "create", cita.id, cita)
  return cita
}

export async function updateCita(id: number, data: z.infer<typeof CitaPatch>) {
  const cita = await prisma.libertadoraCita.update({ where: { id }, data })
  void backupToSig("cita", "update", cita.id, cita)
  return cita
}

export async function deleteCita(id: number) {
  const cita = await prisma.libertadoraCita.delete({ where: { id } })
  void backupToSig("cita", "delete", cita.id, cita)
  return cita
}

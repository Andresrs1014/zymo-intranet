import { z } from "zod"

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
})

export const userIdParamSchema = z.object({
  userId: z.string().regex(/^\d+$/).transform(Number),
})

export const dateRangeSchema = z.object({
  desde: z.string().datetime({ offset: true }).optional(),
  hasta: z.string().datetime({ offset: true }).optional(),
})

export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
})

/** Trim string and validate minimum length */
export function validateTitle(titulo: unknown): string {
  if (typeof titulo !== "string") throw new Error("Título requerido")
  const trimmed = titulo.trim()
  if (trimmed.length < 3) throw new Error("El título debe tener al menos 3 caracteres")
  if (trimmed.length > 250) throw new Error("El título no puede superar 250 caracteres")
  return trimmed
}

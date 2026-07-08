import { Prisma } from "@prisma/client"
import { prisma } from "../config/prisma"
import { normalizePrefix, pqrMonthKey, pqrShortDateKey } from "../utils/formatters"

async function findNextNumber(tx: Prisma.TransactionClient, cleanPrefix: string, monthKey: string): Promise<number> {
  const monthlyPattern = new RegExp(`^${cleanPrefix}-${monthKey.slice(2)}\\d{2}-(\\d+)$`)
  const candidates = await tx.zymoPqrTicket.findMany({
    where: { code: { startsWith: `${cleanPrefix}-` } },
    select: { code: true },
  })
  const numbers = candidates
    .map((t) => Number(t.code.match(monthlyPattern)?.[1]))
    .filter((n) => Number.isFinite(n))
  return Math.max(0, ...numbers) + 1
}

type TicketInput = Omit<Prisma.ZymoPqrTicketCreateInput, "code" | "monthKey" | "areaPrefix">

/**
 * Genera el código PQR (PREFIJO-AAMMDD-NN) y crea el ticket dentro de una
 * transacción. El "leer siguiente número + crear" no es atómico por sí solo
 * bajo escritura concurrente (un self-check con 8 requests simultáneos al
 * mismo prefijo/mes lo confirmó: colisiones de unicidad incluso con retry).
 * Se serializa con un advisory lock de Postgres por (prefijo, mes) — solo
 * bloquea a quienes compiten por el mismo código, no a toda la tabla.
 */
export async function createPqrTicketWithCode(dateValue: string, areaPrefix: string, data: TicketInput) {
  const cleanPrefix = normalizePrefix(areaPrefix)
  const monthKey = pqrMonthKey(dateValue)
  const shortDateKey = pqrShortDateKey(dateValue)
  const lockKey = `${cleanPrefix}:${monthKey}`

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
    const next = await findNextNumber(tx, cleanPrefix, monthKey)
    const code = `${cleanPrefix}-${shortDateKey}-${String(next).padStart(2, "0")}`
    return tx.zymoPqrTicket.create({
      data: { ...data, code, monthKey, areaPrefix: cleanPrefix },
      include: { actions: true, evidence: true },
    })
  })
}

export function previewNextCode(dateValue: string, areaPrefix: string, existingCodes: string[]): string {
  const cleanPrefix = normalizePrefix(areaPrefix)
  const monthKey = pqrMonthKey(dateValue)
  const shortDateKey = pqrShortDateKey(dateValue)
  const monthlyPattern = new RegExp(`^${cleanPrefix}-${monthKey.slice(2)}\\d{2}-(\\d+)$`)
  const numbers = existingCodes
    .map((code) => Number(code.match(monthlyPattern)?.[1]))
    .filter((n) => Number.isFinite(n))
  const next = Math.max(0, ...numbers) + 1
  return `${cleanPrefix}-${shortDateKey}-${String(next).padStart(2, "0")}`
}

import crypto from "crypto"
import { prisma } from "../config/prisma"

// ponytail: código corto = bytes aleatorios en base64url (stdlib, sin
// dependencia nueva). Colisión checa contra la unique constraint y reintenta
// — con 6 bytes (~48 bits) la probabilidad de choque es despreciable para el
// volumen de links de SAC, el retry solo cubre el caso raro.
export async function createShortLink(url: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomBytes(6).toString("base64url")
    try {
      await prisma.zymoShortLink.create({ data: { code, url } })
      return code
    } catch (err) {
      const isUniqueConflict = err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002"
      if (!isUniqueConflict) throw err
    }
  }
  throw new Error("No se pudo generar un código corto único.")
}

export async function resolveShortLink(code: string): Promise<string | null> {
  const link = await prisma.zymoShortLink.findUnique({ where: { code } })
  return link?.url ?? null
}

import assert from "assert"
import { prisma } from "../config/prisma"
import { createPqrTicketWithCode } from "./pqrCode"
import { normalizePrefix } from "../utils/formatters"

// ponytail: self-check ejecutable para la única lógica con riesgo real (colisión
// de código PQR bajo escritura concurrente). Sin framework — assert + ts-node.
async function main() {
  const date = "2099-01-15"
  const areaPrefix = "SELFCHK"
  const concurrency = 8

  const created = await Promise.all(
    Array.from({ length: concurrency }, (_, i) =>
      createPqrTicketWithCode(date, areaPrefix, {
        area: "Autocheck",
        client: `Cliente selfcheck ${i}`,
        date,
        type: "Peticion",
        status: "Abierto",
        priority: "Baja",
      })
    )
  )

  const codes = created.map((t) => t.code)
  const uniqueCodes = new Set(codes)
  assert.strictEqual(uniqueCodes.size, concurrency, `Se esperaban ${concurrency} códigos únicos, se generaron ${uniqueCodes.size}: ${codes.join(", ")}`)
  assert.ok(codes.every((c) => c.startsWith(`${normalizePrefix(areaPrefix)}-`)), "Todos los códigos deben usar el prefijo normalizado")

  await prisma.zymoPqrTicket.deleteMany({ where: { id: { in: created.map((t) => t.id) } } })

  console.log(`OK: ${concurrency} tickets concurrentes generaron ${uniqueCodes.size} códigos únicos.`)
}

main()
  .catch((err) => {
    console.error("FALLÓ el self-check de pqrCode:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import "dotenv/config"
import { prisma } from "../src/config/prisma"
import { createProspecto, ProspectoBody } from "../src/services/prospectos"
import { createCita, CitaBody } from "../src/services/citas"
import { PROSPECTOS_REALES, CITAS_REALES } from "./realData"

// Carga los 130 prospectos + 4 citas reales del prototipo original (no son
// datos de ejemplo, ver realData.ts). Pasa por los mismos services que usa la
// API (createProspecto/createCita) para que dispare igual el respaldo
// fire-and-forget hacia sig-backend, en vez de un insert masivo directo.
//
// Idempotente por conteo: si la tabla ya tiene filas, no vuelve a sembrar,
// para no duplicar datos reales si el script se corre dos veces por error.
async function main() {
  const existing = await prisma.libertadoraProspecto.count()
  if (existing > 0) {
    console.log(`Ya hay ${existing} prospecto(s) en la BD — no se vuelve a sembrar (evita duplicados).`)
    console.log("Si de verdad quieres re-sembrar, vacía la tabla LibertadoraProspecto primero.")
    return
  }

  console.log(`Sembrando ${PROSPECTOS_REALES.length} prospectos reales...`)
  for (const p of PROSPECTOS_REALES) {
    const parsed = ProspectoBody.parse(p)
    await createProspecto(parsed)
  }

  console.log(`Sembrando ${CITAS_REALES.length} citas reales...`)
  for (const c of CITAS_REALES) {
    const parsed = CitaBody.parse(c)
    await createCita(parsed)
  }

  console.log("Listo.")
}

main()
  .catch((err) => {
    console.error("Error sembrando datos:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

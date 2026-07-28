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
// Idempotencia real (no "si ya hay algo, no cargues nada"): cada fila se
// compara contra lo que YA existe por su llave natural (empresa para
// prospectos; cliente+fecha+hora para citas) — no por un conteo total de la
// tabla. Así, si el script se corta a la mitad (fila 60 de 130) y se vuelve a
// correr, retoma desde la 61 sin re-insertar las primeras 60, y si alguien ya
// creó a mano un prospecto real antes de sembrar, no bloquea el resto del
// sembrado por error. No corras este script dos veces en paralelo — está
// pensado para una ejecución manual y puntual, no para dispararse solo.

async function seedProspectos(): Promise<{ inserted: number; skipped: number }> {
  const existentes = await prisma.libertadoraProspecto.findMany({ select: { empresa: true } })
  const yaExisten = new Set(existentes.map((p) => p.empresa.trim().toLowerCase()))

  let inserted = 0
  let skipped = 0
  for (const p of PROSPECTOS_REALES) {
    const key = p.empresa.trim().toLowerCase()
    if (yaExisten.has(key)) {
      skipped += 1
      continue
    }
    const parsed = ProspectoBody.parse(p)
    await createProspecto(parsed)
    yaExisten.add(key)
    inserted += 1
  }
  return { inserted, skipped }
}

async function seedCitas(): Promise<{ inserted: number; skipped: number }> {
  const existentes = await prisma.libertadoraCita.findMany({ select: { cliente: true, fecha: true, hora: true } })
  const yaExisten = new Set(existentes.map((c) => `${c.cliente.trim().toLowerCase()}|${c.fecha}|${c.hora}`))

  let inserted = 0
  let skipped = 0
  for (const c of CITAS_REALES) {
    const key = `${c.cliente.trim().toLowerCase()}|${c.fecha}|${c.hora}`
    if (yaExisten.has(key)) {
      skipped += 1
      continue
    }
    const parsed = CitaBody.parse(c)
    await createCita(parsed)
    yaExisten.add(key)
    inserted += 1
  }
  return { inserted, skipped }
}

async function main() {
  const antesProspectos = await prisma.libertadoraProspecto.count()
  const antesCitas = await prisma.libertadoraCita.count()

  const prospectosResult = await seedProspectos()
  const citasResult = await seedCitas()

  const despuesProspectos = await prisma.libertadoraProspecto.count()
  const despuesCitas = await prisma.libertadoraCita.count()

  console.log(`Prospectos: ${prospectosResult.inserted} insertado(s), ${prospectosResult.skipped} ya existían (omitidos).`)
  console.log(`Citas: ${citasResult.inserted} insertada(s), ${citasResult.skipped} ya existían (omitidas).`)

  // Aserción explícita: si el conteo final no cuadra con lo esperado, algo
  // insertó de más (duplicado) o de menos (falló a mitad) — se corta con
  // error en vez de quedar en silencio como si todo hubiera salido bien.
  if (despuesProspectos !== antesProspectos + prospectosResult.inserted) {
    throw new Error(`Conteo de prospectos no cuadra: esperado ${antesProspectos + prospectosResult.inserted}, real ${despuesProspectos}`)
  }
  if (despuesCitas !== antesCitas + citasResult.inserted) {
    throw new Error(`Conteo de citas no cuadra: esperado ${antesCitas + citasResult.inserted}, real ${despuesCitas}`)
  }

  console.log(`Listo. Total en BD: ${despuesProspectos} prospectos, ${despuesCitas} citas.`)
}

main()
  .catch((err) => {
    console.error("Error sembrando datos:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

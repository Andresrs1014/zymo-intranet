// Renumera los ids de SigCommit a partir de 1, en el mismo orden que tienen
// hoy (por id ascendente) -- SIN borrar nada. Mismo problema que resolvió
// renumerar-procedimientos.ts pero para la tabla de commits: un reset previo
// dejó la secuencia de Postgres desalineada, así que el historial de
// versiones de cada procedimiento muestra ids heredados (ej. #0072) en vez
// de arrancar en 1, aunque solo haya un puñado de commits reales.
//
// A diferencia de renumerar-procedimientos.ts, SigCommit no tiene ninguna
// tabla que le apunte por FK (grep confirmado sobre schema.prisma) -- por
// eso el UPDATE es de una sola tabla, sin necesidad de descubrir ni diferir
// constraints.
//
// Uso:
//   npx ts-node scripts/renumerar-commits.ts              -> dry-run
//   npx ts-node scripts/renumerar-commits.ts --confirmar  -> ejecuta

import prisma from "../src/config/prisma"

async function main() {
  const confirmar = process.argv.includes("--confirmar")

  const commits = await prisma.sigCommit.findMany({
    select: { id: true, procedimientoId: true, mensaje: true },
    orderBy: { id: "asc" },
  })

  if (commits.length === 0) {
    console.log("No hay commits cargados -- nada que renumerar.")
    return
  }

  const mapping = commits.map((c, i) => ({ oldId: c.id, newId: i + 1, procedimientoId: c.procedimientoId, mensaje: c.mensaje }))
  const changed = mapping.filter((m) => m.oldId !== m.newId)

  console.log(`=== ${commits.length} commits -- ${changed.length} cambiarían de id ===`)
  console.table(mapping.map((m) => ({ ...m, cambia: m.oldId !== m.newId ? "sí" : "no" })))

  if (changed.length === 0) {
    console.log(`\nYa están numerados 1..${commits.length} sin huecos. Nada que hacer.`)
    return
  }

  if (!confirmar) {
    console.log("\nDRY-RUN -- no se cambió nada todavía. Corre con --confirmar para ejecutar de verdad.")
    return
  }

  const caseId = changed.map((m) => `WHEN ${m.oldId} THEN ${m.newId}`).join(" ")
  const oldIds = changed.map((m) => m.oldId).join(", ")

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE "SigCommit" SET id = CASE id ${caseId} END WHERE id IN (${oldIds})`,
    )
    await tx.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"SigCommit"', 'id'), ${commits.length}, true)`,
    )
  }, { timeout: 60_000 })

  const despues = await prisma.sigCommit.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  })
  const ok = despues.length === commits.length && despues.every((c, i) => c.id === i + 1)

  if (ok) {
    console.log(`\n✓ Renumerado sin pérdida de datos: ${commits.length} commits ahora van de 1 a ${commits.length}. El próximo commit creado será id ${commits.length + 1}.`)
  } else {
    console.error("\n✗ Algo no cuadró después de renumerar -- revisa manualmente antes de seguir usando el módulo.")
    process.exitCode = 1
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())

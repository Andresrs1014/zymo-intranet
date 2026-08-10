// Renumera los ids de SigProcedimiento a partir de 1, en el mismo orden que
// tienen hoy (por id ascendente) -- SIN borrar nada. A diferencia de
// reset-procedimientos.ts (que solo reinicia la secuencia cuando la tabla
// está vacía), este script sí tiene procedimientos reales cargados y los
// conserva: reasigna el id de cada SigProcedimiento y actualiza en cascada
// el procedimientoId de cada tabla relacionada (commits, instructivos, doc
// anexos, los 5 tipos de análisis, cargos asignados) dentro de UNA sola
// transacción. Si algo falla, Postgres revierte todo -- no queda estado a medias.
//
// Cómo evita colisiones de PK/FK durante el proceso:
// - El UPDATE de SigProcedimiento.id se hace en una sola sentencia con CASE
//   para TODAS las filas a la vez -- Postgres valida la unicidad de la PK
//   solo al final de esa sentencia, no fila por fila, así que no importa que
//   ids nuevos y viejos se crucen (ej. un id existente 5 pasando a ser 8
//   mientras otro pasa a ser 5).
// - Las FKs hacia SigProcedimiento(id) se descubren dinámicamente
//   (information_schema, no hardcodeadas) y se vuelven DEFERRABLE
//   INITIALLY DEFERRED al arrancar la transacción -- así el orden entre el
//   UPDATE del padre y los UPDATE de los hijos no importa. SET CONSTRAINTS
//   ALL IMMEDIATE fuerza la validación real antes de restaurar las FKs a su
//   estado original (NOT DEFERRABLE) -- si algo quedó inconsistente, esa
//   línea es la que revienta y aborta la transacción completa.
//
// Uso:
//   npx ts-node scripts/renumerar-procedimientos.ts              -> dry-run
//   npx ts-node scripts/renumerar-procedimientos.ts --confirmar  -> ejecuta

import prisma from "../src/config/prisma"

interface FkRow {
  table_name: string
  column_name: string
  constraint_name: string
}

async function main() {
  const confirmar = process.argv.includes("--confirmar")

  const procedimientos = await prisma.sigProcedimiento.findMany({
    select: { id: true, codigo: true, titulo: true },
    orderBy: { id: "asc" },
  })

  if (procedimientos.length === 0) {
    console.log("No hay procedimientos cargados -- nada que renumerar. Usa reset-procedimientos.ts para reiniciar la secuencia en 1.")
    return
  }

  const mapping = procedimientos.map((p, i) => ({ oldId: p.id, newId: i + 1, codigo: p.codigo, titulo: p.titulo }))
  const changed = mapping.filter((m) => m.oldId !== m.newId)

  console.log(`=== ${procedimientos.length} procedimientos -- ${changed.length} cambiarían de id ===`)
  console.table(mapping.map((m) => ({ ...m, cambia: m.oldId !== m.newId ? "sí" : "no" })))

  if (changed.length === 0) {
    console.log(`\nYa están numerados 1..${procedimientos.length} sin huecos. Nada que hacer.`)
    return
  }

  if (!confirmar) {
    console.log("\nDRY-RUN -- no se cambió nada todavía. Corre con --confirmar para ejecutar de verdad.")
    return
  }

  const caseId  = changed.map((m) => `WHEN ${m.oldId} THEN ${m.newId}`).join(" ")
  const oldIds  = changed.map((m) => m.oldId).join(", ")

  await prisma.$transaction(async (tx) => {
    const fks = await tx.$queryRawUnsafe<FkRow[]>(`
      SELECT tc.table_name, kcu.column_name, tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'SigProcedimiento'
        AND ccu.column_name = 'id'
        AND tc.table_name != 'SigProcedimiento'
    `)

    if (fks.length === 0) {
      throw new Error("No se encontró ninguna FK hacia SigProcedimiento(id) en la BD -- algo está mal, aborto por seguridad sin tocar nada.")
    }
    console.log(`\nTablas relacionadas encontradas: ${fks.map((f) => f.table_name).join(", ")}`)

    for (const fk of fks) {
      await tx.$executeRawUnsafe(
        `ALTER TABLE "${fk.table_name}" ALTER CONSTRAINT "${fk.constraint_name}" DEFERRABLE INITIALLY DEFERRED`,
      )
    }
    await tx.$executeRawUnsafe(`SET CONSTRAINTS ALL DEFERRED`)

    await tx.$executeRawUnsafe(
      `UPDATE "SigProcedimiento" SET id = CASE id ${caseId} END WHERE id IN (${oldIds})`,
    )
    for (const fk of fks) {
      await tx.$executeRawUnsafe(
        `UPDATE "${fk.table_name}" SET "${fk.column_name}" = CASE "${fk.column_name}" ${caseId} END WHERE "${fk.column_name}" IN (${oldIds})`,
      )
    }

    // Fuerza la validación real de las FKs deferidas AHORA, dentro de la
    // transacción -- si algo quedó inconsistente, esta línea revienta y
    // Postgres revierte todo el bloque completo.
    await tx.$executeRawUnsafe(`SET CONSTRAINTS ALL IMMEDIATE`)

    for (const fk of fks) {
      await tx.$executeRawUnsafe(
        `ALTER TABLE "${fk.table_name}" ALTER CONSTRAINT "${fk.constraint_name}" NOT DEFERRABLE`,
      )
    }

    await tx.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"SigProcedimiento"', 'id'), ${procedimientos.length}, true)`,
    )
  }, { timeout: 60_000 })

  const despues = await prisma.sigProcedimiento.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  })
  const ok = despues.length === procedimientos.length && despues.every((p, i) => p.id === i + 1)

  if (ok) {
    console.log(`\n✓ Renumerado sin pérdida de datos: ${procedimientos.length} procedimientos ahora van de 1 a ${procedimientos.length}. El próximo procedimiento creado será id ${procedimientos.length + 1}.`)
  } else {
    console.error("\n✗ Algo no cuadró después de renumerar -- revisa manualmente antes de seguir usando el módulo.")
    process.exitCode = 1
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())

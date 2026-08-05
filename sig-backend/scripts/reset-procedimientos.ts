// Borra TODOS los procedimientos SIG para arrancar de cero — y con ellos,
// vía ON DELETE CASCADE de Postgres, todo lo que cuelga de un procedimiento:
// commits, instructivos, formatos, doc anexos, los 5 tipos de análisis, y
// los cargos T&C asignados.
//
// Deliberadamente NUNCA toca SigArea, SigReporteDesarrollo ni
// SigLibertadoraBackup — no cuelgan de procedimientoId. Se verifica de forma
// explícita (antes/después) que esas tres tablas queden exactamente igual;
// si algo cambió, el script termina con error en vez de darlo por bueno.
//
// Los archivos físicos de instructivos/formatos/doc-anexos/commits viven en
// el MISMO directorio (uploads/sig) que los de Reportes de Desarrollo — por
// eso nunca se borra la carpeta completa, solo las rutas exactas que ya
// estaban guardadas en la BD para las filas que se están borrando.
//
// Uso:
//   npx ts-node scripts/reset-procedimientos.ts              -> dry-run, no borra nada
//   npx ts-node scripts/reset-procedimientos.ts --confirmar  -> borra de verdad

import fs from "fs/promises"
import prisma from "../src/config/prisma"

const NO_TOCAR = ["areas", "reportesDesarrollo", "libertadoraBackup"] as const
const DEBE_QUEDAR_EN_CERO = [
  "procedimientos", "commits", "instructivos", "formatos", "docAnexos",
  "analisisCoherencia", "analisisMejoras", "analisisProcVsInst", "analisisCargos",
  "analisisCompleto", "procedimientoCargo",
] as const

async function snapshot() {
  return {
    procedimientos:      await prisma.sigProcedimiento.count(),
    commits:              await prisma.sigCommit.count(),
    instructivos:         await prisma.sigInstructivo.count(),
    formatos:             await prisma.sigFormato.count(),
    docAnexos:            await prisma.sigDocAnexo.count(),
    analisisCoherencia:   await prisma.sigAnalisisCoherencia.count(),
    analisisMejoras:      await prisma.sigAnalisisMejoras.count(),
    analisisProcVsInst:   await prisma.sigAnalisisProcVsInst.count(),
    analisisCargos:       await prisma.sigAnalisisCargos.count(),
    analisisCompleto:     await prisma.sigAnalisisCompleto.count(),
    procedimientoCargo:   await prisma.sigProcedimientoCargo.count(),
    // NO se tocan en este script — solo se leen para comparar antes/después
    areas:                await prisma.sigArea.count(),
    reportesDesarrollo:   await prisma.sigReporteDesarrollo.count(),
    libertadoraBackup:    await prisma.sigLibertadoraBackup.count(),
  }
}

async function main() {
  const confirmar = process.argv.includes("--confirmar")

  const antes = await snapshot()
  console.log("=== Estado actual ===")
  console.table(antes)

  if (antes.procedimientos === 0) {
    console.log("No hay procedimientos cargados. Nada que hacer.")
    return
  }

  const [commitsConArchivo, instConArchivo, formatosRows, anexosRows] = await Promise.all([
    prisma.sigCommit.findMany({ where: { archivoOriginal: { not: null } }, select: { archivoOriginal: true } }),
    prisma.sigInstructivo.findMany({ where: { archivoOriginal: { not: null } }, select: { archivoOriginal: true } }),
    prisma.sigFormato.findMany({ select: { archivo: true } }),
    prisma.sigDocAnexo.findMany({ select: { archivo: true } }),
  ])
  const rutasArchivos = [
    ...commitsConArchivo.map((c) => c.archivoOriginal as string),
    ...instConArchivo.map((i) => i.archivoOriginal as string),
    ...formatosRows.map((f) => f.archivo),
    ...anexosRows.map((a) => a.archivo),
  ]
  console.log(`\nArchivos físicos que se borrarían: ${rutasArchivos.length}`)

  if (!confirmar) {
    console.log("\nDRY-RUN — no se borró nada todavía. Corre con --confirmar para ejecutar de verdad.")
    return
  }

  const { count: procedimientosBorrados } = await prisma.sigProcedimiento.deleteMany({})
  console.log(`\nProcedimientos borrados (cascade a todo lo demás): ${procedimientosBorrados}`)

  let archivosBorrados = 0
  for (const ruta of rutasArchivos) {
    try {
      await fs.unlink(ruta)
      archivosBorrados++
    } catch {
      // el archivo ya no existía en disco — no es un error del script
    }
  }
  console.log(`Archivos físicos borrados: ${archivosBorrados}/${rutasArchivos.length}`)

  const despues = await snapshot()
  console.log("\n=== Estado final ===")
  console.table(despues)

  let ok = true
  for (const key of NO_TOCAR) {
    if (despues[key] !== antes[key]) {
      console.error(`✗ VALIDACIÓN FALLIDA: "${key}" cambió de ${antes[key]} a ${despues[key]} — esta tabla NO debía tocarse.`)
      ok = false
    }
  }
  for (const key of DEBE_QUEDAR_EN_CERO) {
    if (despues[key] !== 0) {
      console.error(`✗ VALIDACIÓN FALLIDA: "${key}" debía quedar en 0, quedó en ${despues[key]}.`)
      ok = false
    }
  }

  if (ok) {
    console.log("\n✓ Reset completo — procedimientos y todo lo que colgaba de ellos en 0, el resto de las tablas intacto.")
  } else {
    console.error("\n✗ Algo no cuadró — revisa manualmente antes de seguir usando el módulo.")
    process.exitCode = 1
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())

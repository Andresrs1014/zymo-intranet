import { prisma } from "../config/prisma"

export interface SeguimientoItem {
  actividadId: number
  actividadNombre: string
  responsableNombre: string
  subproyectoNombre: string
  tipo: "vencida" | "bloqueada" | "riesgo" | "sin_avance"
  descripcion: string
  diasRetraso?: number
  avance: number
  fechaFin: string
}

function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0")
  const m = (date.getMonth() + 1).toString().padStart(2, "0")
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

export async function getStatusReport(): Promise<string> {
  const today = new Date()

  const subproyectos = await prisma.helixSubproyecto.findMany({
    where: { activo: true },
    include: { actividades: true },
    orderBy: { createdAt: "asc" },
  })

  let totalActividades = 0
  let completadas = 0
  let enCurso = 0
  let vencidas = 0
  let bloqueadas = 0

  for (const sp of subproyectos) {
    for (const a of sp.actividades) {
      totalActividades++
      if (a.estado === "Terminado") completadas++
      else if (a.estado === "En curso") enCurso++
      if (a.fechaFin < today && a.estado !== "Terminado") vencidas++
      if (a.bloqueada && a.estado !== "Terminado") bloqueadas++
    }
  }

  let report = `# Reporte de Estado — Proyectos Área de Desarrollo\n`
  report += `**Fecha:** ${formatDate(today)}\n\n`
  report += `## Resumen ejecutivo\n`
  report += `Total actividades: ${totalActividades} | Completadas: ${completadas} | En curso: ${enCurso} | Vencidas: ${vencidas} | Bloqueadas: ${bloqueadas}\n\n`

  for (const sp of subproyectos) {
    const acts = sp.actividades
    const totalActs = acts.length
    const avancePromedio =
      totalActs > 0
        ? Math.round(acts.reduce((s, a) => s + a.avance, 0) / totalActs)
        : 0

    const inversionEst = sp.inversionEst
    const retornoEsp = sp.retornoEsp
    const roi =
      inversionEst !== 0
        ? Math.round(((retornoEsp - inversionEst) / inversionEst) * 100 * 10) / 10
        : 0

    report += `## ${sp.nombre}\n`
    report += `Avance: ${avancePromedio}% | ROI estimado: ${roi}%\n\n`

    const actsCurso = acts.filter(
      (a) => a.estado === "En curso" && a.fechaFin >= today
    )
    if (actsCurso.length > 0) {
      report += `### Actividades en curso\n`
      for (const a of actsCurso) {
        report += `- **${a.nombre}** (${a.responsableNombre}) — ${a.avance}% avance — vence ${formatDate(a.fechaFin)}\n`
      }
      report += "\n"
    }

    const actsVencidas = acts.filter(
      (a) => a.fechaFin < today && a.estado !== "Terminado"
    )
    if (actsVencidas.length > 0) {
      report += `### Actividades vencidas\n`
      for (const a of actsVencidas) {
        const diasRetraso = Math.floor(
          (today.getTime() - a.fechaFin.getTime()) / (1000 * 60 * 60 * 24)
        )
        report += `- **${a.nombre}** (${a.responsableNombre}) — ${a.avance}% avance — ${diasRetraso} días de retraso ⚠️\n`
      }
      report += "\n"
    }

    report += `---\n\n`
  }

  return report
}

export async function getSeguimientos(): Promise<SeguimientoItem[]> {
  const today = new Date()
  const fiveDaysFromNow = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
  const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)

  const subproyectos = await prisma.helixSubproyecto.findMany({
    where: { activo: true },
    include: { actividades: true },
  })

  const items: SeguimientoItem[] = []

  for (const sp of subproyectos) {
    for (const a of sp.actividades) {
      const fechaFin = a.fechaFin

      // vencida
      if (fechaFin < today && a.estado !== "Terminado") {
        const diasRetraso = Math.floor(
          (today.getTime() - fechaFin.getTime()) / (1000 * 60 * 60 * 24)
        )
        items.push({
          actividadId: a.id,
          actividadNombre: a.nombre,
          responsableNombre: a.responsableNombre,
          subproyectoNombre: sp.nombre,
          tipo: "vencida",
          descripcion: `Vencida hace ${diasRetraso} día${diasRetraso !== 1 ? "s" : ""}`,
          diasRetraso,
          avance: a.avance,
          fechaFin: fechaFin.toISOString(),
        })
        continue
      }

      // bloqueada
      if (a.bloqueada && a.estado !== "Terminado") {
        items.push({
          actividadId: a.id,
          actividadNombre: a.nombre,
          responsableNombre: a.responsableNombre,
          subproyectoNombre: sp.nombre,
          tipo: "bloqueada",
          descripcion: "Actividad bloqueada, requiere atención",
          avance: a.avance,
          fechaFin: fechaFin.toISOString(),
        })
        continue
      }

      // riesgo: vence en 5 días y avance < 50
      if (
        fechaFin >= today &&
        fechaFin <= fiveDaysFromNow &&
        a.avance < 50 &&
        a.estado !== "Terminado"
      ) {
        const diasRestantes = Math.ceil(
          (fechaFin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        items.push({
          actividadId: a.id,
          actividadNombre: a.nombre,
          responsableNombre: a.responsableNombre,
          subproyectoNombre: sp.nombre,
          tipo: "riesgo",
          descripcion: `Vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""} con ${a.avance}% de avance`,
          avance: a.avance,
          fechaFin: fechaFin.toISOString(),
        })
        continue
      }

      // sin_avance: En curso o Planificado, avance = 0, creada hace más de 5 días
      if (
        (a.estado === "En curso" || a.estado === "Planificado") &&
        a.avance === 0 &&
        a.createdAt < fiveDaysAgo
      ) {
        items.push({
          actividadId: a.id,
          actividadNombre: a.nombre,
          responsableNombre: a.responsableNombre,
          subproyectoNombre: sp.nombre,
          tipo: "sin_avance",
          descripcion: "Sin avance registrado desde hace más de 5 días",
          avance: a.avance,
          fechaFin: fechaFin.toISOString(),
        })
      }
    }
  }

  return items
}

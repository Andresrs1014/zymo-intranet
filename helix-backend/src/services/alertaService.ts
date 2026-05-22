import { prisma } from "../config/prisma"

export interface AlertaGenerada {
  actividadId: number
  actividadNombre: string
  subproyectoNombre: string
  responsableNombre: string
  tipo: "vencida" | "bloqueada" | "riesgo"
  mensaje: string
  destinatarios: string[]
}

interface HistorialItem {
  id: number
  cambio: string
  actividadId?: number
  actividadNombre?: string
  subproyectoNombre?: string
  canal: string
  createdAt: string
}

export async function generarAlertasWhatsApp(): Promise<AlertaGenerada[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const twoDaysFromNow = new Date(today)
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)
  twoDaysFromNow.setHours(23, 59, 59, 999)

  const subproyectos = await prisma.helixSubproyecto.findMany({
    where: { activo: true },
    include: {
      actividades: {
        where: {
          estado: {
            not: "Terminado",
          },
        },
      },
    },
  })

  const alertas: AlertaGenerada[] = []

  for (const sp of subproyectos) {
    for (const act of sp.actividades) {
      const fechaFin = new Date(act.fechaFin)
      fechaFin.setHours(0, 0, 0, 0)

      // Vencida: fechaFin < today
      if (fechaFin < today) {
        const diffMs = today.getTime() - fechaFin.getTime()
        const diasRetraso = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        const mensaje =
          `⚠️ ACTIVIDAD VENCIDA\n*${act.nombre}*\nResponsable: ${act.responsableNombre}\nSubproyecto: ${sp.nombre}\nVencida hace ${diasRetraso} día(s)\nAvance: ${act.avance}%`
        alertas.push({
          actividadId: act.id,
          actividadNombre: act.nombre,
          subproyectoNombre: sp.nombre,
          responsableNombre: act.responsableNombre,
          tipo: "vencida",
          mensaje,
          destinatarios: ["equipo"],
        })
        continue
      }

      // Bloqueada
      if (act.bloqueada) {
        const mensaje =
          `🚫 ACTIVIDAD BLOQUEADA\n*${act.nombre}*\nResponsable: ${act.responsableNombre}\nSubproyecto: ${sp.nombre}\nRequiere atención inmediata`
        alertas.push({
          actividadId: act.id,
          actividadNombre: act.nombre,
          subproyectoNombre: sp.nombre,
          responsableNombre: act.responsableNombre,
          tipo: "bloqueada",
          mensaje,
          destinatarios: ["equipo"],
        })
        continue
      }

      // En riesgo: fechaFin within 2 days AND avance < 60
      if (fechaFin <= twoDaysFromNow && act.avance < 60) {
        const diffMs = fechaFin.getTime() - today.getTime()
        const dias = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
        const mensaje =
          `⏰ EN RIESGO\n*${act.nombre}*\nResponsable: ${act.responsableNombre}\nSubproyecto: ${sp.nombre}\nVence en ${dias} día(s) con solo ${act.avance}% de avance`
        alertas.push({
          actividadId: act.id,
          actividadNombre: act.nombre,
          subproyectoNombre: sp.nombre,
          responsableNombre: act.responsableNombre,
          tipo: "riesgo",
          mensaje,
          destinatarios: ["equipo"],
        })
      }
    }
  }

  return alertas
}

export async function registrarAlertas(
  alertas: AlertaGenerada[],
  canal: string
): Promise<void> {
  for (const alerta of alertas) {
    await prisma.helixAlerta.create({
      data: {
        cambio: alerta.tipo,
        actividadId: alerta.actividadId,
        actividadNombre: alerta.actividadNombre,
        destinatarios: alerta.destinatarios,
        canal,
      },
    })
  }
}

export async function getHistorialAlertas(
  limit = 30
): Promise<HistorialItem[]> {
  const records = await prisma.helixAlerta.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      subproyecto: {
        select: { nombre: true },
      },
    },
  })

  return records.map((r) => ({
    id: r.id,
    cambio: r.cambio,
    actividadId: r.actividadId ?? undefined,
    actividadNombre: r.actividadNombre ?? undefined,
    subproyectoNombre: r.subproyecto?.nombre ?? undefined,
    canal: r.canal,
    createdAt: r.createdAt.toISOString(),
  }))
}

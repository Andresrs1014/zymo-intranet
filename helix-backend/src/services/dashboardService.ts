import { prisma } from "../config/prisma"

export interface DashboardMetricas {
  total: number
  completadas: number
  enProgreso: number
  vencidas: number
  bloqueadas: number
  puntosTotal: number
  puntosCompletados: number
  avanceGlobal: number
}

export interface EstadoCount {
  estado: string
  count: number
}

export interface ProximoHito {
  id: number
  nombre: string
  responsableNombre: string
  fechaFin: string
  avance: number
  subproyectoNombre: string
  diasRestantes: number
}

export interface ActividadBloqueada {
  id: number
  nombre: string
  responsableNombre: string
  responsableInitials: string
  responsableColor: string
  subproyectoNombre: string
  avance: number
  fechaFin: string
}

export interface CargaResponsable {
  responsableId: number
  responsableNombre: string
  responsableInitials: string
  responsableColor: string
  total: number
  completadas: number
  enProgreso: number
  avancePromedio: number
}

export interface Insignia {
  tipo: "cumplimiento" | "velocidad" | "calidad" | "colaboracion"
  titulo: string
  descripcion: string
  valor: number
  obtenida: boolean
}

export interface EstadisticasResponsable {
  responsableId: number
  responsableNombre: string
  total: number
  completadas: number
  avancePromedio: number
  puntosCompletados: number
}

export interface DashboardData {
  metricas: DashboardMetricas
  distribucionEstados: EstadoCount[]
  proximosHitos: ProximoHito[]
  bloqueadas: ActividadBloqueada[]
  cargaPorResponsable: CargaResponsable[]
  insignias: Insignia[]
  estadisticasPorResponsable: EstadisticasResponsable[]
}

export async function getDashboardData(subproyectoId?: number): Promise<DashboardData> {
  const where = subproyectoId !== undefined ? { subproyectoId } : {}

  const actividades = await prisma.helixActividad.findMany({
    where,
    include: { subproyecto: true },
  })

  const now = new Date()

  // --- Metricas ---
  const total = actividades.length
  const completadas = actividades.filter((a) => a.estado === "Terminado").length
  const enProgreso = actividades.filter((a) => a.estado === "En curso").length
  const vencidas = actividades.filter(
    (a) => a.estado !== "Terminado" && new Date(a.fechaFin) < now
  ).length
  const bloqueadasCount = actividades.filter((a) => a.bloqueada).length
  const puntosTotal = actividades.reduce((s, a) => s + a.puntos, 0)
  const puntosCompletados = actividades
    .filter((a) => a.estado === "Terminado")
    .reduce((s, a) => s + a.puntos, 0)
  const avanceGlobal =
    total === 0
      ? 0
      : Math.round(actividades.reduce((s, a) => s + a.avance, 0) / total)

  // --- Distribución de estados ---
  const estadoMap = new Map<string, number>()
  for (const a of actividades) {
    estadoMap.set(a.estado, (estadoMap.get(a.estado) ?? 0) + 1)
  }
  const distribucionEstados: EstadoCount[] = Array.from(estadoMap.entries()).map(
    ([estado, count]) => ({ estado, count })
  )

  // --- Próximos hitos (next 7 days, not Terminado) ---
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const proximosHitos: ProximoHito[] = actividades
    .filter((a) => {
      const fin = new Date(a.fechaFin)
      return a.estado !== "Terminado" && fin >= now && fin <= in7Days
    })
    .sort((a, b) => new Date(a.fechaFin).getTime() - new Date(b.fechaFin).getTime())
    .slice(0, 10)
    .map((a) => {
      const fin = new Date(a.fechaFin)
      const diasRestantes = Math.ceil(
        (fin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        id: a.id,
        nombre: a.nombre,
        responsableNombre: a.responsableNombre,
        fechaFin: a.fechaFin.toISOString(),
        avance: a.avance,
        subproyectoNombre: a.subproyecto.nombre,
        diasRestantes,
      }
    })

  // --- Bloqueadas ---
  const bloqueadas: ActividadBloqueada[] = actividades
    .filter((a) => a.bloqueada)
    .map((a) => ({
      id: a.id,
      nombre: a.nombre,
      responsableNombre: a.responsableNombre,
      responsableInitials: a.responsableInitials,
      responsableColor: a.responsableColor,
      subproyectoNombre: a.subproyecto.nombre,
      avance: a.avance,
      fechaFin: a.fechaFin.toISOString(),
    }))

  // --- Carga por responsable ---
  const responsableMap = new Map<
    number,
    {
      nombre: string
      initials: string
      color: string
      acts: typeof actividades
    }
  >()
  for (const a of actividades) {
    if (!responsableMap.has(a.responsableId)) {
      responsableMap.set(a.responsableId, {
        nombre: a.responsableNombre,
        initials: a.responsableInitials,
        color: a.responsableColor,
        acts: [],
      })
    }
    responsableMap.get(a.responsableId)!.acts.push(a)
  }

  const cargaPorResponsable: CargaResponsable[] = Array.from(
    responsableMap.entries()
  ).map(([responsableId, { nombre, initials, color, acts }]) => {
    const rTotal = acts.length
    const rCompletadas = acts.filter((a) => a.estado === "Terminado").length
    const rEnProgreso = acts.filter((a) => a.estado === "En curso").length
    const rAvance =
      rTotal === 0
        ? 0
        : Math.round(acts.reduce((s, a) => s + a.avance, 0) / rTotal)
    return {
      responsableId,
      responsableNombre: nombre,
      responsableInitials: initials,
      responsableColor: color,
      total: rTotal,
      completadas: rCompletadas,
      enProgreso: rEnProgreso,
      avancePromedio: rAvance,
    }
  })

  // --- Insignias ---
  const tasaCompletitud = total === 0 ? 0 : Math.round((completadas / total) * 100)

  const activeActs = actividades.filter((a) => a.estado !== "Terminado")
  const activeTotal = activeActs.length
  const nonVencidas = activeActs.filter((a) => new Date(a.fechaFin) >= now).length
  const tasaEnTiempo =
    activeTotal === 0 ? 100 : Math.round((nonVencidas / activeTotal) * 100)

  const insignias: Insignia[] = [
    {
      tipo: "cumplimiento",
      titulo: "Tasa de completitud",
      descripcion: `${completadas} de ${total} actividades completadas`,
      valor: tasaCompletitud,
      obtenida: tasaCompletitud >= 70,
    },
    {
      tipo: "velocidad",
      titulo: "Actividades en tiempo",
      descripcion: `${nonVencidas} de ${activeTotal} activas sin vencer`,
      valor: tasaEnTiempo,
      obtenida: tasaEnTiempo >= 80,
    },
    {
      tipo: "calidad",
      titulo: "Avance promedio",
      descripcion: `Avance global del proyecto: ${avanceGlobal}%`,
      valor: avanceGlobal,
      obtenida: avanceGlobal >= 60,
    },
    {
      tipo: "colaboracion",
      titulo: "Sin bloqueos",
      descripcion:
        bloqueadasCount === 0
          ? "Ninguna actividad bloqueada"
          : `${bloqueadasCount} actividad(es) bloqueada(s)`,
      valor: total === 0 ? 100 : Math.round((1 - bloqueadasCount / total) * 100),
      obtenida: bloqueadasCount === 0,
    },
  ]

  // --- Estadísticas por responsable ---
  const estadisticasPorResponsable: EstadisticasResponsable[] = Array.from(
    responsableMap.entries()
  ).map(([responsableId, { nombre, acts }]) => {
    const rTotal = acts.length
    const rCompletadas = acts.filter((a) => a.estado === "Terminado").length
    const rAvance =
      rTotal === 0
        ? 0
        : Math.round(acts.reduce((s, a) => s + a.avance, 0) / rTotal)
    const rPuntos = acts
      .filter((a) => a.estado === "Terminado")
      .reduce((s, a) => s + a.puntos, 0)
    return {
      responsableId,
      responsableNombre: nombre,
      total: rTotal,
      completadas: rCompletadas,
      avancePromedio: rAvance,
      puntosCompletados: rPuntos,
    }
  })

  return {
    metricas: {
      total,
      completadas,
      enProgreso,
      vencidas,
      bloqueadas: bloqueadasCount,
      puntosTotal,
      puntosCompletados,
      avanceGlobal,
    },
    distribucionEstados,
    proximosHitos,
    bloqueadas,
    cargaPorResponsable,
    insignias,
    estadisticasPorResponsable,
  }
}

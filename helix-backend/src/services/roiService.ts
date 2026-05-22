import { prisma } from "../config/prisma"

export interface ROISubproyecto {
  id: number
  nombre: string
  inversionEst: number
  retornoEsp: number
  roi: number
  margen: number
  clasificacion: "Alto potencial" | "Potencial favorable" | "Retorno controlado" | "Revisar alcance"
  totalActividades: number
  avancePromedio: number
  actividadesTerminadas: number
}

function clasificar(roi: number): ROISubproyecto["clasificacion"] {
  if (roi > 50) return "Alto potencial"
  if (roi >= 20) return "Potencial favorable"
  if (roi >= 0) return "Retorno controlado"
  return "Revisar alcance"
}

export async function getROIData(): Promise<ROISubproyecto[]> {
  const subproyectos = await prisma.helixSubproyecto.findMany({
    where: { activo: true },
    include: { actividades: true },
  })

  return subproyectos.map((sp) => {
    const inversionEst = sp.inversionEst
    const retornoEsp = sp.retornoEsp
    const margen = retornoEsp - inversionEst
    const roi =
      inversionEst !== 0
        ? Math.round(((retornoEsp - inversionEst) / inversionEst) * 100 * 10) / 10
        : 0

    const totalActividades = sp.actividades.length
    const actividadesTerminadas = sp.actividades.filter(
      (a) => a.estado === "Terminado"
    ).length
    const avancePromedio =
      totalActividades > 0
        ? Math.round(
            sp.actividades.reduce((sum, a) => sum + a.avance, 0) / totalActividades
          )
        : 0

    return {
      id: sp.id,
      nombre: sp.nombre,
      inversionEst,
      retornoEsp,
      roi,
      margen,
      clasificacion: clasificar(roi),
      totalActividades,
      avancePromedio,
      actividadesTerminadas,
    }
  })
}

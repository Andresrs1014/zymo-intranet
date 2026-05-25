import type { HelixROI } from "@/types/helix"

export interface PortfolioMetrics {
  totalInversion: number
  totalRetorno: number
  roiPortfolio: number
  margenPromedio: number
  avancePortfolio: number
  proyectosAltoROI: number
  proyectosEnRiesgo: number
  totalProyectos: number
}

export function computePortfolioMetrics(data: HelixROI[]): PortfolioMetrics {
  if (data.length === 0) {
    return {
      totalInversion: 0,
      totalRetorno: 0,
      roiPortfolio: 0,
      margenPromedio: 0,
      avancePortfolio: 0,
      proyectosAltoROI: 0,
      proyectosEnRiesgo: 0,
      totalProyectos: 0,
    }
  }

  const totalInversion = data.reduce((s, d) => s + d.inversionEst, 0)
  const totalRetorno = data.reduce((s, d) => s + d.retornoEsp, 0)
  const roiPortfolio =
    totalInversion > 0
      ? Math.round(((totalRetorno - totalInversion) / totalInversion) * 100)
      : 0
  const margenPromedio = Math.round(
    data.reduce((s, d) => s + d.margen, 0) / data.length
  )
  const avancePortfolio = Math.round(
    data.reduce((s, d) => s + d.avancePromedio, 0) / data.length
  )
  const proyectosAltoROI = data.filter(
    (d) => d.clasificacion === "Alto potencial" || d.clasificacion === "Potencial favorable"
  ).length
  const proyectosEnRiesgo = data.filter(
    (d) => d.clasificacion === "Revisar alcance"
  ).length

  return {
    totalInversion,
    totalRetorno,
    roiPortfolio,
    margenPromedio,
    avancePortfolio,
    proyectosAltoROI,
    proyectosEnRiesgo,
    totalProyectos: data.length,
  }
}

import { useCallback } from "react"
import { helixApi } from "@/lib/helixApi"
import type { HelixActividad, HelixSubproyecto } from "@/types/helix"
import type { HelixSubactividadCreate } from "./useHelixActividades"

export interface PlanTrabajoCreate {
  nombre: string
  objetivo?: string
  liderResponsableId: number
  liderResponsableNombre: string
  liderResponsableInitials: string
  liderResponsableColor?: string
  fechaInicio: string
  fechaFin: string
  actividades: string[]
  subactividadesBase?: HelixSubactividadCreate[]
}

export interface PlanTrabajoResult {
  plan: HelixSubproyecto
  actividades: HelixActividad[]
}

export function useHelixPlanesTrabajo() {
  const createPlanTrabajo = useCallback(async (data: PlanTrabajoCreate): Promise<PlanTrabajoResult> => {
    const res = await helixApi.post<PlanTrabajoResult>("/api/planes-trabajo", data)
    return res.data
  }, [])

  return { createPlanTrabajo }
}

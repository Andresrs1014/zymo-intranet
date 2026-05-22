import { useState, useCallback } from "react"
import type { HelixActividad, HelixPrioridad } from "@/types/helix"

export interface HelixFilters {
  search: string
  responsableId: number | "all"
  subproyectoId: number | "all"
  soloBlockeadas: boolean
  prioridad: HelixPrioridad | "all"
}

interface UseHelixFiltersResult {
  filters: HelixFilters
  setSearch: (v: string) => void
  setResponsableId: (v: number | "all") => void
  setSubproyectoId: (v: number | "all") => void
  setSoloBlockeadas: (v: boolean) => void
  setPrioridad: (v: HelixPrioridad | "all") => void
  applyFilters: (actividades: HelixActividad[]) => HelixActividad[]
}

const INITIAL_FILTERS: HelixFilters = {
  search: "",
  responsableId: "all",
  subproyectoId: "all",
  soloBlockeadas: false,
  prioridad: "all",
}

export function useHelixFilters(): UseHelixFiltersResult {
  const [filters, setFilters] = useState<HelixFilters>(INITIAL_FILTERS)

  const setSearch = useCallback((v: string) => {
    setFilters((prev) => ({ ...prev, search: v }))
  }, [])

  const setResponsableId = useCallback((v: number | "all") => {
    setFilters((prev) => ({ ...prev, responsableId: v }))
  }, [])

  const setSubproyectoId = useCallback((v: number | "all") => {
    setFilters((prev) => ({ ...prev, subproyectoId: v }))
  }, [])

  const setSoloBlockeadas = useCallback((v: boolean) => {
    setFilters((prev) => ({ ...prev, soloBlockeadas: v }))
  }, [])

  const setPrioridad = useCallback((v: HelixPrioridad | "all") => {
    setFilters((prev) => ({ ...prev, prioridad: v }))
  }, [])

  const applyFilters = useCallback(
    (actividades: HelixActividad[]): HelixActividad[] => {
      const searchLower = filters.search.toLowerCase().trim()

      return actividades.filter((a) => {
        // Text search on nombre + responsableNombre
        if (searchLower) {
          const matchNombre = a.nombre.toLowerCase().includes(searchLower)
          const matchResponsable = a.responsableNombre
            .toLowerCase()
            .includes(searchLower)
          if (!matchNombre && !matchResponsable) return false
        }

        // Responsable filter
        if (
          filters.responsableId !== "all" &&
          a.responsableId !== filters.responsableId
        ) {
          return false
        }

        // Subproyecto filter
        if (
          filters.subproyectoId !== "all" &&
          a.subproyectoId !== filters.subproyectoId
        ) {
          return false
        }

        // Solo bloqueadas filter
        if (filters.soloBlockeadas && !a.bloqueada) {
          return false
        }

        // Prioridad filter
        if (filters.prioridad !== "all" && a.prioridad !== filters.prioridad) {
          return false
        }

        return true
      })
    },
    [filters]
  )

  return {
    filters,
    setSearch,
    setResponsableId,
    setSubproyectoId,
    setSoloBlockeadas,
    setPrioridad,
    applyFilters,
  }
}

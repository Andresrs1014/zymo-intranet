import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ProveedorSGC {
  id: string
  nombre: string
  nit: string | null
  representante_legal: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  ciudad: string | null
  categoria: string | null
  activo: boolean
  observaciones: string | null
  creado_por_id: number | null
  created_at: string
  updated_at: string | null
}

export interface ProveedorSGCCreate {
  nombre: string
  nit?: string
  representante_legal?: string
  email?: string
  telefono?: string
  direccion?: string
  ciudad?: string
  categoria?: string
  observaciones?: string
}

export interface ExtraccionRUTResult {
  nombre: string | null
  nit: string | null
  representante_legal: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  ciudad: string | null
  nombre_archivo: string
  campos_encontrados: number
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useProveedoresSGC(soloActivos = false) {
  return useQuery({
    queryKey: ["sgc", "proveedores", { soloActivos }],
    queryFn: async () => {
      const { data } = await api.get<ProveedorSGC[]>(
        `/api/sgc/proveedores?solo_activos=${soloActivos}`
      )
      return data
    },
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCrearProveedorSGC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ProveedorSGCCreate) => {
      const { data } = await api.post<ProveedorSGC>("/api/sgc/proveedores", payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sgc", "proveedores"] })
      // También invalida OC para que el selector se actualice
      qc.invalidateQueries({ queryKey: ["oc", "proveedores"] })
    },
  })
}

export function useActualizarProveedorSGC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ProveedorSGCCreate> & { activo?: boolean } }) => {
      const { data } = await api.put<ProveedorSGC>(`/api/sgc/proveedores/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sgc", "proveedores"] })
      qc.invalidateQueries({ queryKey: ["oc", "proveedores"] })
    },
  })
}

export function useToggleActivoSGC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ProveedorSGC>(`/api/sgc/proveedores/${id}/toggle-activo`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sgc", "proveedores"] })
      qc.invalidateQueries({ queryKey: ["oc", "proveedores"] })
    },
  })
}

export function useExtraerDocumentoSGC() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      const { data } = await api.post<ExtraccionRUTResult>(
        "/api/sgc/proveedores/extraer",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      return data
    },
  })
}

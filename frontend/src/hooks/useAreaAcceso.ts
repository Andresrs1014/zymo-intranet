import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface UsuarioArea {
  id: number
  full_name: string | null
  email: string
  sede: string | null
  is_active: boolean
  /** Fichas del directorio vinculadas a este usuario: solo con exactamente 1 se puede asignar cargo y dar acceso */
  fichas: number
  persona_id: number | null
  persona_area_id: number | null
  cargo_id: number | null
  cargo: string | null
  /** Permisos a aplicaciones asignados directamente a la persona */
  permisos: string[]
  /** Área escrita en la cuenta (solo en la vista de todas las personas) */
  area?: string | null
}

export interface CargoDir {
  id: number
  nombre: string
  /** Ya lo usa gente del área o le pertenece; false = cargo sin área asignada en el directorio */
  de_area: boolean
}

export interface PersonaDir {
  id: number
  nombre: string
  cargo_id: number | null
}

export interface Exclusivo {
  permiso: string
  areas: number[]
}

export function useUsuariosArea(areaId: number | null) {
  return useQuery({
    queryKey: ["area-usuarios", areaId],
    enabled: areaId != null,
    queryFn: async () => (await api.get<UsuarioArea[]>(`/areas/${areaId}/usuarios`)).data,
  })
}

export function useTodosUsuarios() {
  return useQuery({
    queryKey: ["area-usuarios", "todos"],
    queryFn: async () => (await api.get<UsuarioArea[]>("/acceso/usuarios")).data,
  })
}

export function useCargosArea(areaId: number | null) {
  return useQuery({
    queryKey: ["area-cargos", areaId],
    enabled: areaId != null,
    queryFn: async () => (await api.get<CargoDir[]>(`/areas/${areaId}/cargos`)).data,
  })
}

export function useExclusivos() {
  return useQuery({
    queryKey: ["acceso-exclusivos"],
    queryFn: async () => (await api.get<Exclusivo[]>("/acceso/exclusivos")).data,
  })
}

/** Reemplaza los permisos de una persona (Editar permisos). */
export function useFijarPermisos(areaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, permisos }: { userId: number; permisos: string[] }) =>
      (await api.put<{ permisos: string[] }>(`/areas/${areaId}/usuarios/${userId}/permisos`, { permisos })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["area-usuarios"] }), // también la vista de todas las personas
  })
}

export interface UsuarioNuevo {
  full_name: string
  email: string
  password: string
  sede?: string
  cargo?: string
}

/** Crea la persona en el área: cargo y permisos son opcionales. */
export function useCrearUsuario(areaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (datos: UsuarioNuevo) => (await api.post<{ id: number; email: string; cargo: string | null }>(`/areas/${areaId}/usuarios`, datos)).data,
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["area-usuarios", areaId] }),
      qc.invalidateQueries({ queryKey: ["area-cargos", areaId] }),
      qc.invalidateQueries({ queryKey: ["users"] }),
    ]),
  })
}

/** Cambia el cargo en el directorio: uno existente (cargo_id) o uno nuevo escrito a mano (nombre). */
export function useCambiarCargo(areaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, cargo_id, nombre }: { userId: number; cargo_id?: number; nombre?: string }) =>
      (await api.put<{ cargo_id: number; cargo: string }>(`/areas/${areaId}/usuarios/${userId}/cargo`, { cargo_id, nombre })).data,
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["area-usuarios", areaId] }),
      qc.invalidateQueries({ queryKey: ["area-cargos", areaId] }),
    ]),
  })
}

export interface MovidoResultado {
  area: string
  area_anterior: string | null
  /** Permisos propios que no aplican en la nueva área (son exclusivos de otras) */
  permisos_inactivos: string[]
  /** movida | sin_ficha | varias */
  ficha: string
}

/** Pasa a la persona a otra área (cuenta y, si tiene una sola ficha, también el directorio). */
export function useMoverUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, areaId }: { userId: number; areaId: number }) =>
      (await api.put<MovidoResultado>(`/acceso/usuarios/${userId}/area`, { area_id: areaId })).data,
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["area-usuarios"] }),
      qc.invalidateQueries({ queryKey: ["users"] }),
    ]),
  })
}

export function useFijarExclusivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ permisos, areas }: { permisos: string[]; areas: number[] }) => {
      await Promise.all(permisos.map((p) => api.put(`/acceso/exclusivos/${p}`, { areas })))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acceso-exclusivos"] }),
  })
}

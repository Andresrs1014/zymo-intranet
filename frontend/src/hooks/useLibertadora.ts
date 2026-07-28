import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { libertadoraApi } from "@/lib/libertadoraApi"
import type { LibProspecto, LibProspectoInput, LibCita, LibCitaInput, LibMeta, LibKpis, LibPartnerUser } from "@/types/libertadora"

export function useLibProspectos() {
  return useQuery<LibProspecto[]>({
    queryKey: ["lib-prospectos"],
    queryFn: async () => (await libertadoraApi.get<LibProspecto[]>("/api/prospectos")).data,
  })
}

export function useLibCitas() {
  return useQuery<LibCita[]>({
    queryKey: ["lib-citas"],
    queryFn: async () => (await libertadoraApi.get<LibCita[]>("/api/citas")).data,
  })
}

export function useLibKpis() {
  return useQuery<LibKpis>({
    queryKey: ["lib-kpis"],
    queryFn: async () => (await libertadoraApi.get<LibKpis>("/api/dashboard/kpis")).data,
  })
}

export function useLibMeta() {
  return useQuery<LibMeta>({
    queryKey: ["lib-meta"],
    queryFn: async () => (await libertadoraApi.get<LibMeta>("/api/meta")).data,
  })
}

export function useUpdateLibMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Pick<LibMeta, "metaMensual" | "metaAnual" | "metaCierres" | "metaCitas">>) =>
      (await libertadoraApi.put<LibMeta>("/api/meta", data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-meta"] })
    },
  })
}

export function useCreateLibProspecto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<LibProspectoInput> & { empresa: string }) =>
      (await libertadoraApi.post<LibProspecto>("/api/prospectos", data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-prospectos"] })
      qc.invalidateQueries({ queryKey: ["lib-kpis"] })
    },
  })
}

export function useUpdateLibProspecto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LibProspectoInput> }) =>
      (await libertadoraApi.patch<LibProspecto>(`/api/prospectos/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-prospectos"] })
      qc.invalidateQueries({ queryKey: ["lib-kpis"] })
    },
  })
}

export function useDeleteLibProspecto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await libertadoraApi.delete(`/api/prospectos/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-prospectos"] })
      qc.invalidateQueries({ queryKey: ["lib-kpis"] })
    },
  })
}

export function useCreateLibCita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<LibCitaInput> & { cliente: string; fecha: string }) =>
      (await libertadoraApi.post<LibCita>("/api/citas", data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-citas"] })
    },
  })
}

export function useUpdateLibCita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LibCitaInput> }) =>
      (await libertadoraApi.patch<LibCita>(`/api/citas/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-citas"] })
    },
  })
}

export function useDeleteLibCita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await libertadoraApi.delete(`/api/citas/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-citas"] })
    },
  })
}

// ── Usuarios externos (Configuración → Usuarios externos) ──────────────────

export function useLibPartnerUsers() {
  return useQuery<LibPartnerUser[]>({
    queryKey: ["lib-partner-users"],
    queryFn: async () => (await libertadoraApi.get<LibPartnerUser[]>("/api/partner-users")).data,
  })
}

export function useCreateLibPartnerUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { email: string; nombre?: string; password: string }) =>
      (await libertadoraApi.post<LibPartnerUser>("/api/partner-users", data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-partner-users"] })
    },
  })
}

export function useSetLibPartnerUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      (await libertadoraApi.patch<LibPartnerUser>(`/api/partner-users/${id}/${active ? "reactivar" : "desactivar"}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-partner-users"] })
    },
  })
}

export function useResetLibPartnerUserPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await libertadoraApi.patch(`/api/partner-users/${id}/contrasena`, { password })
    },
  })
}

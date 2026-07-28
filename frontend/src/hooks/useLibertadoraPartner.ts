import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { libertadoraApi } from "@/lib/libertadoraApi"
import { useLibertadoraPartnerStore } from "@/store/libertadoraPartnerStore"
import type { LibProspecto, LibProspectoInput, LibCita, LibCitaInput, LibMeta } from "@/types/libertadora"

interface LoginResponse {
  token: string
  nombre: string | null
  email: string
}

export function usePartnerLogin() {
  const setSession = useLibertadoraPartnerStore((s) => s.setSession)
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) =>
      (await libertadoraApi.post<LoginResponse>("/public/login", data)).data,
    onSuccess: (data) => setSession(data),
  })
}

export function usePartnerProspectos() {
  const token = useLibertadoraPartnerStore((s) => s.token)
  return useQuery<LibProspecto[]>({
    queryKey: ["lib-partner-prospectos"],
    queryFn: async () => (await libertadoraApi.get<LibProspecto[]>("/public/prospectos")).data,
    enabled: Boolean(token),
  })
}

export function usePartnerCreateProspecto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<LibProspectoInput> & { empresa: string }) =>
      (await libertadoraApi.post<LibProspecto>("/public/prospectos", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-partner-prospectos"] }),
  })
}

export function usePartnerUpdateProspecto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LibProspectoInput> }) =>
      (await libertadoraApi.patch<LibProspecto>(`/public/prospectos/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-partner-prospectos"] }),
  })
}

export function usePartnerDeleteProspecto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await libertadoraApi.delete(`/public/prospectos/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-partner-prospectos"] }),
  })
}

// Lectura y edición — cualquier persona con cuenta de socio puede ver y
// cambiar la meta comercial (decisión del gerente, 2026-07-28).
export function usePartnerMeta() {
  const token = useLibertadoraPartnerStore((s) => s.token)
  return useQuery<LibMeta>({
    queryKey: ["lib-partner-meta"],
    queryFn: async () => (await libertadoraApi.get<LibMeta>("/public/meta")).data,
    enabled: Boolean(token),
  })
}

export function usePartnerUpdateMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Pick<LibMeta, "metaMensual" | "metaAnual" | "metaCierres" | "metaCitas">>) =>
      (await libertadoraApi.put<LibMeta>("/public/meta", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-partner-meta"] }),
  })
}

export function usePartnerCitas() {
  const token = useLibertadoraPartnerStore((s) => s.token)
  return useQuery<LibCita[]>({
    queryKey: ["lib-partner-citas"],
    queryFn: async () => (await libertadoraApi.get<LibCita[]>("/public/citas")).data,
    enabled: Boolean(token),
  })
}

export function usePartnerCreateCita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<LibCitaInput> & { cliente: string; fecha: string }) =>
      (await libertadoraApi.post<LibCita>("/public/citas", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-partner-citas"] }),
  })
}

export function usePartnerUpdateCita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LibCitaInput> }) =>
      (await libertadoraApi.patch<LibCita>(`/public/citas/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-partner-citas"] }),
  })
}

export function usePartnerDeleteCita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await libertadoraApi.delete(`/public/citas/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-partner-citas"] }),
  })
}

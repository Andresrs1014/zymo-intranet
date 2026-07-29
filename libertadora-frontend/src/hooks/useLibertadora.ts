import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { libertadoraApi } from "@/lib/libertadoraApi"
import { useSessionStore } from "@/store/sessionStore"
import type { LibProspecto, LibProspectoInput, LibCita, LibCitaInput, LibMeta, LibKpis, LibUser } from "@/types/libertadora"

// ── Login ────────────────────────────────────────────────────────────────

interface LoginResponse {
  token: string
  nombre: string | null
  email: string
  isAdmin: boolean
}

export function useLogin() {
  const setSession = useSessionStore((s) => s.setSession)
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) =>
      (await libertadoraApi.post<LoginResponse>("/api/login", data)).data,
    onSuccess: (data) => setSession(data),
  })
}

// ── Prospectos ───────────────────────────────────────────────────────────

export function useLibProspectos() {
  const token = useSessionStore((s) => s.token)
  return useQuery<LibProspecto[]>({
    queryKey: ["lib-prospectos"],
    queryFn: async () => (await libertadoraApi.get<LibProspecto[]>("/api/prospectos")).data,
    enabled: Boolean(token),
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

// ── Citas ────────────────────────────────────────────────────────────────

export function useLibCitas() {
  const token = useSessionStore((s) => s.token)
  return useQuery<LibCita[]>({
    queryKey: ["lib-citas"],
    queryFn: async () => (await libertadoraApi.get<LibCita[]>("/api/citas")).data,
    enabled: Boolean(token),
  })
}

export function useCreateLibCita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<LibCitaInput> & { cliente: string; fecha: string }) =>
      (await libertadoraApi.post<LibCita>("/api/citas", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-citas"] }),
  })
}

export function useUpdateLibCita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LibCitaInput> }) =>
      (await libertadoraApi.patch<LibCita>(`/api/citas/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-citas"] }),
  })
}

export function useDeleteLibCita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await libertadoraApi.delete(`/api/citas/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-citas"] }),
  })
}

// ── Dashboard / Meta ─────────────────────────────────────────────────────

export function useLibKpis() {
  const token = useSessionStore((s) => s.token)
  return useQuery<LibKpis>({
    queryKey: ["lib-kpis"],
    queryFn: async () => (await libertadoraApi.get<LibKpis>("/api/dashboard/kpis")).data,
    enabled: Boolean(token),
  })
}

// Lectura y edición — cualquier persona con cuenta puede ver y cambiar la
// meta comercial (decisión del gerente, 2026-07-28).
export function useLibMeta() {
  const token = useSessionStore((s) => s.token)
  return useQuery<LibMeta>({
    queryKey: ["lib-meta"],
    queryFn: async () => (await libertadoraApi.get<LibMeta>("/api/meta")).data,
    enabled: Boolean(token),
  })
}

export function useUpdateLibMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Pick<LibMeta, "metaMensual" | "metaAnual" | "metaCierres" | "metaCitas">>) =>
      (await libertadoraApi.put<LibMeta>("/api/meta", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-meta"] }),
  })
}

// ── Usuarios (solo admin) ────────────────────────────────────────────────

export function useLibUsers() {
  return useQuery<LibUser[]>({
    queryKey: ["lib-users"],
    queryFn: async () => (await libertadoraApi.get<LibUser[]>("/api/users")).data,
  })
}

export function useCreateLibUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { email: string; nombre?: string; password: string; isAdmin?: boolean }) =>
      (await libertadoraApi.post<LibUser>("/api/users", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-users"] }),
  })
}

export function useSetLibUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      (await libertadoraApi.patch<LibUser>(`/api/users/${id}/${active ? "reactivar" : "desactivar"}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-users"] }),
  })
}

export function useSetLibUserAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) =>
      (await libertadoraApi.patch<LibUser>(`/api/users/${id}/admin`, { isAdmin })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-users"] }),
  })
}

export function useResetLibUserPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await libertadoraApi.patch(`/api/users/${id}/contrasena`, { password })
    },
  })
}

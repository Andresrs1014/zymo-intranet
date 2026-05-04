import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import type { AxiosError } from "axios"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type TipoBorrador = "solicitud_nueva" | "cotizacion" | "factura"

export interface ArchivoRef {
  path: string
  nombre_original: string
  mime: string
  size_bytes: number
  draft_id: string
}

export interface FormDraft {
  id: string
  tipo: TipoBorrador
  user_id: number
  contexto: Record<string, string> | null
  payload: Record<string, unknown> | null
  archivos: ArchivoRef[] | null
  updated_at: string
  creado_en: string
}

// ── useDraft ──────────────────────────────────────────────────────────────────

/**
 * Carga el borrador activo para un tipo (y opcionalmente una solicitud).
 * Retorna null si no existe (404 es estado válido — no hay borrador aún).
 */
export function useDraft(tipo: TipoBorrador | undefined, solicitudId?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: ["draft", tipo ?? "", solicitudId ?? ""],
    queryFn: async (): Promise<FormDraft | null> => {
      const params = new URLSearchParams()
      if (tipo) params.set("tipo", tipo)
      if (solicitudId) params.set("solicitud_id", solicitudId)
      try {
        const { data } = await api.get<FormDraft>(`/api/borradores?${params}`)
        return data
      } catch (err) {
        const axiosErr = err as AxiosError
        if (axiosErr.response?.status === 404) return null
        throw err
      }
    },
    enabled: !!tipo && isAuthenticated,
    staleTime: 0,
    retry: false,
  })
}

// ── useSaveDraft ──────────────────────────────────────────────────────────────

export interface SaveDraftPayload {
  tipo: TipoBorrador
  solicitud_id?: string
  contexto?: Record<string, string>
  payload?: Record<string, unknown>
}

/**
 * Guarda (upsert) un borrador via PUT. Invalida la query del borrador al terminar.
 */
export function useSaveDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: SaveDraftPayload): Promise<FormDraft> => {
      const { data } = await api.put<FormDraft>("/api/borradores", body)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["draft", variables.tipo, variables.solicitud_id ?? ""],
      })
    },
  })
}

// ── useDeleteDraft ────────────────────────────────────────────────────────────

export interface DeleteDraftParams {
  tipo: TipoBorrador
  solicitudId?: string
}

/**
 * Elimina el borrador de un tipo (y solicitud opcional). Invalida toda la familia ["draft"].
 */
export function useDeleteDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tipo, solicitudId }: DeleteDraftParams): Promise<void> => {
      const params = new URLSearchParams()
      params.set("tipo", tipo)
      if (solicitudId) params.set("solicitud_id", solicitudId)
      await api.delete(`/api/borradores?${params}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["draft"] })
    },
  })
}

// ── useUploadDraftFile ────────────────────────────────────────────────────────

export interface UploadDraftFileParams {
  tipo: TipoBorrador
  archivo: File
  solicitudId?: string
}

/**
 * Sube un archivo asociado a un borrador. Invalida toda la familia ["draft"] al terminar.
 */
export function useUploadDraftFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tipo, archivo, solicitudId }: UploadDraftFileParams): Promise<ArchivoRef> => {
      const formData = new FormData()
      formData.append("tipo", tipo)
      formData.append("archivo", archivo)
      if (solicitudId) formData.append("solicitud_id", solicitudId)
      const { data } = await api.post<ArchivoRef>("/api/borradores/archivo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["draft"] })
    },
  })
}

// ── useAutosaveDraft ──────────────────────────────────────────────────────────

const AUTOSAVE_DEBOUNCE_MS = 1500

/**
 * Autosave con debounce de 1500 ms. Llama a useSaveDraft internamente.
 * Solo guarda si `enabled !== false` y `formData` no es null/undefined.
 *
 * @returns `{ isSaving }` — true mientras la mutación está en vuelo
 */
export function useAutosaveDraft(
  tipo: TipoBorrador | undefined,
  solicitudId: string | undefined,
  formData: Record<string, unknown> | null | undefined,
  enabled?: boolean
) {
  const { mutate: saveDraft, isPending } = useSaveDraft()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    // Sincronizar isSaving con el estado real de la mutación
    setIsSaving(isPending)
  }, [isPending])

  useEffect(() => {
    if (enabled === false || !tipo || formData == null) return

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      setIsSaving(true)
      saveDraft(
        {
          tipo,
          solicitud_id: solicitudId,
          payload: formData,
        },
        {
          onSettled: () => setIsSaving(false),
        }
      )
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [tipo, solicitudId, formData, enabled, saveDraft])

  return { isSaving }
}

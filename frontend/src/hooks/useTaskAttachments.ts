import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { TaskAttachment } from "@/types/workTask"

export type { TaskAttachment }

const BASE = "/api/herramientas/tareas"

export function useTaskAttachments(taskId: number | null) {
  return useQuery<TaskAttachment[]>({
    queryKey: ["tareas", "adjuntos", taskId],
    queryFn: async () => {
      if (taskId === null) return []
      const { data } = await api.get<TaskAttachment[]>(`${BASE}/${taskId}/adjuntos`)
      return data
    },
    enabled: taskId !== null,
  })
}

export function useUploadTaskAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: number; file: File }) => {
      const formData = new FormData()
      formData.append("file", file)
      const { data } = await api.post<{ ok: boolean; attachment: TaskAttachment }>(
        `${BASE}/${taskId}/adjuntos`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      return data.attachment
    },
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: ["tareas", "adjuntos", taskId] })
    },
  })
}

export function useDeleteTaskAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId: _taskId, attachmentId }: { taskId: number; attachmentId: number }) => {
      await api.delete(`${BASE}/adjuntos/${attachmentId}`)
    },
    onSuccess: (_data, { taskId: deletedTaskId }) => {
      qc.invalidateQueries({ queryKey: ["tareas", "adjuntos", deletedTaskId] })
    },
  })
}

export function getAttachmentUrl(attachmentId: number): string {
  return `${BASE}/adjuntos/${attachmentId}`
}

/**
 * Fetches an attachment as a blob via the authenticated API client and returns
 * a stable object URL. Cleans up on unmount or when attachmentId changes.
 * Fixes "token inválido" when using <img src> or <iframe src> directly
 * (browsers don't send Authorization headers on those requests).
 */
export function useAttachmentBlobUrl(attachmentId: number | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (attachmentId === null) {
      setBlobUrl(null)
      setLoading(false)
      setError(false)
      return
    }

    let objectUrl: string | null = null
    const controller = new AbortController()

    setLoading(true)
    setError(false)
    setBlobUrl(null)

    api
      .get(getAttachmentUrl(attachmentId), {
        responseType: "blob",
        signal: controller.signal,
      })
      .then(({ data }) => {
        objectUrl = URL.createObjectURL(data as Blob)
        setBlobUrl(objectUrl)
        setLoading(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachmentId])

  return { blobUrl, loading, error }
}
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface TaskAttachment {
  id: number
  task_id: number
  filename: string
  mime_type: string
  size_bytes: number
  uploaded_by_id: number
  uploaded_at: string
}

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
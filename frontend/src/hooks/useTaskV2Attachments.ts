import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { taskApi } from "@/lib/taskApi"
import type { TaskAttachment } from "@/types/task"

export function useTaskV2Attachments(taskId: number | null) {
  return useQuery<TaskAttachment[]>({
    queryKey: ["taskV2Attachments", taskId],
    queryFn: async () => {
      const { data } = await taskApi.get<TaskAttachment[]>(`/api/tasks/${taskId}/attachments`)
      return data
    },
    enabled: taskId !== null,
  })
}

export function useUploadTaskV2Attachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: number; file: File }) => {
      const formData = new FormData()
      formData.append("file", file)
      const { data } = await taskApi.post<TaskAttachment>(
        `/api/tasks/${taskId}/attachments`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
      return data
    },
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: ["taskV2Attachments", taskId] })
    },
  })
}

export function useDeleteTaskV2Attachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, attachmentId }: { taskId: number; attachmentId: number }) => {
      await taskApi.delete(`/api/attachments/${attachmentId}`)
    },
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: ["taskV2Attachments", taskId] })
    },
  })
}

export function getTaskV2AttachmentUrl(attachmentId: number): string {
  return `/api/attachments/${attachmentId}/download`
}

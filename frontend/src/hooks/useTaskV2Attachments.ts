import { useState, useEffect } from "react"
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
    mutationFn: async ({ attachmentId }: { taskId: number; attachmentId: number }) => {
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

export function useAttachmentV2BlobUrl(attachmentId: number | null) {
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

    taskApi
      .get(getTaskV2AttachmentUrl(attachmentId), {
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

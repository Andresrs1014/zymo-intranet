import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { TaskAttachment } from "@/types/workTask"
import { getAttachmentUrl } from "@/hooks/useTaskAttachments"
import { useDeleteTaskAttachment } from "@/hooks/useTaskAttachments"

interface AttachmentListProps {
  taskId: number
  attachments: TaskAttachment[]
  onPreview: (attachment: TaskAttachment) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📄"
  if (mimeType.startsWith("image/")) return "🖼️"
  return "📎"
}

export function AttachmentList({ taskId, attachments, onPreview }: AttachmentListProps) {
  const deleteMutation = useDeleteTaskAttachment()
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const handleDelete = async (attachmentId: number) => {
    try {
      await deleteMutation.mutateAsync({ taskId, attachmentId })
    } catch (err) {
      console.error("Error deleting attachment:", err)
    } finally {
      setConfirmDeleteId(null)
    }
  }

  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 mt-4">
      <p className="text-sm font-medium text-gray-700">Archivos adjuntos:</p>
      <div className="space-y-1">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-200"
          >
            <button
              type="button"
              onClick={() => onPreview(attachment)}
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 hover:underline"
            >
              <span>{getFileIcon(attachment.mime_type)}</span>
              <span className="max-w-[200px] truncate">{attachment.filename}</span>
              <span className="text-xs text-gray-400">
                ({formatFileSize(attachment.size_bytes)})
              </span>
            </button>

            {confirmDeleteId === attachment.id ? (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">¿Eliminar?</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(attachment.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-600 hover:text-red-800 h-6 px-2"
                >
                  Sí
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDeleteId(null)}
                  className="text-gray-500 h-6 px-2"
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteId(attachment.id)}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

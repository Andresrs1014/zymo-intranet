import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { TaskAttachment } from "@/types/task"
import {
  useTaskV2Attachments,
  useUploadTaskV2Attachment,
  useDeleteTaskV2Attachment,
  useAttachmentV2BlobUrl,
} from "@/hooks/useTaskV2Attachments"

interface Props {
  taskId: number
  taskTitulo: string
  open: boolean
  onClose: () => void
}

function fileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️"
  if (mimeType === "application/pdf") return "📄"
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊"
  if (mimeType.includes("wordprocessing") || mimeType.includes("word")) return "📝"
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📊"
  if (mimeType.startsWith("text/")) return "📃"
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) return "🗜️"
  if (mimeType.includes("mail") || mimeType.includes("message")) return "✉️"
  return "📎"
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentPreview({ attachment }: { attachment: TaskAttachment }) {
  const { blobUrl, loading, error } = useAttachmentV2BlobUrl(attachment.id)
  const isImage = attachment.mimeType.startsWith("image/")
  const isPdf = attachment.mimeType === "application/pdf"

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Cargando previsualización...
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-red-500">
        Error al cargar el archivo.
      </div>
    )
  }
  if (!blobUrl) return null

  if (isImage) {
    return (
      <img
        src={blobUrl}
        alt={attachment.filename}
        className="max-w-full max-h-full object-contain"
      />
    )
  }
  if (isPdf) {
    return (
      <iframe
        src={blobUrl}
        className="w-full h-full border-0"
        title={attachment.filename}
      />
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
      <span className="text-5xl">{fileIcon(attachment.mimeType)}</span>
      <div className="text-center">
        <p className="font-medium text-gray-900">{attachment.filename}</p>
        <p className="text-sm text-gray-500 mt-0.5">{formatBytes(attachment.sizeBytes)}</p>
      </div>
      <a
        href={blobUrl}
        download={attachment.filename}
        className="text-sm text-blue-600 hover:underline mt-1"
      >
        Descargar archivo
      </a>
    </div>
  )
}

export function AttachmentExplorerV2({ taskId, taskTitulo, open, onClose }: Props) {
  const { data: attachments = [] } = useTaskV2Attachments(open ? taskId : null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const upload = useUploadTaskV2Attachment()
  const deleteMutation = useDeleteTaskV2Attachment()

  const selected = attachments.find((a) => a.id === selectedId) ?? attachments[0] ?? null

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setUploadError(null)

    const oversized = files.find((f) => f.size > 20 * 1024 * 1024)
    if (oversized) {
      setUploadError(`"${oversized.name}" supera el límite de 20 MB.`)
      e.target.value = ""
      return
    }

    for (const file of files) {
      await upload.mutateAsync({ taskId, file })
    }
    e.target.value = ""
  }

  const handleDelete = async (attachment: TaskAttachment) => {
    await deleteMutation.mutateAsync({ taskId, attachmentId: attachment.id })
    setConfirmDeleteId(null)
    if (selectedId === attachment.id) setSelectedId(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 shrink-0 pr-12">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
            Archivos adjuntos
          </p>
          <h2 className="text-sm font-semibold text-gray-900 truncate">{taskTitulo}</h2>
        </div>

        {/* Two-panel body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: file list */}
          <div className="w-56 shrink-0 border-r border-gray-100 flex flex-col bg-gray-50/60">
            <div className="flex-1 overflow-y-auto py-1">
              {attachments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-10 px-4">
                  Sin archivos adjuntos.
                </p>
              )}
              {attachments.map((a) => (
                <div
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={[
                    "group flex items-start gap-2 px-3 py-2 cursor-pointer text-xs transition-colors",
                    selected?.id === a.id
                      ? "bg-blue-50 text-blue-800 border-r-2 border-blue-400"
                      : "hover:bg-white text-gray-700",
                  ].join(" ")}
                >
                  <span className="text-base shrink-0 leading-none mt-0.5">
                    {fileIcon(a.mimeType)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-snug">{a.filename}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatBytes(a.sizeBytes)}</p>
                  </div>
                  {/* Inline delete confirm */}
                  {confirmDeleteId === a.id ? (
                    <div className="flex gap-1 shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 font-semibold hover:text-red-800"
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(a.id) }}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity shrink-0 leading-none"
                      aria-label="Eliminar archivo"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Upload area */}
            <div className="border-t border-gray-100 p-2 shrink-0 space-y-1">
              {uploadError && (
                <p className="text-[10px] text-red-600 px-1">{uploadError}</p>
              )}
              <label className={[
                "flex items-center justify-center gap-1.5 w-full rounded-md border border-dashed py-2 text-xs cursor-pointer transition-colors",
                upload.isPending
                  ? "border-gray-200 text-gray-300 cursor-not-allowed"
                  : "border-gray-300 text-gray-500 hover:bg-white hover:text-gray-700",
              ].join(" ")}>
                <span>{upload.isPending ? "Subiendo..." : "+ Subir archivo"}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                  disabled={upload.isPending}
                />
              </label>
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex-1 overflow-auto bg-white flex items-center justify-center min-h-[300px]">
            {selected ? (
              <AttachmentPreview key={selected.id} attachment={selected} />
            ) : (
              <p className="text-sm text-gray-400">
                Selecciona un archivo para previsualizarlo.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

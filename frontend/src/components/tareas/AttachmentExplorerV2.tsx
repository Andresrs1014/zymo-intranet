import { useState, useRef, useCallback } from "react"
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

const LIST_MIN = 160
const LIST_MAX = 420
const LIST_DEFAULT = 240

export function fileIcon(mimeType: string): string {
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

export function formatBytes(bytes: number): string {
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
      <div className="flex items-center justify-center h-full text-sm text-zinc-500">
        Cargando previsualización...
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[#ff6b75]">
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
        <p className="font-medium text-zinc-100">{attachment.filename}</p>
        <p className="text-sm text-zinc-500 mt-0.5">{formatBytes(attachment.sizeBytes)}</p>
      </div>
      <a
        href={blobUrl}
        download={attachment.filename}
        className="text-sm text-[#ff6b75] hover:underline mt-1"
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
  const [listWidth, setListWidth] = useState(LIST_DEFAULT)

  const upload = useUploadTaskV2Attachment()
  const deleteMutation = useDeleteTaskV2Attachment()

  const selected = attachments.find((a) => a.id === selectedId) ?? attachments[0] ?? null

  // ── Drag-to-resize ──────────────────────────────────────────────────────────
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(LIST_DEFAULT)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = listWidth

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = ev.clientX - startX.current
      setListWidth(Math.min(LIST_MAX, Math.max(LIST_MIN, startWidth.current + delta)))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    e.preventDefault()
  }, [listWidth])

  // ── Handlers ────────────────────────────────────────────────────────────────
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
      <DialogContent className="max-w-6xl w-[92vw] max-h-[90vh] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden bg-[#1b2029] text-zinc-100 border border-white/10">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 shrink-0 pr-12">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">
            Archivos adjuntos
          </p>
          <h2 className="text-sm font-semibold text-zinc-100 truncate">{taskTitulo}</h2>
        </div>

        {/* Two-panel body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: file list */}
          <div
            className="shrink-0 border-r border-white/10 flex flex-col bg-white/[.03]"
            style={{ width: listWidth }}
          >
            <div className="flex-1 overflow-y-auto py-1">
              {attachments.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-10 px-4">
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
                      ? "bg-[#ef3340]/15 text-[#ff6b75] border-r-2 border-[#ef3340]"
                      : "hover:bg-white/5 text-zinc-300",
                  ].join(" ")}
                >
                  <span className="text-base shrink-0 leading-none mt-0.5">
                    {fileIcon(a.mimeType)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-snug">{a.filename}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{formatBytes(a.sizeBytes)}</p>
                  </div>
                  {confirmDeleteId === a.id ? (
                    <div className="flex gap-1 shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        disabled={deleteMutation.isPending}
                        className="text-[#ff6b75] font-semibold hover:text-[#ef3340]"
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(a.id) }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-[#ff6b75] transition-opacity shrink-0 leading-none"
                      aria-label="Eliminar archivo"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Upload area */}
            <div className="border-t border-white/10 p-2 shrink-0 space-y-1">
              {uploadError && (
                <p className="text-[10px] text-[#ff6b75] px-1">{uploadError}</p>
              )}
              <label className={[
                "flex items-center justify-center gap-1.5 w-full rounded-md border border-dashed py-2 text-xs cursor-pointer transition-colors",
                upload.isPending
                  ? "border-white/10 text-zinc-600 cursor-not-allowed"
                  : "border-white/15 text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
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

          {/* Drag handle */}
          <div
            onMouseDown={onMouseDown}
            className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-[#ef3340]/30 active:bg-[#ef3340]/60 transition-colors"
            title="Arrastra para ajustar el tamaño"
          />

          {/* Right: preview */}
          <div className="flex-1 overflow-auto bg-[#12151c] flex items-center justify-center">
            {selected ? (
              <AttachmentPreview key={selected.id} attachment={selected} />
            ) : (
              <p className="text-sm text-zinc-500">
                Selecciona un archivo para previsualizarlo.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

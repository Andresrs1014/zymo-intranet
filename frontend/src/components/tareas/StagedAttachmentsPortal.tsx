import { useEffect, useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { fileIcon, formatBytes } from "./AttachmentExplorerV2"

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

interface Props {
  files: File[]
  onChange: (files: File[]) => void
  /** Título mostrado en el header del visor (tarea, ticket, etc. — cualquier contexto). */
  title: string
  open: boolean
  onClose: () => void
}

function StagedPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objUrl = URL.createObjectURL(file)
    setUrl(objUrl)
    return () => URL.revokeObjectURL(objUrl)
  }, [file])

  if (!url) return null

  if (file.type.startsWith("image/")) {
    return <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />
  }
  if (file.type === "application/pdf") {
    return <iframe src={url} className="w-full h-full border-0" title={file.name} />
  }
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
      <span className="text-5xl">{fileIcon(file.type)}</span>
      <div className="text-center">
        <p className="font-medium text-zinc-900">{file.name}</p>
        <p className="text-sm text-zinc-500 mt-0.5">{formatBytes(file.size)}</p>
      </div>
    </div>
  )
}

export function StagedAttachmentsPortal({ files, onChange, title, open, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const selected = files[selectedIndex] ?? null

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    setError(null)

    const oversized = picked.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (oversized) {
      setError(`"${oversized.name}" supera el límite de 20 MB.`)
      e.target.value = ""
      return
    }

    onChange([...files, ...picked])
    e.target.value = ""
  }

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
    setSelectedIndex((prev) => (prev >= index ? Math.max(0, prev - 1) : prev))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl w-[92vw] max-h-[90vh] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden bg-white text-zinc-900 border border-zinc-200">
        <div className="px-4 py-3 border-b border-zinc-200 shrink-0 pr-12">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">
            Archivos adjuntos (se suben al crear la tarea)
          </p>
          <h2 className="text-sm font-semibold text-zinc-900 truncate">{title}</h2>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="w-[240px] shrink-0 border-r border-zinc-200 flex flex-col bg-zinc-50">
            <div className="flex-1 overflow-y-auto py-1">
              {files.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-10 px-4">
                  Sin archivos adjuntos todavía.
                </p>
              )}
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  onClick={() => setSelectedIndex(i)}
                  className={[
                    "group flex items-start gap-2 px-3 py-2 cursor-pointer text-xs transition-colors",
                    selectedIndex === i
                      ? "bg-primary/10 text-primary border-r-2 border-primary"
                      : "hover:bg-zinc-100 text-zinc-700",
                  ].join(" ")}
                >
                  <span className="text-base shrink-0 leading-none mt-0.5">{fileIcon(file.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-snug">{file.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemove(i) }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-primary transition-opacity shrink-0 leading-none"
                    aria-label={`Quitar ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-200 p-2 shrink-0 space-y-1">
              {error && <p className="text-[10px] text-red-600 px-1">{error}</p>}
              <label className="flex items-center justify-center gap-1.5 w-full rounded-md border border-dashed border-zinc-300 py-2 text-xs cursor-pointer text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
                <span>+ Subir archivo</span>
                <input type="file" multiple className="hidden" onChange={handleFileInput} />
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-zinc-50 flex items-center justify-center">
            {selected ? (
              <StagedPreview key={`${selected.name}-${selectedIndex}`} file={selected} />
            ) : (
              <p className="text-sm text-zinc-500">Selecciona un archivo para previsualizarlo.</p>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-200 px-4 py-3 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-95"
          >
            Aceptar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

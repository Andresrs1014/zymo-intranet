import { useEffect } from "react"
import { X } from "lucide-react"
import { ArchivoPrevisualizador } from "./ArchivoPrevisualizador"

/** Ventana emergente con el documento original (cualquier tipo). `base` = ruta del recurso, p. ej. «/api/commits/12». */
export function VisorArchivoDialog({ base, nombre, mime, onClose }: {
  base: string
  nombre: string
  mime?: string | null
  onClose: () => void
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Vista de ${nombre}`}>
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-zinc-300 px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-800">{nombre}</p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-zinc-600 hover:bg-zinc-200">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <ArchivoPrevisualizador base={base} nombre={nombre} mime={mime} altura="75vh" />
        </div>
      </div>
    </div>
  )
}

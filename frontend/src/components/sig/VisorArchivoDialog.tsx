import { useEffect } from "react"
import { createPortal } from "react-dom"
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

  // portal al body: si no, un ancestro con transform/animación encierra el «fixed» dentro de su tarjeta
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={`Vista de ${nombre}`}>
      <div className="flex shrink-0 items-center gap-3 px-5 py-3">
        <p className="min-w-0 flex-1 truncate font-mono text-sm text-white">{nombre}</p>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1.5 text-white/80 hover:bg-white/15 hover:text-white">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-5 pb-5">
        <ArchivoPrevisualizador base={base} nombre={nombre} mime={mime} altura="calc(100vh - 5.5rem)" />
      </div>
    </div>,
    document.body,
  )
}

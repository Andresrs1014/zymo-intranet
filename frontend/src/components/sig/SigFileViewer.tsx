import { useEffect, useRef, type ReactNode } from "react"

/**
 * Marco de previsualización de archivos del SIG — mismo criterio que la vista
 * previa del PDF de cotización en gestion_comercial: ocupa TODO el ancho y el
 * alto disponible, con borde redondeado y fondo neutro, sin columnas angostas.
 */
export function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 h-full min-h-0 flex flex-col p-3 bg-zinc-100">
      <div className="flex-1 min-h-[480px] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
        {children}
      </div>
    </div>
  )
}

export function PdfFrame({ src, title }: { src: string; title: string }) {
  return (
    <PreviewFrame>
      <iframe src={src} title={title} className="h-full w-full border-0 bg-zinc-100" />
    </PreviewFrame>
  )
}

/**
 * Renderiza un .docx con docx-preview y escala las páginas al ancho del panel
 * (fit-to-width), centradas sobre fondo gris con sombra — igual que un visor
 * de PDF. Sin esto las páginas quedaban pegadas a la izquierda a 794px fijos.
 */
export function DocxViewer({ data, onError }: { data: ArrayBuffer; onError: (msg: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scroll = scrollRef.current
    const host = hostRef.current
    if (!scroll || !host) return
    let cancelled = false

    const fit = () => {
      const page = host.querySelector<HTMLElement>("section.docx-render")
      if (!page) return
      host.style.zoom = "1"
      const pageWidth = page.offsetWidth
      if (!pageWidth) return
      const available = scroll.clientWidth - 32
      host.style.zoom = String(Math.min(Math.max(available / pageWidth, 0.4), 1.6))
    }

    const ro = new ResizeObserver(fit)
    ro.observe(scroll)

    import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(data, host, undefined, {
          className: "docx-render",
          inWrapper: true,
          ignoreWidth: false,
        }),
      )
      .then(() => { if (!cancelled) fit() })
      .catch(() => { if (!cancelled) onError("No se pudo renderizar el documento Word.") })

    return () => {
      cancelled = true
      ro.disconnect()
      host.innerHTML = ""
    }
  }, [data, onError])

  return (
    <PreviewFrame>
      <div ref={scrollRef} className="h-full w-full overflow-auto">
        <div ref={hostRef} className="sig-docx-host" />
      </div>
    </PreviewFrame>
  )
}

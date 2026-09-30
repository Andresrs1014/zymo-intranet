import { useEffect, useRef, useState, type ReactNode } from "react"
import { sigApi } from "@/lib/sigApi"

/**
 * Marco de previsualización de archivos del SIG — mismo criterio que la vista
 * previa del PDF de cotización en gestion_comercial: ocupa TODO el ancho y el
 * alto disponible, con borde redondeado y fondo neutro, sin columnas angostas.
 */
export function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 h-full min-h-0 flex flex-col p-3 bg-zinc-100">
      <div className="mx-auto w-full max-w-[1100px] flex-1 min-h-[480px] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
        {children}
      </div>
    </div>
  )
}

export function PdfFrame({ src, title }: { src: string; title: string }) {
  return (
    <PreviewFrame>
      {/* #view=FitH: el visor nativo del PDF ajusta la página al ancho del marco */}
      <iframe src={`${src}#view=FitH`} title={title} className="h-full w-full border-0 bg-zinc-100" />
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

/**
 * Word: el servidor lo convierte a PDF con LibreOffice y se muestra en el visor
 * nativo de PDF (paginación y tablas idénticas a Word, sin redibujar nada).
 * Si la conversión falla, cae al render en el navegador con docx-preview.
 */
export function WordPreview({
  pdfPath, docxData, title, onError,
}: { pdfPath: string; docxData: ArrayBuffer; title: string; onError: (msg: string) => void }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "pdf"; url: string } | { status: "fallback" }>({ status: "loading" })

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    setState({ status: "loading" })
    sigApi.get(pdfPath, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return
        url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
        setState({ status: "pdf", url })
      })
      .catch(() => { if (!cancelled) setState({ status: "fallback" }) })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [pdfPath])

  if (state.status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-zinc-400">
        <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-600 animate-spin" />
        <span className="text-xs font-mono">Preparando vista previa…</span>
      </div>
    )
  }
  if (state.status === "pdf") return <PdfFrame src={state.url} title={title} />
  return <DocxViewer data={docxData} onError={onError} />
}

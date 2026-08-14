import { useEffect, useId, useState } from "react"
import mermaid from "mermaid"

let mermaidInitialized = false
function ensureMermaidInit() {
  if (mermaidInitialized) return
  // htmlLabels:false -- el texto de los nodos se dibuja como <text>/<tspan> nativo del SVG
  // en vez de <foreignObject> con HTML embebido. El PDF de análisis captura este mismo SVG
  // y lo pasa a WeasyPrint, que no soporta foreignObject: con html labels el diagrama salía
  // con las formas correctas pero sin ningún texto adentro.
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "strict",
    flowchart: { htmlLabels: false },
  })
  mermaidInitialized = true
}

// Ancho/alto útil de una página A4 del PDF (ver template_sig_analisis.html: @page
// margin 1.2/1.6cm y el tope de 230mm ya usado para el flujograma). Un diagrama cuya
// proporción sea más alta que esto, escalado a ancho completo de página, no entra en
// una sola hoja -- forzarlo a caber ahí es lo que lo dejaba diminuto e ilegible.
const PDF_PAGE_W_MM = 178
const PDF_PAGE_H_MM = 230

/**
 * Rasteriza un <svg> ya renderizado a una o más "tiras" PNG (data URL) -- WeasyPrint
 * (motor del PDF de análisis) no soporta el bloque <style> con clases CSS que Mermaid
 * embebe en el SVG exportado, así que los <text> quedan sin color y el diagrama sale
 * vacío. El navegador sí renderiza el SVG completo, así que se convierte a imagen acá
 * y el PDF solo recibe <img> -- evita depender del soporte SVG/CSS de WeasyPrint.
 *
 * Si el diagrama es más alto de lo que cabe legible en una página (a ancho completo),
 * se corta en varias tiras horizontales -- cada una es una página del PDF a tamaño
 * legible, en vez de una sola página con todo encogido hasta ser ilegible.
 */
export async function svgToPngSlices(svg: SVGSVGElement, maxDimension = 1600): Promise<string[]> {
  const bbox = svg.getBBox()
  const width = svg.viewBox.baseVal.width || bbox.width || svg.clientWidth || 800
  const height = svg.viewBox.baseVal.height || bbox.height || svg.clientHeight || 400

  // Escala acotada por maxDimension en vez de un factor fijo -- diagramas grandes no
  // ganan nitidez rasterizando a x3 (canvases de decenas de millones de px trababan el
  // navegador y engordaban el PDF). Diagramas chicos siguen saliendo nítidos (hasta x3).
  const scale = Math.min(3, maxDimension / Math.max(width, height))

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))

  const svgString = new XMLSerializer().serializeToString(clone)
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error("No se pudo rasterizar el flujograma."))
    img.src = dataUrl
  })

  const fullCanvas = document.createElement("canvas")
  fullCanvas.width = Math.round(width * scale)
  fullCanvas.height = Math.round(height * scale)
  const fullCtx = fullCanvas.getContext("2d")
  if (!fullCtx) throw new Error("No se pudo crear el canvas de rasterizado.")
  fullCtx.fillStyle = "#ffffff"
  fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height)
  fullCtx.scale(scale, scale)
  fullCtx.drawImage(img, 0, 0, width, height)

  // Altura de una tira, en px del canvas, tal que al escalarla a ancho completo de
  // pagina (PDF_PAGE_W_MM) quepa en la altura util de una pagina (PDF_PAGE_H_MM).
  const sliceHeightPx = Math.max(1, Math.round((fullCanvas.width * PDF_PAGE_H_MM) / PDF_PAGE_W_MM))
  const numSlices = Math.max(1, Math.ceil(fullCanvas.height / sliceHeightPx))

  const slices: string[] = []
  for (let i = 0; i < numSlices; i++) {
    const sliceStart = i * sliceHeightPx
    const sliceH = Math.min(sliceHeightPx, fullCanvas.height - sliceStart)
    const sliceCanvas = document.createElement("canvas")
    sliceCanvas.width = fullCanvas.width
    sliceCanvas.height = sliceH
    const sctx = sliceCanvas.getContext("2d")
    if (!sctx) throw new Error("No se pudo crear el canvas de rasterizado.")
    sctx.drawImage(fullCanvas, 0, sliceStart, fullCanvas.width, sliceH, 0, 0, fullCanvas.width, sliceH)
    slices.push(sliceCanvas.toDataURL("image/png"))
  }
  return slices
}

/** Renderiza un bloque ```mermaid del markdown como diagrama SVG real. */
export function MermaidDiagram({ code }: { code: string }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "")
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ensureMermaidInit()
    mermaid.render(`mermaid-${rawId}`, code)
      .then(({ svg }) => { if (!cancelled) { setSvg(svg); setError(null) } })
      .catch((err) => { if (!cancelled) setError(err?.message ?? "No se pudo renderizar el diagrama.") })
    return () => { cancelled = true }
  }, [code, rawId])

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-600 my-3">
        <p className="font-semibold mb-1">Diagrama mermaid inválido</p>
        <pre className="whitespace-pre-wrap text-[11px] opacity-80">{code}</pre>
      </div>
    )
  }
  if (!svg) {
    return <div className="text-xs text-zinc-400 italic py-3">Renderizando diagrama…</div>
  }
  return <div className="my-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}

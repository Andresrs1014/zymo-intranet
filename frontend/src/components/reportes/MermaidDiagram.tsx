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

// Ancho útil de una página A4 del PDF (ver template_sig_analisis.html: @page margin
// 1.2/1.6cm => 210mm - 3.2cm = 178mm). El flujograma siempre se muestra a este ancho
// completo, así que se rasteriza apuntando a ESE ancho en px -- no a la dimensión más
// grande del diagrama, que es lo que lo dejaba borroso en diagramas altos (la escala
// terminaba fijada por la altura, dejando el ancho real muy por debajo de lo nítido).
const PDF_PAGE_W_MM = 178
// ~170dpi a 178mm de ancho -- de sobra para verse nitido en PDF/pantalla, sin ser
// una resolucion de impresion profesional que no hace falta acá.
const TARGET_WIDTH_PX = 1200
// Tope duro de píxeles totales: el ancho ya está acotado arriba, pero un diagrama
// muy ALTO (muchos pasos) igual podía generar un canvas de decenas de millones de
// píxeles porque el alto no tenía límite -- eso era lo que trababa el navegador al
// rasterizar/codificar el PNG y lo que hacía lenta la descarga. Si el diagrama es
// tan alto que se pasa del presupuesto, se reduce la escala un poco más (menos
// nítido en ese caso extremo, pero sigue siendo una sola página completa y legible).
const MAX_TOTAL_PX = 9_000_000

export interface FlujogramaRaster {
  dataUrl: string
  /** Alto en mm que debe tener LA PÁGINA del PDF para que quepa este diagrama entero,
   * a ancho completo de página, sin cortarlo ni encogerlo. Ver @page nombrada en el
   * backend (template_sig_analisis.html) -- la página del flujograma no usa el tamaño
   * A4 fijo del resto del documento, se dimensiona a la medida de cada diagrama. */
  altoPaginaMm: number
}

/**
 * Rasteriza un <svg> ya renderizado a PNG (data URL) -- WeasyPrint (motor del PDF de
 * análisis) no soporta el bloque <style> con clases CSS que Mermaid embebe en el SVG
 * exportado, así que los <text> quedan sin color y el diagrama sale vacío. El navegador
 * sí renderiza el SVG completo, así que se convierte a imagen acá y el PDF solo recibe
 * un <img> -- evita depender del soporte SVG/CSS de WeasyPrint por completo.
 *
 * No se encoge para caber en una página A4 fija: en cambio devuelve el alto que la
 * PÁGINA debe tener para que el diagrama quepa entero y nítido (ver altoPaginaMm) --
 * intentar recortarlo o achicarlo para forzarlo en 230mm es lo que lo dejaba
 * ilegible (o, cortado en tiras, borroso y lento).
 */
export async function svgToPngDataUrl(svg: SVGSVGElement): Promise<FlujogramaRaster> {
  const bbox = svg.getBBox()
  const width = svg.viewBox.baseVal.width || bbox.width || svg.clientWidth || 800
  const height = svg.viewBox.baseVal.height || bbox.height || svg.clientHeight || 400

  let scale = TARGET_WIDTH_PX / width
  const estimatedTotalPx = width * scale * (height * scale)
  if (estimatedTotalPx > MAX_TOTAL_PX) {
    scale *= Math.sqrt(MAX_TOTAL_PX / estimatedTotalPx)
  }

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

  const canvas = document.createElement("canvas")
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo crear el canvas de rasterizado.")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)

  // Alto de página proporcional al ancho fijo de 178mm, con un piso para que la
  // página no quede más baja que el título "Flujograma" + margenes.
  const altoPaginaMm = Math.max(120, Math.round((PDF_PAGE_W_MM * canvas.height) / canvas.width))

  return { dataUrl: canvas.toDataURL("image/png"), altoPaginaMm }
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

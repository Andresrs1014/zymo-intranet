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

/**
 * Rasteriza un <svg> ya renderizado a PNG (data URL) -- WeasyPrint (motor del PDF de
 * análisis) no soporta el bloque <style> con clases CSS que Mermaid embebe en el SVG
 * exportado, así que los <text> quedan sin color y el diagrama sale vacío. El navegador
 * sí renderiza el SVG completo, así que se convierte a imagen acá y el PDF solo recibe
 * un <img> -- evita depender del soporte SVG/CSS de WeasyPrint por completo.
 */
export async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<string> {
  const bbox = svg.getBBox()
  const width = svg.viewBox.baseVal.width || bbox.width || svg.clientWidth || 800
  const height = svg.viewBox.baseVal.height || bbox.height || svg.clientHeight || 400

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
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo crear el canvas de rasterizado.")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)

  return canvas.toDataURL("image/png")
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

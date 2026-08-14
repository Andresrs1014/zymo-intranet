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

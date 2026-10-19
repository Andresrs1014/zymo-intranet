import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { ESTILO_TIPO, extensionDe, type DocAuditoria, type TipoDoc } from "./tipos"

interface Grupo { tipo: Exclude<TipoDoc, "procedimiento">; docs: DocAuditoria[] }

/** Barra lateral oscura: el procedimiento y, en secciones desplegables, todo lo que tiene referenciado. */
export function ListaDocumentos({ procedimiento, grupos, seleccion, procAbierto, onProcedimiento, onElegir }: {
  procedimiento: DocAuditoria | null
  grupos: Grupo[]
  /** Clave del documento abierto junto al procedimiento (o solo). */
  seleccion: string | null
  /** El procedimiento está en pantalla (modo Procedimiento o Dividida). */
  procAbierto: boolean
  onProcedimiento: () => void
  onElegir: (d: DocAuditoria) => void
}) {
  const [cerradas, setCerradas] = useState<Set<string>>(new Set())
  const alternar = (k: string) => setCerradas((s) => { const n = new Set(s); if (!n.delete(k)) n.add(k); return n })
  const total = grupos.reduce((n, g) => n + g.docs.length, 0)

  return (
    <nav aria-labelledby="aud-lista-titulo" className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-zinc-900/80 shadow-[0_28px_56px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur">
      <div className="flex shrink-0 items-baseline justify-between border-b border-white/10 px-4 py-3">
        <h2 id="aud-lista-titulo" className="text-sm font-semibold text-white">Documentos</h2>
        <span className="text-xs text-zinc-400">{total} referenciados</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2.5">
        {procedimiento && <Fila doc={procedimiento} activo={procAbierto} onClick={onProcedimiento} />}
        {grupos.map(({ tipo, docs }) => {
          const vacio = docs.length === 0
          const abierta = !vacio && !cerradas.has(tipo)
          const t = ESTILO_TIPO[tipo]
          const Icono = t.icono
          return (
            <div key={tipo} className="pt-1.5">
              <button
                type="button"
                onClick={() => !vacio && alternar(tipo)}
                aria-expanded={abierta}
                aria-controls={`aud-${tipo}`}
                aria-disabled={vacio || undefined}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white",
                  vacio ? "cursor-default opacity-50" : "hover:bg-white/5",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10"><Icono className={`h-3.5 w-3.5 ${t.color}`} aria-hidden /></span>
                <span className="flex-1 text-[13px] font-semibold text-zinc-100">{t.plural}</span>
                <span className="min-w-6 rounded-full bg-white/10 px-2 py-0.5 text-center text-xs text-zinc-300">{docs.length}</span>
                {!vacio && <ChevronDown className={cn("h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none", !abierta && "-rotate-90")} aria-hidden />}
              </button>
              <ul id={`aud-${tipo}`} hidden={!abierta} className="ml-[18px] mt-0.5 space-y-0.5 border-l border-white/10 pl-2.5">
                {docs.map((d) => (
                  <li key={d.clave}><Fila doc={d} activo={d.clave === seleccion} onClick={() => onElegir(d)} /></li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </nav>
  )
}

function Fila({ doc, activo, onClick }: { doc: DocAuditoria; activo: boolean; onClick: () => void }) {
  const t = ESTILO_TIPO[doc.tipo]
  const ext = doc.tipo === "procedimiento" ? null : extensionDe(doc.nombreArchivo)
  const Icono = t.icono
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? "true" : undefined}
      className={cn(
        "relative flex min-h-11 w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white",
        activo ? "bg-white/10" : "hover:bg-white/5",
      )}
    >
      {activo && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-helix-accent" aria-hidden />}
      <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${t.color}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[13px] leading-snug", activo ? "font-semibold text-white" : "text-zinc-200")}>{doc.titulo}</span>
        {doc.codigo && <span className="mt-0.5 block font-mono text-[11px] text-zinc-400">{doc.codigo}</span>}
        {doc.estado && (
          <span className={cn("mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] ring-1 ring-inset", doc.estado === "RECHAZADO" ? "bg-red-500/15 text-red-300 ring-red-400/30" : "bg-amber-500/15 text-amber-300 ring-amber-400/30")}>
            {doc.estado === "RECHAZADO" ? "Rechazado" : "Pendiente de aprobación"}
          </span>
        )}
      </span>
      {ext && <span className="mt-0.5 shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-300">{ext}</span>}
    </button>
  )
}

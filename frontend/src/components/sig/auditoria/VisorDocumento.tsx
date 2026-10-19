import type { CSSProperties } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Download, FileQuestion, X } from "lucide-react"
import { ArchivoPrevisualizador, descargarArchivo } from "../ArchivoPrevisualizador"
import { ESTILO_TIPO, extensionDe, type DocAuditoria } from "./tipos"

const BOTON = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-helix-accent"

/** Un panel de lectura: cabecera con el documento y sus acciones y, debajo, el contenido a todo el alto disponible. */
export function VisorDocumento({ doc, onCerrar, style }: { doc: DocAuditoria; onCerrar?: () => void; style?: CSSProperties }) {
  const t = ESTILO_TIPO[doc.tipo]
  const ext = extensionDe(doc.nombreArchivo)
  const Icono = t.icono
  return (
    <section
      style={style}
      aria-label={doc.titulo}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_4px_rgba(0,0,0,0.3),0_28px_56px_-20px_rgba(0,0,0,0.8)]"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-zinc-200">
          <Icono className={`h-[18px] w-[18px] ${t.color}`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span>{t.singular}</span>
            {doc.codigo && <><span aria-hidden>·</span><span className="font-mono text-zinc-700">{doc.codigo}</span></>}
            {ext && <span className="ml-1 rounded bg-zinc-100 px-1.5 py-px font-mono text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200">{ext}</span>}
          </p>
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-900" title={doc.titulo}>{doc.titulo}</h2>
        </div>
        {doc.base && doc.nombreArchivo && (
          <button type="button" onClick={() => void descargarArchivo(doc.base!, doc.nombreArchivo!).catch(() => undefined)} aria-label={`Descargar ${doc.nombreArchivo}`} title="Descargar el archivo" className={BOTON}>
            <Download className="h-4 w-4" aria-hidden />
          </button>
        )}
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label={`Cerrar ${doc.titulo}`} title="Cerrar este documento" className={BOTON}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </header>
      <div className="relative min-h-0 flex-1 bg-zinc-100">
        {doc.base && doc.nombreArchivo ? (
          <div className="absolute inset-0 overflow-auto">
            <ArchivoPrevisualizador base={doc.base} nombre={doc.nombreArchivo} mime={doc.mime} altura="100%" embebido />
          </div>
        ) : (
          <div className="absolute inset-0 overflow-auto p-4">
            {doc.texto ? (
              <article className="prose prose-sm mx-auto max-w-3xl rounded-lg bg-white p-8 shadow-sm ring-1 ring-zinc-200 prose-headings:text-zinc-900">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.texto}</ReactMarkdown>
              </article>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
                <FileQuestion className="h-8 w-8" aria-hidden />
                <p className="text-sm">Este documento no tiene archivo ni texto para mostrar.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

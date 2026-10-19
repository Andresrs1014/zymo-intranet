import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react"
import { createPortal } from "react-dom"
import { AlertCircle, Columns2, FileSearch, FileText, Loader, PanelRight, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ListaDocumentos } from "./ListaDocumentos"
import { VisorDocumento } from "./VisorDocumento"
import { useDocumentosAuditoria } from "./useDocumentosAuditoria"
import type { DocAuditoria } from "./tipos"

type Modo = "proc" | "dividida" | "doc"
const MODOS = [
  { modo: "proc", etiqueta: "Procedimiento", Icono: FileText, tecla: "1" },
  { modo: "dividida", etiqueta: "Dividida", Icono: Columns2, tecla: "2" },
  { modo: "doc", etiqueta: "Documento", Icono: FileSearch, tecla: "3" },
] as const

const guardado = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento: no se recuerda */ } }
const esPantallaAncha = () => window.matchMedia("(min-width: 768px)").matches

/**
 * Vista de auditoría: pop-up a pantalla completa para leer el procedimiento junto a sus instructivos, formatos y docs anexos.
 * Tres modos: solo el procedimiento, pantalla dividida (procedimiento | documento) o solo el documento.
 * Atajos: J/K documento siguiente/anterior · 1/2/3 modo · Esc cerrar.
 */
export function VistaAuditoria({ procedimientoId, onClose }: { procedimientoId: number; onClose: () => void }) {
  const d = useDocumentosAuditoria(procedimientoId)
  const [modo, setModo] = useState<Modo>("proc")
  const [abierto, setAbierto] = useState<DocAuditoria | null>(null)
  const [lista, setLista] = useState(esPantallaAncha)
  const [proporcion, setProporcion] = useState(() => Math.min(0.75, Math.max(0.3, Number(guardado("aud-proporcion")) || 0.55)))
  const raiz = useRef<HTMLDivElement>(null)
  const zona = useRef<HTMLElement>(null)
  const cerrar = useRef(onClose)
  cerrar.current = onClose

  const planos = [d.procedimiento, ...d.instructivos, ...d.formatos, ...d.anexos].filter((x): x is DocAuditoria => !!x)
  const elegir = useCallback((doc: DocAuditoria) => {
    setAbierto(doc)
    setModo((m) => (m === "proc" ? "dividida" : m))
    if (!esPantallaAncha()) setLista(false)
  }, [])

  // Foco: entra al abrir, vuelve al botón que lo abrió al cerrar, y el resto de la página queda inerte detrás del diálogo.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    const otros = [...document.body.children].filter((n) => n !== raiz.current) as HTMLElement[]
    otros.forEach((n) => n.setAttribute("inert", ""))
    raiz.current?.focus()
    return () => { otros.forEach((n) => n.removeAttribute("inert")); previo?.focus() }
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { cerrar.current(); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.closest("input, textarea, select, [contenteditable]")) return
      if (e.key === "1") setModo("proc")
      else if ((e.key === "2" || e.key === "3") && abierto) setModo(e.key === "2" ? "dividida" : "doc")
      else if (e.key === "j" || e.key === "k") {
        const i = planos.findIndex((x) => x.clave === abierto?.clave)
        const sig = planos[e.key === "j" ? Math.min(i + 1, planos.length - 1) : Math.max(i - 1, 0)]
        if (sig && sig.clave !== "proc") elegir(sig)
      }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  })

  const cambiarModo = setModo

  // Divisor arrastrable entre el procedimiento y el documento (doble clic: vuelve al 55 %).
  function arrastrar(e: PointerEvent<HTMLDivElement>) {
    const caja = zona.current
    if (!caja || e.buttons !== 1) return
    const r = caja.getBoundingClientRect()
    setProporcion(Math.min(0.75, Math.max(0.3, (e.clientX - r.left) / r.width)))
  }

  const verProc = modo !== "doc"
  const verDoc = modo !== "proc" && !!abierto
  const dividida = verProc && verDoc && !!d.procedimiento

  return createPortal(
    <div
      ref={raiz}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="aud-titulo"
      className="fixed inset-0 z-[100] flex flex-col bg-zinc-900 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,255,255,0.07),transparent)] outline-none duration-200 animate-in fade-in-0 motion-reduce:animate-none"
    >
      <p className="sr-only" role="status" aria-live="polite">{abierto ? `Abierto: ${abierto.titulo}` : ""}</p>
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-5 py-3">
        <div className="min-w-0 flex-1">
          <h1 id="aud-titulo" className="text-xs font-medium uppercase tracking-widest text-white/60">Vista de auditoría</h1>
          <p className="truncate text-sm text-white">
            {d.procedimiento
              ? <><span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs ring-1 ring-white/15">{d.procedimiento.codigo}</span>{d.procedimiento.titulo}</>
              : "Cargando…"}
          </p>
        </div>
        <div role="group" aria-label="Modo de lectura" className="flex rounded-xl bg-black/30 p-1 ring-1 ring-white/10">
          {MODOS.map(({ modo: m, etiqueta, Icono, tecla }) => {
            const inactivo = m !== "proc" && !abierto
            return (
              <button
                key={m}
                type="button"
                onClick={() => !inactivo && cambiarModo(m)}
                aria-pressed={modo === m}
                aria-disabled={inactivo || undefined}
                title={inactivo ? "Elige un documento de la lista" : `${etiqueta} (${tecla})`}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white",
                  modo === m ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20" : "text-white/70 hover:bg-white/10 hover:text-white",
                  inactivo && "cursor-not-allowed text-white/35 hover:bg-transparent hover:text-white/35",
                )}
              >
                <Icono className="h-3.5 w-3.5" aria-hidden />{etiqueta}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLista((v) => !v)}
            aria-pressed={lista}
            aria-label={lista ? "Ocultar la lista de documentos" : "Mostrar la lista de documentos"}
            title="Lista de documentos"
            className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", lista ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10")}
          >
            <PanelRight className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={onClose} aria-label="Cerrar la vista de auditoría" title="Cerrar (Esc)" className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 gap-4 p-3 md:p-5">
        <main ref={zona} className="flex min-h-0 min-w-0 flex-1">
          {d.error ? (
            <div role="alert" className="m-auto flex max-w-sm flex-col items-center gap-3 text-center text-white/80">
              <AlertCircle className="h-8 w-8 text-red-400" aria-hidden />
              <p className="text-sm">No se pudieron cargar los documentos de este procedimiento. Lo que ves podría estar incompleto.</p>
              <button type="button" onClick={d.reintentar} className="rounded-lg bg-white/15 px-4 py-2 text-[13px] font-medium text-white ring-1 ring-white/20 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Reintentar</button>
            </div>
          ) : d.cargando && !d.procedimiento ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-white/70" role="status">
              <Loader className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /><span className="text-sm">Cargando documentos…</span>
            </div>
          ) : (
            <>
              {verProc && d.procedimiento && <VisorDocumento doc={d.procedimiento} style={dividida ? { flex: `${proporcion} 1 0%` } : undefined} />}
              {verProc && !d.procedimiento && <p className="m-auto text-center text-sm text-white/70">Este procedimiento todavía no tiene una versión para leer.</p>}
              {dividida && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Ajustar el ancho de los paneles (doble clic para restablecer)"
                  tabIndex={0}
                  onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                  onPointerMove={arrastrar}
                  onPointerUp={() => guardar("aud-proporcion", String(proporcion))}
                  onDoubleClick={() => { setProporcion(0.55); guardar("aud-proporcion", "0.55") }}
                  onKeyDown={(e) => {
                    const p = e.key === "ArrowLeft" ? -0.03 : e.key === "ArrowRight" ? 0.03 : 0
                    if (p) { e.preventDefault(); const v = Math.min(0.75, Math.max(0.3, proporcion + p)); setProporcion(v); guardar("aud-proporcion", String(v)) }
                  }}
                  className="group flex w-4 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none"
                >
                  <span className="h-16 w-1 rounded-full bg-white/20 transition-colors group-hover:bg-helix-accent/70 group-focus-visible:bg-white" />
                </div>
              )}
              {verDoc && abierto && (
                <VisorDocumento
                  key={abierto.clave}
                  doc={abierto}
                  style={dividida ? { flex: `${1 - proporcion} 1 0%` } : undefined}
                  onCerrar={modo === "dividida" ? () => { setAbierto(null); cambiarModo("proc") } : undefined}
                />
              )}
            </>
          )}
        </main>
        {lista && (
          <div className="min-h-0 w-80 shrink-0 xl:w-96 max-md:absolute max-md:inset-0 max-md:z-10 max-md:w-auto max-md:bg-zinc-900 max-md:p-3">
            <ListaDocumentos
              procedimiento={d.procedimiento}
              grupos={[
                { tipo: "instructivo", docs: d.instructivos },
                { tipo: "formato", docs: d.formatos },
                { tipo: "anexo", docs: d.anexos },
              ]}
              seleccion={abierto?.clave ?? null}
              procAbierto={verProc}
              onProcedimiento={() => { cambiarModo("proc"); if (!esPantallaAncha()) setLista(false) }}
              onElegir={elegir}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

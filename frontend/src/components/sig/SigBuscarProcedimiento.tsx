import { useEffect, useRef, useState } from "react"
import { Command } from "cmdk"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, ClipboardList, FileText, Paperclip, ScrollText, Search, type LucideIcon } from "lucide-react"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import type { ProcedureOpenInfo } from "@/components/sig/SigExplorer"

/** Pestaña del procedimiento en la que conviene abrir lo encontrado. */
export type TabSolicitada = "soporte" | "formatos" | "docanexos"

type Tipo = "procedimiento" | "instructivo" | "protocolo" | "formato" | "anexo"

interface Resultado {
  tipo: Tipo
  id: number
  codigo?: string
  titulo: string
  archivo?: string
  estado?: string
  procedimiento: { id: number; codigo: string; titulo: string; area: { id: number; nombre: string; color: string } }
}

const TIPOS: { tipo: Tipo; titulo: string; icono: LucideIcon; tab?: TabSolicitada }[] = [
  { tipo: "procedimiento", titulo: "Procedimientos", icono: FileText },
  { tipo: "instructivo", titulo: "Instructivos", icono: BookOpen, tab: "soporte" },
  { tipo: "formato", titulo: "Formatos", icono: ClipboardList, tab: "formatos" },
  { tipo: "anexo", titulo: "Documentos anexos y políticas", icono: Paperclip, tab: "docanexos" },
  { tipo: "protocolo", titulo: "Protocolos", icono: ScrollText, tab: "docanexos" },
]

function fold(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function Marca({ text, q }: { text: string; q: string }) {
  const needle = fold(q.trim())
  if (!needle) return <>{text}</>
  let hay = ""
  for (const ch of text) {
    const f = fold(ch)
    if (f.length !== 1) return <>{text}</>
    hay += f
  }
  const i = hay.indexOf(needle)
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-helix-accent-ink">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  )
}

/** Buscador del SIG: encuentra procedimientos, instructivos, protocolos, formatos y documentos anexos. */
export function SigBuscarProcedimiento({
  onSelect,
  className,
  hint = true,
}: {
  onSelect: (id: number, info: ProcedureOpenInfo, tab?: TabSolicitada) => void
  className?: string
  hint?: boolean
}) {
  const [q, setQ] = useState("")
  const [qBusca, setQBusca] = useState("")
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // se consulta al dejar de escribir, no en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setQBusca(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])

  const { data, isFetching, isError } = useQuery<Resultado[]>({
    queryKey: ["sig", "buscar", qBusca],
    queryFn: async () => (await sigApi.get<{ resultados: Resultado[] }>("/api/buscar", { params: { q: qBusca } })).data.resultados,
    enabled: qBusca.length >= 2,
    staleTime: 30_000,
    placeholderData: (previo) => previo,
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return
      const t = e.target as HTMLElement | null
      const escribiendo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      if (escribiendo && t !== inputRef.current) return
      e.preventDefault()
      inputRef.current?.focus()
      setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    function down(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", down)
    return () => document.removeEventListener("mousedown", down)
  }, [])

  function elegir(r: Resultado, tab?: TabSolicitada) {
    setQ("")
    setOpen(false)
    inputRef.current?.blur()
    onSelect(r.procedimiento.id, {
      codigo: r.procedimiento.codigo,
      titulo: r.procedimiento.titulo,
      areaColor: r.procedimiento.area.color,
      areaNombre: r.procedimiento.area.nombre,
    }, tab)
  }

  const mostrar = open && q.trim().length >= 2
  const resultados = data ?? []
  const buscando = isFetching && resultados.length === 0

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <Command label="Buscar en el SIG" shouldFilter={false} vimBindings={false} loop>
        <div className={cn(
          "flex items-center gap-2 h-7 px-2 rounded border bg-zinc-100 transition-colors",
          open ? "border-helix-accent/50 bg-white" : "border-zinc-300",
        )}>
          <Search className="h-3.5 w-3.5 text-zinc-600 shrink-0" aria-hidden />
          <Command.Input
            ref={inputRef}
            value={q}
            onValueChange={(v) => { setQ(v); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false)
                inputRef.current?.blur()
              }
            }}
            placeholder="Buscar en el SIG: procedimientos, instructivos, formatos…"
            aria-label="Buscar en todo el SIG por nombre o código"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent text-[12px] text-zinc-800 placeholder:text-zinc-600 outline-none font-sans"
          />
          {hint && (
            <kbd className="hidden lg:inline text-[11px] font-mono text-zinc-600 border border-zinc-300 rounded px-1 py-px bg-white">
              Ctrl K
            </kbd>
          )}
        </div>

        {mostrar && (
          <Command.List
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-md border border-zinc-300 bg-white shadow-lg py-1"
            style={{ animation: "sig-buscar-in 160ms cubic-bezier(.2,.8,.2,1)" }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {buscando && <Command.Loading className="px-3 py-2 text-[12px] text-zinc-600">Buscando…</Command.Loading>}
            {isError && <p className="px-3 py-2 text-[12px] text-red-700">No se pudo buscar. Intenta de nuevo.</p>}
            {!buscando && !isError && resultados.length === 0 && qBusca.length >= 2 && (
              <p className="px-3 py-3 text-[12px] text-zinc-600">Nada coincide con «{qBusca}». Prueba con el código (PRC-001) o parte del nombre.</p>
            )}
            {TIPOS.map(({ tipo, titulo, icono: Icono, tab }) => {
              const filas = resultados.filter((r) => r.tipo === tipo)
              if (filas.length === 0) return null
              return (
                <Command.Group
                  key={tipo}
                  heading={<span className="inline-flex items-center gap-1.5"><Icono className="h-3 w-3" aria-hidden />{titulo}</span>}
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-600"
                >
                  {filas.map((r) => (
                    <Command.Item
                      key={`${r.tipo}-${r.id}`}
                      value={`${r.tipo}-${r.id}`}
                      onSelect={() => elegir(r, tab)}
                      className="mx-1 px-2 py-1.5 rounded cursor-pointer text-zinc-700 data-[selected=true]:bg-zinc-200"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 self-center" style={{ backgroundColor: r.procedimiento.area.color }} aria-hidden />
                        {r.codigo && <span className="font-mono text-xs text-zinc-700 shrink-0"><Marca text={r.codigo} q={q} /></span>}
                        <span className="min-w-0 truncate text-[12px]"><Marca text={r.titulo} q={q} /></span>
                        {r.estado === "PENDIENTE_REVISION" && <span className="ml-auto shrink-0 rounded bg-amber-100 px-1.5 text-[11px] text-amber-700">En revisión</span>}
                      </div>
                      <p className="ml-3.5 truncate font-mono text-[11px] text-zinc-600">
                        {tipo === "procedimiento" ? r.procedimiento.area.nombre : `en ${r.procedimiento.codigo} · ${r.procedimiento.area.nombre}`}
                        {r.archivo ? ` · ${r.archivo}` : ""}
                      </p>
                    </Command.Item>
                  ))}
                </Command.Group>
              )
            })}
          </Command.List>
        )}
      </Command>
      <style>{`@keyframes sig-buscar-in { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  )
}

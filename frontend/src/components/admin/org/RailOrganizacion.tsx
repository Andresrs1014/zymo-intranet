import { useState } from "react"
import { ArrowLeft, FolderCheck, FolderX, Plus, X } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { getApiError } from "@/hooks/useRoles"
import { useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { useCreateArea, type AreaItem } from "@/hooks/useAreas"
import { useCreateSede, useDeleteSede, useSedes } from "@/hooks/useSedes"

/** Columna roja: las áreas (la elegida se funde con el panel blanco) y, abajo, las sedes. */
export function RailOrganizacion({ areas, conteo, conCarpeta, total, archivados, verArchivados, onArchivados, activa, onElegir, onTodas }: {
  areas: AreaItem[]
  conteo: Record<string, number>
  /** Ids de las áreas que tienen carpeta en el SIG; null si el SIG no respondió (no se marca nada) */
  conCarpeta: Set<number> | null
  activa: number | null
  total: number
  archivados: number
  verArchivados: boolean
  onArchivados: () => void
  onElegir: (id: number) => void
  onTodas: () => void
}) {
  const crearArea = useCreateArea()
  const qc = useQueryClient()
  const [nueva, setNueva] = useState<string | null>(null)
  const [conSig, setConSig] = useState(false)
  const [error, setError] = useState<string>()

  async function agregar() {
    const nombre = (nueva ?? "").trim()
    if (crearArea.isPending) return
    if (!nombre) { setNueva(null); return }
    setError(undefined)
    try {
      const creada = await crearArea.mutateAsync(nombre)
      const quiereSig = conSig
      setNueva(null)
      setConSig(false)
      onElegir(creada.id)
      if (quiereSig) {
        try {
          await sigApi.post("/api/areas/desde-intranet", { intranetAreaId: creada.id })
          qc.invalidateQueries({ queryKey: ["sig", "areas"] })
        } catch (e) {
          setError(`El área se creó, pero no su carpeta en el SIG: ${(e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "el SIG no respondió"}. Pídela desde el área.`)
        }
      }
    } catch (err) {
      setError(getApiError(err))
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto bg-org-rojo text-white" aria-label="Áreas y sedes">
      <div className="px-5 pb-4 pt-5">
        <Link to="/admin/configuracion" className="mb-4 inline-flex items-center gap-1.5 text-[11px] text-white/70 transition-colors hover:text-white">
          <ArrowLeft className="h-3 w-3" aria-hidden /> Configuración
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">Organización</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Áreas</h1>
      </div>

      <div className="pl-3">
        <button
          type="button" onClick={onTodas} aria-current={activa == null && !verArchivados ? "true" : undefined}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-l-full py-2 pl-4 pr-4 text-left text-[13px] transition-colors",
            activa == null && !verArchivados ? "bg-white font-semibold text-org-rojo" : "text-white/85 hover:bg-white/10",
          )}
        >
          <span className="truncate">Todas las personas</span>
          <span className={cn("font-mono text-[11px] tabular-nums", activa == null && !verArchivados ? "text-org-vivo" : "text-white/50")}>{total}</span>
        </button>
        <button
          type="button" onClick={onArchivados} aria-current={verArchivados ? "true" : undefined}
          className={cn(
            "mt-0.5 flex w-full items-center justify-between gap-2 rounded-l-full py-2 pl-4 pr-4 text-left text-[13px] transition-colors",
            verArchivados ? "bg-white font-semibold text-org-rojo" : "text-white/85 hover:bg-white/10",
          )}
        >
          <span className="truncate">Archivados</span>
          <span className={cn("font-mono text-[11px] tabular-nums", verArchivados ? "text-org-vivo" : "text-white/50")}>{archivados}</span>
        </button>
      </div>
      <p className="px-5 pt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">Por área</p>
      <p className="min-h-[2.6rem] px-5 pb-1.5 pt-1 text-[11px] leading-snug text-white/70">
        {conCarpeta && (
          <>
            <FolderCheck className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden />{areas.filter((a) => conCarpeta.has(a.id)).length} con carpeta en el SIG ·
            <FolderX className="mr-1 inline h-3 w-3 align-[-2px] opacity-70" aria-hidden />{areas.filter((a) => !conCarpeta.has(a.id)).length} sin carpeta
          </>
        )}
      </p>
      <ul className="space-y-0.5 pl-3">
        {areas.map((a, i) => {
          const on = a.id === activa
          return (
            <li key={a.id} style={{ animation: `org-in .4s ease ${i * 30}ms both` }}>
              <button
                type="button"
                onClick={() => onElegir(a.id)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-l-full py-2 pl-4 pr-4 text-left text-[13px] transition-colors",
                  on ? "bg-white font-semibold text-org-rojo" : "text-white/85 hover:bg-white/10",
                )}
              >
                <span className="truncate" title={a.name}>{a.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {conCarpeta && (conCarpeta.has(a.id)
                    ? <span title="Tiene carpeta en el SIG"><FolderCheck className={cn("h-3.5 w-3.5", on ? "text-org-vivo" : "text-white/85")} aria-hidden /><span className="sr-only">Tiene carpeta en el SIG</span></span>
                    : <span title="Sin carpeta en el SIG"><FolderX className={cn("h-3.5 w-3.5", on ? "text-org-tinta/35" : "text-white/35")} aria-hidden /><span className="sr-only">Sin carpeta en el SIG</span></span>)}
                  <span className={cn("font-mono text-[11px] tabular-nums", on ? "text-org-vivo" : "text-white/50")}>{conteo[a.name.trim().toLowerCase()] ?? 0}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="px-5 pt-3">
        {nueva === null ? (
          <button type="button" onClick={() => setNueva("")} className="inline-flex items-center gap-1.5 text-[12px] text-white/80 transition-colors hover:text-white">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Nueva área
          </button>
        ) : (
          <div>
            <input
              autoFocus value={nueva} onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") agregar(); if (e.key === "Escape") { setNueva(null); setConSig(false) } }}
              placeholder="Nombre del área…" aria-label="Nombre de la nueva área"
              className="w-full rounded-md border border-white/30 bg-white/10 px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/50 focus:border-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            />
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-white/85">
              <input type="checkbox" checked={conSig} onChange={(e) => setConSig(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-white" />
              También darle su carpeta en el SIG
            </label>
            <button type="button" onClick={agregar} disabled={crearArea.isPending} className="mt-2 rounded-md bg-white px-3 py-1 disabled:opacity-60 text-[12px] font-medium text-org-rojo hover:bg-white/90">Crear área</button>
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-[11px] text-white">{error}</p>}
      </div>

      <Sedes />
    </aside>
  )
}

function Sedes() {
  const { data: sedes = [] } = useSedes()
  const crear = useCreateSede()
  const borrar = useDeleteSede()
  const [nueva, setNueva] = useState("")
  const [error, setError] = useState<string>()

  async function agregar() {
    const name = nueva.trim()
    if (!name) return
    setError(undefined)
    try { await crear.mutateAsync({ name }); setNueva("") } catch (err) { setError(getApiError(err)) }
  }

  return (
    <div className="mt-auto border-t border-white/15 px-5 pb-5 pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">Sedes</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {sedes.map((s) => (
          <li key={s.id} className="group inline-flex items-center gap-1 rounded-full bg-white/12 py-0.5 pl-2.5 pr-1 text-[12px]">
            {s.name}
            <button
              type="button" aria-label={`Quitar la sede ${s.name}`}
              onClick={async () => {
                if (!window.confirm(`¿Quitar la sede «${s.name}»?`)) return
                setError(undefined)
                try { await borrar.mutateAsync(s.id) } catch (err) { setError(getApiError(err)) }
              }}
              className="rounded-full p-0.5 text-white/50 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <input
        value={nueva} onChange={(e) => setNueva(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") agregar() }}
        placeholder="+ Nueva sede" aria-label="Nombre de la nueva sede"
        className="mt-2.5 w-full rounded-md border border-white/20 bg-transparent px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/50 focus:border-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      />
      {error && <p role="alert" className="mt-2 text-[11px] text-white">{error}</p>}
    </div>
  )
}

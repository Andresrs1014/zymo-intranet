import { useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { api } from "@/lib/api"
import { useSigAnalisisStore, type AnalysisType } from "@/store/sigAnalisisStore"
import {
  Search, SlidersHorizontal, FileText,
  Target, Lightbulb, GitCompare, Database, Users, Loader, AlertTriangle, X,
} from "lucide-react"
import { fetchProcCargoIds } from "@/components/sig/SigProcedimientoCargosPanel"

// ── Module-level AbortController map ─────────────────────────────────────────

const _jobControllers = new Map<string, AbortController>()

export function cancelAnalysisJob(id: string) {
  _jobControllers.get(id)?.abort()
  _jobControllers.delete(id)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProcListItem {
  id:     number
  codigo: string
  titulo: string
  estado: string
  area:   { id: number; nombre: string; color: string }
  _count: { commits: number }
}

interface SigArea {
  id:     number
  nombre: string
  color:  string
}

interface ProcSyncData {
  latestApproved: { contenidoAgente: string; flujogramaMmd?: string | null } | null
}

interface Instructivo {
  id:       number
  codigo:   string
  titulo:   string
  contenido: string
}

interface ProcSummary {
  id:         number
  codigo:     string
  titulo:     string
  areaNombre: string
}

// ── Netvault polling ──────────────────────────────────────────────────────────

const NETVAULT_TERMINAL = new Set(["done", "error", "cancelled", "failed", "aborted"])

async function pollNetvaultJob(jobId: string, signal: AbortSignal): Promise<unknown> {
  for (let i = 0; i < 120; i++) {
    if (signal.aborted) throw new DOMException("Cancelled by user", "AbortError")
    await new Promise<void>((r) => setTimeout(r, 2500))
    if (signal.aborted) throw new DOMException("Cancelled by user", "AbortError")
    const { data } = await api.get(`/api/netvault/job/${jobId}`, { signal })
    if (data.status === "done") return data.data
    if (data.status === "error") throw new Error(data.error ?? "El análisis falló en netvault")
    if (NETVAULT_TERMINAL.has(data.status as string))
      throw new Error(`Estado inesperado del job: ${data.status as string}`)
  }
  throw new Error("Tiempo de espera agotado (5 min)")
}

// ── Context builder (compact summaries of prior analyses) ─────────────────────

interface ContextoItem { tipo: string; resumen: string; fecha: string }

function _buildContextoResumen(r: {
  tipo: string; resumen?: string; puntaje?: number | null
  issues?: Array<{ severidad: string; descripcion: string }>
  proposals?: Array<{ descripcion: string }>
  conflictos?: Array<{ severidad: string; descripcion: string }>
}): string {
  const parts: string[] = []
  if (r.tipo === "coherencia" && r.puntaje != null)
    parts.push(`Puntaje: ${Math.round(r.puntaje * 100)}/100.`)
  if (r.resumen) parts.push(r.resumen.slice(0, 300))
  const issues = (r.issues ?? []).slice(0, 3).map((i) => `[${i.severidad}] ${i.descripcion}`)
  if (issues.length) parts.push(`Hallazgos: ${issues.join("; ")}`)
  const props = (r.proposals ?? []).slice(0, 3).map((p) => p.descripcion)
  if (props.length) parts.push(`Propuestas: ${props.join("; ")}`)
  const conf = (r.conflictos ?? []).slice(0, 3).map((c) => `[${c.severidad}] ${c.descripcion}`)
  if (conf.length) parts.push(`Conflictos: ${conf.join("; ")}`)
  return parts.join(" ").slice(0, 600)
}

async function _fetchContextoPrevio(procId: number, currentType: AnalysisType): Promise<ContextoItem[]> {
  try {
    const { data } = await sigApi.get("/api/analisis/historial", {
      params: { procedimientoId: procId, limit: 10 },
    })
    const byType = new Map<string, ContextoItem>()
    for (const r of (data as Array<{ tipo: string; resumen?: string; createdAt: string; puntaje?: number | null; issues?: unknown[]; proposals?: unknown[]; conflictos?: unknown[] }>)) {
      if (r.tipo === currentType || byType.has(r.tipo)) continue
      byType.set(r.tipo, {
        tipo:   r.tipo,
        fecha:  r.createdAt.split("T")[0],
        resumen: _buildContextoResumen(r as Parameters<typeof _buildContextoResumen>[0]),
      })
    }
    return Array.from(byType.values())
  } catch {
    return []
  }
}

// ── useRunAnalysis ────────────────────────────────────────────────────────────

export function useRunAnalysis() {
  const { addJob, updateJob, cancelJob } = useSigAnalisisStore()
  const qc = useQueryClient()

  const runAnalysis = useCallback(async (
    proc:        ProcSummary,
    type:        AnalysisType,
    textContent: string,
    instructivos?: Instructivo[],
  ) => {
    const controller = new AbortController()
    const localId = addJob({
      procedimientoId: proc.id,
      procedureCodigo: proc.codigo,
      procedureTitulo: proc.titulo,
      type,
    })
    _jobControllers.set(localId, controller)

    try {
      let netvaultRes: { job_id: string }

      const contextoPrevio = await _fetchContextoPrevio(proc.id, type)

      const base = {
        procedimientoId: proc.id,
        procedureCode:   proc.codigo,
        area:            proc.areaNombre,
        textContent,
        contexto_previo: contextoPrevio,
      }
      const instList = (instructivos ?? []).map((i) => ({
        id: i.id, codigo: i.codigo, titulo: i.titulo, contenido: i.contenido,
      }))

      if (type === "coherencia") {
        netvaultRes = (await api.post("/api/netvault/analizar-coherencia", base)).data
      } else if (type === "mejoras") {
        netvaultRes = (await api.post("/api/netvault/analizar-mejoras", base)).data
      } else if (type === "proc-vs-inst") {
        netvaultRes = (await api.post("/api/netvault/analizar-proc-vs-inst", {
          ...base, instructivos: instList,
        })).data
      } else if (type === "cargos") {
        const cargoIds = await fetchProcCargoIds(proc.id)
        if (cargoIds.length === 0) {
          throw new Error("Asigna al menos un cargo T&C al procedimiento antes de analizar.")
        }
        netvaultRes = (await api.post("/api/netvault/analizar-cargos", {
          ...base, instructivos: instList, cargo_ids: cargoIds,
        })).data
      } else {
        netvaultRes = (await api.post("/api/netvault/indexar-lightrag", {
          ...base, instructivos: instList,
        })).data
      }

      updateJob(localId, { netvaultJobId: netvaultRes.job_id })
      const result = await pollNetvaultJob(netvaultRes.job_id, controller.signal)

      if (type !== "lightrag") {
        const endpoint =
          type === "coherencia"  ? "/api/analisis/coherencia"  :
          type === "mejoras"     ? "/api/analisis/mejoras"     :
          type === "cargos"      ? "/api/analisis/cargos"      :
                                   "/api/analisis/proc-vs-inst"
        await sigApi.post(endpoint, {
          procedimientoId: proc.id,
          ...(result as Record<string, unknown>),
        })
      }

      updateJob(localId, { status: "done", result, completedAt: Date.now() })
      qc.invalidateQueries({ queryKey: ["sig", "analisis", proc.id] })
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === "AbortError"
      if (isAbort) {
        cancelJob(localId)
      } else {
        const msg = err instanceof Error ? err.message : "Error desconocido"
        updateJob(localId, { status: "error", error: msg, completedAt: Date.now() })
      }
    } finally {
      _jobControllers.delete(localId)
    }
  }, [addJob, updateJob, cancelJob, qc])

  return runAnalysis
}

// ── Analysis type config ──────────────────────────────────────────────────────

const ANALYSIS_TYPES: Array<{
  type:  AnalysisType
  label: string
  icon:  React.ReactNode
  color: string
}> = [
  { type: "coherencia",    label: "Coherencia",  icon: <Target    className="h-3 w-3" />, color: "text-blue-600   border-blue-200   bg-blue-50   hover:bg-blue-100" },
  { type: "mejoras",       label: "Mejoras",     icon: <Lightbulb className="h-3 w-3" />, color: "text-amber-600  border-amber-200  bg-amber-50  hover:bg-amber-100" },
  { type: "proc-vs-inst",  label: "Proc/Inst",   icon: <GitCompare className="h-3 w-3" />, color: "text-violet-600 border-violet-200 bg-violet-50 hover:bg-violet-100" },
  { type: "cargos",        label: "Cargos",      icon: <Users     className="h-3 w-3" />, color: "text-rose-600   border-rose-200   bg-rose-50   hover:bg-rose-100" },
  { type: "lightrag",      label: "LightRAG",    icon: <Database  className="h-3 w-3" />, color: "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" },
]

// ── Main component ────────────────────────────────────────────────────────────

export function SigAnalisisPanel() {
  const [areaFilter, setAreaFilter] = useState<number | null>(null)
  const [searchQ,    setSearchQ]    = useState("")

  const { data: areas = [] } = useQuery<SigArea[]>({
    queryKey: ["sig", "areas"],
    queryFn:  () => sigApi.get("/api/areas").then((r) => r.data),
  })

  const { data: allProcs = [], isLoading } = useQuery<ProcListItem[]>({
    queryKey: ["sig", "procedimientos-analisis", areaFilter],
    queryFn:  () =>
      sigApi.get("/api/procedimientos", {
        params: areaFilter ? { areaId: areaFilter } : {},
      }).then((r) => r.data),
  })

  const procedures = allProcs.filter(
    (p) =>
      p._count.commits > 0 &&
      (!searchQ ||
        p.codigo.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.titulo.toLowerCase().includes(searchQ.toLowerCase())),
  )

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">

      {/* Filter bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-b border-zinc-200 bg-white">
        <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
          <AreaChip label="Todas" active={areaFilter === null} onClick={() => setAreaFilter(null)} />
          {areas.map((a) => (
            <AreaChip
              key={a.id}
              label={a.nombre}
              color={a.color}
              active={areaFilter === a.id}
              onClick={() => setAreaFilter(a.id)}
            />
          ))}
        </div>
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 pointer-events-none" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Buscar procedimiento…"
            className="h-7 pl-7 pr-3 text-[11px] font-mono border border-zinc-200 rounded bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-helix-accent text-zinc-700 w-52"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-400 py-10 justify-center">
            <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-600 animate-spin" />
            <span className="text-xs font-mono">Cargando procedimientos…</span>
          </div>
        )}

        {!isLoading && procedures.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="h-8 w-8 text-zinc-300" />
            <div className="text-center">
              <p className="text-sm font-mono text-zinc-500">Sin procedimientos commiteados</p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Solo aparecen procedimientos con al menos un commit desde NetVault.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2 max-w-3xl mx-auto">
          {procedures.map((proc) => (
            <ProcAnalisisCard key={proc.id} proc={proc} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Area chip ─────────────────────────────────────────────────────────────────

function AreaChip({
  label, color, active, onClick,
}: { label: string; color?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono transition-all border",
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700",
      )}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      {label}
    </button>
  )
}

// ── Per-procedure card ────────────────────────────────────────────────────────

function ProcAnalisisCard({ proc }: { proc: ProcListItem }) {
  const runAnalysis  = useRunAnalysis()
  const openInspector = useSigAnalisisStore((s) => s.openInspector)
  const jobs         = useSigAnalisisStore((s) => s.jobs)
  const [loading, setLoading] = useState<AnalysisType | "all" | null>(null)

  const { data: instructivosList = [] } = useQuery<Instructivo[]>({
    queryKey: ["sig", "instructivos", proc.id],
    queryFn: () => sigApi.get(`/api/instructivos?procedimientoId=${proc.id}&activo=true`).then((r) => r.data),
  })

  const { data: cargoIds = [], isLoading: loadingCargos } = useQuery<number[]>({
    queryKey: ["sig", "proc-cargo-ids", proc.id],
    queryFn: () => fetchProcCargoIds(proc.id),
  })

  const emptyContentInst = instructivosList.filter((i) => !i.contenido.trim())
  const hasInstWarning = emptyContentInst.length > 0
  const sinCargosAsignados = !loadingCargos && cargoIds.length === 0

  async function fetchContent(): Promise<{ text: string; instructivos: Instructivo[] } | null> {
    const syncData: ProcSyncData = (await sigApi.get(`/api/procedimientos/${proc.id}/sync`)).data
    const contenido = syncData.latestApproved?.contenidoAgente ?? null
    if (!contenido) return null
    const flujograma = syncData.latestApproved?.flujogramaMmd
    const text = flujograma
      ? `${contenido}\n\n## Flujograma del Proceso (Mermaid)\n\n\`\`\`mermaid\n${flujograma}\n\`\`\``
      : contenido
    const instructivos: Instructivo[] = (await sigApi.get(`/api/instructivos?procedimientoId=${proc.id}&activo=true`)).data
    return { text, instructivos }
  }

  async function handleRunType(type: AnalysisType) {
    if (loading) return
    if (type === "cargos" && sinCargosAsignados) return
    setLoading(type)
    try {
      const content = await fetchContent()
      if (!content) return
      const { text, instructivos } = content
      const summary: ProcSummary = { id: proc.id, codigo: proc.codigo, titulo: proc.titulo, areaNombre: proc.area.nombre }
      const needsInst = type === "proc-vs-inst" || type === "cargos"
      void runAnalysis(summary, type, text, needsInst ? instructivos : undefined)
    } catch {
      // fetchContent failed before job creation — loading resets in finally
    } finally {
      setLoading(null)
    }
  }

  async function handleRunAll() {
    if (loading) return
    setLoading("all")
    try {
      const content = await fetchContent()
      if (!content) return
      const { text, instructivos } = content
      const summary: ProcSummary = { id: proc.id, codigo: proc.codigo, titulo: proc.titulo, areaNombre: proc.area.nombre }
      void runAnalysis(summary, "coherencia", text)
      void runAnalysis(summary, "mejoras", text)
      if (instructivos.length > 0) void runAnalysis(summary, "proc-vs-inst", text, instructivos)
      if (cargoIds.length > 0) void runAnalysis(summary, "cargos", text, instructivos)
      void runAnalysis(summary, "lightrag", text, instructivos)
    } catch {
      // fetchContent failed — jobs weren't created, nothing to update; loading resets in finally
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition-all group">

      {/* Top row: info */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="h-9 w-0.5 rounded-full shrink-0" style={{ backgroundColor: proc.area.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono font-semibold text-zinc-700">{proc.codigo}</span>
            <span className="text-[10px] text-zinc-400">{proc.area.nombre}</span>
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded border font-mono ml-auto",
              proc.estado === "VIGENTE"  ? "text-emerald-600 border-emerald-200 bg-emerald-50" :
              proc.estado === "OBSOLETO" ? "text-zinc-400 border-zinc-200 bg-zinc-50" :
                                           "text-zinc-500 border-zinc-300 bg-zinc-100",
            )}>{proc.estado.toLowerCase()}</span>
          </div>
          <p className="text-[12px] text-zinc-500 truncate mt-0.5">{proc.titulo}</p>
          {hasInstWarning && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="text-[10px] text-amber-700 font-mono">
                {emptyContentInst.length} instructivo{emptyContentInst.length !== 1 ? "s" : ""} sin texto extraíble
                ({emptyContentInst.map((i) => i.codigo).join(", ")}) — el análisis Proc/Inst lo reportará como no verificable
              </span>
            </div>
          )}
          {sinCargosAsignados && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded bg-rose-50 border border-rose-200">
              <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
              <span className="text-[10px] text-rose-700 font-mono">
                Sin cargos T&amp;C asignados — abre el procedimiento → pestaña Cargos y selecciona los roles involucrados.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: analysis chips + actions */}
      <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">

        {/* 4 individual analysis type chips */}
        {ANALYSIS_TYPES.map(({ type, label, icon, color }) => {
          const jobForType = jobs.find((j) => j.procedimientoId === proc.id && j.type === type && j.status === "running")
          const running = !!jobForType || (loading === type)
          const blocked = type === "cargos" && sinCargosAsignados
          return (
            <button
              key={type}
              onClick={() => {
                if (blocked) return
                if (jobForType) {
                  cancelAnalysisJob(jobForType.id)
                } else {
                  void handleRunType(type)
                }
              }}
              disabled={blocked || (!jobForType && !!loading && loading !== type)}
              title={
                blocked
                  ? "Asigna cargos T&C al procedimiento primero"
                  : running
                    ? `Cancelar análisis de ${label}`
                    : `Ejecutar análisis de ${label}`
              }
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-all",
                blocked ? "opacity-40 cursor-not-allowed border-zinc-200 text-zinc-400 bg-zinc-50" :
                running ? "border-zinc-300 text-zinc-500 bg-zinc-50" : color,
                !blocked && !jobForType && !!loading && loading !== type ? "opacity-50 cursor-not-allowed" : "",
              )}
            >
              {running ? (
                <>
                  <Loader className="h-2.5 w-2.5 animate-spin" />
                  {label}
                  <X className="h-2.5 w-2.5 ml-0.5 text-zinc-400" />
                </>
              ) : (
                <>{icon}{label}</>
              )}
            </button>
          )
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Analizar todo */}
        <button
          onClick={handleRunAll}
          disabled={!!loading}
          className={cn(
            "flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border font-mono transition-colors",
            loading === "all"
              ? "border-zinc-300 text-zinc-400"
              : "border-zinc-200 text-zinc-500 hover:border-violet-300 hover:text-violet-600",
          )}
        >
          {loading === "all"
            ? <><Loader className="h-2.5 w-2.5 animate-spin" /> Iniciando…</>
            : "Analizar todo"
          }
        </button>

        {/* Ver análisis — abre inspector flotante */}
        <button
          onClick={() => openInspector(proc.id)}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 font-mono transition-colors"
        >
          Ver análisis ↗
        </button>
      </div>
    </div>
  )
}

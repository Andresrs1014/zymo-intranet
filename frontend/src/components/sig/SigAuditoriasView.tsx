import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChevronRight, ClipboardCheck, Loader2, ShieldCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { PROSE } from "@/components/sig/SigInstructivosPanel"

// ── Tipos — espejo de sig-backend/src/routers/auditorias.ts ────────────────────

type Veredicto = "pasa" | "no_pasa" | "incompleto"

interface Conteo {
  ncMayor?: number
  ncMenor?: number
  observacion?: number
  oportunidadMejora?: number
  conformidad?: number
  consulta?: number
}

interface AuditoriaResumen {
  id: number
  procedimientoId: number
  commitId: number | null
  veredicto: Veredicto
  conteo: Conteo
  resumenEjecutivo: string
  autorNombre: string
  operadorNombre: string | null
  validadoNombre: string | null
  validadoEn: string | null
  createdAt: string
  procedimiento?: { codigo: string; titulo: string; area?: { nombre: string; color: string } }
  _count?: { hallazgos: number; consultas: number }
}

interface Hallazgo {
  id: number
  funcion: string
  clasificacion: string
  estado: string
  fragmento: string
  archivo: string | null
  condicion: string | null
  descripcion: string
  demostracion: { tipo?: string; detalle?: string; citasEnConflicto?: string[] } | null
  kpi: { nombre?: string; periodo?: string; resultado?: string; meta?: string } | null
  impacto: string | null
  riesgo: { prioridad?: string; justificacion?: string } | null
  causa: { tipo?: string; detalle?: string } | null
  motivoCierre: string | null
  evidenciaCierre: string | null
}

interface Consulta {
  id: number
  tipo: string
  funcion: string
  motivo: string | null
  fragmento: string | null
  preguntas: string[]
  estado: string
  respuestaUsuario: string | null
}

interface SeguimientoEntrada {
  hallazgoId: number
  estado: string
  motivo: string
  evidencia?: string | null
}

interface AuditoriaDetalle extends AuditoriaResumen {
  veredictoPorFuncion: Record<string, "pasa" | "no_pasa">
  reporteMarkdown: string
  normas: string[]
  alcance: { tipo?: string; documentos?: Array<{ codigo: string; tipoDocumento?: string; version?: string }>; periodoKpi?: { desde: string; hasta: string } } | null
  criterios: Array<{ id: string; tipo: string; fuente: string; referencia?: string }>
  comprensionProceso: string | null
  supuestos: unknown[]
  recomendaciones: string | null
  seguimiento: SeguimientoEntrada[]
  modelosUsados: string[]
  hallazgos: Hallazgo[]
  consultas: Consulta[]
}

// ── Etiquetas ──────────────────────────────────────────────────────────────────

const VEREDICTO_LABEL: Record<Veredicto, string> = { pasa: "Pasa", no_pasa: "No pasa", incompleto: "Incompleto" }
const VEREDICTO_CLS: Record<Veredicto, string> = {
  pasa: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no_pasa: "bg-red-50 text-red-700 border-red-200",
  incompleto: "bg-amber-50 text-amber-700 border-amber-200",
}

const CLASIF_LABEL: Record<string, string> = {
  conformidad: "Conformidad",
  observacion: "Observación",
  oportunidad_mejora: "Oportunidad de mejora",
  nc_menor: "NC menor",
  nc_mayor: "NC mayor",
}
const CLASIF_CLS: Record<string, string> = {
  conformidad: "bg-emerald-50 text-emerald-700 border-emerald-200",
  observacion: "bg-zinc-100 text-zinc-600 border-zinc-200",
  oportunidad_mejora: "bg-sky-50 text-sky-700 border-sky-200",
  nc_menor: "bg-amber-50 text-amber-700 border-amber-200",
  nc_mayor: "bg-red-50 text-red-700 border-red-200",
}

const FUNCION_LABEL: Record<string, string> = {
  "1.1": "Claridad y coherencia",
  "1.2": "Palabras",
  "1.3": "Coherencia entre documentos",
  "1.4": "Arquitectura documental",
  "1.5": "Objetivos y metas",
  "1.6": "KPI y resultados",
}

const SEGUIMIENTO_LABEL: Record<string, string> = {
  cerrado: "Cerrado",
  sigue_abierto: "Sigue abierto",
  sustituido: "Sustituido",
  no_evaluable: "No evaluable",
}

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })

function VeredictoBadge({ v }: { v: Veredicto }) {
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium shrink-0", VEREDICTO_CLS[v])}>
      {VEREDICTO_LABEL[v]}
    </span>
  )
}

function ConteoChips({ c }: { c: Conteo }) {
  const items: Array<[string, number | undefined, string]> = [
    ["NC mayor", c.ncMayor, "text-red-600"],
    ["NC menor", c.ncMenor, "text-amber-600"],
    ["Obs.", c.observacion, "text-zinc-600"],
    ["OM", c.oportunidadMejora, "text-sky-600"],
    ["Conf.", c.conformidad, "text-emerald-600"],
    ["Consultas", c.consulta, "text-amber-600"],
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums">
      {items
        .filter(([, n]) => (n ?? 0) > 0)
        .map(([label, n, cls]) => (
          <span key={label} className="text-zinc-400">
            <span className={cn("font-semibold", cls)}>{n}</span> {label}
          </span>
        ))}
    </div>
  )
}

// ── Lista de un procedimiento (reemplaza "Análisis" en el panel lateral) ───────

export function AuditoriasProcLista({ procId, variant }: { procId: number; variant: "desktop" | "mobile" }) {
  const [openId, setOpenId] = useState<number | null>(null)
  const { data: items = [] } = useQuery<AuditoriaResumen[]>({
    queryKey: ["sig", "auditorias", "proc", procId],
    queryFn: () => sigApi.get("/api/auditorias", { params: { procedimientoId: procId, limit: 50 } }).then((r) => r.data),
  })
  const mobile = variant === "mobile"

  return (
    <>
      {items.length === 0 && (
        <p className={cn("text-zinc-400 italic", mobile ? "text-[12px] px-2" : "px-4 py-6 text-[11px] text-center")}>
          Sin auditorías aún
        </p>
      )}
      <div className={mobile ? "space-y-1" : undefined}>
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => setOpenId(a.id)}
            className={cn(
              "w-full flex items-center gap-2 text-left transition-colors",
              mobile
                ? "px-3 py-2.5 rounded-lg border border-zinc-100 active:bg-zinc-50"
                : "px-3 py-2 border-b border-zinc-200/60 hover:bg-zinc-100",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <VeredictoBadge v={a.veredicto} />
                <span className="text-[11px] text-zinc-400 font-mono">{fmtFecha(a.createdAt)}</span>
              </div>
              <div className="mt-1">
                <ConteoChips c={a.conteo} />
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
          </button>
        ))}
      </div>
      {openId != null && <AuditoriaDetalleModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}

// ── Vista global (pestaña "Auditorías"): agrupada por área ─────────────────────

export function SigAuditoriasView() {
  const [openId, setOpenId] = useState<number | null>(null)
  const { data: items = [], isLoading } = useQuery<AuditoriaResumen[]>({
    queryKey: ["sig", "auditorias"],
    queryFn: () => sigApi.get("/api/auditorias", { params: { limit: 200 } }).then((r) => r.data),
    refetchInterval: 60_000,
  })

  const porArea = useMemo(() => {
    const map = new Map<string, { color: string; items: AuditoriaResumen[] }>()
    for (const a of items) {
      const nombre = a.procedimiento?.area?.nombre ?? "Sin área"
      if (!map.has(nombre)) map.set(nombre, { color: a.procedimiento?.area?.color ?? "#a1a1aa", items: [] })
      map.get(nombre)!.items.push(a)
    }
    return Array.from(map.entries()).sort((x, y) => y[1].items.length - x[1].items.length)
  }, [items])

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-b border-zinc-200 bg-white">
        <ClipboardCheck className="h-4 w-4 text-zinc-400" />
        <span className="text-[13px] font-medium text-zinc-700">Auditorías del agente</span>
        <span className="text-[11px] text-zinc-400 font-mono">{items.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs font-mono">Cargando...</span>
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <p className="text-center text-[12px] text-zinc-400 italic py-16">
            Aún no hay auditorías. Las crea el agente analista desde el MCP.
          </p>
        )}
        <div className="max-w-3xl mx-auto space-y-6">
          {porArea.map(([nombre, grupo]) => (
            <section key={nombre}>
              <h3 className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: grupo.color }} />
                {nombre}
              </h3>
              <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100 overflow-hidden">
                {grupo.items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setOpenId(a.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-zinc-800 truncate">
                        <span className="font-mono font-medium">{a.procedimiento?.codigo}</span>
                        <span className="text-zinc-500"> · {a.procedimiento?.titulo}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <ConteoChips c={a.conteo} />
                        <span className="text-[11px] text-zinc-400">
                          {fmtFecha(a.createdAt)} · {a.operadorNombre ?? a.autorNombre}
                        </span>
                      </div>
                    </div>
                    {a.validadoNombre && (
                      <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" aria-label={`Validada por ${a.validadoNombre}`} />
                    )}
                    <VeredictoBadge v={a.veredicto} />
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {openId != null && <AuditoriaDetalleModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

// ── Detalle ────────────────────────────────────────────────────────────────────

type Pestana = "informe" | "hallazgos" | "consultas" | "seguimiento" | "contexto"

export function AuditoriaDetalleModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [tab, setTab] = useState<Pestana>("informe")
  const { data: a, isLoading } = useQuery<AuditoriaDetalle>({
    queryKey: ["sig", "auditoria", id],
    queryFn: () => sigApi.get(`/api/auditorias/${id}`).then((r) => r.data),
  })
  const tabs: Array<[Pestana, string, number | null]> = [
    ["informe", "Informe", null],
    ["hallazgos", "Hallazgos", a?.hallazgos.length ?? 0],
    ["consultas", "Consultas", a?.consultas.length ?? 0],
    ["seguimiento", "Seguimiento", a?.seguimiento.length ?? 0],
    ["contexto", "Alcance y criterios", null],
  ]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-zinc-900/60 p-0 sm:p-6 animate-in fade-in duration-200 motion-reduce:animate-none"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-4xl bg-white sm:rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-start gap-3 px-5 py-3 border-b border-zinc-200">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-mono font-semibold text-zinc-800">{a?.procedimiento?.codigo ?? "…"}</span>
              {a && <VeredictoBadge v={a.veredicto} />}
              {a?.validadoNombre && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Validada por {a.validadoNombre}
                </span>
              )}
            </div>
            <p className="text-[12px] text-zinc-500 truncate">{a?.procedimiento?.titulo}</p>
            {a && (
              <div className="mt-1.5">
                <ConteoChips c={a.conteo} />
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 flex gap-1 px-4 border-b border-zinc-200 overflow-x-auto">
          {tabs.map(([key, label, n]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-3 py-2 text-[12px] border-b-2 -mb-px whitespace-nowrap transition-colors",
                tab === key ? "border-zinc-800 text-zinc-900 font-medium" : "border-transparent text-zinc-400 hover:text-zinc-700",
              )}
            >
              {label}
              {n != null && n > 0 && <span className="ml-1.5 text-[10px] text-zinc-400 font-mono">{n}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {a && tab === "informe" && (
            <>
              <p className="text-[13px] text-zinc-700 leading-relaxed mb-4">{a.resumenEjecutivo}</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(a.veredictoPorFuncion ?? {}).map(([f, v]) => (
                  <span
                    key={f}
                    title={FUNCION_LABEL[f]}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded border font-mono",
                      v === "pasa" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-red-200 text-red-700 bg-red-50",
                    )}
                  >
                    {f} {v === "pasa" ? "pasa" : "no pasa"}
                  </span>
                ))}
              </div>
              <div className={PROSE}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.reporteMarkdown}</ReactMarkdown>
              </div>
            </>
          )}
          {a && tab === "hallazgos" && <HallazgosLista hallazgos={a.hallazgos} />}
          {a && tab === "consultas" && <ConsultasLista consultas={a.consultas} />}
          {a && tab === "seguimiento" && <SeguimientoLista entradas={a.seguimiento} />}
          {a && tab === "contexto" && <Contexto a={a} />}
        </div>
      </div>
    </div>
  )
}

function HallazgosLista({ hallazgos }: { hallazgos: Hallazgo[] }) {
  if (hallazgos.length === 0) return <Vacio texto="Esta corrida no registró hallazgos nuevos." />
  const porFuncion = new Map<string, Hallazgo[]>()
  for (const h of hallazgos) porFuncion.set(h.funcion, [...(porFuncion.get(h.funcion) ?? []), h])

  return (
    <div className="space-y-6">
      {Array.from(porFuncion.entries()).map(([funcion, lista]) => (
        <section key={funcion}>
          <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
            {funcion} · {FUNCION_LABEL[funcion] ?? ""}
          </h4>
          <div className="space-y-3">
            {lista.map((h) => (
              <article key={h.id} className="rounded-lg border border-zinc-200 p-3.5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", CLASIF_CLS[h.clasificacion])}>
                    {CLASIF_LABEL[h.clasificacion] ?? h.clasificacion}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-200 text-zinc-500 font-mono">{h.estado}</span>
                  {h.archivo && <span className="text-[11px] text-zinc-400 font-mono">{h.archivo}</span>}
                </div>
                <p className="text-[13px] text-zinc-800 leading-relaxed">{h.descripcion}</p>
                <blockquote className="mt-2 pl-3 border-l-2 border-zinc-200 text-[12px] text-zinc-500 italic">{h.fragmento}</blockquote>
                {h.condicion && <Campo label="Condición" texto={h.condicion} />}
                {h.demostracion?.detalle && <Campo label={`Demostración (${h.demostracion.tipo ?? "—"})`} texto={h.demostracion.detalle} />}
                {h.demostracion?.citasEnConflicto?.map((c, i) => (
                  <blockquote key={i} className="mt-1 pl-3 border-l-2 border-amber-200 text-[12px] text-zinc-500 italic">{c}</blockquote>
                ))}
                {h.kpi && (
                  <Campo
                    label="KPI"
                    texto={`${h.kpi.nombre ?? ""} · ${h.kpi.periodo ?? ""} · resultado ${h.kpi.resultado ?? "—"}${h.kpi.meta ? ` (meta ${h.kpi.meta})` : ""}`}
                  />
                )}
                {h.impacto && <Campo label="Impacto" texto={h.impacto} />}
                {h.riesgo?.prioridad && (
                  <Campo label="Riesgo" texto={`Prioridad ${h.riesgo.prioridad}${h.riesgo.justificacion ? ` — ${h.riesgo.justificacion}` : ""}`} />
                )}
                {h.causa?.detalle && <Campo label={h.causa.tipo === "hipotesis" ? "Causa (hipótesis)" : "Causa"} texto={h.causa.detalle} />}
                {h.estado === "CERRADO" && h.motivoCierre && <Campo label="Cierre" texto={h.motivoCierre} />}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ConsultasLista({ consultas }: { consultas: Consulta[] }) {
  if (consultas.length === 0) return <Vacio texto="Sin consultas pendientes para el usuario." />
  return (
    <div className="space-y-3">
      {consultas.map((c) => (
        <article key={c.id} className="rounded-lg border border-zinc-200 p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-medium">{c.tipo.replace("_", " ")}</span>
            <span className="text-[10px] text-zinc-400 font-mono">{c.funcion}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-200 text-zinc-500 font-mono ml-auto">{c.estado}</span>
          </div>
          {c.motivo && <p className="text-[13px] text-zinc-800">{c.motivo}</p>}
          {c.fragmento && <blockquote className="mt-2 pl-3 border-l-2 border-zinc-200 text-[12px] text-zinc-500 italic">{c.fragmento}</blockquote>}
          <ul className="mt-2 list-disc pl-4 text-[12px] text-zinc-600 space-y-0.5">
            {c.preguntas.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          {c.respuestaUsuario && <Campo label="Respuesta" texto={c.respuestaUsuario} />}
        </article>
      ))}
    </div>
  )
}

function SeguimientoLista({ entradas }: { entradas: SeguimientoEntrada[] }) {
  if (entradas.length === 0) return <Vacio texto="Primera revisión, sin hallazgos anteriores que cerrar." />
  return (
    <div className="space-y-2">
      {entradas.map((e) => (
        <div key={e.hallazgoId} className="rounded-lg border border-zinc-200 p-3 flex gap-3">
          <span className="text-[11px] font-mono text-zinc-400 shrink-0">#{e.hallazgoId}</span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-zinc-700">{SEGUIMIENTO_LABEL[e.estado] ?? e.estado}</p>
            <p className="text-[12px] text-zinc-600">{e.motivo}</p>
            {e.evidencia && <blockquote className="mt-1 pl-3 border-l-2 border-zinc-200 text-[12px] text-zinc-500 italic">{e.evidencia}</blockquote>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Contexto({ a }: { a: AuditoriaDetalle }) {
  const docs = a.alcance?.documentos ?? []
  const supuestos = a.supuestos.map((s) => (typeof s === "string" ? s : JSON.stringify(s)))
  return (
    <div className="space-y-5">
      <Bloque titulo="Alcance">
        <p className="text-[12px] text-zinc-600">
          {a.alcance?.tipo ?? "procedimiento"}
          {a.alcance?.periodoKpi && ` · KPI ${a.alcance.periodoKpi.desde} → ${a.alcance.periodoKpi.hasta}`}
          {a.normas.length > 0 && ` · ${a.normas.join(", ")}`}
        </p>
        {docs.length > 0 && (
          <ul className="mt-1 text-[12px] text-zinc-600 font-mono space-y-0.5">
            {docs.map((d) => <li key={`${d.codigo}-${d.version}`}>{d.codigo}{d.version ? ` v${d.version}` : ""}{d.tipoDocumento ? ` (${d.tipoDocumento})` : ""}</li>)}
          </ul>
        )}
      </Bloque>
      {a.criterios.length > 0 && (
        <Bloque titulo="Criterios">
          <ul className="text-[12px] text-zinc-600 space-y-1">
            {a.criterios.map((c) => (
              <li key={c.id}><span className="font-mono text-zinc-400">{c.id}</span> · {c.fuente}{c.referencia ? ` — ${c.referencia}` : ""} <span className="text-zinc-400">({c.tipo})</span></li>
            ))}
          </ul>
        </Bloque>
      )}
      {a.comprensionProceso && <Bloque titulo="Comprensión del proceso"><p className="text-[12px] text-zinc-600 whitespace-pre-wrap leading-relaxed">{a.comprensionProceso}</p></Bloque>}
      {supuestos.length > 0 && <Bloque titulo="Supuestos e hipótesis"><ul className="list-disc pl-4 text-[12px] text-zinc-600 space-y-0.5">{supuestos.map((s, i) => <li key={i}>{s}</li>)}</ul></Bloque>}
      {a.recomendaciones && <Bloque titulo="Recomendaciones (solicitadas)"><p className="text-[12px] text-zinc-600 whitespace-pre-wrap">{a.recomendaciones}</p></Bloque>}
      <Bloque titulo="Trazabilidad">
        <p className="text-[12px] text-zinc-600">
          Versión analizada {a.commitId != null ? `#${String(a.commitId).padStart(4, "0")}` : "—"} · {a.autorNombre}
          {a.modelosUsados.length > 0 && ` · ${a.modelosUsados.join(", ")}`}
        </p>
      </Bloque>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">{titulo}</h4>
      {children}
    </section>
  )
}

function Campo({ label, texto }: { label: string; texto: string }) {
  return (
    <p className="mt-2 text-[12px] text-zinc-600">
      <span className="font-medium text-zinc-500">{label}: </span>
      {texto}
    </p>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="text-center text-[12px] text-zinc-400 italic py-12">{texto}</p>
}

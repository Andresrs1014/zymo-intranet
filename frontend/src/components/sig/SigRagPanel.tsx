import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { Database, Loader, AlertTriangle, RefreshCw } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface RagStats {
  documentos_indexados: number
  chunks: number
  entidades_grafo: number
  relaciones_grafo: number
}
interface RagStatusData {
  exists: boolean
  rag_id?: string
  stats?: RagStats
  fuentes?: string[]
  archivos_en_directorio?: string[]
}

const AGENTS = {
  rag1: {
    nombre: "Jarvis",
    rol:    "rag1",
    dot:    "bg-emerald-500",
    text:   "text-emerald-700",
    accent: "border-l-emerald-400",
    chip:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    desc:   "Modela la empresa tal como opera hoy: procedimientos vigentes, instructivos y análisis actuales.",
    pregunta: "¿Cómo se ejecuta X proceso actualmente en ZYMO?",
  },
  rag2: {
    nombre: "Ultron",
    rol:    "rag2",
    dot:    "bg-violet-500",
    text:   "text-violet-700",
    accent: "border-l-violet-400",
    chip:   "bg-violet-50 text-violet-700 border-violet-200",
    desc:   "Modela la empresa con sus procedimientos corregidos y optimizados. Solo indexa versiones mejoradas.",
    pregunta: "¿Cómo debería ejecutarse X proceso según las mejoras propuestas?",
  },
} as const

const KEY_FILES = [
  { file: "graph_chunk_entity_relation.graphml", label: "Grafo de entidades y relaciones" },
  { file: "kv_store_full_docs.json",             label: "Documentos completos" },
  { file: "kv_store_text_chunks.json",           label: "Fragmentos de texto" },
  { file: "kv_store_llm_response_cache.json",    label: "Caché de respuestas" },
  { file: "vdb_chunks.json",                     label: "Vector DB — fragmentos" },
  { file: "vdb_entities.json",                   label: "Vector DB — entidades" },
]

// ── Componente ─────────────────────────────────────────────────────────────────

export function SigRagPanel() {
  const [activeRag, setActiveRag] = useState<"rag1" | "rag2">("rag1")

  const { data: ragData, isLoading, refetch, isFetching } = useQuery<RagStatusData>({
    queryKey: ["sig", "rag-panel", activeRag],
    queryFn:  () => api.get(`/api/netvault/rag-status?rag_id=${activeRag}`).then((r) => r.data),
    staleTime: 30_000,
  })

  const agent = AGENTS[activeRag]
  const s     = ragData?.stats
  const files = ragData?.archivos_en_directorio ?? []
  const filesExtra = files.filter((f) => !KEY_FILES.some((k) => k.file === f)).length

  return (
    <div className="h-full overflow-auto bg-zinc-50">
      <div className="max-w-3xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <Database className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-zinc-800">Grafo de conocimiento</h1>
              <p className="text-xs text-zinc-500">Qué tanto sabe la IA de la empresa, y de dónde lo sacó</p>
            </div>
          </div>
          <button
            onClick={() => { void refetch() }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-white transition-colors shrink-0"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Actualizar
          </button>
        </div>

        {/* Agent tabs */}
        <div className="flex gap-2 mb-5">
          {(["rag1", "rag2"] as const).map((rid) => {
            const a = AGENTS[rid]
            const active = activeRag === rid
            return (
              <button
                key={rid}
                onClick={() => setActiveRag(rid)}
                className={cn(
                  "flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-left transition-colors",
                  active ? "bg-white border-zinc-300 shadow-sm" : "bg-white/60 border-zinc-200 hover:bg-white",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", a.dot)} />
                <div className="min-w-0">
                  <span className={cn("text-sm font-semibold", active ? a.text : "text-zinc-500")}>{a.nombre}</span>
                  <span className="text-[11px] text-zinc-400 ml-1.5">{a.rol}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Agent description */}
        <div className={cn("bg-white rounded-lg pl-4 pr-4 py-3.5 border-l-[3px] mb-5", agent.accent)}>
          <p className="text-[13px] text-zinc-600 leading-relaxed">{agent.desc}</p>
          <p className="text-[12px] text-zinc-400 italic mt-1.5">Responde preguntas como: "{agent.pregunta}"</p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-14 gap-2 text-zinc-400">
            <Loader className="h-4 w-4 animate-spin" />
            <span className="text-xs">Consultando el grafo…</span>
          </div>
        )}

        {!isLoading && ragData && !ragData.exists && (
          <div className="bg-white rounded-lg pl-4 pr-4 py-5 border-l-[3px] border-l-amber-300 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-700">Todavía no hay nada indexado</p>
            <p className="text-xs text-zinc-500 mt-1">
              Usa el botón "RAG" dentro de cualquier procedimiento para empezar a indexar.
            </p>
          </div>
        )}

        {!isLoading && s && (
          <>
            {/* Stats — lo primero y más grande, es lo que realmente importa de un vistazo */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {([
                { k: "Documentos",  v: s.documentos_indexados },
                { k: "Fragmentos",  v: s.chunks },
                { k: "Entidades",   v: s.entidades_grafo },
                { k: "Relaciones",  v: s.relaciones_grafo },
              ]).map(({ k, v }) => (
                <div key={k} className="bg-white rounded-lg py-3.5 text-center shadow-sm">
                  <p className={cn("text-2xl font-semibold tabular-nums", agent.text)}>{v}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{k}</p>
                </div>
              ))}
            </div>

            {/* Pipeline — explicación simple de cómo se llega a esos números */}
            <div className="bg-white rounded-lg px-4 py-3.5 mb-5 shadow-sm">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2.5">Cómo se arma</p>
              <div className="flex items-center gap-1.5 flex-wrap text-[12px] text-zinc-500">
                <span className="text-zinc-700 font-medium">{s.documentos_indexados} documentos</span>
                <span className="text-zinc-300">→ se dividen en →</span>
                <span className="text-zinc-700 font-medium">{s.chunks} fragmentos</span>
                <span className="text-zinc-300">→ la IA extrae →</span>
                <span className="text-zinc-700 font-medium">{s.entidades_grafo} entidades</span>
                <span className="text-zinc-300">y</span>
                <span className="text-zinc-700 font-medium">{s.relaciones_grafo} relaciones</span>
              </div>
            </div>
          </>
        )}

        {/* Fuentes indexadas */}
        {!isLoading && ragData?.fuentes && ragData.fuentes.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2">
              Fuentes indexadas ({ragData.fuentes.length})
            </p>
            <div className="bg-white rounded-lg divide-y divide-zinc-100 shadow-sm max-h-48 overflow-y-auto">
              {ragData.fuentes.map((f, i) => {
                const name = f.split("/").pop() ?? f
                return (
                  <div key={i} className="flex items-center gap-2.5 px-4 py-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", agent.dot)} />
                    <span className="text-[12px] text-zinc-700 truncate flex-1" title={f}>{name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Archivos internos — técnico, se colapsa visualmente al final */}
        {!isLoading && files.length > 0 && (
          <details className="group">
            <summary className="text-[11px] text-zinc-400 uppercase tracking-wide cursor-pointer hover:text-zinc-600 transition-colors select-none">
              Archivos internos del grafo ({files.length})
            </summary>
            <div className="bg-white rounded-lg px-4 py-3 mt-2 space-y-1 shadow-sm">
              {KEY_FILES.map(({ file, label }) => {
                const exists = files.includes(file)
                return (
                  <div key={file} className="flex items-center gap-2 text-[12px]">
                    <span className={exists ? "text-emerald-500" : "text-zinc-300"}>
                      {exists ? "✓" : "○"}
                    </span>
                    <span className={exists ? "text-zinc-600" : "text-zinc-400"}>{label}</span>
                  </div>
                )
              })}
              {filesExtra > 0 && (
                <p className="text-[11px] text-zinc-400 pt-1">+{filesExtra} archivos adicionales</p>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

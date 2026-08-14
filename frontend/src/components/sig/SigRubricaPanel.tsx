import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ClipboardCheck, Info, Target, Lightbulb, GitCompare, Users, Database, Loader, Pencil, Save, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"

// ── Catálogo de análisis — de menor a mayor costo para el agente. Los datos
// (nombre, costo, descripción, dónde corre) vienen de `GET /api/netvault/analysis-kinds`
// (tabla `analysis_kinds`, backend/app/models/analysis_kind.py) — editables con el
// lápiz, igual que la rúbrica de abajo. El ícono y el color del costo no viven en
// la BD (no son datos del negocio) — se resuelven acá por id/costo.

interface AnalysisKindData {
  id: string
  name: string
  cost: "bajo" | "medio" | "alto"
  description: string
  where_text: string
}

const KIND_ICONS: Record<string, React.ReactNode> = {
  coherencia:    <Target className="h-3.5 w-3.5" />,
  mejoras:       <Lightbulb className="h-3.5 w-3.5" />,
  "proc-vs-inst": <GitCompare className="h-3.5 w-3.5" />,
  cargos:        <Users className="h-3.5 w-3.5" />,
  completo:      <ClipboardCheck className="h-3.5 w-3.5" />,
  lightrag:      <Database className="h-3.5 w-3.5" />,
}

const COST_COLORS: Record<string, string> = {
  bajo:  "text-blue-600 bg-blue-50",
  medio: "text-violet-600 bg-violet-50",
  alto:  "text-helix-accent bg-helix-accent/10",
}

// ── Datos — se traen del endpoint real `GET /api/netvault/rubrica`
// (backend/app/routers/netvault.py). Las categorías viven en la tabla
// `rubrica_categorias` — editables una por una con `PATCH /api/netvault/rubrica/{id}`
// (requiere permiso mod_sig, igual que el resto del SIG).

interface RubricCategory {
  id: string
  name: string
  weight: number
  description: string
  checks: string[]
}

interface RubricaResponse {
  version: string
  categorias: RubricCategory[]
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function SigRubricaPanel() {
  const user = useAuthStore((s) => s.user)
  const canEditSig = user?.role === "admin" || user?.role === "gerente"
    || (user?.app_permissions?.includes("mod_sig") ?? false)

  const { data, isLoading, isError } = useQuery<RubricaResponse>({
    queryKey: ["sig", "rubrica"],
    queryFn: () => api.get("/api/netvault/rubrica").then((r) => r.data),
  })

  const { data: kinds = [], isLoading: kindsLoading } = useQuery<AnalysisKindData[]>({
    queryKey: ["sig", "analysis-kinds"],
    queryFn: () => api.get("/api/netvault/analysis-kinds").then((r) => r.data),
  })

  const categories = data?.categorias ?? []

  return (
    <div className="h-full overflow-auto bg-zinc-50">
      <div className="max-w-3xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-1">
          <div className="h-8 w-8 rounded-lg bg-helix-accent/10 border border-helix-accent/20 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-4 w-4 text-helix-accent" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-800">Análisis</h1>
            <p className="text-xs text-zinc-500">{kinds.length} tipos disponibles, de menor a mayor costo</p>
          </div>
        </div>

        {/* Catálogo de tipos de análisis */}
        {kindsLoading && (
          <div className="flex items-center gap-2 text-zinc-400 py-6 justify-center">
            <Loader className="h-4 w-4 animate-spin" />
            <span className="text-xs">Cargando catálogo…</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5 mt-5 mb-8">
          {kinds.map((k) => (
            <AnalysisKindCard key={k.id} kind={k} canEdit={canEditSig} />
          ))}
        </div>

        {/* Rúbrica del análisis completo */}
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-zinc-800">Rúbrica del análisis completo</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {data ? `Versión ${data.version} · ${categories.length} categorías` : "Cargando…"}
          </p>
        </div>

        {/* Explicación en lenguaje simple */}
        <div className="flex items-start gap-2 mb-6 text-xs text-zinc-500 leading-relaxed">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-400" />
          <p>
            Cada categoría tiene un peso (cuánto cuenta en el resultado final) y una lista de puntos que se revisan.
            {canEditSig && " Podés editar cada una con el lápiz."}
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-400 py-10 justify-center">
            <Loader className="h-4 w-4 animate-spin" />
            <span className="text-xs">Cargando rúbrica…</span>
          </div>
        )}

        {isError && (
          <div className="bg-white rounded-lg pl-4 pr-4 py-3.5 border-l-[3px] border-l-red-300 text-xs text-red-600">
            No se pudo cargar la rúbrica del servidor.
          </div>
        )}

        {/* Categorías */}
        <div className="space-y-3">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} canEdit={canEditSig} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de tipo de análisis ────────────────────────────────────────────────

function AnalysisKindCard({ kind, canEdit }: { kind: AnalysisKindData; canEdit: boolean }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(kind)

  const mutation = useMutation({
    mutationFn: (patch: { name: string; cost: string; description: string; where_text: string }) =>
      api.patch(`/api/netvault/analysis-kinds/${kind.id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig", "analysis-kinds"] })
      setEditing(false)
    },
  })

  function startEdit() {
    setDraft(kind)
    setEditing(true)
  }

  function save() {
    mutation.mutate({
      name: draft.name,
      cost: draft.cost,
      description: draft.description,
      where_text: draft.where_text,
    })
  }

  const shown = editing ? draft : kind

  return (
    <div className={cn("bg-white rounded-lg px-3.5 py-3 shadow-sm", editing && "ring-1 ring-helix-accent")}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 text-zinc-700 min-w-0 flex-1">
          {KIND_ICONS[kind.id]}
          {editing ? (
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="text-[13px] font-medium border border-zinc-200 rounded px-1.5 py-0.5 min-w-0 flex-1 focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
            />
          ) : (
            <span className="text-[13px] font-medium truncate">{shown.name}</span>
          )}
        </div>
        {editing ? (
          <select
            value={draft.cost}
            onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value as AnalysisKindData["cost"] }))}
            className="text-[10px] px-1 py-0.5 rounded border border-zinc-200 shrink-0"
          >
            <option value="bajo">bajo</option>
            <option value="medio">medio</option>
            <option value="alto">alto</option>
          </select>
        ) : (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", COST_COLORS[kind.cost])}>
            {shown.cost}
          </span>
        )}
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            className="text-zinc-300 hover:text-helix-accent transition-colors shrink-0"
            title={`Editar ${kind.name}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          rows={2}
          className="w-full text-[12px] text-zinc-600 leading-relaxed border border-zinc-200 rounded px-2 py-1 mb-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
        />
      ) : (
        <p className="text-[12px] text-zinc-500 leading-relaxed mb-1.5">{shown.description}</p>
      )}

      {editing ? (
        <textarea
          value={draft.where_text}
          onChange={(e) => setDraft((d) => ({ ...d, where_text: e.target.value }))}
          rows={2}
          className="w-full text-[11px] text-zinc-500 italic border border-zinc-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
        />
      ) : (
        <p className="text-[11px] text-zinc-400 italic">{shown.where_text}</p>
      )}

      {editing && (
        <div className="flex items-center gap-2 pt-2">
          {mutation.isError && (
            <span className="text-[11px] text-red-500 mr-auto">No se pudo guardar.</span>
          )}
          <button
            onClick={() => setEditing(false)}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded text-zinc-500 hover:text-zinc-700 transition-colors ml-auto"
          >
            <X className="h-3 w-3" />
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-helix-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {mutation.isPending ? <Loader className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Guardar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de categoría ───────────────────────────────────────────────────────

function CategoryCard({ category, canEdit }: { category: RubricCategory; canEdit: boolean }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(category)

  const mutation = useMutation({
    mutationFn: (patch: { weight: number; description: string; checks: string[] }) =>
      api.patch(`/api/netvault/rubrica/${category.id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig", "rubrica"] })
      setEditing(false)
    },
  })

  function startEdit() {
    setDraft(category)
    setEditing(true)
  }

  function save() {
    mutation.mutate({
      weight: draft.weight,
      description: draft.description,
      checks: draft.checks,
    })
  }

  const shown = editing ? draft : category

  return (
    <div
      className={cn(
        "bg-white rounded-lg pl-4 pr-4 py-3.5 border-l-[3px]",
        editing ? "border-l-helix-accent" : "border-l-zinc-200",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h2 className="text-sm font-semibold text-zinc-800">{shown.name}</h2>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-zinc-400">peso</span>
          {editing ? (
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={draft.weight}
              onChange={(e) => setDraft((d) => ({ ...d, weight: Number(e.target.value) || 0 }))}
              className="w-14 text-[11px] text-zinc-700 border border-zinc-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
            />
          ) : (
            <span className="text-[11px] text-zinc-600 font-medium tabular-nums">{shown.weight.toFixed(1)}</span>
          )}
          {canEdit && !editing && (
            <button
              onClick={startEdit}
              className="text-zinc-300 hover:text-helix-accent transition-colors"
              title={`Editar ${category.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          rows={2}
          className="w-full text-[13px] text-zinc-600 leading-relaxed border border-zinc-200 rounded px-2.5 py-1.5 mb-2 resize-none focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
        />
      ) : (
        <p className="text-[13px] text-zinc-600 leading-relaxed mb-2">{shown.description}</p>
      )}

      {editing ? (
        <div className="mb-2">
          <p className="text-[11px] text-zinc-400 mb-1">Puntos a revisar (uno por línea)</p>
          <textarea
            value={draft.checks.join("\n")}
            onChange={(e) => setDraft((d) => ({ ...d, checks: e.target.value.split("\n") }))}
            rows={Math.max(3, draft.checks.length)}
            className="w-full text-[12px] text-zinc-600 leading-relaxed border border-zinc-200 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
          />
        </div>
      ) : (
        <ul className="space-y-1">
          {shown.checks.map((check, i) => (
            <li key={i} className="text-[12px] text-zinc-500 flex items-start gap-1.5">
              <span className="text-zinc-300 mt-0.5">·</span>
              <span>{check}</span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="flex items-center gap-2 pt-1">
          {mutation.isError && (
            <span className="text-[11px] text-red-500 mr-auto">No se pudo guardar.</span>
          )}
          <button
            onClick={() => setEditing(false)}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded text-zinc-500 hover:text-zinc-700 transition-colors ml-auto"
          >
            <X className="h-3 w-3" />
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-helix-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {mutation.isPending ? <Loader className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Guardar
          </button>
        </div>
      )}
    </div>
  )
}

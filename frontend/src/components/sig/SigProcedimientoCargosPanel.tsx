import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Search, Users, Check, AlertTriangle, Loader, BookOpen } from "lucide-react"

export interface ProcCargoAsignado {
  id: number
  procedimientoId: number
  cargoId: number
  cargoNombre: string
}

interface TcCargo {
  id: number
  nombre: string
  area_id: number | null
  manual_url?: string
  manual_filename?: string
  tiene_manual?: boolean
}

interface Props {
  procedimientoId: number
  canEdit: boolean
}

export function SigProcedimientoCargosPanel({ procedimientoId, canEdit }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState<Set<number> | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const { data: asignados = [], isLoading: loadingAsignados } = useQuery<ProcCargoAsignado[]>({
    queryKey: ["sig", "proc-cargos", procedimientoId],
    queryFn: () => sigApi.get(`/api/procedimientos/${procedimientoId}/cargos`).then((r) => r.data),
  })

  const { data: tcCargos = [], isLoading: loadingTc } = useQuery<TcCargo[]>({
    queryKey: ["tc", "cargos-sig"],
    queryFn: () => api.get("/tc/cargos-sig").then((r) => r.data),
    staleTime: 60_000,
  })

  const selected = draft ?? new Set(asignados.map((a) => a.cargoId))
  const dirty = draft !== null

  const tcById = useMemo(() => new Map(tcCargos.map((c) => [c.id, c])), [tcCargos])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = [...tcCargos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    if (!q) return list
    return list.filter((c) => c.nombre.toLowerCase().includes(q))
  }, [tcCargos, search])

  const saveMutation = useMutation({
    mutationFn: async (cargoIds: number[]) => {
      const cargos = cargoIds.map((cargoId) => {
        const tc = tcById.get(cargoId)
        if (!tc) throw new Error(`Cargo ${cargoId} no encontrado en T&C`)
        return { cargoId, cargoNombre: tc.nombre }
      })
      return sigApi.put(`/api/procedimientos/${procedimientoId}/cargos`, { cargos })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig", "proc-cargos", procedimientoId] })
      qc.invalidateQueries({ queryKey: ["sig", "procedimiento", procedimientoId] })
      setDraft(null)
      setMsg("Cargos guardados")
      setTimeout(() => setMsg(null), 2500)
    },
    onError: () => setMsg("Error al guardar cargos"),
  })

  function toggle(id: number) {
    if (!canEdit) return
    setDraft((prev) => {
      const base = prev ?? new Set(asignados.map((a) => a.cargoId))
      const next = new Set(base)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave() {
    void saveMutation.mutateAsync(Array.from(selected))
  }

  function handleCancel() {
    setDraft(null)
  }

  const sinManualAsignados = asignados.filter((a) => !tcById.get(a.cargoId)?.tiene_manual)
  const loading = loadingAsignados || loadingTc

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-4 w-4 text-rose-500" />
          <h2 className="text-sm font-semibold text-zinc-800 font-mono">Cargos involucrados</h2>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Selecciona los cargos de T&amp;C que aplican a este procedimiento. El análisis «Cargos» solo
          comparará estos roles contra sus manuales de funciones.
        </p>
      </div>

      {!loading && asignados.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 font-mono">
            Sin cargos asignados — el análisis de cargos no se puede ejecutar hasta que selecciones al menos uno.
          </p>
        </div>
      )}

      {!loading && sinManualAsignados.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <BookOpen className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-600 font-mono">
            {sinManualAsignados.length} cargo(s) asignado(s) sin manual en T&amp;C:{" "}
            {sinManualAsignados.map((a) => a.cargoNombre).join(", ")} — quedarán como NO_DEFINIDO.
          </p>
        </div>
      )}

      {canEdit && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cargo…"
            aria-label="Buscar cargo"
            className="w-full h-8 pl-8 pr-3 text-[11px] font-mono border border-zinc-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-helix-accent text-zinc-700"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 py-6 justify-center">
          <Loader className="h-3.5 w-3.5 animate-spin" />
          <span className="text-[11px] font-mono">Cargando cargos…</span>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100 bg-white">
          {filtered.length === 0 && (
            <p className="text-[11px] text-zinc-400 font-mono px-3 py-4 text-center">Sin coincidencias</p>
          )}
          {filtered.map((cargo) => {
            const checked = selected.has(cargo.id)
            const tieneManual = cargo.tiene_manual ?? !!cargo.manual_url
            return (
              <label
                key={cargo.id}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors",
                  canEdit ? "hover:bg-zinc-50" : "cursor-default",
                  checked && "bg-rose-50/60",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canEdit}
                  onChange={() => toggle(cargo.id)}
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="flex-1 min-w-0 text-[12px] text-zinc-700 truncate">{cargo.nombre}</span>
                <span
                  className={cn(
                    "shrink-0 text-[9px] px-1.5 py-0.5 rounded border font-mono",
                    tieneManual
                      ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                      : "text-zinc-400 border-zinc-200 bg-zinc-50",
                  )}
                >
                  {tieneManual ? "manual" : "sin manual"}
                </span>
              </label>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
          {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          {dirty && " · cambios sin guardar"}
        </span>
        {canEdit && dirty && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="text-[10px] font-mono px-2.5 py-1 rounded border border-zinc-200 text-zinc-500 hover:text-zinc-700"
            >
              Descartar
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => void handleSave()}
              className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Guardar cargos
            </button>
          </div>
        )}
        {msg && <span className="text-[10px] text-emerald-600 font-mono">{msg}</span>}
      </div>
    </div>
  )
}

/** IDs de cargos T&C asignados al procedimiento (para análisis IA). */
export async function fetchProcCargoIds(procedimientoId: number): Promise<number[]> {
  const { data } = await sigApi.get<ProcCargoAsignado[]>(`/api/procedimientos/${procedimientoId}/cargos`)
  return data.map((c) => c.cargoId)
}

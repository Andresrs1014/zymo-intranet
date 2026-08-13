import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Search, Users, Check, AlertTriangle, Loader, BookOpen, X, FileText, Paperclip } from "lucide-react"

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
  tiene_archivo?: boolean
  tiene_manual?: boolean
  texto_chars?: number
}

interface Props {
  procedimientoId: number
  canEdit: boolean
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

export function SigProcedimientoCargosPanel({ procedimientoId, canEdit }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Set<number> | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [viewingManual, setViewingManual] = useState<TcCargo | null>(null)

  const { data: asignadosRaw, isLoading: loadingAsignados, isError: errorAsignados } = useQuery<unknown>({
    queryKey: ["sig", "proc-cargos", procedimientoId],
    queryFn: () => sigApi.get(`/api/procedimientos/${procedimientoId}/cargos`).then((r) => r.data),
  })
  const asignados = asArray<ProcCargoAsignado>(asignadosRaw)

  const { data: tcCargosRaw, isLoading: loadingTc, isError: errorTc } = useQuery<unknown>({
    queryKey: ["tc", "cargos-sig"],
    queryFn: () => api.get("/tc/cargos-sig").then((r) => r.data),
    staleTime: 60_000,
  })
  const tcCargos = asArray<TcCargo>(tcCargosRaw)

  const selected = draft ?? new Set(asignados.map((a) => a.cargoId))
  const dirty = draft !== null

  const tcById = useMemo(() => new Map(tcCargos.map((c) => [c.id, c])), [tcCargos])

  // Solo cargos NO seleccionados — el buscador es para agregar, no para ver los que ya están.
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = tcCargos
      .filter((c) => !selected.has(c.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    if (!q) return list
    return list.filter((c) => c.nombre.toLowerCase().includes(q))
  }, [tcCargos, search, selected])

  const selectedCargos = useMemo(
    () =>
      Array.from(selected)
        .map((id) => tcById.get(id))
        .filter((c): c is TcCargo => !!c)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [selected, tcById],
  )

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

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
  const archivoSinTexto = asignados.filter((a) => {
    const tc = tcById.get(a.cargoId)
    return tc && (tc.tiene_archivo ?? !!tc.manual_url) && !tc.tiene_manual
  })
  const loading = loadingAsignados || loadingTc
  const loadError = errorAsignados || errorTc || (!loading && tcCargosRaw != null && !Array.isArray(tcCargosRaw))

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

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-800 font-mono">
            No se pudo cargar el listado de cargos T&amp;C. Verifica que el backend esté desplegado y recarga la página.
          </p>
        </div>
      )}

      {!loading && asignados.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 font-mono">
            Sin cargos asignados — el análisis de cargos no se puede ejecutar hasta que selecciones al menos uno.
          </p>
        </div>
      )}

      {!loading && archivoSinTexto.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 font-mono">
            {archivoSinTexto.length} cargo(s) tienen archivo en T&amp;C pero sin texto extraído para IA:{" "}
            {archivoSinTexto.map((a) => a.cargoNombre).join(", ")} — en T&amp;C use «Re-extraer texto».
          </p>
        </div>
      )}

      {!loading && sinManualAsignados.length > 0 && archivoSinTexto.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <BookOpen className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-600 font-mono">
            {sinManualAsignados.length} cargo(s) asignado(s) sin manual en T&amp;C:{" "}
            {sinManualAsignados.map((a) => a.cargoNombre).join(", ")} — quedarán como NO_DEFINIDO.
          </p>
        </div>
      )}

      {canEdit && (
        <div className="relative" ref={searchBoxRef}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 z-10" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Buscar cargo para agregar…"
            aria-label="Buscar cargo para agregar"
            className="w-full h-8 pl-8 pr-3 text-[11px] font-mono border border-zinc-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-helix-accent text-zinc-700"
          />
          {searchOpen && (
            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100 bg-white shadow-lg">
              {searchResults.length === 0 && (
                <p className="text-[11px] text-zinc-400 font-mono px-3 py-3 text-center">
                  {search.trim() ? "Sin coincidencias" : "Todos los cargos ya están agregados"}
                </p>
              )}
              {searchResults.map((cargo) => (
                <button
                  key={cargo.id}
                  type="button"
                  onClick={() => { toggle(cargo.id); setSearch(""); setSearchOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 transition-colors"
                >
                  <span className="flex-1 min-w-0 text-[12px] text-zinc-700 truncate">{cargo.nombre}</span>
                  <span className="shrink-0 text-[11px] text-helix-accent font-mono">+ agregar</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 py-6 justify-center">
          <Loader className="h-3.5 w-3.5 animate-spin" />
          <span className="text-[11px] font-mono">Cargando cargos…</span>
        </div>
      ) : selectedCargos.length === 0 ? (
        <p className="text-[11px] text-zinc-400 font-mono px-3 py-4 text-center border border-dashed border-zinc-200 rounded-lg">
          Sin cargos seleccionados — usa el buscador de arriba para agregar.
        </p>
      ) : (
        <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100 bg-white">
          {selectedCargos.map((cargo) => {
            const tieneArchivo = cargo.tiene_archivo ?? !!cargo.manual_url
            const tieneManual = !!cargo.tiene_manual
            const badge =
              tieneManual ? "Manual de funciones"
              : tieneArchivo ? "archivo sin texto"
              : "sin manual"
            return (
              <div key={cargo.id} className="flex items-center gap-2.5 px-3 py-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => toggle(cargo.id)}
                    title="Quitar cargo"
                    className="shrink-0 text-zinc-300 hover:text-rose-600 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <span className="flex-1 min-w-0 text-[12px] text-zinc-700 truncate">{cargo.nombre}</span>
                {tieneManual ? (
                  <button
                    type="button"
                    onClick={() => setViewingManual(cargo)}
                    title="Ver manual de funciones"
                    className="shrink-0 text-[11px] px-1.5 py-0.5 rounded border font-mono max-w-[140px] truncate text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    {badge}
                  </button>
                ) : (
                  <span
                    className={cn(
                      "shrink-0 text-[11px] px-1.5 py-0.5 rounded border font-mono max-w-[100px] truncate",
                      tieneArchivo
                        ? "text-amber-700 border-amber-200 bg-amber-50"
                        : "text-zinc-400 border-zinc-200 bg-zinc-50",
                    )}
                    title={badge}
                  >
                    {badge}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] text-zinc-400 font-mono tabular-nums">
          {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          {dirty && " · cambios sin guardar"}
        </span>
        {canEdit && dirty && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="text-[11px] font-mono px-2.5 py-1 rounded border border-zinc-200 text-zinc-500 hover:text-zinc-700"
            >
              Descartar
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => void handleSave()}
              className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
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
        {msg && <span className="text-[11px] text-emerald-600 font-mono">{msg}</span>}
      </div>

      {viewingManual && (
        <CargoManualModal cargo={viewingManual} onClose={() => setViewingManual(null)} />
      )}
    </div>
  )
}

// ── Modal del manual de funciones ─────────────────────────────────────────────

function CargoManualModal({ cargo, onClose }: { cargo: TcCargo; onClose: () => void }) {
  const url = cargo.manual_url ?? ""
  const ext = (cargo.manual_filename ?? url).split(".").pop()?.toLowerCase() ?? ""
  const isPdf = ext === "pdf"
  const isDocx = ext === "docx"
  const isDocOld = ext === "doc"
  const isExcel = ext === "xlsx" || ext === "xls" || ext === "xlsm"

  const [docTab, setDocTab] = useState<"original" | "funciones">("original")

  const [loading, setLoading] = useState(isDocx || isExcel)
  const [error, setError] = useState<string | null>(null)
  const docxRef = useRef<HTMLDivElement>(null)
  const [sheet, setSheet] = useState<string[][] | null>(null)

  const [textLoading, setTextLoading] = useState(true)
  const [textError, setTextError] = useState<string | null>(null)
  const [docText, setDocText] = useState<string | null>(null)

  // .docx nuevo — se renderiza con el archivo real
  useEffect(() => {
    if (!isDocx || !url) return
    setLoading(true)
    setError(null)
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.arrayBuffer()
      })
      .then((buf) => {
        if (!docxRef.current) return
        return import("docx-preview").then(({ renderAsync }) =>
          renderAsync(buf, docxRef.current!, undefined, { className: "docx-render", inWrapper: false }),
        )
      })
      .catch(() => setError("No se pudo cargar el documento."))
      .finally(() => setLoading(false))
  }, [url, isDocx])

  // Excel viejo (.xls) y nuevo (.xlsx/.xlsm) — se parsea en el navegador, misma librería para ambos
  useEffect(() => {
    if (!isExcel || !url) return
    setLoading(true)
    setError(null)
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.arrayBuffer()
      })
      .then(async (buf) => {
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buf, { type: "array" })
        const firstSheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, raw: false, blankrows: false })
        setSheet(rows.map((r) => r.map((cell) => cell ?? "")))
      })
      .catch(() => setError("No se pudo leer el archivo de Excel."))
      .finally(() => setLoading(false))
  }, [url, isExcel])

  // Texto extraído (pestaña "Funciones") — el backend lo saca de CUALQUIER
  // formato al subir el manual (pdf/docx/doc/xlsx), no solo de .doc viejo.
  useEffect(() => {
    setTextLoading(true)
    setTextError(null)
    api.get(`/tc/cargos/${cargo.id}/manual-texto`)
      .then((r) => setDocText(r.data?.texto || ""))
      .catch(() => setTextError("No se pudo leer el texto del documento."))
      .finally(() => setTextLoading(false))
  }, [cargo.id])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/50 backdrop-blur-[1px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-6xl h-[90vh] flex flex-col rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">

        <div className="shrink-0 flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-200">
          <div className="h-7 w-7 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <FileText className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-zinc-800 truncate">Manual de funciones</p>
            <p className="text-[11px] text-zinc-500 truncate">{cargo.nombre}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto h-7 w-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 flex items-center gap-1 px-5 pt-2.5 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setDocTab("original")}
            className={cn(
              "px-3 py-1.5 text-[12px] font-medium rounded-t-md border border-b-0",
              docTab === "original"
                ? "border-zinc-200 bg-white text-zinc-800"
                : "border-transparent text-zinc-400 hover:text-zinc-600",
            )}
          >
            Documento original
          </button>
          <button
            type="button"
            onClick={() => setDocTab("funciones")}
            className={cn(
              "px-3 py-1.5 text-[12px] font-medium rounded-t-md border border-b-0",
              docTab === "funciones"
                ? "border-zinc-200 bg-white text-zinc-800"
                : "border-transparent text-zinc-400 hover:text-zinc-600",
            )}
          >
            Funciones
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {docTab === "original" ? (
            <>
              {loading && (
                <div className="h-full flex items-center justify-center gap-2 text-zinc-400">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Cargando documento…</span>
                </div>
              )}

              {!loading && error && (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                  <AlertTriangle className="h-5 w-5 text-zinc-300" />
                  <p className="text-sm text-zinc-500">{error}</p>
                </div>
              )}

              {!loading && !error && isPdf && (
                <iframe src={url} className="w-full h-full border-0" title={cargo.manual_filename ?? "Manual de funciones"} />
              )}

              {!loading && !error && isDocx && (
                <div className="h-full overflow-auto p-6">
                  <div ref={docxRef} className="max-w-5xl mx-auto" />
                </div>
              )}

              {!loading && !error && isExcel && (
                sheet && sheet.length > 0 ? (
                  <div className="h-full overflow-auto p-4">
                    <table className="min-w-full text-[12px] border-collapse">
                      <tbody>
                        {sheet.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="border border-zinc-200 px-2 py-1 text-zinc-700 whitespace-nowrap">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                    Archivo de Excel vacío
                  </div>
                )
              )}

              {!loading && !error && (isDocOld || (!isPdf && !isDocx && !isExcel)) && (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                  <Paperclip className="h-8 w-8 text-zinc-300" />
                  <div className="text-center">
                    <p className="text-sm text-zinc-600">{cargo.manual_filename ?? "Documento"}</p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {isDocOld
                        ? "Formato .doc antiguo — el navegador no puede mostrarlo. Descárgalo para abrirlo en Word."
                        : "Este formato no puede mostrarse acá — descárgalo para verlo."}
                    </p>
                  </div>
                  <a
                    href={url}
                    download={cargo.manual_filename}
                    className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded border border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors"
                  >
                    Descargar documento original
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              {textLoading && (
                <div className="h-full flex items-center justify-center gap-2 text-zinc-400">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Cargando texto…</span>
                </div>
              )}

              {!textLoading && textError && (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                  <AlertTriangle className="h-5 w-5 text-zinc-300" />
                  <p className="text-sm text-zinc-500">{textError}</p>
                </div>
              )}

              {!textLoading && !textError && (
                docText ? (
                  <div className="h-full overflow-auto p-6">
                    <pre className="max-w-5xl mx-auto whitespace-pre-wrap font-sans text-[14px] text-zinc-700 leading-relaxed">
                      {docText}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                    <AlertTriangle className="h-5 w-5 text-zinc-300" />
                    <p className="text-sm text-zinc-500">
                      Este documento no tiene texto extraído todavía — en T&amp;C, usa «Re-extraer texto» sobre este cargo.
                    </p>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** IDs de cargos T&C asignados al procedimiento (para análisis IA). */
export async function fetchProcCargoIds(procedimientoId: number): Promise<number[]> {
  const { data } = await sigApi.get(`/api/procedimientos/${procedimientoId}/cargos`)
  return asArray<ProcCargoAsignado>(data).map((c) => c.cargoId)
}

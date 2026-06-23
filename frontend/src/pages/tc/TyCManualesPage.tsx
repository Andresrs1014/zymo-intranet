import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, Upload, Download, Trash2, Search, BookOpen } from "lucide-react"

interface Area  { id: number; name: string }
interface Cargo {
  id: number
  area_id: number | null
  nombre: string
  manual_url: string
  manual_filename: string
}

const EXT_META: Record<string, { label: string; color: string; bg: string }> = {
  pdf:  { label: "PDF",  color: "#f87171", bg: "rgba(239,68,68,0.12)" },
  docx: { label: "DOCX", color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
  doc:  { label: "DOC",  color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
  xlsx: { label: "XLSX", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  xls:  { label: "XLS",  color: "#34d399", bg: "rgba(52,211,153,0.12)" },
}

export function TyCManualesPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [areas,   setAreas]   = useState<Area[]>([])
  const [cargos,  setCargos]  = useState<Cargo[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [subiendo,   setSubiendo]   = useState<number | null>(null)
  const [eliminando, setEliminando] = useState<number | null>(null)

  const inputRef   = useRef<HTMLInputElement>(null)
  const inputCargo = useRef<number | null>(null)

  useEffect(() => {
    api.get("/areas").then((r) => setAreas(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    cargarCargos()
  }, [])

  function cargarCargos() {
    api.get("/tc/cargos").then((r) => setCargos(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }

  function abrirSelector(cargoId: number) {
    inputCargo.current = cargoId
    inputRef.current?.click()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || inputCargo.current === null) return
    const id = inputCargo.current
    setSubiendo(id)
    const fd = new FormData()
    fd.append("file", file)
    try {
      await api.post(`/tc/cargos/${id}/manual`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      cargarCargos()
    } catch { /* ignore */ }
    finally { setSubiendo(null); inputCargo.current = null; e.target.value = "" }
  }

  async function eliminar(cargoId: number) {
    if (!confirm("¿Eliminar el manual de este cargo?")) return
    setEliminando(cargoId)
    try {
      await api.delete(`/tc/cargos/${cargoId}/manual`)
      cargarCargos()
    } catch { /* ignore */ }
    finally { setEliminando(null) }
  }

  // ── Filtro + agrupación ────────────────────────────────────────────────────
  const busq           = busqueda.trim().toLowerCase()
  const cargosFiltrados = busq
    ? cargos.filter((c) => c.nombre.toLowerCase().includes(busq))
    : cargos

  const areaMap = new Map(areas.map((a) => [a.id, a.name]))

  const porArea = new Map<number | null, Cargo[]>()
  for (const c of cargosFiltrados) {
    const key = c.area_id ?? null
    if (!porArea.has(key)) porArea.set(key, [])
    porArea.get(key)!.push(c)
  }

  const areaIds = ([...porArea.keys()].filter(Boolean) as number[])
    .sort((a, b) => (areaMap.get(a) ?? "").localeCompare(areaMap.get(b) ?? ""))

  const grupos = [
    ...areaIds.map((id) => ({ id, nombre: areaMap.get(id) ?? `Área ${id}`, cargos: porArea.get(id)! })),
    ...(porArea.has(null) ? [{ id: null, nombre: "Sin área", cargos: porArea.get(null)! }] : []),
  ]

  const totalCon = cargos.filter((c) => c.manual_url).length
  const pctTotal = cargos.length ? Math.round((totalCon / cargos.length) * 100) : 0

  return (
    <PageLayout title="T&C — Manuales de funciones" mainClassName="flex-1 flex flex-col overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => navigate("/tc")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            T&C
          </button>
          <span className="text-muted-foreground/30 text-xs">/</span>
          <span className="text-sm font-medium">Manuales de funciones</span>
        </div>

        {/* Stat global */}
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Cobertura global
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums font-mono" style={{ color: "#14b8a6" }}>
                {totalCon}
              </span>
              <span className="text-sm text-muted-foreground">
                / {cargos.length} cargos
              </span>
              <span className="text-xs text-muted-foreground opacity-50">({pctTotal}%)</span>
            </div>
            <div className="mt-2 h-[3px] w-48 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${Math.max(pctTotal, 2)}%`, background: "#14b8a6" }}
              />
            </div>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              aria-label="Buscar cargo"
              placeholder="Buscar cargo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-muted/20 border border-input rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50 focus-visible:border-teal-500/50"
            />
          </div>
        </div>
      </div>

      {/* ── Input oculto ─────────────────────────────────────────────────────── */}
      <input
        ref={inputRef}
        type="file"
        aria-label="Subir manual de funciones"
        accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFile}
      />

      {/* ── Lista ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">

        {grupos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-56 gap-3 text-muted-foreground">
            <BookOpen className="w-10 h-10 opacity-15" />
            <span className="text-sm">
              {busqueda ? "Sin resultados." : "No hay cargos definidos aún."}
            </span>
          </div>
        )}

        {grupos.map((grupo, gIdx) => {
          const con  = grupo.cargos.filter((c) => c.manual_url).length
          const pct  = grupo.cargos.length ? Math.round((con / grupo.cargos.length) * 100) : 0
          const full = con === grupo.cargos.length && grupo.cargos.length > 0

          return (
            <div
              key={grupo.id ?? "sin_area"}
              className="rounded-2xl border overflow-hidden"
              style={{
                borderColor: full ? "rgba(20,184,166,0.35)" : "rgba(255,255,255,0.07)",
                animationDelay: `${gIdx * 60}ms`,
              }}
            >
              {/* Cabecera de área */}
              <div className="flex items-center justify-between px-5 py-3 bg-muted/10">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold tracking-tight">{grupo.nombre}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {con}/{grupo.cargos.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-[3px] bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        background: full ? "#14b8a6" : "#6366f1",
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Filas de cargos */}
              <div className="divide-y divide-border/30">
                {grupo.cargos.map((cargo, cIdx) => {
                  const ext   = cargo.manual_filename.split(".").pop()?.toLowerCase() ?? ""
                  const meta  = EXT_META[ext]
                  const tiene = !!cargo.manual_url
                  const isSubiendo = subiendo === cargo.id

                  return (
                    <div
                      key={cargo.id}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors group"
                      style={{
                        animationDelay: `${gIdx * 60 + cIdx * 30}ms`,
                        borderLeft: tiene ? "2px solid rgba(20,184,166,0.4)" : "2px solid transparent",
                      }}
                    >
                      {/* Nombre */}
                      <span className="text-sm font-medium flex-1 min-w-0 truncate leading-tight">
                        {cargo.nombre}
                      </span>

                      {/* Estado del archivo */}
                      {tiene ? (
                        <div className="flex items-center gap-2 shrink-0">
                          {meta && (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide"
                              style={{ color: meta.color, background: meta.bg }}
                            >
                              {meta.label}
                            </span>
                          )}
                          <span
                            className="text-[11px] text-muted-foreground truncate max-w-[180px] font-mono"
                            title={cargo.manual_filename}
                          >
                            {cargo.manual_filename}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/30 italic shrink-0">
                          sin manual
                        </span>
                      )}

                      {/* Acciones */}
                      <div className="flex items-center gap-1 shrink-0">
                        {tiene && (
                          <a
                            href={cargo.manual_url}
                            download={cargo.manual_filename}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium border border-border/60 rounded-lg text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            Ver
                          </a>
                        )}

                        {puedeEditar && (
                          <button
                            onClick={() => abrirSelector(cargo.id)}
                            disabled={isSubiendo}
                            className="flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium rounded-lg transition-colors disabled:opacity-40"
                            style={
                              tiene
                                ? { border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8" }
                                : {
                                    border: "1px dashed rgba(20,184,166,0.5)",
                                    color: "rgba(20,184,166,0.8)",
                                    background: "rgba(20,184,166,0.04)",
                                  }
                            }
                          >
                            {isSubiendo ? (
                              <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent motion-safe:animate-spin" />
                                Subiendo
                              </span>
                            ) : (
                              <>
                                <Upload className="w-2.5 h-2.5" />
                                {tiene ? "Reemplazar" : "Subir manual"}
                              </>
                            )}
                          </button>
                        )}

                        {puedeEditar && tiene && (
                          <button
                            onClick={() => eliminar(cargo.id)}
                            disabled={eliminando === cargo.id}
                            aria-label={`Eliminar manual de ${cargo.nombre}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/8 opacity-0 group-hover:opacity-100 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </PageLayout>
  )
}

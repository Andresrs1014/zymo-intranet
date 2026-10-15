import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import { Gauge, UploadCloud, Loader, TriangleAlert } from "lucide-react"
import {
  alertasDe, estadoDe, fmtPeriodo, parseMeta,
  type Area, type Estado, type Indicador,
} from "@/lib/sigIndicadores"
import { SigIndicadorFila } from "./SigIndicadorFila"

type Filtro = Estado | "sin_medir" | "por_revisar" | "todos"

/** Estado actual del indicador: el de su último resultado, o «sin_medir» si la hoja aún no trae ninguno. */
function estadoActual(k: Indicador): Estado | "sin_medir" {
  const ultimo = k.resultados[k.resultados.length - 1]
  return ultimo ? estadoDe(ultimo.resultado, parseMeta(k.meta, k.tendencia)) : "sin_medir"
}

const SEGMENTOS: { clave: Estado | "sin_medir"; texto: string; barra: string; punto: string }[] = [
  { clave: "cumple", texto: "Cumplen", barra: "bg-kpi-ok", punto: "bg-kpi-ok" },
  { clave: "cerca", texto: "Cerca de la meta", barra: "bg-kpi-warn", punto: "bg-kpi-warn" },
  { clave: "incumple", texto: "No cumplen", barra: "bg-kpi-bad", punto: "bg-kpi-bad" },
  { clave: "sin_meta", texto: "Sin meta numérica", barra: "bg-kpi-300", punto: "bg-kpi-300" },
  { clave: "sin_medir", texto: "Sin medir aún", barra: "bg-kpi-100", punto: "border border-dashed border-kpi-300" },
]

function Resumen({ lista, corte, filtro, onFiltro }: {
  lista: Indicador[]; corte: string | null; filtro: Filtro; onFiltro: (f: Filtro) => void
}) {
  const conteo = useMemo(() => {
    const c: Record<string, number> = {}
    for (const k of lista) c[estadoActual(k)] = (c[estadoActual(k)] ?? 0) + 1
    return c
  }, [lista])
  const porRevisar = lista.filter((k) => alertasDe(k.evaluacion).length > 0).length
  const medidos = lista.length - (conteo.sin_medir ?? 0)
  const cumplen = conteo.cumple ?? 0
  return (
    <section aria-label="Resumen de cumplimiento" className="rounded-2xl border border-kpi-300/70 bg-white p-5 [animation:kpi-aparece_.5s_cubic-bezier(.2,.8,.2,1)_both]">
      <span aria-hidden className="mb-4 block h-1 w-10 rounded-full bg-kpi-300" />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-[13px] text-kpi-600">Cumplimiento del último corte{corte ? ` · ${corte}` : ""}</p>
          <p className="mt-1.5 flex items-baseline gap-2 text-kpi-900">
            <span className="font-mono text-5xl font-medium leading-none tabular-nums">{cumplen}</span>
            <span className="text-[15px] text-kpi-600">de {medidos} indicadores medidos cumplen su meta</span>
          </p>
        </div>
        <p className="font-mono text-[11px] text-kpi-600">{lista.length} indicadores cargados</p>
      </div>

      <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-kpi-50" role="img"
        aria-label={SEGMENTOS.map((s) => `${s.texto}: ${conteo[s.clave] ?? 0}`).join(", ")}>
        {SEGMENTOS.map((s, i) => (conteo[s.clave] ?? 0) > 0 && (
          <span
            key={s.clave}
            style={{ width: `${((conteo[s.clave] ?? 0) / Math.max(lista.length, 1)) * 100}%`, animationDelay: `${150 + i * 90}ms` }}
            className={cn("h-full origin-left [animation:kpi-barra_.8s_cubic-bezier(.2,.8,.2,1)_both]", s.barra)}
          />
        ))}
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {SEGMENTOS.map((s) => {
          const n = conteo[s.clave] ?? 0
          if (n === 0) return null
          const activo = filtro === s.clave
          return (
            <li key={s.clave}>
              <button
                type="button"
                aria-pressed={activo}
                onClick={() => onFiltro(activo ? "todos" : s.clave)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-kpi-600",
                  activo ? "border-kpi-900 bg-kpi-900 text-white" : "border-kpi-300/70 bg-white text-kpi-600 hover:border-kpi-300",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", s.punto)} aria-hidden />
                {s.texto}
                <span className={cn("font-mono text-[11px] tabular-nums", activo ? "text-kpi-100" : "text-kpi-900")}>{n}</span>
              </button>
            </li>
          )
        })}
        {porRevisar > 0 && (
          <li>
            <button
              type="button"
              aria-pressed={filtro === "por_revisar"}
              onClick={() => onFiltro(filtro === "por_revisar" ? "todos" : "por_revisar")}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-kpi-600",
                filtro === "por_revisar" ? "border-kpi-900 bg-kpi-900 text-white" : "border-kpi-warn/60 bg-white text-kpi-warn-ink hover:border-kpi-warn",
              )}
            >
              <TriangleAlert className="h-3 w-3" aria-hidden />
              Con puntos por revisar
              <span className="font-mono text-[11px] tabular-nums">{porRevisar}</span>
            </button>
          </li>
        )}
      </ul>
    </section>
  )
}

function AreaChip({ active, label, count, color, onClick }: {
  active: boolean; label: string; count: number; color?: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-kpi-600",
        active ? "border-kpi-900 bg-kpi-900 text-white" : "border-kpi-300/70 bg-white text-kpi-600 hover:border-kpi-300",
      )}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />}
      {label}
      <span className={cn("font-mono text-[10px]", active ? "text-kpi-100" : "text-kpi-600")}>{count}</span>
    </button>
  )
}

export function SigIndicadoresView({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient()
  const [areaId, setAreaId] = useState<number | "todas">("todas")
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const [abierto, setAbierto] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [uploadArea, setUploadArea] = useState<number | "">("")

  const areas = useQuery<Area[]>({
    queryKey: ["sig", "areas"],
    queryFn: async () => (await sigApi.get("/api/areas")).data,
  })
  const indicadores = useQuery<Indicador[]>({
    queryKey: ["sig", "indicadores"],
    queryFn: async () => (await sigApi.get("/api/indicadores")).data,
  })

  const todos = indicadores.data ?? []
  const delArea = useMemo(() => todos.filter((k) => areaId === "todas" || k.area.id === areaId), [todos, areaId])
  const visibles = useMemo(
    () => delArea.filter((k) => filtro === "todos" || (filtro === "por_revisar" ? alertasDe(k.evaluacion).length > 0 : estadoActual(k) === filtro)),
    [delArea, filtro],
  )
  const corte = useMemo(() => {
    const p = delArea.flatMap((k) => k.resultados.map((r) => r.periodo)).sort().pop()
    return p ? fmtPeriodo(p) : null
  }, [delArea])
  const porArea = useMemo(() => {
    const map = new Map<number, Indicador[]>()
    for (const k of visibles) map.set(k.area.id, [...(map.get(k.area.id) ?? []), k])
    return [...map.entries()]
  }, [visibles])

  const subir = useMutation({
    mutationFn: async (files: FileList) => {
      const fd = new FormData()
      fd.append("areaId", String(uploadArea))
      for (const file of files) fd.append("files", file)
      return (await sigApi.post("/api/indicadores/upload", fd)).data as { avisos: string[] }
    },
    onSuccess: (data) => {
      setAviso(data.avisos.length ? data.avisos.join(" · ") : null)
      setAreaId(uploadArea === "" ? "todas" : uploadArea)
      setFiltro("todos")
      qc.invalidateQueries({ queryKey: ["sig", "indicadores"] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setAviso(msg ?? "No se pudieron subir los archivos")
    },
  })

  const borrar = useMutation({
    mutationFn: (id: number) => sigApi.delete(`/api/indicadores/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sig", "indicadores"] }),
    onError: () => setAviso("No se pudo quitar el indicador. Intenta de nuevo."),
  })

  async function descargar(id: number, nombre: string) {
    try {
      const res = await sigApi.get(`/api/indicadores/${id}/archivo`, { responseType: "blob" })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement("a")
      a.href = url
      a.download = nombre
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setAviso("No se pudo descargar el Excel. Intenta de nuevo.")
    }
  }

  const nombresRepetidos = useMemo(() => {
    const veces = new Map<string, number>()
    for (const k of todos) veces.set(`${k.area.id}|${k.nombre}`, (veces.get(`${k.area.id}|${k.nombre}`) ?? 0) + 1)
    return new Set([...veces].filter(([, n]) => n > 1).map(([clave]) => clave))
  }, [todos])

  const conteo = (id: number) => todos.filter((k) => k.area.id === id).length

  return (
    <div className="h-full overflow-y-auto bg-kpi-50">
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-kpi-900">Indicadores de gestión</h1>
            <p className="mt-1 text-[13px] text-kpi-600">Hojas de vida FR-010-GER que cargan los líderes de proceso.</p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 text-[12px]">
              <select
                aria-label="Área de los indicadores a subir"
                value={uploadArea}
                onChange={(e) => setUploadArea(e.target.value ? Number(e.target.value) : "")}
                className="h-9 rounded-lg border border-kpi-300/70 bg-white px-2 text-[12px] text-kpi-900 outline-none focus-visible:ring-2 focus-visible:ring-kpi-600"
              >
                <option value="">Área…</option>
                {(areas.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <label className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 font-mono text-[11px] transition-colors focus-within:ring-2 focus-within:ring-kpi-600",
                uploadArea === "" || subir.isPending
                  ? "pointer-events-none border-kpi-300/70 text-kpi-600"
                  : "border-kpi-300 text-kpi-600 hover:bg-kpi-50",
              )}>
                {subir.isPending ? <Loader className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />}
                Subir Excel
                <input
                  type="file" accept=".xlsx,.xlsm" multiple className="sr-only"
                  disabled={uploadArea === "" || subir.isPending}
                  onChange={(e) => {
                    if (e.target.files?.length) subir.mutate(e.target.files)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>
          )}
        </div>

        {aviso && <p role="status" className="mb-4 rounded-lg border border-kpi-warn/40 bg-kpi-warn/5 px-3 py-2 text-[12px] text-kpi-warn">{aviso}</p>}

        {todos.length > 0 && (
          <>
            <div className="mb-4 flex gap-1.5 overflow-x-auto pb-2">
              <AreaChip active={areaId === "todas"} label="Todas" count={todos.length} onClick={() => { setAreaId("todas"); setFiltro("todos") }} />
              {(areas.data ?? []).filter((a) => conteo(a.id) > 0).map((a) => (
                <AreaChip key={a.id} active={areaId === a.id} label={a.nombre} count={conteo(a.id)} color={a.color} onClick={() => { setAreaId(a.id); setFiltro("todos") }} />
              ))}
            </div>
            <Resumen lista={delArea} corte={corte} filtro={filtro} onFiltro={setFiltro} />
          </>
        )}

        {indicadores.isLoading && <p role="status" className="py-10 font-mono text-[12px] text-kpi-600">Cargando indicadores…</p>}

        {indicadores.isError && (
          <div role="alert" className="py-16 text-center">
            <p className="text-[14px] text-kpi-900">No se pudieron cargar los indicadores.</p>
            <button type="button" onClick={() => void indicadores.refetch()} className="mt-3 rounded-lg border border-kpi-300 px-3 py-1.5 font-mono text-[11px] text-kpi-600 outline-none hover:bg-kpi-50 focus-visible:ring-2 focus-visible:ring-kpi-600">
              Intentar de nuevo
            </button>
          </div>
        )}

        {!indicadores.isLoading && !indicadores.isError && todos.length === 0 && (
          <div className="py-20 text-center">
            <Gauge className="mx-auto mb-3 h-7 w-7 text-kpi-600" />
            <p className="text-[14px] text-kpi-600">Esta vista todavía no tiene indicadores.</p>
            <p className="mt-1 text-[12px] text-kpi-600">Elige el área y sube el Excel de la hoja de vida.</p>
          </div>
        )}

        {todos.length > 0 && visibles.length === 0 && (
          <p className="py-10 text-center text-[13px] text-kpi-600">Ningún indicador está en ese estado.</p>
        )}

        <div className="mt-7 space-y-9">
          {porArea.map(([id, lista]) => {
            const cumplen = lista.filter((k) => estadoActual(k) === "cumple").length
            return (
              <section key={id} aria-label={lista[0].area.nombre}>
                <h2 className="mb-3 flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: lista[0].area.color }} aria-hidden />
                  <span className="text-[15px] font-medium text-kpi-900">{lista[0].area.nombre}</span>
                  <span className="font-mono text-[11px] text-kpi-600">{cumplen} de {lista.length} cumplen</span>
                  <span className="h-px flex-1 bg-kpi-100" aria-hidden />
                </h2>
                <ul className="space-y-2.5">
                  {lista.map((k, i) => (
                    <li key={k.id} style={{ animation: `kpi-aparece .45s cubic-bezier(.2,.8,.2,1) ${i * 45}ms both` }}>
                      <SigIndicadorFila
                        k={k}
                        abierta={abierto === k.id}
                        ambiguo={nombresRepetidos.has(`${k.area.id}|${k.nombre}`)}
                        canEdit={canEdit}
                        onToggle={() => setAbierto(abierto === k.id ? null : k.id)}
                        onBorrar={() => { if (window.confirm(`¿Quitar «${k.nombre}»?`)) borrar.mutate(k.id) }}
                        onDescargar={() => descargar(k.id, k.nombreArchivo)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
        <p className="mt-10 border-t border-kpi-300/70 pt-4 font-mono text-[10px] text-kpi-600">
          Cada indicador se evalúa con el último resultado de su hoja de vida frente a su meta. «Cerca» = hasta 10 % por debajo de la meta (o hasta 25 % por encima si la meta es un máximo). El agente analista del SIG lee estos mismos indicadores: los puntos por revisar son los datos que usa como evidencia.
        </p>
      </div>
      <style>{`
        @keyframes kpi-aparece { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes kpi-celda { from { opacity: 0; transform: scaleY(.2) } to { opacity: 1; transform: none } }
        @keyframes kpi-barra { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: .01ms !important; animation-delay: 0ms !important; transition-duration: .01ms !important } }
      `}</style>
    </div>
  )
}

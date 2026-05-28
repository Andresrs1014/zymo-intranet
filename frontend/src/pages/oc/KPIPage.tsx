import { useMemo, useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { type OcKpiFilters, useKPIs } from "@/hooks/useOC"
import type { ConteoItem, MesItem } from "@/types/oc"
import { formatFechaRelativa } from "@/lib/dates"
import { formatCOP } from "@/lib/formatters"
import { formatDuracionDesdeDias } from "@/lib/durationFromDays"
import { type ReporteTiemposOCData, resolverReporteTiemposKpis } from "@/lib/ocKpiReporteTiempos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

// ── Helpers ───────────────────────────────────────────────────────────────────

function estadoLabel(estado: string): string {
  const map: Record<string, string> = {
    nueva: "Nueva",
    en_cotizacion: "Cotización lista",
    pendiente_aprobacion: "Pend. aprobación",
    aprobada: "Aprobada",
    rechazada: "Rechazada",
    cancelada: "Cancelada",
    en_correccion: "En corrección",
    oc_enviada: "OC Enviada",
    oc_en_plataforma: "En plataforma",
    entregada: "Entregada",
    cerrada: "Cerrada",
  }
  return map[estado] ?? estado
}

function estadoBarColor(estado: string): string {
  const map: Record<string, string> = {
    nueva: "bg-blue-400",
    en_cotizacion: "bg-yellow-400",
    pendiente_aprobacion: "bg-orange-400",
    aprobada: "bg-green-500",
    rechazada: "bg-red-400",
    cancelada: "bg-red-600",
    en_correccion: "bg-amber-400",
    oc_enviada: "bg-indigo-400",
    oc_en_plataforma: "bg-violet-400",
    entregada: "bg-teal-400",
    cerrada: "bg-gray-300",
  }
  return map[estado] ?? "bg-gray-300"
}

function formatDateRelative(iso: string): string {
  return formatFechaRelativa(iso)
}

function MesChart({ items }: { items: MesItem[] }) {
  if (!items || items.length === 0) return <p className="text-sm text-muted-foreground">Sin datos aún</p>

  const maxSolicitudes = Math.max(...items.map(i => i.solicitudes), 1)

  return (
    <div className="flex items-end gap-3 h-36 pt-2">
      {items.map((item) => {
        const pctH = Math.round((item.solicitudes / maxSolicitudes) * 100)
        return (
          <div key={item.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            {/* Tooltip: valor aprobado */}
            <p className="text-xs text-muted-foreground truncate w-full text-center">
              {item.valor_aprobado > 0 ? formatCOP(item.valor_aprobado) : "—"}
            </p>
            {/* Barra */}
            <div className="w-full relative" style={{ height: "72px" }}>
              <div
                className="w-full bg-brand-blue rounded-t-md absolute bottom-0 transition-all duration-500"
                style={{ height: `${pctH}%` }}
                title={`${item.label}: ${item.solicitudes} solicitudes`}
              />
            </div>
            {/* Número de solicitudes */}
            <p className="text-xs font-semibold text-foreground">{item.solicitudes}</p>
            {/* Label mes */}
            <p className="text-xs text-muted-foreground truncate w-full text-center">{item.label}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  icon: string
  value: string | number
  sub?: string
  accent?: string
}

function StatCard({ label, icon, value, sub, accent }: StatCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className="text-2xl">{icon}</span>
        </div>
        <p className={`text-2xl font-bold ${accent ?? "text-foreground"}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function TiempoProcesoCard({
  metric,
  reprocesosTotal,
  muestrasAsignacion,
  ciclosCorreccionResueltos,
}: {
  metric: ReporteTiemposOCData["metricas"][number]
  reprocesosTotal: number
  muestrasAsignacion: number
  ciclosCorreccionResueltos: number
}) {
  const sinDato =
    (metric.clave === "resolucion_reproceso" && reprocesosTotal === 0) ||
    (metric.clave === "hasta_asignacion" && muestrasAsignacion === 0) ||
    (metric.clave === "resolucion_correccion" && ciclosCorreccionResueltos === 0)

  const avisoSinDato =
    metric.clave === "resolucion_reproceso"
      ? "No hay reprocesos; esta métrica aún no aplica."
      : metric.clave === "hasta_asignacion"
        ? "No hay solicitudes con asignación en este filtro."
        : metric.clave === "resolucion_correccion"
          ? "No hay ciclos de corrección cerrados en este filtro (o siguen abiertos en en corrección)."
          : null

  const duracionLegible =
    sinDato
      ? null
      : metric.unidad === "días"
        ? formatDuracionDesdeDias(metric.valor)
        : `${Number(metric.valor).toFixed(2)} ${metric.unidad}`

  return (
    <div className="bg-card rounded-xl border border-[#003087]/20 shadow-sm p-5 ring-1 ring-[#003087]/5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#003087] mb-0.5">
        {metric.etiqueta}
      </p>
      <p className="text-sm font-medium text-foreground mb-3">{metric.subtitulo}</p>
      <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${sinDato ? "text-muted-foreground" : "text-[#003087]"}`}>
        {sinDato ? "—" : duracionLegible}
      </p>
      {sinDato && avisoSinDato && (
        <p className="text-xs text-amber-700 mt-1">{avisoSinDato}</p>
      )}
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t border-border pt-3">
        {metric.ayuda}
      </p>
    </div>
  )
}

function BloqueInformeAgentes({ reporte }: { reporte: ReporteTiemposOCData }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    const bloque = [
      "=== Informe OC Automatizaciones — tiempos de proceso ===",
      "",
      reporte.texto_para_informe,
      "",
      reporte.nota_metodologia,
      reporte.sugerencia_agentes,
      "",
      `Generado (UTC): ${reporte.generado_en_utc}`,
    ].join("\n")
    try {
      await navigator.clipboard.writeText(bloque)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/50 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Texto para informes y agentes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Resumen en lenguaje natural de la demora del proceso; puedes pegarlo en correos, chats o reportes del agente.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => void copiar()}
          className="shrink-0 bg-[#003087] hover:bg-[#002266]"
        >
          {copiado ? "Copiado" : "Copiar informe"}
        </Button>
      </div>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {reporte.texto_para_informe}
      </p>
      <p className="text-xs text-muted-foreground mt-3">{reporte.sugerencia_agentes}</p>
      <p className="text-[11px] text-muted-foreground mt-2">{reporte.nota_metodologia}</p>
    </div>
  )
}

interface BarListProps {
  items: ConteoItem[]
  total: number
  getLabel?: (label: string) => string
  getColor?: (label: string) => string
}

function BarList({ items, total, getLabel, getColor }: BarListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos aún</p>
  }
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
        const label = getLabel ? getLabel(item.label) : item.label
        const color = getColor ? getColor(item.label) : "bg-brand-blue"
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{label}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-foreground w-8 text-right">{item.count}</span>
          </div>
        )
      })}
    </div>
  )
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const config: Record<string, string> = {
    Alta: "bg-red-50 text-red-600",
    Media: "bg-yellow-50 text-yellow-700",
    Baja: "bg-muted text-muted-foreground",
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config[prioridad] ?? "bg-muted text-muted-foreground"}`}
    >
      {prioridad}
    </span>
  )
}

function EstadoBadgeMini({ estado }: { estado: string }) {
  const config: Record<string, { label: string; className: string }> = {
    nueva: { label: "Nueva", className: "bg-blue-100 text-blue-700" },
    en_cotizacion: { label: "Cotización lista", className: "bg-yellow-100 text-yellow-700" },
    pendiente_aprobacion: { label: "Pend. aprobación", className: "bg-orange-100 text-orange-700" },
    aprobada: { label: "Aprobada", className: "bg-green-100 text-green-700" },
    rechazada: { label: "Rechazada", className: "bg-red-100 text-red-700" },
    cancelada: { label: "Cancelada", className: "bg-red-200 text-red-800" },
    en_correccion: { label: "En corrección", className: "bg-amber-100 text-amber-700" },
    oc_enviada: { label: "OC Enviada", className: "bg-indigo-100 text-indigo-700" },
    oc_en_plataforma: { label: "En plataforma", className: "bg-violet-100 text-violet-700" },
    entregada: { label: "Entregada", className: "bg-teal-100 text-teal-700" },
    cerrada: { label: "Cerrada", className: "bg-muted text-muted-foreground" },
  }
  const c = config[estado] ?? { label: estado, className: "bg-muted text-muted-foreground" }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PRIORIDADES_FILTRO = ["", "Alta", "Media", "Baja"] as const

export function KPIPage() {
  const [filtrosKpi, setFiltrosKpi] = useState<OcKpiFilters>({})
  const [draftFiltros, setDraftFiltros] = useState({
    fecha_desde: "",
    fecha_hasta: "",
    plataforma: "",
    nivel_prioridad: "",
  })
  const { data: kpis, isLoading, isError, isRefetching } = useKPIs(filtrosKpi)
  const [mostrarConIva, setMostrarConIva] = useState(false)

  const opcionesPlataforma = useMemo(() => {
    const labels = (kpis?.por_plataforma ?? []).map((p) => p.label).filter(Boolean)
    return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b))
  }, [kpis?.por_plataforma])

  const pendientesAprobacion =
    kpis?.por_estado.find((e) => e.label === "pendiente_aprobacion")?.count ?? 0

  const valorMostrado = mostrarConIva
    ? (kpis?.valor_total_aprobado ?? 0)
    : (kpis?.valor_total_sin_iva ?? 0)

  return (
    <PageLayout title="OC Automatizaciones">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Dashboard KPIs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Resumen del módulo OC Automatizaciones
              {isRefetching && (
                <span className="ml-2 text-brand-blue/60">actualizando...</span>
              )}
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-xs font-semibold text-foreground mb-3">Filtros (sobre fecha de solicitud y datos de la solicitud)</p>
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground min-w-[140px]">
                Desde
                <Input
                  type="date"
                  className="text-sm"
                  value={draftFiltros.fecha_desde}
                  onChange={(e) => setDraftFiltros((d) => ({ ...d, fecha_desde: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground min-w-[140px]">
                Hasta
                <Input
                  type="date"
                  className="text-sm"
                  value={draftFiltros.fecha_hasta}
                  onChange={(e) => setDraftFiltros((d) => ({ ...d, fecha_hasta: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground min-w-[160px]">
                Plataforma
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={draftFiltros.plataforma}
                  onChange={(e) => setDraftFiltros((d) => ({ ...d, plataforma: e.target.value }))}
                >
                  <option value="">Todas</option>
                  {opcionesPlataforma.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground min-w-[140px]">
                Prioridad
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={draftFiltros.nivel_prioridad}
                  onChange={(e) => setDraftFiltros((d) => ({ ...d, nivel_prioridad: e.target.value }))}
                >
                  {PRIORIDADES_FILTRO.map((p) => (
                    <option key={p || "todas"} value={p}>{p === "" ? "Todas" : p}</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#003087] hover:bg-[#002266]"
                  onClick={() =>
                    setFiltrosKpi({
                      fecha_desde: draftFiltros.fecha_desde || undefined,
                      fecha_hasta: draftFiltros.fecha_hasta || undefined,
                      plataforma: draftFiltros.plataforma || undefined,
                      nivel_prioridad: draftFiltros.nivel_prioridad || undefined,
                    })}
                >
                  Aplicar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraftFiltros({ fecha_desde: "", fecha_hasta: "", plataforma: "", nivel_prioridad: "" })
                    setFiltrosKpi({})
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
              <svg
                className="animate-spin h-5 w-5 mr-2 text-brand-blue"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Cargando KPIs...
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
              No se pudieron cargar los KPIs. Intenta recargar la página.
            </div>
          )}

          {/* Dashboard content */}
          {kpis ? (() => {
            const reporteTiempos = resolverReporteTiemposKpis(kpis)
            return (
            <div className="space-y-6">
              {/* Fila 1 — Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                  label="Total Solicitudes"
                  icon="📋"
                  value={kpis.total_solicitudes}
                />
                <StatCard
                  label="Pendientes Aprobación"
                  icon="⏳"
                  value={pendientesAprobacion}
                  accent="text-orange-600"
                />
                <StatCard
                  label="OCs Generadas"
                  icon="📄"
                  value={kpis.total_ordenes_generadas}
                  accent="text-green-600"
                />
                <Card className="shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-muted-foreground">
                        {mostrarConIva ? "Valor Total (con IVA)" : "Valor Total (sin IVA)"}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">💰</span>
                        <button
                          onClick={() => setMostrarConIva((v) => !v)}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                            mostrarConIva
                              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          title={mostrarConIva ? "Mostrando con IVA — clic para ver sin IVA" : "Mostrando sin IVA — clic para incluir IVA"}
                        >
                          {mostrarConIva ? "Con IVA" : "Sin IVA"}
                        </button>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-[#003087]">{formatCOP(valorMostrado)}</p>
                    {!mostrarConIva && kpis.valor_iva_acumulado > 0 && (
                      <p className="text-xs text-orange-500 mt-1">
                        + {formatCOP(kpis.valor_iva_acumulado)} IVA
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Los tiempos de proceso del flujo se muestran en la sección siguiente.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tiempos de proceso — lectura clara + datos para informes */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-1">Tiempos del proceso</h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Indicadores de <strong className="font-medium text-foreground">cuánto se demora</strong> el circuito
                  de compras; mismos datos que recibe el bloque «informe» debajo.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {reporteTiempos.metricas.map((m) => (
                    <TiempoProcesoCard
                      key={m.clave}
                      metric={m}
                      reprocesosTotal={kpis.reprocesos_total}
                      muestrasAsignacion={kpis.muestras_asignacion}
                      ciclosCorreccionResueltos={kpis.ciclos_correccion_resueltos}
                    />
                  ))}
                </div>
              </div>

              <BloqueInformeAgentes reporte={reporteTiempos} />

              {/* Fila 1b — KPIs de calidad: reprocesos y rechazos */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="bg-card rounded-xl border border-amber-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Reprocesos</p>
                    <span className="text-2xl">🔄</span>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800/90 mb-1">
                    Tiempo de proceso (volumen)
                  </p>
                  <p className="text-2xl font-bold text-amber-600">{kpis.reprocesos_total}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Eventos con reproceso (devoluciones, correcciones; incluye corrección directiva). La{" "}
                    <strong className="font-medium text-foreground">demora media para resolverlos</strong> está arriba en
                    «Demora media para salir de un reproceso».
                  </p>
                </div>

                <div className="bg-card rounded-xl border border-sky-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Corrección directiva</p>
                    <span className="text-2xl">✏️</span>
                  </div>
                  <p className="text-2xl font-bold text-sky-700">{kpis.correcciones_directivo}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ajustes del director/admin sobre cotización u OC sin retroceder la etapa del flujo
                  </p>
                </div>

                <div className="bg-card rounded-xl border border-red-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Rechazos de solicitud</p>
                    <span className="text-2xl">🚫</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{kpis.rechazos_solicitud}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cancelaciones definitivas generadas por el auxiliar
                  </p>
                </div>

                <div className="bg-card rounded-xl border border-red-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Rechazos de cotización</p>
                    <span className="text-2xl">❌</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700">{kpis.rechazos_cotizacion}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cancelaciones definitivas generadas por el directivo
                  </p>
                </div>
              </div>

              {/* Fila 2 — Por Estado + Top Proveedores */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">
                    Distribución por estado
                  </h2>
                  <BarList
                    items={kpis.por_estado}
                    total={kpis.total_solicitudes}
                    getLabel={estadoLabel}
                    getColor={estadoBarColor}
                  />
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Top proveedores</h2>
                  {kpis.top_proveedores.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin datos aún</p>
                  ) : (
                    <ol className="space-y-2.5">
                      {kpis.top_proveedores.map((p, idx) => (
                        <li key={p.label} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 text-center">
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-sm text-foreground truncate">{p.label}</span>
                          <span className="text-xs font-medium text-muted-foreground shrink-0">
                            {p.count} cot.
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>

              {/* Fila 3 — Por Plataforma, Por Prioridad, Por Área */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Por plataforma</h2>
                  <BarList
                    items={kpis.por_plataforma}
                    total={kpis.total_solicitudes}
                    getColor={() => "bg-brand-blue"}
                  />
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Por prioridad</h2>
                  <BarList
                    items={kpis.por_prioridad}
                    total={kpis.total_solicitudes}
                    getColor={(label) => {
                      const map: Record<string, string> = {
                        Alta: "bg-red-400",
                        Media: "bg-yellow-400",
                        Baja: "bg-gray-300",
                      }
                      return map[label] ?? "bg-gray-300"
                    }}
                  />
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Por área</h2>
                  <BarList
                    items={kpis.por_area}
                    total={kpis.total_solicitudes}
                    getColor={() => "bg-teal-400"}
                  />
                </div>
              </div>

              {/* Fila 3b — Tendencia mensual */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <h2 className="text-sm font-semibold text-foreground mb-1">
                  Solicitudes por mes
                </h2>
                <p className="text-xs text-muted-foreground mb-4">Últimos 6 meses · valor = aprobado sin IVA</p>
                <MesChart items={kpis.por_mes} />
              </div>

              {/* Fila 4 — Solicitudes Recientes */}
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Solicitudes recientes</h2>
                </div>

                {kpis.solicitudes_recientes.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    Sin solicitudes recientes
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-border">
                          <th className="px-4 py-3 font-medium text-muted-foreground">Consecutivo</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Descripción</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                            Prioridad
                          </th>
                          <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                            Sede
                          </th>
                          <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                            Fecha
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-muted/50">
                        {kpis.solicitudes_recientes.slice(0, 10).map((s) => (
                          <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs font-medium text-[#003087]">
                                {s.consecutivo_os}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-foreground truncate max-w-[220px]">
                                {s.descripcion}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <EstadoBadgeMini estado={s.estado} />
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <PrioridadBadge prioridad={s.nivel_prioridad} />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                              {s.plataforma ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                              {formatDateRelative(s.fecha_solicitud)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            )
          })() : null}
    </PageLayout>
  )
}

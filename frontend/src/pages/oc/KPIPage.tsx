import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { useKPIs } from "@/hooks/useOC"
import type { ConteoItem, MesItem } from "@/types/oc"
import { formatFechaRelativa } from "@/lib/dates"
import { formatCOP } from "@/lib/formatters"

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
  if (!items || items.length === 0) return <p className="text-sm text-gray-400">Sin datos aún</p>

  const maxSolicitudes = Math.max(...items.map(i => i.solicitudes), 1)

  return (
    <div className="flex items-end gap-3 h-36 pt-2">
      {items.map((item) => {
        const pctH = Math.round((item.solicitudes / maxSolicitudes) * 100)
        return (
          <div key={item.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            {/* Tooltip: valor aprobado */}
            <p className="text-xs text-gray-400 truncate w-full text-center">
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
            <p className="text-xs font-semibold text-gray-700">{item.solicitudes}</p>
            {/* Label mes */}
            <p className="text-xs text-gray-400 truncate w-full text-center">{item.label}</p>
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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${accent ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
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
    return <p className="text-sm text-gray-400">Sin datos aún</p>
  }
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
        const label = getLabel ? getLabel(item.label) : item.label
        const color = getColor ? getColor(item.label) : "bg-brand-blue"
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-32 shrink-0 truncate">{label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 w-8 text-right">{item.count}</span>
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
    Baja: "bg-gray-100 text-gray-500",
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config[prioridad] ?? "bg-gray-100 text-gray-500"}`}
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
    cerrada: { label: "Cerrada", className: "bg-gray-100 text-gray-500" },
  }
  const c = config[estado] ?? { label: estado, className: "bg-gray-100 text-gray-500" }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function KPIPage() {
  const { data: kpis, isLoading, isError, isRefetching } = useKPIs()
  const [mostrarConIva, setMostrarConIva] = useState(false)

  const pendientesAprobacion =
    kpis?.por_estado.find((e) => e.label === "pendiente_aprobacion")?.count ?? 0

  const valorMostrado = mostrarConIva
    ? (kpis?.valor_total_aprobado ?? 0)
    : (kpis?.valor_total_sin_iva ?? 0)

  return (
    <PageLayout title="OC Automatizaciones">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Dashboard KPIs</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Resumen del módulo OC Automatizaciones
              {isRefetching && (
                <span className="ml-2 text-brand-blue/60">actualizando...</span>
              )}
            </p>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
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
          {kpis && (
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
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">
                      {mostrarConIva ? "Valor Total (con IVA)" : "Valor Total (sin IVA)"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💰</span>
                      <button
                        onClick={() => setMostrarConIva((v) => !v)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          mostrarConIva
                            ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
                  <p className="text-xs text-gray-400 mt-1">
                    Prom. cotización: {kpis.tiempo_promedio_cotizacion_dias.toFixed(1)} días
                  </p>
                </div>
              </div>

              {/* Fila 1b — KPIs de calidad: reprocesos y rechazos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">Reprocesos</p>
                    <span className="text-2xl">🔄</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">{kpis.reprocesos_total}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Solicitudes devueltas a corrección (total)
                  </p>
                  {kpis.reprocesos_total > 0 && (
                    <p className="text-xs text-amber-500 mt-1">
                      Promedio resolución: {kpis.tiempo_promedio_reproceso_dias.toFixed(1)} días
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">Rechazos de solicitud</p>
                    <span className="text-2xl">🚫</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{kpis.rechazos_solicitud}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Cancelaciones definitivas generadas por el auxiliar
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">Rechazos de cotización</p>
                    <span className="text-2xl">❌</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700">{kpis.rechazos_cotizacion}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Cancelaciones definitivas generadas por el directivo
                  </p>
                </div>
              </div>

              {/* Fila 2 — Por Estado + Top Proveedores */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">
                    Distribución por estado
                  </h2>
                  <BarList
                    items={kpis.por_estado}
                    total={kpis.total_solicitudes}
                    getLabel={estadoLabel}
                    getColor={estadoBarColor}
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Top proveedores</h2>
                  {kpis.top_proveedores.length === 0 ? (
                    <p className="text-sm text-gray-400">Sin datos aún</p>
                  ) : (
                    <ol className="space-y-2.5">
                      {kpis.top_proveedores.map((p, idx) => (
                        <li key={p.label} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-400 w-5 shrink-0 text-center">
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-sm text-gray-700 truncate">{p.label}</span>
                          <span className="text-xs font-medium text-gray-500 shrink-0">
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
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Por plataforma</h2>
                  <BarList
                    items={kpis.por_plataforma}
                    total={kpis.total_solicitudes}
                    getColor={() => "bg-brand-blue"}
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Por prioridad</h2>
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

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Por área</h2>
                  <BarList
                    items={kpis.por_area}
                    total={kpis.total_solicitudes}
                    getColor={() => "bg-teal-400"}
                  />
                </div>
              </div>

              {/* Fila 3b — Tendencia mensual */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-1">
                  Solicitudes por mes
                </h2>
                <p className="text-xs text-gray-400 mb-4">Últimos 6 meses · valor = aprobado sin IVA</p>
                <MesChart items={kpis.por_mes} />
              </div>

              {/* Fila 4 — Solicitudes Recientes */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-700">Solicitudes recientes</h2>
                </div>

                {kpis.solicitudes_recientes.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                    Sin solicitudes recientes
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-gray-100">
                          <th className="px-4 py-3 font-medium text-gray-500">Consecutivo</th>
                          <th className="px-4 py-3 font-medium text-gray-500">Descripción</th>
                          <th className="px-4 py-3 font-medium text-gray-500">Estado</th>
                          <th className="px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                            Prioridad
                          </th>
                          <th className="px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                            Sede
                          </th>
                          <th className="px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                            Fecha
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {kpis.solicitudes_recientes.slice(0, 10).map((s) => (
                          <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs font-medium text-[#003087]">
                                {s.consecutivo_os}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-gray-900 truncate max-w-[220px]">
                                {s.descripcion}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <EstadoBadgeMini estado={s.estado} />
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <PrioridadBadge prioridad={s.nivel_prioridad} />
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                              {s.plataforma ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
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
          )}
    </PageLayout>
  )
}

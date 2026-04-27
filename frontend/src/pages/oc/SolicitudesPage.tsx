import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { useSolicitudes } from "@/hooks/useOC"
import { Combobox } from "@/components/ui/Combobox"
import { formatFechaRelativa } from "@/lib/dates"
import type { EstadoOC, SolicitudOC } from "@/types/oc"

const ESTADOS_OPTIONS = [
  { value: "nueva", label: "Nueva" },
  { value: "en_cotizacion", label: "En cotización" },
  { value: "pendiente_aprobacion", label: "Cotización lista" },
  { value: "aprobada", label: "Aprobada" },
  { value: "rechazada", label: "Rechazada" },
  { value: "oc_enviada", label: "OC Enviada" },
  { value: "oc_en_plataforma", label: "En plataforma" },
  { value: "entregada", label: "Entregada" },
  { value: "cerrada", label: "Cerrada" },
]

const PLATAFORMAS_OPTIONS = [
  { value: "Logimat", label: "Logimat" },
  { value: "IMC Cargo", label: "IMC Cargo" },
  { value: "IMC Depósito", label: "IMC Depósito" },
]

export function SolicitudesPage() {
  const navigate = useNavigate()
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null)
  const [plataformaFiltro, setPlataformaFiltro] = useState<string | null>(null)

  const { data: solicitudes = [], isLoading, isRefetching } = useSolicitudes({
    estado: estadoFiltro ?? undefined,
    plataforma: plataformaFiltro ?? undefined,
  })

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="OC Automatizaciones" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Solicitudes de Compra</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Panel del Auxiliar de Compras
                {isRefetching && (
                  <span className="ml-2 text-brand-blue/60">actualizando...</span>
                )}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Combobox
              className="w-52"
              options={ESTADOS_OPTIONS}
              value={estadoFiltro}
              onChange={(v) => setEstadoFiltro(v as string | null)}
              placeholder="Todos los estados"
            />
            <Combobox
              className="w-44"
              options={PLATAFORMAS_OPTIONS}
              value={plataformaFiltro}
              onChange={(v) => setPlataformaFiltro(v as string | null)}
              placeholder="Todas las plataformas"
            />
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                Cargando...
              </div>
            ) : solicitudes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-gray-400 text-sm">No hay solicitudes con los filtros aplicados.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500">Consecutivo</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Descripción</th>
                    <th className="px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Solicitante</th>
                    <th className="px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Plataforma</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Prioridad</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Estado</th>
                    <th className="px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Fecha</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {solicitudes.map((s) => (
                    <SolicitudRow
                      key={s.id}
                      solicitud={s}
                      onView={() => navigate(`/oc/solicitudes/${s.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function SolicitudRow({
  solicitud: s,
  onView,
}: {
  solicitud: SolicitudOC
  onView: () => void
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-medium text-brand-blue">
          {s.consecutivo_os}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 truncate max-w-[200px]">{s.descripcion}</p>
        <p className="text-xs text-gray-400">Cant: {s.cantidad}</p>
      </td>
      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
        <p className="truncate max-w-[140px]">{s.solicitante_nombre}</p>
        {s.area_solicitante && (
          <p className="text-xs text-gray-400">{s.area_solicitante}</p>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
        {s.plataforma ?? "—"}
      </td>
      <td className="px-4 py-3">
        <PrioridadBadge prioridad={s.nivel_prioridad} />
        <SLABadge
          prioridad={s.nivel_prioridad}
          estado={s.estado}
          fechaSolicitud={s.fecha_solicitud}
        />
      </td>
      <td className="px-4 py-3">
        <EstadoBadge estado={s.estado} />
      </td>
      <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
        {formatDate(s.fecha_solicitud)}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onView}
          className="rounded px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 transition-colors"
        >
          Ver detalle
        </button>
      </td>
    </tr>
  )
}

export function EstadoBadge({ estado }: { estado: EstadoOC | string }) {
  const config: Record<string, { label: string; className: string }> = {
    nueva:                 { label: "Nueva",               className: "bg-blue-100 text-blue-700" },
    en_cotizacion:         { label: "En cotización",          className: "bg-yellow-100 text-yellow-700" },
    pendiente_aprobacion:  { label: "Cotización lista",     className: "bg-orange-100 text-orange-700" },
    aprobada:              { label: "Aprobada",            className: "bg-green-100 text-green-700" },
    rechazada:             { label: "Rechazada",           className: "bg-red-100 text-red-700" },
    oc_enviada:            { label: "OC Enviada",          className: "bg-indigo-100 text-indigo-700" },
    oc_en_plataforma:      { label: "En plataforma",       className: "bg-violet-100 text-violet-700" },
    entregada:             { label: "Entregada",           className: "bg-teal-100 text-teal-700" },
    cerrada:               { label: "Cerrada",             className: "bg-gray-100 text-gray-500" },
  }
  const c = config[estado] ?? { label: estado, className: "bg-gray-100 text-gray-500" }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  )
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const config: Record<string, string> = {
    Alta:  "bg-red-50 text-red-600",
    Media: "bg-yellow-50 text-yellow-700",
    Baja:  "bg-gray-100 text-gray-500",
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config[prioridad] ?? "bg-gray-100 text-gray-500"}`}>
      {prioridad}
    </span>
  )
}

// ── SLA helpers ──────────────────────────────────────────────────────────────

const SLA_HORAS: Record<string, number> = {
  Alta:  4,
  Media: 24,
  Baja:  72,
}

const ESTADOS_SLA_ACTIVOS = new Set([
  "nueva",
  "en_cotizacion",
  "pendiente_aprobacion",
  "aprobada",
])

interface SLAResult {
  vencido: boolean
  horasRestantes: number
  horasVencido: number
}

function calcularSLA(
  prioridad: string,
  fechaSolicitud: string,
  estado: string,
): SLAResult | null {
  if (!ESTADOS_SLA_ACTIVOS.has(estado)) return null
  const limiteHoras = SLA_HORAS[prioridad]
  if (limiteHoras === undefined) return null

  const inicio = new Date(fechaSolicitud).getTime()
  const ahora  = Date.now()
  const transcurridasMs = ahora - inicio
  const limiteMs = limiteHoras * 60 * 60 * 1000
  const diferenciasHoras = (limiteMs - transcurridasMs) / (60 * 60 * 1000)

  if (diferenciasHoras >= 0) {
    return { vencido: false, horasRestantes: Math.round(diferenciasHoras), horasVencido: 0 }
  }
  return { vencido: true, horasRestantes: 0, horasVencido: Math.round(-diferenciasHoras) }
}

function SLABadge({
  prioridad,
  estado,
  fechaSolicitud,
}: {
  prioridad: string
  estado: string
  fechaSolicitud: string
}) {
  const sla = calcularSLA(prioridad, fechaSolicitud, estado)
  if (!sla) return null

  if (sla.vencido) {
    return (
      <span className="mt-1 flex items-center gap-0.5 text-xs font-medium text-red-600">
        <span>⚠</span>
        <span>{prioridad} · Vencido {sla.horasVencido}h</span>
      </span>
    )
  }

  return (
    <span className="mt-1 flex items-center gap-0.5 text-xs font-medium text-green-600">
      <span>⏱</span>
      <span>{prioridad} · {sla.horasRestantes}h restantes</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return formatFechaRelativa(iso)
}

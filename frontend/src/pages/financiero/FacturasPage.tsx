import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { useSolicitudesFinanciero } from "@/hooks/useFinanciero"
import type { EstadoFactura, SolicitudConFactura } from "@/types/financiero"
import { api } from "@/lib/api"

// ── Tipos de tab ──────────────────────────────────────────────────────────────

type TabKey = "todas" | "sin_factura" | "pendiente" | "validada" | "con_diferencias"

const TABS: { key: TabKey; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "sin_factura", label: "Sin factura" },
  { key: "pendiente", label: "Pendientes" },
  { key: "validada", label: "Validadas" },
  { key: "con_diferencias", label: "Con diferencias" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCOP(value: number | null): string {
  if (value === null) return "—"
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function FacturaEstadoBadge({ facturaId, facturaEstado }: { facturaId: string | null; facturaEstado: EstadoFactura | null }) {
  if (!facturaId) {
    return (
      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
        Sin factura
      </span>
    )
  }
  const cfg: Record<EstadoFactura, { label: string; className: string }> = {
    pendiente: { label: "Pendiente", className: "bg-yellow-100 text-yellow-700" },
    validada: { label: "Validada", className: "bg-green-100 text-green-700" },
    con_diferencias: { label: "Con diferencias", className: "bg-red-100 text-red-700" },
  }
  const estado = facturaEstado ?? "pendiente"
  const { label, className } = cfg[estado]
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FacturasPage() {
  const navigate = useNavigate()
  const { data: solicitudes = [], isLoading } = useSolicitudesFinanciero()
  const [tab, setTab] = useState<TabKey>("todas")

  const filtradas = solicitudes.filter((s) => {
    if (tab === "todas") return true
    if (tab === "sin_factura") return !s.factura_id
    return s.factura_estado === tab
  })

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Financiero" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Back button */}
          <button
            onClick={() => navigate("/financiero")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Facturas de Proveedores</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              OCs elegibles para facturación
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
              <svg className="animate-spin h-5 w-5 mr-2 text-brand-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando facturas...
            </div>
          )}

          {/* Empty */}
          {!isLoading && filtradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <svg className="w-12 h-12 mb-3 text-gray-200" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" clipRule="evenodd" />
              </svg>
              <p className="text-sm">No hay facturas en esta categoría</p>
            </div>
          )}

          {/* Lista */}
          {!isLoading && filtradas.length > 0 && (
            <div className="space-y-3">
              {filtradas.map((s) => (
                <FacturaCard key={s.solicitud_id} solicitud={s} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ── Tarjeta ───────────────────────────────────────────────────────────────────

function FacturaCard({ solicitud: s }: { solicitud: SolicitudConFactura }) {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left — info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-brand-blue">
                {s.consecutivo_os ?? "—"}
              </span>
              <FacturaEstadoBadge facturaId={s.factura_id} facturaEstado={s.factura_estado} />
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {s.descripcion ?? "Sin descripción"}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
              {s.proveedor_nombre && (
                <span>Proveedor: <span className="text-gray-600">{s.proveedor_nombre}</span></span>
              )}
              {s.area_solicitante && (
                <span>Área: <span className="text-gray-600">{s.area_solicitante}</span></span>
              )}
              {s.condicion && String(s.condicion).trim() !== "" && (
                <span>Condición: <span className="text-gray-600">{s.condicion}</span></span>
              )}
              {s.numero_oc && (
                <span>OC: <span className="text-gray-600 font-mono">{s.numero_oc}</span></span>
              )}
              {s.forma_pago && (
                <span>Pago: <span className="text-gray-600">{s.forma_pago}</span></span>
              )}
              {s.tiene_proforma && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700 uppercase tracking-wide">
                  Anticipo
                </span>
              )}
              {s.observaciones_seguimiento && String(s.observaciones_seguimiento).trim() !== "" && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-100"
                  title="Hay notas en la bitácora financiera"
                >
                  Bitácora
                </span>
              )}
            </div>
            {/* Botón proforma */}
            {s.tiene_proforma && s.proforma_path && (
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  const resp = await api.get(
                    `/api/financiero/facturas/${s.solicitud_id}/proforma`,
                    { responseType: "blob" }
                  )
                  const url = URL.createObjectURL(resp.data as Blob)
                  window.open(url, "_blank")
                }}
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-yellow-700 underline hover:text-yellow-900"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Ver proforma
              </button>
            )}
            {s.tiene_proforma && !s.proforma_path && (
              <p className="mt-1 text-[10px] italic text-yellow-600">Proforma pendiente de subir por compras</p>
            )}
          </div>

          {/* Center — valor */}
          <div className="shrink-0 text-right hidden sm:block">
            <p className="text-xs text-gray-400">Valor aprobado</p>
            <p className="text-sm font-semibold text-gray-800">{formatCOP(s.valor_aprobado)}</p>
          </div>

          {/* Right — acción */}
          <button
            onClick={() => navigate(`/financiero/facturas/${s.solicitud_id}`)}
            className="shrink-0 rounded-lg bg-brand-blue/8 px-3 py-1.5 text-xs font-semibold text-brand-blue hover:bg-brand-blue/15 transition-colors"
          >
            Ver detalle
          </button>
        </div>
      </div>
    </div>
  )
}

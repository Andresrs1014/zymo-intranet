import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { useSolicitudesFinanciero } from "@/hooks/useFinanciero"
import type { EstadoFactura, SolicitudConFactura } from "@/types/financiero"
import { api } from "@/lib/api"
import { VistaFacturacionModal } from "@/components/financiero/VistaFacturacionModal"
import { Combobox } from "@/components/ui/Combobox"
import type { ComboboxOption } from "@/components/ui/Combobox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

// ── Tipos de tab ──────────────────────────────────────────────────────────────

type TabKey = "todas" | "sin_factura" | "pendiente" | "validada" | "con_diferencias"

const TABS: { key: TabKey; label: string; descripcion: string }[] = [
  { key: "todas", label: "Todas", descripcion: "Todas las OCs elegibles para facturación." },
  { key: "sin_factura", label: "Sin factura", descripcion: "OC aprobada pero sin factura registrada aún." },
  { key: "pendiente", label: "Sin validar", descripcion: "Factura cargada pero pendiente de validación frente a la OC." },
  { key: "validada", label: "Validadas", descripcion: "Facturas que coinciden con la OC en todos los campos clave." },
  { key: "con_diferencias", label: "Con diferencias", descripcion: "Facturas con campos que no coinciden con la referencia de la OC." },
]

/** Cuenta los ítems de un tab sobre el conjunto ya pre-filtrado por proveedor/plataforma. */
function contarPorTab(base: SolicitudConFactura[], key: TabKey): number {
  if (key === "todas") return base.length
  if (key === "sin_factura") return base.filter((s) => !s.factura_id).length
  return base.filter((s) => s.factura_estado === key).length
}

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
      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
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
  const [vistaSolicitud, setVistaSolicitud] = useState<SolicitudConFactura | null>(null)
  const [filtroProveedor, setFiltroProveedor] = useState<string | null>(null)
  const [filtroPlataforma, setFiltroPlataforma] = useState<string | null>(null)
  const [filtroArea, setFiltroArea] = useState<string | null>(null)

  // Opciones únicas para los combobox, derivadas de los datos cargados
  const opcionesProveedor: ComboboxOption[] = useMemo(() => {
    const nombres = new Set<string>()
    for (const s of solicitudes) {
      if (s.proveedor_nombre) nombres.add(s.proveedor_nombre)
    }
    return Array.from(nombres)
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((n) => ({ value: n, label: n }))
  }, [solicitudes])

  const opcionesPlataforma: ComboboxOption[] = useMemo(() => {
    const vals = new Set<string>()
    for (const s of solicitudes) {
      if (s.plataforma) vals.add(s.plataforma)
    }
    return Array.from(vals)
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((p) => ({ value: p, label: p }))
  }, [solicitudes])

  const opcionesArea: ComboboxOption[] = useMemo(() => {
    const vals = new Set<string>()
    for (const s of solicitudes) {
      if (s.area_solicitante) vals.add(s.area_solicitante)
    }
    return Array.from(vals)
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((a) => ({ value: a, label: a }))
  }, [solicitudes])

  // Pre-filtrado por proveedor y plataforma — alimenta los conteos de tabs
  const filtradoBase = useMemo(
    () =>
      solicitudes.filter((s) => {
        if (filtroProveedor && s.proveedor_nombre !== filtroProveedor) return false
        if (filtroPlataforma && s.plataforma !== filtroPlataforma) return false
        if (filtroArea && s.area_solicitante !== filtroArea) return false
        return true
      }),
    [solicitudes, filtroProveedor, filtroPlataforma, filtroArea],
  )

  // Filtrado final: proveedor + plataforma + tab activo
  const filtradas = useMemo(() => {
    if (tab === "todas") return filtradoBase
    if (tab === "sin_factura") return filtradoBase.filter((s) => !s.factura_id)
    return filtradoBase.filter((s) => s.factura_estado === tab)
  }, [filtradoBase, tab])

  const hayFiltrosActivos = filtroProveedor !== null || filtroPlataforma !== null || filtroArea !== null

  function limpiarFiltros() {
    setFiltroProveedor(null)
    setFiltroPlataforma(null)
    setFiltroArea(null)
  }

  return (
    <>
      {vistaSolicitud && (
        <VistaFacturacionModal
          open
          onClose={() => setVistaSolicitud(null)}
          solicitud={vistaSolicitud}
          factura={null}
        />
      )}
      <PageLayout title="Financiero">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/financiero")}
            className="text-muted-foreground mb-6"
          >
            ← Volver
          </Button>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Facturas de Proveedores</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              OCs elegibles para facturación
            </p>
          </div>

          {/* Filtros por proveedor y plataforma */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <Label className="text-xs whitespace-nowrap">Proveedor</Label>
              <Combobox
                options={opcionesProveedor}
                value={filtroProveedor}
                onChange={(v) => setFiltroProveedor(v as string | null)}
                placeholder="Todos los proveedores"
                className="w-64"
              />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <Label className="text-xs whitespace-nowrap">Plataforma</Label>
              <Combobox
                options={opcionesPlataforma}
                value={filtroPlataforma}
                onChange={(v) => setFiltroPlataforma(v as string | null)}
                placeholder="Todas las plataformas"
                className="w-52"
              />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <Label className="text-xs whitespace-nowrap">Área</Label>
              <Combobox
                options={opcionesArea}
                value={filtroArea}
                onChange={(v) => setFiltroArea(v as string | null)}
                placeholder="Todas las áreas"
                className="w-48"
              />
            </div>
            {hayFiltrosActivos && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={limpiarFiltros}
                className="text-xs font-medium text-primary hover:text-primary/70"
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {TABS.map((t) => {
              const conteo = contarPorTab(filtradoBase, t.key)
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {conteo > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                        tab === t.key
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {conteo}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {/* Descripción de la tab activa */}
          <p className="text-xs text-muted-foreground mt-2 mb-5">
            {TABS.find((t) => t.key === tab)?.descripcion}
          </p>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
              <svg className="animate-spin h-5 w-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando facturas...
            </div>
          )}

          {/* Empty */}
          {!isLoading && filtradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <svg className="w-12 h-12 mb-3 text-border" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" clipRule="evenodd" />
              </svg>
              <p className="text-sm">No hay facturas en esta categoría</p>
            </div>
          )}

          {/* Lista */}
          {!isLoading && filtradas.length > 0 && (
            <div className="space-y-3">
              {filtradas.map((s) => (
                <FacturaCard key={s.solicitud_id} solicitud={s} onVistaFacturacion={() => setVistaSolicitud(s)} />
              ))}
            </div>
          )}
      </PageLayout>
    </>
  )
}

// ── Tarjeta ───────────────────────────────────────────────────────────────────

function FacturaCard({
  solicitud: s,
  onVistaFacturacion,
}: {
  solicitud: SolicitudConFactura
  onVistaFacturacion: () => void
}) {
  const navigate = useNavigate()

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left — info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-bold text-primary">
                {s.consecutivo_os ?? "—"}
              </span>
              {(s.empresa_compra_nombre || s.plataforma) && (
                <span
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 uppercase tracking-wide border border-slate-200"
                  title="Empresa / plataforma de la compra"
                >
                  {s.empresa_compra_nombre ?? s.plataforma}
                </span>
              )}
              <FacturaEstadoBadge facturaId={s.factura_id} facturaEstado={s.factura_estado} />
            </div>
            <p className="text-sm font-semibold text-foreground truncate">
              {s.descripcion ?? "Sin descripción"}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {s.proveedor_nombre && (
                <span>Proveedor: <span className="text-foreground">{s.proveedor_nombre}</span></span>
              )}
              {s.area_solicitante && (
                <span>Área: <span className="text-foreground">{s.area_solicitante}</span></span>
              )}
              {s.condicion && String(s.condicion).trim() !== "" && (
                <span>Condición: <span className="text-foreground">{s.condicion}</span></span>
              )}
              {s.numero_oc && (
                <span>OC: <span className="text-foreground font-mono">{s.numero_oc}</span></span>
              )}
              {s.forma_pago && (
                <span>Pago: <span className="text-foreground">{s.forma_pago}</span></span>
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
            <p className="text-xs text-muted-foreground">Valor aprobado</p>
            <p className="text-sm font-semibold text-foreground">{formatCOP(s.valor_aprobado)}</p>
          </div>

          {/* Right — acciones */}
          <div className="shrink-0 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onVistaFacturacion()
              }}
            >
              Vista facturación
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/financiero/facturas/${s.solicitud_id}`)}
              className="text-primary hover:text-primary hover:bg-primary/10"
            >
              Ver detalle
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

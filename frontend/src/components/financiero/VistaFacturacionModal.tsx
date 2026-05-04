import { useEffect, useCallback } from "react"
import type { SolicitudConFactura, Factura, EstadoFactura } from "@/types/financiero"
import { formatCOP } from "@/lib/formatters"

export interface VistaFacturacionModalProps {
  open: boolean
  onClose: () => void
  solicitud: SolicitudConFactura
  /** Campos extra de factura (detalle); en listado puede ser null y se usan solo los de solicitud. */
  factura: Factura | null
}

function formatFechaFactura(v: string | null | undefined): string {
  if (!v) return "—"
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return v
    return d.toLocaleDateString("es-CO", { dateStyle: "long" })
  } catch {
    return v
  }
}

function labelEstadoFactura(e: EstadoFactura | null | undefined): string {
  if (!e) return "—"
  const m: Record<EstadoFactura, string> = {
    pendiente: "Pendiente de validar",
    validada: "Validada",
    con_diferencias: "Con diferencias",
  }
  return m[e] ?? e
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(11rem,14rem)_1fr] gap-1 sm:gap-4 py-2.5 border-b border-gray-100 last:border-0 text-sm">
      <span className="text-gray-500 font-medium shrink-0">{label}</span>
      <span className="text-gray-900 break-words">{value ?? "—"}</span>
    </div>
  )
}

export function VistaFacturacionModal({ open, onClose, solicitud, factura }: VistaFacturacionModalProps) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener("keydown", onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, onKeyDown])

  if (!open) return null

  const nitFactura = factura?.nit_proveedor ?? null
  const nombreFactura = factura?.nombre_proveedor ?? null
  const numeroFactura = factura?.numero_factura ?? solicitud.numero_factura
  const valorFactura = factura?.valor_factura ?? solicitud.valor_factura
  const fechaFactura = factura?.fecha_factura ?? solicitud.fecha_factura
  const fechaRecibida = factura?.fecha_recibida_factura ?? null
  const avalCompra = factura?.aval_compra ?? null
  const estadoFactura = factura?.estado ?? solicitud.factura_estado

  return (
    <div
      className="fixed inset-0 z-[85] flex items-stretch justify-center sm:items-center sm:p-6 bg-black/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vista-facturacion-titulo"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex flex-col w-full sm:max-w-4xl sm:max-h-[min(92vh,880px)] h-full sm:h-auto sm:rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-200/80"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-blue mb-1">
              Resumen para facturación
            </p>
            <h2 id="vista-facturacion-titulo" className="text-xl font-bold text-gray-900 truncate">
              {solicitud.consecutivo_os ?? "Solicitud"}
            </h2>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{solicitud.descripcion ?? "Sin descripción"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar ventana"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Autorización — destacada */}
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-1">
              Quién aprobó la compra
            </p>
            <p className="text-base font-semibold text-emerald-950">
              {solicitud.aprobado_por_nombre?.trim() || "— (sin registro de aprobador)"}
            </p>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Referencia OC / compra</h3>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4">
              <Row label="Número OC" value={solicitud.numero_oc ? <span className="font-mono">{solicitud.numero_oc}</span> : "—"} />
              <Row label="Empresa (compra)" value={solicitud.empresa_compra_nombre ?? solicitud.plataforma} />
              <Row label="Solicitante" value={solicitud.solicitante_nombre} />
              <Row label="Área solicitante" value={solicitud.area_solicitante} />
              <Row label="Condición comercial" value={solicitud.condicion} />
              <Row label="Forma de pago (cotización)" value={solicitud.forma_pago} />
              <Row label="Valor aprobado (OC)" value={formatCOP(solicitud.valor_aprobado)} />
              <Row label="Valor sin IVA" value={formatCOP(solicitud.valor_antes_iva)} />
              <Row label="IVA" value={formatCOP(solicitud.valor_iva)} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Proveedor</h3>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4">
              <Row label="Razón social (cotización)" value={solicitud.proveedor_nombre} />
              <Row label="NIT (cotización / OC)" value={solicitud.proveedor_nit ?? null} />
              <Row label="Razón social (factura)" value={nombreFactura} />
              <Row label="NIT (factura)" value={nitFactura} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Documento de factura</h3>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4">
              <Row
                label="Número de factura"
                value={numeroFactura ? <span className="font-mono font-semibold text-brand-blue">{numeroFactura}</span> : "—"}
              />
              <Row label="Fecha factura" value={formatFechaFactura(fechaFactura)} />
              <Row label="Valor factura" value={formatCOP(valorFactura)} />
              <Row label="Fecha recibida en contabilidad" value={formatFechaFactura(fechaRecibida)} />
              <Row label="Aval de compra" value={avalCompra} />
              <Row label="Estado validación" value={labelEstadoFactura(estadoFactura)} />
              {factura?.observaciones && String(factura.observaciones).trim() !== "" && (
                <Row label="Observaciones (factura)" value={factura.observaciones} />
              )}
            </div>
          </section>

          <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Formato para facturación</p>
                <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
                  Descarga de un documento con este mismo resumen (PDF u hoja de cálculo) estará disponible cuando se defina la plantilla.
                </p>
              </div>
              <button
                type="button"
                disabled
                className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-400 cursor-not-allowed opacity-90"
                title="Próximamente"
              >
                Descargar formato
              </button>
            </div>
          </section>
        </div>

        <footer className="shrink-0 px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105 transition-all"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}

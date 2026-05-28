import type { SolicitudConFactura, Factura, EstadoFactura } from "@/types/financiero"
import { formatCOP } from "@/lib/formatters"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

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
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(11rem,14rem)_1fr] gap-1 sm:gap-4 py-2.5 border-b border-border last:border-0 text-sm">
      <span className="text-muted-foreground font-medium shrink-0">{label}</span>
      <span className="text-foreground break-words">{value ?? "—"}</span>
    </div>
  )
}

export function VistaFacturacionModal({ open, onClose, solicitud, factura }: VistaFacturacionModalProps) {
  const numeroFactura = factura?.numero_factura ?? solicitud.numero_factura
  const valorFactura = factura?.valor_factura ?? solicitud.valor_factura
  const fechaFactura = factura?.fecha_factura ?? solicitud.fecha_factura
  const fechaRecibida = factura?.fecha_recibida_factura ?? null
  const avalCompra = factura?.aval_compra ?? null
  const estadoFactura = factura?.estado ?? solicitud.factura_estado

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="flex flex-col w-full sm:max-w-4xl sm:max-h-[min(92vh,880px)] h-full sm:h-auto p-0 overflow-hidden"
        aria-labelledby="vista-facturacion-titulo"
      >
        <header className="shrink-0 px-6 py-5 border-b border-border bg-gradient-to-r from-muted to-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-blue mb-1">
            Resumen para facturación
          </p>
          <DialogTitle className="text-xl font-bold text-foreground truncate">
            {solicitud.consecutivo_os ?? "Solicitud"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{solicitud.descripcion ?? "Sin descripción"}</p>
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
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Referencia OC / compra</h3>
            <div className="rounded-xl border border-border bg-muted/50 px-4">
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
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Proveedor</h3>
            <div className="rounded-xl border border-border bg-muted/50 px-4">
              <Row label="Razón social" value={solicitud.proveedor_nombre} />
              <Row label="NIT" value={solicitud.proveedor_nit ?? null} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Documento de factura</h3>
            <div className="rounded-xl border border-border bg-muted/50 px-4">
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

          <section className="rounded-xl border border-dashed border-border bg-muted/80 px-4 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Formato para facturación</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                  Abre una vista de impresión con este resumen. Desde el diálogo del navegador puedes guardar como PDF.
                </p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  window.open(
                    `/financiero/facturas/${solicitud.solicitud_id}/print`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className="shrink-0"
              >
                Descargar / Imprimir
              </Button>
            </div>
          </section>
        </div>

        <footer className="shrink-0 px-6 py-3 border-t border-border bg-muted flex justify-end">
          <Button type="button" onClick={onClose}>
            Cerrar
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

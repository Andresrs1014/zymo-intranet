import { useEffect } from "react"
import { useParams } from "react-router-dom"
import {
  useSolicitudFinancieroDetalle,
  useFactura,
} from "@/hooks/useFinanciero"
import { formatCOP } from "@/lib/formatters"
import type { EstadoFactura } from "@/types/financiero"
import { Button } from "@/components/ui/button"

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(v: string | null | undefined): string {
  if (!v) return "—"
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return v
    return d.toLocaleDateString("es-CO", { dateStyle: "long" })
  } catch {
    return v
  }
}

function labelEstado(e: EstadoFactura | null | undefined): string {
  if (!e) return "—"
  const m: Record<EstadoFactura, string> = {
    pendiente: "Pendiente de validar",
    validada: "Validada",
    con_diferencias: "Con diferencias",
  }
  return m[e] ?? e
}

function PrintRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-border last:border-0 text-sm">
      <span className="w-52 shrink-0 text-muted-foreground font-medium">{label}</span>
      <span className="text-foreground flex-1 break-words">{value ?? "—"}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 pb-1 border-b border-border">
        {title}
      </h2>
      {children}
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function PrintFacturacionPage() {
  const { solicitudId } = useParams<{ solicitudId: string }>()

  const { data: solicitud, isLoading } = useSolicitudFinancieroDetalle(solicitudId)
  const facturaId = solicitud?.factura_id ?? null
  const { data: factura, isLoading: loadingFactura } = useFactura(facturaId)

  // Auto-dispara impresión cuando los datos estén listos
  useEffect(() => {
    if (!solicitud) return
    if (facturaId && !factura) return // esperar la factura si existe
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [solicitud, factura, facturaId])

  if (isLoading || (facturaId && loadingFactura)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Preparando documento…
      </div>
    )
  }

  if (!solicitud) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-red-500">
        Solicitud no encontrada.
      </div>
    )
  }

  const numeroFactura = factura?.numero_factura ?? solicitud.numero_factura
  const valorFactura = factura?.valor_factura ?? solicitud.valor_factura
  const fechaFactura = factura?.fecha_factura ?? solicitud.fecha_factura
  const fechaRecibida = factura?.fecha_recibida_factura ?? null
  const avalCompra = factura?.aval_compra ?? null
  const estadoFactura = factura?.estado ?? solicitud.factura_estado
  const nitFactura = factura?.nit_proveedor ?? null
  const nombreFactura = factura?.nombre_proveedor ?? null

  return (
    <>
      {/* Estilos de impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 18mm 20mm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media screen {
          body { background: #f3f4f6; }
        }
      `}</style>

      {/* Barra de acción (solo en pantalla, oculta al imprimir) */}
      <div className="no-print fixed top-0 inset-x-0 z-10 bg-card border-b border-border flex items-center justify-between px-6 py-3 shadow-sm">
        <span className="text-sm text-muted-foreground font-medium">
          Vista previa — {solicitud.consecutivo_os ?? solicitudId}
        </span>
        <Button
          type="button"
          onClick={() => window.print()}
        >
          Imprimir / Guardar como PDF
        </Button>
      </div>

      {/* Contenido imprimible */}
      <div className="mx-auto max-w-3xl bg-card px-10 py-10 mt-16 print:mt-0 print:px-0 print:py-0 shadow-sm print:shadow-none min-h-screen">

        {/* Encabezado */}
        <div className="mb-8 pb-4 border-b-2 border-foreground">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Resumen para facturación
          </p>
          <h1 className="text-2xl font-bold text-foreground">
            {solicitud.consecutivo_os ?? "Solicitud"}
          </h1>
          {solicitud.descripcion && (
            <p className="text-sm text-muted-foreground mt-1">{solicitud.descripcion}</p>
          )}
        </div>

        {/* Aprobación */}
        <div className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 mb-0.5">
            Quién aprobó la compra
          </p>
          <p className="text-base font-semibold text-emerald-950">
            {solicitud.aprobado_por_nombre?.trim() || "— (sin registro de aprobador)"}
          </p>
        </div>

        {/* Referencia OC */}
        <Section title="Referencia OC / Compra">
          <PrintRow label="Número OC" value={
            solicitud.numero_oc
              ? <span className="font-mono font-semibold">{solicitud.numero_oc}</span>
              : "—"
          } />
          <PrintRow label="Empresa (compra)" value={solicitud.empresa_compra_nombre ?? solicitud.plataforma} />
          <PrintRow label="Solicitante" value={solicitud.solicitante_nombre} />
          <PrintRow label="Área solicitante" value={solicitud.area_solicitante} />
          <PrintRow label="Condición comercial" value={solicitud.condicion} />
          <PrintRow label="Forma de pago (cotización)" value={solicitud.forma_pago} />
          <PrintRow label="Valor aprobado (OC)" value={formatCOP(solicitud.valor_aprobado)} />
          <PrintRow label="Valor sin IVA" value={formatCOP(solicitud.valor_antes_iva)} />
          <PrintRow label="IVA" value={formatCOP(solicitud.valor_iva)} />
        </Section>

        {/* Proveedor */}
        <Section title="Proveedor">
          <PrintRow label="Razón social (cotización)" value={solicitud.proveedor_nombre} />
          <PrintRow label="NIT (cotización / OC)" value={solicitud.proveedor_nit ?? null} />
          <PrintRow label="Razón social (factura)" value={nombreFactura} />
          <PrintRow label="NIT (factura)" value={nitFactura} />
        </Section>

        {/* Documento de factura */}
        <Section title="Documento de factura">
          <PrintRow
            label="Número de factura"
            value={
              numeroFactura
                ? <span className="font-mono font-semibold text-blue-700">{numeroFactura}</span>
                : "—"
            }
          />
          <PrintRow label="Fecha factura" value={formatFecha(fechaFactura)} />
          <PrintRow label="Valor factura" value={formatCOP(valorFactura)} />
          <PrintRow label="Fecha recibida en contabilidad" value={formatFecha(fechaRecibida)} />
          <PrintRow label="Aval de compra" value={avalCompra} />
          <PrintRow label="Estado validación" value={labelEstado(estadoFactura)} />
          {factura?.observaciones && String(factura.observaciones).trim() !== "" && (
            <PrintRow label="Observaciones" value={factura.observaciones} />
          )}
        </Section>

        {/* Pie */}
        <div className="mt-10 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Generado desde ZYMO Intranet — Módulo Financiero</span>
          <span>{new Date().toLocaleDateString("es-CO", { dateStyle: "long" })}</span>
        </div>
      </div>
    </>
  )
}

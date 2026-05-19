import { useState, useRef, useEffect } from "react"
import { useDraft, useAutosaveDraft, useDeleteDraft } from "@/hooks/useDraft"
import { useNavigate, useParams } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  useSolicitudFinancieroDetalle,
  useFactura,
  useValidaciones,
  useSubirFactura,
  useActualizarFactura,
  useValidarFactura,
  useEliminarFactura,
  useFacturaCuentas,
  useCuentasContables,
  useAsignarCuenta,
  useQuitarCuenta,
  useActualizarSeguimientoFinanciero,
  useCotizacionesFinanciero,
  useCrearFacturaBorrador,
} from "@/hooks/useFinanciero"
import { Combobox } from "@/components/ui/Combobox"
import type { EstadoFactura, FacturaUpdate } from "@/types/financiero"
import { formatCOP } from "@/lib/formatters"
import { FormFieldCOP } from "@/components/forms/FormFieldCOP"
import { api, openAuthenticatedApiBlob } from "@/lib/api"
import { VistaFacturacionModal } from "@/components/financiero/VistaFacturacionModal"

// ── Helpers de legibilidad ────────────────────────────────────────────────────

const CAMPO_LABELS: Record<string, string> = {
  valor: "Valor total",
  nit_proveedor: "NIT proveedor",
  nombre_proveedor: "Razón social / nombre proveedor",
}

function labelValidacionCampo(campo: string): string {
  return CAMPO_LABELS[campo] ?? campo
}

function FacturaEstadoBadge({ estado }: { estado: EstadoFactura }) {
  const cfg: Record<EstadoFactura, { label: string; className: string }> = {
    pendiente: { label: "Pendiente", className: "bg-yellow-100 text-yellow-700" },
    validada: { label: "Validada", className: "bg-green-100 text-green-700" },
    con_diferencias: { label: "Con diferencias", className: "bg-red-100 text-red-700" },
  }
  const { label, className } = cfg[estado]
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FacturaDetallePage() {
  const navigate = useNavigate()
  const { solicitudId } = useParams<{ solicitudId: string }>()

  const { data: solicitud, isLoading: loadingSolicitud, isError: errorSolicitud } =
    useSolicitudFinancieroDetalle(solicitudId)

  const crearFacturaBorrador = useCrearFacturaBorrador()
  const { data: cotizacionesLista = [] } = useCotizacionesFinanciero(solicitudId)
  const cotizacionAprobada = cotizacionesLista.find((c) => c.aprobada === true) ?? null

  useEffect(() => {
    if (!solicitudId || !solicitud || solicitud.factura_id) return
    crearFacturaBorrador.mutate(solicitudId)
    // Solo al cargar detalle sin factura_id; idempotente en servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evitar re-disparos por callback de mutación
  }, [solicitudId, solicitud?.factura_id, solicitud?.solicitud_id])

  const facturaId = solicitud?.factura_id ?? null
  const { data: factura } = useFactura(facturaId)
  const { data: validaciones = [] } = useValidaciones(facturaId)

  const subirFactura = useSubirFactura()
  const actualizarFactura = useActualizarFactura()
  const validarFactura = useValidarFactura()
  const eliminarFactura = useEliminarFactura()
  const actualizarSeguimiento = useActualizarSeguimientoFinanciero()

  const { data: cuentasAsignadas = [] } = useFacturaCuentas(facturaId)
  const { data: todasCuentas = [] } = useCuentasContables(true)
  const asignarCuenta = useAsignarCuenta()
  const quitarCuenta = useQuitarCuenta()
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<number | null>(null)

  // Estado del visor PDF inline
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const [bitacora, setBitacora] = useState("")
  const [bitacoraDirty, setBitacoraDirty] = useState(false)
  const syncedSolicitudId = useRef<string | null>(null)
  useEffect(() => {
    if (solicitud && solicitud.solicitud_id !== syncedSolicitudId.current) {
      syncedSolicitudId.current = solicitud.solicitud_id
      setBitacora(solicitud.observaciones_seguimiento ?? "")
      setBitacoraDirty(false)
    }
  }, [solicitud])

  const cuentasOpciones = todasCuentas
    .filter((c) => !cuentasAsignadas.some((a) => a.cuenta_id === c.id))
    .map((c) => ({
      value: c.id,
      label: c.nombre_cuenta,
      sublabel: c.numero_cuenta,
      detail: c.tipo_gasto_nombre ? `Tipo de gasto: ${c.tipo_gasto_nombre}` : "Sin tipo de gasto",
    }))

  const [showVistaFacturacion, setShowVistaFacturacion] = useState(false)

  // Borrador (draft) hooks
  const { data: borrador } = useDraft("factura", solicitudId)
  const deleteDraft = useDeleteDraft()
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)

  // Form state for editing
  const [form, setForm] = useState<FacturaUpdate>({})
  const [formDirty, setFormDirty] = useState(false)

  // Sync form when factura loads (use ref to avoid re-initialising on every render)
  const syncedFacturaId = useRef<string | null>(null)
  useEffect(() => {
    if (factura && factura.id !== syncedFacturaId.current) {
      syncedFacturaId.current = factura.id
      setForm({
        numero_factura: factura.numero_factura ?? "",
        valor_factura: factura.valor_factura ?? undefined,
        fecha_factura: factura.fecha_factura ?? new Date().toISOString().split("T")[0],
      })
      setFormDirty(false)
    }
  }, [factura])

  // Autosave: only when draft has been restored (or user started editing); pass null otherwise
  useAutosaveDraft("factura", solicitudId, draftRestored ? (form as Record<string, unknown>) : null)

  // Cargar PDF como blob URL autenticado para el visor inline
  useEffect(() => {
    if (!facturaId || !factura?.pdf_path) {
      setPdfBlobUrl(null)
      return
    }
    const esPdf = factura.pdf_path.toLowerCase().endsWith(".pdf")
    if (!esPdf) {
      setPdfBlobUrl(null)
      return
    }
    let objectUrl: string | null = null
    setPdfLoading(true)
    api
      .get(`/api/financiero/facturas/${facturaId}/pdf`, { responseType: "blob" })
      .then((resp) => {
        objectUrl = URL.createObjectURL(resp.data as Blob)
        setPdfBlobUrl(objectUrl)
      })
      .catch(() => setPdfBlobUrl(null))
      .finally(() => setPdfLoading(false))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setPdfBlobUrl(null)
    }
  }, [facturaId, factura?.pdf_path])

  // Show modal when a draft exists and hasn't been acted on yet
  useEffect(() => {
    if (borrador && !draftRestored) {
      setShowDraftModal(true)
    }
  }, [borrador, draftRestored])

  function restaurarBorrador() {
    if (!borrador?.payload) return
    setForm((prev) => ({ ...prev, ...(borrador.payload as typeof prev) }))
    setDraftRestored(true)
    setShowDraftModal(false)
  }

  function descartarBorrador() {
    if (solicitudId) deleteDraft.mutate({ tipo: "factura", solicitudId })
    setShowDraftModal(false)
  }

  function handleChange(field: keyof FacturaUpdate, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormDirty(true)
  }

  function handleGuardar() {
    if (!facturaId) return
    actualizarFactura.mutate(
      { facturaId, data: form },
      {
        onSuccess: () => {
          setFormDirty(false)
          if (solicitudId) deleteDraft.mutate({ tipo: "factura", solicitudId })
        },
      }
    )
  }

  function handleValidar() {
    if (!facturaId) return
    validarFactura.mutate(facturaId)
  }

  function handleEliminar() {
    if (!facturaId) return
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta factura? Tendrás que subirla y extraer sus datos nuevamente.")) return
    eliminarFactura.mutate(facturaId)
  }

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFileUpload(file: File) {
    if (!solicitudId) return
    subirFactura.mutate({ solicitudId, file })
  }

  async function handleVerProforma() {
    if (!solicitudId) return
    const resp = await api.get(`/api/financiero/facturas/${solicitudId}/proforma`, { responseType: "blob" })
    const url = URL.createObjectURL(resp.data as Blob)
    const win = window.open(url, "_blank", "noopener,noreferrer")
    if (!win) URL.revokeObjectURL(url)
    else window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
  }

  function handleGuardarBitacora() {
    if (!solicitudId) return
    actualizarSeguimiento.mutate(
      { solicitudId, observaciones: bitacora },
      { onSuccess: () => setBitacoraDirty(false) }
    )
  }

  async function handleVerAdjuntoCotizacion(cotizacionId: string) {
    const resp = await api.get(`/api/financiero/cotizaciones/${cotizacionId}/adjunto`, {
      responseType: "blob",
    })
    const url = URL.createObjectURL(resp.data as Blob)
    const win = window.open(url, "_blank", "noopener,noreferrer")
    if (!win) URL.revokeObjectURL(url)
    else window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
  }

  if (loadingSolicitud) {
    return (
      <PageLayout title="Financiero" mainClassName="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Cargando…
      </PageLayout>
    )
  }

  if (errorSolicitud || !solicitud) {
    return (
      <PageLayout title="Financiero" mainClassName="flex-1 flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-gray-600">Esta solicitud no está disponible en Financiero o no existe.</p>
        <button
          type="button"
          onClick={() => navigate("/financiero/facturas")}
          className="text-sm text-brand-blue font-medium hover:underline"
        >
          Volver al listado
        </button>
      </PageLayout>
    )
  }

  return (
    <>
      <VistaFacturacionModal
        open={showVistaFacturacion}
        onClose={() => setShowVistaFacturacion(false)}
        solicitud={solicitud}
        factura={factura ?? null}
      />
      {showDraftModal && borrador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Borrador guardado</h2>
            <p className="text-sm text-gray-500 mb-1">
              Tienes un borrador de factura guardado del{" "}
              <span className="font-medium text-gray-700">
                {new Date(borrador.updated_at).toLocaleDateString("es-CO", {
                  day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </p>
            <p className="text-sm text-gray-500 mb-5">¿Deseas continuar donde lo dejaste?</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={descartarBorrador}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={restaurarBorrador}
                className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                Continuar borrador
              </button>
            </div>
          </div>
        </div>
      )}
      <PageLayout title="Financiero">
          {/* Back button */}
          <button
            onClick={() => navigate("/financiero/facturas")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header con estado */}
          <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">
                  {solicitud?.consecutivo_os ?? solicitudId}
                </h1>
                {(solicitud?.empresa_compra_nombre || solicitud?.plataforma) && (
                  <span
                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-800 border border-slate-200 shrink-0"
                    title="Empresa en la que se realiza la compra"
                  >
                    {solicitud.empresa_compra_nombre ?? solicitud.plataforma}
                  </span>
                )}
                {(factura?.estado ?? solicitud.factura_estado) && (
                  <FacturaEstadoBadge estado={(factura?.estado ?? solicitud.factura_estado)!} />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xl">
                {solicitud?.descripcion ?? "Sin descripción"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowVistaFacturacion(true)}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors shadow-sm"
            >
              Vista facturación
            </button>
          </div>

          <div className="space-y-6">
            {/* Bitácora financiera (todo el ciclo; proforma/anticipo) */}
            <section className="bg-white rounded-xl border border-amber-100 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Bitácora / observaciones del proceso
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                    Notas internas de contabilidad durante la compra (anticipo, proforma, dudas antes de validar la
                    factura). Independiente de las observaciones del documento de factura.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {solicitud.tiene_proforma && (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                      Anticipo / proforma
                    </span>
                  )}
                  {solicitud.tiene_proforma && solicitud.proforma_path && (
                    <button
                      type="button"
                      onClick={() => handleVerProforma()}
                      className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-900 hover:bg-yellow-100 transition-colors"
                    >
                      Ver proforma
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={4}
                value={bitacora}
                onChange={(e) => {
                  setBitacora(e.target.value)
                  setBitacoraDirty(true)
                }}
                placeholder="Ej.: Anticipo aprobado 15/04; pendiente conciliar con factura final…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-y min-h-[88px]"
              />
              <div className="flex items-center justify-between mt-3 gap-2">
                <p className="text-xs text-gray-400">
                  {solicitud.seguimiento_updated_at
                    ? `Último guardado: ${new Date(solicitud.seguimiento_updated_at).toLocaleString("es-CO")}`
                  : "Sin guardados aún"}
                </p>
                <button
                  type="button"
                  onClick={handleGuardarBitacora}
                  disabled={!bitacoraDirty || actualizarSeguimiento.isPending}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50 transition-all"
                >
                  {actualizarSeguimiento.isPending ? "Guardando…" : "Guardar bitácora"}
                </button>
              </div>
            </section>

            {/* Cotizaciones cargadas (solo lectura + adjuntos) */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">
                Cotizaciones del proceso
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Vista de cotizaciones cargadas por Compras. Puede abrir adjuntos; no se suben archivos desde Financiero.
              </p>
              {cotizacionesLista.length === 0 ? (
                <p className="text-sm text-gray-400">No hay cotizaciones registradas.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-100 bg-gray-50">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Proveedor</th>
                        <th className="px-3 py-2">N° cot. prov.</th>
                        <th className="px-3 py-2">Aprobada</th>
                        <th className="px-3 py-2 text-right">Valor total</th>
                        <th className="px-3 py-2 text-right">Valor aprobado</th>
                        <th className="px-3 py-2">Adjunto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {cotizacionesLista.map((c) => (
                        <tr key={c.id} className="text-gray-800">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                            {new Date(c.created_at).toLocaleString("es-CO", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-medium">{c.proveedor_nombre}</span>
                            {c.proveedor_nit && (
                              <span className="block text-xs text-gray-500">NIT {c.proveedor_nit}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono">
                            {c.numero_cotizacion_proveedor ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            {c.aprobada === true ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-green-700 font-medium text-xs">Sí</span>
                                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700 uppercase tracking-wide">
                                  Ref. OC
                                </span>
                              </span>
                            ) : c.aprobada === false ? (
                              <span className="text-gray-500 text-xs">No</span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {formatCOP(c.valor_total)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {c.valor_aprobado != null ? formatCOP(c.valor_aprobado) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {c.tiene_adjunto ? (
                              <button
                                type="button"
                                onClick={() => handleVerAdjuntoCotizacion(c.id)}
                                className="text-xs font-medium text-brand-blue hover:underline"
                              >
                                Ver archivo
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">Sin archivo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Sección A: Info de la OC ───────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Información de la OC
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Datos de la orden emitida y de la cotización aprobada asociada (referencia para conciliar con la factura).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openAuthenticatedApiBlob(
                      `/api/financiero/solicitudes/${solicitudId}/descargar-oc`
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                    <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                  </svg>
                  Descargar OC
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
                <InfoField label="OS" value={solicitud?.consecutivo_os} mono />
                <InfoField label="Número OC" value={solicitud?.numero_oc} mono />
                <InfoField label="Empresa (compra)" value={solicitud?.empresa_compra_nombre ?? solicitud?.plataforma} />
                <InfoField label="Proveedor (OC)" value={solicitud?.proveedor_nombre} />
                <InfoField label="Aprobado por" value={solicitud?.aprobado_por_nombre} />
                <InfoField label="Área" value={solicitud?.area_solicitante} />
                <InfoField label="Condición" value={solicitud?.condicion} />
                <InfoField label="Plataforma (código)" value={solicitud?.plataforma} />
                <InfoField label="Forma de pago (cotización)" value={solicitud?.forma_pago} />
                <InfoField label="Valor aprobado" value={formatCOP(solicitud?.valor_aprobado ?? null)} />
                <InfoField label="Valor sin IVA" value={formatCOP(solicitud?.valor_antes_iva ?? null)} />
                <InfoField label="IVA" value={formatCOP(solicitud?.valor_iva ?? null)} />
              </div>
            </section>

            {/* ── Sección: Conciliación OC vs Factura ──────────────────── */}
            {factura && (
              <section className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
                <div className="mb-3">
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Conciliación OC vs Factura
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Campos clave lado a lado. Los valores de factura reflejan la edición actual
                    {formDirty ? " (con cambios sin guardar)" : ""}.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-medium text-gray-400 uppercase border-b border-gray-100">
                        <th className="pb-2 text-left pr-4 w-32">Campo</th>
                        <th className="pb-2 text-left pr-4">Referencia OC</th>
                        <th className="pb-2 text-left">Factura</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <ConciliarFila
                        label="Valor total"
                        oc={formatCOP(solicitud.valor_aprobado ?? null)}
                        factura={form.valor_factura != null ? formatCOP(form.valor_factura) : "—"}
                        igual={
                          solicitud.valor_aprobado != null &&
                          form.valor_factura != null &&
                          Math.abs(solicitud.valor_aprobado - form.valor_factura) < 1
                        }
                      />
                      <ConciliarFila
                        label="NIT proveedor"
                        oc={cotizacionAprobada?.proveedor_nit ?? "—"}
                        factura={factura?.nit_proveedor ?? "—"}
                      />
                      <ConciliarFila
                        label="Razón social"
                        oc={solicitud.proveedor_nombre ?? "—"}
                        factura={factura?.nombre_proveedor ?? "—"}
                      />
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Nueva sección comparativa: OC + Formulario | Visor PDF ─── */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 pt-5 pb-3 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Factura del proveedor
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Complete los tres campos y adjunte el archivo. La fecha se pre-rellena con el día de hoy.
                </p>
              </div>

              <div className="flex min-h-[600px]">
                {/* ── Columna izquierda ───────────────────────────────────── */}
                <div className="w-1/2 border-r border-gray-100 flex flex-col">

                  {/* Cuadrante 1: Referencia de la OC */}
                  <div className="p-5 border-b border-gray-100 flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Referencia OC
                    </p>
                    <div className="space-y-2">
                      <OcRefField label="Aval de compra" value={solicitud.aval_compra_solicitud} />
                      <OcRefField label="Valor aprobado" value={formatCOP(solicitud.valor_aprobado ?? null)} />
                      <OcRefField
                        label="Fecha en plataforma"
                        value={
                          solicitud.fecha_en_plataforma
                            ? new Date(solicitud.fecha_en_plataforma).toLocaleDateString("es-CO")
                            : null
                        }
                      />
                      <OcRefField label="Proveedor" value={solicitud.proveedor_nombre} />
                      {solicitud.proveedor_nit && (
                        <OcRefField label="NIT proveedor" value={solicitud.proveedor_nit} />
                      )}
                    </div>

                    {solicitud.items_cotizacion && solicitud.items_cotizacion.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Ítems cotizados
                        </p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {solicitud.items_cotizacion.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700"
                            >
                              <span className="font-medium">
                                {item.descripcion ?? `Ítem ${idx + 1}`}
                              </span>
                              {item.cantidad != null && (
                                <span className="ml-2 text-gray-500">× {item.cantidad}</span>
                              )}
                              {item.valor_total != null && (
                                <span className="ml-2 font-mono text-gray-600">
                                  {formatCOP(item.valor_total)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cuadrante 2: Formulario de facturación */}
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Datos de la factura
                    </p>

                    {!solicitud.factura_id && crearFacturaBorrador.isPending && (
                      <div className="py-8 text-center text-sm text-gray-500">Preparando registro…</div>
                    )}

                    {!solicitud.factura_id && crearFacturaBorrador.isError && (
                      <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                        No se pudo iniciar el registro.{" "}
                        <button
                          type="button"
                          className="underline font-medium"
                          onClick={() => solicitudId && crearFacturaBorrador.mutate(solicitudId)}
                        >
                          Reintentar
                        </button>
                      </div>
                    )}

                    {factura && (
                      <>
                        <div className="space-y-3 mb-4">
                          <FormField
                            label="Número de factura"
                            value={form.numero_factura ?? ""}
                            onChange={(v) => handleChange("numero_factura", v)}
                          />
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-medium text-gray-600">
                                Valor factura
                              </label>
                              {solicitud?.valor_aprobado != null && (
                                <button
                                  type="button"
                                  onClick={() => handleChange("valor_factura", solicitud.valor_aprobado!)}
                                  className="text-xs text-brand-blue hover:underline"
                                >
                                  Usar valor OC ({formatCOP(solicitud.valor_aprobado)})
                                </button>
                              )}
                            </div>
                            <FormFieldCOP
                              label=""
                              value={form.valor_factura}
                              onChange={(v) => handleChange("valor_factura", v ?? 0)}
                            />
                          </div>
                          <FormFieldDate
                            label="Fecha factura"
                            value={form.fecha_factura ?? ""}
                            onChange={(v) => handleChange("fecha_factura", v)}
                          />
                        </div>

                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-3 mb-4">
                          <p className="text-xs font-medium text-gray-600 mb-2">Archivo de factura</p>
                          <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => {
                              e.preventDefault()
                              setDragOver(false)
                              const file = e.dataTransfer.files[0]
                              if (file) handleFileUpload(file)
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
                              dragOver
                                ? "border-brand-blue bg-brand-blue/5"
                                : "border-gray-200 hover:border-brand-blue/40 hover:bg-white"
                            }`}
                          >
                            <p className="text-sm font-medium text-gray-700 text-center">
                              {subirFactura.isPending
                                ? "Subiendo…"
                                : factura.pdf_path
                                  ? "Clic o arrastre para reemplazar"
                                  : "Clic o arrastre para adjuntar"}
                            </p>
                            <p className="text-xs text-gray-400">PDF, Excel (.xlsx) o Word (.docx)</p>
                            {subirFactura.isError && (
                              <p className="text-xs text-red-500">Error al subir. Intente de nuevo.</p>
                            )}
                            {factura.extraccion_automatica && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                                Número y valor prellenados desde archivo
                              </span>
                            )}
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.xlsx,.xls,.docx"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(file)
                            }}
                          />
                        </div>

                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                          <button
                            type="button"
                            onClick={handleEliminar}
                            disabled={eliminarFactura.isPending}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                            </svg>
                            {eliminarFactura.isPending ? "Eliminando…" : "Eliminar"}
                          </button>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleValidar}
                              disabled={validarFactura.isPending}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                              {validarFactura.isPending ? "Validando…" : "Correr validación"}
                            </button>
                            <button
                              onClick={handleGuardar}
                              disabled={!formDirty || actualizarFactura.isPending}
                              className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-105 disabled:opacity-50 transition-all"
                            >
                              {actualizarFactura.isPending ? "Guardando…" : "Guardar cambios"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Columna derecha: Visor PDF ────────────────────────────── */}
                <div className="w-1/2 flex flex-col bg-gray-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Vista previa de la factura
                    </p>
                    {factura?.pdf_path && (
                      <button
                        type="button"
                        onClick={() =>
                          openAuthenticatedApiBlob(`/api/financiero/facturas/${facturaId}/pdf`)
                        }
                        className="text-xs text-brand-blue hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
                        </svg>
                        Abrir en pestaña
                      </button>
                    )}
                  </div>

                  <div className="flex-1 relative">
                    {!factura?.pdf_path && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-gray-400">
                        <svg className="w-12 h-12 mb-3 text-gray-200" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5 4a2 2 0 0 1 2-2h6l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Z" />
                        </svg>
                        <p className="text-sm">Adjunte un archivo PDF para verlo aquí</p>
                        <p className="text-xs mt-1">También admite Excel y Word (sin vista previa inline)</p>
                      </div>
                    )}

                    {factura?.pdf_path && !factura.pdf_path.toLowerCase().endsWith(".pdf") && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-gray-400">
                        <p className="text-sm">Vista previa solo disponible para PDF.</p>
                        <button
                          type="button"
                          onClick={() =>
                            openAuthenticatedApiBlob(`/api/financiero/facturas/${facturaId}/pdf`)
                          }
                          className="mt-3 text-sm text-brand-blue hover:underline font-medium"
                        >
                          Descargar archivo adjunto
                        </button>
                      </div>
                    )}

                    {factura?.pdf_path?.toLowerCase().endsWith(".pdf") && pdfLoading && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                        Cargando PDF…
                      </div>
                    )}

                    {pdfBlobUrl && (
                      <iframe
                        src={pdfBlobUrl}
                        title="Vista previa factura"
                        className="absolute inset-0 w-full h-full border-0"
                      />
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ── Sección C: Resultado de Validación ────────────────────── */}
            {factura && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Resultado de Validación
                  </h2>
                  {validaciones.length > 0 && (
                    <button
                      type="button"
                      onClick={handleValidar}
                      disabled={validarFactura.isPending}
                      className="text-xs text-brand-blue hover:underline disabled:opacity-50"
                    >
                      {validarFactura.isPending ? "Validando…" : "Volver a validar"}
                    </button>
                  )}
                </div>

                {validaciones.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <svg className="w-10 h-10 text-gray-200" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5Zm0 7.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-gray-500 max-w-xs">
                      Aún no se ha ejecutado la validación frente a la OC.
                      Complete los campos de factura y luego corra la validación.
                    </p>
                    <button
                      type="button"
                      onClick={handleValidar}
                      disabled={validarFactura.isPending}
                      className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50 transition-all"
                    >
                      {validarFactura.isPending ? "Validando…" : "Correr validación"}
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs font-medium text-gray-500 uppercase border-b border-gray-100">
                          <th className="pb-2 text-left pr-4">Campo</th>
                          <th className="pb-2 text-left pr-4">Según OC</th>
                          <th className="pb-2 text-left pr-4">Valor Factura</th>
                          <th className="pb-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {validaciones.map((v) => (
                          <tr key={v.id}>
                            <td className="py-2.5 pr-4 font-medium text-gray-800">
                              {labelValidacionCampo(v.campo)}
                            </td>
                            <td className="py-2.5 pr-4 text-gray-500">{v.valor_esperado ?? "—"}</td>
                            <td className="py-2.5 pr-4 text-gray-500">
                              {v.valor_encontrado ?? "—"}
                              {v.observacion && (
                                <p className="text-xs text-gray-400 mt-0.5">{v.observacion}</p>
                              )}
                            </td>
                            <td className="py-2.5 text-center">
                              {v.cumple ? (
                                <span className="text-green-500 font-bold" title="Cumple">✓</span>
                              ) : (
                                <span className="text-red-500 font-bold" title="No cumple">✗</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ── Sección D: Cuentas Contables ──────────────────────────── */}
            {factura && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
                  Cuentas Contables
                </h2>

                {/* Asignar cuenta */}
                <div className="flex gap-2 mb-4">
                  <Combobox
                    className="flex-1"
                    options={cuentasOpciones}
                    value={cuentaSeleccionada}
                    onChange={(v) => setCuentaSeleccionada(v as number | null)}
                    placeholder="Buscar cuenta por número o nombre..."
                  />
                  <button
                    onClick={() => {
                      if (!cuentaSeleccionada || !facturaId) return
                      asignarCuenta.mutate(
                        { facturaId, cuentaId: cuentaSeleccionada },
                        { onSuccess: () => setCuentaSeleccionada(null) }
                      )
                    }}
                    disabled={!cuentaSeleccionada || asignarCuenta.isPending}
                    className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-105 disabled:opacity-50 transition-all shrink-0"
                  >
                    Agregar
                  </button>
                </div>

                {/* Lista de cuentas asignadas */}
                {cuentasAsignadas.length === 0 ? (
                  <p className="text-sm text-gray-400">No hay cuentas contables asignadas a esta factura.</p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {cuentasAsignadas.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-gray-400 w-14">{a.numero_cuenta}</span>
                          <div>
                            <p className="text-gray-800 font-medium">{a.nombre_cuenta}</p>
                            {a.tipo_gasto_nombre && (
                              <p className="text-xs text-gray-400">{a.tipo_gasto_nombre}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (!facturaId) return
                            quitarCuenta.mutate({ facturaId, asignacionId: a.id })
                          }}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors ml-4"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </PageLayout>
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function InfoField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-medium text-gray-800 ${mono ? "font-mono" : ""}`}>
        {value ?? "—"}
      </p>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
      />
    </div>
  )
}

function FormFieldDate({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
      />
    </div>
  )
}

function ConciliarFila({
  label,
  oc,
  factura,
  igual,
}: {
  label: string
  oc: string
  factura: string
  igual?: boolean
}) {
  const coincide = igual !== undefined
    ? igual
    : oc !== "—" && factura !== "—" && oc.trim().toLowerCase() === factura.trim().toLowerCase()
  const sinDatos = oc === "—" || factura === "—"

  return (
    <tr>
      <td className="py-2.5 pr-4 text-xs font-medium text-gray-500">{label}</td>
      <td className="py-2.5 pr-4 text-gray-700 text-sm">{oc}</td>
      <td className="py-2.5 text-sm">
        <span className={!sinDatos && !coincide ? "text-red-600 font-medium" : "text-gray-700"}>
          {factura}
        </span>
        {!sinDatos && (
          coincide
            ? <span className="ml-2 text-green-500 text-xs font-bold" title="Coincide">✓</span>
            : <span className="ml-2 text-red-400 text-xs font-bold" title="Difiere">✗</span>
        )}
      </td>
    </tr>
  )
}

function OcRefField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-xs text-gray-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-gray-800 font-medium">{value ?? "—"}</span>
    </div>
  )
}

import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import {
  useSolicitudesFinanciero,
  useFactura,
  useValidaciones,
  useSubirFactura,
  useActualizarFactura,
  useValidarFactura,
  useFacturaCuentas,
  useCuentasContables,
  useAsignarCuenta,
  useQuitarCuenta,
} from "@/hooks/useFinanciero"
import { Combobox } from "@/components/ui/Combobox"
import type { EstadoFactura, FacturaUpdate } from "@/types/financiero"
import { formatCOP, parseCOP } from "@/lib/formatters"

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

  const { data: solicitudes = [] } = useSolicitudesFinanciero()
  const solicitud = solicitudes.find((s) => s.solicitud_id === solicitudId)

  const facturaId = solicitud?.factura_id ?? null
  const { data: factura } = useFactura(facturaId)
  const { data: validaciones = [] } = useValidaciones(facturaId)

  const subirFactura = useSubirFactura()
  const actualizarFactura = useActualizarFactura()
  const validarFactura = useValidarFactura()

  const { data: cuentasAsignadas = [] } = useFacturaCuentas(facturaId)
  const { data: todasCuentas = [] } = useCuentasContables(true)
  const asignarCuenta = useAsignarCuenta()
  const quitarCuenta = useQuitarCuenta()
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<number | null>(null)

  const cuentasOpciones = todasCuentas
    .filter((c) => !cuentasAsignadas.some((a) => a.cuenta_id === c.id))
    .map((c) => ({ value: c.id, label: c.nombre_cuenta, sublabel: c.numero_cuenta }))

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
        fecha_factura: factura.fecha_factura ?? "",
        nit_proveedor: factura.nit_proveedor ?? "",
        nombre_proveedor: factura.nombre_proveedor ?? "",
        fecha_recibida_factura: factura.fecha_recibida_factura ?? "",
        aval_compra: factura.aval_compra ?? "",
        observaciones: factura.observaciones ?? "",
      })
      setFormDirty(false)
    }
  }, [factura])

  function handleChange(field: keyof FacturaUpdate, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormDirty(true)
  }

  function handleGuardar() {
    if (!facturaId) return
    actualizarFactura.mutate(
      { facturaId, data: form },
      { onSuccess: () => setFormDirty(false) }
    )
  }

  function handleValidar() {
    if (!facturaId) return
    validarFactura.mutate(facturaId)
  }

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFileUpload(file: File) {
    if (!solicitudId) return
    subirFactura.mutate({ solicitudId, file })
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Financiero" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Back button */}
          <button
            onClick={() => navigate("/financiero/facturas")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header con estado */}
          <div className="flex items-center gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {solicitud?.consecutivo_os ?? solicitudId}
                </h1>
                {factura && <FacturaEstadoBadge estado={factura.estado} />}
              </div>
              <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xl">
                {solicitud?.descripcion ?? "Sin descripción"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* ── Sección A: Info de la OC ───────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Información de la OC
                </h2>
                <button
                  onClick={() =>
                    window.open(
                      `/api/financiero/solicitudes/${solicitudId}/descargar-oc`,
                      "_blank"
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
                <InfoField label="Proveedor" value={solicitud?.proveedor_nombre} />
                <InfoField label="Área" value={solicitud?.area_solicitante} />
                <InfoField label="Plataforma" value={solicitud?.plataforma} />
                <InfoField label="Valor aprobado" value={formatCOP(solicitud?.valor_aprobado ?? null)} />
                <InfoField label="Valor sin IVA" value={formatCOP(solicitud?.valor_antes_iva ?? null)} />
                <InfoField label="IVA" value={formatCOP(solicitud?.valor_iva ?? null)} />
              </div>
            </section>

            {/* ── Sección B: Factura ─────────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
                Factura
              </h2>

              {!factura ? (
                /* Upload area */
                <div>
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
                    className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-12 cursor-pointer transition-colors ${
                      dragOver
                        ? "border-brand-blue bg-brand-blue/5"
                        : "border-gray-200 hover:border-brand-blue/40 hover:bg-gray-50"
                    }`}
                  >
                    <svg className="w-10 h-10 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" clipRule="evenodd" />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">
                        {subirFactura.isPending ? "Subiendo..." : "Arrastra el PDF aquí o haz clic para seleccionar"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PDF, Excel (.xlsx) o Word (.docx)</p>
                    </div>
                    {subirFactura.isError && (
                      <p className="text-xs text-red-500">
                        Error al subir la factura. Intenta de nuevo.
                      </p>
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
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={subirFactura.isPending}
                      className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50 transition-all"
                    >
                      {subirFactura.isPending ? "Subiendo..." : "Subir Factura"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Edit form */
                <div>
                  {factura.extraccion_automatica && (
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-medium text-blue-600">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                      </svg>
                      Campos extraídos automáticamente
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      label="Número de factura"
                      value={form.numero_factura ?? ""}
                      onChange={(v) => handleChange("numero_factura", v)}
                    />
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-gray-600">Valor factura</label>
                        {solicitud?.valor_aprobado != null && (
                          <button
                            type="button"
                            onClick={() => handleChange("valor_factura", solicitud.valor_aprobado!)}
                            className="text-xs text-brand-blue hover:underline"
                            title={`Usar valor OC: ${formatCOP(solicitud.valor_aprobado)}`}
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
                    <FormField
                      label="NIT proveedor"
                      value={form.nit_proveedor ?? ""}
                      onChange={(v) => handleChange("nit_proveedor", v)}
                    />
                    <FormField
                      label="Nombre proveedor"
                      value={form.nombre_proveedor ?? ""}
                      onChange={(v) => handleChange("nombre_proveedor", v)}
                    />
                    <FormFieldDate
                      label="Fecha recibida factura"
                      value={form.fecha_recibida_factura ?? ""}
                      onChange={(v) => handleChange("fecha_recibida_factura", v)}
                    />
                    <FormField
                      label="Aval de compra"
                      value={form.aval_compra ?? ""}
                      onChange={(v) => handleChange("aval_compra", v)}
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Observaciones
                    </label>
                    <textarea
                      rows={3}
                      value={form.observaciones ?? ""}
                      onChange={(e) => handleChange("observaciones", e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none"
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                      onClick={() => window.open(`/api/financiero/facturas/${facturaId}/pdf`, "_blank")}
                      className="mr-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                      title="Ver PDF en nueva pestaña"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                        <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" />
                      </svg>
                      Ver PDF
                    </button>
                    <button
                      onClick={handleValidar}
                      disabled={validarFactura.isPending}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {validarFactura.isPending ? "Validando..." : "Correr validación"}
                    </button>
                    <button
                      onClick={handleGuardar}
                      disabled={!formDirty || actualizarFactura.isPending}
                      className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50 transition-all"
                    >
                      {actualizarFactura.isPending ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ── Sección C: Resultado de Validación ────────────────────── */}
            {factura && validaciones.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
                  Resultado de Validación
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-medium text-gray-500 uppercase border-b border-gray-100">
                        <th className="pb-2 text-left pr-4">Campo</th>
                        <th className="pb-2 text-left pr-4">Valor OC</th>
                        <th className="pb-2 text-left pr-4">Valor Factura</th>
                        <th className="pb-2 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {validaciones.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2.5 pr-4 font-medium text-gray-800">{v.campo}</td>
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
        </main>
      </div>
    </div>
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

function FormFieldCOP({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  const [raw, setRaw] = useState(
    value != null ? value.toLocaleString("es-CO", { minimumFractionDigits: 0 }) : ""
  )

  // Sincronizar cuando el valor externo cambia (carga inicial desde backend)
  useEffect(() => {
    if (value != null) {
      setRaw(value.toLocaleString("es-CO", { minimumFractionDigits: 0 }))
    } else {
      setRaw("")
    }
  }, [value])

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => {
          const parsed = parseCOP(raw)
          onChange(parsed)
          if (parsed != null) {
            setRaw(parsed.toLocaleString("es-CO", { minimumFractionDigits: 0 }))
          }
        }}
        placeholder="0"
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

import { useRef, useState } from "react"
import { formatCOP } from "@/lib/formatters"
import { FormFieldCOP, MoneyInputCOP } from "@/components/forms/FormFieldCOP"
import { useNavigate, useParams } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import {
  useSolicitud,
  useCrearCotizacion,
  useProveedores,
  useExtraerCotizacion,
} from "@/hooks/useOC"
import type { CotizacionCreatePayload, ExtraccionResult, ItemCotizacion } from "@/hooks/useOC"

const EMPTY_FORM: CotizacionCreatePayload = {
  proveedor_nombre: "",
  proveedor_nit: "",
  proveedor_email: "",
  numero_cotizacion_proveedor: "",
  valor_unitario: 0,
  valor_antes_iva: undefined,
  valor_iva: undefined,
  valor_total: 0,
  fecha_estimada_entrega: "",
  forma_pago: "",
  plazo_entrega: "",
  garantia: "",
  anticipo: "",
  pago_saldo: "",
  observaciones: "",
}

const EMPTY_ITEM: ItemCotizacion = {
  descripcion: "",
  referencia: "",
  cantidad: undefined,
  valor_unitario: undefined,
  valor_total: undefined,
}

type ExtraccionStatus = "idle" | "loading" | "ok" | "warn" | "error"

function calcRowTotal(item: ItemCotizacion): number | undefined {
  if (item.cantidad != null && item.valor_unitario != null) {
    return item.cantidad * item.valor_unitario
  }
  return item.valor_total
}

function sumaItems(items: ItemCotizacion[]): number {
  return items.reduce((acc, item) => {
    const t = calcRowTotal(item)
    return acc + (t ?? 0)
  }, 0)
}

export function CotizacionFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: solicitud, isLoading: loadingSolicitud } = useSolicitud(id)
  const { data: proveedores = [] } = useProveedores()
  const crearCotizacion = useCrearCotizacion()
  const extraerCotizacion = useExtraerCotizacion()

  const [form, setForm] = useState<CotizacionCreatePayload>(EMPTY_FORM)
  const [items, setItems] = useState<ItemCotizacion[]>([])
  const [error, setError] = useState<string>()
  const [extraccion, setExtraccion] = useState<ExtraccionResult | null>(null)
  const [extStatus, setExtStatus] = useState<ExtraccionStatus>("idle")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const totalItems = sumaItems(items)
  const hayItems = items.length > 0
  // Con ítems: los precios de fila son base sin IVA → total = suma + IVA
  const ivaConItems = form.valor_iva ?? 0
  const valorTotalConItems = totalItems + ivaConItems

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleProveedorSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const proveedor = proveedores.find((p) => p.id === e.target.value)
    if (proveedor) {
      setForm((prev) => ({
        ...prev,
        proveedor_nombre: proveedor.nombre,
        proveedor_nit: proveedor.nit ?? "",
        proveedor_email: proveedor.email ?? "",
      }))
    }
  }

  function aplicarExtraccion(ext: ExtraccionResult) {
    setForm((prev) => ({
      ...prev,
      proveedor_nit: ext.proveedor_nit ?? prev.proveedor_nit,
      proveedor_nombre: ext.proveedor_nombre ?? prev.proveedor_nombre,
      numero_cotizacion_proveedor: ext.numero_cotizacion_proveedor ?? prev.numero_cotizacion_proveedor,
      valor_unitario: ext.valor_unitario ?? prev.valor_unitario,
      valor_antes_iva: ext.valor_antes_iva ?? prev.valor_antes_iva,
      valor_iva: ext.valor_iva ?? prev.valor_iva,
      valor_total: ext.valor_total ?? prev.valor_total,
      forma_pago: ext.forma_pago ?? prev.forma_pago,
      plazo_entrega: ext.plazo_entrega ?? prev.plazo_entrega,
      garantia: ext.garantia ?? prev.garantia,
      anticipo: ext.anticipo ?? prev.anticipo,
      pago_saldo: ext.pago_saldo ?? prev.pago_saldo,
    }))
    if (ext.items?.length) {
      setItems(ext.items)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return

    setExtStatus("loading")
    setExtraccion(null)

    extraerCotizacion.mutate(
      { solicitudId: id, file },
      {
        onSuccess: (data) => {
          setExtraccion(data)
          setExtStatus(data.campos_encontrados >= 3 ? "ok" : "warn")
          aplicarExtraccion(data)
        },
        onError: () => setExtStatus("error"),
      }
    )
    e.target.value = ""
  }

  // ── Item handlers ─────────────────────────────────────────────────────────

  function handleAddItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleItemChange(index: number, field: keyof ItemCotizacion, raw: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        if (field === "cantidad") {
          const qty = raw === "" ? undefined : Number(raw)
          const updated = { ...item, cantidad: qty }
          if (qty != null && item.valor_unitario != null) {
            updated.valor_total = qty * item.valor_unitario
          }
          return updated
        }
        return { ...item, [field]: raw }
      })
    )
  }

  function handleItemValorUnitario(index: number, unit: number | undefined) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const updated = { ...item, valor_unitario: unit }
        if (item.cantidad != null && unit != null) {
          updated.valor_total = item.cantidad * unit
        }
        return updated
      })
    )
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!form.proveedor_nombre.trim()) {
      setError("El nombre del proveedor es requerido.")
      return
    }

    const valorTotal = hayItems ? valorTotalConItems : form.valor_total
    if (!valorTotal || valorTotal <= 0) {
      setError("El valor total debe ser mayor a 0.")
      return
    }

    if (hayItems) {
      const sinDescripcion = items.some((it) => !it.descripcion.trim())
      if (sinDescripcion) {
        setError("Todos los ítems deben tener descripción.")
        return
      }
    }

    const payload: CotizacionCreatePayload = {
      ...form,
      valor_total: valorTotal,
      // Con ítems, la suma de filas es siempre el subtotal antes de IVA
      valor_antes_iva: hayItems ? totalItems : form.valor_antes_iva,
      proveedor_nit: form.proveedor_nit || undefined,
      proveedor_email: form.proveedor_email || undefined,
      numero_cotizacion_proveedor: form.numero_cotizacion_proveedor || undefined,
      fecha_estimada_entrega: form.fecha_estimada_entrega || undefined,
      forma_pago: form.forma_pago || undefined,
      plazo_entrega: form.plazo_entrega || undefined,
      garantia: form.garantia || undefined,
      anticipo: form.anticipo || undefined,
      pago_saldo: form.pago_saldo || undefined,
      observaciones: form.observaciones || undefined,
      items: hayItems ? items.map((it, i) => ({ ...it, num: it.num ?? i + 1 })) : undefined,
    }

    crearCotizacion.mutate(
      { solicitudId: id!, payload },
      {
        onSuccess: () => navigate(`/oc/solicitudes/${id}`),
        onError: (err: any) => {
          setError(err?.response?.data?.detail ?? "Error al guardar la cotización.")
        },
      }
    )
  }

  if (loadingSolicitud) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar title="OC Automatizaciones" />
          <main className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Cargando...
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="OC Automatizaciones" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <button
            onClick={() => navigate(`/oc/solicitudes/${id}`)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver al detalle
          </button>

          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Cargar Cotización</h1>
            {solicitud && (
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="font-mono text-brand-blue font-semibold">
                  {solicitud.consecutivo_os}
                </span>{" "}
                — {solicitud.descripcion}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">

            {/* ── Extracción automática ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Extracción automática
                <span className="ml-2 text-xs font-normal text-gray-400">
                  (PDF, Excel o Word del proveedor)
                </span>
              </h2>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.docx"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file && extStatus !== "loading") {
                    const synth = { target: { files: [file], value: "" } } as any
                    handleFileChange(synth)
                  }
                }}
                onClick={() => extStatus !== "loading" && fileInputRef.current?.click()}
                className={`w-full rounded-lg border-2 border-dashed py-6 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                  extStatus === "loading"
                    ? "border-gray-200 opacity-50 cursor-not-allowed"
                    : dragOver
                    ? "border-brand-blue bg-brand-blue/5 text-brand-blue/70"
                    : "border-gray-200 text-gray-400 hover:border-brand-blue/40 hover:text-brand-blue/70 hover:bg-brand-blue/5"
                }`}
              >
                {extStatus === "loading" ? (
                  <>
                    <span className="text-xl">⏳</span>
                    <span className="text-sm">Analizando documento...</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📎</span>
                    <span className="text-sm font-medium">
                      {dragOver ? "Suelta aquí el archivo" : "Arrastra el archivo aquí o haz clic para seleccionar"}
                    </span>
                    <span className="text-xs">PDF, Excel (.xlsx) o Word (.docx)</span>
                  </>
                )}
              </div>

              {extraccion && extStatus !== "idle" && (
                <div className={`mt-3 rounded-lg p-4 border text-sm ${
                  extStatus === "ok"
                    ? "bg-green-50 border-green-200"
                    : "bg-amber-50 border-amber-200"
                }`}>
                  <div className={`font-semibold mb-2 ${extStatus === "ok" ? "text-green-700" : "text-amber-700"}`}>
                    {extStatus === "ok"
                      ? `✓ Extracción exitosa — ${extraccion.campos_encontrados} campos encontrados`
                      : `⚠ Extracción parcial — ${extraccion.campos_encontrados} campos encontrados`}
                    <span className="font-normal ml-2 text-xs opacity-70">{extraccion.nombre_archivo}</span>
                    {extraccion.items?.length > 0 && (
                      <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 font-medium">
                        {extraccion.items.length} ítems detectados
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <ExtraidoItem label="NIT" value={extraccion.proveedor_nit} />
                    <ExtraidoItem label="Proveedor" value={extraccion.proveedor_nombre} />
                    <ExtraidoItem label="N° cotización" value={extraccion.numero_cotizacion_proveedor} />
                    <ExtraidoItem label="Valor unitario" value={extraccion.valor_unitario} money />
                    <ExtraidoItem label="Subtotal (antes IVA)" value={extraccion.valor_antes_iva} money />
                    <ExtraidoItem label="IVA" value={extraccion.valor_iva} money />
                    <ExtraidoItem label="Valor total" value={extraccion.valor_total} money />
                    <ExtraidoItem label="Forma de pago" value={extraccion.forma_pago} />
                    <ExtraidoItem label="Plazo de entrega" value={extraccion.plazo_entrega} />
                    <ExtraidoItem label="Garantía" value={extraccion.garantia} />
                    <ExtraidoItem label="Anticipo" value={extraccion.anticipo} />
                    <ExtraidoItem label="Pago saldo" value={extraccion.pago_saldo} />
                  </div>
                  {extStatus === "warn" && (
                    <p className="text-amber-600 text-xs mt-2">
                      Revisa y completa los campos no encontrados manualmente.
                    </p>
                  )}
                </div>
              )}

              {extStatus === "error" && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  No se pudo leer el archivo. Verifica que sea un PDF de texto (no escaneado), Excel o Word válido.
                </div>
              )}
            </div>

            {/* ── Catálogo de proveedores ───────────────────────────────────── */}
            {proveedores.length > 0 && (
              <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4">
                <label className="block text-sm font-medium text-brand-blue mb-2">
                  Seleccionar del catálogo de proveedores (opcional)
                </label>
                <select
                  onChange={handleProveedorSelect}
                  defaultValue=""
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                >
                  <option value="">— Elegir proveedor existente —</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.nit ? `(NIT: ${p.nit})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Datos del proveedor ───────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Datos del proveedor</h2>

              <Field label="Nombre del proveedor *">
                <input
                  name="proveedor_nombre"
                  value={form.proveedor_nombre}
                  onChange={handleChange}
                  placeholder="Empresa S.A.S."
                  className={inputCls}
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="NIT del proveedor">
                  <input
                    name="proveedor_nit"
                    value={form.proveedor_nit ?? ""}
                    onChange={handleChange}
                    placeholder="900.123.456-7"
                    className={inputCls}
                  />
                </Field>
                <Field label="N° cotización">
                  <input
                    name="numero_cotizacion_proveedor"
                    value={form.numero_cotizacion_proveedor ?? ""}
                    onChange={handleChange}
                    placeholder="COT-2026-001"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Email del proveedor">
                <input
                  name="proveedor_email"
                  type="email"
                  value={form.proveedor_email ?? ""}
                  onChange={handleChange}
                  placeholder="ventas@proveedor.com"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* ── Ítems de la cotización ────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">Ítems de la cotización</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {hayItems
                      ? `${items.length} ítem${items.length !== 1 ? "s" : ""} — el total se calcula automáticamente`
                      : "Opcional — para cotizaciones con múltiples productos"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 text-xs font-medium hover:bg-indigo-100 transition-colors"
                >
                  + Agregar ítem
                </button>
              </div>

              {!hayItems ? (
                <div className="text-center py-8 text-gray-300 text-xs border-2 border-dashed border-gray-100 rounded-lg">
                  Sin ítems — el valor total se ingresa manualmente abajo
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100 text-left">
                        <th className="py-2 pr-2 w-8 font-medium">#</th>
                        <th className="py-2 pr-2 font-medium">Descripción *</th>
                        <th className="py-2 pr-2 w-28 font-medium">Referencia</th>
                        <th className="py-2 pr-2 w-20 font-medium">Cant.</th>
                        <th className="py-2 pr-2 w-28 font-medium">V. Unit.</th>
                        <th className="py-2 pr-2 w-28 font-medium text-right">V. Total</th>
                        <th className="py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, i) => {
                        const rowTotal = calcRowTotal(item)
                        return (
                          <tr key={i} className="group hover:bg-gray-50/50">
                            <td className="py-1.5 pr-2 text-gray-400 font-mono">{i + 1}</td>
                            <td className="py-1.5 pr-2">
                              <input
                                value={item.descripcion}
                                onChange={(e) => handleItemChange(i, "descripcion", e.target.value)}
                                placeholder="Descripción del producto"
                                className={itemInputCls}
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                value={item.referencia ?? ""}
                                onChange={(e) => handleItemChange(i, "referencia", e.target.value)}
                                placeholder="Ref."
                                className={itemInputCls}
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.cantidad ?? ""}
                                onChange={(e) => handleItemChange(i, "cantidad", e.target.value)}
                                placeholder="0"
                                className={`${itemInputCls} text-right`}
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <MoneyInputCOP
                                value={item.valor_unitario}
                                onChange={(v) => handleItemValorUnitario(i, v)}
                                placeholder="0"
                                className={`${itemInputCls} text-right`}
                              />
                            </td>
                            <td className="py-1.5 pr-2 text-right font-mono text-gray-700">
                              {rowTotal != null
                                ? `$${rowTotal.toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-1.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(i)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-sm transition-opacity w-6 h-6 flex items-center justify-center rounded"
                                title="Eliminar fila"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200">
                        <td colSpan={5} className="py-2 text-right text-xs font-semibold text-gray-600 pr-2">
                          Total {items.length} ítem{items.length !== 1 ? "s" : ""}:
                        </td>
                        <td className="py-2 pr-2 text-right font-mono font-bold text-gray-900 text-sm">
                          ${totalItems.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* ── Valores ──────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Valores</h2>

              {hayItems ? (
                /* Con ítems: subtotal = suma de filas, total = subtotal + IVA */
                <div className="space-y-3">
                  <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-xs text-indigo-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal ({items.length} ítem{items.length !== 1 ? "s" : ""}):</span>
                      <span className="font-bold">
                        ${totalItems.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    {ivaConItems > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>+ IVA:</span>
                        <span className="font-bold">
                          ${ivaConItems.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-indigo-200 pt-1 text-sm font-semibold text-indigo-900">
                      <span>Total a pagar:</span>
                      <span>
                        ${valorTotalConItems.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  <Field label="IVA (si aplica)">
                    <MoneyInputCOP
                      value={form.valor_iva}
                      onChange={(v) => setForm((prev) => ({ ...prev, valor_iva: v }))}
                      placeholder="0"
                      className={inputCls}
                    />
                  </Field>
                </div>
              ) : (
                /* Sin ítems: campos manuales con auto-cálculo */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldCOP
                      label="Valor unitario"
                      value={form.valor_unitario || undefined}
                      onChange={(v) => setForm((prev) => ({ ...prev, valor_unitario: v ?? 0 }))}
                      inputClassName={inputCls}
                    />
                    <FormFieldCOP
                      label="Subtotal (antes de IVA)"
                      value={form.valor_antes_iva}
                      onChange={(v) => {
                        setForm((prev) => {
                          const next = { ...prev, valor_antes_iva: v }
                          if (v != null && prev.valor_iva != null) {
                            next.valor_total = Math.round((v + prev.valor_iva) * 100) / 100
                          }
                          return next
                        })
                      }}
                      inputClassName={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldCOP
                      label="IVA"
                      value={form.valor_iva}
                      onChange={(v) => {
                        setForm((prev) => {
                          const next = { ...prev, valor_iva: v }
                          if (prev.valor_antes_iva != null && v != null) {
                            next.valor_total =
                              Math.round((prev.valor_antes_iva + v) * 100) / 100
                          }
                          return next
                        })
                      }}
                      inputClassName={inputCls}
                    />
                    <FormFieldCOP
                      label="Valor total *"
                      value={form.valor_total || undefined}
                      onChange={(v) => {
                        setForm((prev) => {
                          const next = { ...prev, valor_total: v ?? 0 }
                          if (v != null && prev.valor_iva != null) {
                            next.valor_antes_iva =
                              Math.round((v - prev.valor_iva) * 100) / 100
                          }
                          return next
                        })
                      }}
                      inputClassName={inputCls}
                    />
                  </div>
                  {/* Indicador de consistencia */}
                  {form.valor_antes_iva != null && form.valor_iva != null && form.valor_total > 0 && (
                    (() => {
                      const esperado = Math.round((form.valor_antes_iva + form.valor_iva) * 100) / 100
                      const diff = Math.abs(esperado - form.valor_total)
                      return diff > 1 ? (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          ⚠ Subtotal + IVA = {esperado.toLocaleString("es-CO")} — no coincide con el total ingresado ({form.valor_total.toLocaleString("es-CO")})
                        </p>
                      ) : (
                        <p className="text-xs text-green-600">✓ Subtotal + IVA coinciden con el total</p>
                      )
                    })()
                  )}
                </div>
              )}

              <Field label="Fecha estimada de entrega">
                <input
                  name="fecha_estimada_entrega"
                  type="date"
                  value={form.fecha_estimada_entrega ?? ""}
                  onChange={handleChange}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* ── Condiciones ───────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Condiciones</h2>

              <Field label="Forma de pago">
                <input
                  name="forma_pago"
                  value={form.forma_pago ?? ""}
                  onChange={handleChange}
                  placeholder="Ej: Crédito 30 días, Contado..."
                  className={inputCls}
                />
              </Field>

              <Field label="Plazo de entrega">
                <input
                  name="plazo_entrega"
                  value={form.plazo_entrega ?? ""}
                  onChange={handleChange}
                  placeholder="Ej: 5 días hábiles"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Anticipo">
                  <input
                    name="anticipo"
                    value={form.anticipo ?? ""}
                    onChange={handleChange}
                    placeholder="Ej: 50%"
                    className={inputCls}
                  />
                </Field>
                <Field label="Pago de saldo">
                  <input
                    name="pago_saldo"
                    value={form.pago_saldo ?? ""}
                    onChange={handleChange}
                    placeholder="Ej: Contra entrega"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Garantía">
                <input
                  name="garantia"
                  value={form.garantia ?? ""}
                  onChange={handleChange}
                  placeholder="Ej: 1 año de garantía en defectos de fabricación"
                  className={inputCls}
                />
              </Field>

              <Field label="Observaciones adicionales">
                <textarea
                  name="observaciones"
                  value={form.observaciones ?? ""}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Garantías, condiciones especiales, etc."
                  className={`${inputCls} resize-none`}
                />
              </Field>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={crearCotizacion.isPending}
                className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
              >
                {crearCotizacion.isPending ? "Guardando..." : "Enviar a aprobación"}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/oc/solicitudes/${id}`)}
                className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"

const itemInputCls =
  "w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-blue/30"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ExtraidoItem({
  label,
  value,
  money,
}: {
  label: string
  value: string | number | null | undefined
  money?: boolean
}) {
  const found = value !== null && value !== undefined
  const display = found
    ? money
      ? formatCOP(Number(value))
      : String(value)
    : "No encontrado"

  return (
    <div className={`flex gap-1 ${found ? "text-gray-700" : "text-gray-400"}`}>
      <span className="font-medium shrink-0">{label}:</span>
      <span className="truncate">{display}</span>
    </div>
  )
}

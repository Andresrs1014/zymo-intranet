import { useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import {
  useSolicitud,
  useCrearCotizacion,
  useProveedores,
  useExtraerCotizacion,
} from "@/hooks/useOC"
import type { CotizacionCreatePayload, ExtraccionResult } from "@/hooks/useOC"

const EMPTY_FORM: CotizacionCreatePayload = {
  proveedor_nombre: "",
  proveedor_nit: "",
  proveedor_email: "",
  numero_cotizacion_proveedor: "",
  valor_unitario: 0,
  valor_antes_iva: undefined,
  valor_iva: undefined,
  valor_total: 0,
  fecha_vigencia: "",
  forma_pago: "",
  plazo_entrega: "",
  observaciones: "",
}

type ExtraccionStatus = "idle" | "loading" | "ok" | "warn" | "error"

export function CotizacionFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: solicitud, isLoading: loadingSolicitud } = useSolicitud(id)
  const { data: proveedores = [] } = useProveedores()
  const crearCotizacion = useCrearCotizacion()
  const extraerCotizacion = useExtraerCotizacion()

  const [form, setForm] = useState<CotizacionCreatePayload>(EMPTY_FORM)
  const [error, setError] = useState<string>()
  const [extraccion, setExtraccion] = useState<ExtraccionResult | null>(null)
  const [extStatus, setExtStatus] = useState<ExtraccionStatus>("idle")
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    const numericos = ["valor_unitario", "valor_antes_iva", "valor_iva", "valor_total"]
    setForm((prev) => ({
      ...prev,
      [name]: numericos.includes(name) ? (value === "" ? undefined : Number(value)) : value,
    }))
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
      valor_unitario: ext.valor_unitario ?? prev.valor_unitario,
      valor_antes_iva: ext.valor_antes_iva ?? prev.valor_antes_iva,
      valor_iva: ext.valor_iva ?? prev.valor_iva,
      valor_total: ext.valor_total ?? prev.valor_total,
      forma_pago: ext.forma_pago ?? prev.forma_pago,
      plazo_entrega: ext.plazo_entrega ?? prev.plazo_entrega,
    }))
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
    // Limpiar input para permitir resubida del mismo archivo
    e.target.value = ""
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!form.proveedor_nombre.trim()) {
      setError("El nombre del proveedor es requerido.")
      return
    }
    if (!form.valor_total || form.valor_total <= 0) {
      setError("El valor total debe ser mayor a 0.")
      return
    }

    const payload: CotizacionCreatePayload = {
      ...form,
      proveedor_nit: form.proveedor_nit || undefined,
      proveedor_email: form.proveedor_email || undefined,
      numero_cotizacion_proveedor: form.numero_cotizacion_proveedor || undefined,
      fecha_vigencia: form.fecha_vigencia || undefined,
      forma_pago: form.forma_pago || undefined,
      plazo_entrega: form.plazo_entrega || undefined,
      observaciones: form.observaciones || undefined,
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
          {/* Breadcrumb */}
          <button
            onClick={() => navigate(`/oc/solicitudes/${id}`)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver al detalle
          </button>

          {/* Header */}
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

          <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">

            {/* ── Zona de carga automática ─────────────────────────────────── */}
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

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={extStatus === "loading"}
                className="w-full rounded-lg border-2 border-dashed border-gray-200 py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-brand-blue/40 hover:text-brand-blue/70 hover:bg-brand-blue/5 transition-all disabled:opacity-50"
              >
                {extStatus === "loading" ? (
                  <>
                    <span className="text-xl">⏳</span>
                    <span className="text-sm">Analizando documento...</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📎</span>
                    <span className="text-sm font-medium">Subir cotización del proveedor</span>
                    <span className="text-xs">Haz clic para seleccionar el archivo</span>
                  </>
                )}
              </button>

              {/* Resultado de extracción */}
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
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <ExtraidoItem label="NIT" value={extraccion.proveedor_nit} />
                    <ExtraidoItem label="Valor unitario" value={extraccion.valor_unitario} money />
                    <ExtraidoItem label="Subtotal (antes IVA)" value={extraccion.valor_antes_iva} money />
                    <ExtraidoItem label="IVA" value={extraccion.valor_iva} money />
                    <ExtraidoItem label="Valor total" value={extraccion.valor_total} money />
                    <ExtraidoItem label="Forma de pago" value={extraccion.forma_pago} />
                    <ExtraidoItem label="Plazo de entrega" value={extraccion.plazo_entrega} />
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

            {/* Seleccionar proveedor del catálogo */}
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

            {/* Datos del proveedor */}
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
                <Field label="N° cotización del proveedor">
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

            {/* Valores */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Valores</h2>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Valor unitario *">
                  <input
                    name="valor_unitario"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor_unitario || ""}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label="Subtotal (antes de IVA)">
                  <input
                    name="valor_antes_iva"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor_antes_iva ?? ""}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="IVA">
                  <input
                    name="valor_iva"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor_iva ?? ""}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
                <Field label="Valor total *">
                  <input
                    name="valor_total"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor_total || ""}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                    required
                  />
                </Field>
              </div>

              <Field label="Fecha de vigencia de la cotización">
                <input
                  name="fecha_vigencia"
                  type="date"
                  value={form.fecha_vigencia ?? ""}
                  onChange={handleChange}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Condiciones */}
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

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Acciones */}
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
      ? `$${Number(value).toLocaleString("es-CO")}`
      : String(value)
    : "No encontrado"

  return (
    <div className={`flex gap-1 ${found ? "text-gray-700" : "text-gray-400"}`}>
      <span className="font-medium shrink-0">{label}:</span>
      <span className="truncate">{display}</span>
    </div>
  )
}

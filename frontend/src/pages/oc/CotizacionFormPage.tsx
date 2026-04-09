import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { useSolicitud, useCrearCotizacion, useProveedores } from "@/hooks/useOC"
import type { CotizacionCreatePayload } from "@/hooks/useOC"

const EMPTY_FORM: CotizacionCreatePayload = {
  proveedor_nombre: "",
  proveedor_email: "",
  numero_cotizacion_proveedor: "",
  valor_unitario: 0,
  valor_total: 0,
  fecha_vigencia: "",
  observaciones: "",
}

export function CotizacionFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: solicitud, isLoading: loadingSolicitud } = useSolicitud(id)
  const { data: proveedores = [] } = useProveedores()
  const crearCotizacion = useCrearCotizacion()

  const [form, setForm] = useState<CotizacionCreatePayload>(EMPTY_FORM)
  const [error, setError] = useState<string>()

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === "valor_unitario" || name === "valor_total" ? Number(value) : value,
    }))
  }

  function handleProveedorSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const proveedor = proveedores.find((p) => p.id === e.target.value)
    if (proveedor) {
      setForm((prev) => ({
        ...prev,
        proveedor_nombre: proveedor.nombre,
        proveedor_email: proveedor.email ?? "",
      }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!form.proveedor_nombre.trim()) {
      setError("El nombre del proveedor es requerido.")
      return
    }
    if (form.valor_total <= 0) {
      setError("El valor total debe ser mayor a 0.")
      return
    }

    const payload: CotizacionCreatePayload = {
      ...form,
      proveedor_email: form.proveedor_email || undefined,
      numero_cotizacion_proveedor: form.numero_cotizacion_proveedor || undefined,
      fecha_vigencia: form.fecha_vigencia || undefined,
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
                <Field label="Email del proveedor">
                  <input
                    name="proveedor_email"
                    type="email"
                    value={form.proveedor_email}
                    onChange={handleChange}
                    placeholder="ventas@proveedor.com"
                    className={inputCls}
                  />
                </Field>
                <Field label="N° cotización del proveedor">
                  <input
                    name="numero_cotizacion_proveedor"
                    value={form.numero_cotizacion_proveedor}
                    onChange={handleChange}
                    placeholder="COT-2026-001"
                    className={inputCls}
                  />
                </Field>
              </div>
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
                  value={form.fecha_vigencia}
                  onChange={handleChange}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Observaciones */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <Field label="Observaciones (condiciones de pago, tiempos de entrega, garantías)">
                <textarea
                  name="observaciones"
                  value={form.observaciones}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Incluir condiciones relevantes de la cotización..."
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

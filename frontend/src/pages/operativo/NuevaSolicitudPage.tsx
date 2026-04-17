import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { useAuthStore } from "@/store/authStore"
import { useListasFormulario, useCrearSolicitudInterna } from "@/hooks/useOC"
import type { SolicitudInternaCreate } from "@/hooks/useOC"

export function NuevaSolicitudPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: listas, isLoading: listasLoading, isError: listasError } = useListasFormulario()
  const crear = useCrearSolicitudInterna()

  const [form, setForm] = useState<SolicitudInternaCreate>({
    nivel_prioridad: "",
    categoria: "",
    grupo_articulos: "",
    descripcion: "",
    cantidad: 1,
    cliente: "",
    condicion: "",
    plataforma: "Logimat",
    placa_ficha: "",
    observaciones_solicitante: "",
  })
  const [error, setError] = useState<string | null>(null)

  function handleChange<K extends keyof SolicitudInternaCreate>(
    field: K,
    value: SolicitudInternaCreate[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (
      !form.nivel_prioridad ||
      !form.categoria ||
      !form.grupo_articulos ||
      !form.descripcion.trim() ||
      !form.plataforma ||
      form.cantidad < 1
    ) {
      setError("Por favor completa todos los campos obligatorios.")
      return
    }
    crear.mutate(
      {
        ...form,
        cliente: form.cliente || undefined,
        condicion: form.condicion || undefined,
        placa_ficha: form.placa_ficha || undefined,
        observaciones_solicitante: form.observaciones_solicitante || undefined,
      },
      {
        onSuccess: () => navigate("/operativo/mis-solicitudes"),
        onError: () => setError("Error al enviar la solicitud. Intenta de nuevo."),
      }
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Operativo" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Volver */}
          <button
            onClick={() => navigate("/operativo/mis-solicitudes")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Nueva Solicitud de Compra</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Los campos marcados con * son obligatorios
            </p>
          </div>

          {/* Skeleton mientras cargan las listas */}
          {listasLoading && (
            <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
              <svg
                className="animate-spin h-5 w-5 mr-2 text-brand-blue"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando formulario...
            </div>
          )}

          {/* Error al cargar listas del formulario */}
          {!listasLoading && listasError && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <p className="text-sm text-red-600 font-medium">
                No se pudieron cargar las opciones del formulario.
              </p>
              <p className="text-xs text-gray-400">
                Verifica tu conexión y recarga la página.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 text-sm bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 transition-colors"
              >
                Recargar
              </button>
            </div>
          )}

          {!listasLoading && !listasError && (
            <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
              {/* Sección Solicitante */}
              <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Solicitante
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">Nombre</p>
                    <p className="text-sm font-medium text-gray-700">{user?.full_name ?? "—"}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">Área</p>
                    <p className="text-sm font-medium text-gray-700">{user?.area ?? "—"}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">Fecha</p>
                    <p className="text-sm font-medium text-gray-700">
                      {new Date().toLocaleDateString("es-CO")}
                    </p>
                  </div>
                </div>
              </section>

              {/* Sección Detalle del pedido */}
              <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Detalle del pedido
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Prioridad */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prioridad *
                    </label>
                    <select
                      value={form.nivel_prioridad}
                      onChange={(e) => handleChange("nivel_prioridad", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Seleccionar —</option>
                      {listas?.prioridades.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Categoría */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría / Estatus *
                    </label>
                    <select
                      value={form.categoria}
                      onChange={(e) => handleChange("categoria", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Seleccionar —</option>
                      {listas?.categorias.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Grupo de artículos */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grupo de artículos *
                    </label>
                    <select
                      value={form.grupo_articulos}
                      onChange={(e) => handleChange("grupo_articulos", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Seleccionar —</option>
                      {listas?.grupos_articulos.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {/* Cliente */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cliente
                    </label>
                    <select
                      value={form.cliente}
                      onChange={(e) => handleChange("cliente", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Sin cliente —</option>
                      {listas?.clientes.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Condición */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Condición
                    </label>
                    <select
                      value={form.condicion}
                      onChange={(e) => handleChange("condicion", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Seleccionar —</option>
                      {listas?.condiciones.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Plataforma */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plataforma *
                    </label>
                    <select
                      value={form.plataforma}
                      onChange={(e) => handleChange("plataforma", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Logimat">Logimat</option>
                      <option value="IMC Cargo">IMC Cargo</option>
                      <option value="IMC Depósito">IMC Depósito</option>
                    </select>
                  </div>
                </div>

                {/* Descripción — full width */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detalle / descripción material *
                  </label>
                  <textarea
                    rows={4}
                    value={form.descripcion}
                    onChange={(e) => handleChange("descripcion", e.target.value)}
                    placeholder="Describe el material o servicio que necesitas..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Cantidad */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.cantidad}
                      onChange={(e) => handleChange("cantidad", parseInt(e.target.value, 10) || 1)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Placa / Ficha */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Placa / Ficha (referencia)
                    </label>
                    <input
                      type="text"
                      value={form.placa_ficha}
                      onChange={(e) => handleChange("placa_ficha", e.target.value)}
                      placeholder="Ej. VH-001"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Observaciones — full width */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observaciones del solicitante
                  </label>
                  <textarea
                    rows={3}
                    value={form.observaciones_solicitante}
                    onChange={(e) => handleChange("observaciones_solicitante", e.target.value)}
                    placeholder="Información adicional para el equipo de compras..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </section>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Botones */}
              <div className="flex items-center justify-end gap-3 pb-8">
                <button
                  type="button"
                  onClick={() => navigate("/operativo/mis-solicitudes")}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crear.isPending}
                  className="rounded-lg bg-brand-blue px-6 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60 transition-all"
                >
                  {crear.isPending ? "Enviando..." : "Enviar solicitud"}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}

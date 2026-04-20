import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import {
  usePaquetes,
  useCrearPaquete,
  useEliminarPaquete,
  useListasFormulario,
} from "@/hooks/useOC"
import type { PaqueteItem } from "@/hooks/useOC"

// ── Empty item template ───────────────────────────────────────────────────────

function emptyItem(): PaqueteItem {
  return {
    nivel_prioridad: "Media",
    categoria: "",
    grupo_articulos: "",
    descripcion: "",
    cantidad: 1,
    plataforma: "Logimat",
    cliente: "",
    condicion: "",
    placa_ficha: "",
    observaciones_solicitante: "",
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PaquetesPage() {
  const navigate = useNavigate()
  const { data: paquetes, isLoading } = usePaquetes()
  const { data: listas } = useListasFormulario()
  const crear = useCrearPaquete()
  const eliminar = useEliminarPaquete()

  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState("")
  const [descripcionUso, setDescripcionUso] = useState("")
  const [items, setItems] = useState<PaqueteItem[]>([emptyItem()])
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function resetForm() {
    setNombre("")
    setDescripcionUso("")
    setItems([emptyItem()])
    setFormError(null)
  }

  function handleOpenForm() {
    resetForm()
    setShowForm(true)
  }

  function handleCloseForm() {
    setShowForm(false)
    resetForm()
  }

  function updateItem(index: number, field: keyof PaqueteItem, value: string | number) {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) {
      setFormError("El nombre del paquete es obligatorio.")
      return
    }
    for (const item of items) {
      if (!item.descripcion.trim() || !item.plataforma) {
        setFormError("Cada item requiere descripción y plataforma.")
        return
      }
    }
    crear.mutate(
      {
        nombre: nombre.trim(),
        descripcion_uso: descripcionUso.trim() || undefined,
        items: items.map((it) => ({
          ...it,
          categoria: it.categoria || undefined,
          grupo_articulos: it.grupo_articulos || undefined,
          cliente: it.cliente || undefined,
          condicion: it.condicion || undefined,
          placa_ficha: it.placa_ficha || undefined,
          observaciones_solicitante: it.observaciones_solicitante || undefined,
        })),
      },
      {
        onSuccess: () => handleCloseForm(),
        onError: () => setFormError("Error al guardar el paquete. Intenta de nuevo."),
      }
    )
  }

  function handleDelete(id: string) {
    eliminar.mutate(id, {
      onSuccess: () => setConfirmDeleteId(null),
    })
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Operativo" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Back */}
          <button
            onClick={() => navigate("/operativo")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Paquetes de Solicitudes</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Templates reutilizables para crear solicitudes frecuentes en un clic.
              </p>
            </div>
            <button
              onClick={handleOpenForm}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105 transition-all"
            >
              + Nuevo paquete
            </button>
          </div>

          {/* Loading */}
          {isLoading && (
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
              Cargando paquetes...
            </div>
          )}

          {/* Empty state */}
          {!isLoading && (!paquetes || paquetes.length === 0) && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                <IconPaquete />
              </div>
              <p className="text-sm font-medium text-gray-600">No tienes paquetes guardados</p>
              <p className="text-xs text-gray-400">
                Crea un paquete para reutilizar solicitudes frecuentes con un solo clic.
              </p>
              <button
                onClick={handleOpenForm}
                className="mt-2 rounded-lg bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:brightness-105 transition-all"
              >
                Crear primer paquete
              </button>
            </div>
          )}

          {/* Cards grid */}
          {!isLoading && paquetes && paquetes.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paquetes.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/8 text-brand-blue">
                      <span className="w-4 h-4"><IconPaquete /></span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 whitespace-nowrap">
                      {p.items.length} {p.items.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{p.nombre}</p>
                    {p.descripcion_uso && (
                      <p className="mt-0.5 text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {p.descripcion_uso}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      Por {p.creado_por_nombre}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/operativo/nueva-solicitud?paquete=${p.id}`)}
                      className="flex-1 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-105 transition-all text-center"
                    >
                      Usar paquete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-red-300 hover:text-red-600 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Modal: Crear paquete ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-bold text-gray-900">Nuevo paquete de solicitudes</h2>
              <button
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del paquete *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Mantenimiento preventivo mensual"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Descripción de uso */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción de uso (opcional)
                </label>
                <textarea
                  rows={2}
                  value={descripcionUso}
                  onChange={(e) => setDescripcionUso(e.target.value)}
                  placeholder="¿Para qué se usa este paquete?"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Items del paquete *</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs text-brand-blue hover:underline font-medium"
                  >
                    + Agregar item
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Item {idx + 1}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Descripción */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Descripción *
                          </label>
                          <input
                            type="text"
                            value={item.descripcion}
                            onChange={(e) => updateItem(idx, "descripcion", e.target.value)}
                            placeholder="Describe el material o servicio"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Prioridad */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Prioridad
                          </label>
                          <select
                            value={item.nivel_prioridad}
                            onChange={(e) => updateItem(idx, "nivel_prioridad", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {(listas?.prioridades ?? ["Alta", "Media", "Baja"]).map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>

                        {/* Plataforma */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Plataforma *
                          </label>
                          <select
                            value={item.plataforma}
                            onChange={(e) => updateItem(idx, "plataforma", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Logimat">Logimat</option>
                            <option value="IMC Cargo">IMC Cargo</option>
                            <option value="IMC Depósito">IMC Depósito</option>
                          </select>
                        </div>

                        {/* Categoría */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Categoría
                          </label>
                          <select
                            value={item.categoria ?? ""}
                            onChange={(e) => updateItem(idx, "categoria", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— Seleccionar —</option>
                            {listas?.categorias.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        {/* Grupo artículos */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Grupo de artículos
                          </label>
                          <select
                            value={item.grupo_articulos ?? ""}
                            onChange={(e) => updateItem(idx, "grupo_articulos", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— Seleccionar —</option>
                            {listas?.grupos_articulos.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>

                        {/* Cantidad */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.cantidad}
                            onChange={(e) => updateItem(idx, "cantidad", parseInt(e.target.value, 10) || 1)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Cliente */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Cliente
                          </label>
                          <select
                            value={item.cliente ?? ""}
                            onChange={(e) => updateItem(idx, "cliente", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— Sin cliente —</option>
                            {listas?.clientes.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        {/* Placa/ficha */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Placa / Ficha
                          </label>
                          <input
                            type="text"
                            value={item.placa_ficha ?? ""}
                            onChange={(e) => updateItem(idx, "placa_ficha", e.target.value)}
                            placeholder="Ej. VH-001"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error */}
              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crear.isPending}
                  className="rounded-lg bg-brand-blue px-6 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60 transition-all"
                >
                  {crear.isPending ? "Guardando..." : "Guardar paquete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminación ─────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Eliminar paquete</h3>
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que deseas eliminar este paquete? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={eliminar.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {eliminar.isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Icon ──────────────────────────────────────────────────────────────────────

function IconPaquete() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z" />
      <path
        fillRule="evenodd"
        d="M2 7.5h16l-.811 7.71a2 2 0 0 1-1.99 1.79H4.802a2 2 0 0 1-1.99-1.79L2 7.5ZM7 11a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { useAuthStore } from "@/store/authStore"
import {
  usePaquetes,
  useCrearPaquete,
  useEliminarPaquete,
  useDespacharPaquete,
  useListasFormulario,
} from "@/hooks/useOC"
import type { PaqueteItem, Paquete, DespachoResult } from "@/hooks/useOC"
import { useSedesParaSolicitudesOc } from "@/hooks/useSedes"
import { defaultPlataformaDesdeSedes } from "@/lib/plataformaOc"

const PAQUETE_ITEM_TEMPLATE: Omit<PaqueteItem, "plataforma"> = {
  nivel_prioridad: "Media",
  categoria: "",
  grupo_articulos: "",
  descripcion: "",
  cantidad: 1,
  cliente: "",
  condicion: "",
  placa_ficha: "",
  observaciones_solicitante: "",
}

export function PaquetesPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: paquetes, isLoading } = usePaquetes()
  const { data: listas } = useListasFormulario()
  const { data: sedesOc = [] } = useSedesParaSolicitudesOc()
  const crear = useCrearPaquete()
  const eliminar = useEliminarPaquete()
  const despachar = useDespacharPaquete()

  const defaultPlataforma = useMemo(
    () => defaultPlataformaDesdeSedes(sedesOc, user?.sede),
    [sedesOc, user?.sede]
  )

  const makeItem = (): PaqueteItem => ({
    ...PAQUETE_ITEM_TEMPLATE,
    plataforma: defaultPlataforma,
  })

  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState("")
  const [descripcionUso, setDescripcionUso] = useState("")
  const [items, setItems] = useState<PaqueteItem[]>([
    { ...PAQUETE_ITEM_TEMPLATE, plataforma: "" },
  ])
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Despacho multi-ítem
  const [confirmDespacho, setConfirmDespacho] = useState<Paquete | null>(null)
  const [despachoResult, setDespachoResult] = useState<DespachoResult | null>(null)

  function handleUsarPaquete(p: Paquete) {
    if (p.items.length === 1) {
      // 1 ítem: ir al formulario pre-llenado
      navigate(`/operativo/nueva-solicitud?paquete=${p.id}`)
    } else {
      // Varios ítems: confirmar despacho múltiple
      setConfirmDespacho(p)
    }
  }

  function handleDespachar() {
    if (!confirmDespacho) return
    despachar.mutate(confirmDespacho.items, {
      onSuccess: (result) => {
        setConfirmDespacho(null)
        setDespachoResult(result)
      },
    })
  }

  function resetForm() {
    setNombre("")
    setDescripcionUso("")
    setItems([makeItem()])
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
    setItems((prev) => [...prev, makeItem()])
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
    if (sedesOc.length === 0) {
      setFormError("No hay sedes habilitadas para OC. Configura «OC compras» en Áreas y sedes.")
      return
    }
    for (const item of items) {
      if (!item.descripcion.trim() || !(item.plataforma || defaultPlataforma)) {
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
          plataforma: it.plataforma || defaultPlataforma,
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
    <>
    <PageLayout title="Operativo">
          {/* Back */}
          <button
            onClick={() => navigate("/operativo")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">Paquetes de Solicitudes</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
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
            <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
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
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <IconPaquete />
              </div>
              <p className="text-sm font-medium text-foreground">No tienes paquetes guardados</p>
              <p className="text-xs text-muted-foreground">
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
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/8 text-brand-blue">
                      <span className="w-4 h-4"><IconPaquete /></span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {p.items.length} {p.items.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground leading-snug">{p.nombre}</p>
                    {p.descripcion_uso && (
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {p.descripcion_uso}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Por {p.creado_por_nombre}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-border">
                    <button
                      onClick={() => handleUsarPaquete(p)}
                      className="flex-1 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-105 transition-all text-center"
                    >
                      {p.items.length === 1 ? "Crear solicitud" : `Despachar ${p.items.length} solicitudes`}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-red-300 hover:text-red-600 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
    </PageLayout>

      {/* ── Modal: Crear paquete ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
          <div className="w-full max-w-2xl rounded-2xl bg-card shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-bold text-foreground">Nuevo paquete de solicitudes</h2>
              <button
                onClick={handleCloseForm}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nombre del paquete *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Mantenimiento preventivo mensual"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Descripción de uso */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Descripción de uso (opcional)
                </label>
                <textarea
                  rows={2}
                  value={descripcionUso}
                  onChange={(e) => setDescripcionUso(e.target.value)}
                  placeholder="¿Para qué se usa este paquete?"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">Items del paquete *</label>
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
                      className="rounded-xl border border-border p-4 space-y-3 bg-muted"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                          <label className="block text-xs font-medium text-foreground mb-1">
                            Descripción *
                          </label>
                          <input
                            type="text"
                            value={item.descripcion}
                            onChange={(e) => updateItem(idx, "descripcion", e.target.value)}
                            placeholder="Describe el material o servicio"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>

                        {/* Prioridad */}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">
                            Prioridad
                          </label>
                          <select
                            value={item.nivel_prioridad}
                            onChange={(e) => updateItem(idx, "nivel_prioridad", e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {(listas?.prioridades ?? ["Alta", "Media", "Baja"]).map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>

                        {/* Plataforma */}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">
                            Plataforma *
                          </label>
                          <select
                            value={item.plataforma || defaultPlataforma}
                            onChange={(e) => updateItem(idx, "plataforma", e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {sedesOc.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Categoría */}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">
                            Categoría
                          </label>
                          <select
                            value={item.categoria ?? ""}
                            onChange={(e) => updateItem(idx, "categoria", e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">— Seleccionar —</option>
                            {listas?.categorias.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        {/* Grupo artículos */}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">
                            Grupo de artículos
                          </label>
                          <select
                            value={item.grupo_articulos ?? ""}
                            onChange={(e) => updateItem(idx, "grupo_articulos", e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">— Seleccionar —</option>
                            {listas?.grupos_articulos.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>

                        {/* Cantidad */}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.cantidad}
                            onChange={(e) => updateItem(idx, "cantidad", parseInt(e.target.value, 10) || 1)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>

                        {/* Cliente */}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">
                            Cliente
                          </label>
                          <select
                            value={item.cliente ?? ""}
                            onChange={(e) => updateItem(idx, "cliente", e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">— Sin cliente —</option>
                            {listas?.clientes.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        {/* Placa/ficha */}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">
                            Placa / Ficha
                          </label>
                          <input
                            type="text"
                            value={item.placa_ficha ?? ""}
                            onChange={(e) => updateItem(idx, "placa_ficha", e.target.value)}
                            placeholder="Ej. VH-001"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                  className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
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

      {/* ── Modal: Confirmar despacho múltiple ───────────────────────────────── */}
      {confirmDespacho && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <div>
                <h3 className="text-base font-bold text-foreground">Despachar paquete</h3>
                <p className="text-sm text-muted-foreground">{confirmDespacho.nombre}</p>
              </div>
            </div>
            <p className="text-sm text-foreground">
              Se crearán <span className="font-semibold text-brand-blue">{confirmDespacho.items.length} solicitudes</span> de compra independientes:
            </p>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {confirmDespacho.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground bg-muted rounded-lg px-3 py-2">
                  <span className="font-mono text-muted-foreground shrink-0">{i + 1}.</span>
                  <span className="flex-1">{item.descripcion}</span>
                  <span className="text-muted-foreground shrink-0">{item.plataforma}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDespacho(null)}
                disabled={despachar.isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDespachar}
                disabled={despachar.isPending}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60 transition-all"
              >
                {despachar.isPending
                  ? `Creando solicitudes...`
                  : `Crear ${confirmDespacho.items.length} solicitudes`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Resultado del despacho ─────────────────────────────────────── */}
      {despachoResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl space-y-4 text-center">
            <span className="text-4xl">{despachoResult.errores === 0 ? "✅" : "⚠️"}</span>
            <h3 className="text-base font-bold text-foreground">
              {despachoResult.errores === 0
                ? "¡Solicitudes creadas!"
                : `${despachoResult.creadas} creadas, ${despachoResult.errores} fallaron`}
            </h3>
            {despachoResult.consecutivos.length > 0 && (
              <div className="text-left space-y-1">
                {despachoResult.consecutivos.map((c) => (
                  <p key={c} className="text-xs font-mono bg-green-50 text-green-700 rounded px-2 py-1">{c}</p>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setDespachoResult(null)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => { setDespachoResult(null); navigate("/operativo/mis-solicitudes") }}
                className="flex-1 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105 transition-all"
              >
                Ver solicitudes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminación ─────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Eliminar paquete</h3>
            <p className="text-sm text-muted-foreground">
              ¿Estás seguro de que deseas eliminar este paquete? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
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
    </>
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

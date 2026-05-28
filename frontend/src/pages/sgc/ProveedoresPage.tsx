import { useRef, useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  useProveedoresSGC,
  useCrearProveedorSGC,
  useActualizarProveedorSGC,
  useToggleActivoSGC,
  useExtraerDocumentoSGC,
} from "@/hooks/useSGC"
import type { ProveedorSGC, ProveedorSGCCreate, ExtraccionRUTResult } from "@/hooks/useSGC"

// ── Formulario vacío ──────────────────────────────────────────────────────────

const EMPTY_FORM: ProveedorSGCCreate = {
  nombre: "",
  nit: "",
  representante_legal: "",
  email: "",
  telefono: "",
  direccion: "",
  ciudad: "",
  categoria: "",
  observaciones: "",
}

// Categorías disponibles — ajustar cuando llegue el formato oficial
const CATEGORIAS = [
  "Insumos",
  "Servicios",
  "Logística",
  "Tecnología",
  "Mantenimiento",
  "Otro",
]

type ExtraccionStatus = "idle" | "loading" | "ok" | "warn" | "error"

// ── Página principal ──────────────────────────────────────────────────────────

export function ProveedoresPage() {
  const [soloActivos, setSoloActivos] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ProveedorSGC | null>(null)

  const { data: proveedores = [], isLoading } = useProveedoresSGC(soloActivos)
  const toggleActivo = useToggleActivoSGC()

  function abrirCrear() {
    setEditando(null)
    setModalOpen(true)
  }

  function abrirEditar(p: ProveedorSGC) {
    setEditando(p)
    setModalOpen(true)
  }

  function handleToggle(p: ProveedorSGC) {
    toggleActivo.mutate(p.id)
  }

  return (
    <>
      <PageLayout title="SGC — Proveedores" mainClassName="flex-1 overflow-y-auto px-6 py-6">
          {/* Cabecera */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={soloActivos}
                  onChange={(e) => setSoloActivos(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Solo activos
              </label>
              <span className="text-sm text-muted-foreground">
                {proveedores.length} proveedor{proveedores.length !== 1 ? "es" : ""}
              </span>
            </div>
            <button
              onClick={abrirCrear}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              + Nuevo proveedor
            </button>
          </div>

          {/* Tabla */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : proveedores.length === 0 ? (
            <EmptyState onCrear={abrirCrear} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    {["Nombre / Razón social", "NIT", "Email", "Teléfono", "Ciudad", "Categoría", "Estado", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {proveedores.map((p) => (
                    <tr key={p.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{p.nombre}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.nit ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.telefono ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ciudad ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.categoria ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            p.activo
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {p.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => abrirEditar(p)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggle(p)}
                            disabled={toggleActivo.isPending}
                            className={`text-xs hover:underline ${
                              p.activo ? "text-red-500" : "text-green-600"
                            }`}
                          >
                            {p.activo ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </PageLayout>

      {modalOpen && (
        <ProveedorModal
          proveedor={editando}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

// ── Modal crear / editar ──────────────────────────────────────────────────────

function ProveedorModal({
  proveedor,
  onClose,
}: {
  proveedor: ProveedorSGC | null
  onClose: () => void
}) {
  const esEdicion = proveedor !== null

  const [form, setForm] = useState<ProveedorSGCCreate>(
    proveedor
      ? {
          nombre: proveedor.nombre,
          nit: proveedor.nit ?? "",
          representante_legal: proveedor.representante_legal ?? "",
          email: proveedor.email ?? "",
          telefono: proveedor.telefono ?? "",
          direccion: proveedor.direccion ?? "",
          ciudad: proveedor.ciudad ?? "",
          categoria: proveedor.categoria ?? "",
          observaciones: proveedor.observaciones ?? "",
        }
      : EMPTY_FORM
  )
  const [error, setError] = useState<string>()
  const [extStatus, setExtStatus] = useState<ExtraccionStatus>("idle")
  const [extraccion, setExtraccion] = useState<ExtraccionRUTResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const crear = useCrearProveedorSGC()
  const actualizar = useActualizarProveedorSGC()
  const extraer = useExtraerDocumentoSGC()

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtStatus("loading")
    setExtraccion(null)

    extraer.mutate(file, {
      onSuccess: (data) => {
        setExtraccion(data)
        setExtStatus(data.campos_encontrados >= 3 ? "ok" : "warn")
        // Pre-llenar solo campos vacíos para no pisar lo que el usuario ya escribió
        setForm((prev) => ({
          ...prev,
          nombre: prev.nombre || data.nombre || "",
          nit: prev.nit || data.nit || "",
          representante_legal: prev.representante_legal || data.representante_legal || "",
          email: prev.email || data.email || "",
          telefono: prev.telefono || data.telefono || "",
          direccion: prev.direccion || data.direccion || "",
          ciudad: prev.ciudad || data.ciudad || "",
        }))
      },
      onError: () => setExtStatus("error"),
    })
    e.target.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    const payload = {
      ...form,
      // Enviar null en vez de "" para campos opcionales
      nit: form.nit || undefined,
      representante_legal: form.representante_legal || undefined,
      email: form.email || undefined,
      telefono: form.telefono || undefined,
      direccion: form.direccion || undefined,
      ciudad: form.ciudad || undefined,
      categoria: form.categoria || undefined,
      observaciones: form.observaciones || undefined,
    }

    if (esEdicion) {
      actualizar.mutate(
        { id: proveedor.id, payload },
        { onSuccess: onClose, onError: (err: unknown) => setError(getMsg(err)) }
      )
    } else {
      crear.mutate(payload, {
        onSuccess: onClose,
        onError: (err: unknown) => setError(getMsg(err)),
      })
    }
  }

  const isPending = crear.isPending || actualizar.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-card shadow-xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {esEdicion ? "Editar proveedor" : "Nuevo proveedor"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Zona de extracción automática */}
          <div className="rounded-lg border border-dashed border-border bg-muted p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Extracción automática (opcional)
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Sube el RUT u otro documento del proveedor (PDF, Excel, Word) para
              pre-llenar los campos automáticamente. Podrás corregir lo que sea necesario.
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={extStatus === "loading"}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {extStatus === "loading" ? "Extrayendo..." : "Subir documento"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.docx"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Badge resultado extracción */}
            {extStatus !== "idle" && extStatus !== "loading" && extraccion && (
              <div
                className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                  extStatus === "ok"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : extStatus === "warn"
                    ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {extStatus === "ok" && `✓ ${extraccion.campos_encontrados} campos extraídos de "${extraccion.nombre_archivo}"`}
                {extStatus === "warn" && `⚠ Solo ${extraccion.campos_encontrados} campos encontrados en "${extraccion.nombre_archivo}". Completa los campos manualmente.`}
                {extStatus === "error" && "No se pudo leer el documento. Completa los campos manualmente."}
              </div>
            )}
          </div>

          {/* Campos del formulario */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label="Razón social *"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                required
                placeholder="Nombre de la empresa"
              />
            </div>
            <FormField
              label="NIT"
              name="nit"
              value={form.nit ?? ""}
              onChange={handleChange}
              placeholder="000.000.000-0"
            />
            <FormField
              label="Representante legal"
              name="representante_legal"
              value={form.representante_legal ?? ""}
              onChange={handleChange}
              placeholder="Nombre completo"
            />
            <FormField
              label="Email"
              name="email"
              value={form.email ?? ""}
              onChange={handleChange}
              type="email"
              placeholder="contacto@empresa.com"
            />
            <FormField
              label="Teléfono"
              name="telefono"
              value={form.telefono ?? ""}
              onChange={handleChange}
              placeholder="601 000 0000"
            />
            <FormField
              label="Dirección"
              name="direccion"
              value={form.direccion ?? ""}
              onChange={handleChange}
              placeholder="Calle 00 # 00-00"
            />
            <FormField
              label="Ciudad"
              name="ciudad"
              value={form.ciudad ?? ""}
              onChange={handleChange}
              placeholder="Bogotá"
            />
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Categoría
              </label>
              <select
                name="categoria"
                value={form.categoria ?? ""}
                onChange={handleChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Sin categoría</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Observaciones
            </label>
            <textarea
              name="observaciones"
              value={form.observaciones ?? ""}
              onChange={handleChange}
              rows={3}
              placeholder="Notas internas sobre este proveedor..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !form.nombre}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear proveedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Componentes menores ───────────────────────────────────────────────────────

function FormField({
  label,
  name,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

function EmptyState({ onCrear }: { onCrear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl mb-4">🏭</p>
      <h3 className="text-base font-semibold text-foreground mb-1">Sin proveedores registrados</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Agrega el primer proveedor para que esté disponible en OC Automatizaciones.
      </p>
      <button
        onClick={onCrear}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        + Crear primer proveedor
      </button>
    </div>
  )
}

function getMsg(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response?: { data?: { detail?: string } } }).response
    return r?.data?.detail ?? "Error al guardar el proveedor."
  }
  return "Error al guardar el proveedor."
}

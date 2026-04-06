import { useState } from "react"
import type { UserListItem } from "@/types/auth"
import { ROLE_LABELS } from "@/lib/roles"
import type { CreateUserPayload, UpdateUserPayload } from "@/hooks/useUsers"

const SEDES = ["IMCCARGO", "LOGIMAT", "IMC Depósito"]
const AREAS = ["Comercial", "Operaciones", "RRHH", "IT", "Gerencia", "Administración"]

interface Props {
  user?: UserListItem
  onSubmit: (data: CreateUserPayload | UpdateUserPayload) => void
  onClose: () => void
  isLoading: boolean
  error?: string
}

export function UserFormModal({ user, onSubmit, onClose, isLoading, error }: Props) {
  const isEdit = !!user
  const [form, setForm] = useState({
    email: user?.email ?? "",
    password: "",
    full_name: user?.full_name ?? "",
    role: user?.role ?? "empleado",
    sede: user?.sede ?? "",
    area: user?.area ?? "",
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit) {
      onSubmit({
        full_name: form.full_name || undefined,
        role: form.role || undefined,
        sede: form.sede || undefined,
        area: form.area || undefined,
      } satisfies UpdateUserPayload)
    } else {
      onSubmit({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
        sede: form.sede || undefined,
        area: form.area || undefined,
      } satisfies CreateUserPayload)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base">
            {isEdit ? "Editar usuario" : "Nuevo usuario"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {!isEdit && (
            <Field label="Correo electrónico">
              <input
                type="email"
                required
                autoComplete="off"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputCls}
              />
            </Field>
          )}

          <Field label="Nombre completo">
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              className={inputCls}
            />
          </Field>

          {!isEdit && (
            <Field label="Contraseña">
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={inputCls}
                placeholder="Mínimo 8 caracteres"
              />
            </Field>
          )}

          <Field label="Rol">
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className={inputCls}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sede">
              <select
                value={form.sede}
                onChange={(e) => set("sede", e.target.value)}
                className={inputCls}
              >
                <option value="">Sin sede</option>
                {SEDES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Área">
              <select
                value={form.area}
                onChange={(e) => set("area", e.target.value)}
                className={inputCls}
              >
                <option value="">Sin área</option>
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {isLoading
                ? "Guardando..."
                : isEdit
                  ? "Guardar cambios"
                  : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue transition-colors"

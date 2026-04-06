import { useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { ALL_APPS } from "@/lib/roles"
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  getApiError,
  type RoleItem,
  type CreateRolePayload,
  type UpdateRolePayload,
} from "@/hooks/useRoles"

export function RolesPage() {
  const { data: roles = [], isLoading } = useRoles()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()

  const [modal, setModal] = useState<"create" | "edit" | null>(null)
  const [selected, setSelected] = useState<RoleItem | null>(null)
  const [mutationError, setMutationError] = useState<string>()
  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null)
  const [permTarget, setPermTarget] = useState<RoleItem | null>(null)

  function openCreate() {
    setSelected(null)
    setMutationError(undefined)
    setModal("create")
  }

  function openEdit(role: RoleItem) {
    setSelected(role)
    setMutationError(undefined)
    setModal("edit")
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setMutationError(undefined)
  }

  async function handleSubmit(data: CreateRolePayload | UpdateRolePayload) {
    setMutationError(undefined)
    try {
      if (modal === "create") {
        await createRole.mutateAsync(data as CreateRolePayload)
      } else if (modal === "edit" && selected) {
        await updateRole.mutateAsync({ id: selected.id, ...(data as UpdateRolePayload) })
      }
      closeModal()
    } catch (err) {
      setMutationError(getApiError(err))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteRole.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteTarget(null)
      setMutationError(getApiError(err))
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Roles" />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Gestión de Roles</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Define los roles disponibles y sus descripciones.
              </p>
            </div>
            <button
              onClick={openCreate}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors"
            >
              + Nuevo rol
            </button>
          </div>

          {mutationError && !modal && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {mutationError}
            </p>
          )}

          {isLoading ? (
            <p className="text-sm text-gray-500">Cargando roles...</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Etiqueta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Permisos
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {role.name}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {role.label}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {role.description ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {role.name === "admin" ? (
                          <span className="text-xs text-gray-400 italic">Todo</span>
                        ) : (role.app_permissions ?? []).length === 0 ? (
                          <span className="text-xs text-gray-300">Ninguno</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(role.app_permissions ?? []).map((p) => (
                              <span key={p} className="inline-block rounded bg-brand-blue/10 px-1.5 py-0.5 text-xs font-medium text-brand-blue">
                                {ALL_APPS.find((a) => a.id === p)?.name ?? p}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {role.name !== "admin" && (
                            <button
                              onClick={() => setPermTarget(role)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              Permisos
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(role)}
                            className="rounded px-2.5 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 transition-colors"
                          >
                            Editar
                          </button>
                          {role.name !== "admin" && (
                            <button
                              onClick={() => setDeleteTarget(role)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {roles.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                        No hay roles registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <RoleFormModal
          role={modal === "edit" ? selected ?? undefined : undefined}
          onSubmit={handleSubmit}
          onClose={closeModal}
          isLoading={createRole.isPending || updateRole.isPending}
          error={mutationError}
        />
      )}

      {/* Confirm eliminar */}
      {deleteTarget && (
        <ConfirmDeleteModal
          role={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteRole.isPending}
        />
      )}

      {/* Permisos por rol */}
      {permTarget && (
        <PermissionsModal
          role={permTarget}
          onClose={() => setPermTarget(null)}
          onSave={async (permissions) => {
            try {
              await updateRole.mutateAsync({ id: permTarget.id, app_permissions: permissions })
              setPermTarget(null)
            } catch (err) {
              setMutationError(getApiError(err))
              setPermTarget(null)
            }
          }}
          isLoading={updateRole.isPending}
        />
      )}
    </div>
  )
}

// ── RoleFormModal ─────────────────────────────────────────────────────────────

interface RoleFormModalProps {
  role?: RoleItem
  onSubmit: (data: CreateRolePayload | UpdateRolePayload) => void
  onClose: () => void
  isLoading: boolean
  error?: string
}

function RoleFormModal({ role, onSubmit, onClose, isLoading, error }: RoleFormModalProps) {
  const isEdit = !!role
  const [name, setName] = useState(role?.name ?? "")
  const [label, setLabel] = useState(role?.label ?? "")
  const [description, setDescription] = useState(role?.description ?? "")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit) {
      onSubmit({ label, description: description || undefined })
    } else {
      onSubmit({ name, label, description: description || undefined })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base">
            {isEdit ? "Editar rol" : "Nuevo rol"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nombre interno <span className="text-gray-400">(sin espacios)</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                className={inputCls}
                placeholder="Ej. talento_cultura"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={inputCls}
              placeholder="Ej. Talento y Cultura"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Descripción <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
              placeholder="Breve descripción del rol"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear rol"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ConfirmDeleteModal ────────────────────────────────────────────────────────

function ConfirmDeleteModal({
  role,
  onConfirm,
  onCancel,
  isLoading,
}: {
  role: RoleItem
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="font-semibold text-gray-900 text-base mb-2">¿Eliminar rol?</h2>
        <p className="text-sm text-gray-500 mb-6">
          Se eliminará el rol <span className="font-medium text-gray-900">{role.label}</span>.
          Esta acción no puede deshacerse.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PermissionsModal ──────────────────────────────────────────────────────────

function PermissionsModal({
  role,
  onClose,
  onSave,
  isLoading,
}: {
  role: RoleItem
  onClose: () => void
  onSave: (permissions: string[]) => void
  isLoading: boolean
}) {
  const [selected, setSelected] = useState<string[]>(role.app_permissions ?? [])

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base">
            Permisos — {role.label}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ✕
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {ALL_APPS.map((app) => (
            <label key={app.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(app.id)}
                onChange={() => toggle(app.id)}
                className="h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-gray-900">{app.icon} {app.name}</span>
                <span className="block text-xs text-gray-400">{app.description}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onSave(selected)}
            className="flex-1 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue transition-colors"

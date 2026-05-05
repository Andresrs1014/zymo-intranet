import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { INTERNAL_MODULES, EXTERNAL_APPS, type AppDefinition } from "@/lib/roles"
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

// ── Página principal ──────────────────────────────────────────────────────────

export function RolesPage() {
  const { data: roles = [], isLoading } = useRoles()
  const createRole   = useCreateRole()
  const updateRole   = useUpdateRole()
  const deleteRole   = useDeleteRole()

  const [modal, setModal]               = useState<"create" | "edit" | null>(null)
  const [selected, setSelected]         = useState<RoleItem | null>(null)
  const [mutationError, setMutationError] = useState<string>()
  const [deleteInfo, setDeleteInfo] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null)

  function openCreate() {
    setSelected(null)
    setMutationError(undefined)
    setDeleteInfo(null)
    setModal("create")
  }

  function openEdit(role: RoleItem) {
    setSelected(role)
    setMutationError(undefined)
    setDeleteInfo(null)
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
    setDeleteInfo(null)
    try {
      const result = await deleteRole.mutateAsync(deleteTarget.id)
      setDeleteInfo(
        `Rol eliminado. ${result.reassigned_users} usuario(s) quedaron con rol «empleado». Asígnales un rol en Gestión de usuarios.`,
      )
      setDeleteTarget(null)
    } catch (err) {
      setDeleteTarget(null)
      setMutationError(getApiError(err))
    }
  }

  return (
    <>
      <PageLayout title="Roles" mainClassName="flex-1 overflow-auto p-6">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Gestión de Roles</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Define los roles y configura qué módulos y aplicaciones puede ver cada uno.
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
          {deleteInfo && (
            <p className="mb-4 text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              {deleteInfo}
            </p>
          )}

          {isLoading ? (
            <p className="text-sm text-gray-500">Cargando roles...</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">
                      Etiqueta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Accesos configurados
                    </th>
                    <th className="px-4 py-3 w-24" />
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
                        <PermissionBadges role={role} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
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
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                        No hay roles registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
      </PageLayout>

      {modal && (
        <RoleFormModal
          role={modal === "edit" ? selected ?? undefined : undefined}
          onSubmit={handleSubmit}
          onClose={closeModal}
          isLoading={createRole.isPending || updateRole.isPending}
          error={mutationError}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          role={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteRole.isPending}
        />
      )}
    </>
  )
}

// ── Badges de permisos en la tabla ────────────────────────────────────────────

function PermissionBadges({ role }: { role: RoleItem }) {
  if (role.name === "admin") {
    return <span className="text-xs text-gray-400 italic">Acceso total</span>
  }

  const perms = role.app_permissions ?? []
  if (perms.length === 0) {
    return <span className="text-xs text-gray-300">Sin accesos adicionales</span>
  }

  const allDefs: AppDefinition[] = [...INTERNAL_MODULES, ...EXTERNAL_APPS]

  return (
    <div className="flex flex-wrap gap-1">
      {perms.map((id) => {
        const def = allDefs.find((a) => a.id === id)
        const isModule = def?.category === "modulo"
        return (
          <span
            key={id}
            className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
              isModule
                ? "bg-indigo-50 text-indigo-700"
                : "bg-brand-blue/10 text-brand-blue"
            }`}
          >
            {def?.icon} {def?.name ?? id}
          </span>
        )
      })}
    </div>
  )
}

// ── Estilos compartidos ──────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue transition-colors"

// ── Modal crear / editar rol ──────────────────────────────────────────────────

interface RoleFormModalProps {
  role?: RoleItem
  onSubmit: (data: CreateRolePayload | UpdateRolePayload) => void
  onClose: () => void
  isLoading: boolean
  error?: string
}

function RoleFormModal({ role, onSubmit, onClose, isLoading, error }: RoleFormModalProps) {
  const isEdit = !!role

  const [name, setName]               = useState(role?.name ?? "")
  const [label, setLabel]             = useState(role?.label ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [permissions, setPermissions] = useState<string[]>(role?.app_permissions ?? [])

  function toggle(id: string) {
    setPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { label, description: description || undefined, app_permissions: permissions }
    onSubmit(isEdit ? payload : { name, ...payload })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base">
            {isEdit ? "Editar rol" : "Nuevo rol"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Nombre interno — solo en creación */}
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

            {/* ── Permisos: Módulos internos ── */}
            <PermissionGroup
              title="Módulos de la intranet"
              subtitle="Qué secciones puede ver este rol en el menú lateral"
              items={INTERNAL_MODULES}
              selected={permissions}
              onToggle={toggle}
              badgeColor="bg-indigo-50 text-indigo-700"
            />

            {/* ── Permisos: Apps externas ── */}
            <PermissionGroup
              title="Aplicaciones externas"
              subtitle="Links que aparecen en el Dashboard del usuario"
              items={EXTERNAL_APPS}
              selected={permissions}
              onToggle={toggle}
              badgeColor="bg-brand-blue/10 text-brand-blue"
            />

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
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
            >
              {isLoading
                ? "Guardando..."
                : isEdit
                  ? "Guardar cambios"
                  : "Crear rol"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Grupo de checkboxes reutilizable ──────────────────────────────────────────

interface PermissionGroupProps {
  title: string
  subtitle: string
  items: AppDefinition[]
  selected: string[]
  onToggle: (id: string) => void
  badgeColor: string
}

function PermissionGroup({ title, subtitle, items, selected, onToggle, badgeColor }: PermissionGroupProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-0.5">{title}</p>
      <p className="text-xs text-gray-400 mb-2">{subtitle}</p>
      <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
            />
            <span className="flex-1">
              <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium mb-0.5 ${badgeColor}`}>
                {item.icon} {item.name}
              </span>
              <span className="block text-xs text-gray-400">{item.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Modal confirmar eliminación ───────────────────────────────────────────────

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
          Se eliminará el rol <span className="font-medium text-gray-900">{role.label}</span>. Los usuarios que lo
          tengan asignado pasarán automáticamente al rol <span className="font-medium text-gray-900">empleado</span> y
          podrás asignarles otro rol después en Usuarios.
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

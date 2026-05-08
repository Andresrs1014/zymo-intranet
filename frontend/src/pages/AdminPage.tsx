import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { formatFechaRelativa } from "@/lib/dates"
import { UserFormModal } from "@/components/admin/UserFormModal"
import { getRoleLabel } from "@/lib/roles"
import {
  useUsers,
  useArchivedUsers,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useReactivateUser,
  useDeleteUser,
  getApiError,
  type CreateUserPayload,
  type UpdateUserPayload,
} from "@/hooks/useUsers"
import { useUserTools, useAssignUserTool, useRevokeUserTool } from "@/hooks/useWorkTasks"
import type { UserListItem } from "@/types/auth"

type Tab = "activos" | "archivados"

const TOOLS = [
  { key: "tool_task_submit_dev", label: "Gestión de Tareas — Colaborador", desc: "Puede registrar sus propias tareas" },
  { key: "tool_task_manage_dev", label: "Gestión de Tareas — Directiva", desc: "Ve el dashboard completo del equipo" },
]

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("activos")
  const [modal, setModal] = useState<"create" | "edit" | null>(null)
  const [selected, setSelected] = useState<UserListItem | null>(null)
  const [mutationError, setMutationError] = useState<string>()
  const [toolsUser, setToolsUser] = useState<UserListItem | null>(null)

  const { data: activeUsers = [], isLoading: loadingActive } = useUsers()
  const {
    data: archivedUsers = [],
    isLoading: loadingArchived,
    refetch: fetchArchived,
  } = useArchivedUsers()

  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deactivateUser = useDeactivateUser()
  const reactivateUser = useReactivateUser()
  const deleteUser = useDeleteUser()

  function openCreate() {
    setSelected(null)
    setMutationError(undefined)
    setModal("create")
  }

  function openEdit(user: UserListItem) {
    setSelected(user)
    setMutationError(undefined)
    setModal("edit")
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setMutationError(undefined)
  }

  function handleTabChange(next: Tab) {
    setTab(next)
    if (next === "archivados") fetchArchived()
  }

  function handleSubmit(payload: CreateUserPayload | UpdateUserPayload) {
    setMutationError(undefined)
    if (modal === "create") {
      createUser.mutate(payload as CreateUserPayload, {
        onSuccess: closeModal,
        onError: (err) => setMutationError(getApiError(err)),
      })
    } else if (modal === "edit" && selected) {
      updateUser.mutate(
        { id: selected.id, ...(payload as UpdateUserPayload) },
        {
          onSuccess: closeModal,
          onError: (err) => setMutationError(getApiError(err)),
        },
      )
    }
  }

  function handleDeactivate(user: UserListItem) {
    if (!confirm(`¿Desactivar a ${user.full_name ?? user.email}?`)) return
    deactivateUser.mutate(user.id)
  }

  function handleReactivate(user: UserListItem) {
    reactivateUser.mutate(user.id)
  }

  function handleDelete(user: UserListItem) {
    if (!confirm(`¿Eliminar permanentemente a ${user.full_name ?? user.email}? Esta acción no se puede deshacer.`)) return
    deleteUser.mutate(user.id)
  }

  const isModalLoading = createUser.isPending || updateUser.isPending
  const users = tab === "activos" ? activeUsers : archivedUsers
  const isLoading = tab === "activos" ? loadingActive : loadingArchived

  return (
    <>
      <PageLayout title="Gestión de Usuarios">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Administra el acceso al portal
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-blue/90"
            >
              <span className="text-base leading-none">+</span>
              Nuevo usuario
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            {(["activos", "archivados"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                Cargando...
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-gray-400 text-sm">
                  {tab === "activos"
                    ? "No hay usuarios activos."
                    : "No hay usuarios archivados."}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500">Usuario</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Rol</th>
                    <th className="px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                      Sede / Área
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                      Último acceso
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      tab={tab}
                      onEdit={openEdit}
                      onDeactivate={handleDeactivate}
                      onReactivate={handleReactivate}
                      onDelete={handleDelete}
                      onManageTools={setToolsUser}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
      </PageLayout>

      {modal && (
        <UserFormModal
          user={modal === "edit" ? (selected ?? undefined) : undefined}
          onSubmit={handleSubmit}
          onClose={closeModal}
          isLoading={isModalLoading}
          error={mutationError}
        />
      )}

      {toolsUser && (
        <UserToolsModal user={toolsUser} onClose={() => setToolsUser(null)} />
      )}
    </>
  )
}

interface RowProps {
  user: UserListItem
  tab: Tab
  onEdit: (u: UserListItem) => void
  onDeactivate: (u: UserListItem) => void
  onReactivate: (u: UserListItem) => void
  onDelete: (u: UserListItem) => void
  onManageTools: (u: UserListItem) => void
}

function UserRow({ user, tab, onEdit, onDeactivate, onReactivate, onDelete, onManageTools }: RowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue font-semibold text-xs">
            {(user.full_name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {user.full_name ?? "—"}
            </p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
        {user.sede ?? "—"}
        {user.area ? <span className="text-gray-300"> · </span> : null}
        {user.area}
      </td>
      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
        {user.last_login_at ? formatDate(user.last_login_at) : "Nunca"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {tab === "activos" ? (
            <>
              <button
                onClick={() => onManageTools(user)}
                className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Herramientas
              </button>
              <button
                onClick={() => onEdit(user)}
                className="rounded px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => onDeactivate(user)}
                className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Desactivar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onReactivate(user)}
                className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 transition-colors"
              >
                Reactivar
              </button>
              <button
                onClick={() => onDelete(user)}
                className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-brand-blue/10 text-brand-blue",
    directivo: "bg-purple-100 text-purple-700",
    talento_cultura: "bg-pink-100 text-pink-700",
    comercial: "bg-brand-yellow/20 text-yellow-700",
    operativo: "bg-gray-100 text-gray-600",
    empleado: "bg-gray-100 text-gray-600",
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[role] ?? "bg-gray-100 text-gray-600"}`}
    >
      {getRoleLabel(role)}
    </span>
  )
}

function formatDate(iso: string): string {
  return formatFechaRelativa(iso)
}

function UserToolsModal({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const { data: activeTools = [], isLoading } = useUserTools(user.id)
  const assign = useAssignUserTool()
  const revoke = useRevokeUserTool()

  function toggle(tool_key: string, currentlyActive: boolean) {
    if (currentlyActive) {
      revoke.mutate({ user_id: user.id, tool_key })
    } else {
      assign.mutate({ user_id: user.id, tool_key })
    }
  }

  const isBusy = assign.isPending || revoke.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="font-semibold text-gray-900">Herramientas</p>
            <p className="text-xs text-gray-400">{user.full_name ?? user.email}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Cargando...</p>
          ) : (
            TOOLS.map((tool) => {
              const active = activeTools.includes(tool.key)
              return (
                <div key={tool.key} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{tool.label}</p>
                    <p className="text-xs text-gray-400">{tool.desc}</p>
                  </div>
                  <button
                    onClick={() => toggle(tool.key, active)}
                    disabled={isBusy}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                      active ? "bg-gray-950" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                        active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

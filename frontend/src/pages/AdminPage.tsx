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
import {
  useAllTeams,
  useUserTeams,
  useAdminAssignOwner,
  useAdminAssignMember,
  useAdminRemoveMember,
  useDeleteTeam,
  useArchivedTeams,
  useRestoreTeam,
  useHardDeleteTeam,
} from "@/hooks/useTaskTeams"
import { useTasks, useDeleteTask } from "@/hooks/useTasks"
import type { Team } from "@/types/task"
import type { UserListItem } from "@/types/auth"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

type Tab = "activos" | "archivados" | "equipos"

const TOOLS = [
  { key: "tool_task_submit_dev", label: "Gestión de Tareas — Colaborador", desc: "Acceso a registro de tareas propias" },
  { key: "tool_task_manage_dev", label: "Gestión de Tareas — Gestor", desc: "Gestión completa del equipo de tareas" },
]

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("activos")
  const [modal, setModal] = useState<"create" | "edit" | null>(null)
  const [selected, setSelected] = useState<UserListItem | null>(null)
  const [mutationError, setMutationError] = useState<string>()
  const [toolsUser, setToolsUser] = useState<UserListItem | null>(null)
  const [deleteTasksConfirm, setDeleteTasksConfirm] = useState<"idle" | "ask">("idle")
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserListItem | null>(null)

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
    setPendingDeleteUser(user)
    setDeleteTasksConfirm("ask")
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
              <h1 className="text-xl font-bold text-foreground">Usuarios</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Administra el acceso al portal
              </p>
            </div>
            <Button
              onClick={openCreate}
              variant="default"
              className="flex items-center gap-2"
            >
              <span className="text-base leading-none">+</span>
              Nuevo usuario
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1 w-fit">
            {([
              { key: "activos", label: "Activos" },
              { key: "archivados", label: "Archivados" },
              { key: "equipos", label: "Equipos archivados" },
            ] as { key: Tab; label: string }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Equipos archivados */}
          {tab === "equipos" ? (
            <ArchivedTeamsPanel />
          ) : (
          /* Tabla usuarios */
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Cargando...
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground text-sm">
                  {tab === "activos"
                    ? "No hay usuarios activos."
                    : "No hay usuarios archivados."}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Usuario</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Rol</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                      Sede / Área
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                      Último acceso
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
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
          )}
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

      {deleteTasksConfirm === "ask" && pendingDeleteUser && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) { setDeleteTasksConfirm("idle"); setPendingDeleteUser(null) }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar usuario</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">¿Qué hacer con las tareas de este usuario?</p>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={() => { deleteUser.mutate({ id: pendingDeleteUser.id, deleteTasks: true }); setDeleteTasksConfirm("idle"); setPendingDeleteUser(null) }}
                variant="destructive"
                className="w-full"
              >
                Eliminar usuario y sus tareas
              </Button>
              <Button
                onClick={() => { deleteUser.mutate({ id: pendingDeleteUser.id, deleteTasks: false }); setDeleteTasksConfirm("idle"); setPendingDeleteUser(null) }}
                variant="outline"
                className="w-full"
              >
                Eliminar usuario, dejar tareas dormidas
              </Button>
              <Button
                onClick={() => { setDeleteTasksConfirm("idle"); setPendingDeleteUser(null) }}
                variant="ghost"
                className="w-full"
              >
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
    <tr className="hover:bg-muted transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue font-semibold text-xs">
            {(user.full_name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {user.full_name ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
        {user.sede ?? "—"}
        {user.area ? <span className="text-muted-foreground/40"> · </span> : null}
        {user.area}
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
        {user.last_login_at ? formatDate(user.last_login_at) : "Nunca"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {tab === "activos" ? (
            <>
              <Button
                onClick={() => onManageTools(user)}
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-auto"
              >
                Herramientas
              </Button>
              <Button
                onClick={() => onEdit(user)}
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-auto text-brand-blue hover:bg-brand-blue/10"
              >
                Editar
              </Button>
              <Button
                onClick={() => onDeactivate(user)}
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-auto text-red-500 hover:bg-red-50"
              >
                Desactivar
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => onReactivate(user)}
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-auto text-green-600 hover:bg-green-50"
              >
                Reactivar
              </Button>
              <Button
                onClick={() => onDelete(user)}
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-auto text-red-500 hover:bg-red-50"
              >
                Eliminar
              </Button>
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
    operativo: "bg-muted text-muted-foreground",
    empleado: "bg-muted text-muted-foreground",
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[role] ?? "bg-muted text-muted-foreground"}`}
    >
      {getRoleLabel(role)}
    </span>
  )
}

function formatDate(iso: string): string {
  return formatFechaRelativa(iso)
}

function UserTasksPanel({ userId, allTeams }: { userId: number; allTeams: Team[] }) {
  const { data: result, isLoading } = useTasks({ subidoPorId: userId, limit: 200 })
  const deleteTask = useDeleteTask()
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [openTeams, setOpenTeams] = useState<Record<number, boolean>>({})

  const tasks = result?.tasks ?? []

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Cargando tareas...</p>
  if (tasks.length === 0) return <p className="text-xs text-muted-foreground py-2">Sin tareas registradas.</p>

  const grouped = tasks.reduce<Record<number, typeof tasks>>((acc, t) => {
    if (!acc[t.teamId]) acc[t.teamId] = []
    acc[t.teamId].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {Object.entries(grouped).map(([teamIdStr, teamTasks]) => {
        const teamId = Number(teamIdStr)
        const teamName = allTeams.find((t) => t.id === teamId)?.name ?? `Equipo #${teamId}`
        const isOpen = openTeams[teamId] ?? false

        return (
          <div key={teamId} className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenTeams((prev) => ({ ...prev, [teamId]: !isOpen }))}
              className="w-full flex items-center justify-between px-3 py-2 bg-muted hover:bg-muted/80 transition-colors text-left"
            >
              <span className="text-xs font-semibold text-foreground">{teamName}</span>
              <span className="text-xs text-muted-foreground">{teamTasks.length} tarea{teamTasks.length !== 1 ? "s" : ""} {isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
              <div className="divide-y divide-border">
                {teamTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground truncate block">{task.titulo}</span>
                      <span className="text-muted-foreground">{task.fecha?.slice(0, 10)} · {task.estado}</span>
                    </div>
                    {confirmId === task.id ? (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => { deleteTask.mutate(task.id); setConfirmId(null) }}
                          className="text-red-600 hover:text-red-800 font-semibold"
                        >
                          Confirmar
                        </button>
                        <button onClick={() => setConfirmId(null)} className="text-muted-foreground">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(task.id)}
                        className="shrink-0 text-muted-foreground/40 hover:text-red-500 transition-colors"
                        title="Borrar tarea"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ArchivedTeamsPanel() {
  const { data: teams = [], isLoading } = useArchivedTeams()
  const restore = useRestoreTeam()
  const hardDelete = useHardDeleteTeam()
  const [confirmId, setConfirmId] = useState<number | null>(null)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No hay equipos archivados.</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 font-medium text-muted-foreground">Equipo</th>
            <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Archivado</th>
            <th className="px-4 py-3 font-medium text-muted-foreground text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {teams.map((team) => (
            <tr key={team.id} className="hover:bg-muted/50">
              <td className="px-4 py-3">
                <span className="font-medium text-foreground">{team.name}</span>
                <span className="text-xs text-muted-foreground ml-2">ID {team.id}</span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                {new Date(team.updatedAt).toLocaleDateString("es-MX")}
              </td>
              <td className="px-4 py-3 text-right">
                {confirmId === team.id ? (
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs text-red-600 font-medium">¿Borrar permanentemente?</span>
                    <button
                      onClick={async () => { await hardDelete.mutateAsync(team.id); setConfirmId(null) }}
                      disabled={hardDelete.isPending}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button onClick={() => setConfirmId(null)} className="text-xs text-muted-foreground hover:text-foreground">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      onClick={() => restore.mutate(team.id)}
                      disabled={restore.isPending}
                      variant="outline"
                      size="sm"
                      className="text-xs px-3 py-1 h-auto"
                    >
                      Restaurar
                    </Button>
                    <Button
                      onClick={() => setConfirmId(team.id)}
                      variant="outline"
                      size="sm"
                      className="text-xs px-3 py-1 h-auto border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      Borrar definitivo
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DeleteWorkspaceInline({ teamId, teamName, onDeleted }: { teamId: number; teamName: string; onDeleted: () => void }) {
  const deleteTeam = useDeleteTeam()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-2">
      <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">Zona de peligro</p>
      {confirm ? (
        <div className="space-y-2">
          <p className="text-xs text-red-700">¿Eliminar <strong>"{teamName}"</strong>? Esta acción desactiva el equipo permanentemente.</p>
          <div className="flex gap-2">
            <Button
              onClick={() => setConfirm(false)}
              variant="outline"
              size="sm"
              className="flex-1 text-xs px-3 py-1.5 h-auto"
            >
              Cancelar
            </Button>
            <Button
              disabled={deleteTeam.isPending}
              onClick={async () => {
                await deleteTeam.mutateAsync(teamId)
                setConfirm(false)
                onDeleted()
              }}
              variant="destructive"
              size="sm"
              className="flex-1 text-xs px-3 py-1.5 h-auto"
            >
              {deleteTeam.isPending ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground">{teamName}</span>
          <Button
            onClick={() => setConfirm(true)}
            variant="ghost"
            size="sm"
            className="text-xs px-2 py-1 h-auto bg-red-100 text-red-700 hover:bg-red-200"
          >
            Eliminar espacio
          </Button>
        </div>
      )}
    </div>
  )
}

function UserToolsModal({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const { data: activeTools = [], isLoading, refetch: refetchActiveTools } = useUserTools(user.id)
  const assign = useAssignUserTool()
  const revoke = useRevokeUserTool()
  const [toolError, setToolError] = useState<string | null>(null)

  // Teams data and mutations
  const { data: allTeams = [], refetch: refetchAllTeams } = useAllTeams()
  const { data: userTeams, refetch: refetchUserTeams } = useUserTeams(user.id)
  const assignOwner = useAdminAssignOwner()
  const assignMember = useAdminAssignMember()
  const removeMember = useAdminRemoveMember()

  const [newTeamName, setNewTeamName] = useState("")
  const [selectedTeamId, setSelectedTeamId] = useState<number | "">("")
  const [selectedColabTeamId, setSelectedColabTeamId] = useState<number | "">("")

  const ownedTeam = userTeams?.ownedTeams?.[0]
  const memberTeams = userTeams?.memberTeams ?? []

  function toggle(tool_key: string, currentlyActive: boolean) {
    setToolError(null)
    if (currentlyActive) {
      revoke.mutate({ user_id: user.id, tool_key }, {
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          setToolError(msg ?? "No se pudo revocar la herramienta.")
        },
        onSuccess: () => {
          refetchActiveTools()
          refetchUserTeams()
        }
      })
    } else {
      assign.mutate({ user_id: user.id, tool_key }, {
        onError: () => setToolError("No se pudo asignar la herramienta."),
        onSuccess: () => {
          refetchActiveTools()
          refetchUserTeams()
        }
      })
    }
  }

  async function handleAssignOwner() {
    setToolError(null)
    try {
      if (newTeamName.trim()) {
        await assignOwner.mutateAsync({
          userId: user.id,
          newTeamName: newTeamName.trim()
        })
        setNewTeamName("")
        alert("Equipo creado y asignado como gestor.")
      } else if (selectedTeamId) {
        await assignOwner.mutateAsync({
          userId: user.id,
          teamId: Number(selectedTeamId)
        })
        alert("Propietario del equipo actualizado.")
      }
      refetchUserTeams()
      refetchAllTeams()
    } catch (err: any) {
      setToolError(err.response?.data?.error ?? "Error al asignar gestor de equipo")
    }
  }

  async function handleAddMember() {
    if (!selectedColabTeamId) return
    setToolError(null)
    try {
      await assignMember.mutateAsync({
        userId: user.id,
        teamId: Number(selectedColabTeamId)
      })
      setSelectedColabTeamId("")
      refetchUserTeams()
      alert("Usuario agregado al equipo como colaborador.")
    } catch (err: any) {
      setToolError(err.response?.data?.error ?? "Error al agregar al equipo")
    }
  }

  async function handleRemoveMember(teamId: number) {
    if (!confirm("¿Desvincular a este usuario de este equipo?")) return
    setToolError(null)
    try {
      await removeMember.mutateAsync({
        userId: user.id,
        teamId
      })
      refetchUserTeams()
      alert("Usuario removido del equipo.")
    } catch (err: any) {
      setToolError(err.response?.data?.error ?? "Error al remover del equipo")
    }
  }

  const isBusy = assign.isPending || revoke.isPending || assignOwner.isPending || assignMember.isPending || removeMember.isPending

  const hasManageDev = activeTools.includes("tool_task_manage_dev")
  const hasSubmitDev = activeTools.includes("tool_task_submit_dev")

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Herramientas</DialogTitle>
          <p className="text-xs text-muted-foreground">{user.full_name ?? user.email}</p>
        </DialogHeader>

        <div className="px-1 py-2 space-y-4 overflow-y-auto flex-1">
          {toolError && (
            <p className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{toolError}</p>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permisos / Herramientas</h4>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Cargando...</p>
            ) : (
              TOOLS.map((tool) => {
                const active = activeTools.includes(tool.key)
                return (
                  <div key={tool.key} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{tool.label}</p>
                      <p className="text-xs text-muted-foreground">{tool.desc}</p>
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

          {/* Gestor Team Assignment */}
          {hasManageDev && !isLoading && (
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipo que Gestiona (Gestor)</h4>

              {ownedTeam ? (
                <div className="rounded-lg bg-muted border border-border px-4 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Equipo asignado:</p>
                  <p className="text-sm font-semibold text-foreground">{ownedTeam.name}</p>
                </div>
              ) : (
                <p className="text-xs text-amber-600 font-medium">⚠️ Este gestor no tiene ningún equipo asignado aún.</p>
              )}

              <div className="space-y-2">
                <label className="block text-[10px] font-medium text-muted-foreground uppercase">Vincular a equipo existente</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => {
                    setSelectedTeamId(e.target.value ? Number(e.target.value) : "")
                    setNewTeamName("")
                  }}
                  disabled={isBusy}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Seleccionar equipo...</option>
                  {allTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} (Gestor ID: {team.ownerUserId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-medium text-muted-foreground uppercase">O Crear Nuevo Equipo para este Gestor</label>
                <input
                  type="text"
                  placeholder="Nombre del nuevo equipo..."
                  value={newTeamName}
                  onChange={(e) => {
                    setNewTeamName(e.target.value)
                    setSelectedTeamId("")
                  }}
                  disabled={isBusy}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <Button
                type="button"
                onClick={handleAssignOwner}
                disabled={isBusy || (!selectedTeamId && !newTeamName.trim())}
                variant="default"
                className="w-full"
              >
                {newTeamName.trim() ? "Crear y Asignar Equipo" : "Vincular a Equipo"}
              </Button>
            </div>
          )}

          {/* Colaborador Team Assignment */}
          {hasSubmitDev && !isLoading && (
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipos en los que Colabora</h4>

              {memberTeams.length > 0 ? (
                <div className="space-y-1.5">
                  {memberTeams.map((team) => (
                    <div key={team.id} className="flex items-center justify-between rounded-lg bg-muted border border-border px-3 py-1.5">
                      <span className="text-sm font-medium text-foreground">{team.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(team.id)}
                        disabled={isBusy}
                        className="text-xs text-red-600 hover:text-red-700 font-semibold"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-600 font-medium">⚠️ Este colaborador no está asignado a ningún equipo aún.</p>
              )}

              <div className="space-y-2 pt-1">
                <label className="block text-[10px] font-medium text-muted-foreground uppercase">Agregar a un equipo</label>
                <div className="flex gap-2">
                  <select
                    value={selectedColabTeamId}
                    onChange={(e) => setSelectedColabTeamId(e.target.value ? Number(e.target.value) : "")}
                    disabled={isBusy}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Seleccionar equipo...</option>
                    {allTeams
                      .filter((t) => !memberTeams.some((mt) => mt.id === t.id))
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                  </select>
                  <Button
                    type="button"
                    onClick={handleAddMember}
                    disabled={isBusy || !selectedColabTeamId}
                    variant="default"
                    size="sm"
                    className="px-4 py-1.5 h-auto"
                  >
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tareas</h4>
            <UserTasksPanel userId={user.id} allTeams={allTeams} />

            {(userTeams?.ownedTeams ?? []).length > 0 && (
              <div className="space-y-2">
                {(userTeams?.ownedTeams ?? []).map((t) => (
                  <DeleteWorkspaceInline key={t.id} teamId={t.id} teamName={t.name} onDeleted={refetchUserTeams} />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border">
          <Button
            onClick={onClose}
            variant="outline"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

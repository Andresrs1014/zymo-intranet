import { useState } from "react"
import { Flag, Ban, Mail, Pencil, Trash2, Check, X } from "lucide-react"
import { useTask } from "@/context/TaskContext"
import {
  useTeamMembers,
  useRenameTeam,
  useAddMember,
  useRemoveMember,
  usePromoteMember,
  useDemoteMember,
  useAvailableUsers,
  useMyTeams,
  useDeleteTeam,
  type AvailableUser,
} from "@/hooks/useTaskTeams"
import {
  useTaskLists,
  useCreateListItem,
  useUpdateListItem,
  useSetSpecialFlag,
} from "@/hooks/useTaskLists"
import { useTaskToast } from "@/components/tareas/TaskToast"
import type { ListConfig, ListType } from "@/types/task"

type SettingsTab = "team" | "lists"

const INPUT_CLASS =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"

// ─── Team settings ────────────────────────────────────────────────────────────

function TeamSettings() {
  const { activeTeamId, setActiveTeamId } = useTask()
  const { data: teams = [] } = useMyTeams()
  const { data: members = [] } = useTeamMembers(activeTeamId)
  const { data: availableUsers = [] } = useAvailableUsers(activeTeamId)
  const rename = useRenameTeam()
  const addMember = useAddMember()
  const removeMember = useRemoveMember()
  const promote = usePromoteMember()
  const demote = useDemoteMember()
  const deleteTeam = useDeleteTeam()
  const { showToast } = useTaskToast()

  const team = teams.find((t) => t.id === activeTeamId)
  const isOwner = team?.myRole === "owner"

  const [newName, setNewName] = useState(team?.name ?? "")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function handleRename() {
    if (!activeTeamId || !newName.trim()) return
    try {
      await rename.mutateAsync({ teamId: activeTeamId, name: newName })
      showToast("Equipo renombrado", "success")
    } catch {
      showToast("Error al renombrar", "error")
    }
  }

  const roleBadgeClass = (role: string) =>
    `rounded-full px-2 py-px text-[10px] font-bold ${
      role === "co_gestor" ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"
    }`

  return (
    <div>
      {/* Rename team */}
      {isOwner && (
        <div className="mb-7">
          <h3 className="mb-2.5 text-[14px] font-bold text-zinc-900">Nombre del equipo</h3>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`flex-1 ${INPUT_CLASS}`}
            />
            <button
              onClick={handleRename}
              disabled={rename.isPending}
              className="rounded-md bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground transition hover:brightness-95"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Danger zone: delete team */}
      {isOwner && (
        <div className="mb-7 rounded-lg border border-red-200 bg-red-50 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-bold text-red-600">Eliminar espacio de trabajo</div>
              <div className="mt-0.5 text-xs text-red-500">Esta acción es permanente y no se puede deshacer.</div>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && activeTeamId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="w-[380px] rounded-lg border border-zinc-200 bg-white p-7 shadow-2xl">
            <h3 className="mb-2.5 text-[15px] font-bold text-zinc-900">¿Eliminar espacio de trabajo?</h3>
            <p className="mb-5 text-[13px] text-zinc-600">
              Se desactivará el equipo <strong>"{team?.name}"</strong>. Las tareas y datos existentes quedarán guardados pero el equipo no será visible.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-md border border-zinc-300 bg-white py-2 text-[13px] text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                disabled={deleteTeam.isPending}
                onClick={async () => {
                  try {
                    await deleteTeam.mutateAsync(activeTeamId)
                    setActiveTeamId(null)
                    setShowDeleteConfirm(false)
                    showToast("Espacio de trabajo eliminado", "success")
                  } catch {
                    showToast("Error al eliminar", "error")
                  }
                }}
                className="flex-1 rounded-md bg-red-600 py-2 text-[13px] font-bold text-white transition hover:bg-red-700"
              >
                {deleteTeam.isPending ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-zinc-900">Miembros ({members.length})</h3>
        {(isOwner || team?.myRole === "co_gestor") && (
          <button
            onClick={() => setShowAddDialog(true)}
            className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            + Agregar
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-[11px] font-bold text-white">
                {m.userId.toString().slice(0, 2)}
              </div>
              <div>
                <div className="text-[13px] font-medium text-zinc-900">{m.userNombre ?? `Usuario ${m.userId}`}</div>
                <span className={roleBadgeClass(m.role)}>{m.role === "co_gestor" ? "Co-gestor" : "Miembro"}</span>
              </div>
            </div>

            {isOwner && activeTeamId && (
              <div className="flex gap-1.5">
                {m.role === "member" ? (
                  <button
                    onClick={() => promote.mutateAsync({ teamId: activeTeamId, userId: m.userId })}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Promover
                  </button>
                ) : (
                  <button
                    onClick={() => demote.mutateAsync({ teamId: activeTeamId, userId: m.userId })}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Degradar
                  </button>
                )}
                <button
                  onClick={() => {
                    if (window.confirm("¿Remover este miembro?")) {
                      removeMember.mutate({ teamId: activeTeamId, userId: m.userId })
                    }
                  }}
                  className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] text-red-600 transition hover:bg-red-100"
                >
                  Remover
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add member dialog */}
      {showAddDialog && activeTeamId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[70vh] w-[400px] overflow-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-[15px] font-bold text-zinc-900">Agregar miembro</h3>
            {(availableUsers as AvailableUser[]).map((u) => (
              <div key={u.id} className="flex items-center justify-between border-b border-zinc-100 py-2">
                <span className="text-[13px] text-zinc-700">{u.full_name ?? `Usuario ${u.id}`}</span>
                <button
                  onClick={async () => {
                    await addMember.mutateAsync({ teamId: activeTeamId, userId: u.id, userNombre: u.full_name ?? undefined })
                    showToast("Miembro agregado", "success")
                  }}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition hover:brightness-95"
                >
                  Agregar
                </button>
              </div>
            ))}
            {availableUsers.length === 0 && (
              <p className="text-center text-[13px] text-zinc-500">No hay usuarios disponibles.</p>
            )}
            <button
              onClick={() => setShowAddDialog(false)}
              className="mt-4 w-full rounded-md border border-zinc-300 bg-white py-2 text-[13px] text-zinc-700 transition hover:bg-zinc-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Lists settings ───────────────────────────────────────────────────────────

const LIST_TYPE_TABS: { key: ListType; label: string }[] = [
  { key: "estado", label: "Estados" },
  { key: "etiqueta", label: "Etiquetas" },
  { key: "plataforma", label: "Plataformas" },
  { key: "modalidad", label: "Modalidades" },
  { key: "prioridad", label: "Prioridades" },
]

function ListItem({ item, teamId, isEstado }: { item: ListConfig; teamId: number; isEstado: boolean }) {
  const updateItem = useUpdateListItem()
  const setSpecial = useSetSpecialFlag()
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(item.label)
  const [editColor, setEditColor] = useState(item.color ?? "#71717a")

  // Border color reflects active special flag
  const borderColor = item.isFinal
    ? "#16a34a"
    : item.isCanceled
    ? "#dc2626"
    : item.isInitialAssignment
    ? "#2563eb"
    : "#e4e4e7"

  const iconBtn = (active: boolean, activeColor: string) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
    borderRadius: 5,
    border: `1px solid ${active ? activeColor : "#d4d4d8"}`,
    background: active ? `${activeColor}18` : "transparent",
    color: active ? activeColor : "#71717a",
    cursor: "pointer",
    transition: "all .15s",
  } as React.CSSProperties)

  async function saveEdit() {
    await updateItem.mutateAsync({ teamId, listType: item.listType, value: item.value, label: editLabel, color: editColor })
    setEditing(false)
  }

  return (
    <div
      className="mb-1.5 flex items-center gap-2.5 rounded-lg bg-white px-3.5 py-2.5"
      style={{ border: `1.5px solid ${borderColor}`, transition: "border-color .2s" }}
    >
      {/* Color dot */}
      {editing ? (
        <input
          type="color"
          value={editColor}
          onChange={(e) => setEditColor(e.target.value)}
          className="h-[22px] w-[22px] cursor-pointer rounded border border-zinc-300 p-px"
        />
      ) : (
        <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: item.color ?? "#71717a" }} />
      )}

      {/* Label / edit input */}
      {editing ? (
        <input
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          autoFocus
          className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-[13px] text-zinc-900 outline-none focus:border-primary"
        />
      ) : (
        <div className="flex-1">
          <span className={`text-[13px] font-medium ${item.isActive ? "text-zinc-900" : "text-zinc-400"}`}>{item.label}</span>
          <span className="ml-1.5 text-[10px] text-zinc-400">{item.value}</span>
        </div>
      )}

      {/* Action icons */}
      <div className="flex items-center gap-1">
        {isEstado && (
          <>
            <button
              title="Estado final (completado)"
              style={iconBtn(!!item.isFinal, "#16a34a")}
              onClick={() => setSpecial.mutate({ teamId, value: item.value, isFinal: !item.isFinal })}
            >
              <Flag size={13} />
            </button>
            <button
              title="Estado cancelado"
              style={iconBtn(!!item.isCanceled, "#dc2626")}
              onClick={() => setSpecial.mutate({ teamId, value: item.value, isCanceled: !item.isCanceled })}
            >
              <Ban size={13} />
            </button>
            <button
              title="Estado inicial (asignación)"
              style={iconBtn(!!item.isInitialAssignment, "#2563eb")}
              onClick={() => setSpecial.mutate({ teamId, value: item.value, isInitialAssignment: !item.isInitialAssignment })}
            >
              <Mail size={13} />
            </button>
          </>
        )}

        {/* Edit / confirm */}
        {editing ? (
          <>
            <button title="Guardar" style={iconBtn(true, "#16a34a")} onClick={saveEdit} disabled={updateItem.isPending}>
              <Check size={13} />
            </button>
            <button title="Cancelar" style={iconBtn(false, "#71717a")} onClick={() => { setEditing(false); setEditLabel(item.label); setEditColor(item.color ?? "#71717a") }}>
              <X size={13} />
            </button>
          </>
        ) : (
          <button title="Editar" style={iconBtn(false, "#71717a")} onClick={() => setEditing(true)}>
            <Pencil size={13} />
          </button>
        )}

        {/* Trash = toggle isActive */}
        <button
          title={item.isActive ? "Desactivar" : "Activar"}
          style={iconBtn(!item.isActive, "#dc2626")}
          onClick={() => updateItem.mutate({ teamId, listType: item.listType, value: item.value, isActive: !item.isActive })}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function ListsSettings() {
  const { activeTeamId } = useTask()
  const { data: lists } = useTaskLists(activeTeamId)
  const createItem = useCreateListItem()
  const { showToast } = useTaskToast()
  const [activeListTab, setActiveListTab] = useState<ListType>("estado")
  const [newItemForm, setNewItemForm] = useState({ value: "", label: "", color: "#71717a" })

  if (!activeTeamId) return null

  const items = lists?.[activeListTab] ?? []

  async function handleCreate() {
    if (!newItemForm.value.trim()) {
      showToast("El campo 'Valor (slug)' es obligatorio", "error")
      return
    }
    if (!newItemForm.label.trim()) {
      showToast("El campo 'Etiqueta visible' es obligatorio", "error")
      return
    }
    try {
      await createItem.mutateAsync({ teamId: activeTeamId!, listType: activeListTab, ...newItemForm })
      showToast("Item creado", "success")
      setNewItemForm({ value: "", label: "", color: "#71717a" })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg ?? "Error al crear item", "error")
    }
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="mb-[18px] flex gap-2">
        {LIST_TYPE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveListTab(tab.key)}
            className={`rounded-md px-4 py-1.5 text-[13px] font-semibold transition ${
              activeListTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {items.map((item) => (
        <ListItem key={item.id} item={item} teamId={activeTeamId} isEstado={activeListTab === "estado"} />
      ))}

      {/* Add new item */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
        <h4 className="mb-2.5 text-[13px] font-bold text-zinc-700">Nuevo item</h4>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Valor (slug)"
            value={newItemForm.value}
            onChange={(e) => setNewItemForm((f) => ({ ...f, value: e.target.value }))}
            className={`min-w-[120px] flex-1 ${INPUT_CLASS} text-xs`}
          />
          <input
            placeholder="Etiqueta visible"
            value={newItemForm.label}
            onChange={(e) => setNewItemForm((f) => ({ ...f, label: e.target.value }))}
            className={`min-w-[120px] flex-1 ${INPUT_CLASS} text-xs`}
          />
          <input
            type="color"
            value={newItemForm.color}
            onChange={(e) => setNewItemForm((f) => ({ ...f, color: e.target.value }))}
            className="h-[38px] w-[38px] cursor-pointer rounded-md border border-zinc-300 p-0.5"
          />
          <button
            onClick={handleCreate}
            disabled={createItem.isPending}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition hover:brightness-95"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Settings View ────────────────────────────────────────────────────────────

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("team")

  const tabClass = (tab: SettingsTab) =>
    `rounded-md px-5 py-2 text-[13px] font-bold transition ${
      activeTab === tab
        ? "bg-primary text-primary-foreground"
        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
    }`

  return (
    <div>
      <div className="mb-6 flex gap-2">
        <button className={tabClass("team")} onClick={() => setActiveTab("team")}>Equipo</button>
        <button className={tabClass("lists")} onClick={() => setActiveTab("lists")}>Listas</button>
      </div>

      {activeTab === "team" ? <TeamSettings /> : <ListsSettings />}
    </div>
  )
}

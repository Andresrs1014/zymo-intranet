import { useState } from "react"
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

// ─── Team settings ────────────────────────────────────────────────────────────

function TeamSettings() {
  const { activeTeamId } = useTask()
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

  const ROLE_BADGE = (role: string) => ({
    padding: "1px 8px",
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 700,
    background: role === "co_gestor" ? "#fef3c7" : "#f0f2f7",
    color: role === "co_gestor" ? "#92400e" : "#5c6374",
  })

  return (
    <div>
      {/* Rename team */}
      {isOwner && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#121420" }}>Nombre del equipo</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: "1px solid #d8dde8", fontSize: 13 }}
            />
            <button
              onClick={handleRename}
              disabled={rename.isPending}
              style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "#ef3340", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Danger zone: delete team */}
      {isOwner && (
        <div style={{ marginBottom: 28, padding: "14px 16px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff5f5" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>Eliminar espacio de trabajo</div>
              <div style={{ fontSize: 12, color: "#ef4444", marginTop: 2 }}>Esta acción es permanente y no se puede deshacer.</div>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && activeTeamId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 28, width: 380 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#121420" }}>¿Eliminar espacio de trabajo?</h3>
            <p style={{ fontSize: 13, color: "#5c6374", margin: "0 0 20px" }}>
              Se desactivará el equipo <strong>"{team?.name}"</strong>. Las tareas y datos existentes quedarán guardados pero el equipo no será visible.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, padding: "9px", borderRadius: 7, border: "1px solid #d8dde8", background: "#f4f6fa", fontSize: 13, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                disabled={deleteTeam.isPending}
                onClick={async () => {
                  try {
                    await deleteTeam.mutateAsync(activeTeamId)
                    showToast("Espacio de trabajo eliminado", "success")
                    setShowDeleteConfirm(false)
                  } catch {
                    showToast("Error al eliminar", "error")
                  }
                }}
                style={{ flex: 1, padding: "9px", borderRadius: 7, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                {deleteTeam.isPending ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#121420" }}>Miembros ({members.length})</h3>
        {(isOwner || team?.myRole === "co_gestor") && (
          <button
            onClick={() => setShowAddDialog(true)}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d8dde8", background: "#f4f6fa", fontSize: 13, cursor: "pointer", color: "#3f4652", fontWeight: 600 }}
          >
            + Agregar
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e8ebf4" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#6366f1",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {m.userId.toString().slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#121420" }}>{m.userNombre ?? `Usuario ${m.userId}`}</div>
                <span style={ROLE_BADGE(m.role)}>{m.role === "co_gestor" ? "Co-gestor" : "Miembro"}</span>
              </div>
            </div>

            {isOwner && activeTeamId && (
              <div style={{ display: "flex", gap: 6 }}>
                {m.role === "member" ? (
                  <button
                    onClick={() => promote.mutateAsync({ teamId: activeTeamId, userId: m.userId })}
                    style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #d8dde8", background: "#fff", fontSize: 11, cursor: "pointer", color: "#3f4652" }}
                  >
                    Promover
                  </button>
                ) : (
                  <button
                    onClick={() => demote.mutateAsync({ teamId: activeTeamId, userId: m.userId })}
                    style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #d8dde8", background: "#fff", fontSize: 11, cursor: "pointer", color: "#3f4652" }}
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
                  style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #fca5a5", background: "#fff5f5", fontSize: 11, cursor: "pointer", color: "#ef4444" }}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 24, width: 400, maxHeight: "70vh", overflow: "auto" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Agregar miembro</h3>
            {(availableUsers as AvailableUser[]).map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f2f7" }}>
                <span style={{ fontSize: 13, color: "#3f4652" }}>{u.full_name ?? `Usuario ${u.id}`}</span>
                <button
                  onClick={async () => {
                    await addMember.mutateAsync({ teamId: activeTeamId, userId: u.id, userNombre: u.full_name ?? undefined })
                    showToast("Miembro agregado", "success")
                  }}
                  style={{ padding: "4px 12px", borderRadius: 5, border: "none", background: "#ef3340", color: "#fff", fontSize: 12, cursor: "pointer" }}
                >
                  Agregar
                </button>
              </div>
            ))}
            {availableUsers.length === 0 && (
              <p style={{ fontSize: 13, color: "#9aa5b8", textAlign: "center" }}>No hay usuarios disponibles.</p>
            )}
            <button
              onClick={() => setShowAddDialog(false)}
              style={{ marginTop: 16, width: "100%", padding: "8px", borderRadius: 7, border: "1px solid #d8dde8", background: "#f4f6fa", fontSize: 13, cursor: "pointer" }}
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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e8ebf4", marginBottom: 6 }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: item.color ?? "#6b7280", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#121420" }}>{item.label}</div>
        <div style={{ fontSize: 10, color: "#9aa5b8" }}>{item.value}</div>
      </div>
      {isEstado && (
        <div style={{ display: "flex", gap: 4 }}>
          {item.isInitialAssignment && <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8" }}>INICIAL</span>}
          {item.isFinal && <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: "#d1fae5", color: "#065f46" }}>FINAL</span>}
          {item.isCanceled && <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: "#fee2e2", color: "#991b1b" }}>CANCELADO</span>}
          <button
            onClick={() => setSpecial.mutate({ teamId, value: item.value, isFinal: !item.isFinal })}
            style={{ padding: "2px 7px", borderRadius: 4, border: "1px solid #d8dde8", background: "#f4f6fa", fontSize: 10, cursor: "pointer" }}
          >
            {item.isFinal ? "Quitar final" : "Marcar final"}
          </button>
        </div>
      )}
      <button
        onClick={() => updateItem.mutate({ teamId, listType: item.listType, value: item.value, isActive: !item.isActive })}
        style={{
          padding: "3px 8px",
          borderRadius: 4,
          border: "1px solid #d8dde8",
          background: item.isActive ? "#f4f6fa" : "#fee2e2",
          color: item.isActive ? "#3f4652" : "#ef4444",
          fontSize: 10,
          cursor: "pointer",
        }}
      >
        {item.isActive ? "Desactivar" : "Activar"}
      </button>
    </div>
  )
}

function ListsSettings() {
  const { activeTeamId } = useTask()
  const { data: lists } = useTaskLists(activeTeamId)
  const createItem = useCreateListItem()
  const { showToast } = useTaskToast()
  const [activeListTab, setActiveListTab] = useState<ListType>("estado")
  const [newItemForm, setNewItemForm] = useState({ value: "", label: "", color: "#6b7280" })

  if (!activeTeamId) return null

  const items = lists?.[activeListTab] ?? []

  async function handleCreate() {
    if (!newItemForm.value.trim() || !newItemForm.label.trim()) return
    try {
      await createItem.mutateAsync({ teamId: activeTeamId!, listType: activeListTab, ...newItemForm })
      showToast("Item creado", "success")
      setNewItemForm({ value: "", label: "", color: "#6b7280" })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg ?? "Error al crear item", "error")
    }
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {LIST_TYPE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveListTab(tab.key)}
            style={{
              padding: "7px 18px",
              borderRadius: 7,
              border: "none",
              background: activeListTab === tab.key ? "#ef3340" : "#f4f6fa",
              color: activeListTab === tab.key ? "#fff" : "#5c6374",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {items.map((item) => (
        <ListItem key={item.id} item={item} teamId={activeTeamId} isEstado={activeListTab === "estado"} />
      ))}

      {/* Add new item */}
      <div style={{ marginTop: 16, padding: "14px", background: "#f8f9fd", borderRadius: 8, border: "1px solid #e8ebf4" }}>
        <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#3f4652" }}>Nuevo item</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Valor (slug)"
            value={newItemForm.value}
            onChange={(e) => setNewItemForm((f) => ({ ...f, value: e.target.value }))}
            style={{ flex: 1, minWidth: 120, padding: "7px 10px", borderRadius: 6, border: "1px solid #d8dde8", fontSize: 12 }}
          />
          <input
            placeholder="Etiqueta visible"
            value={newItemForm.label}
            onChange={(e) => setNewItemForm((f) => ({ ...f, label: e.target.value }))}
            style={{ flex: 1, minWidth: 120, padding: "7px 10px", borderRadius: 6, border: "1px solid #d8dde8", fontSize: 12 }}
          />
          <input
            type="color"
            value={newItemForm.color}
            onChange={(e) => setNewItemForm((f) => ({ ...f, color: e.target.value }))}
            style={{ width: 38, height: 33, padding: 2, borderRadius: 5, border: "1px solid #d8dde8", cursor: "pointer" }}
          />
          <button
            onClick={handleCreate}
            disabled={createItem.isPending}
            style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#ef3340", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
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

  const TAB_BTN = (tab: SettingsTab) => ({
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    background: activeTab === tab ? "#121420" : "#f4f6fa",
    color: activeTab === tab ? "#fff" : "#5c6374",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  })

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button style={TAB_BTN("team")} onClick={() => setActiveTab("team")}>Equipo</button>
        <button style={TAB_BTN("lists")} onClick={() => setActiveTab("lists")}>Listas</button>
      </div>

      {activeTab === "team" ? <TeamSettings /> : <ListsSettings />}
    </div>
  )
}

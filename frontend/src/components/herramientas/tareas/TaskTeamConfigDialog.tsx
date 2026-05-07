import { useState } from "react"
import {
  useTeamMembers,
  useAvailableTeamUsers,
  useAddTeamMember,
  useRemoveTeamMember,
} from "@/hooks/useWorkTasks"
import { taskButtonPrimary, taskButtonDanger, taskButtonSecondary, taskInput } from "@/lib/taskTheme"

interface TaskTeamConfigDialogProps {
  open: boolean
  onClose: () => void
}

export function TaskTeamConfigDialog({ open, onClose }: TaskTeamConfigDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("")

  const { data: members, isLoading: loadingMembers } = useTeamMembers()
  const { data: available, isLoading: loadingAvailable } = useAvailableTeamUsers()
  const addMember = useAddTeamMember()
  const removeMember = useRemoveTeamMember()

  if (!open) return null

  const handleAdd = async () => {
    if (!selectedUserId) return
    await addMember.mutateAsync(Number(selectedUserId))
    setSelectedUserId("")
  }

  const handleRemove = async (userId: number) => {
    await removeMember.mutateAsync(userId)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-xl shadow-xl flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Configurar equipo de tareas</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Current members */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Miembros activos</h3>
              {loadingMembers ? (
                <p className="text-sm text-gray-400">Cargando...</p>
              ) : !members || members.length === 0 ? (
                <p className="text-sm text-gray-400">No hay miembros en el equipo.</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {m.user_full_name ?? m.user_email}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{m.user_email}</p>
                      </div>
                      <button
                        type="button"
                        className={taskButtonDanger}
                        onClick={() => handleRemove(m.user_id)}
                        disabled={removeMember.isPending}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Add member */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Agregar miembro</h3>
              {loadingAvailable ? (
                <p className="text-sm text-gray-400">Cargando usuarios disponibles...</p>
              ) : !available || available.length === 0 ? (
                <p className="text-sm text-gray-400">No hay usuarios disponibles para agregar.</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    className={`${taskInput} flex-1`}
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">Seleccionar usuario...</option>
                    {available.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name ?? u.email} — {u.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={taskButtonPrimary}
                    onClick={handleAdd}
                    disabled={!selectedUserId || addMember.isPending}
                  >
                    Agregar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button type="button" className={taskButtonSecondary} onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

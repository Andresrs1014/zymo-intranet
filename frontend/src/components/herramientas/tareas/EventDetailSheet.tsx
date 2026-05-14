import { useState } from "react"
import { X, Trash2, UserPlus, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { TaskEvent, TaskTeamMember, AvailableUser } from "@/types/workTask"
import {
  useDeleteEvent,
  useUpdateEventParticipants,
  useTeamMembers,
  useAvailableTeamUsers,
  useTaskLists,
} from "@/hooks/useWorkTasks"
import { useAuthStore } from "@/store/authStore"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  event: TaskEvent | null
  onClose: () => void
  isManager?: boolean
}

export function EventDetailSheet({ event, onClose, isManager = false }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [showAddParticipants, setShowAddParticipants] = useState(false)
  const [selectedAddIds, setSelectedAddIds] = useState<number[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [participantError, setParticipantError] = useState<string | null>(null)

  const deleteEvent = useDeleteEvent()
  const updateParticipants = useUpdateEventParticipants()
  const { data: teamMembers = [] } = useTeamMembers()
  const { data: allUsers = [] } = useAvailableTeamUsers()
  const { data: lists } = useTaskLists()

  if (!event) return null

  const prioridadLabel =
    lists?.prioridad_agenda?.find((p) => p.value === event.prioridad)?.label ?? event.prioridad

  const canModify = isManager || event.creado_por_id === currentUserId

  const existingIds = new Set(event.participants.map((p) => p.user_id))

  const toggleAdd = (id: number) => {
    setSelectedAddIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleDelete = async () => {
    if (!confirm("¿Seguro que quieres cancelar este evento? Esta acción no se puede deshacer.")) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteEvent.mutateAsync(event.id)
      onClose()
    } catch {
      setDeleteError("Error al cancelar el evento.")
      setIsDeleting(false)
    }
  }

  const handleRemoveParticipant = async (userId: number) => {
    setParticipantError(null)
    try {
      await updateParticipants.mutateAsync({ eventId: event.id, addIds: [], removeIds: [userId] })
    } catch {
      setParticipantError("Error al eliminar participante.")
    }
  }

  const handleAddParticipants = async () => {
    if (selectedAddIds.length === 0) return
    setParticipantError(null)
    try {
      await updateParticipants.mutateAsync({ eventId: event.id, addIds: selectedAddIds, removeIds: [] })
      setSelectedAddIds([])
      setShowAddParticipants(false)
    } catch {
      setParticipantError("Error al agregar participantes.")
    }
  }

  const formatFecha = (fecha: string) => {
    try {
      return format(new Date(fecha + "T00:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })
    } catch {
      return fecha
    }
  }

  const endTime = (() => {
    try {
      const [h, m] = event.hora_inicio.split(":").map(Number)
      const total = h * 60 + m + event.duracion_minutos
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
    } catch {
      return ""
    }
  })()

  const availableToAdd = [
    ...teamMembers.map((m: TaskTeamMember) => ({
      id: m.user_id,
      label: m.user_full_name ?? m.user_email,
    })),
    ...allUsers
      .filter((u: AvailableUser) => !teamMembers.some((m: TaskTeamMember) => m.user_id === u.id))
      .map((u: AvailableUser) => ({
        id: u.id,
        label: u.full_name ?? u.email,
      })),
  ].filter((u) => !existingIds.has(u.id))

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full bg-background border-l border-border shadow-xl z-50 flex flex-col transition-transform duration-300 ease-in-out w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-base line-clamp-1">{event.titulo}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Date + time */}
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 space-y-1">
            <p className="text-sm font-medium capitalize">{formatFecha(event.fecha)}</p>
            <p className="text-xs text-muted-foreground">
              {event.hora_inicio} — {endTime} ({event.duracion_minutos} min)
            </p>
          </div>

          {/* Priority + Platform */}
          <div className="flex flex-wrap gap-2">
            {event.prioridad && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-800 font-medium">
                {prioridadLabel}
              </span>
            )}
            {event.plataforma && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-xs text-gray-700">
                {event.plataforma}
              </span>
            )}
          </div>

          {/* Description */}
          {event.descripcion && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Descripción</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{event.descripcion}</p>
            </div>
          )}

          {/* Organizer */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Organizado por</p>
            <p className="text-sm">{event.creado_por_nombre}</p>
          </div>

          {/* Participants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Participantes ({event.participants.length})
              </p>
              {canModify && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setShowAddParticipants((v) => !v)}
                >
                  <UserPlus className="w-3 h-3" />
                  Agregar
                  {showAddParticipants ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
              )}
            </div>

            <div className="space-y-1">
              {event.participants.map((p) => (
                <div
                  key={p.user_id}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-md text-sm ${
                    p.has_conflict ? "bg-amber-50 border border-amber-200" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {p.has_conflict && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    <span className="truncate">{p.user_nombre}</span>
                  </div>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.user_id)}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-2 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Conflict details */}
            {event.participants.some((p) => p.has_conflict) && (
              <div className="mt-2 space-y-1">
                {event.participants.filter((p) => p.has_conflict).map((p) => (
                  <p key={p.user_id} className="text-xs text-amber-700">
                    <strong>{p.user_nombre}:</strong> {p.conflict_detail}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Add participants panel */}
          {showAddParticipants && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Agregar participantes</p>
              <Tabs defaultValue="equipo">
                <TabsList className="w-full">
                  <TabsTrigger value="equipo" className="flex-1 text-xs">Equipo</TabsTrigger>
                  <TabsTrigger value="todos" className="flex-1 text-xs">Todos</TabsTrigger>
                </TabsList>
                <TabsContent value="equipo">
                  <AddUserList
                    users={availableToAdd.filter((u) =>
                      teamMembers.some((m: TaskTeamMember) => m.user_id === u.id)
                    )}
                    selected={selectedAddIds}
                    onToggle={toggleAdd}
                  />
                </TabsContent>
                <TabsContent value="todos">
                  <AddUserList
                    users={availableToAdd}
                    selected={selectedAddIds}
                    onToggle={toggleAdd}
                  />
                </TabsContent>
              </Tabs>
              {selectedAddIds.length > 0 && (
                <Button size="sm" className="w-full text-xs" onClick={handleAddParticipants}>
                  Agregar {selectedAddIds.length} participante{selectedAddIds.length !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          )}

          {participantError && <p className="text-xs text-destructive">{participantError}</p>}
        </div>

        {/* Footer — cancel event */}
        {canModify && (
          <div className="px-5 py-4 border-t border-border shrink-0">
            {deleteError && <p className="text-xs text-destructive mb-2">{deleteError}</p>}
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Cancelando..." : "Cancelar evento"}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

function AddUserList({
  users,
  selected,
  onToggle,
}: {
  users: { id: number; label: string }[]
  selected: number[]
  onToggle: (id: number) => void
}) {
  if (users.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">Sin usuarios disponibles.</p>
  }
  return (
    <div className="space-y-1 max-h-36 overflow-y-auto mt-2 rounded-md border border-border p-2">
      {users.map((u) => (
        <label
          key={u.id}
          className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/50 transition-colors"
        >
          <input
            type="checkbox"
            checked={selected.includes(u.id)}
            onChange={() => onToggle(u.id)}
            className="accent-primary"
          />
          <span className="text-xs">{u.label}</span>
        </label>
      ))}
    </div>
  )
}

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useCreateEvent, useTeamMembers, useAvailableTeamUsers, useTaskLists } from "@/hooks/useWorkTasks"
import { useAuthStore } from "@/store/authStore"
import type { TaskTeamMember, AvailableUser } from "@/types/workTask"
import { format } from "date-fns"

interface Props {
  isOpen: boolean
  onClose: () => void
  preselectedDate?: Date | null
  teamId?: number
}

export function ScheduleSheet({
  isOpen,
  onClose,
  preselectedDate,
  teamId,
}: Props) {
  const today = format(new Date(), "yyyy-MM-dd")

  const currentUserId = useAuthStore((s) => s.user?.id)

  const [titulo, setTitulo] = useState("")
  const [fecha, setFecha] = useState(today)
  const [horaInicio, setHoraInicio] = useState("09:00")
  const [duracion, setDuracion] = useState("60")
  const [descripcion, setDescripcion] = useState("")
  const [plataforma, setPlataforma] = useState("")
  const [prioridad, setPrioridad] = useState("")
  const [modalidad, setModalidad] = useState("")
  const [sede, setSede] = useState("")
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    currentUserId != null ? [currentUserId] : []
  )

  // Si el userId aún no estaba disponible al montar, sincronizarlo
  useEffect(() => {
    if (currentUserId != null && selectedIds.length === 0) {
      setSelectedIds([currentUserId])
    }
  }, [currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createEvent = useCreateEvent()
  const { data: teamMembers = [] } = useTeamMembers()
  const { data: allUsers = [] } = useAvailableTeamUsers()
  const { data: lists } = useTaskLists(teamId)
  const plataformas = lists?.plataforma ?? []
  const prioridadesAgenda = lists?.prioridad_agenda ?? []

  // Sync date when preselectedDate changes
  useEffect(() => {
    if (preselectedDate) {
      setFecha(format(preselectedDate, "yyyy-MM-dd"))
    }
  }, [preselectedDate])

  // Reset form on open/close
  useEffect(() => {
    if (!isOpen) {
      const todayStr = format(new Date(), "yyyy-MM-dd")
      setTitulo("")
      setFecha(preselectedDate ? format(preselectedDate, "yyyy-MM-dd") : todayStr)
      setHoraInicio("09:00")
      setDuracion("60")
      setDescripcion("")
      setPlataforma("")
      setPrioridad("")
      setModalidad("")
      setSede("")
      setSelectedIds(currentUserId ? [currentUserId] : [])
      setError(null)
    }
  }, [isOpen, preselectedDate, currentUserId])

  const toggleUser = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) {
      setError("El título es obligatorio.")
      return
    }
    if (selectedIds.length === 0) {
      setError("Debes incluir al menos un participante.")
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await createEvent.mutateAsync({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        plataforma: plataforma || undefined,
        prioridad: prioridad || undefined,
        modalidad: modalidad || undefined,
        sede: modalidad === "presencial" ? (sede.trim() || undefined) : undefined,
        fecha,
        hora_inicio: horaInicio,
        duracion_minutos: parseInt(duracion, 10) || 60,
        participant_ids: selectedIds,
      })
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "Error al crear el evento. Intenta de nuevo."
      setError(msg)
      console.error("[ScheduleSheet] Error al crear evento:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />
      )}

      {/* Sheet */}
      <div
        className={`fixed top-0 right-0 h-full bg-background border-l border-border shadow-xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out w-full max-w-sm
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-base">Agendar evento</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Titulo */}
            <div className="space-y-1.5">
              <Label htmlFor="sch-titulo">Título *</Label>
              <Input
                id="sch-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Reunión de seguimiento"
                required
              />
            </div>

            {/* Fecha */}
            <div className="space-y-1.5">
              <Label htmlFor="sch-fecha">Fecha</Label>
              <Input
                id="sch-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            {/* Hora inicio */}
            <div className="space-y-1.5">
              <Label htmlFor="sch-hora">Hora de inicio</Label>
              <Input
                id="sch-hora"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>

            {/* Duración */}
            <div className="space-y-1.5">
              <Label htmlFor="sch-dur">Duración (minutos)</Label>
              <Input
                id="sch-dur"
                type="number"
                min="5"
                max="480"
                value={duracion}
                onChange={(e) => setDuracion(e.target.value)}
              />
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label htmlFor="sch-desc">Descripción (opcional)</Label>
              <textarea
                id="sch-desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Detalles del evento..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>

            {/* Modalidad */}
            <div className="space-y-1.5">
              <Label htmlFor="sch-modalidad">Modalidad</Label>
              <select
                id="sch-modalidad"
                value={modalidad}
                onChange={(e) => { setModalidad(e.target.value); if (e.target.value !== "presencial") setSede("") }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Sin especificar</option>
                <option value="virtual">Virtual</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>

            {/* Sede — solo si es presencial */}
            {modalidad === "presencial" && (
              <div className="space-y-1.5">
                <Label htmlFor="sch-sede">Sede</Label>
                <Input
                  id="sch-sede"
                  value={sede}
                  onChange={(e) => setSede(e.target.value)}
                  placeholder="Ej. Logimat 1, IMC Cargo..."
                />
              </div>
            )}

            {/* Plataforma */}
            <div className="space-y-1.5">
              <Label htmlFor="sch-plataforma">Plataforma (opcional)</Label>
              <select
                id="sch-plataforma"
                value={plataforma}
                onChange={(e) => setPlataforma(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todas las plataformas</option>
                {plataformas.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Prioridad */}
            {prioridadesAgenda.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="sch-prioridad">Prioridad (opcional)</Label>
                <select
                  id="sch-prioridad"
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Sin prioridad</option>
                  {prioridadesAgenda.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Participantes */}
            <div className="space-y-1.5">
              <Label>Participantes</Label>
              <Tabs defaultValue="equipo">
                <TabsList className="w-full">
                  <TabsTrigger value="equipo" className="flex-1">
                    Equipo ({teamMembers.length})
                  </TabsTrigger>
                  <TabsTrigger value="todos" className="flex-1">
                    Todos ({allUsers.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="equipo">
                  <UserPickerList
                    users={teamMembers.map((m: TaskTeamMember) => ({
                      id: m.user_id,
                      label: m.user_full_name ?? m.user_email,
                    }))}
                    selected={selectedIds}
                    onToggle={toggleUser}
                  />
                </TabsContent>

                <TabsContent value="todos">
                  <UserPickerList
                    users={allUsers.map((u: AvailableUser) => ({
                      id: u.id,
                      label: u.full_name ?? u.email,
                    }))}
                    selected={selectedIds}
                    onToggle={toggleUser}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border shrink-0">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Agendando..." : "Agendar evento"}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

interface UserPickerListProps {
  users: { id: number; label: string }[]
  selected: number[]
  onToggle: (id: number) => void
}

function UserPickerList({ users, selected, onToggle }: UserPickerListProps) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        Sin usuarios disponibles.
      </p>
    )
  }
  return (
    <div className="space-y-1 max-h-40 overflow-y-auto mt-2 rounded-md border border-border p-2">
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
          <span className="text-sm">{u.label}</span>
        </label>
      ))}
    </div>
  )
}

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useTeamMembers,
  useAvailableTeamUsers,
  useAddTeamMember,
  useRemoveTeamMember,
  usePromoteToCogestor,
  useDemoteToMember,
  useManagerTeamInfo,
  useUpdateTeamName,
} from "@/hooks/useWorkTasks"

function TeamMembersList({ canPromoteDemote }: { canPromoteDemote: boolean }) {
  const [selectedUserId, setSelectedUserId] = useState<string>("")

  const { data: members, isLoading: loadingMembers } = useTeamMembers()
  const { data: available, isLoading: loadingAvailable } = useAvailableTeamUsers()
  const addMember = useAddTeamMember()
  const removeMember = useRemoveTeamMember()
  const promote = usePromoteToCogestor()
  const demote = useDemoteToMember()

  const handleAdd = async () => {
    if (!selectedUserId) return
    await addMember.mutateAsync(Number(selectedUserId))
    setSelectedUserId("")
  }

  const handleRemove = async (userId: number) => {
    await removeMember.mutateAsync(userId)
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Add member */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Agregar miembro al equipo</p>
        {loadingAvailable ? (
          <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
        ) : (
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccionar usuario..." />
              </SelectTrigger>
              <SelectContent>
                {(available ?? []).map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAdd}
              disabled={!selectedUserId || addMember.isPending}
              size="sm"
            >
              {addMember.isPending ? "Agregando..." : "Agregar"}
            </Button>
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Miembros actuales</p>
        {loadingMembers ? (
          <p className="text-sm text-muted-foreground">Cargando miembros...</p>
        ) : !members || members.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin miembros en el equipo.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-2 bg-muted/30"
              >
                <div>
                  <span className="text-sm font-medium">
                    {m.user_full_name ?? m.user_email}
                  </span>
                  {m.user_full_name && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {m.user_email}
                    </span>
                  )}
                  {m.role === "co_gestor" && (
                    <span className="text-xs text-blue-600 ml-2 font-medium">Co-gestor</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canPromoteDemote && (
                    m.role === "member" ? (
                      <button
                        onClick={() => promote.mutate(m.user_id)}
                        disabled={promote.isPending}
                        className="text-xs text-blue-600 hover:text-blue-800"
                        title="Promover a co-gestor"
                      >
                        Promover
                      </button>
                    ) : (
                      <button
                        onClick={() => demote.mutate(m.user_id)}
                        disabled={demote.isPending}
                        className="text-xs text-gray-500 hover:text-gray-700"
                        title="Degradar a miembro"
                      >
                        Co-gestor ↓
                      </button>
                    )
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(m.user_id)}
                    disabled={removeMember.isPending}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function TeamNameEditor() {
  const { data: team, isLoading } = useManagerTeamInfo()
  const updateName = useUpdateTeamName()
  const [name, setName] = useState("")

  useEffect(() => {
    if (team?.name != null) setName(team.name)
  }, [team?.name])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === team?.name) return
    await updateName.mutateAsync(trimmed)
  }

  return (
    <div className="space-y-3 max-w-lg">
      <p className="text-sm font-medium text-foreground">Nombre del equipo</p>
      <p className="text-xs text-muted-foreground">
        Lo ven los colaboradores en el selector al dar de alta tareas.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="team-display-name" className="sr-only">
              Nombre del equipo
            </Label>
            <Input
              id="team-display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Desarrollo e Innovación"
              maxLength={150}
            />
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateName.isPending || !name.trim() || name.trim() === team?.name}
            size="sm"
          >
            {updateName.isPending ? "Guardando…" : "Guardar nombre"}
          </Button>
        </div>
      )}
    </div>
  )
}

export function TeamConfigTab({ canPromoteDemote = false }: { canPromoteDemote?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración del Equipo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-10">
        <TeamNameEditor />
        <TeamMembersList canPromoteDemote={canPromoteDemote} />
      </CardContent>
    </Card>
  )
}

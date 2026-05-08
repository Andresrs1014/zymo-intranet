import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function TeamConfigTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración del Equipo</CardTitle>
      </CardHeader>
      <CardContent>
        <TeamMembersList />
      </CardContent>
    </Card>
  )
}

// Inline team management without the dialog chrome
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useTeamMembers,
  useAvailableTeamUsers,
  useAddTeamMember,
  useRemoveTeamMember,
} from "@/hooks/useWorkTasks"

function TeamMembersList() {
  const [selectedUserId, setSelectedUserId] = useState<string>("")

  const { data: members, isLoading: loadingMembers } = useTeamMembers()
  const { data: available, isLoading: loadingAvailable } = useAvailableTeamUsers()
  const addMember = useAddTeamMember()
  const removeMember = useRemoveTeamMember()

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
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemove(m.user_id)}
                  disabled={removeMember.isPending}
                >
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

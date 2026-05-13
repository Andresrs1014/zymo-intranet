import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useTeamMembers,
  useAvailableTeamUsers,
  useAddTeamMember,
  useRemoveTeamMember,
  useTaskWorkspaceInfo,
  useUpdateWorkspaceName,
  usePatchMemberRole,
} from "@/hooks/useWorkTasks"

function TeamMembersList() {
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const { data: workspace } = useTaskWorkspaceInfo()

  const { data: members, isLoading: loadingMembers } = useTeamMembers()
  const { data: available, isLoading: loadingAvailable } = useAvailableTeamUsers()
  const addMember = useAddTeamMember()
  const removeMember = useRemoveTeamMember()
  const patchRole = usePatchMemberRole()

  const handleAdd = async () => {
    if (!selectedUserId) return
    await addMember.mutateAsync(Number(selectedUserId))
    setSelectedUserId("")
  }

  const handleRemove = async (userId: number) => {
    await removeMember.mutateAsync(userId)
  }

  const handleRoleChange = async (userId: number, role: "member" | "manager") => {
    await patchRole.mutateAsync({ user_id: userId, role })
  }

  return (
    <div className="space-y-6 max-w-lg">
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
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border px-4 py-2 bg-muted/30"
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
                <div className="flex items-center gap-2 shrink-0">
                  {workspace?.is_owner && m.user_id !== workspace.owner_user_id ? (
                    <Select
                      value={m.role === "manager" ? "manager" : "member"}
                      onValueChange={(v: string) =>
                        handleRoleChange(m.user_id, v as "member" | "manager")
                      }
                      disabled={patchRole.isPending}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Miembro</SelectItem>
                        <SelectItem value="manager">Co-gestor</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {m.role === "manager" ? "Co-gestor" : "Miembro"}
                    </span>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(m.user_id)}
                    disabled={removeMember.isPending}
                  >
                    Quitar del equipo
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

function WorkspaceNameField() {
  const { data: ws } = useTaskWorkspaceInfo()
  const updateName = useUpdateWorkspaceName()
  const [draft, setDraft] = useState("")

  useEffect(() => {
    if (ws?.name) setDraft(ws.name)
  }, [ws?.name])

  if (!ws?.is_owner) return null

  return (
    <div className="space-y-2 max-w-lg mb-6">
      <p className="text-sm font-medium text-foreground">Nombre del workspace</p>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nombre del equipo"
          maxLength={150}
        />
        <Button
          size="sm"
          onClick={() => updateName.mutate(draft.trim())}
          disabled={updateName.isPending || !draft.trim()}
        >
          {updateName.isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Solo el dueño del espacio puede cambiar el nombre. Los co-gestores gestionan miembros y tareas
        en el mismo workspace.
      </p>
    </div>
  )
}

export function TeamConfigTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración del Equipo</CardTitle>
      </CardHeader>
      <CardContent>
        <WorkspaceNameField />
        <TeamMembersList />
      </CardContent>
    </Card>
  )
}

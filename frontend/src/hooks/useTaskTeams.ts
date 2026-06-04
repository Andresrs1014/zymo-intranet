import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { taskApi } from "@/lib/taskApi"
import type { Team, TeamMember } from "@/types/task"

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useMyTeams() {
  return useQuery<Team[]>({
    queryKey: ["taskTeams", "my"],
    queryFn: async () => {
      const { data } = await taskApi.get<Team[]>("/api/teams/my-teams")
      return data
    },
    refetchOnWindowFocus: true,
  })
}

export function useManagedTeams() {
  return useQuery<Team[]>({
    queryKey: ["taskTeams", "managed"],
    queryFn: async () => {
      const { data } = await taskApi.get<Team[]>("/api/teams/managed")
      return data
    },
  })
}

export function useTeamMembers(teamId: number | null) {
  return useQuery<TeamMember[]>({
    queryKey: ["taskTeams", teamId, "members"],
    queryFn: async () => {
      const { data } = await taskApi.get<TeamMember[]>(`/api/teams/${teamId}/members`)
      return data
    },
    enabled: teamId !== null,
  })
}

export interface AvailableUser {
  id: number
  full_name: string | null
  email: string
}

export function useAvailableUsers(teamId: number | null) {
  return useQuery<AvailableUser[]>({
    queryKey: ["taskTeams", teamId, "available-users"],
    queryFn: async () => {
      const { data } = await taskApi.get<AvailableUser[]>(`/api/teams/${teamId}/available-users`)
      return data
    },
    enabled: teamId !== null,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (teamId: number) => {
      await taskApi.delete(`/api/teams/${teamId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskTeams"] })
    },
  })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await taskApi.post<Team>("/api/teams", { name })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskTeams"] })
    },
  })
}

export function useRenameTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ teamId, name }: { teamId: number; name: string }) => {
      const { data } = await taskApi.patch<{ id: number; name: string }>(`/api/teams/${teamId}`, { name })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskTeams"] })
    },
  })
}

export function useAddMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ teamId, userId, userNombre }: { teamId: number; userId: number; userNombre?: string }) => {
      const { data } = await taskApi.post<TeamMember>(`/api/teams/${teamId}/members`, { userId, userNombre })
      return data
    },
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: ["taskTeams", teamId, "members"] })
      qc.invalidateQueries({ queryKey: ["taskTeams", teamId, "available-users"] })
    },
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      await taskApi.delete(`/api/teams/${teamId}/members/${userId}`)
    },
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: ["taskTeams", teamId, "members"] })
    },
  })
}

export function usePromoteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      await taskApi.post(`/api/teams/${teamId}/members/${userId}/promote`)
    },
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: ["taskTeams", teamId, "members"] })
      qc.invalidateQueries({ queryKey: ["taskTeams", "my"] })
    },
  })
}

export function useDemoteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      await taskApi.post(`/api/teams/${teamId}/members/${userId}/demote`)
    },
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: ["taskTeams", teamId, "members"] })
      qc.invalidateQueries({ queryKey: ["taskTeams", "my"] })
    },
  })
}

export function useAllTeams() {
  return useQuery<Team[]>({
    queryKey: ["taskTeams", "all"],
    queryFn: async () => {
      const { data } = await taskApi.get<Team[]>("/api/teams")
      return data
    },
  })
}

export interface ArchivedTeam {
  id: number
  name: string
  ownerUserId: number
  updatedAt: string
}

export function useArchivedTeams() {
  return useQuery<ArchivedTeam[]>({
    queryKey: ["taskTeams", "archived"],
    queryFn: async () => {
      const { data } = await taskApi.get<ArchivedTeam[]>("/api/teams/archived")
      return data
    },
  })
}

export function useRestoreTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (teamId: number) => {
      await taskApi.post(`/api/teams/${teamId}/restore`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskTeams"] })
    },
  })
}

export function useHardDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (teamId: number) => {
      await taskApi.delete(`/api/teams/${teamId}/hard`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskTeams"] })
    },
  })
}

export function useUserTeams(userId: number | null) {
  return useQuery<{ ownedTeams: Team[]; memberTeams: Team[] }>({
    queryKey: ["taskTeams", "user", userId],
    queryFn: async () => {
      const { data } = await taskApi.get<{ ownedTeams: Team[]; memberTeams: Team[] }>(
        `/api/teams/user/${userId}`
      )
      return data
    },
    enabled: userId !== null,
  })
}

export function useAdminAssignOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, teamId, newTeamName }: { userId: number; teamId?: number; newTeamName?: string }) => {
      const { data } = await taskApi.post<{ success: boolean; teamId: number }>(
        "/api/teams/admin/assign-owner",
        { userId, teamId, newTeamName }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskTeams"] })
    },
  })
}

export function useAdminAssignMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, teamId }: { userId: number; teamId: number }) => {
      const { data } = await taskApi.post<{ success: boolean }>(
        "/api/teams/admin/assign-member",
        { userId, teamId }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskTeams"] })
    },
  })
}

export function useAdminRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, teamId }: { userId: number; teamId: number }) => {
      const { data } = await taskApi.post<{ success: boolean }>(
        "/api/teams/admin/remove-member",
        { userId, teamId }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskTeams"] })
    },
  })
}

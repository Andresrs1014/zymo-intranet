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

export function useAvailableUsers(teamId: number | null) {
  return useQuery<unknown[]>({
    queryKey: ["taskTeams", teamId, "available-users"],
    queryFn: async () => {
      const { data } = await taskApi.get<unknown[]>(`/api/teams/${teamId}/available-users`)
      return data
    },
    enabled: teamId !== null,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

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
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      const { data } = await taskApi.post<TeamMember>(`/api/teams/${teamId}/members`, { userId })
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
    },
  })
}

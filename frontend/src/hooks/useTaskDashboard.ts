import { useQuery } from "@tanstack/react-query"
import { taskApi } from "@/lib/taskApi"
import type { TeamKpis, PersonSummary, ChartData } from "@/types/task"

interface DateRange {
  desde?: string
  hasta?: string
}

function buildParams(teamId: number, range: DateRange) {
  const p = new URLSearchParams({ teamId: String(teamId) })
  if (range.desde) p.set("desde", range.desde)
  if (range.hasta) p.set("hasta", range.hasta)
  return p
}

export function useTeamKpis(teamId: number | null, range: DateRange = {}) {
  return useQuery<TeamKpis>({
    queryKey: ["taskDashboard", "team-kpis", teamId, range],
    queryFn: async () => {
      const { data } = await taskApi.get<TeamKpis>(
        `/api/dashboard/team-kpis?${buildParams(teamId!, range)}`,
      )
      return data
    },
    enabled: teamId !== null,
  })
}

export function usePersonSummaries(teamId: number | null, range: DateRange = {}) {
  return useQuery<PersonSummary[]>({
    queryKey: ["taskDashboard", "person-summaries", teamId, range],
    queryFn: async () => {
      const { data } = await taskApi.get<PersonSummary[]>(
        `/api/dashboard/person-summaries?${buildParams(teamId!, range)}`,
      )
      return data
    },
    enabled: teamId !== null,
  })
}

export function useCharts(teamId: number | null, range: DateRange = {}) {
  return useQuery<ChartData>({
    queryKey: ["taskDashboard", "charts", teamId, range],
    queryFn: async () => {
      const { data } = await taskApi.get<ChartData>(
        `/api/dashboard/charts?${buildParams(teamId!, range)}`,
      )
      return data
    },
    enabled: teamId !== null,
  })
}

export function useMembersWithoutEntryToday(teamId: number | null) {
  return useQuery<{ userId: number; nombre: string }[]>({
    queryKey: ["taskDashboard", "without-entry-today", teamId],
    queryFn: async () => {
      const { data } = await taskApi.get<{ userId: number; nombre: string }[]>(
        `/api/dashboard/without-entry-today?teamId=${teamId}`,
      )
      return data
    },
    enabled: teamId !== null,
    refetchInterval: 5 * 60 * 1000, // every 5 minutes
  })
}

export function useMyKpis(teamId: number | null, range: DateRange = {}) {
  return useQuery<{ total: number; horasTotales: number; pendientesAceptar: number; byEstado: Record<string, number> }>({
    queryKey: ["taskDashboard", "my-kpis", teamId, range],
    queryFn: async () => {
      const { data } = await taskApi.get(`/api/dashboard/my-kpis?${buildParams(teamId!, range)}`)
      return data
    },
    enabled: teamId !== null,
  })
}

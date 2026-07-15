import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zymoallyApi } from "@/lib/zymoallyApi"
import type {
  SacDashboardResult, SacRecordFilters, CreateVisitInput, VisitReport, SurveyMagicLinkResult,
} from "@/types/sac"
import type { TicketListItem } from "@/types/ticket"

interface SacConfigLists {
  visitOutcomes: TicketListItem[]
}

function buildParams(filters: SacRecordFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.type) params.set("type", filters.type)
  if (filters.status) params.set("status", filters.status)
  if (filters.search) params.set("search", filters.search)
  return params
}

export function useSacDashboard(filters: SacRecordFilters = {}) {
  return useQuery<SacDashboardResult>({
    queryKey: ["sac-dashboard", filters],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<SacDashboardResult>(`/api/sac/dashboard?${buildParams(filters)}`)
      return data
    },
  })
}

export function useCreateVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateVisitInput) => {
      const { data } = await zymoallyApi.post<VisitReport>("/api/sac/visits", input)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sac-dashboard"] })
    },
  })
}

export function useSacConfigLists() {
  return useQuery<SacConfigLists>({
    queryKey: ["sac-config-lists"],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<SacConfigLists>("/api/sac/config/listas")
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSendSurveyLink() {
  return useMutation({
    mutationFn: async (surveyType: "client" | "experience") => {
      const { data } = await zymoallyApi.post<SurveyMagicLinkResult>("/api/sac/surveys/magic-link", { surveyType })
      return data
    },
  })
}

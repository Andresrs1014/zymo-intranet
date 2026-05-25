import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { taskApi } from "@/lib/taskApi"
import type { ListsGrouped, ListConfig, ListType } from "@/types/task"

export function useTaskLists(teamId: number | null) {
  return useQuery<ListsGrouped>({
    queryKey: ["taskLists", teamId],
    queryFn: async () => {
      const { data } = await taskApi.get<ListsGrouped>(`/api/teams/${teamId}/lists`)
      return data
    },
    enabled: teamId !== null,
  })
}

export function useCreateListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      teamId,
      listType,
      value,
      label,
      color,
      sortOrder,
    }: {
      teamId: number
      listType: ListType
      value: string
      label: string
      color?: string
      sortOrder?: number
    }) => {
      const { data } = await taskApi.post<ListConfig>(`/api/teams/${teamId}/lists`, {
        listType,
        value,
        label,
        color,
        sortOrder,
      })
      return data
    },
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: ["taskLists", teamId] })
    },
  })
}

export function useUpdateListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      teamId,
      listType,
      value,
      label,
      color,
      sortOrder,
      isActive,
    }: {
      teamId: number
      listType: string
      value: string
      label?: string
      color?: string | null
      sortOrder?: number
      isActive?: boolean
    }) => {
      const { data } = await taskApi.patch<ListConfig>(
        `/api/teams/${teamId}/lists/${listType}/${value}`,
        { label, color, sortOrder, isActive },
      )
      return data
    },
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: ["taskLists", teamId] })
    },
  })
}

export function useSetSpecialFlag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      teamId,
      value,
      isFinal,
      isCanceled,
      isInitialAssignment,
    }: {
      teamId: number
      value: string
      isFinal?: boolean
      isCanceled?: boolean
      isInitialAssignment?: boolean
    }) => {
      const { data } = await taskApi.patch<ListConfig>(
        `/api/teams/${teamId}/lists/estado/${value}/special`,
        { isFinal, isCanceled, isInitialAssignment },
      )
      return data
    },
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: ["taskLists", teamId] })
    },
  })
}

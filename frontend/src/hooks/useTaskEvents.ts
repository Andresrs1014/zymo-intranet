import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { taskApi } from "@/lib/taskApi"
import type { TaskEvent } from "@/types/task"

export function useTaskEvents(teamId: number | null, fecha?: string) {
  return useQuery<TaskEvent[]>({
    queryKey: ["taskEvents", teamId, fecha],
    queryFn: async () => {
      const params = new URLSearchParams({ teamId: String(teamId) })
      if (fecha) params.set("fecha", fecha)
      const { data } = await taskApi.get<TaskEvent[]>(`/api/events?${params}`)
      return data
    },
    enabled: teamId !== null,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      teamId: number
      titulo: string
      descripcion?: string
      plataforma?: string
      prioridad?: string
      modalidad?: string
      sede?: string
      fecha: string
      horaInicio: string
      duracionMinutos?: number
      participantIds?: number[]
    }) => {
      const { data } = await taskApi.post<TaskEvent>("/api/events", input)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskEvents"] })
    },
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      eventId,
      input,
    }: {
      eventId: number
      input: {
        titulo?: string
        descripcion?: string | null
        horaInicio?: string
        duracionMinutos?: number
        plataforma?: string | null
        modalidad?: string | null
        sede?: string | null
      }
    }) => {
      const { data } = await taskApi.patch<TaskEvent>(`/api/events/${eventId}`, input)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskEvents"] })
    },
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: number) => {
      await taskApi.delete(`/api/events/${eventId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskEvents"] })
    },
  })
}

export function useConfirmAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: number) => {
      await taskApi.patch(`/api/events/${eventId}/confirm`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskEvents"] })
    },
  })
}

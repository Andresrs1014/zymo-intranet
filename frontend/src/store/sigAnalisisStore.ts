import { create } from "zustand"

export type AnalysisType = "coherencia" | "mejoras" | "proc-vs-inst" | "lightrag"
export type JobStatus   = "running" | "done" | "error"

export interface AnalysisJob {
  id:               string
  procedimientoId:  number
  procedureCodigo:  string
  procedureTitulo:  string
  type:             AnalysisType
  status:           JobStatus
  netvaultJobId?:   string
  result?:          unknown
  error?:           string
  startedAt:        number
  completedAt?:     number
}

interface SigAnalisisStore {
  jobs:            AnalysisJob[]
  addJob:          (job: Omit<AnalysisJob, "id" | "startedAt" | "status">) => string
  updateJob:       (id: string, updates: Partial<AnalysisJob>) => void
  clearCompleted:  () => void
  queueExpanded:   boolean
  setQueueExpanded:(v: boolean) => void
  queueVisible:    boolean
  setQueueVisible: (v: boolean) => void
}

export const useSigAnalisisStore = create<SigAnalisisStore>((set) => ({
  jobs: [],

  addJob: (job) => {
    const id = crypto.randomUUID()
    set((s) => ({
      jobs: [...s.jobs, { ...job, id, status: "running" as const, startedAt: Date.now() }],
      queueVisible: true,
      queueExpanded: true,
    }))
    return id
  },

  updateJob: (id, updates) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)) })),

  clearCompleted: () =>
    set((s) => ({ jobs: s.jobs.filter((j) => j.status === "running") })),

  queueExpanded:    false,
  setQueueExpanded: (v) => set({ queueExpanded: v }),
  queueVisible:     false,
  setQueueVisible:  (v) => set({ queueVisible: v }),
}))

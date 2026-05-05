import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AgentPanelState {
  docked: boolean
  setDocked: (value: boolean) => void
  toggleDocked: () => void
}

export const useAgentPanelStore = create<AgentPanelState>()(
  persist(
    (set) => ({
      docked: false,
      setDocked: (docked) => set({ docked }),
      toggleDocked: () => set((s) => ({ docked: !s.docked })),
    }),
    { name: "zymo_agent_panel" }
  )
)

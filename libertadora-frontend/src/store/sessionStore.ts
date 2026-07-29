import { create } from "zustand"
import { persist } from "zustand/middleware"

// Sesión única — staff y Skandia comparten el mismo tipo de cuenta
// (LibertadoraUser, scope=libertadora_session). isAdmin distingue permisos.
interface SessionState {
  token: string | null
  nombre: string | null
  email: string | null
  isAdmin: boolean
  setSession: (data: { token: string; nombre: string | null; email: string; isAdmin: boolean }) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      nombre: null,
      email: null,
      isAdmin: false,
      setSession: ({ token, nombre, email, isAdmin }) => set({ token, nombre, email, isAdmin }),
      clearSession: () => set({ token: null, nombre: null, email: null, isAdmin: false }),
    }),
    { name: "libertadora-session" }
  )
)

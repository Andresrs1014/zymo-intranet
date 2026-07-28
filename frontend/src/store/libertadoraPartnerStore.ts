import { create } from "zustand"
import { persist } from "zustand/middleware"

// Sesión del socio externo (Skandia) — deliberadamente separada de useAuthStore,
// nunca es un usuario de la intranet. Token con scope=libertadora_partner.
interface LibertadoraPartnerState {
  token: string | null
  nombre: string | null
  email: string | null
  setSession: (data: { token: string; nombre: string | null; email: string }) => void
  clearSession: () => void
}

export const useLibertadoraPartnerStore = create<LibertadoraPartnerState>()(
  persist(
    (set) => ({
      token: null,
      nombre: null,
      email: null,
      setSession: ({ token, nombre, email }) => set({ token, nombre, email }),
      clearSession: () => set({ token: null, nombre: null, email: null }),
    }),
    { name: "libertadora-partner-session" }
  )
)

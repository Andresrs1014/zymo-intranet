import axios from "axios"
import { useSessionStore } from "@/store/sessionStore"

export const libertadoraApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3006",
})

libertadoraApi.interceptors.request.use((config) => {
  const token = useSessionStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

libertadoraApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    // Token vencido o revocado a mitad de uso — cerrar sesión local en vez de
    // dejar que cada request siguiente vuelva a fallar en silencio.
    if (status === 401) {
      useSessionStore.getState().clearSession()
    }
    return Promise.reject(error)
  }
)

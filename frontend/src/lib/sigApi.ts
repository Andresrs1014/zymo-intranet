import axios from "axios"
import { useAuthStore } from "@/store/authStore"

// sig-backend en puerto 3003 (o /sig-api/ via nginx en producción)
export const sigApi = axios.create({
  baseURL: import.meta.env.VITE_SIG_API_URL ?? "http://localhost:3003",
})

sigApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Zod responde 422 con `error: { formErrors, fieldErrors }`; las pantallas pintan `error` como texto y un objeto tumba React (#31). */
function textoDeError(e: unknown): string {
  if (typeof e === "string") return e
  const { formErrors = [], fieldErrors = {} } = (e ?? {}) as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> }
  const campos = Object.entries(fieldErrors).flatMap(([campo, msgs]) => (msgs ?? []).map((m) => `${campo}: ${m}`))
  return [...formErrors, ...campos].join("; ") || "Los datos enviados no son válidos."
}

sigApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data
    if (data && typeof data.error === "object" && data.error !== null) data.error = textoDeError(data.error)
    return Promise.reject(error)
  },
)

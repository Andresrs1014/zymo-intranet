import axios from "axios"
import { useAuthStore } from "@/store/authStore"

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8001",
})

/**
 * Construye una URL absoluta al backend para usos fuera de axios
 * (por ejemplo: <img src>, window.open, href directos).
 *
 * - `path` debe comenzar siempre con "/" (p.ej. "/api/oc/...").
 * - Normaliza el join para que nunca quede doble-slash ni slash faltante.
 * - Si `baseURL` está vacío (mismo origen), retorna el path tal cual.
 */
export function absoluteApiUrl(path: string): string {
  const base = api.defaults.baseURL
  if (!base) return path
  const normalizedBase = String(base).replace(/\/$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

// Adjunta el token en cada request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Si el backend devuelve 401, limpiar sesión y redirigir a login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

/**
 * GET binario con el mismo Bearer que axios; abre el blob en una pestaña nueva.
 * `window.open` a una URL del API no adjunta Authorization — por eso 401 en PDFs/OC.
 */
export async function openAuthenticatedApiBlob(apiPath: string): Promise<void> {
  const { data } = await api.get(apiPath, { responseType: "blob" })
  const url = URL.createObjectURL(data as Blob)
  const win = window.open(url, "_blank", "noopener,noreferrer")
  if (!win) {
    URL.revokeObjectURL(url)
    return
  }
  // Revocar tras un margen para no romper la carga del visor PDF en la pestaña nueva
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
}

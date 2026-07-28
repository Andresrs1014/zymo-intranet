import axios from "axios"
import { useAuthStore } from "@/store/authStore"
import { useLibertadoraPartnerStore } from "@/store/libertadoraPartnerStore"

// libertadora-backend corre en el puerto 3006 (o /libertadora-api en producción).
// Un solo cliente para ambos mundos: las rutas /public/... (socio externo
// Skandia) usan el token de LibertadoraPartnerStore; el resto (/api/...,
// staff interno) usa el JWT normal de la intranet — se decide por el path,
// no por quién esté logueado en cada momento.
export const libertadoraApi = axios.create({
  baseURL: import.meta.env.VITE_LIBERTADORA_API_URL ?? "http://localhost:3006",
})

libertadoraApi.interceptors.request.use((config) => {
  const isPublicRoute = config.url?.startsWith("/public/")
  const token = isPublicRoute
    ? useLibertadoraPartnerStore.getState().token
    : useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

libertadoraApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string | undefined = error?.config?.url
    const status = error?.response?.status
    // Sesión del socio revocada o expirada a mitad de uso — cerrar sesión local
    // en vez de dejar que cada request siguiente vuelva a fallar en silencio.
    if (url?.startsWith("/public/") && (status === 401 || status === 403)) {
      useLibertadoraPartnerStore.getState().clearSession()
    }
    return Promise.reject(error)
  }
)

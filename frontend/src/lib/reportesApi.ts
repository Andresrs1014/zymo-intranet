import axios from "axios"
import { useAuthStore } from "@/store/authStore"

// sig-backend expone los reportes bajo /api/reportes-desarrollo.
// Mismo cliente que el resto del módulo SIG — base URL /sig-api/ via nginx o
// http://localhost:3003 en dev.
export const reportesApi = axios.create({
  baseURL: import.meta.env.VITE_SIG_API_URL ?? "http://localhost:3003",
})

reportesApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

reportesApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ReporteDesarrollo {
  id: number
  titulo: string
  descripcion: string | null
  proyecto: string
  contenidoMd: string
  porcentajeAvance: number
  tiempoEstimadoHoras: number | null
  tiempoRealHoras: number | null
  fechaReporte: string
  autorId: number
  autorNombre: string
  archivoOriginal: string | null
  nombreArchivo: string | null
  tipoMime: string | null
  createdAt: string
  updatedAt: string
}

export interface ReporteFormData {
  titulo: string
  descripcion?: string
  proyecto: string
  contenidoMd?: string
  porcentajeAvance: number
  tiempoEstimadoHoras?: number
  tiempoRealHoras?: number
  fechaReporte?: string
  /** Archivo .md a subir. Si se envía, se ignora contenidoMd. */
  archivo?: File
}

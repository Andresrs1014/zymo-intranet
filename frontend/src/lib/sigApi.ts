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

sigApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)

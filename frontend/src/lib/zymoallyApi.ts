import axios from "axios"
import { useAuthStore } from "@/store/authStore"

// zymoally-backend corre en el puerto 3005 (o /zymoally-api en producción)
export const zymoallyApi = axios.create({
  baseURL: import.meta.env.VITE_ZYMOALLY_API_URL ?? "http://localhost:3005",
})

zymoallyApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

zymoallyApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)

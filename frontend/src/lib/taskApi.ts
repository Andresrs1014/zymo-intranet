import axios from "axios"
import { useAuthStore } from "@/store/authStore"

// task-backend runs on port 3002 (or VITE_TASK_API_URL in production)
export const taskApi = axios.create({
  baseURL: import.meta.env.VITE_TASK_API_URL ?? "http://localhost:3002",
})

taskApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

taskApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)

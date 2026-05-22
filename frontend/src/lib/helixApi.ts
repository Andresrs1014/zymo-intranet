import axios from "axios"
import { useAuthStore } from "@/store/authStore"

// helix-backend runs on port 3001 (or VITE_HELIX_API_URL in production)
export const helixApi = axios.create({
  baseURL: import.meta.env.VITE_HELIX_API_URL ?? "http://localhost:3001",
})

// Attach the same JWT from the intranet auth store
helixApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear auth and redirect to login (same as main api.ts)
helixApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

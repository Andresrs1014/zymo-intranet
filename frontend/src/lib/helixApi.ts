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

// On 401 from helix-backend, do NOT log out from the intranet.
// Just reject so the component can show an error message.
helixApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
)

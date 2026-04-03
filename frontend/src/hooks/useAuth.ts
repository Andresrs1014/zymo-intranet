import { useMutation, useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@/store/authStore"
import { api } from "@/lib/api"
import type { TokenResponse, User } from "@/types/auth"

// ── Login ─────────────────────────────────────────────────────────────────────

interface LoginCredentials {
  email: string
  password: string
}

async function loginRequest(credentials: LoginCredentials): Promise<TokenResponse> {
  const form = new URLSearchParams()
  form.set("username", credentials.email)
  form.set("password", credentials.password)
  const { data } = await api.post<TokenResponse>("/auth/token", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })
  return data
}

async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>("/auth/me")
  return data
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: async (tokenData) => {
      // Guardamos el token primero para que el interceptor lo adjunte en /me
      useAuthStore.setState({ token: tokenData.access_token })
      const user = await fetchMe()
      setAuth(user, tokenData.access_token)
    },
  })
}

// ── Usuario actual ─────────────────────────────────────────────────────────────

export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const updateUser = useAuthStore((s) => s.updateUser)

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const user = await fetchMe()
      updateUser(user)
      return user
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,  // 5 minutos
  })
}

// ── Logout ─────────────────────────────────────────────────────────────────────

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  return () => {
    clearAuth()
    window.location.href = "/login"
  }
}

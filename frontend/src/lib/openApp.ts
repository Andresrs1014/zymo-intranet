import type { AppDefinition } from "@/lib/roles"

/** Abre una app externa en pestaña nueva; si tiene sso_endpoint entra ya autenticada. */
export async function openExternalApp(app: AppDefinition, token: string | null): Promise<void> {
  if (!app.url) return

  if (app.sso_endpoint && token) {
    try {
      // VITE_API_URL="" en producción (mismo origen: nginx enruta /auth al backend); sin definir (dev) usa :8001 como el resto del código
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8001"}${app.sso_endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const { sso_token } = await res.json()
        window.open(`${app.url.replace(/\/$/, "")}/?sso_token=${sso_token}`, "_blank", "noopener,noreferrer")
        return
      }
    } catch {
      // si falla el SSO, abre igual sin token
    }
  }

  window.open(app.url, "_blank", "noopener,noreferrer")
}

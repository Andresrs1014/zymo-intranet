import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import type { MobileOut } from "@/types/mantenimiento"

const API = "/api/mantenimiento"

type Accion = "en_camino" | "completado" | "necesita_repuesto"

interface Props {
  mode: "jwt" | "stable"
}

export default function MantenimientoMobilePage({ mode }: Props) {
  const { token, accessToken } = useParams<{ token?: string; accessToken?: string }>()
  const mobileToken = mode === "stable" ? accessToken : token
  const [sol, setSol]       = useState<MobileOut | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [ok, setOk]         = useState(false)
  const [busy, setBusy]     = useState(false)

  useEffect(() => {
    if (!mobileToken) return
    fetch(`${API}/m/${mobileToken}`)
      .then(r => {
        if (!r.ok) throw new Error("Enlace inválido o expirado")
        return r.json()
      })
      .then(setSol)
      .catch((e: Error) => setError(e.message))
  }, [mobileToken])

  async function ejecutar(acc: Accion, extra?: { evidencia_url?: string; monto_real?: number }) {
    if (!mobileToken) return
    setBusy(true)
    try {
      const res = await fetch(`${API}/m/${mobileToken}/accion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: acc, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error al registrar acción")
      setOk(true)
      setAccion(acc)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setBusy(false)
    }
  }

  function completarConFoto() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.setAttribute("capture", "environment")
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        ejecutar("completado", { evidencia_url: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <p style={{ color: "#ef4444", fontSize: 18, marginBottom: 8 }}>⚠ {error}</p>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            El enlace puede haber expirado o la solicitud está cerrada. Solicita uno nuevo al equipo administrativo.
          </p>
        </div>
      </div>
    )
  }

  if (!sol) {
    return (
      <div style={{ ...styles.container, justifyContent: "center", alignItems: "center", display: "flex" }}>
        <p style={{ color: "#64748b" }}>Cargando...</p>
      </div>
    )
  }

  if (ok) {
    const mensajes: Record<string, string> = {
      en_camino:         "¡En camino registrado!",
      completado:        "¡Trabajo completado!",
      necesita_repuesto: "¡Notificación enviada!",
    }
    return (
      <div style={{ ...styles.container, justifyContent: "center", alignItems: "center", display: "flex", flexDirection: "column", textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: "#22c55e", fontSize: 22, marginBottom: 8 }}>
          {accion ? mensajes[accion] : "¡Registrado!"}
        </h2>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          El sistema actualizó el estado automáticamente.
        </p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={{ color: "#64748b", fontSize: 12, margin: 0, fontFamily: "'DM Mono', monospace" }}>
          {sol.consecutivo}
        </p>
        <h1 style={{ fontSize: 20, margin: "8px 0", color: "#f1f5f9", fontWeight: 700 }}>
          {sol.titulo}
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>{sol.descripcion}</p>
        {sol.solicitante_nombre && (
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 12, margin: "12px 0 0" }}>
            Solicitó: <strong style={{ color: "#94a3b8" }}>{sol.solicitante_nombre}</strong>
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <button
          onClick={() => ejecutar("en_camino")}
          disabled={busy}
          style={btnStyle("#2563eb")}
        >
          ▶ VOY EN CAMINO
        </button>

        <button
          onClick={completarConFoto}
          disabled={busy}
          style={btnStyle("#16a34a")}
        >
          ✓ TERMINÉ — SUBIR FOTO
        </button>

        <button
          onClick={() => ejecutar("necesita_repuesto")}
          disabled={busy}
          style={btnStyle("#d97706")}
        >
          🛒 NECESITO REPUESTO
        </button>
      </div>

      {busy && (
        <p style={{ textAlign: "center", color: "#64748b", marginTop: 24, fontSize: 14 }}>
          Registrando...
        </p>
      )}

      <p style={{ color: "#334155", fontSize: 11, textAlign: "center", marginTop: 32 }}>
        ZYMO Intranet — Mantenimiento
      </p>
    </div>
  )
}

const styles = {
  container: {
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: 480,
    margin: "0 auto",
    padding: 24,
    background: "#0f172a",
    minHeight: "100vh",
    color: "#f1f5f9",
    boxSizing: "border-box" as const,
  },
  card: {
    background: "#1e293b",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "20px 24px",
    fontSize: 17,
    fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    width: "100%",
    letterSpacing: "0.3px",
    opacity: 1,
  }
}

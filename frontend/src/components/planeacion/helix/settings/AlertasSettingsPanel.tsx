import { useHelixAlertas } from "@/hooks/useHelixAlertas"
import { helixApi } from "@/lib/helixApi"
import { showHelixToast } from "../HelixToast"

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const CANAL_COLOR: Record<string, { bg: string; text: string }> = {
  auto:      { bg: "rgba(99,102,241,0.12)",  text: "#818cf8" },
  whatsapp:  { bg: "rgba(34,197,94,0.12)",   text: "#22c55e" },
  email:     { bg: "rgba(59,130,246,0.12)",  text: "#60a5fa" },
}

export function AlertasSettingsPanel() {
  const { data, loading, error, refetch } = useHelixAlertas()

  const autoAlertas = data?.filter((a) => a.canal === "auto") ?? []
  const updateAlertas = data?.filter((a) => a.canal !== "auto") ?? []

  async function handleGenerarAuto() {
    try {
      await helixApi.post("/api/alertas")
      showHelixToast("Alertas automáticas generadas", "success")
      refetch()
    } catch {
      showHelixToast("Error al generar alertas", "error")
    }
  }

  function handleLimpiar() {
    // The API doesn't have a delete endpoint; show informational toast
    showHelixToast("Las alertas se limpian automáticamente tras 30 registros", "info")
  }

  if (loading) return <p style={{ padding: 20, color: "var(--helix-muted)", fontSize: "0.875rem" }}>Cargando alertas…</p>
  if (error)   return <p style={{ padding: 20, color: "var(--helix-danger, #ef4444)", fontSize: "0.875rem" }}>{error}</p>

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Auto alerts */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--helix-ink)" }}>
              Alertas automáticas
            </h3>
            <span style={{ fontSize: "0.78rem", color: "var(--helix-muted)" }}>
              {autoAlertas.length} activa(s)
            </span>
          </div>
          <button
            type="button"
            onClick={handleGenerarAuto}
            style={{
              padding: "7px 14px",
              borderRadius: 7,
              border: "none",
              background: "var(--helix-accent)",
              color: "#fff",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Generar ahora
          </button>
        </div>

        {autoAlertas.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--helix-muted)", fontStyle: "italic" }}>
            No hay alertas automáticas activas.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {autoAlertas.map((a) => (
              <AlertCard key={a.id} alerta={a} />
            ))}
          </div>
        )}
      </section>

      {/* Update alerts */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--helix-ink)" }}>
              Alertas de actualizaciones
            </h3>
            <span style={{ fontSize: "0.78rem", color: "var(--helix-muted)" }}>
              {updateAlertas.length} pendiente(s)
            </span>
          </div>
          <button
            type="button"
            onClick={handleLimpiar}
            style={{
              padding: "7px 14px",
              borderRadius: 7,
              border: "1px solid var(--helix-border)",
              background: "var(--helix-surface)",
              color: "var(--helix-muted)",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Limpiar alertas enviadas
          </button>
        </div>

        {updateAlertas.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--helix-muted)", fontStyle: "italic" }}>
            No hay alertas de actualización pendientes.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {updateAlertas.map((a) => (
              <AlertCard key={a.id} alerta={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AlertCard({ alerta }: { alerta: ReturnType<typeof useHelixAlertas>["data"] extends Array<infer T> ? T : never }) {
  const canal = alerta.canal ?? "auto"
  const colors = CANAL_COLOR[canal] ?? { bg: "rgba(255,255,255,0.05)", text: "var(--helix-muted)" }

  return (
    <article
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 8,
        background: "var(--helix-surface)",
        border: "1px solid var(--helix-border)",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          padding: "2px 9px",
          borderRadius: 4,
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          background: colors.bg,
          color: colors.text,
          textTransform: "uppercase",
        }}
      >
        {canal}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--helix-ink)" }}>
          {alerta.cambio}
        </p>
        {alerta.actividadNombre && (
          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--helix-muted)" }}>
            {alerta.actividadNombre}{alerta.subproyectoNombre ? ` — ${alerta.subproyectoNombre}` : ""}
          </p>
        )}
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--helix-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
        {formatDate(alerta.createdAt)}
      </span>
    </article>
  )
}

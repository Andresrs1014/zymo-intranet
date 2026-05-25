import { useState } from "react"
import { useHelixActividades } from "@/hooks/useHelixActividades"
import { TaskDialog } from "../dialogs/TaskDialog"
import { showHelixToast } from "../HelixToast"
import type { HelixActividad } from "@/types/helix"

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
}

function formatCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
}

const ESTADO_COLORS: Record<string, string> = {
  Backlog: "#9ca3af",
  Planificado: "#60a5fa",
  "En curso": "#f59e0b",
  Revision: "#a78bfa",
  Terminado: "#22c55e",
}

const TH: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--helix-muted)",
  borderBottom: "1px solid var(--helix-border)",
  whiteSpace: "nowrap",
  background: "var(--helix-bg, #f8fafc)",
}

const TD: React.CSSProperties = {
  padding: "11px 14px",
  fontSize: "0.83rem",
  color: "var(--helix-ink)",
  borderBottom: "1px solid var(--helix-border)",
  verticalAlign: "middle",
}

export function ActividadesRegistryPanel() {
  const { actividades, loading, error, refetch, createActividad, updateActividad } = useHelixActividades()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HelixActividad | undefined>()

  if (loading) return <p style={{ padding: 20, color: "var(--helix-muted)", fontSize: "0.875rem" }}>Cargando actividades…</p>
  if (error)   return <p style={{ padding: 20, color: "var(--helix-danger, #ef4444)", fontSize: "0.875rem" }}>{error}</p>

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--helix-ink)" }}>
          Registros de actividades
          <span style={{ marginLeft: 8, fontSize: "0.78rem", fontWeight: 400, color: "var(--helix-muted)" }}>
            ({actividades.length})
          </span>
        </h3>
        <button
          type="button"
          onClick={() => { setEditing(undefined); setDialogOpen(true) }}
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
          Nueva actividad
        </button>
      </div>

      {actividades.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--helix-muted)", fontStyle: "italic" }}>
          No hay actividades registradas.
        </p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--helix-border)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
            <thead>
              <tr>
                {["Actividad", "Subproyecto", "Responsable", "Estado", "Fin", "Costos totales", "Ejecución", "Acciones"].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actividades.map((a) => {
                const total = a.costoInversion + a.costoOptimizacion + a.costoEjecucion
                const execRate = total > 0 ? Math.round((a.costoEjecucion / total) * 100) : 0
                const estadoColor = ESTADO_COLORS[a.estado] ?? "#9ca3af"

                return (
                  <tr key={a.id} style={{ transition: "background 120ms" }}>
                    <td style={{ ...TD, fontWeight: 600, maxWidth: 200 }}>
                      <span title={a.nombre} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.nombre}
                      </span>
                    </td>
                    <td style={{ ...TD, color: "var(--helix-muted)" }}>{a.subproyectoId}</td>
                    <td style={TD}>{a.responsableNombre}</td>
                    <td style={TD}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 9px",
                        borderRadius: 12,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        background: estadoColor + "22",
                        color: estadoColor,
                        border: `1px solid ${estadoColor}44`,
                        whiteSpace: "nowrap",
                      }}>
                        {a.estado}
                      </span>
                    </td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>{formatDate(a.fechaFin)}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>{formatCOP(total)}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>
                      {formatCOP(a.costoEjecucion)} ({execRate}%)
                    </td>
                    <td style={TD}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => { setEditing(a); setDialogOpen(true) }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 5,
                            border: "1px solid var(--helix-border)",
                            background: "var(--helix-surface)",
                            color: "var(--helix-ink)",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(undefined) }}
        actividad={editing}
        onSaved={() => {
          refetch()
          showHelixToast("Actividad guardada", "success")
        }}
        createActividad={createActividad}
        updateActividad={updateActividad}
      />
    </div>
  )
}

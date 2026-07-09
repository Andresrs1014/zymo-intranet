import { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts"
import { useTask } from "@/context/TaskContext"
import {
  useTeamKpis,
  usePersonSummaries,
  useCharts,
  useMembersWithoutEntryToday,
} from "@/hooks/useTaskDashboard"

const CHART_COLORS = ["#ef3340", "#00a8c8", "#10b981", "#f59e0b", "#0284c7", "#ff6b75"]

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: "#1b2029",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.10)",
      padding: "18px 20px",
    }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#71717a", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#f4f4f5", fontFamily: "'DM Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{sub}</div>}
    </div>
  )
}

export function DashboardView() {
  const { activeTeamId } = useTask()
  const [range, setRange] = useState<{ desde?: string; hasta?: string }>({})

  const { data: kpis } = useTeamKpis(activeTeamId, range)
  const { data: persons = [] } = usePersonSummaries(activeTeamId, range)
  const { data: charts } = useCharts(activeTeamId, range)
  const { data: noEntry = [] } = useMembersWithoutEntryToday(activeTeamId)

  if (!activeTeamId) {
    return <div style={{ textAlign: "center", padding: 60, color: "#a1a1aa" }}>Selecciona un equipo.</div>
  }

  const INPUT_STYLE = { padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.10)", fontSize: 12 }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Date range filter */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#a1a1aa" }}>Rango:</span>
        <input type="date" value={range.desde ?? ""} onChange={(e) => setRange((r) => ({ ...r, desde: e.target.value || undefined }))} style={INPUT_STYLE} />
        <span style={{ fontSize: 12, color: "#71717a" }}>—</span>
        <input type="date" value={range.hasta ?? ""} onChange={(e) => setRange((r) => ({ ...r, hasta: e.target.value || undefined }))} style={INPUT_STYLE} />
      </div>

      {/* No-entry alert */}
      {noEntry.length > 0 && (
        <div style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.40)", borderRadius: 8, padding: "12px 16px", fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: noEntry.length > 0 ? 6 : 0 }}>
            <span style={{ fontSize: 16 }}>⚠</span>
            <span><strong>{noEntry.length} miembro{noEntry.length > 1 ? "s" : ""}</strong> sin registro de tarea hoy:</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 26 }}>
            {noEntry.map((m) => (
              <span key={m.userId} style={{ padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "rgba(245,158,11,0.16)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.35)" }}>
                {m.nombre || `Usuario ${m.userId}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      {kpis && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
          <KpiCard label="Total tareas" value={kpis.total} />
          <KpiCard label="Completadas" value={kpis.completadas} sub={kpis.total > 0 ? `${Math.round(kpis.completadas / kpis.total * 100)}%` : undefined} />
          <KpiCard label="En progreso" value={kpis.enProgreso} />
          <KpiCard label="Horas totales" value={kpis.horasTotales} />
          <KpiCard label="Usuarios activos" value={kpis.usuariosActivos} />
          <KpiCard label="Prom. min/tarea" value={kpis.promedioMinutosPorTarea} />
        </div>
      )}

      {/* Charts */}
      {charts && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* By responsable */}
          <div style={{ background: "#1b2029", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#f4f4f5" }}>Por responsable</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts.byResponsable}>
                <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={{ background: "#1b2029", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#f4f4f5" }} labelStyle={{ color: "#a1a1aa" }} itemStyle={{ color: "#f4f4f5" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="count" fill="#ef3340" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By estado (pie) */}
          <div style={{ background: "#1b2029", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#f4f4f5" }}>Por estado</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={charts.byEstado} dataKey="count" nameKey="estado" outerRadius={80} label>
                  {charts.byEstado.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1b2029", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#f4f4f5" }} labelStyle={{ color: "#a1a1aa" }} itemStyle={{ color: "#f4f4f5" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Hours per day */}
          <div style={{ background: "#1b2029", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#f4f4f5" }}>Horas por día</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={charts.horasPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                <XAxis dataKey="fecha" tick={{ fontSize: 9, fill: "#a1a1aa" }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={{ background: "#1b2029", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#f4f4f5" }} labelStyle={{ color: "#a1a1aa" }} itemStyle={{ color: "#f4f4f5" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Line type="monotone" dataKey="horas" stroke="#ef3340" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* By etiqueta */}
          <div style={{ background: "#1b2029", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#f4f4f5" }}>Por etiqueta</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts.byEtiqueta} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis dataKey="etiqueta" type="category" tick={{ fontSize: 10, fill: "#a1a1aa" }} width={80} />
                <Tooltip contentStyle={{ background: "#1b2029", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#f4f4f5" }} labelStyle={{ color: "#a1a1aa" }} itemStyle={{ color: "#f4f4f5" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="count" fill="#00a8c8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Person summaries */}
      {persons.length > 0 && (
        <div>
          <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#f4f4f5" }}>Resumen por persona</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {persons.map((p) => (
              <div key={p.userId} style={{ background: "#1b2029", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#ef3340",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {p.nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#f4f4f5" }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: "#a1a1aa", fontFamily: "'DM Mono', monospace" }}>{p.total} tareas · {p.horasTotal}h</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {Object.entries(p.byEstado).map(([estado, count]) => (
                    <div
                      key={estado}
                      title={`${estado}: ${count}`}
                      style={{
                        flex: count,
                        height: 6,
                        borderRadius: 3,
                        background: "#ef3340",
                        opacity: 0.6 + (count / p.total) * 0.4,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

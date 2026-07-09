import { useState, useEffect, useRef } from "react"
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

const CHART_COLORS = ["#c41e3a", "#0891b2", "#059669", "#d97706", "#0284c7", "#db2777"]

const TOOLTIP_STYLE = { background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 8, color: "#18181b" }
const AXIS_TICK = { fontSize: 10, fill: "#71717a" }

// Cuenta desde el valor anterior hasta el nuevo en ~500ms — feedback de que el KPI cambió.
function useCountUp(target: number, durationMs = 500): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    const start = performance.now()
    let frame: number
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setDisplay(Math.round(from + (target - from) * t))
      if (t < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return display
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  const animated = useCountUp(typeof value === "number" ? value : 0)
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{label}</div>
      <div className="font-mono text-[28px] font-extrabold text-zinc-900">
        {typeof value === "number" ? animated : value}
      </div>
      {sub && <div className="mt-1 font-mono text-xs text-zinc-500">{sub}</div>}
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
    return <div className="p-16 text-center text-zinc-500">Selecciona un equipo.</div>
  }

  const dateInput = "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-primary"

  return (
    <div className="flex flex-col gap-6">
      {/* Date range filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Rango:</span>
        <input type="date" value={range.desde ?? ""} onChange={(e) => setRange((r) => ({ ...r, desde: e.target.value || undefined }))} className={dateInput} />
        <span className="text-xs text-zinc-400">—</span>
        <input type="date" value={range.hasta ?? ""} onChange={(e) => setRange((r) => ({ ...r, hasta: e.target.value || undefined }))} className={dateInput} />
      </div>

      {/* No-entry alert */}
      {noEntry.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="text-base">⚠</span>
            <span><strong>{noEntry.length} miembro{noEntry.length > 1 ? "s" : ""}</strong> sin registro de tarea hoy:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-[26px]">
            {noEntry.map((m) => (
              <span key={m.userId} className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                {m.nombre || `Usuario ${m.userId}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      {kpis && (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
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
        <div className="grid grid-cols-2 gap-5">
          {/* By responsable */}
          <div className="rounded-lg border border-zinc-200 bg-white p-[18px] shadow-sm">
            <h3 className="mb-3.5 text-[13px] font-bold text-zinc-900">Por responsable</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts.byResponsable}>
                <XAxis dataKey="nombre" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#71717a" }} itemStyle={{ color: "#18181b" }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="count" fill="#c41e3a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By estado (pie) */}
          <div className="rounded-lg border border-zinc-200 bg-white p-[18px] shadow-sm">
            <h3 className="mb-3.5 text-[13px] font-bold text-zinc-900">Por estado</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={charts.byEstado} dataKey="count" nameKey="estado" outerRadius={80} label>
                  {charts.byEstado.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#71717a" }} itemStyle={{ color: "#18181b" }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Hours per day */}
          <div className="rounded-lg border border-zinc-200 bg-white p-[18px] shadow-sm">
            <h3 className="mb-3.5 text-[13px] font-bold text-zinc-900">Horas por día</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={charts.horasPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="fecha" tick={{ fontSize: 9, fill: "#71717a" }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#71717a" }} itemStyle={{ color: "#18181b" }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Line type="monotone" dataKey="horas" stroke="#c41e3a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* By etiqueta */}
          <div className="rounded-lg border border-zinc-200 bg-white p-[18px] shadow-sm">
            <h3 className="mb-3.5 text-[13px] font-bold text-zinc-900">Por etiqueta</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts.byEtiqueta} layout="vertical">
                <XAxis type="number" tick={AXIS_TICK} />
                <YAxis dataKey="etiqueta" type="category" tick={AXIS_TICK} width={80} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#71717a" }} itemStyle={{ color: "#18181b" }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="count" fill="#0891b2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Person summaries */}
      {persons.length > 0 && (
        <div>
          <h2 className="mb-3.5 text-[15px] font-bold text-zinc-900">Resumen por persona</h2>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {persons.map((p) => (
              <div key={p.userId} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                    {p.nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-zinc-900">{p.nombre}</div>
                    <div className="font-mono text-[11px] text-zinc-500">{p.total} tareas · {p.horasTotal}h</div>
                  </div>
                </div>
                <div className="flex gap-[3px]">
                  {Object.entries(p.byEstado).map(([estado, count]) => (
                    <div
                      key={estado}
                      title={`${estado}: ${count}`}
                      style={{
                        flex: count,
                        height: 6,
                        borderRadius: 3,
                        background: "#c41e3a",
                        opacity: 0.55 + (count / p.total) * 0.45,
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

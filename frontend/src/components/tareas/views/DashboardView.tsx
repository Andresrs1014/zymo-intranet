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
import { AlertTriangle } from "lucide-react"
import { useTask } from "@/context/TaskContext"
import {
  useTeamKpis,
  usePersonSummaries,
  useCharts,
  useMembersWithoutEntryToday,
} from "@/hooks/useTaskDashboard"
import { useTaskLists } from "@/hooks/useTaskLists"
import { PersonSummaryCard } from "@/components/tareas/PersonSummaryCard"
import { TaskDrawer } from "@/components/tareas/TaskDrawer"
import type { Task } from "@/types/task"

// Rampa monocroma rojo → zinc (Red Dress Rule): el rojo domina, los grises diferencian
// las series secundarias sin introducir un segundo tono que compita por atención.
const CHART_COLORS = ["#c41e3a", "#e0596e", "#f0a6b1", "#a1a1aa", "#c4c4cb", "#71717a"]

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

type DashboardTab = "dashboard" | "personas"

export function DashboardView() {
  const { activeTeamId } = useTask()
  const [tab, setTab] = useState<DashboardTab>("dashboard")
  const [range, setRange] = useState<{ desde?: string; hasta?: string }>({})
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const { data: kpis } = useTeamKpis(activeTeamId, range)
  const { data: persons = [] } = usePersonSummaries(activeTeamId)
  const { data: charts } = useCharts(activeTeamId, range)
  const { data: noEntry = [] } = useMembersWithoutEntryToday(activeTeamId)
  const { data: lists } = useTaskLists(activeTeamId)
  const estados = lists?.estado ?? []

  if (!activeTeamId) {
    return <div className="p-16 text-center text-zinc-500">Selecciona un equipo.</div>
  }

  const dateInput = "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-primary"

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs: Dashboard (KPIs/gráficas) | Info por persona (antes "Personas") */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-lg border border-zinc-200 bg-white p-1">
          {([
            { key: "dashboard" as const, label: "Dashboard" },
            { key: "personas" as const, label: "Info por persona" },
          ]).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Rango:</span>
            <input type="date" value={range.desde ?? ""} onChange={(e) => setRange((r) => ({ ...r, desde: e.target.value || undefined }))} className={dateInput} />
            <span className="text-xs text-zinc-400">—</span>
            <input type="date" value={range.hasta ?? ""} onChange={(e) => setRange((r) => ({ ...r, hasta: e.target.value || undefined }))} className={dateInput} />
          </div>
        )}
      </div>

      {tab === "personas" && (
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {persons.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">No hay datos de personas para este equipo.</p>
          ) : (
            persons.map((p) => (
              <PersonSummaryCard
                key={p.userId}
                person={p}
                teamId={activeTeamId}
                estados={estados}
                onOpenTask={setSelectedTask}
              />
            ))
          )}
        </div>
      )}

      {tab === "dashboard" && (
      <>
      {/* No-entry alert — señal de atención → rojo (protagonista), no ámbar */}
      {noEntry.length > 0 && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-[13px] text-primary">
          <div className="mb-1.5 flex items-center gap-2.5">
            <AlertTriangle size={15} strokeWidth={2.5} />
            <span><strong>{noEntry.length} miembro{noEntry.length > 1 ? "s" : ""}</strong> sin registro de tarea hoy:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-[26px]">
            {noEntry.map((m) => (
              <span key={m.userId} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
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
            {/* Margen + radio reducido: reserva espacio real para las etiquetas externas
                del pie (sin esto el texto se corta contra el borde del contenedor). */}
            <ResponsiveContainer width="100%" height={240}>
              <PieChart margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                <Pie data={charts.byEstado} dataKey="count" nameKey="estado" outerRadius={65} label>
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
            {/* Altura y ancho del eje escalan con la cantidad/longitud de etiquetas —
                con altura fija, más de ~6 etiquetas quedaban amontonadas o cortadas. */}
            <ResponsiveContainer
              width="100%"
              height={Math.max(200, charts.byEtiqueta.length * 34)}
            >
              <BarChart data={charts.byEtiqueta} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
                <YAxis
                  dataKey="etiqueta"
                  type="category"
                  tick={AXIS_TICK}
                  width={Math.min(140, Math.max(80, ...charts.byEtiqueta.map((e) => e.etiqueta.length * 6)))}
                  interval={0}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#71717a" }} itemStyle={{ color: "#18181b" }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="count" fill="#71717a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </>
      )}

      <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  )
}

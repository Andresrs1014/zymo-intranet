import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, Users, BookOpen, ClipboardList, ShieldAlert, FileText, TrendingUp } from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface KpiCharts {
  rotacion_mensual: { labels: string[]; values: number[] }
  salida_tipo: { voluntaria: number; involuntaria: number }
  rotacion_temprana_pct: number
  cap_completacion_mensual: { labels: string[]; values: number[] }
  eval_distribucion: { labels: string[]; values: number[] }
}

interface KpiData {
  headcount: { total: number; activos: number; inactivos: number; antiguedad_anios?: number }
  rotacion: { salidas_12m: number; tasa_pct: number; ingresos_12m: number; indice_shrm_pct: number }
  capacitacion: {
    total_registros: number
    completadas: number
    completacion_pct: number
    horas_por_persona: number
    cobertura_pct: number
    personas_capacitadas: number
  }
  evaluaciones: { total: number; puntaje_promedio: number; cumplimiento_metas_pct: number }
  idp: { activos: number; cobertura_pct: number }
  sanciones: { total: number; personas_afectadas: number }
  novedades: { total: number; pendientes: number }
  charts?: KpiCharts
}

const CHART_COLORS = ["#f43f5e", "#10b981", "#6366f1", "#f59e0b", "#14b8a6"]
const PIE_SALIDA = ["#10b981", "#f43f5e"]
const PIE_IDP = ["#14b8a6", "#475569"]

export function TyCIndicadoresPage() {
  const navigate = useNavigate()
  const [data, setData]       = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    api.get("/tc/kpis")
      .then((r) => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const charts = data?.charts

  const rotacionLine = charts?.rotacion_mensual.labels.map((label, i) => ({
    mes: label,
    tasa: charts.rotacion_mensual.values[i] ?? 0,
  })) ?? []

  const capLine = charts?.cap_completacion_mensual.labels.map((label, i) => ({
    mes: label,
    pct: charts.cap_completacion_mensual.values[i] ?? 0,
  })) ?? []

  const salidaPie = charts
    ? [
        { name: "Voluntaria", value: charts.salida_tipo.voluntaria },
        { name: "Involuntaria", value: charts.salida_tipo.involuntaria },
      ].filter((d) => d.value > 0)
    : []

  const evalBars = charts?.eval_distribucion.labels.map((label, i) => ({
    nivel: label,
    count: charts.eval_distribucion.values[i] ?? 0,
  })) ?? []

  const idpPie = data
    ? [
        { name: "Con IDP", value: data.idp.activos },
        { name: "Sin IDP", value: Math.max(data.headcount.activos - data.idp.activos, 0) },
      ].filter((d) => d.value > 0)
    : []

  return (
    <PageLayout title="T&C — Indicadores" mainClassName="flex-1 overflow-y-auto">

      <div className="px-8 pt-6 pb-4 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => navigate("/tc")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              T&C
            </button>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <span className="text-sm font-medium">Indicadores de talento</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-lg">
            Métricas calculadas en tiempo real desde los datos de colaboradores, capacitaciones y evaluaciones.
          </p>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">

        {loading && (
          <div className="py-16 text-center text-sm text-muted-foreground">Calculando métricas…</div>
        )}
        {error && (
          <div className="py-10 text-center text-sm text-destructive">No se pudieron cargar los KPIs.</div>
        )}

        {data && (
          <>
            <Section title="Headcount" icon={<Users className="w-4 h-4 text-blue-500" />}>
              <KpiCard label="Total colaboradores" value={data.headcount.total} sub="registrados" />
              <KpiCard
                label="Activos"
                value={data.headcount.activos}
                sub={`${Math.round(data.headcount.activos / Math.max(data.headcount.total, 1) * 100)}% de la plantilla`}
                status="good"
              />
              <KpiCard
                label="Antigüedad promedio"
                value={`${data.headcount.antiguedad_anios ?? 0} años`}
                sub="colaboradores activos"
              />
            </Section>

            <Section title="Rotación" icon={<TrendingUp className="w-4 h-4 text-rose-500" />}>
              <KpiCard
                label="Tasa de rotación (12m)"
                value={`${data.rotacion.tasa_pct}%`}
                sub="salidas / plantilla activa"
                status={data.rotacion.tasa_pct <= 10 ? "good" : data.rotacion.tasa_pct <= 20 ? "watch" : "bad"}
                target="≤ 10%"
              />
              <KpiCard label="Salidas últimos 12 meses" value={data.rotacion.salidas_12m} sub="personas desvinculadas" />
              <KpiCard
                label="Índice de rotación (SHRM)"
                value={`${data.rotacion.indice_shrm_pct}%`}
                sub="[(Ingresos + Salidas) ÷ 2] / plantilla promedio"
                status={data.rotacion.indice_shrm_pct <= 15 ? "good" : data.rotacion.indice_shrm_pct <= 25 ? "watch" : "bad"}
                target="≤ 15% anual"
              />
              {charts && (
                <KpiCard
                  label="Rotación temprana (&lt;60 días)"
                  value={`${charts.rotacion_temprana_pct}%`}
                  sub="salidas sobre ingresos 12m"
                  status={charts.rotacion_temprana_pct <= 5 ? "good" : charts.rotacion_temprana_pct <= 10 ? "watch" : "bad"}
                  target="≤ 5%"
                />
              )}
            </Section>

            {charts && rotacionLine.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartPanel title="Rotación mensual (%)" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={rotacionLine}>
                      <XAxis dataKey="mes" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip
                        contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`${v}%`, "Tasa"]}
                      />
                      <Line type="monotone" dataKey="tasa" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartPanel>
                {salidaPie.length > 0 && (
                  <ChartPanel title="Tipo de salida (12m)">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={salidaPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                          {salidaPie.map((_, i) => (
                            <Cell key={i} fill={PIE_SALIDA[i % PIE_SALIDA.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-1 text-[10px] text-muted-foreground">
                      {salidaPie.map((d, i) => (
                        <span key={d.name} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: PIE_SALIDA[i] }} />
                          {d.name}: {d.value}
                        </span>
                      ))}
                    </div>
                  </ChartPanel>
                )}
              </div>
            )}

            <Section title="Capacitación" icon={<BookOpen className="w-4 h-4 text-indigo-500" />}>
              <KpiCard
                label="Cobertura"
                value={`${data.capacitacion.cobertura_pct}%`}
                sub={`${data.capacitacion.personas_capacitadas} personas capacitadas`}
                status={data.capacitacion.cobertura_pct >= 80 ? "good" : data.capacitacion.cobertura_pct >= 50 ? "watch" : "bad"}
                target="≥ 80%"
              />
              <KpiCard
                label="Horas por persona"
                value={`${data.capacitacion.horas_por_persona}h`}
                sub="promedio de horas de formación"
                status={data.capacitacion.horas_por_persona >= 40 ? "good" : data.capacitacion.horas_por_persona >= 20 ? "watch" : "bad"}
                target="≥ 40h/año"
              />
              <KpiCard
                label="Finalización de cursos"
                value={`${data.capacitacion.completacion_pct}%`}
                sub={`${data.capacitacion.completadas} de ${data.capacitacion.total_registros} registros`}
                status={data.capacitacion.completacion_pct >= 85 ? "good" : data.capacitacion.completacion_pct >= 60 ? "watch" : "bad"}
                target="> 85%"
              />
            </Section>

            {capLine.length > 0 && (
              <ChartPanel title="Finalización mensual de capacitaciones">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={capLine}>
                    <XAxis dataKey="mes" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => [`${v}%`, "Completados"]}
                    />
                    <Bar dataKey="pct" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            )}

            <Section title="Evaluaciones de desempeño" icon={<ClipboardList className="w-4 h-4 text-orange-500" />}>
              <KpiCard
                label="Puntaje promedio"
                value={`${data.evaluaciones.puntaje_promedio}/5`}
                sub={`${data.evaluaciones.total} evaluaciones registradas`}
                status={data.evaluaciones.puntaje_promedio >= 4 ? "good" : data.evaluaciones.puntaje_promedio >= 3 ? "watch" : "bad"}
                target="≥ 4.0"
              />
              <KpiCard
                label="Cumplimiento de metas"
                value={`${data.evaluaciones.cumplimiento_metas_pct}%`}
                sub="evaluaciones donde se cumplió la meta"
                status={data.evaluaciones.cumplimiento_metas_pct >= 70 ? "good" : data.evaluaciones.cumplimiento_metas_pct >= 50 ? "watch" : "bad"}
                target="≥ 70%"
              />
            </Section>

            {evalBars.some((b) => b.count > 0) && (
              <ChartPanel title="Distribución de calificaciones">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={evalBars}>
                    <XAxis dataKey="nivel" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {evalBars.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            )}

            <Section title="Plan de Desarrollo Individual (IDP)" icon={<TrendingUp className="w-4 h-4 text-teal-500" />}>
              <KpiCard
                label="Cobertura IDP"
                value={`${data.idp.cobertura_pct}%`}
                sub={`${data.idp.activos} colaboradores con IDP activo`}
                status={data.idp.cobertura_pct >= 80 ? "good" : data.idp.cobertura_pct >= 50 ? "watch" : "bad"}
                target="> 80%"
              />
            </Section>

            {idpPie.length > 0 && (
              <ChartPanel title="Cobertura IDP (activos)" className="max-w-sm">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={idpPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                      {idpPie.map((_, i) => (
                        <Cell key={i} fill={PIE_IDP[i % PIE_IDP.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Section title="Sanciones" icon={<ShieldAlert className="w-4 h-4 text-red-500" />}>
                <KpiCard label="Total registros" value={data.sanciones.total} sub="" />
                <KpiCard label="Personas afectadas" value={data.sanciones.personas_afectadas} sub="" />
              </Section>
              <Section title="Novedades" icon={<FileText className="w-4 h-4 text-violet-500" />}>
                <KpiCard label="Total novedades" value={data.novedades.total} sub="" />
                <KpiCard
                  label="Pendientes"
                  value={data.novedades.pendientes}
                  sub=""
                  status={data.novedades.pendientes === 0 ? "good" : "watch"}
                />
              </Section>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {children}
      </div>
    </div>
  )
}

function ChartPanel({
  title, children, className = "",
}: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-muted/10 px-4 py-4 ${className}`}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  )
}

function KpiCard({
  label, value, sub, status, target,
}: {
  label: string
  value: string | number
  sub: string
  status?: "good" | "watch" | "bad"
  target?: string
}) {
  const COLORS = { good: "text-emerald-500", watch: "text-amber-500", bad: "text-rose-500" } as const
  const statusColor = status ? (COLORS[status] ?? "text-foreground") : "text-foreground"

  return (
    <div className="rounded-xl border border-border bg-muted/10 px-4 py-3.5 space-y-1 transition-colors hover:bg-muted/15">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold tabular-nums tracking-tight ${statusColor}`} style={{ fontFamily: "'DM Mono', monospace" }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      {target && (
        <p className="text-[10px] text-muted-foreground/60">Meta: {target}</p>
      )}
    </div>
  )
}

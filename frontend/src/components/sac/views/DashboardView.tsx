import { useSacDashboard } from "@/hooks/useSac"
import { BlurFade } from "@/components/ui/blur-fade"

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-[12px] text-zinc-600">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100">
        <div className="h-2 rounded-full bg-zinc-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Kpi({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
  if (danger) {
    return (
      <div className="rounded-lg border-2 border-[#c41e3a] bg-[#fce9ed] p-4 shadow-md">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a8172f]">{label}</div>
        <BlurFade duration={0.3}>
          <div className="mt-1 text-2xl font-bold text-[#a8172f]">{value}</div>
        </BlurFade>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">{label}</div>
      <BlurFade duration={0.3}>
        <div className="mt-1 text-2xl font-bold text-zinc-900">{value}</div>
      </BlurFade>
    </div>
  )
}

export function DashboardView() {
  const { data, isLoading } = useSacDashboard()

  if (isLoading || !data) {
    return <p className="text-zinc-400">Cargando dashboard…</p>
  }

  const { clientMetrics, commercialMetrics, charts, aiAnalysis, strategies } = data
  const maxClientBar = Math.max(1, ...charts.clientBar.map((p) => p.value))
  const maxCommercialBar = Math.max(1, ...charts.commercialBar.map((p) => p.value))
  const maxClientPie = Math.max(1, ...charts.clientPie.map((p) => p.value))
  const maxCommercialPie = Math.max(1, ...charts.commercialPie.map((p) => p.value))

  return (
    <div>
      {/* Regla del vestido rojo: riesgos de clientes es el único protagonista. */}
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Fidelización de clientes</h3>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Respuestas" value={clientMetrics.respuestas} />
        <Kpi label="Satisfacción" value={clientMetrics.satisfaccion} />
        <Kpi label="NPS" value={clientMetrics.nps} />
        <Kpi label="Entregas" value={clientMetrics.entregas} />
        <Kpi label="Riesgos" value={clientMetrics.riesgos} danger />
      </div>

      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Diseñando la Experiencia</h3>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Respuestas" value={commercialMetrics.respuestas} />
        <Kpi label="Valor reunión" value={commercialMetrics.valorReunion} />
        <Kpi label="Atención" value={commercialMetrics.atencion} />
        <Kpi label="Seguimientos" value={commercialMetrics.seguimientos} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Cliente — promedios</h3>
          {charts.clientBar.map((p) => (
            <Bar key={p.label} label={p.label} value={p.value} max={maxClientBar} />
          ))}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Experiencia — promedios</h3>
          {charts.commercialBar.map((p) => (
            <Bar key={p.label} label={p.label} value={p.value} max={maxCommercialBar} />
          ))}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Cliente — NPS</h3>
          {charts.clientPie.map((p) => (
            <Bar key={p.label} label={p.label} value={p.value} max={maxClientPie} />
          ))}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Experiencia — segmentos</h3>
          {charts.commercialPie.map((p) => (
            <Bar key={p.label} label={p.label} value={p.value} max={maxCommercialPie} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Lectura</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-zinc-700">
            {aiAnalysis.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Estrategias sugeridas</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-zinc-700">
            {strategies.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

import { useTicketDashboard } from "@/hooks/useTickets"
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

export function DashboardView() {
  const { data, isLoading } = useTicketDashboard()

  if (isLoading || !data) {
    return <p className="text-zinc-400">Cargando dashboard…</p>
  }

  const { metrics, aiAnalysis } = data
  const maxByStatus = Math.max(1, ...Object.values(metrics.byStatus))
  const maxByType = Math.max(1, ...Object.values(metrics.byType))

  return (
    <div>
      {/* Regla del vestido rojo: un solo protagonista (vencidos por SLA), el
          resto de KPIs queda neutral — ver mixui/references/research/
          priority-layout-time-dashboards.md */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Total</div>
          <BlurFade duration={0.3}>
            <div className="mt-1 text-2xl font-bold text-zinc-900">{metrics.total}</div>
          </BlurFade>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Abiertos</div>
          <BlurFade duration={0.3} delay={0.03}>
            <div className="mt-1 text-2xl font-bold text-zinc-900">{metrics.open}</div>
          </BlurFade>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Cerrados</div>
          <BlurFade duration={0.3} delay={0.06}>
            <div className="mt-1 text-2xl font-bold text-zinc-900">{metrics.closed}</div>
          </BlurFade>
        </div>
        {/* Protagonista (regla del vestido rojo): sombra más marcada = capa "near",
            el resto queda plano — profundidad por elevación, no por fondo 3D
            (ver mixui/references/research/motion-depth-ui.md, patrón Dashboard). */}
        <div className="rounded-lg border-2 border-[#c41e3a] bg-[#fce9ed] p-4 shadow-md">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a8172f]">Vencidos (SLA)</div>
          <BlurFade duration={0.3} delay={0.09}>
            <div className="mt-1 text-2xl font-bold text-[#a8172f]">{metrics.overLimit}</div>
          </BlurFade>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Por estado</h3>
          {Object.entries(metrics.byStatus).map(([status, count]) => (
            <Bar key={status} label={status} value={count} max={maxByStatus} />
          ))}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Por tipo</h3>
          {Object.entries(metrics.byType).map(([type, count]) => (
            <Bar key={type} label={type} value={count} max={maxByType} />
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-zinc-900">Lectura</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-zinc-700">
          {aiAnalysis.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

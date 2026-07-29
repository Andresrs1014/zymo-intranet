import { useState } from "react"
import { Download } from "lucide-react"
import { useTicketDashboard } from "@/hooks/useTickets"
import { BlurFade } from "@/components/ui/blur-fade"
import { downloadFile } from "@/lib/download"
import { extractErrorMessage } from "@/lib/ticketErrors"
import { useTicketToast } from "../TicketToast"
import type { ScoreLeaderboardEntry } from "@/types/ticket"

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

function Leaderboard({ title, entries }: { title: string; entries: ScoreLeaderboardEntry[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-zinc-900">{title}</h3>
      {entries.length === 0 && <p className="text-xs text-zinc-400">Sin datos suficientes todavía.</p>}
      <ol className="space-y-2.5">
        {entries.slice(0, 5).map((entry, i) => (
          <li key={entry.label} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-xs font-bold text-zinc-400 tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-zinc-900">{entry.label}</p>
              <p className="text-[11px] text-zinc-500">
                {entry.count - entry.resolved} abiertos ahora · {entry.resolved}/{entry.count} resueltos
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
              i === 0 ? "bg-[#fce9ed] text-[#a8172f]" : "bg-zinc-100 text-zinc-600"
            }`}>
              {entry.avgScore}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function DashboardView() {
  const { data, isLoading } = useTicketDashboard()
  const [exporting, setExporting] = useState(false)
  const { showToast } = useTicketToast()

  async function handleExport() {
    setExporting(true)
    try {
      await downloadFile("/api/tickets/export/csv", "tickets_pqr_zymoally.csv")
    } catch (err) {
      showToast(extractErrorMessage(err, "No se pudo exportar el CSV."), "error")
    } finally {
      setExporting(false)
    }
  }

  if (isLoading || !data) {
    return <p className="text-zinc-400">Cargando dashboard…</p>
  }

  const { metrics, aiAnalysis, scoreLeaderboards } = data
  const maxByStatus = Math.max(1, ...Object.values(metrics.byStatus))
  const maxByType = Math.max(1, ...Object.values(metrics.byType))
  const maxByArea = Math.max(1, ...Object.values(metrics.byArea))

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          <Download size={14} /> {exporting ? "Exportando…" : "Exportar CSV"}
        </button>
      </div>

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

      <div className="grid gap-4 lg:grid-cols-3">
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
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Por área</h3>
          {Object.entries(metrics.byArea).map(([area, count]) => (
            <Bar key={area} label={area} value={count} max={maxByArea} />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-zinc-900">Score de gestión</h2>
          <span className="text-[11px] text-zinc-400">Pesos provisionales — no mide velocidad ni volumen puro</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Leaderboard title="Por plataforma" entries={scoreLeaderboards.byPlatform} />
          <Leaderboard title="Por supervisor / coordinador" entries={scoreLeaderboards.byPerson} />
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

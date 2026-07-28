import type { ReactNode } from "react"
import { Users, CheckCircle2, Flame, Activity, XCircle, TrendingUp, Banknote, Target } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NumberTicker } from "@/components/ui/number-ticker"
import { BlurFade } from "@/components/ui/blur-fade"
import { formatCOP } from "@/lib/libertadoraFormat"
import type { LibKpis } from "@/types/libertadora"

interface KpiCardDef {
  label: string
  sub: string
  icon: ReactNode
  accent: string
  value: ReactNode
}

export function KpiGrid({ kpis }: { kpis: LibKpis }) {
  const cards: KpiCardDef[] = [
    {
      label: "Total prospectos",
      sub: "Base activa de gestión",
      icon: <Users className="h-5 w-5" />,
      accent: "var(--lib-teal)",
      value: <NumberTicker value={kpis.tot} className="text-[27px] font-extrabold text-zinc-900" />,
    },
    {
      label: "Cierres exitosos",
      sub: "Ventas concretadas 2026",
      icon: <CheckCircle2 className="h-5 w-5" />,
      accent: "var(--lib-green)",
      value: <NumberTicker value={kpis.ci} className="text-[27px] font-extrabold text-zinc-900" />,
    },
    {
      label: "Clientes interesados",
      sub: "Pipeline caliente",
      icon: <Flame className="h-5 w-5" />,
      accent: "var(--lib-warn)",
      value: <NumberTicker value={kpis.ii} className="text-[27px] font-extrabold text-zinc-900" />,
    },
    {
      label: "En proceso",
      sub: "Gestión activa",
      icon: <Activity className="h-5 w-5" />,
      accent: "var(--lib-blue)",
      value: <NumberTicker value={kpis.ep} className="text-[27px] font-extrabold text-zinc-900" />,
    },
    {
      label: "No interesados",
      sub: "Descartados / sin éxito",
      icon: <XCircle className="h-5 w-5" />,
      accent: "var(--lib-red)",
      value: <NumberTicker value={kpis.ni} className="text-[27px] font-extrabold text-zinc-900" />,
    },
    {
      label: "Tasa conversión",
      sub: "Cierres vs. total base",
      icon: <TrendingUp className="h-5 w-5" />,
      accent: "var(--lib-orange)",
      value: (
        <span className="inline-flex items-baseline text-[27px] font-extrabold text-zinc-900">
          <NumberTicker value={kpis.conv} decimalPlaces={1} />%
        </span>
      ),
    },
    {
      label: "Monto vendido / mes",
      sub: "Aportes mensuales cerrados",
      icon: <Banknote className="h-5 w-5" />,
      accent: "var(--lib-teal)",
      value: <span className="text-[18px] font-extrabold text-zinc-900">{formatCOP(kpis.mo)}</span>,
    },
    {
      label: "Pipeline potencial / mes",
      sub: "Clientes interesados",
      icon: <Target className="h-5 w-5" />,
      accent: "var(--lib-gray)",
      value: <span className="text-[18px] font-extrabold text-zinc-900">{formatCOP(kpis.po)}</span>,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card, i) => (
        <BlurFade key={card.label} duration={0.3} delay={0.04 * i}>
          <Card
            className="border-l-4 p-4 transition-transform hover:-translate-y-0.5"
            style={{ borderLeftColor: card.accent }}
          >
            <div className="mb-1.5 text-zinc-400" style={{ color: card.accent }}>
              {card.icon}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{card.label}</p>
            <div className="mt-0.5">{card.value}</div>
            <p className="mt-1 text-[10.5px] text-zinc-400">{card.sub}</p>
          </Card>
        </BlurFade>
      ))}
    </div>
  )
}

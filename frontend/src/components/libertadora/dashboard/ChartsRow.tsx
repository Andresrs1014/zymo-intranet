import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { productShortLabel } from "@/lib/libertadoraFormat"
import type { LibKpis, LibProspecto } from "@/types/libertadora"

const FONT = { fontSize: 11, fill: "#64748b", fontFamily: "'DM Sans', sans-serif" }
const TOOLTIP_STYLE = { background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold text-zinc-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

export function ChartsRow({ kpis, prospectos }: { kpis: LibKpis; prospectos: LibProspecto[] }) {
  // Ported 1:1 de rCharts() — embudo por estado, prospectos por producto, cierres por trimestre.
  const funnelData = [
    { name: "Cerrado", value: kpis.ci, color: "var(--lib-green)" },
    { name: "Interesado", value: kpis.ii, color: "var(--lib-warn)" },
    { name: "En proceso", value: kpis.ep, color: "var(--lib-blue)" },
    { name: "No interesado", value: kpis.ni, color: "var(--lib-red)" },
  ]

  const productCounts = new Map<string, number>()
  prospectos.forEach((p) => productCounts.set(p.producto, (productCounts.get(p.producto) ?? 0) + 1))
  const productData = Array.from(productCounts.entries()).map(([producto, value]) => ({
    name: productShortLabel(producto),
    value,
  }))

  const quarterCounts: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  prospectos.filter((p) => p.estado === "CERRADO").forEach((p) => {
    quarterCounts[p.trimestre ?? "Q3"] = (quarterCounts[p.trimestre ?? "Q3"] ?? 0) + 1
  })
  const quarterData = Object.entries(quarterCounts).map(([name, value]) => ({ name, value }))

  const PRODUCT_COLORS = ["var(--lib-teal)", "var(--lib-navy2)", "var(--lib-orange)", "var(--lib-red)", "#805AD5"]

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="Funnel de ventas">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={funnelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {funnelData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Prospectos por producto">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={productData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={FONT} />
            <YAxis allowDecimals={false} tick={FONT} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {productData.map((_, i) => (
                <Cell key={i} fill={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cierres por trimestre">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={quarterData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={FONT} />
            <YAxis allowDecimals={false} tick={FONT} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" fill="var(--lib-teal)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

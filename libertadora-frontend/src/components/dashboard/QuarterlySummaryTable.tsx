import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCOP, productShortLabel, TRIMESTRE_LABEL } from "@/lib/libertadoraFormat"
import type { LibMeta, LibProspecto, LibTrimestre } from "@/types/libertadora"

const TRIMESTRES: LibTrimestre[] = ["Q1", "Q2", "Q3", "Q4"]

function progressColor(pct: number): string {
  if (pct >= 80) return "var(--lib-green)"
  if (pct >= 50) return "var(--lib-warn)"
  return "var(--lib-red)"
}

// Ported 1:1 de rTrim() — meta trimestral = meta mensual x 3.
export function QuarterlySummaryTable({ prospectos, meta }: { prospectos: LibProspecto[]; meta?: LibMeta }) {
  const metaTrimestral = (meta?.metaMensual ?? 0) * 3
  const cerrados = prospectos.filter((p) => p.estado === "CERRADO")

  const rows = TRIMESTRES.map((q) => {
    const enQ = cerrados.filter((p) => (p.trimestre ?? "Q3") === q)
    const monto = enQ.reduce((sum, p) => sum + p.monto, 0)
    const productos = Array.from(new Set(enQ.map((p) => productShortLabel(p.producto)))).slice(0, 3)
    const pct = metaTrimestral > 0 ? Math.min(100, Math.round((monto / metaTrimestral) * 100)) : null
    return { q, cierres: enQ.length, productos, monto, pct }
  })

  const totalCierres = rows.reduce((s, r) => s + r.cierres, 0)
  const totalMonto = rows.reduce((s, r) => s + r.monto, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold text-zinc-800">Resumen de ventas por trimestre · Acumulado 2026</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-2 pr-3">Trimestre</th>
              <th className="py-2 pr-3">Período</th>
              <th className="py-2 pr-3">Cierres</th>
              <th className="py-2 pr-3">Productos</th>
              <th className="py-2 pr-3">Monto COP/mes</th>
              <th className="py-2 pr-3">Meta trimestral</th>
              <th className="py-2 pr-3">Avance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.q} className="border-t border-zinc-100">
                <td className="py-2 pr-3 font-bold text-zinc-700">{r.q}</td>
                <td className="py-2 pr-3 text-zinc-400">{TRIMESTRE_LABEL[r.q]} 2026</td>
                <td className="py-2 pr-3 text-center font-bold text-zinc-700">{r.cierres}</td>
                <td className="py-2 pr-3 text-zinc-500">{r.productos.join(", ") || "—"}</td>
                <td className="py-2 pr-3 font-bold" style={{ color: "var(--lib-teal-d)" }}>{formatCOP(r.monto)}</td>
                <td className="py-2 pr-3 text-zinc-400">{metaTrimestral > 0 ? formatCOP(metaTrimestral) : "Sin definir"}</td>
                <td className="py-2 pr-3">
                  {r.pct !== null ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded bg-zinc-100">
                        <div className="h-full rounded" style={{ width: `${r.pct}%`, background: progressColor(r.pct) }} />
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: progressColor(r.pct) }}>{r.pct}%</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-zinc-400">Sin meta</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-200 font-bold" style={{ background: "var(--lib-teal-l)" }}>
              <td colSpan={2} className="py-2 pr-3 text-zinc-700">Total acumulado 2026</td>
              <td className="py-2 pr-3 text-center text-zinc-700">{totalCierres}</td>
              <td />
              <td className="py-2 pr-3" style={{ color: "var(--lib-teal-d)" }}>{formatCOP(totalMonto)}</td>
              <td /><td />
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  )
}

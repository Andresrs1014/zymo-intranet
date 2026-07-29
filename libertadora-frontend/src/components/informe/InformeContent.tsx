import { Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCOP } from "@/lib/libertadoraFormat"
import type { LibKpis, LibProspecto } from "@/types/libertadora"

interface InformeContentProps {
  kpis: LibKpis
  prospectos: LibProspecto[]
  /** Descarga el PDF real generado en el servidor (sin diálogo de impresión del navegador de por medio). */
  onDownloadPdf: () => void | Promise<void>
  downloadingPdf?: boolean
}

// Ported 1:1 de rInf() — mismo criterio de "contactado" (busca "programar" en
// el texto libre de gestión), mismo criterio de "prospectos calientes"
// (interesados primero, luego en proceso de prioridad alta), tope 10 filas.
export function InformeContent({ kpis, prospectos, onDownloadPdf, downloadingPdf }: InformeContentProps) {
  const cerrados = prospectos.filter((p) => p.estado === "CERRADO")

  const contactados = kpis.tot - prospectos.filter((p) => p.estado === "EN_PROCESO" && (p.gestion ?? "").toLowerCase().includes("programar")).length
  const steps = [
    { label: "Total prospectos identificados", value: kpis.tot, color: "var(--lib-navy2)" },
    { label: "Contactados / cita realizada", value: contactados, color: "var(--lib-teal)" },
    { label: "Con interés confirmado", value: kpis.ci + kpis.ii, color: "var(--lib-orange)" },
    { label: "Cierres exitosos", value: kpis.ci, color: "var(--lib-green)" },
  ]

  const calientes = prospectos
    .filter((p) => p.estado === "INTERESADO" || (p.estado === "EN_PROCESO" && p.prioridad === "ALTA"))
    .sort((a, b) => (a.estado === "INTERESADO" && b.estado !== "INTERESADO" ? -1 : 1))
    .slice(0, 10)

  const altaPrioridad = prospectos.filter((p) => p.prioridad === "ALTA").length
  const pj = prospectos.filter((p) => p.tipo === "PJ").length
  const pn = prospectos.filter((p) => p.tipo === "PN").length

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-6 text-white" style={{ background: "linear-gradient(135deg, var(--lib-navy), var(--lib-teal-d))" }}>
        <h2 className="text-lg font-bold">Informe ejecutivo de gestión comercial</h2>
        <p className="mt-1 text-sm opacity-80">Producto: <b>SKANDIA CREA</b> · {new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
        <p className="mt-1 text-xs opacity-60">Presentado ante: Gerencia General · Libertadora Seguros</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-zinc-800">Embudo de conversión comercial</CardTitle></CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          {steps.map((s) => {
            const pct = kpis.tot > 0 ? Math.max(4, Math.round((s.value / kpis.tot) * 100)) : 0
            return (
              <div key={s.label} className="flex items-center gap-2">
                <div className="w-40 shrink-0 text-[11.5px] font-semibold text-zinc-600">{s.label}</div>
                <div className="h-6 flex-1 overflow-hidden rounded bg-zinc-100">
                  <div className="flex h-full items-center rounded pl-2 text-[11px] font-bold text-white" style={{ width: `${pct}%`, background: s.color }}>
                    {s.value}
                  </div>
                </div>
                <div className="w-10 text-right text-xs font-bold text-zinc-500">{s.value}</div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-zinc-800">Cierres exitosos 2026</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <table className="w-full text-left text-[12.5px]">
            <thead><tr className="text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-2 pr-3">Cliente / empresa</th><th className="py-2 pr-3">Producto</th>
              <th className="py-2 pr-3">Aporte mensual</th><th className="py-2 pr-3">Trimestre</th><th className="py-2 pr-3">Tipo</th>
            </tr></thead>
            <tbody>
              {cerrados.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3 font-semibold text-zinc-700">{p.empresa}</td>
                  <td className="py-2 pr-3 text-zinc-500">{p.producto}</td>
                  <td className="py-2 pr-3 font-bold" style={{ color: "var(--lib-teal-d)" }}>{p.monto > 0 ? `${formatCOP(p.monto)}/mes` : "ARL — Afiliación"}</td>
                  <td className="py-2 pr-3 text-zinc-500">{p.trimestre}</td>
                  <td className="py-2 pr-3 text-zinc-500">{p.tipo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-zinc-800">Top prospectos calientes — acción inmediata requerida</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <table className="w-full text-left text-[12.5px]">
            <thead><tr className="text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-2 pr-3">Cliente / empresa</th><th className="py-2 pr-3">Producto</th>
              <th className="py-2 pr-3">Estado</th><th className="py-2 pr-3">Próxima acción</th><th className="py-2 pr-3">Fecha</th>
            </tr></thead>
            <tbody>
              {calientes.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3 font-semibold text-zinc-700">{p.empresa}</td>
                  <td className="py-2 pr-3 text-zinc-500">{p.producto}</td>
                  <td className="py-2 pr-3"><Badge variant={p.estado === "INTERESADO" ? "warning" : "default"}>{p.estado === "INTERESADO" ? "Interesado" : "Alta prioridad"}</Badge></td>
                  <td className="py-2 pr-3 text-zinc-500">{p.accion || "—"}</td>
                  <td className="py-2 pr-3 text-zinc-400">{p.fecha || "Por definir"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-zinc-800">KPIs de efectividad comercial</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:grid-cols-3">
          {[
            { label: "Tasa conversión", value: `${kpis.conv}%`, sub: "Cierres / total base" },
            { label: "Pipeline potencial/mes", value: formatCOP(kpis.po), sub: "Suma prospectos interesados" },
            { label: "Monto real cerrado/mes", value: formatCOP(kpis.mo), sub: "Aportes mensuales activos" },
            { label: "Alta prioridad", value: altaPrioridad, sub: "Acción inmediata requerida" },
            { label: "Personas jurídicas", value: pj, sub: "Empresas / compañías" },
            { label: "Personas naturales", value: pn, sub: "Clientes individuales" },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-zinc-100 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{k.label}</p>
              <p className="text-lg font-extrabold text-zinc-900">{k.value}</p>
              <p className="text-[10.5px] text-zinc-400">{k.sub}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="text-center">
        <Button
          type="button"
          style={{ background: "var(--lib-teal)" }}
          className="gap-1.5"
          disabled={downloadingPdf}
          onClick={() => onDownloadPdf()}
        >
          <Download className="h-4 w-4" /> {downloadingPdf ? "Generando PDF…" : "Descargar informe en PDF"}
        </Button>
      </div>
    </div>
  )
}

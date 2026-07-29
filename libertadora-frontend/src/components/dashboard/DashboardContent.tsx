import { KpiGrid } from "./KpiGrid"
import { MetaComercialCard } from "./MetaComercialCard"
import { ChartsRow } from "./ChartsRow"
import { QuarterlySummaryTable } from "./QuarterlySummaryTable"
import type { LibKpis, LibProspecto, LibMeta } from "@/types/libertadora"

interface DashboardContentProps {
  kpis: LibKpis
  prospectos: LibProspecto[]
  meta?: LibMeta
  canEditMeta?: boolean
  onCommitMeta?: (field: "metaMensual" | "metaAnual" | "metaCierres" | "metaCitas", value: number) => void
}

export function DashboardContent({ kpis, prospectos, meta, canEditMeta = false, onCommitMeta }: DashboardContentProps) {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={kpis} />
      <MetaComercialCard kpis={kpis} meta={meta} readOnly={!canEditMeta} onCommit={onCommitMeta} />
      <ChartsRow kpis={kpis} prospectos={prospectos} />
      <QuarterlySummaryTable prospectos={prospectos} meta={meta} />
    </div>
  )
}

import { Skeleton } from "@/components/ui/skeleton"
import { useLibKpis, useLibProspectos, useLibMeta } from "@/hooks/useLibertadora"
import { KpiGrid } from "./KpiGrid"
import { MetaComercialCard } from "./MetaComercialCard"
import { ChartsRow } from "./ChartsRow"
import { QuarterlySummaryTable } from "./QuarterlySummaryTable"

export function DashboardView() {
  const kpisQuery = useLibKpis()
  const prospectosQuery = useLibProspectos()
  const metaQuery = useLibMeta()

  if (kpisQuery.isLoading || prospectosQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    )
  }

  if (kpisQuery.isError || prospectosQuery.isError || !kpisQuery.data) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No se pudo cargar el dashboard. Intenta recargar la página.
      </p>
    )
  }

  const kpis = kpisQuery.data
  const prospectos = prospectosQuery.data ?? []

  return (
    <div className="space-y-4">
      <KpiGrid kpis={kpis} />
      <MetaComercialCard kpis={kpis} />
      <ChartsRow kpis={kpis} prospectos={prospectos} />
      <QuarterlySummaryTable prospectos={prospectos} meta={metaQuery.data} />
    </div>
  )
}

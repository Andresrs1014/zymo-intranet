import { Skeleton } from "@/components/ui/skeleton"
import { usePartnerProspectos, usePartnerMeta } from "@/hooks/useLibertadoraPartner"
import { computeKpisFromProspectos } from "@/lib/libertadoraKpis"
import { DashboardContent } from "@/components/libertadora/dashboard/DashboardContent"

export function PartnerDashboardPanel() {
  const prospectosQuery = usePartnerProspectos()
  const metaQuery = usePartnerMeta()

  if (prospectosQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    )
  }
  if (prospectosQuery.isError || !prospectosQuery.data) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el dashboard.</p>
  }

  const prospectos = prospectosQuery.data
  const kpis = computeKpisFromProspectos(prospectos)

  // canEditMeta=false: Skandia ve la meta comercial, no la edita (decisión del usuario).
  return <DashboardContent kpis={kpis} prospectos={prospectos} meta={metaQuery.data} canEditMeta={false} />
}

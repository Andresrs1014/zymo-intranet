import { Skeleton } from "@/components/ui/skeleton"
import { usePartnerProspectos, usePartnerMeta, usePartnerUpdateMeta } from "@/hooks/useLibertadoraPartner"
import { computeKpisFromProspectos } from "@/lib/libertadoraKpis"
import { DashboardContent } from "@/components/libertadora/dashboard/DashboardContent"
import type { LibMeta } from "@/types/libertadora"

export function PartnerDashboardPanel() {
  const prospectosQuery = usePartnerProspectos()
  const metaQuery = usePartnerMeta()
  const updateMeta = usePartnerUpdateMeta()

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

  // canEditMeta: cualquier persona con cuenta de socio puede editar la meta
  // comercial (decisión del gerente, 2026-07-28 -- revierte el "solo lectura" anterior).
  return (
    <DashboardContent
      kpis={kpis}
      prospectos={prospectos}
      meta={metaQuery.data}
      canEditMeta
      onCommitMeta={(field, value) => updateMeta.mutate({ [field]: value } as Partial<LibMeta>)}
    />
  )
}

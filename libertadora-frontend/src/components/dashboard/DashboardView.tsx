import { Skeleton } from "@/components/ui/skeleton"
import { useLibKpis, useLibProspectos, useLibMeta, useUpdateLibMeta } from "@/hooks/useLibertadora"
import { DashboardContent } from "./DashboardContent"
import type { LibMeta } from "@/types/libertadora"

export function DashboardView() {
  const kpisQuery = useLibKpis()
  const prospectosQuery = useLibProspectos()
  const metaQuery = useLibMeta()
  const updateMeta = useUpdateLibMeta()

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

  return (
    <DashboardContent
      kpis={kpisQuery.data}
      prospectos={prospectosQuery.data ?? []}
      meta={metaQuery.data}
      canEditMeta
      onCommitMeta={(field, value) => updateMeta.mutate({ [field]: value } as Partial<LibMeta>)}
    />
  )
}

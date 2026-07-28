import { Skeleton } from "@/components/ui/skeleton"
import { useLibKpis, useLibProspectos } from "@/hooks/useLibertadora"
import { InformeContent } from "./InformeContent"

export function InformeView() {
  const kpisQuery = useLibKpis()
  const prospectosQuery = useLibProspectos()

  if (kpisQuery.isLoading || prospectosQuery.isLoading) return <Skeleton className="h-96 rounded-lg" />
  if (kpisQuery.isError || prospectosQuery.isError || !kpisQuery.data) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el informe.</p>
  }

  return <InformeContent kpis={kpisQuery.data} prospectos={prospectosQuery.data ?? []} printHref="/libertadora/informe/imprimir" />
}

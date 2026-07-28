import { Skeleton } from "@/components/ui/skeleton"
import { usePartnerProspectos } from "@/hooks/useLibertadoraPartner"
import { computeKpisFromProspectos } from "@/lib/libertadoraKpis"
import { InformeContent } from "@/components/libertadora/informe/InformeContent"

export function PartnerInformeView() {
  const { data: prospectos, isLoading, isError } = usePartnerProspectos()

  if (isLoading) return <Skeleton className="h-96 rounded-lg" />
  if (isError || !prospectos) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el informe.</p>
  }

  return <InformeContent kpis={computeKpisFromProspectos(prospectos)} prospectos={prospectos} />
}

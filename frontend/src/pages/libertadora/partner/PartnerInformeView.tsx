import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { usePartnerProspectos } from "@/hooks/useLibertadoraPartner"
import { computeKpisFromProspectos } from "@/lib/libertadoraKpis"
import { libertadoraApi } from "@/lib/libertadoraApi"
import { downloadBlob } from "@/lib/downloadBlob"
import { InformeContent } from "@/components/libertadora/informe/InformeContent"

export function PartnerInformeView() {
  const { data: prospectos, isLoading, isError } = usePartnerProspectos()
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPdf() {
    setDownloading(true)
    try {
      const res = await libertadoraApi.get("/public/informe/pdf", { responseType: "blob" })
      downloadBlob(res.data, "Informe_SKANDIA_CREA-Libertadora_Seguros.pdf")
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) return <Skeleton className="h-96 rounded-lg" />
  if (isError || !prospectos) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el informe.</p>
  }

  return (
    <InformeContent
      kpis={computeKpisFromProspectos(prospectos)}
      prospectos={prospectos}
      onDownloadPdf={handleDownloadPdf}
      downloadingPdf={downloading}
    />
  )
}

import { useQuery } from "@tanstack/react-query"
import { FolderOpen } from "lucide-react"
import { sigApi } from "@/lib/sigApi"

interface CarpetaSigItem {
  id: number
  nombre: string
  intranetAreaId: number | null
  _count: { procedimientos: number }
}

/** La carpeta del SIG de esta área: nace sola con el área. Solo se muestra; no se crea ni se enlaza a mano. */
export function CarpetaSig({ areaId }: { areaId: number }) {
  const { data: carpetas, isError } = useQuery({
    queryKey: ["sig", "areas"],
    queryFn: async () => (await sigApi.get<CarpetaSigItem[]>("/api/areas")).data,
    staleTime: 30_000,
    retry: false,
  })
  if (isError) return <p className="mt-2 font-mono text-[11px] text-org-tinta/45">El SIG no responde: la carpeta se crea sola cuando vuelva.</p>
  if (!carpetas) return null
  const propia = carpetas.find((c) => c.intranetAreaId === areaId)

  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-org-tinta/60">
      <FolderOpen className="h-3.5 w-3.5 text-org-vivo" aria-hidden />
      Carpeta en el SIG:{" "}
      {propia
        ? <strong className="font-medium text-org-tinta">{propia.nombre} · {propia._count.procedimientos} procedimientos</strong>
        : <em>se crea sola en un momento</em>}
    </p>
  )
}

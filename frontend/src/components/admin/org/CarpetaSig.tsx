import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FolderOpen, FolderPlus } from "lucide-react"
import { sigApi } from "@/lib/sigApi"

interface CarpetaSigItem {
  id: number
  nombre: string
  intranetAreaId: number | null
  _count: { procedimientos: number }
}

const mensaje = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "No se pudo completar. Intenta de nuevo."

/** Dar (o no) su espacio en el SIG al área. Las carpetas ya no nacen solas: el admin decide cuáles áreas van al SIG. */
export function CarpetaSig({ areaId, areaNombre }: { areaId: number; areaNombre: string }) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [existente, setExistente] = useState("")
  const { data: carpetas, isError } = useQuery({
    queryKey: ["sig", "areas"],
    queryFn: async () => (await sigApi.get<CarpetaSigItem[]>("/api/areas")).data,
    staleTime: 30_000,
    retry: false,
  })
  const dar = useMutation({
    mutationFn: async () => (await sigApi.post("/api/areas/desde-intranet", { intranetAreaId: areaId, ...(existente ? { carpetaId: Number(existente) } : {}) })).data,
    onSuccess: () => { setAbierto(false); setExistente(""); qc.invalidateQueries({ queryKey: ["sig", "areas"] }) },
  })

  if (isError) return <p className="mt-2 font-mono text-[11px] text-org-tinta/45">El SIG no responde ahora mismo.</p>
  if (!carpetas) return null
  const propia = carpetas.find((c) => c.intranetAreaId === areaId)
  const sinEnlace = carpetas.filter((c) => c.intranetAreaId == null)

  if (propia) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-org-tinta/60">
        <FolderOpen className="h-3.5 w-3.5 text-org-vivo" aria-hidden />
        Carpeta en el SIG: <strong className="font-medium text-org-tinta">{propia.nombre} · {propia._count.procedimientos} procedimientos</strong>
      </p>
    )
  }

  return (
    <div className="mt-2 text-[12px] text-org-tinta/60">
      <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <FolderOpen className="h-3.5 w-3.5 text-org-tinta/35" aria-hidden />
        Esta área no tiene carpeta en el SIG.
        {!abierto && (
          <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1 font-medium text-org-rojo underline-offset-2 hover:underline">
            <FolderPlus className="h-3.5 w-3.5" aria-hidden /> Dar carpeta en el SIG
          </button>
        )}
      </p>
      {abierto && (
        <div className="mt-2 max-w-md rounded-xl border border-org-linea bg-white p-3">
          <label className="block text-[12px] text-org-tinta/70">
            ¿Qué carpeta usa?
            <select
              value={existente} onChange={(e) => setExistente(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-org-linea bg-white px-3 text-[13px] text-org-tinta focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30"
            >
              <option value="">Crear una carpeta nueva «{areaNombre}»</option>
              {sinEnlace.map((c) => <option key={c.id} value={c.id}>Usar la que ya existe: {c.nombre} ({c._count.procedimientos} procedimientos)</option>)}
            </select>
          </label>
          {dar.isError && <p role="alert" className="mt-2 text-[12px] text-org-rojo">{mensaje(dar.error)}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => dar.mutate()} disabled={dar.isPending} className="h-8 rounded-full bg-org-rojo px-4 text-[12px] font-medium text-white hover:bg-org-oscuro disabled:opacity-60">Confirmar</button>
            <button type="button" onClick={() => { setAbierto(false); setExistente(""); dar.reset() }} className="h-8 rounded-full px-3 text-[12px] text-org-tinta/70 hover:bg-org-tinte">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

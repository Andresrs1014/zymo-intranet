import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Download, X } from "lucide-react"
import { sigApi } from "@/lib/sigApi"

export interface ArchivoPorRevisar {
  tipo: "instructivo" | "formato" | "anexo"
  id: number
  nombre: string
  nombreArchivo: string | null
  autorNombre: string
  createdAt: string
  procedimiento: { id: number; codigo: string; titulo: string; area: { nombre: string; color: string } }
}

const RUTA = { instructivo: "instructivos", formato: "formatos", anexo: "doc-anexos" } as const
const ETIQUETA = { instructivo: "Instructivo", formato: "Formato", anexo: "Doc extra" } as const

/** Cola del SIG para lo que suben los líderes de área (las versiones tienen la suya). */
export function SigArchivosPorRevisar({ items }: { items: ArchivoPorRevisar[] }) {
  const qc = useQueryClient()
  const [rechazando, setRechazando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)

  const resolver = useMutation({
    mutationFn: async (v: { a: ArchivoPorRevisar; aprobar: boolean }) =>
      sigApi.post(`/api/revision/${v.a.tipo}/${v.a.id}/${v.aprobar ? "aprobar" : "rechazar"}`, v.aprobar ? {} : { comentario: motivo }),
    onSuccess: () => {
      setRechazando(null)
      setMotivo("")
      setError(null)
      void qc.invalidateQueries({ queryKey: ["sig"] })
    },
    onError: () => setError("No se pudo guardar la decisión. Intenta de nuevo."),
  })

  async function ver(a: ArchivoPorRevisar) {
    const res = await sigApi.get(`/api/${RUTA[a.tipo]}/${a.id}/archivo`, { responseType: "blob" })
    const url = URL.createObjectURL(res.data)
    const link = document.createElement("a")
    link.href = url
    link.download = a.nombreArchivo ?? a.nombre
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto w-full max-w-3xl mt-6 mb-4">
      <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-3">Archivos de líderes por verificar</p>
      {error && <p className="text-xs text-red-600 mb-2" aria-live="polite">{error}</p>}
      <div className="space-y-1">
        {items.map((a) => {
          const k = `${a.tipo}-${a.id}`
          return (
            <div key={k} className="px-3 py-3 rounded border border-zinc-300 bg-white">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="h-8 w-0.5 rounded-full shrink-0" style={{ backgroundColor: a.procedimiento.area.color }} />
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-mono px-1.5 py-px rounded bg-zinc-200 text-zinc-700">{ETIQUETA[a.tipo]}</span>
                    <span className="text-xs text-zinc-700 font-mono">{a.procedimiento.codigo}</span>
                    <span className="text-xs text-zinc-600">{a.procedimiento.area.nombre}</span>
                  </div>
                  <p className="text-[12px] text-zinc-700 truncate font-mono">{a.nombre}</p>
                  <p className="text-xs text-zinc-600">por {a.autorNombre}</p>
                </div>
                <button
                  onClick={() => void ver(a)}
                  className="p-1.5 rounded text-zinc-600 hover:text-zinc-700 hover:bg-zinc-200"
                  title="Descargar para revisar"
                  aria-label={`Descargar ${a.nombre}`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  onClick={() => resolver.mutate({ a, aprobar: true })}
                  disabled={resolver.isPending}
                  className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                >
                  <Check className="h-3 w-3" aria-hidden /> Aprobar
                </button>
                <button
                  onClick={() => { setRechazando(rechazando === k ? null : k); setMotivo("") }}
                  aria-expanded={rechazando === k}
                  className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                >
                  <X className="h-3 w-3" aria-hidden /> Rechazar
                </button>
              </div>
              {rechazando === k && (
                <form
                  className="flex gap-2 mt-2"
                  onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) resolver.mutate({ a, aprobar: false }) }}
                >
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    autoFocus
                    maxLength={1000}
                    name="motivo"
                    autoComplete="off"
                    placeholder="Motivo del rechazo (lo ve el líder)…"
                    aria-label="Motivo del rechazo"
                    className="flex-1 text-[12px] px-2 py-1 border border-zinc-300 rounded"
                  />
                  <button
                    type="submit"
                    disabled={!motivo.trim() || resolver.isPending}
                    className="text-xs font-mono px-2 py-1 rounded bg-red-600 text-white disabled:opacity-40"
                  >
                    Confirmar
                  </button>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

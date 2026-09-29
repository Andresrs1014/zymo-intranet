import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"

interface Protocolo {
  id: number
  codigo: string
  titulo: string
  activo: boolean
}

interface Referencia {
  id: number
  origenTipo: string
  destinoTipo: string
  destinoCodigo: string
  estado: "resuelta" | "ausente" | "otra_area" | "otro_codigo"
  nota: string | null
  frase: string | null
}

const ESTADO: Record<Referencia["estado"], { label: string; className: string }> = {
  resuelta: { label: "En carpeta", className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  ausente: { label: "Sin archivo", className: "text-amber-800 bg-amber-50 border-amber-200" },
  otra_area: { label: "Otra área", className: "text-sky-800 bg-sky-50 border-sky-200" },
  otro_codigo: { label: "Otro código", className: "text-amber-900 bg-amber-50 border-amber-300" },
}

export function SigVinculosPanel({ procedimientoId, canEdit }: { procedimientoId: number; canEdit: boolean }) {
  const qc = useQueryClient()
  const [codigo, setCodigo] = useState("")
  const [titulo, setTitulo] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const protocolos = useQuery<Protocolo[]>({
    queryKey: ["sig", "protocolos", procedimientoId],
    queryFn: () => sigApi.get(`/api/protocolos?procedimientoId=${procedimientoId}&activo=true`).then((r) => r.data),
  })
  const referencias = useQuery<Referencia[]>({
    queryKey: ["sig", "referencias", procedimientoId],
    queryFn: () => sigApi.get(`/api/referencias?procedimientoId=${procedimientoId}`).then((r) => r.data),
  })

  const subir = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Elige el archivo del protocolo")
      const fd = new FormData()
      fd.append("file", file)
      fd.append("procedimientoId", String(procedimientoId))
      fd.append("codigo", codigo.trim())
      fd.append("titulo", titulo.trim())
      await sigApi.post("/api/protocolos/upload", fd)
    },
    onSuccess: () => {
      setCodigo("")
      setTitulo("")
      setFile(null)
      setFileKey((k) => k + 1)
      setError(null)
      qc.invalidateQueries({ queryKey: ["sig", "protocolos", procedimientoId] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(typeof msg === "string" ? msg : "No se pudo subir el protocolo")
    },
  })

  const listaP = protocolos.data ?? []
  const listaR = referencias.data ?? []
  const cargando = protocolos.isLoading || referencias.isLoading

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-3">Protocolos</h2>
        {cargando && <p className="text-xs font-mono text-zinc-400 animate-pulse">Cargando…</p>}
        {!cargando && listaP.length === 0 && (
          <p className="text-sm text-zinc-500">Este procedimiento no tiene protocolos.</p>
        )}
        <ul className="space-y-2">
          {listaP.map((p) => (
            <li key={p.id} className="flex items-baseline gap-3 border border-zinc-200 rounded-lg px-3 py-2">
              <span className="font-mono text-[12px] text-zinc-800">{p.codigo}</span>
              <span className="text-sm text-zinc-600 truncate">{p.titulo}</span>
            </li>
          ))}
        </ul>
        {canEdit && (
          <form
            className="mt-4 grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => { e.preventDefault(); subir.mutate() }}
          >
            <label className="text-[11px] font-mono text-zinc-500">
              Código
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} required className="mt-1 w-full border border-zinc-200 rounded px-2 py-1 text-sm font-mono text-zinc-800" />
            </label>
            <label className="text-[11px] font-mono text-zinc-500">
              Título
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required className="mt-1 w-full border border-zinc-200 rounded px-2 py-1 text-sm text-zinc-800" />
            </label>
            <label className="text-[11px] font-mono text-zinc-500 sm:col-span-2">
              Archivo
              <input key={fileKey} type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs text-zinc-600" />
            </label>
            {error && <p className="sm:col-span-2 text-xs text-amber-800">{error}</p>}
            <button type="submit" disabled={subir.isPending} className="sm:col-span-2 justify-self-start px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-zinc-900 text-white disabled:opacity-50">
              {subir.isPending ? "Subiendo…" : "Subir protocolo"}
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-3">Citas</h2>
        {!cargando && listaR.length === 0 && (
          <p className="text-sm text-zinc-500">Sin citas registradas. Las ausentes aparecen aquí cuando el mapa las carga.</p>
        )}
        <ul className="space-y-2">
          {listaR.map((r) => {
            const est = ESTADO[r.estado] ?? ESTADO.ausente
            return (
              <li key={r.id} className="border border-zinc-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px] text-zinc-800">{r.destinoCodigo}</span>
                  <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", est.className)}>{est.label}</span>
                  <span className="text-[10px] font-mono text-zinc-400">{r.origenTipo} → {r.destinoTipo}</span>
                </div>
                {r.nota && <p className="text-xs text-zinc-600 mt-1">{r.nota}</p>}
                {r.frase && <p className="text-xs text-zinc-400 mt-1 italic">“{r.frase}”</p>}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { Search, Loader2, UserRound } from "lucide-react"

interface PersonaFila {
  id: number
  nombre: string
  foto_url: string
  cargo_nombre: string
  area_nombre: string
}

export function TodosLosColaboradores({ sedeId }: { sedeId: number }) {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [personas, setPersonas] = useState<PersonaFila[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      api.get("/tc/personas", { params: { empresa_id: sedeId, q: q || undefined, estado: "Activo", limit: 500 } })
        .then((r) => { setPersonas(r.data.items ?? []); setTotal(r.data.total ?? 0) })
        .catch(() => setPersonas([]))
        .finally(() => setLoading(false))
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [sedeId, q])

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Todos los colaboradores {total > 0 && `(${total})`}
        </span>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o documento…"
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background/60 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="rounded-2xl border border-border bg-muted/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Cargando…</span>
          </div>
        ) : personas.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            {q ? "Sin resultados." : "Sin colaboradores en esta empresa todavía."}
          </p>
        ) : (
          <div className="divide-y divide-border max-h-[28rem] overflow-y-auto">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/tc/persona/${p.id}`)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/10 transition-colors"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 overflow-hidden">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nombre} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="w-4 h-4" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{p.nombre}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {p.cargo_nombre || "Sin cargo"}{p.area_nombre ? ` · ${p.area_nombre}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { CheckCircle2, XCircle, Loader2, Inbox, Clock } from "lucide-react"

interface Pendiente {
  id: number
  persona_id: number
  persona_nombre: string
  tipo: string
  descripcion: string
  fecha_inicio: string | null
  fecha_fin: string | null
  origen: string
  created_at: string
}

export function TyCAprobacionesPage() {
  const [items, setItems] = useState<Pendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [procesando, setProcesando] = useState<number | null>(null)
  const [rechazando, setRechazando] = useState<number | null>(null)
  const [motivo, setMotivo] = useState("")
  const [erroresPorItem, setErroresPorItem] = useState<Record<number, string>>({})

  const cargar = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await api.get("/tc/aprobaciones-api")
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setError("No se pudieron cargar las solicitudes pendientes.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function setErrorItem(id: number, msg: string) {
    setErroresPorItem((prev) => ({ ...prev, [id]: msg }))
  }

  async function aprobar(id: number) {
    setProcesando(id)
    setErrorItem(id, "")
    try {
      await api.post(`/tc/aprobaciones-api/${id}/aprobar`)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorItem(id, detail || "No se pudo aprobar la solicitud.")
    } finally {
      setProcesando(null)
    }
  }

  async function rechazar(id: number) {
    setProcesando(id)
    setErrorItem(id, "")
    try {
      await api.post(`/tc/aprobaciones-api/${id}/rechazar`, { motivo })
      setItems((prev) => prev.filter((i) => i.id !== id))
      setRechazando(null)
      setMotivo("")
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorItem(id, detail || "No se pudo rechazar la solicitud.")
    } finally {
      setProcesando(null)
    }
  }

  return (
    <PageLayout title="T&C — Aprobaciones">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">
            Talento y Cultura · Formatos digitales
          </p>
          <h1 className="text-2xl font-bold">Aprobaciones pendientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Permisos y novedades enviados por tu gente a cargo desde el Formato de Ausentismo.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground rounded-xl border border-dashed border-border">
            <Inbox className="w-8 h-8 opacity-20" />
            <span className="text-sm">No tienes solicitudes pendientes.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{it.persona_nombre}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
                        {it.tipo}
                      </span>
                      {(it.fecha_inicio || it.fecha_fin) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {it.fecha_inicio ?? "?"} – {it.fecha_fin ?? "?"}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      Solicitado el {new Date(it.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {it.descripcion && (
                  <p className="text-xs text-muted-foreground whitespace-pre-line border-l-2 border-border pl-3">
                    {it.descripcion}
                  </p>
                )}

                {erroresPorItem[it.id] && (
                  <p className="text-xs text-destructive">{erroresPorItem[it.id]}</p>
                )}

                {rechazando === it.id ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Motivo del rechazo (opcional)"
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => rechazar(it.id)}
                        disabled={procesando === it.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {procesando === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Confirmar rechazo
                      </button>
                      <button
                        onClick={() => { setRechazando(null); setMotivo("") }}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:bg-muted/20 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => aprobar(it.id)}
                      disabled={procesando === it.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {procesando === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Aceptar
                    </button>
                    <button
                      onClick={() => { setRechazando(it.id); setMotivo("") }}
                      disabled={procesando === it.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/30 text-muted-foreground hover:bg-muted/50 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

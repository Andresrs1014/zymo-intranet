import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { TC_EVENTO_TIPOS, type TcEventoTipo } from "@/lib/tc-constants"
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, MapPin, Users, CheckCircle2, AlertCircle } from "lucide-react"

interface Evento {
  id: number
  titulo: string
  tipo: TcEventoTipo
  fecha: string
  hora_inicio: string
  hora_fin: string
  lugar: string
  total_personas: number
  asistencia_completa: boolean
}

type Vista = "dia" | "semana" | "mes"

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function rango(vista: Vista, anchor: Date): { desde: Date; hasta: Date } {
  if (vista === "dia") return { desde: anchor, hasta: anchor }
  if (vista === "semana") {
    const dow = (anchor.getDay() + 6) % 7 // 0 = lunes
    const lunes = new Date(anchor); lunes.setDate(anchor.getDate() - dow)
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
    return { desde: lunes, hasta: domingo }
  }
  const desde = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const hasta = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  return { desde, hasta }
}

function desplazar(vista: Vista, anchor: Date, dir: 1 | -1): Date {
  const d = new Date(anchor)
  if (vista === "dia") d.setDate(d.getDate() + dir)
  else if (vista === "semana") d.setDate(d.getDate() + 7 * dir)
  else d.setMonth(d.getMonth() + dir)
  return d
}

function etiquetaRango(vista: Vista, desde: Date, hasta: Date): string {
  if (vista === "dia") return desde.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  if (vista === "semana") return `${desde.getDate()} – ${hasta.getDate()} de ${MESES[hasta.getMonth()]} ${hasta.getFullYear()}`
  return `${MESES[desde.getMonth()]} ${desde.getFullYear()}`
}

export function TyCHistorialCapacitacionesPage() {
  const navigate = useNavigate()
  const [vista, setVista]   = useState<Vista>("mes")
  const [anchor, setAnchor] = useState(new Date())
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos")
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)

  const { desde, hasta } = useMemo(() => rango(vista, anchor), [vista, anchor])
  const hoyISO = toISO(new Date())

  const load = useCallback(() => {
    setLoading(true)
    api.get("/tc/eventos", { params: { desde: toISO(desde), hasta: toISO(hasta) } })
      .then((r) => setEventos(r.data))
      .catch(() => setEventos([]))
      .finally(() => setLoading(false))
  }, [desde, hasta])

  useEffect(() => { load() }, [load])

  const filtrados = (tipoFiltro === "todos" ? eventos : eventos.filter((e) => e.tipo === tipoFiltro))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  return (
    <PageLayout title="T&C — Ver todas las capacitaciones" mainClassName="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        <button
          onClick={() => navigate("/tc/calendario")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a la agenda
        </button>

        <h1 className="text-xl font-bold mb-1">Ver todas las capacitaciones</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Antiguas y por hacer — las antiguas muestran si ya se registró el acta de asistencia.
        </p>

        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(["dia", "semana", "mes"] as Vista[]).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  vista === v ? "bg-teal-500/20 text-teal-400" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setAnchor((a) => desplazar(vista, a, -1))} className="p-1.5 rounded-lg hover:bg-muted/10 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium capitalize min-w-[180px] text-center" style={{ fontFamily: "'DM Mono', monospace" }}>
              {etiquetaRango(vista, desde, hasta)}
            </span>
            <button onClick={() => setAnchor((a) => desplazar(vista, a, 1))} className="p-1.5 rounded-lg hover:bg-muted/10 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="input-base text-xs py-1.5 w-auto">
            <option value="todos">Todos los tipos</option>
            {TC_EVENTO_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-10">Cargando…</p>
          ) : filtrados.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">Sin capacitaciones en este rango.</p>
          ) : (
            filtrados.map((ev) => {
              const esPasado = ev.fecha < hoyISO
              return (
                <button
                  key={ev.id}
                  onClick={() => navigate(`/tc/eventos/${ev.id}`)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/5 hover:bg-muted/10 hover:border-border/80 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.titulo}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>{new Date(ev.fecha + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
                      <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{ev.hora_inicio}–{ev.hora_fin}</span>
                      {ev.lugar && <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{ev.lugar}</span>}
                      {ev.total_personas > 0 && <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{ev.total_personas}</span>}
                    </div>
                  </div>
                  {esPasado && (
                    <span className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                      ev.asistencia_completa ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {ev.asistencia_completa ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {ev.asistencia_completa ? "Acta completa" : "Acta pendiente"}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </PageLayout>
  )
}

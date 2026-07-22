import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { TC_EVENTO_TIPOS, type TcEventoTipo, type TcEventoEstado } from "@/lib/tc-constants"
import { Plus, ChevronLeft, ChevronRight, Calendar, Users, MapPin, Clock, History } from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Evento {
  id: number
  titulo: string
  tipo: TcEventoTipo
  fecha: string
  hora_inicio: string
  hora_fin: string
  lugar: string
  estado: TcEventoEstado
  area_nombre: string
  total_personas: number
  notificacion_enviada: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_COLOR: Record<TcEventoTipo, string> = {
  induccion: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  curso:     "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  reunion:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  otro:      "bg-muted/30 text-muted-foreground border-border",
}

const ESTADO_DOT: Record<TcEventoEstado, string> = {
  "Programado": "bg-teal-400",
  "En curso":   "bg-amber-400",
  "Completado": "bg-emerald-400",
  "Cancelado":  "bg-muted-foreground",
}

function tipoLabel(tipo: string) {
  return TC_EVENTO_TIPOS.find((t) => t.value === tipo)?.label ?? tipo
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Dom
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

// ── Componente ────────────────────────────────────────────────────────────────

export function TyCCalendarioPage() {
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const hoy = new Date()
  const [year, setYear]   = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth())
  const [eventos, setEventos] = useState<Evento[]>([])
  const [filtroTipo, setFiltroTipo] = useState<string>("todos")
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const mes = `${year}-${String(month + 1).padStart(2, "0")}`

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/tc/eventos?mes=${mes}`)
      .then((r) => setEventos(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mes])

  useEffect(() => { load() }, [load])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setDiaSeleccionado(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setDiaSeleccionado(null)
  }

  const eventosFiltrados = filtroTipo === "todos"
    ? eventos
    : eventos.filter((e) => e.tipo === filtroTipo)

  const eventosPorDia = (dia: number) =>
    eventosFiltrados.filter((e) => parseInt(e.fecha.split("-")[2]) === dia)

  const eventosDelDia = diaSeleccionado
    ? eventosPorDia(diaSeleccionado)
    : eventosFiltrados

  const diasEnMes = getDaysInMonth(year, month)
  const primerDia = getFirstDayOfMonth(year, month) // 0=Dom

  return (
    <PageLayout title="Agenda T&C" mainClassName="flex-1 overflow-y-auto">

      {/* ── Header ── */}
      <div className="border-b border-border px-8 pt-8 pb-6">
        <div className="max-w-6xl mx-auto flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">
              Talento y Cultura · Agenda
            </p>
            <h1 className="text-2xl font-bold">Calendario de eventos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Inducciones, cursos, reuniones y capacitaciones
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Filtro tipo */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {[{ value: "todos", label: "Todos" }, ...TC_EVENTO_TIPOS].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setFiltroTipo(t.value)}
                  className={`px-3 py-1.5 transition-colors ${
                    filtroTipo === t.value
                      ? "bg-teal-500/20 text-teal-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate("/tc/agenda/historial")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/10 text-xs font-semibold transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              Ver todas las capacitaciones
            </button>
            {puedeEditar && (
              <button
                onClick={() => navigate("/tc/eventos/nuevo")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo evento
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6 flex gap-6">

        {/* ── Calendario grid ── */}
        <div className="flex-1 min-w-0">
          {/* Nav mes */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted/10 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>
              {MESES[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted/10 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grid días semana */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_CORTOS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grid días mes */}
          <div className="grid grid-cols-7 gap-0.5">
            {/* Espacios vacíos antes del día 1 */}
            {Array.from({ length: primerDia }).map((_, i) => (
              <div key={`e-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: diasEnMes }).map((_, i) => {
              const dia = i + 1
              const evs = eventosPorDia(dia)
              const isHoy = year === hoy.getFullYear() && month === hoy.getMonth() && dia === hoy.getDate()
              const isSelected = diaSeleccionado === dia
              return (
                <button
                  key={dia}
                  onClick={() => setDiaSeleccionado(isSelected ? null : dia)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 px-1 text-xs transition-all ${
                    isSelected
                      ? "bg-teal-500/20 border border-teal-500/40"
                      : isHoy
                      ? "border border-teal-500/30 bg-teal-500/5"
                      : "hover:bg-muted/10 border border-transparent"
                  }`}
                >
                  <span className={`text-[11px] font-semibold tabular-nums leading-none ${isHoy ? "text-teal-400" : ""}`}>
                    {dia}
                  </span>
                  {evs.length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {evs.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            ev.tipo === "induccion" ? "bg-teal-400" :
                            ev.tipo === "curso"     ? "bg-indigo-400" :
                            ev.tipo === "reunion"   ? "bg-amber-400" : "bg-muted-foreground"
                          }`}
                        />
                      ))}
                      {evs.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{evs.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-4 flex items-center gap-4 text-[10px] text-muted-foreground">
            {TC_EVENTO_TIPOS.map((t) => (
              <span key={t.value} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  t.value === "induccion" ? "bg-teal-400" :
                  t.value === "curso"     ? "bg-indigo-400" :
                  t.value === "reunion"   ? "bg-amber-400" : "bg-muted-foreground"
                }`} />
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Panel lateral: eventos ── */}
        <div className="w-80 shrink-0 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            {diaSeleccionado
              ? `${diaSeleccionado} de ${MESES[month]}`
              : `${MESES[month]} ${year}`}
            {" · "}
            {loading ? "..." : `${eventosDelDia.length} evento${eventosDelDia.length !== 1 ? "s" : ""}`}
          </p>

          {!loading && eventosDelDia.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Sin eventos{diaSeleccionado ? " este día" : " este mes"}
            </div>
          )}

          {eventosDelDia.map((ev) => (
            <button
              key={ev.id}
              onClick={() => navigate(`/tc/eventos/${ev.id}`)}
              className="w-full text-left rounded-xl border border-border bg-muted/5 hover:bg-muted/10 hover:border-border/80 p-3 transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIPO_COLOR[ev.tipo as TcEventoTipo] ?? TIPO_COLOR.otro}`}>
                  {tipoLabel(ev.tipo)}
                </span>
                <span className={`flex items-center gap-1 text-[10px] text-muted-foreground`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_DOT[ev.estado as TcEventoEstado] ?? "bg-muted-foreground"}`} />
                  {ev.estado}
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug">{ev.titulo}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {ev.hora_inicio} – {ev.hora_fin}
                </span>
                {ev.lugar && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" />
                    {ev.lugar}
                  </span>
                )}
                {ev.total_personas > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-2.5 h-2.5" />
                    {ev.total_personas} persona{ev.total_personas !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

      </div>
    </PageLayout>
  )
}

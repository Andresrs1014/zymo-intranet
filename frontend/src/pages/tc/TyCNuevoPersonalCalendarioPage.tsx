import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { Plus, ChevronLeft, ChevronRight, Calendar, Users, Clock } from "lucide-react"

interface Bloque {
  id: number
  lider_nombre: string
  hora_inicio: string
  hora_fin: string
  estado: "Agendado" | "En curso" | "Finalizado"
  total_incluidos: number
}
interface Dia {
  id: number
  fecha: string
  titulo: string
  descripcion: string
  sede_nombre: string
  bloques: Bloque[]
  total_personas: number
}

const ESTADO_DOT: Record<Bloque["estado"], string> = {
  "Agendado": "bg-teal-400",
  "En curso": "bg-amber-400",
  "Finalizado": "bg-emerald-400",
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export function TyCNuevoPersonalCalendarioPage() {
  const navigate = useNavigate()
  const hoy = new Date()
  const [year, setYear]   = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth())
  const [dias, setDias] = useState<Dia[]>([])
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const mes = `${year}-${String(month + 1).padStart(2, "0")}`

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/tc/cap-coordinador/dias?mes=${mes}`)
      .then((r) => setDias(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mes])

  useEffect(() => { load() }, [load])

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) } else setMonth((m) => m - 1)
    setDiaSeleccionado(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) } else setMonth((m) => m + 1)
    setDiaSeleccionado(null)
  }

  const diasPorFecha = (dia: number) =>
    dias.filter((d) => parseInt(d.fecha.split("-")[2]) === dia)

  const diasDelDia = diaSeleccionado ? diasPorFecha(diaSeleccionado) : dias

  const diasEnMes = getDaysInMonth(year, month)
  const primerDia = getFirstDayOfMonth(year, month)

  function nuevoDesdeCalendario(dia: number) {
    const fecha = `${year}-${String(month + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
    navigate(`/tc/nuevo-personal/nuevo?fecha=${fecha}`)
  }

  return (
    <PageLayout title="Inducción Nuevo personal" mainClassName="flex-1 overflow-y-auto">
      <div className="border-b border-border px-8 pt-8 pb-6">
        <div className="max-w-6xl mx-auto flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">T&C · Coordinador</p>
            <h1 className="text-2xl font-bold">Inducción Nuevo personal</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Click en un día para agendar esa fecha, con uno o varios líderes por horario.
            </p>
          </div>
          <button
            onClick={() => navigate("/tc/nuevo-personal/nuevo")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva inducción
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6 flex gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} aria-label="Mes anterior" className="p-1.5 rounded-lg hover:bg-muted/10 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>
              {MESES[month]} {year}
            </h2>
            <button onClick={nextMonth} aria-label="Mes siguiente" className="p-1.5 rounded-lg hover:bg-muted/10 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DIAS_CORTOS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: primerDia }).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
            {Array.from({ length: diasEnMes }).map((_, i) => {
              const dia = i + 1
              const ds = diasPorFecha(dia)
              const isHoy = year === hoy.getFullYear() && month === hoy.getMonth() && dia === hoy.getDate()
              const isSelected = diaSeleccionado === dia
              return (
                <button
                  key={dia}
                  onClick={() => setDiaSeleccionado(isSelected ? null : dia)}
                  onDoubleClick={() => nuevoDesdeCalendario(dia)}
                  title="Doble click para agendar este día"
                  className={`aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 px-1 text-xs transition-all ${
                    isSelected ? "bg-teal-500/20 border border-teal-500/40"
                      : isHoy ? "border border-teal-500/30 bg-teal-500/5"
                      : "hover:bg-muted/10 border border-transparent"
                  }`}
                >
                  <span className={`text-[11px] font-semibold tabular-nums leading-none ${isHoy ? "text-teal-400" : ""}`}>{dia}</span>
                  {ds.length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {ds.slice(0, 3).map((d) => <span key={d.id} className="w-1.5 h-1.5 rounded-full bg-teal-400" />)}
                      {ds.length > 3 && <span className="text-[9px] text-muted-foreground">+{ds.length - 3}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">Doble click en un día para agendar directamente esa fecha.</p>
        </div>

        <div className="w-80 shrink-0 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {diaSeleccionado ? `${diaSeleccionado} de ${MESES[month]}` : `${MESES[month]} ${year}`}
              {" · "}{loading ? "…" : `${diasDelDia.length} día${diasDelDia.length !== 1 ? "s" : ""}`}
            </p>
            {diaSeleccionado && (
              <button
                onClick={() => nuevoDesdeCalendario(diaSeleccionado)}
                className="text-[10px] text-teal-400 hover:text-teal-300 font-semibold"
              >
                + Agendar
              </button>
            )}
          </div>

          {!loading && diasDelDia.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Sin capacitaciones{diaSeleccionado ? " este día" : " este mes"}
            </div>
          )}

          {diasDelDia.map((d) => (
            <button
              key={d.id}
              onClick={() => navigate(`/tc/nuevo-personal/${d.id}`)}
              className="w-full text-left rounded-xl border border-border bg-muted/5 hover:bg-muted/10 hover:border-border/80 p-3 transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-teal-500/15 text-teal-400 border-teal-500/30">
                  {d.bloques.length} bloque{d.bloques.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug">{d.titulo}</p>
              {d.sede_nombre && <p className="text-[10px] text-teal-400 font-medium mt-0.5">{d.sede_nombre}</p>}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                {d.total_personas > 0 && <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{d.total_personas}</span>}
              </div>
              {d.bloques.length > 0 && (
                <div className="mt-2 space-y-1">
                  {d.bloques.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{b.hora_inicio}–{b.hora_fin} · {b.lider_nombre}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_DOT[b.estado]}`} />
                        {b.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}

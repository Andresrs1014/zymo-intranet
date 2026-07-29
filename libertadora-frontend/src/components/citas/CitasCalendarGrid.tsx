import { Fragment, useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { LibCita } from "@/types/libertadora"

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]

const ESTADO_COLOR: Record<string, string> = {
  confirmed: "var(--lib-teal)",
  pending: "var(--lib-warn)",
  cancelled: "var(--lib-red)",
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

// Ported 1:1 de getWk() — lunes a viernes de la semana actual + offset.
function getWeek(offset: number): Date[] {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

interface CitasCalendarGridProps {
  citas: LibCita[]
  onNew: (fecha: string, hora: string) => void
  onEdit: (cita: LibCita) => void
}

export function CitasCalendarGrid({ citas, onNew, onEdit }: CitasCalendarGridProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const week = getWeek(weekOffset)
  const todayIso = isoDate(new Date())
  const weekIsoSet = new Set(week.map(isoDate))

  const weekCitas = citas.filter((c) => weekIsoSet.has(c.fecha))
  const kpis = {
    total: weekCitas.length,
    confirmadas: weekCitas.filter((c) => c.estado === "confirmed").length,
    pendientes: weekCitas.filter((c) => c.estado === "pending").length,
    canceladas: weekCitas.filter((c) => c.estado === "cancelled").length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={() => setWeekOffset((o) => o - 1)} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Semana anterior
        </Button>
        <span className="flex-1 text-center text-sm font-bold text-zinc-700">
          {week[0].getDate()} {MESES[week[0].getMonth()]} — {week[4].getDate()} {MESES[week[4].getMonth()]} {week[4].getFullYear()}
        </span>
        <Button type="button" variant="outline" onClick={() => setWeekOffset((o) => o + 1)} className="gap-1.5">
          Siguiente semana <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[70px_repeat(5,1fr)] gap-px overflow-hidden rounded-t-lg bg-zinc-200">
          <div style={{ background: "var(--lib-navy)" }} />
          {week.map((d, i) => (
            <div
              key={i}
              className="p-2 text-center text-white"
              style={{ background: isoDate(d) === todayIso ? "var(--lib-teal)" : "var(--lib-navy)" }}
            >
              <div className="text-[11px] font-semibold">{DIAS[i]}</div>
              <div className="text-lg font-extrabold">{d.getDate()}</div>
            </div>
          ))}
          {SLOTS.map((slot) => (
            <Fragment key={slot}>
              <div className="bg-zinc-50 p-1.5 text-right text-[10px] font-semibold text-zinc-400">{slot}</div>
              {week.map((d, i) => {
                const iso = isoDate(d)
                const hour = slot.split(":")[0]
                const items = citas.filter((c) => c.fecha === iso && c.hora?.startsWith(hour))
                return (
                  <div
                    key={`${slot}-${i}`}
                    className="min-h-[48px] cursor-pointer bg-white p-1 transition-colors hover:bg-[color:var(--lib-teal-l)]"
                    onClick={() => onNew(iso, slot)}
                  >
                    {items.map((c) => (
                      <div
                        key={c.id}
                        className="mb-0.5 truncate rounded px-1.5 py-0.5 text-[9.5px] text-white"
                        style={{ background: ESTADO_COLOR[c.estado] }}
                        onClick={(e) => { e.stopPropagation(); onEdit(c) }}
                        title={`${c.cliente} · ${c.producto} · ${c.modalidad}`}
                      >
                        {c.hora} {c.cliente.split(" ")[0].slice(0, 10)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-zinc-100 px-3 py-2 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: "var(--lib-teal)" }} /> Confirmada</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: "var(--lib-warn)" }} /> Pendiente</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: "var(--lib-red)" }} /> Cancelada</span>
          <Button type="button" size="sm" className="ml-auto gap-1.5" style={{ background: "var(--lib-teal)" }} onClick={() => onNew(todayIso, "09:00")}>
            <Plus className="h-3.5 w-3.5" /> Nueva cita
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Citas esta semana", value: kpis.total, accent: "var(--lib-teal)" },
          { label: "Confirmadas", value: kpis.confirmadas, accent: "var(--lib-green)" },
          { label: "Pendientes", value: kpis.pendientes, accent: "var(--lib-warn)" },
          { label: "Canceladas", value: kpis.canceladas, accent: "var(--lib-red)" },
        ].map((k) => (
          <Card key={k.label} className="border-l-4 p-3" style={{ borderLeftColor: k.accent }}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{k.label}</p>
            <p className="text-xl font-extrabold text-zinc-900">{k.value}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

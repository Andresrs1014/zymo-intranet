import { useState } from "react"
import { useTasks } from "@/hooks/useTasks"
import type { PersonSummary, Task, ListConfig } from "@/types/task"
import "./tareas.css"

type StateFilter = "todas" | "hecha" | "curso"

function fmtMin(min: number): string {
  if (min <= 0) return "—"
  if (min < 60) return `${Math.round(min)}m`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

interface Props {
  person: PersonSummary
  teamId: number
  estados: ListConfig[]
  onOpenTask: (task: Task) => void
}

// Card roja del colaborador — foto/iniciales centradas, dos estadísticas,
// filtro de estado propio, y panel blanco con la lista de tareas scrolleable.
// Boceto aprobado por el usuario, paleta invertida a propósito respecto al
// resto del módulo (blanco+rojo): acá la card ES roja, el panel interno blanco.
export function PersonSummaryCard({ person, teamId, estados, onOpenTask }: Props) {
  const [filter, setFilter] = useState<StateFilter>("todas")
  const { data: taskResult } = useTasks({ teamId, responsableId: person.userId, limit: 50 })
  const tasks = taskResult?.tasks ?? []

  const isDone = (t: Task) => {
    const cfg = estados.find((e) => e.value === t.estado)
    return !!(cfg?.isFinal || cfg?.isCanceled)
  }

  const filtered = tasks.filter((t) => {
    if (filter === "todas") return true
    if (filter === "hecha") return isDone(t)
    return !isDone(t)
  })

  const avgMin = person.total > 0 ? (person.horasTotal * 60) / person.total : 0
  const initials = person.nombre.trim().slice(0, 2).toUpperCase()

  return (
    <div
      className="flex min-h-[420px] flex-col gap-4 rounded-2xl p-5 text-white transition-transform duration-200 hover:-translate-y-[3px] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{
        background: "linear-gradient(165deg, #a8172f, #d4283e)",
        boxShadow:
          "0 2px 0 rgba(255,255,255,.16) inset, 0 10px 18px -10px rgba(107,15,31,.55), 0 28px 40px -20px rgba(107,15,31,.45)",
        transitionTimingFunction: "cubic-bezier(.2,0,.38,.9)",
      }}
    >
      <div className="flex justify-center pt-0.5">
        <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full bg-white text-[22px] font-extrabold text-[#a8172f] shadow-[0_4px_10px_rgba(0,0,0,.2),0_0_0_4px_rgba(255,255,255,.16)]">
          {initials}
        </div>
      </div>

      <div className="text-center">
        <div className="text-[16px] font-extrabold leading-tight">{person.nombre}</div>
      </div>

      <div className="flex border-y border-white/25 py-3">
        <div className="flex flex-1 flex-col items-center gap-0.5">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">Tareas realizadas</span>
          <span className="font-mono text-[17px] font-extrabold">{person.total}</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-0.5 border-l border-white/25">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">Promedio</span>
          <span className="font-mono text-[17px] font-extrabold">{fmtMin(avgMin)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["todas", "hecha", "curso"] as StateFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
              filter === f ? "bg-white text-[#a8172f]" : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            {f === "todas" ? "Todas" : f === "hecha" ? "Completadas" : "En curso"}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl bg-white py-3 pl-3.5 pr-1">
        <div className="pr-2.5 text-[11px] font-extrabold uppercase tracking-wider text-[#a8172f]">Tareas</div>
        <div className="person-card-scroll min-h-0 flex-1 overflow-y-auto pr-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#a8172f]/60">Sin tareas en este filtro.</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenTask(t)}
                className="flex w-full items-center gap-2 border-b border-[#f4e3e6] py-2 text-left text-[12.5px] font-semibold text-[#a8172f] transition last:border-b-0 hover:bg-[#fff5f6]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4283e]" />
                <span className="flex-1 truncate">{t.titulo}</span>
                <span className="shrink-0 font-mono text-[10px] font-medium text-[#c48b93]">
                  {estados.find((e) => e.value === t.estado)?.label ?? t.estado}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

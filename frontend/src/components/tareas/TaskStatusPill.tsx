import type { TaskAcceptanceStatus } from "@/types/task"

interface Props {
  estadoLabel: string
  estadoColor?: string | null
  aceptacion?: TaskAcceptanceStatus
  vencida?: boolean
}

// Unifica los dos ejes de estado (pipeline `estado` + `aceptacion`) más la señal
// de riesgo `vencida` en un solo grupo de chips legible de un vistazo.
// Diseñado para tema oscuro (paleta ZYMO). No usar púrpura.
export function TaskStatusPill({ estadoLabel, estadoColor, aceptacion, vencida }: Props) {
  const color = estadoColor ?? "#8a94a6"

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
        style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {estadoLabel}
      </span>

      {aceptacion === "pendiente" && (
        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
          Por aceptar
        </span>
      )}
      {aceptacion === "rechazada" && (
        <span className="rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
          Rechazada
        </span>
      )}

      {vencida && (
        <span className="rounded-full border border-[#ef3340]/45 bg-[#ef3340]/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#ff6b75]">
          Vencida
        </span>
      )}
    </div>
  )
}

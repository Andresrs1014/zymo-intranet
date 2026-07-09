import { Badge } from "@/components/ui/badge"
import type { TaskAcceptanceStatus } from "@/types/task"

interface Props {
  estadoLabel: string
  estadoColor?: string | null
  aceptacion?: TaskAcceptanceStatus
  vencida?: boolean
}

// Unifica los dos ejes de estado (pipeline `estado` + `aceptacion`) más la señal
// de riesgo `vencida` en un solo grupo de chips legible de un vistazo.
// Base tipográfica desde el componente Badge del sistema; el color del estado es
// dinámico (cada equipo configura su ListConfig.color) → va por style inline.
export function TaskStatusPill({ estadoLabel, estadoColor, aceptacion, vencida }: Props) {
  const color = estadoColor ?? "#71717a"

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge
        variant="outline"
        className="gap-1.5"
        style={{ background: `${color}18`, color, borderColor: `${color}55` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {estadoLabel}
      </Badge>

      {aceptacion === "pendiente" && (
        <Badge variant="warning" className="text-[10px] uppercase tracking-wide">
          Por aceptar
        </Badge>
      )}
      {aceptacion === "rechazada" && (
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide text-zinc-500">
          Rechazada
        </Badge>
      )}

      {vencida && (
        <Badge
          variant="outline"
          className="border-red-300 bg-red-50 text-[10px] uppercase tracking-wide text-red-600"
        >
          Vencida
        </Badge>
      )}
    </div>
  )
}

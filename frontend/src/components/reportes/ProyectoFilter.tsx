// Chips horizontales para filtrar la lista de reportes por proyecto.
// "Todos" siempre va primero. El chip activo se rellena con el color del proyecto.

import { cn } from "@/lib/utils"
import { colorForProyecto } from "@/lib/reportesShared"

interface Props {
  proyectos: string[]
  selected: string | null
  onChange: (proyecto: string | null) => void
}

export function ProyectoFilter({ proyectos, selected, onChange }: Props) {
  // Si no hay proyectos todavía, no rendereamos el filtro (es ruido vacío).
  if (proyectos.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Filtrar por proyecto"
    >
      <Chip
        active={selected === null}
        color="#71717a"
        onClick={() => onChange(null)}
      >
        Todos
      </Chip>

      {proyectos.map((p) => (
        <Chip
          key={p}
          active={selected === p}
          color={colorForProyecto(p)}
          // Click en el chip ya seleccionado lo deselecciona (toggle).
          onClick={() => onChange(p === selected ? null : p)}
        >
          {p}
        </Chip>
      ))}
    </div>
  )
}

// ── Chip individual ───────────────────────────────────────────────────────────

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color: string
  onClick: () => void
  children: React.ReactNode
}) {
  // Estilos dinámicos solo para el color (no se puede pre-computar con Tailwind).
  const dynamicStyle = active
    ? { backgroundColor: color, borderColor: color, color: "#fff" }
    : { borderColor: `${color}55`, color }

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={dynamicStyle}
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full border text-[11px]",
        "font-mono uppercase tracking-wider font-semibold transition-colors",
        !active && "hover:bg-zinc-50 bg-white",
      )}
    >
      {children}
    </button>
  )
}

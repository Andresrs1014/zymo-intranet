import type { EstadoMantenimiento } from "@/types/mantenimiento"

const ESTADO_CONFIG: Record<
  EstadoMantenimiento,
  { label: string; className: string }
> = {
  solicitud:  { label: "Solicitud",    className: "bg-blue-100 text-blue-700" },
  evaluacion: { label: "Programado",   className: "bg-indigo-100 text-indigo-700" },
  programado: { label: "Programado",   className: "bg-indigo-100 text-indigo-700" },
  ejecucion:  { label: "En Ejecución", className: "bg-orange-100 text-orange-700" },
  completado: { label: "Completado",   className: "bg-green-100 text-green-700" },
  cerrado:    { label: "Completado",   className: "bg-green-100 text-green-700" },
  cancelado:  { label: "Cancelado",    className: "bg-red-100 text-red-700" },
}

interface Props {
  estado: EstadoMantenimiento
  className?: string
}

export function EstadoMantenimientoBadge({ estado, className = "" }: Props) {
  const config = ESTADO_CONFIG[estado] ?? {
    label: estado,
    className: "bg-muted text-muted-foreground",
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  )
}

export function ClasificacionBadge({
  clasificacion,
}: {
  clasificacion: "preventivo" | "correctivo"
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        clasificacion === "preventivo"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {clasificacion === "preventivo" ? "Preventivo" : "Correctivo"}
    </span>
  )
}

export function ModalidadBadge({
  modalidad,
}: {
  modalidad: "interno" | "externo"
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        modalidad === "interno"
          ? "bg-slate-100 text-slate-700"
          : "bg-violet-100 text-violet-700"
      }`}
    >
      {modalidad === "interno" ? "Interno" : "Externo"}
    </span>
  )
}

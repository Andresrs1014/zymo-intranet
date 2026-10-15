/** Insignia de revisión de lo que sube un líder de área (formatos, instructivos, docs extra). Lo aprobado no muestra nada. */
export function EstadoRevision({ estado, comentario }: { estado?: string; comentario?: string | null }) {
  if (estado === "PENDIENTE_REVISION") {
    return <span className="text-[11px] font-mono px-1.5 py-px rounded bg-amber-100 text-amber-700" title="El SIG todavía no lo verifica">En revisión</span>
  }
  if (estado === "RECHAZADO") {
    return <span className="text-[11px] font-mono px-1.5 py-px rounded bg-red-100 text-red-700" title={comentario ?? undefined}>Rechazado{comentario ? `: ${comentario}` : ""}</span>
  }
  return null
}

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

/**
 * Marco común de las pestañas del procedimiento (Instructivos, Formatos, Doc Anexos, Cargos, Flujograma): un lienzo gris,
 * una tarjeta con contorno y una frase de guía que dice qué es esto. El contenido entra escalonado.
 */
export function PanelSIG({ icono: Icono, guia, children }: { icono: LucideIcon; guia: string; children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto bg-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <section className="sig-entra overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm">
          <p className="flex items-start gap-2.5 border-b border-zinc-200 bg-zinc-100/70 px-5 py-3 text-xs leading-relaxed text-zinc-700">
            <Icono className="mt-0.5 h-4 w-4 shrink-0 text-helix-accent-ink" aria-hidden />
            {guia}
          </p>
          <div className="sig-escalona px-5 py-5">{children}</div>
        </section>
      </div>
    </div>
  )
}

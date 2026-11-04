import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { ArrowLeft, Menu, Plus, X, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/*
 * Kit de la versión móvil (diseño Figma "ZYMO móvil"). Todo vive detrás de
 * `md:hidden`: en escritorio no se pinta nada de aquí.
 * Paleta fija del diseño: rojo #C3182A / #FDECEE, tinta #18181B, gris #71717A,
 * borde #E4E4E7, fondo #F4F4F5.
 */

type Izquierda = "menu" | "atras" | "cerrar"

const ICONO_IZQ: Record<Izquierda, LucideIcon> = { menu: Menu, atras: ArrowLeft, cerrar: X }
const ETIQUETA_IZQ: Record<Izquierda, string> = { menu: "Abrir menú", atras: "Volver", cerrar: "Cerrar" }

export function MovilBarraSuperior({
  titulo,
  subtitulo,
  izquierda,
  onIzquierda,
  derecha,
  className,
}: {
  titulo: ReactNode
  subtitulo?: ReactNode
  izquierda?: Izquierda
  onIzquierda?: () => void
  derecha?: ReactNode
  className?: string
}) {
  const Icono = izquierda ? ICONO_IZQ[izquierda] : null
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex shrink-0 items-center gap-1 border-b border-[#E4E4E7] bg-white px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] md:hidden",
        className,
      )}
    >
      {Icono && izquierda && (
        <button
          type="button"
          onClick={onIzquierda}
          aria-label={ETIQUETA_IZQ[izquierda]}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-[#18181B] transition-colors active:bg-[#F4F4F5]"
        >
          <Icono className="size-6" strokeWidth={2} />
        </button>
      )}
      <div className={cn("min-w-0 flex-1 py-1", !Icono && "pl-3")}>
        <h1 className="m-0 truncate text-xl font-bold leading-tight text-[#18181B]">{titulo}</h1>
        {subtitulo && <p className="m-0 truncate text-xs text-[#71717A]">{subtitulo}</p>}
      </div>
      {derecha && <div className="flex shrink-0 items-center">{derecha}</div>}
    </header>
  )
}

export interface MovilNavItem {
  clave: string
  etiqueta: string
  icono: LucideIcon
  activo?: boolean
  /** Ruta interna; si no hay, se usa `onClick`. */
  a?: string
  onClick?: () => void
  insignia?: number
}

export function MovilBarraInferior({ items }: { items: MovilNavItem[] }) {
  return (
    <nav
      aria-label="Secciones del módulo"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#E4E4E7] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.slice(0, 5).map((it) => {
        const contenido = (
          <>
            <span
              className={cn(
                "relative flex h-7 w-[52px] items-center justify-center rounded-full transition-colors motion-reduce:transition-none",
                it.activo && "bg-[#FDECEE]",
              )}
            >
              <it.icono className="size-[22px]" strokeWidth={it.activo ? 2.2 : 1.8} aria-hidden />
              {!!it.insignia && it.insignia > 0 && (
                <span className="absolute -top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C3182A] px-1 font-mono text-[10px] font-medium leading-none text-white">
                  {it.insignia > 99 ? "99+" : it.insignia}
                </span>
              )}
            </span>
            <span className={cn("text-[11px] leading-none", it.activo ? "font-bold" : "font-medium")}>{it.etiqueta}</span>
          </>
        )
        const clase = cn(
          "flex min-h-[4.5rem] flex-1 flex-col items-center justify-center gap-1.5 outline-none focus-visible:bg-[#F4F4F5]",
          it.activo ? "text-[#C3182A]" : "text-[#71717A]",
        )
        return it.a ? (
          <NavLink key={it.clave} to={it.a} className={clase} aria-current={it.activo ? "page" : undefined}>
            {contenido}
          </NavLink>
        ) : (
          <button key={it.clave} type="button" onClick={it.onClick} className={clase} aria-current={it.activo ? "page" : undefined}>
            {contenido}
          </button>
        )
      })}
    </nav>
  )
}

/** Hueco al final del contenido para que la barra inferior (y el botón flotante) no tapen lo último. */
export function MovilEspaciador({ conFab = false }: { conFab?: boolean }) {
  return <div aria-hidden className={cn("md:hidden", conFab ? "h-40" : "h-24")} />
}

export function MovilFab({
  etiqueta,
  titulo,
  onClick,
  a,
  sinBarraInferior = false,
}: {
  etiqueta?: string
  /** Nombre accesible cuando el botón es solo el ícono. */
  titulo?: string
  onClick?: () => void
  a?: string
  sinBarraInferior?: boolean
}) {
  const clase = cn(
    "fixed right-5 z-40 flex h-14 items-center justify-center gap-2 rounded-full bg-[#C3182A] text-white shadow-[0_10px_24px_-8px_rgba(195,24,42,0.55)] transition-transform active:scale-95 motion-reduce:transition-none md:hidden",
    etiqueta ? "px-5 text-sm font-bold" : "w-14",
    sinBarraInferior ? "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]" : "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]",
  )
  const contenido = (
    <>
      <Plus className="size-6" strokeWidth={2.4} aria-hidden />
      {etiqueta && <span>{etiqueta}</span>}
    </>
  )
  if (a) {
    return (
      <NavLink to={a} className={clase} aria-label={etiqueta ?? titulo ?? "Crear"}>
        {contenido}
      </NavLink>
    )
  }
  return (
    <button type="button" onClick={onClick} className={clase} aria-label={etiqueta ?? titulo ?? "Crear"}>
      {contenido}
    </button>
  )
}

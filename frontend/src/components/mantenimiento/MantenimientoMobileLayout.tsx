import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useMantenimientoPortal } from "@/context/MantenimientoPortalContext"

interface Props {
  title: string
  children: ReactNode
  showBack?: boolean
  backTo?: string
}

export function MantenimientoMobileLayout({
  title,
  children,
  showBack,
  backTo,
}: Props) {
  const navigate = useNavigate()
  const portal = useMantenimientoPortal()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-[family-name:var(--font-dm-sans)]">
      <header className="sticky top-0 z-20 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(backTo ?? portal?.listaPath ?? "/")}
            className="p-1 -ml-1 text-muted-foreground hover:text-foreground"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">
            Mantenimiento móvil
          </p>
          <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
        </div>
        {portal?.session.full_name && (
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
            {portal.session.full_name.split(" ")[0]}
          </span>
        )}
      </header>
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">{children}</main>
    </div>
  )
}

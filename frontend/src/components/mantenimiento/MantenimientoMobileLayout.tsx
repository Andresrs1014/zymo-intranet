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
    <div className="min-h-screen bg-background flex flex-col font-[family-name:var(--font-dm-sans)] [color-scheme:light]">
      <header className="sticky top-0 z-20 bg-card border-b border-border px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] flex items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(backTo ?? portal?.listaPath ?? "/")}
            className="p-2 -ml-1 text-muted-foreground hover:text-foreground rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden />
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
      <main className="flex-1 px-4 py-5 pb-[max(20px,env(safe-area-inset-bottom))] max-w-lg mx-auto w-full min-w-0">
        {children}
      </main>
    </div>
  )
}

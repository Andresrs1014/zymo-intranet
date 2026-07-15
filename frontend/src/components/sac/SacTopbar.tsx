import { Send } from "lucide-react"
import { useSacUI } from "@/context/SacContext"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { SacView } from "@/types/sac"

const VIEW_TITLES: Record<SacView, string> = {
  dashboard: "Dashboard",
  records: "Registros",
}

export function SacTopbar() {
  const { activeView, setVisitDialogOpen, setSendSurveyOpen } = useSacUI()

  return (
    <header className="mb-6 flex items-center justify-between gap-2 border border-zinc-200 bg-white px-4 py-4 shadow-sm sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger id="sac-sidebar-trigger" className="h-9 w-9 shrink-0 md:hidden" />
        <div className="min-w-0">
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">Zymo Ally · SAC</p>
          <h1 className="m-0 truncate text-lg font-bold leading-tight text-zinc-900 sm:text-xl">{VIEW_TITLES[activeView]}</h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setSendSurveyOpen(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
        >
          <Send size={15} /> Enviar encuesta
        </button>
        <ShimmerButton type="button" onClick={() => setVisitDialogOpen(true)} className="min-h-[40px]">
          + Reporte de visita
        </ShimmerButton>
      </div>
    </header>
  )
}

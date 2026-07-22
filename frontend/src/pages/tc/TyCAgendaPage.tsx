import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, CalendarClock } from "lucide-react"

export function TyCAgendaPage() {
  const navigate = useNavigate()

  return (
    <PageLayout title="T&C — Agenda" mainClassName="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <button
          onClick={() => navigate("/tc")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-8 mx-auto transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          T&C
        </button>
        <CalendarClock className="w-8 h-8 mx-auto mb-4 text-teal-500/60" />
        <p className="text-sm text-muted-foreground">estamos trabajando en la agenda</p>
      </div>
    </PageLayout>
  )
}

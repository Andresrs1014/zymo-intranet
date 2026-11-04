import { useEffect } from "react"
import { LayoutDashboard, ListChecks, MoreHorizontal, Send } from "lucide-react"
import { useSacUI } from "@/context/SacContext"
import { useSidebar } from "@/components/ui/sidebar"
import { MovilBarraInferior, MovilBarraSuperior, MovilFab } from "@/components/movil/Movil"

/** Barras del módulo SAC en el teléfono; el menú es el SacSidebar (Sheet de shadcn). */
export function SacMovil({ parte }: { parte: "superior" | "inferior" }) {
  const { activeView, setActiveView, setVisitDialogOpen, setSendSurveyOpen } = useSacUI()
  const { toggleSidebar, setOpenMobile } = useSidebar()
  useEffect(() => setOpenMobile(false), [activeView, setOpenMobile])

  if (parte === "superior") {
    return <MovilBarraSuperior titulo="SAC" subtitulo="Fidelización de clientes" izquierda="menu" onIzquierda={toggleSidebar} />
  }
  return (
    <>
      <MovilBarraInferior
        items={[
          { clave: "dashboard", etiqueta: "Dashboard", icono: LayoutDashboard, activo: activeView === "dashboard", onClick: () => setActiveView("dashboard") },
          { clave: "records", etiqueta: "Registros", icono: ListChecks, activo: activeView === "records", onClick: () => setActiveView("records") },
          { clave: "encuesta", etiqueta: "Encuesta", icono: Send, onClick: () => setSendSurveyOpen(true) },
          { clave: "mas", etiqueta: "Más", icono: MoreHorizontal, onClick: toggleSidebar },
        ]}
      />
      <MovilFab etiqueta="Reporte de visita" onClick={() => setVisitDialogOpen(true)} />
    </>
  )
}

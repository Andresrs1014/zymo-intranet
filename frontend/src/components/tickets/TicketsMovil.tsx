import { useEffect } from "react"
import { Kanban, LayoutDashboard, List, MoreHorizontal } from "lucide-react"
import { useTicketsUI } from "@/context/TicketsContext"
import { useSidebar } from "@/components/ui/sidebar"
import { MovilBarraInferior, MovilBarraSuperior, MovilFab } from "@/components/movil/Movil"
import type { TicketView } from "@/types/ticket"

const VISTAS: { view: TicketView; etiqueta: string; icono: typeof List }[] = [
  { view: "list", etiqueta: "Lista", icono: List },
  { view: "board", etiqueta: "Tablero", icono: Kanban },
  { view: "dashboard", etiqueta: "Dashboard", icono: LayoutDashboard },
]

/** Barras del módulo Tickets en el teléfono; el menú es el TicketsSidebar (Sheet de shadcn). */
export function TicketsMovil({ parte }: { parte: "superior" | "inferior" }) {
  const { activeView, setActiveView, setDialogOpen } = useTicketsUI()
  const { toggleSidebar, setOpenMobile } = useSidebar()
  useEffect(() => setOpenMobile(false), [activeView, setOpenMobile])

  if (parte === "superior") {
    return <MovilBarraSuperior titulo="Tickets" subtitulo="PQR de clientes" izquierda="menu" onIzquierda={toggleSidebar} />
  }
  return (
    <>
      <MovilBarraInferior
        items={[
          ...VISTAS.map((v) => ({
            clave: v.view,
            etiqueta: v.etiqueta,
            icono: v.icono,
            activo: activeView === v.view,
            onClick: () => setActiveView(v.view),
          })),
          { clave: "mas", etiqueta: "Más", icono: MoreHorizontal, onClick: toggleSidebar },
        ]}
      />
      <MovilFab etiqueta="Nuevo" onClick={() => setDialogOpen(true)} />
    </>
  )
}

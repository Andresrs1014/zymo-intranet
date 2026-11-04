import { CalendarDays, Inbox, Kanban, List, MoreHorizontal } from "lucide-react"
import { useTask, type TaskView } from "@/context/TaskContext"
import { useMyTasks } from "@/hooks/useTasks"
import { countPendingForMe } from "@/lib/taskWork"
import { useAuthStore } from "@/store/authStore"
import { MovilBarraInferior, MovilBarraSuperior, MovilFab, type MovilNavItem } from "@/components/movil/Movil"
import { VIEW_TITLES } from "./TaskTopbar"

/** Barra superior del módulo en el teléfono (el menú abre el TaskSidebar como panel). */
export function TaskBarraSuperiorMovil({ onMenu }: { onMenu: () => void }) {
  const { activeView } = useTask()
  return <MovilBarraSuperior titulo="Tareas" subtitulo={VIEW_TITLES[activeView]} izquierda="menu" onIzquierda={onMenu} />
}

const VISTAS: { view: TaskView; etiqueta: string; icono: MovilNavItem["icono"] }[] = [
  { view: "mywork", etiqueta: "Mi trabajo", icono: Inbox },
  { view: "list", etiqueta: "Lista", icono: List },
  { view: "board", etiqueta: "Tablero", icono: Kanban },
  { view: "calendar", etiqueta: "Calendario", icono: CalendarDays },
]

export function TaskBarraInferiorMovil({ onMas }: { onMas: () => void }) {
  const { activeView, setActiveView, onNewTask } = useTask()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const { data: myWork } = useMyTasks()
  const pendientes = countPendingForMe(myWork?.tasks ?? [], userId)
  const enPrincipal = VISTAS.some((v) => v.view === activeView)

  const items: MovilNavItem[] = [
    ...VISTAS.map((v) => ({
      clave: v.view,
      etiqueta: v.etiqueta,
      icono: v.icono,
      activo: activeView === v.view,
      onClick: () => setActiveView(v.view),
      insignia: v.view === "mywork" ? pendientes : undefined,
    })),
    { clave: "mas", etiqueta: "Más", icono: MoreHorizontal, activo: !enPrincipal, onClick: onMas },
  ]

  return (
    <>
      <MovilBarraInferior items={items} />
      {(activeView === "mywork" || activeView === "list" || activeView === "board") && (
        <MovilFab onClick={onNewTask} titulo="Nueva tarea" />
      )}
    </>
  )
}

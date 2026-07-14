import { List, Kanban, LayoutDashboard, Ticket } from "lucide-react"
import { useTicketsUI } from "@/context/TicketsContext"
import type { TicketView } from "@/types/ticket"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar"

const NAV_ITEMS: { view: TicketView; label: string; icon: React.ReactNode }[] = [
  { view: "list", label: "Lista", icon: <List size={18} /> },
  { view: "board", label: "Tablero", icon: <Kanban size={18} /> },
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
]

export function TicketsSidebar() {
  const { activeView, setActiveView } = useTicketsUI()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          {/* Badge de marca, mismo tratamiento que el cuadrado "T" de
              TaskSidebar (tareas-v2) — degradado rojo + sombra de contacto,
              consistencia de casa en vez del ícono plano que había antes. */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
            style={{
              background: "linear-gradient(135deg, #c41e3a, #ef3340)",
              boxShadow: "0 4px 12px rgba(196,30,58,0.30)",
            }}
          >
            <Ticket className="h-[18px] w-[18px]" />
          </div>
          <span className="truncate text-sm font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Zymo Ally · Tickets
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ view, label, icon }) => {
                const isActive = activeView === view
                return (
                  <SidebarMenuItem key={view}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={label}
                      onClick={() => setActiveView(view)}
                      className="group/nav relative"
                    >
                      {/* Barra de acento en el borde izquierdo del activo —
                          no solo el tinte de fondo que ya trae shadcn por
                          defecto, mismo patrón que TaskSidebar/HelixSidebar. */}
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute left-0.5 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-primary"
                        />
                      )}
                      <span className="transition-transform duration-150 group-hover/nav:scale-110 group-hover/nav:text-primary">
                        {icon}
                      </span>
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

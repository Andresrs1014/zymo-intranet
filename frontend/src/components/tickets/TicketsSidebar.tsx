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
  { view: "list", label: "Lista", icon: <List /> },
  { view: "board", label: "Tablero", icon: <Kanban /> },
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
]

export function TicketsSidebar() {
  const { activeView, setActiveView } = useTicketsUI()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Ticket className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Zymo Ally · Tickets
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ view, label, icon }) => (
                <SidebarMenuItem key={view}>
                  <SidebarMenuButton
                    isActive={activeView === view}
                    tooltip={label}
                    onClick={() => setActiveView(view)}
                  >
                    {icon}
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

import { useRef, useState } from "react"
import { List, Kanban, LayoutDashboard, Settings, Ticket } from "lucide-react"
import { useTicketsUI } from "@/context/TicketsContext"
import type { TicketView } from "@/types/ticket"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { canConfigTickets } from "@/lib/permissions"
import { useAuthStore } from "@/store/authStore"
import { TicketConfigDialog } from "./TicketConfigDialog"

const NAV_ITEMS: { view: TicketView; label: string; icon: React.ReactNode }[] = [
  { view: "list", label: "Lista", icon: <List size={18} /> },
  { view: "board", label: "Tablero", icon: <Kanban size={18} /> },
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
]

export function TicketsSidebar() {
  const { activeView, setActiveView } = useTicketsUI()
  const { setOpenMobile } = useSidebar()
  const user = useAuthStore((state) => state.user)
  const canConfig = user ? canConfigTickets(user.role, user.app_permissions) : false
  const [configOpen, setConfigOpen] = useState(false)
  const configButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <>
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
      {canConfig && (
        <SidebarFooter className="items-end p-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={configButtonRef}
                  type="button"
                  onClick={() => {
                    setOpenMobile(false)
                    setConfigOpen(true)
                  }}
                  aria-label="Configuraci&oacute;n"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Configuraci&oacute;n</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
      {canConfig && (
        <TicketConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          returnFocusRef={configButtonRef}
        />
      )}
    </>
  )
}

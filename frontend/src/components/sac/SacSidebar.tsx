import { useRef, useState } from "react"
import { LayoutDashboard, ListChecks, Settings, Smile } from "lucide-react"
import { useSacUI } from "@/context/SacContext"
import type { SacView } from "@/types/sac"
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
import { canConfigSAC } from "@/lib/permissions"
import { useAuthStore } from "@/store/authStore"
import { SacConfigDialog } from "./SacConfigDialog"

const NAV_ITEMS: { view: SacView; label: string; icon: React.ReactNode }[] = [
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { view: "records", label: "Registros", icon: <ListChecks size={18} /> },
]

export function SacSidebar() {
  const { activeView, setActiveView } = useSacUI()
  const { setOpenMobile } = useSidebar()
  const user = useAuthStore((state) => state.user)
  const canConfig = user ? canConfigSAC(user.role, user.app_permissions) : false
  const [configOpen, setConfigOpen] = useState(false)
  const configButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
            style={{
              background: "linear-gradient(135deg, #c41e3a, #ef3340)",
              boxShadow: "0 4px 12px rgba(196,30,58,0.30)",
            }}
          >
            <Smile className="h-[18px] w-[18px]" />
          </div>
          <span className="truncate text-sm font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Zymo Ally · SAC
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
        <SacConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          returnFocusRef={configButtonRef}
        />
      )}
    </>
  )
}

import { LayoutDashboard, ListChecks, Smile } from "lucide-react"
import { useSacUI } from "@/context/SacContext"
import type { SacView } from "@/types/sac"
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

const NAV_ITEMS: { view: SacView; label: string; icon: React.ReactNode }[] = [
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { view: "records", label: "Registros", icon: <ListChecks size={18} /> },
]

export function SacSidebar() {
  const { activeView, setActiveView } = useSacUI()

  return (
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
      <SidebarRail />
    </Sidebar>
  )
}

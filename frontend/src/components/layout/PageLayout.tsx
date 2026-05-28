import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { AgentDockedPanel } from "@/components/agent/AgentDockedPanel"
import { useAuthStore } from "@/store/authStore"
import { useAgentPanelStore } from "@/store/agentPanelStore"
import { canSeeGerencial, canUseAgentePanel } from "@/lib/permissions"
import { useMinWidth } from "@/hooks/useMinWidth"
import { SidebarProvider } from "@/components/ui/sidebar"

const LG_PX = 1024

interface PageLayoutProps {
  title: string
  children: React.ReactNode
  /** Clases del `<main>` (scroll, padding). */
  mainClassName?: string
  /** Renderizado entre `TopBar` y `<main>` (por ejemplo pestañas). */
  belowTopBar?: React.ReactNode
  /** Después de `<main>`, dentro de la columna de contenido (p. ej. overlays). */
  afterMain?: React.ReactNode
}

export function PageLayout({
  title,
  children,
  mainClassName = "flex-1 overflow-y-auto px-6 py-8",
  belowTopBar,
  afterMain,
}: PageLayoutProps) {
  const user = useAuthStore((s) => s.user)
  const docked = useAgentPanelStore((s) => s.docked)
  const lg = useMinWidth(LG_PX)

  const agente: "administrativo" | "zymo" | null = user
    ? canUseAgentePanel(user.role, user.area, user.app_permissions)
      ? canSeeGerencial(user.role, user.app_permissions)
        ? "zymo"
        : "administrativo"
      : null
    : null

  const showDockedPanel = Boolean(docked && agente && lg)

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-gray-50">
        <Sidebar />

        <div className="flex flex-1 min-w-0 min-h-0">
          <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
            <TopBar title={title} showAgentDockToggle={Boolean(agente)} />
            {belowTopBar}
            <main className={mainClassName}>{children}</main>
            {afterMain}
          </div>

          {showDockedPanel && agente && user && (
            <aside
              className="hidden lg:flex w-[360px] max-w-[40vw] shrink-0 border-l border-gray-200 bg-white flex-col min-h-0"
              aria-label="Panel del agente"
            >
              <AgentDockedPanel
                agente={agente}
                usuarioNombre={user.full_name ?? user.email}
              />
            </aside>
          )}
        </div>
      </div>
    </SidebarProvider>
  )
}

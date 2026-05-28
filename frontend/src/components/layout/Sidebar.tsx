import { NavLink, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Monitor,
  ShieldCheck,
  Database,
  Truck,
  Building2,
  BarChart3,
  LineChart,
  Cpu,
  CheckSquare,
  ListTodo,
  Layers,
} from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import {
  canSeeOC,
  canSeeSGC,
  canSeeOperativo,
  canSeeFinanciero,
  canSeeGerencial,
  canSeeIT,
  canSeeSIG,
  canSeeExtraccionIA,
  canSubmitDevTasks,
  canManageDevTasks,
  canSeeHelix,
} from "@/lib/permissions"
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"

export function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const perms = user?.app_permissions
  const location = useLocation()

  const showAdministrativo = user ? canSeeOC(user.role, user.area, perms) : false
  const showSGC            = user ? canSeeSGC(user.role, user.area, perms) : false
  const showOperativo      = user ? canSeeOperativo(user.role, user.area, perms) : false
  const showFinanciero     = user ? canSeeFinanciero(user.role, user.area, perms) : false
  const showGerencial      = user ? canSeeGerencial(user.role, perms) : false
  const showIT             = user ? canSeeIT(user.role, perms) : false
  const showSIG            = user ? canSeeSIG(user.role, perms) : false
  const showExtraccionIA   = user ? canSeeExtraccionIA(user.role, perms) : false
  const showGestionTareas  = user
    ? canSubmitDevTasks(user.user_tools ?? []) || canManageDevTasks(user.user_tools ?? [])
    : false
  const showHelix          = user ? canSeeHelix(user.role, perms) : false

  // Derive user initials for the footer avatar
  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U"

  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  function isActive(paths: string[]): boolean {
    return paths.some((p) => location.pathname.startsWith(p))
  }

  return (
    <ShadcnSidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* ── Header: workspace logo ───────────────────────────────────── */}
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            <img src="/brand/zymo_logo.png" alt="ZYMO" className="h-7 w-7 object-contain" />
          </div>
          {!isCollapsed && (
            <div className="leading-none">
              <p className="font-bold text-sm text-sidebar-foreground">ZYMO</p>
              <p className="text-xs text-muted-foreground mt-0.5">Intranet</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* ── Section: Dashboard ──────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem
                to="/dashboard"
                label="Dashboard"
                icon={<LayoutDashboard className="w-4 h-4" />}
                active={isActive(["/dashboard"])}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Section: Módulos ────────────────────────────────────────── */}
        {(showIT || showSGC || showSIG || showOperativo || showAdministrativo ||
          showFinanciero || showGerencial || showExtraccionIA) && (
          <SidebarGroup>
            <SidebarGroupLabel>Módulos disponibles</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {showIT && (
                  <NavItem
                    to="/it"
                    label="IT"
                    icon={<Monitor className="w-4 h-4" />}
                    active={isActive(["/it"])}
                  />
                )}
                {showSGC && (
                  <NavItem
                    to="/sgc"
                    label="SGC"
                    icon={<ShieldCheck className="w-4 h-4" />}
                    active={isActive(["/sgc"])}
                  />
                )}
                {showSIG && (
                  <NavItem
                    to="/sig"
                    label="SIG"
                    icon={<Database className="w-4 h-4" />}
                    active={isActive(["/sig"])}
                  />
                )}
                {showOperativo && (
                  <NavItem
                    to="/operativo"
                    label="Operativo"
                    icon={<Truck className="w-4 h-4" />}
                    active={isActive(["/operativo"])}
                  />
                )}
                {showAdministrativo && (
                  <NavItem
                    to="/administrativo"
                    label="Administrativo"
                    icon={<Building2 className="w-4 h-4" />}
                    active={isActive(["/administrativo", "/oc"])}
                  />
                )}
                {showFinanciero && (
                  <NavItem
                    to="/financiero"
                    label="Financiero"
                    icon={<BarChart3 className="w-4 h-4" />}
                    active={isActive(["/financiero"])}
                  />
                )}
                {showGerencial && (
                  <NavItem
                    to="/gerencial"
                    label="Gerencial"
                    icon={<LineChart className="w-4 h-4" />}
                    active={isActive(["/gerencial"])}
                  />
                )}
                {showExtraccionIA && (
                  <NavItem
                    to="/admin/extraccion-ia"
                    label="Motor IA"
                    icon={<Cpu className="w-4 h-4" />}
                    active={isActive(["/admin/extraccion-ia"])}
                  />
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Section: Herramientas ───────────────────────────────────── */}
        {showGestionTareas && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Mis herramientas</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem
                    to="/herramientas/tareas"
                    label="Gestión de Tareas"
                    icon={<CheckSquare className="w-4 h-4" />}
                    active={isActive(["/herramientas/tareas"])}
                  />
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Tareas V2">
                      <a
                        href="/tareas-v2"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Tareas V2 (nueva pestaña)"
                      >
                        <ListTodo className="w-4 h-4" />
                        <span>Tareas V2</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* ── Section: Planeación ────────────────────────────────────── */}
        {showHelix && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Planeación</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem
                    to="/planeacion/helix"
                    label="Helix Zymo"
                    icon={<Layers className="w-4 h-4" />}
                    active={isActive(["/planeacion/helix"])}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* ── Footer: user avatar ─────────────────────────────────────── */}
      <SidebarSeparator />
      <SidebarFooter className="px-3 py-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 leading-none">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.full_name ?? user?.email ?? "Usuario"}
              </p>
              <p className="truncate text-xs text-muted-foreground mt-0.5 capitalize">
                {user?.role ?? ""}
              </p>
            </div>
          )}
        </div>
      </SidebarFooter>
    </ShadcnSidebar>
  )
}

// ── Internal nav item ─────────────────────────────────────────────────────────

interface NavItemProps {
  to: string
  label: string
  icon: React.ReactNode
  active: boolean
}

function NavItem({ to, label, icon, active }: NavItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <NavLink to={to} aria-label={label}>
          {icon}
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

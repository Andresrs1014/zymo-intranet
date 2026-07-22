import { NavLink, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Monitor,
  ShieldCheck,
  Database,
  Truck,
  Building2,
  Wrench,
  BarChart3,
  LineChart,
  Cpu,
  ListTodo,
  Layers,
  Users,
  Ticket,
  Smile,
} from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import {
  canSeeMantenimiento,
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
  canSeeTyC,
  canSeeTickets,
  canSeeSAC,
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
  const showMantenimiento  = user
    ? canSeeMantenimiento(user.role, perms) && !showAdministrativo
    : false
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
  const showTickets        = user ? canSeeTickets(user.role, perms) : false
  const showSac            = user ? canSeeSAC(user.role, perms) : false
  const showTyC            = user ? canSeeTyC(user.role, perms) : false

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
        {isCollapsed ? (
          <div className="flex items-center justify-center px-1">
            <img src="/brand/zymo_logo.png" alt="ZYMO" className="h-7 w-7 object-contain" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 px-1 py-1">
            <img src="/brand/zymo_logo.png" alt="ZYMO" className="h-10 w-auto object-contain" />
            <p className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground">Intranet</p>
          </div>
        )}
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
          showMantenimiento || showFinanciero || showGerencial || showExtraccionIA || showTyC) && (
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
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="SIG">
                      <a
                        href="/sig"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="SIG (nueva pestaña)"
                      >
                        <Database className="w-4 h-4" />
                        <span>SIG</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
                    active={isActive(["/administrativo", "/oc", "/mantenimiento"])}
                  />
                )}
                {showMantenimiento && (
                  <NavItem
                    to="/mantenimiento"
                    label="Mantenimiento"
                    icon={<Wrench className="w-4 h-4" />}
                    active={isActive(["/mantenimiento"])}
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
                {showTyC && (
                  <NavItem
                    to="/tc"
                    label="T&C"
                    icon={<Users className="w-4 h-4" />}
                    active={isActive(["/tc"])}
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
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Gestión de Tareas">
                      <a
                        href="/tareas-v2"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Gestión de Tareas (nueva pestaña)"
                      >
                        <ListTodo className="w-4 h-4" />
                        <span>Gestión de Tareas</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* ── Section: Planeación ────────────────────────────────────── */}
        {(showHelix || showTickets || showSac) && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Planeación</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {showHelix && (
                    <NavItem
                      to="/planeacion/helix"
                      label="Helix Zymo"
                      icon={<Layers className="w-4 h-4" />}
                      active={isActive(["/planeacion/helix"])}
                    />
                  )}
                  {showTickets && (
                    <NavItem
                      to="/zymoally/tickets"
                      label="Zymo Ally · Tickets"
                      icon={<Ticket className="w-4 h-4" />}
                      active={isActive(["/zymoally/tickets"])}
                    />
                  )}
                  {showSac && (
                    <NavItem
                      to="/zymoally/sac"
                      label="Zymo Ally · SAC"
                      icon={<Smile className="w-4 h-4" />}
                      active={isActive(["/zymoally/sac"])}
                    />
                  )}
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

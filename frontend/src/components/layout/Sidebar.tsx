import { NavLink } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { canSeeOC } from "@/lib/permissions"

export function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const showAdministrativo = user ? canSeeOC(user.role, user.area) : false

  return (
    <aside className="flex h-full w-64 flex-col bg-brand-blue">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-yellow">
          <span className="text-brand-blue font-bold text-sm">Z</span>
        </div>
        <div>
          <p className="text-white font-bold text-base leading-none">ZYMO</p>
          <p className="text-white/50 text-xs mt-0.5">Intranet</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Navegación principal">
        <SidebarLink
          to="/dashboard"
          label="Dashboard"
          icon={<IconDashboard />}
        />

        <SidebarLink
          to="/it"
          label="IT"
          icon={<IconIT />}
        />

        <SidebarLink
          to="/sgc"
          label="SGC"
          icon={<IconSGC />}
        />

        <SidebarLink
          to="/sig"
          label="SIG"
          icon={<IconSIG />}
        />

        {showAdministrativo && (
          <SidebarLink
            to="/administrativo"
            label="Administrativo"
            icon={<IconAdministrativo />}
            matchPaths={["/administrativo", "/oc"]}
          />
        )}
      </nav>
    </aside>
  )
}

// ── Link genérico ─────────────────────────────────────────────────────────────

interface SidebarLinkProps {
  to: string
  label: string
  icon: React.ReactNode
  /** Rutas adicionales que activan el estado activo */
  matchPaths?: string[]
}

function SidebarLink({ to, label, icon, matchPaths }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => {
        const extraActive = matchPaths?.some((p) =>
          window.location.pathname.startsWith(p)
        ) ?? false
        const active = isActive || extraActive
        return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
          active
            ? "bg-white/15 text-white"
            : "text-white/60 hover:bg-white/10 hover:text-white"
        }`
      }}
      aria-label={label}
    >
      <span className="shrink-0 w-5 h-5" aria-hidden="true">
        {icon}
      </span>
      {label}
    </NavLink>
  )
}

// ── Iconos SVG ────────────────────────────────────────────────────────────────

function IconDashboard() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4ZM2 12a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4ZM12 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V4ZM12 12a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4Z" />
    </svg>
  )
}

function IconIT() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5Zm3.293 1.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414-1.414L7.586 10 5.293 7.707a1 1 0 0 1 0-1.414ZM11 12a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3Z" clipRule="evenodd" />
    </svg>
  )
}

function IconSGC() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
    </svg>
  )
}

function IconSIG() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 10a8 8 0 1 1 16 0A8 8 0 0 1 2 10Zm8-3a1 1 0 0 0-1 1v2a1 1 0 0 0 .293.707l1.5 1.5a1 1 0 0 0 1.414-1.414L11 9.586V8a1 1 0 0 0-1-1Z" />
      <path d="M10 3V2a1 1 0 1 0-2 0v1a7.001 7.001 0 0 0-5.865 9.337 1 1 0 0 0 1.868-.674A5 5 0 0 1 10 5v-.001ZM10 3V2a1 1 0 0 1 2 0v1a7.001 7.001 0 0 1 5.865 9.337 1 1 0 0 1-1.868-.674A5 5 0 0 0 10 5V3Z" />
    </svg>
  )
}

function IconAdministrativo() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 0 1 0-1.5h12.5a.75.75 0 0 1 0 1.5H16v13h.25a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5H4Zm3-11a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm.5 3.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm3.5-4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm.5 3.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Z" clipRule="evenodd" />
    </svg>
  )
}

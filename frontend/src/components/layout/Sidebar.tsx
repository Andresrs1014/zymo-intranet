import { NavLink } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useSolicitudes } from "@/hooks/useOC"

export function Sidebar() {
  const user = useAuthStore((s) => s.user)

  const canSeeOC =
    user?.role === "admin" ||
    user?.role === "directivo" ||
    user?.area === "Compras"

  const canApprove =
    user?.role === "admin" || user?.role === "directivo"

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
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <SidebarLink icon="⊞" label="Dashboard" to="/dashboard" />

        {canSeeOC && (
          <>
            <div className="px-3 pt-4 pb-1">
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wider">
                OC Automatizaciones
              </p>
            </div>
            <SidebarLink icon="📋" label="Solicitudes" to="/oc/solicitudes" />
            {canApprove && <AprobacionesLink />}
            <SidebarLink icon="📊" label="KPIs" to="/oc/kpis" />
          </>
        )}
      </nav>
    </aside>
  )
}

/** Link de Aprobaciones con badge de pendientes en tiempo real */
function AprobacionesLink() {
  const { data: pendientes = [] } = useSolicitudes({ estado: "pendiente_aprobacion" })

  return (
    <NavLink
      to="/oc/aprobacion"
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/15 text-white"
            : "text-white/60 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      <span className="text-base" aria-hidden="true">
        ✅
      </span>
      <span className="flex-1">Aprobaciones</span>
      {pendientes.length > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1.5 text-xs font-bold text-white">
          {pendientes.length}
        </span>
      )}
    </NavLink>
  )
}

interface SidebarLinkProps {
  icon: string
  label: string
  to: string
}

function SidebarLink({ icon, label, to }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/15 text-white"
            : "text-white/60 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      <span className="text-base" aria-hidden="true">
        {icon}
      </span>
      {label}
    </NavLink>
  )
}

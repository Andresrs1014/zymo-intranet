import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useSolicitudes } from "@/hooks/useOC"

// Roles con acceso completo (Solicitudes + Aprobaciones + KPIs)
const ROLES_ADMIN_OC = new Set(["admin", "administrativo", "directivo"])
const ROLES_OC_CONFIG = new Set(["admin"])
// Roles con acceso parcial (solo Solicitudes)
const ROLES_COMPRAS_OC = new Set(["compras"])

export function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  const canSeeOC =
    ROLES_ADMIN_OC.has(user?.role ?? "") ||
    ROLES_COMPRAS_OC.has(user?.role ?? "") ||
    user?.area === "Compras"

  const canApprove =
    ROLES_ADMIN_OC.has(user?.role ?? "")

  const canConfigureOC =
    ROLES_OC_CONFIG.has(user?.role ?? "")

  // El bloque OC arranca expandido si la ruta actual es /oc/...
  const [ocExpanded, setOcExpanded] = useState(
    () => location.pathname.startsWith("/oc")
  )

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
          <OCSection
            canApprove={canApprove}
            canConfigureOC={canConfigureOC}
            expanded={ocExpanded}
            onToggle={() => setOcExpanded((v) => !v)}
          />
        )}
      </nav>
    </aside>
  )
}

// ── Sección OC colapsable ─────────────────────────────────────────────────────

function OCSection({
  canApprove,
  canConfigureOC,
  expanded,
  onToggle,
}: {
  canApprove: boolean
  canConfigureOC: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const { data: pendientes = [] } = useSolicitudes(
    { estado: "pendiente_aprobacion" },
  )
  const pendientesCount = canApprove ? pendientes.length : 0

  return (
    <div className="pt-3">
      {/* Botón padre colapsable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      >
        <span className="text-base" aria-hidden="true">🛒</span>
        <span className="flex-1 text-left">OC Automatizaciones</span>

        {/* Badge de pendientes sobre el padre cuando está colapsado */}
        {!expanded && pendientesCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1.5 text-xs font-bold text-white">
            {pendientesCount}
          </span>
        )}

        {/* Flecha */}
        <span
          className={`text-white/40 text-xs transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
      </button>

      {/* Links anidados */}
      {expanded && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
          <SidebarLink icon="📋" label="Solicitudes" to="/oc/solicitudes" />

          {canApprove && (
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
              <span className="text-base" aria-hidden="true">✅</span>
              <span className="flex-1">Aprobaciones</span>
              {pendientesCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1.5 text-xs font-bold text-white">
                  {pendientesCount}
                </span>
              )}
            </NavLink>
          )}

          {canApprove && (
            <SidebarLink icon="📊" label="KPIs" to="/oc/kpis" />
          )}

          {canConfigureOC && (
            <SidebarLink icon="⚙️" label="Configuración" to="/oc/configuracion" />
          )}
        </div>
      )}
    </div>
  )
}

// ── Link genérico ─────────────────────────────────────────────────────────────

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

import { useLogout } from "@/hooks/useAuth"
import { useAuthStore } from "@/store/authStore"
import { getRoleLabel } from "@/lib/roles"

export function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

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
      <nav className="flex-1 px-3 py-4">
        <div className="space-y-0.5">
          <SidebarItem icon="⊞" label="Dashboard" active />
        </div>
      </nav>

      {/* Usuario */}
      <div className="border-t border-white/10 p-4">
        {user && (
          <div className="mb-3 rounded-lg bg-white/10 px-3 py-2.5">
            <p className="text-white font-medium text-sm leading-none truncate">
              {user.full_name ?? user.email}
            </p>
            <p className="text-white/60 text-xs mt-1">
              {getRoleLabel(user.role)}
            </p>
            {user.sede && (
              <p className="text-white/40 text-xs mt-0.5 truncate">
                {user.sede}
                {user.area ? ` · ${user.area}` : ""}
              </p>
            )}
          </div>
        )}

        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

interface SidebarItemProps {
  icon: string
  label: string
  active?: boolean
}

function SidebarItem({ icon, label, active }: SidebarItemProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium cursor-default transition-colors ${
        active
          ? "bg-white/15 text-white"
          : "text-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="text-base" aria-hidden="true">
        {icon}
      </span>
      {label}
    </div>
  )
}

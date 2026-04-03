import { useAuthStore } from "@/store/authStore"
import { getRoleLabel } from "@/lib/roles"

interface TopBarProps {
  title?: string
}

export function TopBar({ title = "Dashboard" }: TopBarProps) {
  const user = useAuthStore((s) => s.user)

  return (
    <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>

      {user && (
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-none">
              {user.full_name ?? user.email}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {getRoleLabel(user.role)}
            </p>
          </div>
          <div className="h-9 w-9 rounded-full bg-brand-blue flex items-center justify-center shrink-0">
            <span className="text-white font-semibold text-sm">
              {(user.full_name ?? user.email).charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}

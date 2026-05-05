import { PageLayout } from "@/components/layout/PageLayout"
import { AppCard } from "@/components/apps/AppCard"
import { getAppsForRole } from "@/lib/roles"
import { useAuthStore } from "@/store/authStore"

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const externalApps = user
    ? getAppsForRole(user.role, user.app_permissions ?? [])
    : []

  return (
    <PageLayout title="Dashboard">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          Bienvenido{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Accesos rápidos a plataformas externas</p>
      </div>

      {externalApps.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay aplicaciones externas asignadas a tu rol. Un administrador puede añadir permisos en{" "}
          <span className="font-medium text-gray-700">Configuración → Roles</span>.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {externalApps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </PageLayout>
  )
}

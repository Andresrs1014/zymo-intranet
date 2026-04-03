import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { AppCard } from "@/components/apps/AppCard"
import { getAppsForRole } from "@/lib/roles"
import { useAuthStore } from "@/store/authStore"

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const apps = user ? getAppsForRole(user.role) : []

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Dashboard" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {apps.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-6">
                {apps.length === 1
                  ? "1 aplicación disponible"
                  : `${apps.length} aplicaciones disponibles`}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {apps.map((app) => (
                  <AppCard key={app.id} app={app} />
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <div className="text-5xl mb-4">🔒</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Sin aplicaciones asignadas
      </h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Tu cuenta no tiene aplicaciones habilitadas. Contacta al administrador
        para solicitar acceso.
      </p>
    </div>
  )
}

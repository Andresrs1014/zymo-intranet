import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { AppCard } from "@/components/apps/AppCard"
import { EXTERNAL_APPS } from "@/lib/roles"
import { useAuthStore } from "@/store/authStore"

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Dashboard" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">
              Bienvenido{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Accesos rápidos a plataformas externas
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXTERNAL_APPS.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

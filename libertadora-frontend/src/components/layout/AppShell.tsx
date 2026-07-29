import { LibertadoraProvider, useLibertadora } from "@/context/LibertadoraContext"
import { AppHeader } from "./AppHeader"
import { TabsBar } from "./TabsBar"
import { DashboardView } from "@/components/dashboard/DashboardView"
import { ProspectosView } from "@/components/prospectos/ProspectosView"
import { CitasView } from "@/components/citas/CitasView"
import { InformeView } from "@/components/informe/InformeView"
import { UsersView } from "@/components/users/UsersView"

function AppContent() {
  const { activeView } = useLibertadora()
  return (
    <>
      {activeView === "dashboard" && <DashboardView />}
      {activeView === "prospectos" && <ProspectosView />}
      {activeView === "citas" && <CitasView />}
      {activeView === "informe" && <InformeView />}
      {activeView === "usuarios" && <UsersView />}
    </>
  )
}

export function AppShell() {
  return (
    <LibertadoraProvider>
      <div className="min-h-screen bg-zinc-50">
        <AppHeader />
        <TabsBar />
        <main className="p-6">
          <AppContent />
        </main>
      </div>
    </LibertadoraProvider>
  )
}

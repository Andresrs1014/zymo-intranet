import { LibertadoraShell } from "@/components/libertadora/LibertadoraShell"
import { useLibertadora } from "@/context/LibertadoraContext"
import { DashboardView } from "@/components/libertadora/dashboard/DashboardView"
import { ProspectosView } from "@/components/libertadora/prospectos/ProspectosView"
import { CitasView } from "@/components/libertadora/citas/CitasView"
import { InformeView } from "@/components/libertadora/informe/InformeView"

function LibertadoraContent() {
  const { activeView } = useLibertadora()
  return (
    <>
      {activeView === "dashboard" && <DashboardView />}
      {activeView === "prospectos" && <ProspectosView />}
      {activeView === "citas" && <CitasView />}
      {activeView === "informe" && <InformeView />}
    </>
  )
}

export function LibertadoraPage() {
  return (
    <LibertadoraShell>
      <LibertadoraContent />
    </LibertadoraShell>
  )
}

import type { ReactNode } from "react"
import { LayoutDashboard, Users, CalendarDays, FileBarChart } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LibertadoraProvider, useLibertadora, type LibertadoraView } from "@/context/LibertadoraContext"
import "@/styles/libertadora.css"

const TABS: { value: LibertadoraView; label: string; icon: ReactNode }[] = [
  { value: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { value: "prospectos", label: "Prospectos", icon: <Users className="h-4 w-4" /> },
  { value: "citas", label: "Citas", icon: <CalendarDays className="h-4 w-4" /> },
  { value: "informe", label: "Informe", icon: <FileBarChart className="h-4 w-4" /> },
]

function LibertadoraTabs() {
  const { activeView, setActiveView } = useLibertadora()
  return (
    <div className="libertadora-scope border-b border-zinc-200 bg-white px-6 py-3">
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as LibertadoraView)}>
        <TabsList className="bg-[color:var(--lib-teal-l)]">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-1.5 data-[state=active]:bg-[color:var(--lib-teal)] data-[state=active]:text-white"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}

export function LibertadoraShell({ children }: { children: ReactNode }) {
  return (
    <LibertadoraProvider>
      <PageLayout title="Libertadora Seguros · CRM Skandia CREA" belowTopBar={<LibertadoraTabs />}>
        <div className="libertadora-scope">{children}</div>
      </PageLayout>
    </LibertadoraProvider>
  )
}

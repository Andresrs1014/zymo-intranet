import type { ReactNode } from "react"
import { LayoutDashboard, Users, CalendarDays, FileBarChart, ShieldCheck } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLibertadora, type LibertadoraView } from "@/context/LibertadoraContext"
import { useSessionStore } from "@/store/sessionStore"

const TABS: { value: LibertadoraView; label: string; icon: ReactNode }[] = [
  { value: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { value: "prospectos", label: "Prospectos", icon: <Users className="h-4 w-4" /> },
  { value: "citas", label: "Citas", icon: <CalendarDays className="h-4 w-4" /> },
  { value: "informe", label: "Informe", icon: <FileBarChart className="h-4 w-4" /> },
]

export function TabsBar() {
  const { activeView, setActiveView } = useLibertadora()
  const isAdmin = useSessionStore((s) => s.isAdmin)
  const tabs = isAdmin
    ? [...TABS, { value: "usuarios" as const, label: "Usuarios", icon: <ShieldCheck className="h-4 w-4" /> }]
    : TABS

  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-3">
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as LibertadoraView)}>
        <TabsList className="bg-[color:var(--lib-teal-l)]">
          {tabs.map((tab) => (
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

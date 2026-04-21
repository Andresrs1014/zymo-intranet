import { useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { useAuthStore } from "@/store/authStore"
import { PanelGerenteTab } from "./tabs/PanelGerenteTab"
import { DirectoraPlaneacionTab } from "./tabs/DirectoraPlaneacionTab"
import { DesarrolloInnovacionTab } from "./tabs/DesarrolloInnovacionTab"

const ROLES_GERENCIALES = new Set(["gerente", "admin"])

type Tab = "gerente" | "directora" | "desarrollo"

function tabInicial(role: string): Tab {
  if (ROLES_GERENCIALES.has(role)) return "gerente"
  return "desarrollo"
}

export function GerencialPage() {
  const user = useAuthStore((s) => s.user)
  const role = user?.role ?? ""
  const esGerencial = ROLES_GERENCIALES.has(role)

  const [activeTab, setActiveTab] = useState<Tab>(() => tabInicial(role))

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: "gerente", label: "Panel Gerente", visible: esGerencial },
    { id: "directora", label: "Directora Planeación y Desarrollo", visible: esGerencial },
    { id: "desarrollo", label: "Desarrollo e Innovación & Planeación y Consultoría", visible: true },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Módulo Gerencial" />

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white px-6">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
            {tabs
              .filter((t) => t.visible)
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  {tab.id === "gerente" ? (
                    <PanelGerenteTabLabel />
                  ) : (
                    tab.label
                  )}
                </button>
              ))}
          </nav>
        </div>

        {/* Contenido del tab activo */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "gerente" && <PanelGerenteTab />}
          {activeTab === "directora" && <DirectoraPlaneacionTab />}
          {activeTab === "desarrollo" && <DesarrolloInnovacionTab />}
        </main>
      </div>
    </div>
  )
}

/**
 * Label del tab Panel Gerente con badge de reportes no leídos.
 */
function PanelGerenteTabLabel() {
  const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001"
  const token = useAuthStore((s) => s.token)
  const [unread, setUnread] = useState<number | null>(null)

  useState(() => {
    fetch(`${BASE_URL}/api/zymo/reportes`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data: { leido: boolean }[]) => {
        if (Array.isArray(data)) {
          setUnread(data.filter((r) => !r.leido).length)
        }
      })
      .catch(() => {})
  })

  return (
    <span className="flex items-center gap-1.5">
      Panel Gerente
      {unread !== null && unread > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </span>
  )
}

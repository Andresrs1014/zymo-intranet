import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { useAuthStore } from "@/store/authStore"
import { canSeeGerencial } from "@/lib/permissions"
import { PanelGerenteTab } from "./tabs/PanelGerenteTab"

type Tab = "gerente"

export function GerencialPage() {
  const user = useAuthStore((s) => s.user)
  const esGerencial = user ? canSeeGerencial(user.role, user.app_permissions) : false

  const [activeTab, setActiveTab] = useState<Tab>("gerente")

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: "gerente", label: "Panel Gerente", visible: esGerencial },
  ]

  return (
    <PageLayout
      title="Módulo Gerencial"
      belowTopBar={
        <div className="border-b border-border bg-card px-6 shrink-0">
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
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
          </nav>
        </div>
      }
      mainClassName="flex-1 overflow-y-auto min-h-0"
    >
          {activeTab === "gerente" && <PanelGerenteTab />}
    </PageLayout>
  )
}

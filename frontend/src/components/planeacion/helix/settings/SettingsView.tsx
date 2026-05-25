import { useState, type CSSProperties } from "react"
import { SubprojectsPanel } from "./SubprojectsPanel"
import { ResponsiblesPanel } from "./ResponsiblesPanel"
import { AlertasSettingsPanel } from "./AlertasSettingsPanel"
import { ActividadesRegistryPanel } from "./ActividadesRegistryPanel"

type SettingsTab = "subproyectos" | "responsables" | "alertas" | "actividades"

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "subproyectos",  label: "Subproyectos" },
  { id: "responsables",  label: "Responsables" },
  { id: "alertas",       label: "Alertas" },
  { id: "actividades",   label: "Actividades" },
]

const containerStyle: CSSProperties = {
  background: "var(--helix-bg)",
  minHeight: "100%",
}

const tabBarStyle: CSSProperties = {
  display: "flex",
  gap: "2px",
  padding: "16px 24px 0",
  borderBottom: "1px solid var(--helix-line)",
  background: "var(--helix-surface)",
  flexWrap: "wrap",
}

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: "9px 18px",
    borderRadius: "var(--helix-r-regular) var(--helix-r-regular) 0 0",
    fontSize: "var(--helix-text-body-sm)",
    fontWeight: active ? 700 : 500,
    color: active ? "var(--helix-accent)" : "var(--helix-muted)",
    background: active ? "var(--helix-bg)" : "transparent",
    border: active ? "1px solid var(--helix-line)" : "1px solid transparent",
    borderBottom: active ? "1px solid var(--helix-bg)" : "1px solid transparent",
    cursor: "pointer",
    marginBottom: active ? "-1px" : "0",
    transition: "color var(--helix-transition), background var(--helix-transition)",
    outline: "none",
    fontFamily: "var(--helix-font)",
    whiteSpace: "nowrap",
  }
}

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("subproyectos")

  return (
    <div style={containerStyle}>
      <div style={tabBarStyle}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            style={tabStyle(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "subproyectos"  && <SubprojectsPanel />}
        {activeTab === "responsables"  && <ResponsiblesPanel />}
        {activeTab === "alertas"       && <AlertasSettingsPanel />}
        {activeTab === "actividades"   && <ActividadesRegistryPanel />}
      </div>
    </div>
  )
}

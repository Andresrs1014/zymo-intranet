import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Kanban,
  GanttChart,
  BarChart3,
  TrendingUp,
  LifeBuoy,
  Settings,
} from "lucide-react"
import { useHelix, type HelixView } from "@/context/HelixContext"
import { helixApi } from "@/lib/helixApi"
import type { HelixUsuario } from "@/types/helix"

interface NavItem {
  view: HelixView
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "Panel", icon: <LayoutDashboard size={18} /> },
  { view: "board", label: "Scrum", icon: <Kanban size={18} /> },
  { view: "gantt", label: "Gantt", icon: <GanttChart size={18} /> },
  { view: "reports", label: "Estados", icon: <BarChart3 size={18} /> },
  { view: "businessCase", label: "Valor", icon: <TrendingUp size={18} /> },
  { view: "support", label: "Soporte", icon: <LifeBuoy size={18} /> },
  { view: "settings", label: "Config", icon: <Settings size={18} /> },
]

export function HelixSidebar() {
  const { activeView, setActiveView } = useHelix()
  const [usuarios, setUsuarios] = useState<HelixUsuario[]>([])

  useEffect(() => {
    helixApi
      .get<HelixUsuario[]>("/api/usuarios")
      .then((res) => setUsuarios(res.data))
      .catch(() => setUsuarios([]))
  }, [])

  const visibleUsuarios = usuarios.slice(0, 5)
  const totalActividades = usuarios.length

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "28px",
        padding: "24px",
        background: "linear-gradient(180deg, #2b2f36 0%, #3c414a 46%, #171a1f 100%)",
        color: "#f7fbfa",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.08)",
        minHeight: "100vh",
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.07)",
        }}
      >
        <div
          style={{
            width: "46px",
            height: "46px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #ef3340, #ff6b75)",
            color: "#fff",
            fontSize: "1.7rem",
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          z
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>
            Helix Zymo
          </div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>
            Estructura y evolución
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {NAV_ITEMS.map(({ view, label, icon }) => {
          const isActive = activeView === view
          return (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                minHeight: "44px",
                padding: "10px 12px",
                border: 0,
                borderRadius: "8px",
                background: isActive
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.04)",
                color: isActive ? "#fff" : "#e5e9ff",
                boxShadow: isActive
                  ? "inset 4px 0 0 #ef3340, 0 10px 22px rgba(0,0,0,0.14)"
                  : "none",
                transform: isActive ? "translateX(2px)" : "none",
                transition: "background 160ms, color 160ms, transform 160ms",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {icon}
              {label}
            </button>
          )
        })}
      </nav>

      {/* Team panel */}
      <div
        style={{
          marginTop: "auto",
          padding: "14px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.07)",
        }}
      >
        <h2
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.55)",
            marginBottom: "10px",
          }}
        >
          Equipo
        </h2>

        {visibleUsuarios.length > 0 && (
          <div style={{ display: "flex", marginBottom: "8px" }}>
            {visibleUsuarios.map((u, i) => (
              <div
                key={u.id}
                title={u.full_name}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: "2px solid #2b2f36",
                  marginLeft: i === 0 ? 0 : "-8px",
                  background: u.color ?? "#5461c8",
                  color: "#fff",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {u.initials ?? u.full_name.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", margin: 0 }}>
          {totalActividades} actividades activas
        </p>
      </div>
    </aside>
  )
}

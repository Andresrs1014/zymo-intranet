import { List, Kanban, LayoutDashboard, ChevronLeft, ChevronRight } from "lucide-react"
import { useTicketsUI } from "@/context/TicketsContext"
import type { TicketView } from "@/types/ticket"

const NAV_ITEMS: { view: TicketView; label: string; icon: React.ReactNode }[] = [
  { view: "list", label: "Lista", icon: <List size={18} /> },
  { view: "board", label: "Tablero", icon: <Kanban size={18} /> },
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
]

export function TicketsSidebar() {
  const { activeView, setActiveView, sidebarExpanded: expanded, setSidebarExpanded: setExpanded } = useTicketsUI()
  const width = expanded ? 200 : 64

  return (
    <aside
      style={{
        display: "flex", flexDirection: "column", gap: 8, padding: "16px 8px",
        background: "#ffffff", borderRight: "1px solid #e4e4e7",
        minHeight: "100vh", width, transition: "width 220ms ease", flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: expanded ? "space-between" : "center", marginBottom: 8 }}>
        {expanded && <div style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>Zymo Ally · Tickets</div>}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            width: 28, height: 28, borderRadius: 6, border: "1px solid #e4e4e7",
            background: "#f4f4f5", color: "#52525b", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV_ITEMS.map(({ view, label, icon }) => {
          const isActive = activeView === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              title={!expanded ? label : undefined}
              style={{
                height: 40, border: "none", borderRadius: 8,
                background: isActive ? "rgba(196,30,58,0.10)" : "transparent",
                color: isActive ? "#c41e3a" : "#52525b", cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: expanded ? "flex-start" : "center",
                gap: expanded ? 10 : 0, paddingLeft: expanded ? 10 : 0,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
              }}
            >
              {icon}
              {expanded && <span>{label}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

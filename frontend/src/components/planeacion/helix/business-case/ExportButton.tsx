import { Printer } from "lucide-react"

export function ExportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="helix-no-print"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 18px",
        borderRadius: 8,
        border: "1px solid var(--helix-border)",
        background: "var(--helix-surface)",
        color: "var(--helix-ink)",
        fontSize: "0.85rem",
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 140ms, border-color 140ms",
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = "var(--helix-border)"
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = "var(--helix-surface)"
      }}
    >
      <Printer size={16} />
      Exportar PDF
    </button>
  )
}

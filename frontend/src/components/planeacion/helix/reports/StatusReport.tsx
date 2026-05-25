
interface StatusReportProps {
  report: string
  loading: boolean
}

export function StatusReport({ report, loading }: StatusReportProps) {
  if (loading) {
    return (
      <div
        style={{
          background: "var(--helix-surface)",
          border: "1px solid var(--helix-border)",
          borderRadius: 8,
          padding: 20,
          color: "var(--helix-muted)",
          fontSize: "0.875rem",
          fontStyle: "italic",
        }}
      >
        Generando reporte…
      </div>
    )
  }

  return (
    <pre
      style={{
        background: "var(--helix-surface)",
        border: "1px solid var(--helix-border)",
        borderRadius: 8,
        padding: 20,
        fontFamily: "monospace",
        fontSize: "0.85rem",
        maxHeight: 600,
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        color: "var(--helix-ink)",
        margin: 0,
      }}
    >
      {report}
    </pre>
  )
}

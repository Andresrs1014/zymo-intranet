import React, { useState, useEffect, useRef, useCallback } from "react"
import { helixApi } from "@/lib/helixApi"
import { useHelixROI } from "@/hooks/useHelixROI"
import { StatusReport } from "./StatusReport"
import { FollowupList } from "./FollowupList"
import type { SeguimientoItem } from "./FollowupList"
import { RoiGrid } from "./RoiGrid"

type ActiveTab = "report" | "followups" | "roi"

const TABS: { key: ActiveTab; label: string }[] = [
  { key: "report", label: "Reporte" },
  { key: "followups", label: "Seguimientos" },
  { key: "roi", label: "ROI" },
]

export function ReportsView() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("report")

  // Status report
  const [statusReport, setStatusReport] = useState<string>("")
  const [reportLoading, setReportLoading] = useState(true)
  const [reportError, setReportError] = useState<string | null>(null)
  const reportAbortRef = useRef<AbortController | null>(null)
  const reportFetchCountRef = useRef(0)

  // Seguimientos
  const [seguimientos, setSeguimientos] = useState<SeguimientoItem[]>([])
  const [seguimientosLoading, setSeguimientosLoading] = useState(true)
  const [seguimientosError, setSeguimientosError] = useState<string | null>(null)
  const seguimientosAbortRef = useRef<AbortController | null>(null)
  const seguimientosFetchCountRef = useRef(0)

  // ROI
  const { data: roiData, loading: roiLoading, error: roiError } = useHelixROI()

  const fetchReport = useCallback(() => {
    if (reportAbortRef.current) reportAbortRef.current.abort()
    const controller = new AbortController()
    reportAbortRef.current = controller
    const current = ++reportFetchCountRef.current

    setReportLoading(true)
    helixApi
      .get<{ reporte: string }>("/api/reportes", { signal: controller.signal })
      .then((res) => {
        if (current === reportFetchCountRef.current) {
          setStatusReport(res.data.reporte)
          setReportLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (current === reportFetchCountRef.current) {
          const isAbort = err instanceof Error && err.name === "AbortError"
          const axiosAbort =
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code?: string }).code === "ERR_CANCELED"
          if (!isAbort && !axiosAbort) {
            setReportLoading(false)
            setReportError("No se pudo cargar el reporte")
          }
        }
      })
  }, [])

  const fetchSeguimientos = useCallback(() => {
    if (seguimientosAbortRef.current) seguimientosAbortRef.current.abort()
    const controller = new AbortController()
    seguimientosAbortRef.current = controller
    const current = ++seguimientosFetchCountRef.current

    setSeguimientosLoading(true)
    helixApi
      .get<SeguimientoItem[]>("/api/reportes/seguimientos", {
        signal: controller.signal,
      })
      .then((res) => {
        if (current === seguimientosFetchCountRef.current) {
          setSeguimientos(res.data)
          setSeguimientosLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (current === seguimientosFetchCountRef.current) {
          const isAbort = err instanceof Error && err.name === "AbortError"
          const axiosAbort =
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code?: string }).code === "ERR_CANCELED"
          if (!isAbort && !axiosAbort) {
            setSeguimientosLoading(false)
            setSeguimientosError("No se pudieron cargar los seguimientos")
          }
        }
      })
  }, [])

  useEffect(() => {
    fetchReport()
    fetchSeguimientos()
    return () => {
      reportAbortRef.current?.abort()
      seguimientosAbortRef.current?.abort()
    }
  }, [fetchReport, fetchSeguimientos])

  function handleCopyReport() {
    if (statusReport) {
      navigator.clipboard.writeText(statusReport).catch(() => {
        // silently fail if clipboard not available
      })
    }
  }

  function handleDownloadPDF() {
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reporte de Estado — Helix Zymo</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 32px; color: #121420; }
          pre { white-space: pre-wrap; font-family: monospace; font-size: 13px; line-height: 1.6; }
          h1 { color: #ef3340; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body><pre>${statusReport.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div style={{ padding: 24, color: "var(--helix-ink)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--helix-ink)",
          }}
        >
          Estado del Proyecto
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCopyReport}
            disabled={reportLoading || !statusReport}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--helix-border)",
              background: "var(--helix-surface)",
              color: "var(--helix-ink)",
              fontSize: "0.85rem",
              cursor: reportLoading || !statusReport ? "not-allowed" : "pointer",
              opacity: reportLoading || !statusReport ? 0.5 : 1,
              transition: "opacity 0.2s",
            }}
          >
            Copiar reporte
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={reportLoading || !statusReport}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--helix-border)",
              background: "var(--helix-surface)",
              color: "var(--helix-ink)",
              fontSize: "0.85rem",
              cursor: reportLoading || !statusReport ? "not-allowed" : "pointer",
              opacity: reportLoading || !statusReport ? 0.5 : 1,
              transition: "opacity 0.2s",
            }}
          >
            Descargar PDF
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--helix-border)",
          marginBottom: 20,
          gap: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: activeTab === tab.key ? 600 : 400,
              color:
                activeTab === tab.key
                  ? "var(--helix-accent)"
                  : "var(--helix-muted)",
              borderBottom:
                activeTab === tab.key
                  ? "2px solid var(--helix-accent)"
                  : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content panel */}
      <div>
        {activeTab === "report" && (
          reportError
            ? <p style={{ color: "var(--helix-danger)", fontSize: "0.875rem" }}>{reportError}</p>
            : <StatusReport report={statusReport} loading={reportLoading} />
        )}
        {activeTab === "followups" && (
          seguimientosError
            ? <p style={{ color: "var(--helix-danger)", fontSize: "0.875rem" }}>{seguimientosError}</p>
            : <FollowupList items={seguimientos} loading={seguimientosLoading} />
        )}
        {activeTab === "roi" && (
          roiError
            ? <p style={{ color: "var(--helix-danger)", fontSize: "0.875rem" }}>{roiError}</p>
            : <RoiGrid data={roiData ?? []} loading={roiLoading} />
        )}
      </div>
    </div>
  )
}

import { useHelixROI } from "@/hooks/useHelixROI"
import { computePortfolioMetrics } from "./computePortfolioMetrics"
import { BusinessCaseHero } from "./BusinessCaseHero"
import { SummaryCards } from "./SummaryCards"
import { PortfolioTable } from "./PortfolioTable"
import { ArgumentCards } from "./ArgumentCards"
import { BenchmarkBars } from "./BenchmarkBars"
import { ExportButton } from "./ExportButton"

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  #helix-business-case, #helix-business-case * { visibility: visible; }
  #helix-business-case { position: absolute; inset: 0; padding: 24px; }
  .helix-no-print { display: none !important; }
}
`

export function BusinessCaseView() {
  const { data, loading, error } = useHelixROI()

  if (loading) {
    return (
      <div
        style={{
          color: "var(--helix-muted)",
          fontSize: "0.9rem",
          padding: 32,
          textAlign: "center",
        }}
      >
        Cargando datos del portafolio…
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          color: "var(--helix-danger, #ef4444)",
          fontSize: "0.9rem",
          padding: 32,
          textAlign: "center",
        }}
      >
        Error al cargar portafolio: {error}
      </div>
    )
  }

  const roiData = data ?? []
  const metrics = computePortfolioMetrics(roiData)

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div id="helix-business-case">
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--helix-ink)",
            }}
          >
            Valor del Portafolio
          </h2>
          <ExportButton />
        </div>

        <BusinessCaseHero metrics={metrics} />
        <SummaryCards metrics={metrics} />

        {roiData.length > 0 ? (
          <>
            <ArgumentCards metrics={metrics} />
            <BenchmarkBars data={roiData} metrics={metrics} />
            <PortfolioTable data={roiData} />
          </>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "48px 20px",
              color: "var(--helix-muted)",
              fontSize: "0.95rem",
            }}
          >
            No hay proyectos con datos de ROI disponibles.
            <br />
            <span style={{ fontSize: "0.82rem" }}>
              Configura subproyectos con inversión y retorno para ver el análisis.
            </span>
          </div>
        )}
      </div>
    </>
  )
}

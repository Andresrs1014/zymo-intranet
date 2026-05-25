import { useHelixDashboard } from "@/hooks/useHelixDashboard"
import { useHelixSubproyectos } from "@/hooks/useHelixSubproyectos"
import { MetricsGrid } from "./MetricsGrid"
import { SprintHealth } from "./SprintHealth"
import { BlockersPanel } from "./BlockersPanel"
import { WorkloadPanel } from "./WorkloadPanel"
import { BadgesPanel } from "./BadgesPanel"
import { StatisticsPanel } from "./StatisticsPanel"
import { FlowPanel } from "./FlowPanel"

export function DashboardView() {
  const { data, loading, error, refetch, subproyectoId, setSubproyectoId } =
    useHelixDashboard()
  const { subproyectos } = useHelixSubproyectos()

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "var(--helix-text-h)",
              fontWeight: 800,
              color: "var(--helix-ink)",
              margin: 0,
            }}
          >
            Panel de control
          </h2>
          <p
            style={{
              fontSize: "var(--helix-text-body-sm)",
              color: "var(--helix-muted)",
              margin: "2px 0 0",
            }}
          >
            KPIs, salud del sprint y métricas del equipo
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Subproject filter */}
          <select
            value={subproyectoId ?? ""}
            onChange={(e) => {
              const val = e.target.value
              setSubproyectoId(val === "" ? undefined : Number(val))
            }}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--helix-r-soft)",
              border: "1px solid var(--helix-line)",
              background: "var(--helix-surface)",
              color: "var(--helix-ink)",
              fontSize: "var(--helix-text-body-sm)",
              cursor: "pointer",
            }}
          >
            <option value="">Todos los subproyectos</option>
            {subproyectos.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.nombre}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={refetch}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--helix-r-soft)",
              border: "1px solid var(--helix-line)",
              background: "var(--helix-surface)",
              color: "var(--helix-muted)",
              fontSize: "var(--helix-text-body-sm)",
              cursor: "pointer",
            }}
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
            gap: 12,
            color: "var(--helix-muted)",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: "3px solid var(--helix-line)",
              borderTopColor: "var(--helix-accent)",
              borderRadius: "50%",
              animation: "helix-spin 0.8s linear infinite",
            }}
          />
          Cargando panel...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          style={{
            padding: "16px",
            borderRadius: 8,
            background: "var(--helix-danger-bg)",
            color: "var(--helix-danger-text)",
            fontSize: "var(--helix-text-body-sm)",
            border: "1px solid rgba(239,51,64,0.2)",
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Helix meaning banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          padding: "20px 24px",
          borderRadius: 10,
          background: "linear-gradient(135deg, #1e2128 0%, #2b2f3a 100%)",
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)" }}>
            Significado
          </p>
          <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 800, color: "#fff" }}>
            Inspirado en la estructura del ADN
          </h3>
          <p style={{ margin: 0, fontSize: "0.83rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
            Helix Zymo representa proyectos complejos y bien estructurados: cada subproyecto funciona como una cadena conectada de actividades, responsables, evidencias y aprendizajes que evolucionan con control.
          </p>
        </div>
        <div
          aria-hidden="true"
          style={{
            fontSize: "2.8rem",
            fontWeight: 900,
            color: "rgba(239,51,64,0.35)",
            letterSpacing: "-0.04em",
            userSelect: "none",
            flexShrink: 0,
          }}
        >
          HX
        </div>
      </div>

      {/* Dashboard panels */}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Metrics row */}
          <MetricsGrid metricas={data.metricas} />

          {/* 2-column grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 16,
            }}
          >
            <SprintHealth
              distribucion={data.distribucionEstados}
              proximosHitos={data.proximosHitos}
            />
            <BlockersPanel bloqueadas={data.bloqueadas} />
            <WorkloadPanel carga={data.cargaPorResponsable} />
            <BadgesPanel insignias={data.insignias} />
            <StatisticsPanel estadisticas={data.estadisticasPorResponsable} />
            <FlowPanel subproyectoId={subproyectoId} />
          </div>
        </div>
      )}
    </div>
  )
}

import { useKpisMantenimiento } from "@/hooks/useMantenimiento"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n)

const ORIGEN_LABEL: Record<string, string> = {
  intranet:               "Intranet",
  qr:                     "QR",
  whatsapp:               "WhatsApp",
  telefonico_retroactivo: "Informal",
}

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#ef4444"]

export default function MantenimientoDashboard() {
  const { data, isLoading } = useKpisMantenimiento()

  if (isLoading) {
    return (
      <div style={styles.page}>
        <p style={{ color: "#94a3b8" }}>Cargando tablero...</p>
      </div>
    )
  }

  if (!data) return null

  const { mes_actual: m, por_origen, pendientes_aprobacion } = data

  const origenData = Object.entries(por_origen).map(([k, v]) => ({
    name: ORIGEN_LABEL[k] ?? k,
    value: v,
  }))

  const gastoData = [
    { name: "Preventivo", valor: m.gasto_preventivo },
    { name: "Correctivo", valor: m.gasto_correctivo },
    { name: "Interno",    valor: m.gasto_interno },
    { name: "Externo",    valor: m.gasto_externo },
  ]

  return (
    <div style={styles.page}>
      <h1 style={styles.titulo}>Tablero de Mantenimiento</h1>
      <p style={styles.subtitulo}>Mes actual</p>

      {/* Alertas */}
      {(pendientes_aprobacion > 0 || m.informales > 0) && (
        <div style={styles.alertRow}>
          {pendientes_aprobacion > 0 && (
            <Alerta
              color="#ef4444"
              texto={`${pendientes_aprobacion} solicitud(es) > $2M esperando aprobación`}
            />
          )}
          {m.informales > 0 && (
            <Alerta
              color="#d97706"
              texto={`${m.informales} trabajos informales registrados este mes`}
            />
          )}
        </div>
      )}

      {/* KPIs principales */}
      <div style={styles.kpiGrid}>
        <KpiCard label="Total solicitudes"     valor={m.total} />
        <KpiCard label="Cerradas / Completadas" valor={m.cerradas}   color="#22c55e" />
        <KpiCard label="En curso"              valor={m.en_curso}   color="#2563eb" />
        <KpiCard label="Canceladas"            valor={m.canceladas} color="#ef4444" />
        <KpiCard label="Gasto total mes"       valor={COP(m.gasto_total)} />
      </div>

      {/* Gráficas */}
      <div style={styles.chartGrid}>
        <ChartCard titulo="Gasto por tipo / modalidad">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gastoData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fontSize: 12, fill: "#64748b", fontFamily: "'DM Sans', sans-serif" }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(v: number) => [COP(v), "Gasto"]}
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Bar dataKey="valor" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard titulo="Canal de entrada (acumulado)">
          {origenData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={origenData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  label={({ name, percent }: { name: string; percent: number }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {origenData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#64748b", textAlign: "center", paddingTop: 60 }}>Sin datos aún</p>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

function KpiCard({ label, valor, color }: { label: string; valor: string | number; color?: string }) {
  return (
    <div style={styles.kpiCard}>
      <p style={{ color: "#64748b", fontSize: 12, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
        {label}
      </p>
      <p style={{ color: color ?? "#f1f5f9", fontSize: 24, fontWeight: 700, margin: "8px 0 0", fontFamily: "'DM Mono', monospace" }}>
        {valor}
      </p>
    </div>
  )
}

function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={styles.chartCard}>
      <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 16, margin: "0 0 16px" }}>
        {titulo}
      </p>
      {children}
    </div>
  )
}

function Alerta({ color, texto }: { color: string; texto: string }) {
  return (
    <div
      style={{
        background: `${color}22`,
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: "8px 16px",
        color,
        fontSize: 13,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      ⚠ {texto}
    </div>
  )
}

const styles = {
  page: {
    fontFamily: "'DM Sans', sans-serif",
    padding: "24px 32px",
    background: "#0f172a",
    minHeight: "100vh",
    color: "#f1f5f9",
  } as React.CSSProperties,
  titulo: {
    fontSize: 22,
    fontWeight: 700,
    margin: "0 0 4px",
  } as React.CSSProperties,
  subtitulo: {
    color: "#64748b",
    marginBottom: 24,
    fontSize: 14,
    margin: "0 0 24px",
  } as React.CSSProperties,
  alertRow: {
    display: "flex",
    gap: 12,
    marginBottom: 24,
    flexWrap: "wrap",
  } as React.CSSProperties,
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 16,
    marginBottom: 32,
  } as React.CSSProperties,
  kpiCard: {
    background: "#1e293b",
    borderRadius: 12,
    padding: "16px 20px",
  } as React.CSSProperties,
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 24,
  } as React.CSSProperties,
  chartCard: {
    background: "#1e293b",
    borderRadius: 12,
    padding: 20,
  } as React.CSSProperties,
}

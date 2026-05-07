import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import { taskCard, ETIQUETA_COLOR, ESTADO_LABELS, ETIQUETA_LABELS } from "@/lib/taskTheme"

interface ChartData {
  tareas_por_responsable: { nombre: string; tareas: number }[]
  horas_por_responsable: { nombre: string; horas: number }[]
  distribucion_estado: { estado: string; cantidad: number }[]
  tareas_por_etiqueta: { etiqueta: string; cantidad: number }[]
  evolucion_completadas: { fecha: string; completadas: number }[]
}

interface TaskChartsProps {
  data: ChartData | undefined
}

const PIE_COLORS: Record<string, string> = {
  en_progreso: "#93c5fd",
  completada: "#86efac",
  bloqueada: "#fca5a5",
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${taskCard} p-4`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-gray-400">
      Sin datos suficientes
    </div>
  )
}

export function TaskCharts({ data }: TaskChartsProps) {
  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${taskCard} p-4 h-48 flex items-center justify-center text-sm text-gray-400`}>
            Cargando...
          </div>
        ))}
      </div>
    )
  }

  const tareasResp = data.tareas_por_responsable ?? []
  const horasResp = data.horas_por_responsable ?? []
  const distEstado = data.distribucion_estado ?? []
  const tareasEt = data.tareas_por_etiqueta ?? []
  const evolucion = data.evolucion_completadas ?? []

  const pieData = distEstado.map((d) => ({
    name: ESTADO_LABELS[d.estado] ?? d.estado,
    value: d.cantidad,
    fill: PIE_COLORS[d.estado] ?? "#e5e7eb",
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Tareas por responsable */}
        <ChartCard title="Tareas por responsable">
          {tareasResp.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tareasResp} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <XAxis
                  dataKey="nombre"
                  tick={{ fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="tareas" fill="#6b7280" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 2. Horas por responsable */}
        <ChartCard title="Horas por responsable">
          {horasResp.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={horasResp} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <XAxis
                  dataKey="nombre"
                  tick={{ fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}h`, "Horas"]} />
                <Bar dataKey="horas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 3. Distribución por estado (pie) */}
        <ChartCard title="Distribución por estado">
          {pieData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 4. Tareas por etiqueta */}
        <ChartCard title="Tareas por etiqueta">
          {tareasEt.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tareasEt} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <XAxis
                  dataKey="etiqueta"
                  tick={{ fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  tickFormatter={(v) => ETIQUETA_LABELS[v] ?? v}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v, _n, props) => [v, ETIQUETA_LABELS[props.payload?.etiqueta] ?? props.payload?.etiqueta]} />
                <Bar dataKey="cantidad" radius={[3, 3, 0, 0]}>
                  {tareasEt.map((entry, idx) => {
                    const colorClass = ETIQUETA_COLOR[entry.etiqueta] ?? ""
                    // Extract bg color approximately from Tailwind class
                    const fillMap: Record<string, string> = {
                      desarrollos: "#bfdbfe",
                      actualizaciones: "#e9d5ff",
                      auditorias: "#fed7aa",
                      implementacion_okr: "#99f6e4",
                      tareas_diarias: "#f3f4f6",
                    }
                    return (
                      <Cell
                        key={idx}
                        fill={fillMap[entry.etiqueta] ?? "#e5e7eb"}
                        // suppress unused warning
                        className={colorClass ? undefined : undefined}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* 5. Evolución diaria de completadas (full width) */}
      <ChartCard title="Evolución diaria de tareas completadas">
        {evolucion.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolucion} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completadas"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001"

interface GerencialKPIs {
  timestamp: string
  oc: {
    total_activas: number
    por_estado: Record<string, number>
    alertas: string[]
  }
  desarrollo: {
    tareas_completadas: number
    tareas_en_progreso: number
    tareas_bloqueadas: number
    tiempo_total_invertido_horas: number
  }
  estado_general: "ok" | "alertas_activas"
}

interface ActividadItem {
  tipo: string
  timestamp: string
  descripcion: string
  estado: string
  etiqueta: string
}

interface OrdenRead {
  id: string
  creada_por_nombre: string
  destinatario_nombre: string
  destinatario_area: string
  titulo: string
  descripcion: string | null
  estado: string
  created_at: string
}

interface UserItem {
  id: number
  full_name: string
  email: string
  area: string | null
}

function authHeaders(token: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function PanelGerenteTab() {
  const token = useAuthStore((s) => s.token)
  const [kpis, setKpis] = useState<GerencialKPIs | null>(null)
  const [actividad, setActividad] = useState<ActividadItem[]>([])
  const [ordenes, setOrdenes] = useState<OrdenRead[]>([])
  const [usuarios, setUsuarios] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevaOrden, setNuevaOrden] = useState({ titulo: "", descripcion: "", destinatario_id: "" })
  const [creandoOrden, setCreandoOrden] = useState(false)
  const [mostrarFormOrden, setMostrarFormOrden] = useState(false)

  const headers = authHeaders(token)

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_URL}/api/gerencial/kpis`, { headers }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/gerencial/actividad?limite=15`, { headers }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/gerencial/ordenes`, { headers }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/users`, { headers }).then((r) => r.json()),
    ])
      .then(([k, a, o, u]) => {
        setKpis(k)
        setActividad(Array.isArray(a) ? a : [])
        setOrdenes(Array.isArray(o) ? o : [])
        setUsuarios(Array.isArray(u) ? u : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleCrearOrden(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevaOrden.titulo || !nuevaOrden.destinatario_id) return
    setCreandoOrden(true)
    try {
      const res = await fetch(`${BASE_URL}/api/gerencial/ordenes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          titulo: nuevaOrden.titulo,
          descripcion: nuevaOrden.descripcion || null,
          destinatario_id: parseInt(nuevaOrden.destinatario_id),
        }),
      })
      if (res.ok) {
        const orden: OrdenRead = await res.json()
        setOrdenes((prev) => [orden, ...prev])
        setNuevaOrden({ titulo: "", descripcion: "", destinatario_id: "" })
        setMostrarFormOrden(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreandoOrden(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Cargando datos...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Estado de la empresa
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard
            label="OC Activas"
            value={kpis?.oc.total_activas ?? 0}
            alert={(kpis?.oc.alertas.length ?? 0) > 0}
          />
          <KPICard
            label="Pendientes aprobación"
            value={kpis?.oc.por_estado?.pendiente_aprobacion ?? 0}
            alert={(kpis?.oc.por_estado?.pendiente_aprobacion ?? 0) > 0}
          />
          <KPICard
            label="Tareas en progreso"
            value={kpis?.desarrollo.tareas_en_progreso ?? 0}
          />
          <KPICard
            label="Tareas bloqueadas"
            value={kpis?.desarrollo.tareas_bloqueadas ?? 0}
            alert={(kpis?.desarrollo.tareas_bloqueadas ?? 0) > 0}
          />
        </div>
        {(kpis?.oc.alertas.length ?? 0) > 0 && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            {kpis!.oc.alertas.map((a, i) => (
              <p key={i} className="text-sm text-red-700">🔴 {a}</p>
            ))}
          </div>
        )}
      </section>

      {/* Órdenes directas */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Órdenes directas
          </h2>
          <button
            onClick={() => setMostrarFormOrden((v) => !v)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {mostrarFormOrden ? "Cancelar" : "+ Nueva orden"}
          </button>
        </div>

        {mostrarFormOrden && (
          <form onSubmit={handleCrearOrden} className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Destinatario</label>
              <select
                required
                value={nuevaOrden.destinatario_id}
                onChange={(e) => setNuevaOrden((p) => ({ ...p, destinatario_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Seleccionar persona...</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} {u.area ? `— ${u.area}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Título de la tarea *</label>
              <input
                required
                value={nuevaOrden.titulo}
                onChange={(e) => setNuevaOrden((p) => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej: Revisar contrato con Proveedor XYZ"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descripción (opcional)</label>
              <textarea
                rows={2}
                value={nuevaOrden.descripcion}
                onChange={(e) => setNuevaOrden((p) => ({ ...p, descripcion: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              type="submit"
              disabled={creandoOrden}
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creandoOrden ? "Enviando..." : "Enviar orden"}
            </button>
          </form>
        )}

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {ordenes.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">Sin órdenes activas</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Para</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Tarea</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Estado</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.slice(0, 10).map((o) => (
                  <tr key={o.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-gray-800">{o.destinatario_nombre}</td>
                    <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{o.titulo}</td>
                    <td className="px-4 py-2">
                      <EstadoBadge estado={o.estado} />
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {new Date(o.created_at).toLocaleDateString("es-CO")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Feed de actividad */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Actividad reciente
        </h2>
        <div className="space-y-2">
          {actividad.length === 0 ? (
            <p className="text-sm text-gray-400">Sin actividad reciente</p>
          ) : (
            actividad.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-white border border-gray-100 px-4 py-3">
                <span className="text-lg shrink-0">
                  {item.tipo === "tarea_dev" ? "💻" : "🤖"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{item.descripcion}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(item.timestamp).toLocaleString("es-CO")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function KPICard({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 bg-white ${alert ? "border-red-200" : "border-gray-200"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? "text-red-600" : "text-gray-900"}`}>{value}</p>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    pendiente: "bg-yellow-100 text-yellow-700",
    en_progreso: "bg-blue-100 text-blue-700",
    completada: "bg-green-100 text-green-700",
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] ?? "bg-gray-100 text-gray-600"}`}>
      {estado.replace("_", " ")}
    </span>
  )
}

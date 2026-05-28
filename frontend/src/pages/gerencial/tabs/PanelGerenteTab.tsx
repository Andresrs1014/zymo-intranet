import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Cargando datos...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Órdenes directas
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMostrarFormOrden((v) => !v)}
            className="text-xs font-medium text-brand-blue hover:text-brand-blue/80"
          >
            {mostrarFormOrden ? "Cancelar" : "+ Nueva orden"}
          </Button>
        </div>

        {mostrarFormOrden && (
          <form onSubmit={handleCrearOrden} className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
            <div>
              <Label className="block text-xs font-medium mb-1">Destinatario</Label>
              <select
                required
                value={nuevaOrden.destinatario_id}
                onChange={(e) => setNuevaOrden((p) => ({ ...p, destinatario_id: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
              <Label className="block text-xs font-medium mb-1">Título de la tarea *</Label>
              <Input
                required
                value={nuevaOrden.titulo}
                onChange={(e) => setNuevaOrden((p) => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej: Revisar contrato con Proveedor XYZ"
              />
            </div>
            <div>
              <Label className="block text-xs font-medium mb-1">Descripción (opcional)</Label>
              <textarea
                rows={2}
                value={nuevaOrden.descripcion}
                onChange={(e) => setNuevaOrden((p) => ({ ...p, descripcion: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Button
              type="submit"
              disabled={creandoOrden}
              className="w-full"
            >
              {creandoOrden ? "Enviando..." : "Enviar orden"}
            </Button>
          </form>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {ordenes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Sin órdenes activas</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Para</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Tarea</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.slice(0, 10).map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium text-foreground">{o.destinatario_nombre}</td>
                    <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">{o.titulo}</td>
                    <td className="px-4 py-2">
                      <EstadoBadge estado={o.estado} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
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
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Actividad reciente
        </h2>
        <div className="space-y-2">
          {actividad.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
          ) : (
            actividad.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-card border border-border px-4 py-3">
                <span className="text-lg shrink-0">
                  {item.tipo === "tarea_dev" ? "💻" : "🤖"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.descripcion}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
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
    <div className={`rounded-xl border p-4 bg-card ${alert ? "border-red-200" : "border-border"}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? "text-red-600" : "text-foreground"}`}>{value}</p>
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
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] ?? "bg-muted text-muted-foreground"}`}>
      {estado.replace("_", " ")}
    </span>
  )
}

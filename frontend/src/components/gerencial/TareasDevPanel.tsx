/**
 * Panel de gestión de tareas de desarrollo.
 * Tres vistas: actividades en proceso, medición diaria, panel por usuario.
 * Incluye formulario para registrar tareas con todos los campos requeridos.
 */
import { useState, useEffect, useMemo } from "react"
import { useAuthStore } from "@/store/authStore"

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001"

interface TareaRead {
  id: string
  subido_por_id: number
  subido_por_nombre: string
  fecha: string
  hora_inicio: string | null
  hora_cierre: string | null
  tiempo_total_minutos: number | null
  etiqueta: string
  plataforma: string
  titulo: string
  descripcion_tecnica: string
  descripcion_gerencial: string | null
  impacto: string | null
  estado: string
  created_at: string
  updated_at: string
}

const ETIQUETAS: Record<string, string> = {
  desarrollos: "Desarrollos",
  actualizaciones: "Actualizaciones",
  auditorias: "Auditorías",
  implementacion_okr: "Implementación OKR",
  tareas_diarias: "Tareas Diarias",
}

const PLATAFORMAS: Record<string, string> = {
  logimat1: "Logimat 1",
  logimat2: "Logimat 2",
  imccargo: "IMCCARGO",
  imcdeposito: "IMC Depósito",
  transversal: "Transversal",
}

const ESTADOS: Record<string, string> = {
  en_progreso: "En progreso",
  completada: "Completada",
  bloqueada: "Bloqueada",
}

const ETIQUETA_COLOR: Record<string, string> = {
  desarrollos: "bg-blue-100 text-blue-700",
  actualizaciones: "bg-purple-100 text-purple-700",
  auditorias: "bg-orange-100 text-orange-700",
  implementacion_okr: "bg-teal-100 text-teal-700",
  tareas_diarias: "bg-gray-100 text-gray-600",
}

const ESTADO_COLOR: Record<string, string> = {
  en_progreso: "bg-blue-100 text-blue-700",
  completada: "bg-green-100 text-green-700",
  bloqueada: "bg-red-100 text-red-700",
}

type VistaMode = "en_proceso" | "diaria" | "panel"

function formatMinutos(min: number | null): string {
  if (!min) return "—"
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function authHeaders(token: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function defaultForm() {
  return {
    titulo: "",
    descripcion_tecnica: "",
    etiqueta: "tareas_diarias",
    plataforma: "transversal",
    estado: "en_progreso",
    fecha: new Date().toISOString().split("T")[0],
    hora_inicio_time: "",
    hora_cierre_time: "",
  }
}

export function TareasDevPanel() {
  const token = useAuthStore((s) => s.token)
  const headers = authHeaders(token)

  const [tareas, setTareas] = useState<TareaRead[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<VistaMode>("en_proceso")
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetch(`${BASE_URL}/api/gerencial/tareas-dev?limit=200`, { headers })
      .then((r) => r.json())
      .then((data) => setTareas(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  // headers es estable mientras no cambie el token
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const hoy = new Date().toISOString().split("T")[0]
  const enProceso = useMemo(
    () => tareas.filter((t) => t.estado === "en_progreso"),
    [tareas],
  )
  const diarias = useMemo(
    () => tareas.filter((t) => t.fecha === hoy),
    [tareas, hoy],
  )
  const porUsuario = useMemo(() => {
    const map = new Map<string, TareaRead[]>()
    for (const t of tareas) {
      const list = map.get(t.subido_por_nombre) ?? []
      list.push(t)
      map.set(t.subido_por_nombre, list)
    }
    return map
  }, [tareas])

  // Tiempo calculado en el formulario
  const tiempoForm = useMemo(() => {
    if (!form.hora_inicio_time || !form.hora_cierre_time) return null
    const [hi, mi] = form.hora_inicio_time.split(":").map(Number)
    const [hc, mc] = form.hora_cierre_time.split(":").map(Number)
    const diff = (hc * 60 + mc) - (hi * 60 + mi)
    return diff > 0 ? diff : null
  }, [form.hora_inicio_time, form.hora_cierre_time])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)

    const toISO = (date: string, time: string) =>
      time ? `${date}T${time}:00` : null

    try {
      const res = await fetch(`${BASE_URL}/api/gerencial/tareas-dev`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          titulo: form.titulo,
          descripcion_tecnica: form.descripcion_tecnica,
          etiqueta: form.etiqueta,
          plataforma: form.plataforma,
          estado: form.estado,
          fecha: form.fecha,
          hora_inicio: toISO(form.fecha, form.hora_inicio_time),
          hora_cierre: toISO(form.fecha, form.hora_cierre_time),
        }),
      })
      if (res.ok) {
        const nueva: TareaRead = await res.json()
        setTareas((prev) => [nueva, ...prev])
        setForm(defaultForm())
        setMostrarForm(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  const vistas: [VistaMode, string][] = [
    ["en_proceso", "Actividades en proceso"],
    ["diaria", "Medición diaria"],
    ["panel", "Panel de actividades"],
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Barra de controles */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {vistas.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setVista(id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                vista === id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {mostrarForm ? "Cancelar" : "+ Registrar tarea"}
        </button>
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-blue-100 bg-blue-50 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-gray-800">Nueva tarea</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Título *
              </label>
              <input
                required
                value={form.titulo}
                onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej: Implementar módulo de alertas OC"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Descripción técnica *
              </label>
              <textarea
                required
                rows={3}
                value={form.descripcion_tecnica}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion_tecnica: e.target.value }))
                }
                placeholder="Detalla qué hiciste, cómo lo implementaste, qué problema resuelve..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Etiqueta
              </label>
              <select
                value={form.etiqueta}
                onChange={(e) =>
                  setForm((p) => ({ ...p, etiqueta: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                {Object.entries(ETIQUETAS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Plataforma
              </label>
              <select
                value={form.plataforma}
                onChange={(e) =>
                  setForm((p) => ({ ...p, plataforma: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                {Object.entries(PLATAFORMAS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={form.estado}
                onChange={(e) =>
                  setForm((p) => ({ ...p, estado: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                {Object.entries(ESTADOS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Hora inicio
              </label>
              <input
                type="time"
                value={form.hora_inicio_time}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hora_inicio_time: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Hora cierre
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="time"
                  value={form.hora_cierre_time}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, hora_cierre_time: e.target.value }))
                  }
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                />
                {tiempoForm !== null && (
                  <span className="text-xs font-medium text-blue-600 whitespace-nowrap">
                    = {formatMinutos(tiempoForm)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {guardando ? "Guardando..." : "Registrar tarea"}
          </button>
        </form>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Cargando tareas...
        </div>
      ) : vista === "panel" ? (
        <PanelActividades porUsuario={porUsuario} />
      ) : (
        <TablaTareas tareas={vista === "en_proceso" ? enProceso : diarias} />
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function TablaTareas({ tareas }: { tareas: TareaRead[] }) {
  if (tareas.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        No hay tareas para mostrar
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
              Responsable
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
              Tarea
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
              Etiqueta
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
              Plataforma
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
              Tiempo
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
              Estado
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
              Fecha
            </th>
          </tr>
        </thead>
        <tbody>
          {tareas.map((t) => (
            <tr
              key={t.id}
              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                {t.subido_por_nombre}
              </td>
              <td className="px-4 py-3 max-w-xs">
                <p className="text-gray-700 truncate">{t.titulo}</p>
                {t.descripcion_gerencial && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {t.descripcion_gerencial}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    ETIQUETA_COLOR[t.etiqueta] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {ETIQUETAS[t.etiqueta] ?? t.etiqueta}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {PLATAFORMAS[t.plataforma] ?? t.plataforma}
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                {formatMinutos(t.tiempo_total_minutos)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    ESTADO_COLOR[t.estado] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {ESTADOS[t.estado] ?? t.estado}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                {t.fecha}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PanelActividades({
  porUsuario,
}: {
  porUsuario: Map<string, TareaRead[]>
}) {
  if (porUsuario.size === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        No hay tareas registradas
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from(porUsuario.entries()).map(([nombre, tareas]) => {
        const completadas = tareas.filter((t) => t.estado === "completada").length
        const enProgreso = tareas.filter((t) => t.estado === "en_progreso").length
        const bloqueadas = tareas.filter((t) => t.estado === "bloqueada").length
        const tiempoTotal = tareas.reduce(
          (acc, t) => acc + (t.tiempo_total_minutos ?? 0),
          0,
        )

        return (
          <div
            key={nombre}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            {/* Encabezado de la tarjeta */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 text-sm">{nombre}</h3>
                <span className="text-xs text-gray-500">{tareas.length} tareas</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                {enProgreso > 0 && (
                  <span className="text-blue-600">{enProgreso} en progreso</span>
                )}
                {completadas > 0 && (
                  <span className="text-green-600">{completadas} completadas</span>
                )}
                {bloqueadas > 0 && (
                  <span className="text-red-600">{bloqueadas} bloqueadas</span>
                )}
                {tiempoTotal > 0 && (
                  <span className="text-gray-400 ml-auto">
                    {formatMinutos(tiempoTotal)}
                  </span>
                )}
              </div>
            </div>

            {/* Lista de tareas */}
            <div className="divide-y divide-gray-50">
              {tareas.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 shrink-0 w-2 h-2 rounded-full ${
                        t.estado === "completada"
                          ? "bg-green-400"
                          : t.estado === "bloqueada"
                            ? "bg-red-400"
                            : "bg-blue-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{t.titulo}</p>
                      <div className="flex gap-2 mt-0.5 items-center">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            ETIQUETA_COLOR[t.etiqueta] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {ETIQUETAS[t.etiqueta] ?? t.etiqueta}
                        </span>
                        {t.tiempo_total_minutos && (
                          <span className="text-[10px] text-gray-400">
                            {formatMinutos(t.tiempo_total_minutos)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {tareas.length > 5 && (
                <div className="px-4 py-2 text-xs text-gray-400 text-center">
                  +{tareas.length - 5} tareas más
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

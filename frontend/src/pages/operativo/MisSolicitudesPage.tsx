import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { useMisSolicitudes, useMarcarEntregada, useEditarCorreccion } from "@/hooks/useOC"
import { Combobox } from "@/components/ui/Combobox"
import { formatFechaRelativa, formatFechaHora } from "@/lib/dates"
import type { SolicitudOC } from "@/types/oc"

// ── Helpers ───────────────────────────────────────────────────────────────────

// Tiempo máximo de primera respuesta del equipo de compras
const PRIORIDAD_SLA: Record<string, { horas: number; label: string }> = {
  Alta:  { horas: 4,  label: "Respuesta en 4 h" },
  Media: { horas: 24, label: "Respuesta en 24 h" },
  Baja:  { horas: 48, label: "Respuesta en 48 h" },
}

function calcularHorasTranscurridas(fechaISO: string): number {
  return (Date.now() - new Date(fechaISO).getTime()) / 3_600_000
}

const ESTADO_CONFIG: Record<string, { label: string; className: string; descripcion: string }> = {
  nueva:                { label: "Nueva",              className: "bg-blue-100 text-blue-700",    descripcion: "Tu solicitud fue recibida y está en cola." },
  en_cotizacion:        { label: "En gestión",          className: "bg-yellow-100 text-yellow-700", descripcion: "El equipo de compras está buscando cotización." },
  pendiente_aprobacion: { label: "Pend. aprobación",   className: "bg-orange-100 text-orange-700", descripcion: "La cotización está siendo revisada por el director." },
  aprobada:             { label: "Aprobada",            className: "bg-green-100 text-green-700",  descripcion: "La compra fue aprobada. Generando orden de compra." },
  rechazada:            { label: "Rechazada",           className: "bg-red-100 text-red-700",      descripcion: "La solicitud o cotización fue rechazada por compras. Revisa tu correo o contacta al equipo." },
  cancelada:            { label: "Cancelada",           className: "bg-red-200 text-red-800",      descripcion: "La solicitud fue cancelada definitivamente. Revisa tu correo para el motivo." },
  en_correccion:        { label: "Requiere corrección", className: "bg-amber-100 text-amber-700",  descripcion: "El equipo de compras necesita que corrijas tu solicitud antes de continuar." },
  oc_enviada:           { label: "OC enviada",          className: "bg-indigo-100 text-indigo-700", descripcion: "La orden de compra fue enviada al proveedor." },
  oc_en_plataforma:     { label: "En plataforma",       className: "bg-violet-100 text-violet-700", descripcion: "El pedido fue ingresado en la plataforma. Confirma cuando lo recibas." },
  entregada:            { label: "Recibida",            className: "bg-teal-100 text-teal-700",    descripcion: "Confirmaste la recepción. Pendiente cierre administrativo." },
  cerrada:              { label: "Cerrada",             className: "bg-gray-100 text-gray-500",    descripcion: "Proceso completado." },
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, className: "bg-gray-100 text-gray-500", descripcion: "" }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ESTADOS_OPTIONS = Object.entries(ESTADO_CONFIG).map(([value, { label }]) => ({ value, label }))

export function MisSolicitudesPage() {
  const navigate = useNavigate()
  const { data: solicitudes = [], isLoading, isRefetching } = useMisSolicitudes()
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null)

  const filtradas = filtroEstado
    ? solicitudes.filter((s) => s.estado === filtroEstado)
    : solicitudes

  const pendientesConfirmacion = solicitudes.filter((s) => s.estado === "oc_en_plataforma").length
  const pendientesCorreccion = solicitudes.filter((s) => s.estado === "en_correccion").length

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Operativo" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Breadcrumb */}
          <button
            onClick={() => navigate("/operativo")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Mis Solicitudes</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Historial de compras asociadas a tu correo
                {isRefetching && <span className="ml-2 text-brand-blue/60">actualizando...</span>}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Badge de correcciones pendientes */}
              {pendientesCorreccion > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
                  <span className="text-amber-600 text-lg">✏️</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {pendientesCorreccion} solicitud{pendientesCorreccion > 1 ? "es" : ""} requieren corrección
                    </p>
                    <p className="text-xs text-amber-600">Revisa y corrige para continuar</p>
                  </div>
                </div>
              )}

              {/* Badge de confirmaciones pendientes */}
              {pendientesConfirmacion > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-200 px-4 py-2.5">
                  <span className="text-violet-600 text-lg">🏭</span>
                  <div>
                    <p className="text-sm font-semibold text-violet-800">
                      {pendientesConfirmacion} pedido{pendientesConfirmacion > 1 ? "s" : ""} esperando confirmación
                    </p>
                    <p className="text-xs text-violet-600">Confirma que los recibiste</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate("/operativo/nueva-solicitud")}
                className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"/>
                </svg>
                Nueva solicitud
              </button>
            </div>
          </div>

          {/* Filtro de estado */}
          <div className="mb-4">
            <Combobox
              className="w-52"
              options={ESTADOS_OPTIONS}
              value={filtroEstado}
              onChange={(v) => setFiltroEstado(v as string | null)}
              placeholder="Todos los estados"
            />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
              <svg className="animate-spin h-5 w-5 mr-2 text-brand-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando solicitudes...
            </div>
          )}

          {/* Sin solicitudes */}
          {!isLoading && filtradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <svg className="w-12 h-12 mb-3 text-gray-200" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" clipRule="evenodd" />
              </svg>
              <p className="text-sm">No hay solicitudes {filtroEstado ? "con este estado" : "registradas"}</p>
            </div>
          )}

          {/* Lista */}
          {!isLoading && filtradas.length > 0 && (
            <div className="space-y-3">
              {filtradas.map((s) => (
                <SolicitudCard key={s.id} solicitud={s} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ── Tarjeta de solicitud ──────────────────────────────────────────────────────

function SlaIndicador({ solicitud: s }: { solicitud: SolicitudOC }) {
  const sla = PRIORIDAD_SLA[s.nivel_prioridad]
  // Solo mostrar si aún no hubo primera respuesta del equipo de compras
  if (!sla || s.estado !== "nueva") return null

  const horasTranscurridas = calcularHorasTranscurridas(s.fecha_solicitud)
  const vencido = horasTranscurridas > sla.horas
  const horasRestantes = Math.max(0, sla.horas - horasTranscurridas)

  if (vencido) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        ⚠ SLA vencido
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
      🕐 {horasRestantes < 1 ? "menos de 1 h" : `${Math.ceil(horasRestantes)} h`} para primera respuesta
    </span>
  )
}

function SolicitudCard({ solicitud: s }: { solicitud: SolicitudOC }) {
  const [confirmando, setConfirmando] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [corrDesc, setCorrDesc] = useState("")
  const [corrCantidad, setCorrCantidad] = useState("")
  const [corrObs, setCorrObs] = useState("")
  const marcarEntregada = useMarcarEntregada()
  const editarCorreccion = useEditarCorreccion()

  const cfg = ESTADO_CONFIG[s.estado]
  const necesitaConfirmacion = s.estado === "oc_en_plataforma"
  const necesitaCorreccion = s.estado === "en_correccion"

  function handleConfirmar() {
    marcarEntregada.mutate(s.id, {
      onSuccess: () => setConfirmando(false),
    })
  }

  function handleEnviarCorreccion() {
    const payload: { descripcion?: string; cantidad?: number; observaciones_solicitante?: string } = {}
    if (corrDesc.trim()) payload.descripcion = corrDesc.trim()
    if (corrCantidad.trim() && !isNaN(Number(corrCantidad))) payload.cantidad = Number(corrCantidad)
    if (corrObs.trim()) payload.observaciones_solicitante = corrObs.trim()
    editarCorreccion.mutate(
      { id: s.id, payload },
      {
        onSuccess: () => {
          setCorrigiendo(false)
          setCorrDesc("")
          setCorrCantidad("")
          setCorrObs("")
        },
      }
    )
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${
      necesitaCorreccion ? "border-amber-200" : necesitaConfirmacion ? "border-violet-200" : "border-gray-100"
    }`}>
      {/* Barra de acción si requiere corrección */}
      {necesitaCorreccion && !corrigiendo && (
        <div className="bg-amber-50 border-b border-amber-100 px-5 py-2.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-700">
              ✏️ Compras necesita que corrijas esta solicitud
            </p>
            {s.observaciones_compras && (
              <p className="text-xs text-amber-600 mt-0.5 truncate">{s.observaciones_compras}</p>
            )}
          </div>
          <button
            onClick={() => setCorrigiendo(true)}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors shrink-0"
          >
            Corregir
          </button>
        </div>
      )}

      {/* Formulario de corrección inline */}
      {necesitaCorreccion && corrigiendo && (
        <div className="bg-amber-50 border-b border-amber-100 px-5 py-4 space-y-3">
          {s.observaciones_compras && (
            <div className="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2">
              <p className="text-xs font-semibold text-amber-800 mb-0.5">Qué debes corregir:</p>
              <p className="text-xs text-amber-900">{s.observaciones_compras}</p>
            </div>
          )}
          <p className="text-xs font-medium text-amber-700">Edita los campos que necesitas corregir:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Descripción</label>
              <input
                type="text"
                value={corrDesc}
                onChange={(e) => setCorrDesc(e.target.value)}
                placeholder={s.descripcion}
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
              <input
                type="number"
                value={corrCantidad}
                onChange={(e) => setCorrCantidad(e.target.value)}
                placeholder={String(s.cantidad)}
                min="1"
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Observaciones</label>
              <textarea
                value={corrObs}
                onChange={(e) => setCorrObs(e.target.value)}
                placeholder={s.observaciones_solicitante ?? "Añade observaciones..."}
                rows={2}
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEnviarCorreccion}
              disabled={editarCorreccion.isPending || (!corrDesc.trim() && !corrCantidad.trim() && !corrObs.trim())}
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {editarCorreccion.isPending ? "Enviando..." : "Enviar corrección"}
            </button>
            <button
              onClick={() => { setCorrigiendo(false); setCorrDesc(""); setCorrCantidad(""); setCorrObs("") }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Barra de acción si necesita confirmación */}
      {necesitaConfirmacion && (
        <div className="bg-violet-50 border-b border-violet-100 px-5 py-2.5 flex items-center justify-between">
          <p className="text-xs font-medium text-violet-700">
            🏭 El pedido ya está en la plataforma — ¿lo recibiste físicamente?
          </p>
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors shrink-0 ml-4"
            >
              Confirmar recepción
            </button>
          ) : (
            <div className="flex items-center gap-2 ml-4">
              <p className="text-xs text-violet-700">¿Confirmas que recibiste este pedido?</p>
              <button
                onClick={handleConfirmar}
                disabled={marcarEntregada.isPending}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {marcarEntregada.isPending ? "Guardando..." : "Sí, lo recibí"}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-bold text-brand-blue">{s.consecutivo_os}</span>
              <EstadoBadge estado={s.estado} />
              <SlaIndicador solicitud={s} />
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{s.descripcion}</p>
            {cfg && (
              <p className="text-xs text-gray-400 mt-0.5">{cfg.descripcion}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-gray-400">{formatFechaRelativa(s.fecha_solicitud)}</p>
            {s.nivel_prioridad === "Alta" && (
              <span className="inline-block mt-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                Alta prioridad
              </span>
            )}
          </div>
        </div>

        {/* Timeline compacto */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <TimelineRow label="Solicitud" date={s.fecha_solicitud} done />
          <TimelineRow label="En gestión" date={s.fecha_asignacion} done={!!s.fecha_asignacion} />
          <TimelineRow label="Cotización" date={s.fecha_cotizacion} done={!!s.fecha_cotizacion} />
          <TimelineRow label="Aprobación" date={s.fecha_aprobacion} done={!!s.fecha_aprobacion} />
          <TimelineRow label="OC enviada" date={s.fecha_envio_oc} done={!!s.fecha_envio_oc} />
          <TimelineRow label="En plataforma" date={s.fecha_en_plataforma} done={!!s.fecha_en_plataforma} />
          <TimelineRow label="Recibido" date={s.fecha_recibido} done={!!s.fecha_recibido} />
        </div>

        {/* Info adicional */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 border-t border-gray-50 pt-3">
          {s.cantidad > 0 && <span>Cant: <span className="text-gray-600 font-medium">{s.cantidad}</span></span>}
          {s.categoria && <span>Cat: <span className="text-gray-600">{s.categoria}</span></span>}
          {s.placa_ficha && <span>Placa: <span className="text-gray-600 font-mono">{s.placa_ficha}</span></span>}
          {s.plataforma && <span>Plataforma: <span className="text-gray-600">{s.plataforma}</span></span>}
          <Link
            to={`/operativo/mis-solicitudes/${s.id}`}
            className="ml-auto text-brand-blue hover:underline font-medium"
          >
            Ver detalle →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Helpers visuales ──────────────────────────────────────────────────────────

function TimelineRow({
  label,
  date,
  done,
}: {
  label: string
  date: string | null | undefined
  done: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? "bg-teal-400" : "bg-gray-200"}`} />
      <span className={done ? "text-gray-600" : "text-gray-300"}>{label}</span>
      {date && (
        <span className="text-gray-400 ml-auto">{formatFechaHora(date)}</span>
      )}
    </div>
  )
}

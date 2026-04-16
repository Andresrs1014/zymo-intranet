import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { api } from "@/lib/api"
import { formatFechaHora } from "@/lib/dates"
import {
  useSolicitud,
  useAsignarAuxiliar,
  useCotizaciones,
  useAprobarCotizacion,
  useRechazarCotizacion,
  useOrden,
  useGenerarOC,
  useActualizarGestion,
  useCambiarPrioridad,
  useUsuario,
  useMarcarEnviada,
  useMarcarEntregada,
  useCerrarSolicitud,
  type GestionPayload,
} from "@/hooks/useOC"
import { useAuthStore } from "@/store/authStore"
import { EstadoBadge } from "./SolicitudesPage"
import type { CotizacionProveedor, OrdenCompra } from "@/types/oc"

export function SolicitudDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: solicitud, isLoading } = useSolicitud(id)
  const { data: cotizaciones = [] } = useCotizaciones(id)
  const { data: orden } = useOrden(id)
  const { data: auxiliar } = useUsuario(solicitud?.auxiliar_id)
  const asignar = useAsignarAuxiliar()
  const aprobar = useAprobarCotizacion()
  const rechazar = useRechazarCotizacion()
  const generarOC = useGenerarOC()
  const actualizarGestion = useActualizarGestion()
  const marcarEnviada = useMarcarEnviada()
  const marcarEntregada = useMarcarEntregada()
  const cerrarSolicitud = useCerrarSolicitud()
  const cambiarPrioridad = useCambiarPrioridad()

  const puedeEditarPrioridad =
    user?.role === "admin" ||
    user?.role === "directivo" ||
    user?.role === "compras" ||
    user?.role === "administrativo"

  function handleAsignarme() {
    if (!id || !user) return
    asignar.mutate({ id, auxiliar_id: user.id })
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar title="OC Automatizaciones" />
          <main className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Cargando...
          </main>
        </div>
      </div>
    )
  }

  if (!solicitud) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar title="OC Automatizaciones" />
          <main className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Solicitud no encontrada.
          </main>
        </div>
      </div>
    )
  }

  const esAuxiliarAsignado = solicitud.auxiliar_id === user?.id
  const puedeAsignarse =
    !solicitud.auxiliar_id &&
    (user?.role === "admin" || user?.role === "compras" || user?.area === "Compras")
  const esAprobador = user?.role === "admin" || user?.role === "directivo" || user?.role === "administrativo"
  const puedeGenerarOC =
    user?.role === "admin" ||
    user?.role === "compras" ||
    user?.role === "administrativo" ||
    user?.area === "Compras"
  const cotizacionPendiente = cotizaciones.find((c) => c.aprobada === null)
  const cotizacionAprobada = cotizaciones.find((c) => c.aprobada === true)

  function handleGenerarOC() {
    if (!id) return
    generarOC.mutate(id)
  }

  async function handleDescargar() {
    if (!orden) return
    const ext = orden.pdf_path ? "pdf" : "xlsx"
    const mimeType =
      ext === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    try {
      const response = await api.get(`/api/oc/ordenes/${orden.id}/descargar`, {
        responseType: "blob",
      })
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: mimeType }))
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `${orden.numero_oc}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      alert("Error al descargar el documento.")
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="OC Automatizaciones" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Breadcrumb */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-mono text-sm font-bold text-brand-blue">
                  {solicitud.consecutivo_os}
                </span>
                <EstadoBadge estado={solicitud.estado} />
              </div>
              <h1 className="text-xl font-bold text-gray-900">{solicitud.descripcion}</h1>
            </div>

            <div className="flex gap-2 shrink-0">
              {puedeAsignarse && (
                <button
                  onClick={handleAsignarme}
                  disabled={asignar.isPending}
                  className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
                >
                  {asignar.isPending ? "Asignando..." : "Asignarme esta solicitud"}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna principal */}
            <div className="lg:col-span-2 space-y-4">

              {/* Panel de aprobación — visible solo para directivo/admin cuando hay cotización pendiente */}
              {esAprobador &&
                solicitud.estado === "pendiente_aprobacion" &&
                cotizacionPendiente && (
                  <PanelAprobacion
                    cotizacion={cotizacionPendiente}
                    onAprobar={(cotizacionId, valor, obs) =>
                      aprobar.mutate({
                        cotizacionId,
                        valor_aprobado: valor,
                        observaciones_aprobacion: obs,
                      })
                    }
                    onRechazar={(cotizacionId, obs) =>
                      rechazar.mutate({ cotizacionId, observaciones_aprobacion: obs })
                    }
                    isLoading={aprobar.isPending || rechazar.isPending}
                  />
                )}

              {/* Panel Orden de Compra — visible desde aprobada en adelante */}
              {(solicitud.estado === "aprobada" ||
                solicitud.estado === "oc_enviada" ||
                solicitud.estado === "entregada" ||
                solicitud.estado === "cerrada") && (
                <PanelOrdenCompra
                  solicitudId={solicitud.id}
                  estado={solicitud.estado}
                  orden={orden ?? null}
                  puedeGenerar={puedeGenerarOC}
                  emailProveedorInicial={cotizacionAprobada?.proveedor_email ?? orden?.email_proveedor ?? ""}
                  isGenerating={generarOC.isPending}
                  isMarkingEnviada={marcarEnviada.isPending}
                  isMarkingEntregada={marcarEntregada.isPending}
                  isClosing={cerrarSolicitud.isPending}
                  onGenerar={handleGenerarOC}
                  onDescargar={handleDescargar}
                  onMarcarEnviada={(email) => marcarEnviada.mutate({ id: solicitud.id, email_proveedor: email })}
                  onMarcarEntregada={() => marcarEntregada.mutate(solicitud.id)}
                  onCerrar={() => cerrarSolicitud.mutate(solicitud.id)}
                />
              )}

              {/* Cotizaciones cargadas */}
              {cotizaciones.length > 0 && (
                <Section title={`Cotizaciones (${cotizaciones.length})`}>
                  <div className="space-y-3">
                    {cotizaciones.map((c) => (
                      <CotizacionCard key={c.id} cotizacion={c} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Datos del pedido */}
              <Section title="Detalle del Pedido">
                <InfoGrid>
                  <InfoItem label="Descripción" value={solicitud.descripcion} />
                  <InfoItem label="Cantidad" value={String(solicitud.cantidad)} />
                  <InfoItem label="Categoría" value={solicitud.categoria} />
                  <InfoItem label="Grupo de artículos" value={solicitud.grupo_articulos} />
                  {puedeEditarPrioridad ? (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Prioridad</p>
                      <select
                        value={solicitud.nivel_prioridad}
                        disabled={cambiarPrioridad.isPending}
                        onChange={(e) =>
                          cambiarPrioridad.mutate({ id: solicitud.id, nivel_prioridad: e.target.value })
                        }
                        className="rounded-md border border-gray-200 px-2 py-1 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50"
                      >
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </select>
                    </div>
                  ) : (
                    <InfoItem label="Prioridad" value={solicitud.nivel_prioridad} />
                  )}
                  <InfoItem label="Cliente" value={solicitud.cliente} />
                  <InfoItem label="Condición" value={solicitud.condicion} />
                  <InfoItem label="Placa / Ficha técnica" value={solicitud.placa_ficha} />
                  {solicitud.fecha_proximo_mantenimiento && (
                    <InfoItem
                      label="Próximo mantenimiento"
                      value={solicitud.fecha_proximo_mantenimiento}
                    />
                  )}
                </InfoGrid>
                {solicitud.observaciones_solicitante && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs font-medium text-gray-400 mb-1">
                      Observaciones del solicitante
                    </p>
                    <p className="text-sm text-gray-700">{solicitud.observaciones_solicitante}</p>
                  </div>
                )}
              </Section>

              {/* Datos del solicitante */}
              <Section title="Solicitante">
                <InfoGrid>
                  <InfoItem label="Nombre" value={solicitud.solicitante_nombre} />
                  <InfoItem label="Email" value={solicitud.solicitante_email} />
                  <InfoItem label="Área" value={solicitud.area_solicitante} />
                  <InfoItem label="Plataforma" value={solicitud.plataforma} />
                </InfoGrid>
                {solicitud.evidencia_url && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs font-medium text-gray-400 mb-1">Evidencia adjunta</p>
                    <a
                      href={solicitud.evidencia_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-brand-blue hover:underline"
                    >
                      📎 Ver evidencia
                    </a>
                  </div>
                )}
              </Section>
            </div>

            {/* Columna lateral */}
            <div className="space-y-4">
              <Section title="Estado del Proceso">
                <div className="space-y-2">
                  <TimelineItem label="Solicitud recibida" date={solicitud.fecha_solicitud} done />
                  <TimelineItem
                    label="En gestión"
                    date={solicitud.fecha_asignacion}
                    done={!!solicitud.fecha_asignacion}
                  />
                  <TimelineItem
                    label="En cotización"
                    date={solicitud.fecha_cotizacion}
                    done={!!solicitud.fecha_cotizacion}
                  />
                  <TimelineItem
                    label="Aprobación"
                    date={solicitud.fecha_aprobacion}
                    done={!!solicitud.fecha_aprobacion}
                  />
                  <TimelineItem
                    label="OC enviada"
                    date={solicitud.fecha_envio_oc}
                    done={!!solicitud.fecha_envio_oc}
                  />
                  <TimelineItem
                    label="Entregada"
                    date={solicitud.fecha_recibido}
                    done={!!solicitud.fecha_recibido}
                  />
                </div>
              </Section>

              {/* Acción auxiliar: cargar cotización */}
              {(esAuxiliarAsignado || user?.role === "admin") &&
                (solicitud.estado === "en_cotizacion" || solicitud.estado === "rechazada") && (
                  <Section title="Gestión">
                    <p className="text-xs text-gray-500 mb-3">
                      {solicitud.estado === "rechazada"
                        ? "La cotización fue rechazada. Carga una nueva."
                        : "Carga la cotización del proveedor para enviar a aprobación."}
                    </p>
                    <button
                      onClick={() => navigate(`/oc/solicitudes/${solicitud.id}/cotizar`)}
                      className="w-full rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors"
                    >
                      {solicitud.estado === "rechazada"
                        ? "Cargar nueva cotización"
                        : "Cargar cotización"}
                    </button>
                  </Section>
                )}

              {solicitud.auxiliar_id && (
                <Section title="Auxiliar asignado">
                  <p className="text-sm font-semibold text-gray-800">
                    {auxiliar?.full_name ?? `Usuario #${solicitud.auxiliar_id}`}
                  </p>
                  {auxiliar?.email && (
                    <p className="text-xs text-gray-400 mt-0.5">{auxiliar.email}</p>
                  )}
                </Section>
              )}

              {/* Panel gestión de compras */}
              {(esAuxiliarAsignado || puedeGenerarOC) && (
                <PanelGestion
                  solicitud={solicitud}
                  isLoading={actualizarGestion.isPending}
                  onGuardar={(payload) =>
                    actualizarGestion.mutate({ id: solicitud.id, payload })
                  }
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Panel de aprobación ────────────────────────────────────────────────────────

function PanelAprobacion({
  cotizacion,
  onAprobar,
  onRechazar,
  isLoading,
}: {
  cotizacion: CotizacionProveedor
  onAprobar: (id: string, valor: number, obs?: string) => void
  onRechazar: (id: string, obs: string) => void
  isLoading: boolean
}) {
  const [modo, setModo] = useState<"idle" | "aprobar" | "rechazar">("idle")
  const [valorAprobado, setValorAprobado] = useState(cotizacion.valor_total)
  const [observaciones, setObservaciones] = useState("")
  const [motivoRechazo, setMotivoRechazo] = useState("")

  function handleAprobar() {
    onAprobar(cotizacion.id, valorAprobado, observaciones || undefined)
    setModo("idle")
  }

  function handleRechazar() {
    if (!motivoRechazo.trim()) return
    onRechazar(cotizacion.id, motivoRechazo)
    setModo("idle")
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-orange-500 text-lg">⏳</span>
        <h2 className="text-sm font-semibold text-orange-800">
          Cotización pendiente de tu aprobación
        </h2>
      </div>

      {/* Resumen de la cotización */}
      <div className="bg-white rounded-lg border border-orange-100 p-4 mb-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400">Proveedor</p>
          <p className="text-sm font-semibold text-gray-800">{cotizacion.proveedor_nombre}</p>
          {cotizacion.proveedor_email && (
            <p className="text-xs text-gray-400">{cotizacion.proveedor_email}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400">N° cotización</p>
          <p className="text-sm font-medium text-gray-800">
            {cotizacion.numero_cotizacion_proveedor ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Valor unitario</p>
          <p className="text-sm font-medium text-gray-800">
            {formatCurrency(cotizacion.valor_unitario)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Valor total</p>
          <p className="text-base font-bold text-gray-900">
            {formatCurrency(cotizacion.valor_total)}
          </p>
        </div>
        {cotizacion.fecha_vigencia && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400">Vigencia</p>
            <p className="text-sm text-gray-700">{cotizacion.fecha_vigencia}</p>
          </div>
        )}
        {cotizacion.observaciones && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400">Observaciones</p>
            <p className="text-sm text-gray-700">{cotizacion.observaciones}</p>
          </div>
        )}
      </div>

      {/* Formulario de aprobación */}
      {modo === "aprobar" && (
        <div className="bg-white rounded-lg border border-green-200 p-4 mb-3 space-y-3">
          <p className="text-sm font-medium text-green-800">Confirmar aprobación</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Valor aprobado (puedes ajustarlo)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorAprobado}
              onChange={(e) => setValorAprobado(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Observaciones (opcional)
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Condiciones, restricciones, etc."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAprobar}
              disabled={isLoading}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Procesando..." : "Confirmar aprobación"}
            </button>
            <button
              onClick={() => setModo("idle")}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Formulario de rechazo */}
      {modo === "rechazar" && (
        <div className="bg-white rounded-lg border border-red-200 p-4 mb-3 space-y-3">
          <p className="text-sm font-medium text-red-800">Motivo del rechazo</p>
          <textarea
            rows={3}
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Explica el motivo para que el auxiliar busque otra cotización..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRechazar}
              disabled={isLoading || !motivoRechazo.trim()}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Procesando..." : "Confirmar rechazo"}
            </button>
            <button
              onClick={() => setModo("idle")}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Botones principales */}
      {modo === "idle" && (
        <div className="flex gap-2">
          <button
            onClick={() => setModo("aprobar")}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            ✓ Aprobar cotización
          </button>
          <button
            onClick={() => setModo("rechazar")}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
          >
            ✗ Rechazar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Panel Orden de Compra ─────────────────────────────────────────────────────

function PanelOrdenCompra({
  solicitudId: _solicitudId,
  estado,
  orden,
  puedeGenerar,
  emailProveedorInicial,
  isGenerating,
  isMarkingEnviada,
  isMarkingEntregada,
  isClosing,
  onGenerar,
  onDescargar,
  onMarcarEnviada,
  onMarcarEntregada,
  onCerrar,
}: {
  solicitudId: string
  estado: string
  orden: OrdenCompra | null
  puedeGenerar: boolean
  emailProveedorInicial: string
  isGenerating: boolean
  isMarkingEnviada: boolean
  isMarkingEntregada: boolean
  isClosing: boolean
  onGenerar: () => void
  onDescargar: () => void
  onMarcarEnviada: (email: string) => void
  onMarcarEntregada: () => void
  onCerrar: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [emailInput, setEmailInput] = useState(emailProveedorInicial)

  function handleConfirmarEnvio() {
    if (!emailInput.trim()) return
    onMarcarEnviada(emailInput.trim())
    setShowModal(false)
  }

  // Estado cerrada — solo informativo
  if (estado === "cerrada") {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-lg">✔</span>
          <div>
            <p className="text-sm font-semibold text-gray-700">Solicitud cerrada</p>
            {orden && <p className="text-xs text-gray-400 font-mono">{orden.numero_oc}</p>}
          </div>
          {orden && (
            <button
              onClick={onDescargar}
              className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              ↓ Descargar OC
            </button>
          )}
        </div>
      </div>
    )
  }

  // Estado entregada — botón para cerrar
  if (estado === "entregada") {
    return (
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-teal-600 text-lg">📦</span>
            <div>
              <p className="text-sm font-semibold text-teal-800">Producto entregado</p>
              {orden && <p className="text-xs text-teal-600 font-mono">{orden.numero_oc}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {orden && (
              <button
                onClick={onDescargar}
                className="rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
              >
                ↓ Descargar OC
              </button>
            )}
            <button
              onClick={onCerrar}
              disabled={isClosing}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {isClosing ? "Cerrando..." : "Cerrar solicitud"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Estado oc_enviada — botón para marcar entregada
  if (estado === "oc_enviada") {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 text-lg">📤</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">OC enviada al proveedor</p>
              {orden && <p className="text-xs text-blue-600 font-mono">{orden.numero_oc}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {orden && (
              <button
                onClick={onDescargar}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                ↓ Descargar OC
              </button>
            )}
            <button
              onClick={onMarcarEntregada}
              disabled={isMarkingEntregada}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isMarkingEntregada ? "Guardando..." : "Marcar como entregada"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Estado aprobada con OC ya generada — botón para marcar enviada
  if (orden) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">📄</span>
            <div>
              <p className="text-sm font-semibold text-green-800">Orden de Compra generada</p>
              <p className="text-xs text-green-600 font-mono">{orden.numero_oc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDescargar}
              className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
            >
              ↓ {orden.pdf_path ? "PDF" : "DOCX"}
            </button>
            {puedeGenerar && (
              <button
                onClick={() => { setEmailInput(emailProveedorInicial); setShowModal(true) }}
                disabled={isMarkingEnviada}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isMarkingEnviada ? "Enviando..." : "Enviar OC al proveedor"}
              </button>
            )}
          </div>
        </div>

        {/* Modal confirmación email proveedor */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Enviar OC al proveedor</h3>
              <p className="text-sm text-gray-500">
                Confirma o edita el correo del proveedor. La OC se enviará como adjunto.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Correo del proveedor
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="proveedor@empresa.com"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleConfirmarEnvio}
                  disabled={!emailInput.trim() || isMarkingEnviada}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isMarkingEnviada ? "Enviando..." : "Confirmar y enviar"}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!puedeGenerar) return null

  // OC no generada aún — botón para generarla
  return (
    <div className="bg-blue-50 border border-brand-blue/20 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-brand-blue text-lg">🖨️</span>
          <div>
            <p className="text-sm font-semibold text-brand-blue">Generar Orden de Compra</p>
            <p className="text-xs text-brand-blue/60">
              La cotización fue aprobada. Puedes generar el documento oficial.
            </p>
          </div>
        </div>
        <button
          onClick={onGenerar}
          disabled={isGenerating}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
        >
          {isGenerating ? "Generando..." : "Generar OC"}
        </button>
      </div>
    </div>
  )
}

// ── Cotización Card (historial) ────────────────────────────────────────────────

function CotizacionCard({ cotizacion: c }: { cotizacion: CotizacionProveedor }) {
  const estadoColor =
    c.aprobada === true
      ? "border-green-100 bg-green-50"
      : c.aprobada === false
      ? "border-red-100 bg-red-50"
      : "border-gray-100 bg-white"

  const estadoLabel =
    c.aprobada === true ? "Aprobada" : c.aprobada === false ? "Rechazada" : "En revisión"

  const estadoTextColor =
    c.aprobada === true
      ? "text-green-700"
      : c.aprobada === false
      ? "text-red-700"
      : "text-orange-700"

  return (
    <div className={`rounded-lg border p-4 ${estadoColor}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-gray-800 text-sm">{c.proveedor_nombre}</p>
        <span className={`text-xs font-medium ${estadoTextColor}`}>{estadoLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span className="text-gray-400">Valor total: </span>
          <span className="font-medium text-gray-800">{formatCurrency(c.valor_total)}</span>
        </div>
        {c.valor_aprobado != null && (
          <div>
            <span className="text-gray-400">Valor aprobado: </span>
            <span className="font-medium text-green-700">{formatCurrency(c.valor_aprobado)}</span>
          </div>
        )}
        {c.numero_cotizacion_proveedor && (
          <div>
            <span className="text-gray-400">N° cotización: </span>
            <span className="font-medium text-gray-700">{c.numero_cotizacion_proveedor}</span>
          </div>
        )}
        {c.fecha_vigencia && (
          <div>
            <span className="text-gray-400">Vigencia: </span>
            <span className="font-medium text-gray-700">{c.fecha_vigencia}</span>
          </div>
        )}
      </div>
      {c.observaciones_aprobacion && (
        <p className="mt-2 text-xs text-gray-500 italic">
          "{c.observaciones_aprobacion}"
        </p>
      )}
    </div>
  )
}

// ── Panel Gestión de Compras ──────────────────────────────────────────────────

function PanelGestion({
  solicitud,
  isLoading,
  onGuardar,
}: {
  solicitud: import("@/types/oc").SolicitudOC
  isLoading: boolean
  onGuardar: (payload: GestionPayload) => void
}) {
  const [form, setForm] = useState<GestionPayload>({
    plataforma: solicitud.plataforma ?? "",
    numero_remision: solicitud.numero_remision ?? "",
    observaciones_compras: solicitud.observaciones_compras ?? "",
    fecha_estimada_entrega: solicitud.fecha_estimada_entrega ?? "",
    fecha_confirmada_entrega: solicitud.fecha_confirmada_entrega ?? "",
    numero_factura: solicitud.numero_factura ?? "",
    aval_compra: solicitud.aval_compra ?? "",
    observacion_contabilidad: solicitud.observacion_contabilidad ?? "",
    fecha_recibida_factura: solicitud.fecha_recibida_factura ?? "",
  })

  function set(field: keyof GestionPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleGuardar() {
    const payload: GestionPayload = {}
    for (const [k, v] of Object.entries(form)) {
      if (v !== "") payload[k as keyof GestionPayload] = v as string
    }
    onGuardar(payload)
  }

  return (
    <Section title="Gestión de Compras">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <Field label="Plataforma">
            <select
              value={form.plataforma}
              onChange={(e) => set("plataforma", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white"
            >
              <option value="">— Sin asignar —</option>
              <option value="logimat">LOGIMAT S.A.S.</option>
              <option value="imc cargo">IMC Cargo International S.A.S.</option>
              <option value="imc depósito">IMC Depósito S.A.S.</option>
            </select>
          </Field>
          <Field label="N° Remisión">
            <input
              type="text"
              value={form.numero_remision}
              onChange={(e) => set("numero_remision", e.target.value)}
              placeholder="Ej: REM-2025-001"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </Field>
          <Field label="N° Factura">
            <input
              type="text"
              value={form.numero_factura}
              onChange={(e) => set("numero_factura", e.target.value)}
              placeholder="Ej: FAC-2025-001"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </Field>
          <Field label="Aval de compra">
            <input
              type="text"
              value={form.aval_compra}
              onChange={(e) => set("aval_compra", e.target.value)}
              placeholder="Nombre o referencia del aprobador"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </Field>
          <Field label="Fecha estimada de entrega">
            <input
              type="date"
              value={form.fecha_estimada_entrega}
              onChange={(e) => set("fecha_estimada_entrega", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </Field>
          <Field label="Fecha confirmada de entrega">
            <input
              type="date"
              value={form.fecha_confirmada_entrega}
              onChange={(e) => set("fecha_confirmada_entrega", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </Field>
          <Field label="Fecha recepción factura">
            <input
              type="date"
              value={form.fecha_recibida_factura}
              onChange={(e) => set("fecha_recibida_factura", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </Field>
          <Field label="Observaciones de compras">
            <textarea
              rows={2}
              value={form.observaciones_compras}
              onChange={(e) => set("observaciones_compras", e.target.value)}
              placeholder="Notas internas del equipo de compras"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </Field>
          <Field label="Observación contabilidad">
            <textarea
              rows={2}
              value={form.observacion_contabilidad}
              onChange={(e) => set("observacion_contabilidad", e.target.value)}
              placeholder="Nota para contabilidad"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </Field>
        </div>
        <button
          onClick={handleGuardar}
          disabled={isLoading}
          className="w-full rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Guardando..." : "Guardar gestión"}
        </button>
      </div>
    </Section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ── Helpers visuales ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value ?? "—"}</p>
    </div>
  )
}

function TimelineItem({
  label,
  date,
  done,
}: {
  label: string
  date: string | null | undefined
  done: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
          done ? "bg-green-500" : "bg-gray-200"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${done ? "text-gray-800" : "text-gray-400"}`}>{label}</p>
        {date && (
          <p className="text-xs text-gray-400">
            {formatFechaHora(date)}
          </p>
        )}
      </div>
    </div>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value)
}

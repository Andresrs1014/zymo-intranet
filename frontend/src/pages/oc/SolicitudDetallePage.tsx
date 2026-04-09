import { useNavigate, useParams } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { useSolicitud, useAsignarAuxiliar, useCambiarEstado } from "@/hooks/useOC"
import { useAuthStore } from "@/store/authStore"
import { EstadoBadge } from "./SolicitudesPage"
import type { EstadoOC } from "@/types/oc"

export function SolicitudDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: solicitud, isLoading } = useSolicitud(id)
  const asignar = useAsignarAuxiliar()
  const cambiarEstado = useCambiarEstado()

  function handleAsignarme() {
    if (!id || !user) return
    asignar.mutate({ id, auxiliar_id: user.id })
  }

  function handleCambiarEstado(estado: EstadoOC) {
    if (!id) return
    cambiarEstado.mutate({ id, estado })
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
  const puedeAsignarse = !solicitud.auxiliar_id && (user?.role === "admin" || user?.area === "Compras")

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="OC Automatizaciones" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Breadcrumb */}
          <button
            onClick={() => navigate("/oc/solicitudes")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            ← Volver a solicitudes
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

            {/* Acciones principales */}
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

              {/* Datos del pedido */}
              <Section title="Detalle del Pedido">
                <InfoGrid>
                  <InfoItem label="Descripción" value={solicitud.descripcion} />
                  <InfoItem label="Cantidad" value={String(solicitud.cantidad)} />
                  <InfoItem label="Categoría" value={solicitud.categoria} />
                  <InfoItem label="Grupo de artículos" value={solicitud.grupo_articulos} />
                  <InfoItem label="Prioridad" value={solicitud.nivel_prioridad} />
                  <InfoItem label="Cliente" value={solicitud.cliente} />
                  <InfoItem label="Condición" value={solicitud.condicion} />
                  <InfoItem label="Placa / Ficha técnica" value={solicitud.placa_ficha} />
                  {solicitud.fecha_proximo_mantenimiento && (
                    <InfoItem label="Próximo mantenimiento" value={solicitud.fecha_proximo_mantenimiento} />
                  )}
                </InfoGrid>
                {solicitud.observaciones_solicitante && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs font-medium text-gray-400 mb-1">Observaciones del solicitante</p>
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
                  <InfoItem label="Sede" value={solicitud.sede} />
                </InfoGrid>
              </Section>
            </div>

            {/* Columna lateral — estado y gestión */}
            <div className="space-y-4">
              <Section title="Estado del Proceso">
                <div className="space-y-2">
                  <TimelineItem
                    label="Solicitud recibida"
                    date={solicitud.fecha_solicitud}
                    done
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

              {/* Cambio de estado manual (solo auxiliar asignado o admin) */}
              {(esAuxiliarAsignado || user?.role === "admin") &&
                solicitud.estado === "en_cotizacion" && (
                  <Section title="Gestión">
                    <p className="text-xs text-gray-500 mb-3">
                      Cuando tengas la cotización lista, cárgala para enviar a aprobación.
                    </p>
                    <button
                      onClick={() => navigate(`/oc/solicitudes/${solicitud.id}/cotizar`)}
                      className="w-full rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors"
                    >
                      Cargar cotización
                    </button>
                  </Section>
                )}

              {solicitud.auxiliar_id && (
                <Section title="Auxiliar asignado">
                  <p className="text-sm text-gray-600">
                    ID: <span className="font-medium">{solicitud.auxiliar_id}</span>
                  </p>
                </Section>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────

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
            {new Date(date).toLocaleDateString("es-CO", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  )
}

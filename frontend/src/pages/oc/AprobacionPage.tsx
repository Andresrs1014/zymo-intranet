import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { useSolicitudes } from "@/hooks/useOC"
import { EstadoBadge } from "./SolicitudesPage"
import type { SolicitudOC } from "@/types/oc"

export function AprobacionPage() {
  const navigate = useNavigate()

  const { data: solicitudes = [], isLoading, isRefetching } = useSolicitudes({
    estado: "pendiente_aprobacion",
  })

  return (
    <PageLayout title="OC Automatizaciones">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Panel de Aprobaciones</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Solicitudes pendientes de tu revisión
                {isRefetching && (
                  <span className="ml-2 text-brand-blue/60">actualizando...</span>
                )}
              </p>
            </div>
            {solicitudes.length > 0 && (
              <span className="flex items-center justify-center h-8 min-w-8 px-2.5 rounded-full bg-orange-100 text-orange-700 text-sm font-bold">
                {solicitudes.length}
              </span>
            )}
          </div>

          {/* Contenido */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Cargando...
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-gray-700 font-medium">Sin pendientes</p>
              <p className="text-gray-400 text-sm mt-1">
                No hay cotizaciones esperando tu aprobación.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {solicitudes.map((s) => (
                <AprobacionCard
                  key={s.id}
                  solicitud={s}
                  onRevisar={() => navigate(`/oc/solicitudes/${s.id}`)}
                />
              ))}
            </div>
          )}
    </PageLayout>
  )
}

function AprobacionCard({
  solicitud: s,
  onRevisar,
}: {
  solicitud: SolicitudOC
  onRevisar: () => void
}) {
  const diasEspera = Math.floor(
    (Date.now() - new Date(s.fecha_cotizacion ?? s.fecha_solicitud).getTime()) / 86400000
  )

  return (
    <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-5 flex items-center justify-between gap-4 hover:border-orange-200 transition-colors">
      <div className="flex items-start gap-4 min-w-0">
        {/* Indicador de urgencia */}
        <div
          className={`shrink-0 mt-0.5 h-2.5 w-2.5 rounded-full ${
            s.nivel_prioridad === "Alta"
              ? "bg-red-500"
              : s.nivel_prioridad === "Media"
              ? "bg-yellow-500"
              : "bg-gray-300"
          }`}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-brand-blue">
              {s.consecutivo_os}
            </span>
            <EstadoBadge estado={s.estado} />
            <span className="text-xs text-gray-400">· Prioridad {s.nivel_prioridad}</span>
          </div>

          <p className="font-medium text-gray-900 truncate">{s.descripcion}</p>

          <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
            <span>Cant: {s.cantidad}</span>
            {s.area_solicitante && <span>{s.area_solicitante}</span>}
            {s.sede && <span>{s.sede}</span>}
            <span>Solicitado por: {s.solicitante_nombre}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {/* Días en espera */}
        <div className="text-right hidden md:block">
          <p className="text-xs text-gray-400">En espera</p>
          <p
            className={`text-sm font-semibold ${
              diasEspera >= 3 ? "text-red-500" : "text-gray-700"
            }`}
          >
            {diasEspera === 0 ? "Hoy" : `${diasEspera}d`}
          </p>
        </div>

        <button
          onClick={onRevisar}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors"
        >
          Revisar
        </button>
      </div>
    </div>
  )
}

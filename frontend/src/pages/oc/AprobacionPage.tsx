import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { OcSolicitudesPagination } from "@/components/oc/OcSolicitudesPagination"
import { useSolicitudes, OC_SOLICITUDES_PAGE_SIZE } from "@/hooks/useOC"
import { EstadoBadge } from "./SolicitudesPage"
import { Button } from "@/components/ui/button"
import type { SolicitudOC } from "@/types/oc"

export function AprobacionPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const { data, isLoading, isRefetching } = useSolicitudes(
    { estado: "pendiente_aprobacion" },
    page,
  )
  const solicitudes = data?.items ?? []
  const total = data?.total ?? 0

  useEffect(() => {
    if (total === 0) return
    const totalPages = Math.max(1, Math.ceil(total / OC_SOLICITUDES_PAGE_SIZE))
    if (page > totalPages) setPage(totalPages)
  }, [total, page])

  return (
    <PageLayout title="OC Automatizaciones">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">Panel de Aprobaciones</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Solicitudes pendientes de tu revisión
                {isRefetching && (
                  <span className="ml-2 text-brand-blue/60">actualizando...</span>
                )}
              </p>
            </div>
            {total > 0 && (
              <span className="flex items-center justify-center h-8 min-w-8 px-2.5 rounded-full bg-orange-100 text-orange-700 text-sm font-bold">
                {total}
              </span>
            )}
          </div>

          {/* Contenido */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Cargando...
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-foreground font-medium">Sin pendientes</p>
              <p className="text-muted-foreground text-sm mt-1">
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
              <OcSolicitudesPagination
                currentPage={page}
                totalItems={total}
                pageSize={OC_SOLICITUDES_PAGE_SIZE}
                onPageChange={setPage}
              />
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
    <div className="bg-card rounded-xl border border-orange-100 shadow-sm p-5 flex items-center justify-between gap-4 hover:border-orange-200 transition-colors">
      <div className="flex items-start gap-4 min-w-0">
        {/* Indicador de urgencia */}
        <div
          className={`shrink-0 mt-0.5 h-2.5 w-2.5 rounded-full ${
            s.nivel_prioridad === "Alta"
              ? "bg-red-500"
              : s.nivel_prioridad === "Media"
              ? "bg-yellow-500"
              : "bg-muted-foreground/30"
          }`}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-brand-blue">
              {s.consecutivo_os}
            </span>
            <EstadoBadge estado={s.estado} />
            <span className="text-xs text-muted-foreground">· Prioridad {s.nivel_prioridad}</span>
          </div>

          <p className="font-medium text-foreground truncate">{s.descripcion}</p>

          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
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
          <p className="text-xs text-muted-foreground">En espera</p>
          <p
            className={`text-sm font-semibold ${
              diasEspera >= 3 ? "text-red-500" : "text-foreground"
            }`}
          >
            {diasEspera === 0 ? "Hoy" : `${diasEspera}d`}
          </p>
        </div>

        <Button
          onClick={onRevisar}
          variant="default"
          size="sm"
        >
          Revisar
        </Button>
      </div>
    </div>
  )
}

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { MantenimientoMobileLayout } from "@/components/mantenimiento/MantenimientoMobileLayout"
import { useMantenimientoPortal } from "@/context/MantenimientoPortalContext"
import { useSolicitudesMantenimiento, usePoolDisponibles, useAutoAsignarMantenimiento } from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import { canManageMantenimiento, canOperateMantenimientoCampo, canSeeAllMantenimientos } from "@/lib/permissions"
import type { MantenimientoFilters, SolicitudMantenimiento, EstadoMantenimiento } from "@/types/mantenimiento"
import { mntSearch, mntSelect } from "@/components/mantenimiento/mntFormClasses"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

const MNT_PAGE_SIZE = 20

const ESTADO_LABELS: Record<EstadoMantenimiento, string> = {
  solicitud:  "Solicitud",
  programado: "Programado",
  ejecucion:  "En ejecución",
  completado: "Completado",
  cancelado:  "Cancelado",
  evaluacion: "Programado",
  cerrado:    "Completado",
}

const ESTADO_COLOR: Record<EstadoMantenimiento, string> = {
  solicitud:  "bg-sky-50 text-sky-700 border-sky-200",
  programado: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ejecucion:  "bg-orange-50 text-orange-700 border-orange-200",
  completado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelado:  "bg-red-50 text-red-700 border-red-200",
  evaluacion: "bg-indigo-50 text-indigo-700 border-indigo-200",
  cerrado:    "bg-emerald-50 text-emerald-700 border-emerald-200",
}

function EstadoBadge({ estado }: { estado: EstadoMantenimiento }) {
  const colorClass = ESTADO_COLOR[estado] ?? "bg-muted text-muted-foreground border-border"
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorClass}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  )
}

function ClasifBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
      value === "correctivo"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200"
    }`}>
      {value === "correctivo" ? "Correctivo" : "Preventivo"}
    </span>
  )
}

function ModalidadBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {value === "interno" ? "Interno" : "Externo"}
    </span>
  )
}

export default function MantenimientoPage() {
  const navigate = useNavigate()
  const portal = useMantenimientoPortal()
  const user = useAuthStore((s) => s.user)
  const puedeGestionar = portal
    ? portal.session.can_manage
    : user
      ? canManageMantenimiento(user.role, user.app_permissions)
      : false
  const puedeOperarCampo = portal
    ? portal.session.can_operate && portal.session.is_auxiliar
    : user
      ? canOperateMantenimientoCampo(user.role, user.app_permissions) &&
        user.role === "auxiliar_mantenimiento"
      : false
  const puedeVerTablero = portal
    ? portal.session.can_see_tablero
    : user
      ? canSeeAllMantenimientos(user.role) || puedeGestionar
      : false
  const [vista, setVista] = useState<"mis" | "disponibles">("mis")
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<MantenimientoFilters>({})
  const [search, setSearch] = useState("")

  const { data, isLoading } = useSolicitudesMantenimiento(filters, page)
  const { data: pool = [], isLoading: loadingPool } = usePoolDisponibles(
    puedeOperarCampo && vista === "disponibles",
  )
  const autoAsignar = useAutoAsignarMantenimiento()
  const totalPages = data ? Math.ceil(data.total / MNT_PAGE_SIZE) : 1
  const listaItems = vista === "disponibles" ? pool : (data?.items ?? [])
  const listaLoading = vista === "disponibles" ? loadingPool : isLoading

  function handleEstadoChange(estado: string) {
    setFilters((f) => ({ ...f, estado: (estado || undefined) as MantenimientoFilters["estado"] }))
    setPage(1)
  }

  function handleClasifChange(clasificacion: string) {
    setFilters((f) => ({ ...f, clasificacion: (clasificacion || undefined) as MantenimientoFilters["clasificacion"] }))
    setPage(1)
  }

  function irDetalle(id: number) {
    navigate(portal ? portal.detallePath(id) : `/mantenimiento/${id}`)
  }

  const contenido = (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Solicitudes de Mantenimiento</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {vista === "disponibles"
                ? `${pool.length} disponibles en pool`
                : `${data?.total ?? 0} solicitudes en total`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {puedeVerTablero && (
              <button
                type="button"
                onClick={() => navigate("/mantenimiento/tablero")}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                Tablero KPIs
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(
                puedeGestionar
                  ? "/mantenimiento/nueva"
                  : "/operativo/nueva-solicitud?tipo=mantenimiento"
              )}
              className="flex items-center gap-2 rounded-lg bg-amber-500 hover:brightness-105 px-4 py-2 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Nueva solicitud
          </button>
          </div>
        </div>

        {puedeOperarCampo && (
          <div className="flex gap-2" role="tablist" aria-label="Vista de solicitudes">
            <button
              type="button"
              role="tab"
              aria-selected={vista === "mis"}
              onClick={() => { setVista("mis"); setPage(1) }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                vista === "mis"
                  ? "bg-sky-500/15 text-sky-700 border border-sky-500/40"
                  : "text-muted-foreground border border-transparent hover:text-foreground"
              }`}
            >
              Mis asignadas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vista === "disponibles"}
              onClick={() => setVista("disponibles")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                vista === "disponibles"
                  ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/40"
                  : "text-muted-foreground border border-transparent hover:text-foreground"
              }`}
            >
              Disponibles ({pool.length})
            </button>
          </div>
        )}

        {/* Filtros */}
        {vista === "mis" && (
        <div className="flex gap-3 flex-wrap">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setFilters((f) => ({ ...f, q: search.trim() || undefined }))
              setPage(1)
            }}
            className="relative flex-1 min-w-[200px] max-w-xs"
          >
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              type="search"
              name="q"
              aria-label="Buscar solicitudes"
              placeholder="Buscar por título o #…"
              className={mntSearch}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <select
            aria-label="Filtrar por estado"
            className={mntSelect}
            value={filters.estado ?? ""}
            onChange={(e) => handleEstadoChange(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="solicitud">Solicitud</option>
            <option value="programado">Programado</option>
            <option value="ejecucion">En ejecución</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <select
            aria-label="Filtrar por clasificación"
            className={mntSelect}
            value={filters.clasificacion ?? ""}
            onChange={(e) => handleClasifChange(e.target.value)}
          >
            <option value="">Todas las clasificaciones</option>
            <option value="preventivo">Preventivo</option>
            <option value="correctivo">Correctivo</option>
          </select>
        </div>
        )}

        {/* Tabla */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Título</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Clasificación</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Modalidad</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Solicitante</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                {vista === "disponibles" && (
                  <th className="px-4 py-3 font-medium text-muted-foreground">Acción</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/50">
              {listaLoading && (
                <tr>
                  <td colSpan={vista === "disponibles" ? 9 : 8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    Cargando…
                  </td>
                </tr>
              )}
              {!listaLoading && listaItems.length === 0 && (
                <tr>
                  <td colSpan={vista === "disponibles" ? 9 : 8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    {vista === "disponibles"
                      ? "No hay solicitudes internas disponibles en el pool."
                      : "No se encontraron solicitudes."}
                  </td>
                </tr>
              )}
              {listaItems.map((sol: SolicitudMantenimiento) => (
                  <tr
                    key={sol.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td
                      className="px-4 py-3 font-mono text-xs text-muted-foreground cursor-pointer"
                      onClick={() => irDetalle(sol.id)}
                    >
                      {sol.consecutivo}
                    </td>
                    <td
                      className="px-4 py-3 font-medium text-foreground max-w-[200px] min-w-0 truncate cursor-pointer"
                      onClick={() => irDetalle(sol.id)}
                    >
                      {sol.titulo}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs" onClick={() => irDetalle(sol.id)}>
                      {sol.tipo_mantenimiento}
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => irDetalle(sol.id)}>
                      <ClasifBadge value={sol.clasificacion} />
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => irDetalle(sol.id)}>
                      <ModalidadBadge value={sol.modalidad} />
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => irDetalle(sol.id)}>
                      <EstadoBadge estado={sol.estado} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs cursor-pointer" onClick={() => irDetalle(sol.id)}>
                      {sol.solicitante_nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs cursor-pointer" onClick={() => irDetalle(sol.id)}>
                      {formatDistanceToNow(new Date(sol.created_at), { addSuffix: true, locale: es })}
                    </td>
                    {vista === "disponibles" && (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={autoAsignar.isPending}
                          onClick={(e) => {
                            e.stopPropagation()
                            void autoAsignar.mutateAsync(sol.id).then(() => {
                              setVista("mis")
                              irDetalle(sol.id)
                            })
                          }}
                          className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                        >
                          Tomar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>

          {vista === "mis" && totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                Anterior
              </button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
  )

  if (portal) {
    return (
      <MantenimientoMobileLayout title="Mis solicitudes">
        {contenido}
      </MantenimientoMobileLayout>
    )
  }

  return (
    <PageLayout title="Mantenimiento">
      {contenido}
    </PageLayout>
  )
}

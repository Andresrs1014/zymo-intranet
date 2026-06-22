import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { MantenimientoMobileLayout } from "@/components/mantenimiento/MantenimientoMobileLayout"
import { useMantenimientoPortal } from "@/context/MantenimientoPortalContext"
import { useSolicitudesMantenimiento } from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import { canManageMantenimiento, canSeeAllMantenimientos } from "@/lib/permissions"
import type { MantenimientoFilters, SolicitudMantenimiento, EstadoMantenimiento } from "@/types/mantenimiento"
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
  const role = portal?.session.role ?? user?.role ?? ""
  const appPerms = portal?.session.app_permissions ?? user?.app_permissions
  const puedeGestionar = portal
    ? portal.session.can_manage
    : user
      ? canManageMantenimiento(user.role, user.app_permissions)
      : false
  const puedeVerTablero = portal
    ? portal.session.can_see_tablero
    : user
      ? canSeeAllMantenimientos(user.role) || puedeGestionar
      : false
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<MantenimientoFilters>({})
  const [search, setSearch] = useState("")

  const { data, isLoading } = useSolicitudesMantenimiento(filters, page)
  const totalPages = data ? Math.ceil(data.total / MNT_PAGE_SIZE) : 1

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
              {data?.total ?? 0} solicitudes en total
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {puedeVerTablero && (
              <button
                onClick={() => navigate("/mantenimiento/tablero")}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Tablero KPIs
              </button>
            )}
            <button
              onClick={() => navigate(
                puedeGestionar
                  ? "/mantenimiento/nueva"
                  : "/operativo/nueva-solicitud?tipo=mantenimiento"
              )}
              className="flex items-center gap-2 rounded-lg bg-amber-500 hover:brightness-105 px-4 py-2 text-sm font-semibold text-white transition-all"
            >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Nueva solicitud
          </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setFilters((f) => ({ ...f, q: search.trim() || undefined }))
              setPage(1)
            }}
            className="relative flex-1 min-w-[200px] max-w-xs"
          >
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por título o #..."
              className="w-full pl-9 pr-3 h-9 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={filters.clasificacion ?? ""}
            onChange={(e) => handleClasifChange(e.target.value)}
          >
            <option value="">Todas las clasificaciones</option>
            <option value="preventivo">Preventivo</option>
            <option value="correctivo">Correctivo</option>
          </select>
        </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/50">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    Cargando...
                  </td>
                </tr>
              )}
              {!isLoading && (data?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    No se encontraron solicitudes.
                  </td>
                </tr>
              )}
              {(data?.items ?? []).map((sol: SolicitudMantenimiento) => (
                  <tr
                    key={sol.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => irDetalle(sol.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {sol.consecutivo}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                      {sol.titulo}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {sol.tipo_mantenimiento}
                    </td>
                    <td className="px-4 py-3">
                      <ClasifBadge value={sol.clasificacion} />
                    </td>
                    <td className="px-4 py-3">
                      <ModalidadBadge value={sol.modalidad} />
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={sol.estado} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {sol.solicitante_nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(sol.created_at), { addSuffix: true, locale: es })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
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

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  EstadoMantenimientoBadge,
  ClasificacionBadge,
  ModalidadBadge,
} from "@/components/mantenimiento/EstadoMantenimientoBadge"
import { useSolicitudesMantenimiento } from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import { canManageMantenimiento } from "@/lib/permissions"
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { MantenimientoFilters } from "@/types/mantenimiento"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

const ESTADOS_FILTER = [
  { value: "",           label: "Todos los estados" },
  { value: "solicitud",  label: "Solicitud" },
  { value: "evaluacion", label: "Evaluación" },
  { value: "programado", label: "Programado" },
  { value: "ejecucion",  label: "En Ejecución" },
  { value: "completado", label: "Completado" },
  { value: "cerrado",    label: "Cerrado" },
  { value: "cancelado",  label: "Cancelado" },
]

export default function MantenimientoPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [page, setPage]       = useState(1)
  const [filters, setFilters] = useState<MantenimientoFilters>({})
  const [search, setSearch]   = useState("")

  const activeFilters: MantenimientoFilters = {
    ...filters,
    q: search || undefined,
  }

  const { data, isLoading } = useSolicitudesMantenimiento(activeFilters, page)

  const puedeCrear = canManageMantenimiento(user?.role ?? "", user?.app_permissions)

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
  }

  return (
    <PageLayout title="Mantenimiento">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Solicitudes de Mantenimiento</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data?.total ?? 0} solicitudes en total
            </p>
          </div>
          {puedeCrear && (
            <Button onClick={() => navigate("/mantenimiento/nueva")} className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva solicitud
            </Button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
            onChange={(e) => { setFilters(f => ({ ...f, estado: e.target.value as any })); setPage(1) }}
          >
            {ESTADOS_FILTER.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={filters.clasificacion ?? ""}
            onChange={(e) => { setFilters(f => ({ ...f, clasificacion: e.target.value as any })); setPage(1) }}
          >
            <option value="">Todas las clasificaciones</option>
            <option value="preventivo">Preventivo</option>
            <option value="correctivo">Correctivo</option>
          </select>

          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={filters.modalidad ?? ""}
            onChange={(e) => { setFilters(f => ({ ...f, modalidad: e.target.value as any })); setPage(1) }}
          >
            <option value="">Todas las modalidades</option>
            <option value="interno">Interno</option>
            <option value="externo">Externo</option>
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
                <th className="px-4 py-3 font-medium text-muted-foreground">Asignado</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Creado</th>
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
              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    No se encontraron solicitudes.
                  </td>
                </tr>
              )}
              {data?.items.map((sol) => (
                <tr
                  key={sol.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/mantenimiento/${sol.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {sol.consecutivo}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                    {sol.titulo}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{sol.tipo_mantenimiento}</td>
                  <td className="px-4 py-3">
                    <ClasificacionBadge clasificacion={sol.clasificacion} />
                  </td>
                  <td className="px-4 py-3">
                    <ModalidadBadge modalidad={sol.modalidad} />
                  </td>
                  <td className="px-4 py-3">
                    <EstadoMantenimientoBadge estado={sol.estado} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {sol.asignado_nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(sol.created_at), { addSuffix: true, locale: es })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data && data.pages > 1 && (
            <div className="px-4 py-3 border-t border-border">
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)) }}
                  />
                  {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                    <PaginationLink
                      key={p}
                      href="#"
                      isActive={p === page}
                      onClick={(e) => { e.preventDefault(); setPage(p) }}
                    >
                      {p}
                    </PaginationLink>
                  ))}
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.min(data.pages, p + 1)) }}
                  />
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}

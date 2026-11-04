import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { OcSolicitudesPagination } from "@/components/oc/OcSolicitudesPagination"
import { api } from "@/lib/api"
import { useSolicitudes, OC_SOLICITUDES_PAGE_SIZE, type SolicitudesFilters } from "@/hooks/useOC"
import { useSedesParaSolicitudesOc } from "@/hooks/useSedes"
import { useAreas } from "@/hooks/useAreas"
import { Combobox } from "@/components/ui/Combobox"
import { formatFechaRelativa } from "@/lib/dates"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { ComprasBarraInferior, SolicitudCardMovil } from "@/components/oc/ComprasMovil"
import { MovilFab } from "@/components/movil/Movil"
import { canSeeOperativo } from "@/lib/permissions"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import type { EstadoOC, SolicitudOC } from "@/types/oc"

const ESTADOS_OPTIONS = [
  { value: "nueva", label: "Nueva" },
  { value: "en_cotizacion", label: "En cotización" },
  { value: "pendiente_aprobacion", label: "Cotización lista" },
  { value: "aprobada", label: "Aprobada" },
  { value: "rechazada", label: "Rechazada" },
  { value: "oc_enviada", label: "OC Enviada" },
  { value: "oc_en_plataforma", label: "En plataforma" },
  { value: "entregada", label: "Entregada" },
  { value: "cerrada", label: "Cerrada" },
]

async function descargarExcelOc(): Promise<string> {
  const res = await api.get("/api/oc/solicitudes/excel", { responseType: "blob" })
  const disposition: string = res.headers["content-disposition"] ?? ""
  const match = disposition.match(/filename="(.+?)"/)
  const filename = match ? match[1] : "solicitudes-oc.xlsx"
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}

export function SolicitudesPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  // Crear solicitudes vive en Operativo (misma ruta que en escritorio)
  const puedeCrear = !!user && canSeeOperativo(user.role, user.area, user.app_permissions)
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null)
  const [plataformaFiltro, setPlataformaFiltro] = useState<string | null>(null)
  const [areaFiltro, setAreaFiltro] = useState<string | null>(null)
  const [textoBusqueda, setTextoBusqueda] = useState("")
  const [q, setQ] = useState("")
  const [descargando, setDescargando] = useState(false)
  const [errorExcel, setErrorExcel] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data: sedesOc = [] } = useSedesParaSolicitudesOc()
  const { data: areas = [] } = useAreas()
  const opcionesPlataformaFiltro = useMemo(
    () => sedesOc.map((s) => ({ value: s.name, label: s.name })),
    [sedesOc],
  )
  const opcionesAreaFiltro = useMemo(
    () => areas.map((a) => ({ value: a.name, label: a.name })),
    [areas],
  )

  useEffect(() => {
    const t = window.setTimeout(() => setQ(textoBusqueda.trim()), 300)
    return () => window.clearTimeout(t)
  }, [textoBusqueda])

  const listFilters = useMemo((): SolicitudesFilters => {
    const f: SolicitudesFilters = {}
    if (estadoFiltro) f.estado = estadoFiltro
    if (plataformaFiltro) f.plataforma = plataformaFiltro
    if (areaFiltro) f.area = areaFiltro
    if (q) f.q = q
    return f
  }, [estadoFiltro, plataformaFiltro, areaFiltro, q])

  useEffect(() => {
    setPage(1)
  }, [estadoFiltro, plataformaFiltro, areaFiltro, q])

  async function handleDescargarExcel() {
    if (descargando) return
    setDescargando(true)
    setErrorExcel(null)
    try {
      await descargarExcelOc()
    } catch {
      setErrorExcel("No se pudo descargar el Excel.")
    } finally {
      setDescargando(false)
    }
  }

  const { data, isLoading, isRefetching } = useSolicitudes(listFilters, page)
  const solicitudes = data?.items ?? []
  const total = data?.total ?? 0

  useEffect(() => {
    if (total === 0) return
    const totalPages = Math.max(1, Math.ceil(total / OC_SOLICITUDES_PAGE_SIZE))
    if (page > totalPages) setPage(totalPages)
  }, [total, page])

  return (
    <PageLayout
      title="OC Automatizaciones"
      movil={{
        titulo: "Compras",
        subtitulo: isRefetching ? "Actualizando…" : "Solicitudes de compra",
        barraInferior: <ComprasBarraInferior />,
        flotante: puedeCrear ? <MovilFab etiqueta="Nueva" a="/operativo/nueva-solicitud" /> : undefined,
        conFlotante: true,
      }}
    >
          {/* Teléfono: buscador y estados como chips desplazables */}
          <div className="mb-3 md:hidden">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#71717A]" aria-hidden />
              <input
                type="search"
                value={textoBusqueda}
                onChange={(e) => setTextoBusqueda(e.target.value)}
                placeholder="Buscar por OS, proveedor o cotización"
                aria-label="Buscar por OS, proveedor o número de cotización"
                className="h-11 w-full rounded-xl border border-[#E4E4E7] bg-white pl-11 pr-3 text-[15px] text-[#18181B] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#C3182A]/30"
              />
            </label>
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar por estado">
              {[{ value: null, label: "Todas" }, ...ESTADOS_OPTIONS].map((o) => {
                const on = estadoFiltro === o.value
                return (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setEstadoFiltro(o.value)}
                    className={cn(
                      "h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition-colors motion-reduce:transition-none",
                      on ? "border-[#1F1F23] bg-[#1F1F23] text-white" : "border-[#E4E4E7] bg-white text-[#71717A]",
                    )}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Header */}
          <div className="hidden md:flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">Solicitudes de Compra</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Panel del Auxiliar de Compras
                {isRefetching && (
                  <span className="ml-2 text-primary/60">actualizando...</span>
                )}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleDescargarExcel()}
              disabled={descargando}
              className="shrink-0 bg-[#003087] hover:bg-[#002266]"
            >
              {descargando ? "Descargando..." : "Descargar Excel"}
            </Button>
          </div>

          {/* Filtros */}
          <div className="hidden md:flex flex-wrap gap-3 mb-4 items-center">
            <div className="relative w-72">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.48 9.74l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                value={textoBusqueda}
                onChange={(e) => setTextoBusqueda(e.target.value)}
                placeholder="OS, proveedor o cotización"
                aria-label="Buscar por OS, proveedor o número de cotización"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Combobox
              className="w-52"
              options={ESTADOS_OPTIONS}
              value={estadoFiltro}
              onChange={(v) => setEstadoFiltro(v as string | null)}
              placeholder="Todos los estados"
            />
            <Combobox
              className="w-44"
              options={opcionesPlataformaFiltro}
              value={plataformaFiltro}
              onChange={(v) => setPlataformaFiltro(v as string | null)}
              placeholder="Todas las plataformas"
            />
            <Combobox
              className="w-48"
              options={opcionesAreaFiltro}
              value={areaFiltro}
              onChange={(v) => setAreaFiltro(v as string | null)}
              placeholder="Todas las áreas"
            />
          </div>
          {errorExcel && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {errorExcel}
            </div>
          )}

          {/* Teléfono: tarjetas en lugar de tabla */}
          <div className="md:hidden">
            {isLoading ? (
              <p className="py-16 text-center text-sm text-[#71717A]">Cargando…</p>
            ) : solicitudes.length === 0 ? (
              <p className="py-16 text-center text-sm text-[#71717A]">No hay solicitudes con los filtros aplicados.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {solicitudes.map((s) => (
                  <SolicitudCardMovil key={s.id} solicitud={s} />
                ))}
                <OcSolicitudesPagination
                  currentPage={page}
                  totalItems={total}
                  pageSize={OC_SOLICITUDES_PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>

          {/* Tabla */}
          <div className="hidden md:block bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Cargando...
              </div>
            ) : solicitudes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground text-sm">No hay solicitudes con los filtros aplicados.</p>
              </div>
            ) : (
              <>
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 font-medium text-muted-foreground">Consecutivo</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Descripción</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Solicitante</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Plataforma</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Prioridad</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Fecha</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/50">
                    {solicitudes.map((s) => (
                      <SolicitudRow
                        key={s.id}
                        solicitud={s}
                        onView={() => navigate(`/oc/solicitudes/${s.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
                <div className="px-4 pb-2">
                  <OcSolicitudesPagination
                    currentPage={page}
                    totalItems={total}
                    pageSize={OC_SOLICITUDES_PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )}
          </div>
    </PageLayout>
  )
}

function SolicitudRow({
  solicitud: s,
  onView,
}: {
  solicitud: SolicitudOC
  onView: () => void
}) {
  return (
    <tr className="hover:bg-muted/50 transition-colors">
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-medium text-primary">
          {s.consecutivo_os}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-foreground truncate max-w-[200px]">{s.descripcion}</p>
        <p className="text-xs text-muted-foreground">Cant: {s.cantidad}</p>
      </td>
      <td className="px-4 py-3 text-foreground hidden md:table-cell">
        <p className="truncate max-w-[140px]">{s.solicitante_nombre}</p>
        {s.area_solicitante && (
          <p className="text-xs text-muted-foreground">{s.area_solicitante}</p>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
        {s.plataforma ?? "—"}
      </td>
      <td className="px-4 py-3">
        <PrioridadBadge prioridad={s.nivel_prioridad} />
        <SLABadge
          prioridad={s.nivel_prioridad}
          estado={s.estado}
          fechaSolicitud={s.fecha_solicitud}
        />
      </td>
      <td className="px-4 py-3">
        <EstadoBadge estado={s.estado} />
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
        {formatDate(s.fecha_solicitud)}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={onView}
          className="text-xs font-medium text-primary hover:bg-primary/10"
        >
          Ver detalle
        </Button>
      </td>
    </tr>
  )
}

export function EstadoBadge({ estado }: { estado: EstadoOC | string }) {
  const config: Record<string, { label: string; className: string }> = {
    nueva:                 { label: "Nueva",               className: "bg-blue-100 text-blue-700" },
    en_cotizacion:         { label: "En cotización",          className: "bg-yellow-100 text-yellow-700" },
    pendiente_aprobacion:  { label: "Cotización lista",     className: "bg-orange-100 text-orange-700" },
    aprobada:              { label: "Aprobada",            className: "bg-green-100 text-green-700" },
    rechazada:             { label: "Rechazada",           className: "bg-red-100 text-red-700" },
    oc_enviada:            { label: "OC Enviada",          className: "bg-indigo-100 text-indigo-700" },
    oc_en_plataforma:      { label: "En plataforma",       className: "bg-violet-100 text-violet-700" },
    entregada:             { label: "Entregada",           className: "bg-teal-100 text-teal-700" },
    cerrada:               { label: "Cerrada",             className: "bg-muted text-muted-foreground" },
  }
  const c = config[estado] ?? { label: estado, className: "bg-muted text-muted-foreground" }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  )
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const config: Record<string, string> = {
    Alta:  "bg-red-50 text-red-600",
    Media: "bg-yellow-50 text-yellow-700",
    Baja:  "bg-muted text-muted-foreground",
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config[prioridad] ?? "bg-muted text-muted-foreground"}`}>
      {prioridad}
    </span>
  )
}

// ── SLA helpers ──────────────────────────────────────────────────────────────

const SLA_HORAS: Record<string, number> = {
  Alta:  4,
  Media: 24,
  Baja:  72,
}

const ESTADOS_SLA_ACTIVOS = new Set([
  "nueva",
  "en_cotizacion",
  "pendiente_aprobacion",
  "aprobada",
])

interface SLAResult {
  vencido: boolean
  horasRestantes: number
  horasVencido: number
}

function calcularSLA(
  prioridad: string,
  fechaSolicitud: string,
  estado: string,
): SLAResult | null {
  if (!ESTADOS_SLA_ACTIVOS.has(estado)) return null
  const limiteHoras = SLA_HORAS[prioridad]
  if (limiteHoras === undefined) return null

  const inicio = new Date(fechaSolicitud).getTime()
  const ahora  = Date.now()
  const transcurridasMs = ahora - inicio
  const limiteMs = limiteHoras * 60 * 60 * 1000
  const diferenciasHoras = (limiteMs - transcurridasMs) / (60 * 60 * 1000)

  if (diferenciasHoras >= 0) {
    return { vencido: false, horasRestantes: Math.round(diferenciasHoras), horasVencido: 0 }
  }
  return { vencido: true, horasRestantes: 0, horasVencido: Math.round(-diferenciasHoras) }
}

function SLABadge({
  prioridad,
  estado,
  fechaSolicitud,
}: {
  prioridad: string
  estado: string
  fechaSolicitud: string
}) {
  const sla = calcularSLA(prioridad, fechaSolicitud, estado)
  if (!sla) return null

  if (sla.vencido) {
    return (
      <span className="mt-1 flex items-center gap-0.5 text-xs font-medium text-red-600">
        <span>⚠</span>
        <span>{prioridad} · Vencido {sla.horasVencido}h</span>
      </span>
    )
  }

  return (
    <span className="mt-1 flex items-center gap-0.5 text-xs font-medium text-green-600">
      <span>⏱</span>
      <span>{prioridad} · {sla.horasRestantes}h restantes</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return formatFechaRelativa(iso)
}

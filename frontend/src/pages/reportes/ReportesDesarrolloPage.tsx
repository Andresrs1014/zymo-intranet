// Hub principal del módulo de Reportes de Desarrollo.
// Tabs: "Todos" (agrupado por proyecto) y "Mis reportes" (filtrado por autor).
// Filtro extra: chip por proyecto (independiente del tab).

import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import { Plus, FileText, Filter } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { useAuthStore } from "@/store/authStore"
import { canWriteReportesDesarrollo } from "@/lib/permissions"
import { reportesApi } from "@/lib/reportesApi"
import type { Reporte } from "@/lib/reportesShared"
import { ReporteCard } from "@/components/reportes/ReporteCard"
import { ProyectoFilter } from "@/components/reportes/ProyectoFilter"
import { ShimmerButton } from "@/components/ui/shimmer-button"

type Tab = "todos" | "mios"

export function ReportesDesarrolloPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("todos")
  const [proyectoFiltro, setProyectoFiltro] = useState<string | null>(null)

  // Permiso de escritura: el botón "Nuevo reporte" solo aparece si aplica.
  const canWrite = user
    ? canWriteReportesDesarrollo(user.role, user.app_permissions)
    : false

  // ── Queries ────────────────────────────────────────────────────────────────
  // Trae todos los reportes del equipo y la lista distinta de proyectos para
  // alimentar el filtro de chips.
  const { data: reportes = [], isLoading } = useQuery<Reporte[]>({
    queryKey: ["reportes-desarrollo", "all"],
    queryFn: () => reportesApi.get<Reporte[]>("/api/reportes-desarrollo").then((r) => r.data),
  })

  const { data: proyectos = [] } = useQuery<string[]>({
    queryKey: ["reportes-desarrollo", "proyectos"],
    queryFn: () =>
      reportesApi.get<string[]>("/api/reportes-desarrollo/proyectos").then((r) => r.data),
  })

  // ── Filtros memoizados ────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let result = reportes
    if (tab === "mios" && user) {
      result = result.filter((r) => r.autorId === user.id)
    }
    if (proyectoFiltro) {
      result = result.filter((r) => r.proyecto === proyectoFiltro)
    }
    return result
  }, [reportes, tab, proyectoFiltro, user])

  // En "Todos" sin filtro de proyecto, agrupamos para que el escaneo sea más
  // rápido (el ojo va por bloques). En los demás casos, lista plana.
  const grouped = useMemo(() => {
    const map = new Map<string, Reporte[]>()
    for (const r of filtrados) {
      if (!map.has(r.proyecto)) map.set(r.proyecto, [])
      map.get(r.proyecto)!.push(r)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtrados])

  return (
    <PageLayout title="Reportes de Desarrollo">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-mono text-[20px] font-semibold text-zinc-800 text-balance">
              Reportes de Desarrollo
            </h1>
            <p className="text-[12px] text-zinc-500 mt-1">
              Documentación del trabajo del equipo: avances, especificaciones y flujogramas.
            </p>
          </div>
          {canWrite && (
            <ShimmerButton onClick={() => navigate("/reportes-desarrollo/nuevo")}>
              <Plus className="w-3.5 h-3.5" />
              Nuevo reporte
            </ShimmerButton>
          )}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-zinc-200" role="tablist">
          <TabButton active={tab === "todos"} onClick={() => setTab("todos")}>
            Todos ({reportes.length})
          </TabButton>
          <TabButton active={tab === "mios"} onClick={() => setTab("mios")}>
            Mis reportes
          </TabButton>
        </div>

        {/* ── Filtro por proyecto ───────────────────────────────────────── */}
        {proyectos.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              <Filter className="w-3 h-3" aria-hidden="true" />
              Proyecto
            </span>
            <ProyectoFilter
              proyectos={proyectos}
              selected={proyectoFiltro}
              onChange={setProyectoFiltro}
            />
          </div>
        )}

        {/* ── Contenido ─────────────────────────────────────────────────── */}
        {isLoading ? (
          <ReportesSkeleton />
        ) : filtrados.length === 0 ? (
          <EmptyState
            canWrite={canWrite}
            onCreate={() => navigate("/reportes-desarrollo/nuevo")}
            tab={tab}
            proyectoFiltro={proyectoFiltro}
          />
        ) : (
          <AnimatePresence mode="wait">
            {tab === "todos" && !proyectoFiltro ? (
              <motion.div
                key="grouped"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {grouped.map(([proyecto, items]) => (
                  <section key={proyecto} aria-labelledby={`sec-${proyecto}`}>
                    <h2
                      id={`sec-${proyecto}`}
                      className="font-mono text-[12px] uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" aria-hidden="true" />
                      {proyecto}
                      <span className="text-zinc-400">· {items.length}</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map((r, i) => (
                        <ReporteCard key={r.id} reporte={r} index={i} />
                      ))}
                    </div>
                  </section>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="flat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {filtrados.map((r, i) => (
                  <ReporteCard key={r.id} reporte={r} index={i} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </PageLayout>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

/** Tab de navegación interno. */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 ${
        active
          ? "border-zinc-800 text-zinc-800"
          : "border-transparent text-zinc-500 hover:text-zinc-800"
      }`}
    >
      {children}
    </button>
  )
}

/** Skeleton de carga — 4 placeholders con pulse. */
function ReportesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true" aria-label="Cargando reportes…">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[160px] rounded-xl border border-zinc-200 bg-zinc-50 animate-pulse"
        />
      ))}
    </div>
  )
}

/** Estado vacío — copy y CTA según contexto (tab + filtro). */
function EmptyState({
  canWrite,
  onCreate,
  tab,
  proyectoFiltro,
}: {
  canWrite: boolean
  onCreate: () => void
  tab: Tab
  proyectoFiltro: string | null
}) {
  const titulo = tab === "mios"
    ? "Todavía no subiste ningún reporte"
    : proyectoFiltro
      ? `No hay reportes en el proyecto ${proyectoFiltro}`
      : "No hay reportes todavía"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
        <FileText className="w-6 h-6 text-zinc-400" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <p className="font-mono text-[13px] text-zinc-700 mb-1">{titulo}</p>
      <p className="text-[12px] text-zinc-500 mb-5 max-w-md text-pretty">
        Subí tu .md con el detalle del trabajo de la semana: título, proyecto, % de avance y
        los tiempos estimados.
      </p>
      {canWrite && (
        <ShimmerButton onClick={onCreate}>
          <Plus className="w-3.5 h-3.5" />
          Crear el primero
        </ShimmerButton>
      )}
    </motion.div>
  )
}

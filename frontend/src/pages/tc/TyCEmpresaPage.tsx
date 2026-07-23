import { useEffect, useState, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api } from "@/lib/api"
import { tcEmpresaLabel } from "@/lib/tc-constants"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { useAreas } from "@/hooks/useAreas"
import { useSedes } from "@/hooks/useSedes"
import { PageLayout } from "@/components/layout/PageLayout"
import { BlurFade } from "@/components/ui/blur-fade"
import { CargoSheet, type CargoConfig } from "./components/CargoSheet"
import {
  ArrowLeft, ArrowRight, ArrowUpRight, GitBranch, Layers, Users,
  UserCheck, Mars, Venus, Loader2, Plus, Pencil, Building2,
} from "lucide-react"

interface HubCargo { id: number; nombre: string; personas_count: number }
interface HubArea {
  id: number | null
  nombre: string
  cargos_count: number
  personas_count: number
  cargos: HubCargo[]
}
interface HubData {
  empresa: { id: number; nombre: string; codigo: string }
  kpis: {
    total: number
    activos: number
    antiguedad_promedio: number
    masculino_pct: number
    femenino_pct: number
  }
  mapa_jerarquico: { cargos_configurados: number }
  areas: HubArea[]
}

export function TyCEmpresaPage() {
  const { sedeId } = useParams<{ sedeId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false
  const { data: areas = [] } = useAreas()
  const { data: sedes = [] } = useSedes()

  const [hub, setHub] = useState<HubData | null>(null)
  const [cargosConfig, setCargosConfig] = useState<CargoConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetCargo, setSheetCargo] = useState<CargoConfig | null>(null)

  const cargar = useCallback(() => {
    if (!sedeId) return
    setLoading(true)
    setError("")
    Promise.all([
      api.get(`/tc/empresa/${sedeId}/hub`),
      api.get("/tc/cargos", { params: { sede_id: sedeId } }),
    ])
      .then(([hubRes, cargosRes]) => {
        setHub(hubRes.data)
        setCargosConfig(cargosRes.data ?? [])
      })
      .catch(() => setError("No se pudo cargar el hub de la empresa."))
      .finally(() => setLoading(false))
  }, [sedeId])

  useEffect(() => { cargar() }, [cargar])

  const empresa = hub?.empresa
  const empresaLabel = empresa ? tcEmpresaLabel(empresa.codigo) : "Empresa"
  const cargosById = new Map(cargosConfig.map((c) => [c.id, c]))

  function irDirectorio(params: Record<string, string>) {
    const q = new URLSearchParams(params).toString()
    navigate(`/tc/directorio${q ? `?${q}` : ""}`)
  }

  function abrirCrear() {
    setSheetCargo(null)
    setSheetOpen(true)
  }

  function abrirEditar(cargoId: number) {
    const config = cargosById.get(cargoId)
    if (!config) return
    setSheetCargo(config)
    setSheetOpen(true)
  }

  return (
    <PageLayout title={empresa ? `T&C — ${empresaLabel}` : "T&C — Empresa"} mainClassName="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        <button
          onClick={() => navigate("/tc")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          T&C
        </button>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando empresa…</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">{error}</p>
        )}

        {!loading && hub && (
          <>
            <header>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-2">
                Empresa del grupo
              </p>
              <h1 className="text-3xl font-bold tracking-tight">{empresaLabel}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {hub.kpis.total} colaborador{hub.kpis.total !== 1 ? "es" : ""} registrados
              </p>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Colaboradores" value={String(hub.kpis.total)} icon={<Users className="w-4 h-4" />} />
              <KpiCard label="Años promedio" value={hub.kpis.antiguedad_promedio.toFixed(1)} icon={<UserCheck className="w-4 h-4" />} />
              <KpiCard label="Personal masculino" value={`${hub.kpis.masculino_pct}%`} icon={<Mars className="w-4 h-4" />} />
              <KpiCard label="Personal femenino" value={`${hub.kpis.femenino_pct}%`} icon={<Venus className="w-4 h-4" />} />
            </div>

            {/* Mapa jerárquico */}
            <section>
              <SectionLabel>Organigrama de la empresa</SectionLabel>
              <button
                type="button"
                onClick={() => navigate(`/tc/organigrama?sede=${sedeId}`)}
                className="group w-full text-left rounded-2xl border border-border bg-muted/5 p-5 transition-all duration-200 hover:border-teal-500/30 hover:bg-muted/10 hover:shadow-lg hover:-translate-y-px"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                    <GitBranch className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold leading-snug">
                      Mapa jerárquico de {hub.empresa.nombre}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Consulta la estructura financiera y operativa propia de la empresa.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Tag>{hub.mapa_jerarquico.cargos_configurados} cargo{hub.mapa_jerarquico.cargos_configurados !== 1 ? "s" : ""} configurado{hub.mapa_jerarquico.cargos_configurados !== 1 ? "s" : ""}</Tag>
                      <Tag>Vista por empresa</Tag>
                      <Tag>Asignación de personal</Tag>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-teal-400 shrink-0 mt-1 transition-colors" />
                </div>
              </button>
            </section>

            {/* Áreas y cargos de esta empresa */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Áreas y cargos de esta empresa</SectionLabel>
                {puedeEditar && (
                  <button
                    type="button"
                    onClick={abrirCrear}
                    className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nuevo cargo
                  </button>
                )}
              </div>
              {hub.areas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                  Sin áreas con cargos o personal en esta empresa.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {hub.areas.map((area, i) => (
                    <BlurFade key={area.id ?? "sin-area"} delay={i * 0.05} inView>
                      <article className="rounded-2xl border border-border bg-muted/5 overflow-hidden transition-colors hover:border-teal-500/30">
                        <button
                          type="button"
                          onClick={() => irDirectorio({
                            empresa: String(sedeId),
                            ...(area.id != null ? { area: String(area.id) } : {}),
                          })}
                          className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/10 transition-colors"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                            <Layers className="w-4 h-4" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">{area.nombre}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {area.cargos_count} cargo{area.cargos_count !== 1 ? "s" : ""} activo{area.cargos_count !== 1 ? "s" : ""} · {area.personas_count} persona{area.personas_count !== 1 ? "s" : ""}
                            </p>
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                        </button>
                        {area.cargos.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                            {area.cargos.map((cargo) => {
                              const config = cargosById.get(cargo.id)
                              const transversal = (config?.sede_ids.length ?? 0) > 1
                              return (
                                <span
                                  key={cargo.id}
                                  className="group inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full border border-border bg-background/60 hover:border-teal-500/40 transition-colors"
                                >
                                  <button
                                    type="button"
                                    onClick={() => irDirectorio({ empresa: String(sedeId), cargo: String(cargo.id) })}
                                    className="flex items-center gap-1 text-[11px] text-foreground/80 group-hover:text-teal-400 transition-colors"
                                  >
                                    {transversal && <Building2 className="w-2.5 h-2.5 text-teal-400/70" aria-label="Transversal" />}
                                    {cargo.nombre} · {cargo.personas_count}
                                  </button>
                                  {puedeEditar && (
                                    <button
                                      type="button"
                                      onClick={() => abrirEditar(cargo.id)}
                                      aria-label={`Editar ${cargo.nombre}`}
                                      className="p-1 rounded-full text-muted-foreground/40 hover:text-teal-400 hover:bg-teal-500/10 transition-colors"
                                    >
                                      <Pencil className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </article>
                    </BlurFade>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {puedeEditar && (
          <CargoSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            sedeIdActual={Number(sedeId)}
            areas={areas}
            sedes={sedes}
            cargo={sheetCargo}
            onSaved={cargar}
          />
        )}
      </div>
    </PageLayout>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

function KpiCard({
  label, value, icon,
}: {
  label: string; value: string; icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/5 px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
        {value}
      </p>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border bg-background/60 text-muted-foreground">
      {children}
    </span>
  )
}

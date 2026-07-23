import { useEffect, useState, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { BlurFade } from "@/components/ui/blur-fade"
import { GestionarAreasSheet } from "./components/GestionarAreasSheet"
import { AreaManagePanel } from "./components/AreaManagePanel"
import { TodosLosColaboradores } from "./components/TodosLosColaboradores"
import {
  ArrowLeft, ArrowUpRight, GitBranch, Layers, Users,
  UserCheck, Mars, Venus, Loader2, ChevronDown, ChevronUp, Settings2,
} from "lucide-react"

interface HubCargo { id: number; nombre: string; personas_count: number }
interface HubArea {
  id: number | null
  nombre: string
  activa?: boolean
  cargos_count: number
  personas_count: number
  cargos: HubCargo[]
}
interface HubData {
  empresa: { id: number; nombre: string; codigo: string; logo_url?: string }
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

  const [hub, setHub] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [areasSheetOpen, setAreasSheetOpen] = useState(false)
  const [areaExpandida, setAreaExpandida] = useState<number | null>(null)

  const cargar = useCallback(() => {
    if (!sedeId) return
    setLoading(true)
    setError("")
    api.get(`/tc/empresa/${sedeId}/hub`)
      .then((r) => setHub(r.data))
      .catch(() => setError("No se pudo cargar el hub de la empresa."))
      .finally(() => setLoading(false))
  }, [sedeId])

  useEffect(() => { cargar() }, [cargar])

  const empresa = hub?.empresa

  return (
    <PageLayout title={empresa ? `T&C — ${empresa.nombre}` : "T&C — Empresa"} mainClassName="flex-1 overflow-y-auto">
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
            <header className="flex items-center gap-4">
              {hub.empresa.logo_url && (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-teal-500/15 bg-white">
                  <img src={hub.empresa.logo_url} alt={`Logo ${hub.empresa.nombre}`} className="h-[82%] w-[82%] object-contain" />
                </span>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-2">
                  Empresa del grupo
                </p>
                <h1 className="text-3xl font-bold tracking-tight">{hub.empresa.nombre}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {hub.kpis.total} colaborador{hub.kpis.total !== 1 ? "es" : ""} registrados
                </p>
              </div>
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
                    onClick={() => setAreasSheetOpen(true)}
                    className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/10 text-xs font-semibold transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Gestionar áreas
                  </button>
                )}
              </div>
              {hub.areas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground space-y-3">
                  <p>Sin áreas activas en esta empresa todavía.</p>
                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={() => setAreasSheetOpen(true)}
                      className="text-xs font-semibold text-teal-400 hover:text-teal-300"
                    >
                      + Gestionar áreas
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {hub.areas.map((area, i) => {
                    const areaKey = area.id ?? -1
                    const expandida = areaExpandida === areaKey
                    return (
                      <BlurFade key={area.id ?? "sin-area"} delay={i * 0.05} inView>
                        <article className="rounded-2xl border border-border bg-muted/5 overflow-hidden transition-colors hover:border-teal-500/30">
                          <button
                            type="button"
                            onClick={() => setAreaExpandida(expandida ? null : areaKey)}
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
                            {expandida ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                            )}
                          </button>
                          {expandida && area.id != null && (
                            <AreaManagePanel
                              sedeId={Number(sedeId)}
                              areaId={area.id}
                              cargosIniciales={area.cargos.map((c) => ({ id: c.id, nombre: c.nombre }))}
                              onChanged={cargar}
                            />
                          )}
                        </article>
                      </BlurFade>
                    )
                  })}
                </div>
              )}
            </section>

            <TodosLosColaboradores sedeId={Number(sedeId)} />
          </>
        )}

        {puedeEditar && (
          <GestionarAreasSheet
            open={areasSheetOpen}
            onOpenChange={setAreasSheetOpen}
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

import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  ArrowLeft, ArrowRight, GitBranch, Layers, Users,
  UserCheck, Mars, Venus, Loader2,
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
  const [hub, setHub] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!sedeId) return
    setLoading(true)
    setError("")
    api.get(`/tc/empresa/${sedeId}/hub`)
      .then((r) => setHub(r.data))
      .catch(() => setError("No se pudo cargar el hub de la empresa."))
      .finally(() => setLoading(false))
  }, [sedeId])

  const empresa = hub?.empresa

  function irDirectorio(params: Record<string, string>) {
    const q = new URLSearchParams(params).toString()
    navigate(`/tc/directorio${q ? `?${q}` : ""}`)
  }

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
            <header>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-2">
                Empresa del grupo
              </p>
              <h1 className="text-3xl font-bold tracking-tight">{hub.empresa.nombre}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {hub.kpis.total} colaborador{hub.kpis.total !== 1 ? "es" : ""} registrados
              </p>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Colaboradores" value={String(hub.kpis.total)} icon={<Users className="w-4 h-4" />} />
              <KpiCard
                label="Años promedio"
                value={hub.kpis.antiguedad_promedio.toFixed(1)}
                icon={<UserCheck className="w-4 h-4" />}
                mono
              />
              <KpiCard label="Personal masculino" value={`${hub.kpis.masculino_pct}%`} icon={<Mars className="w-4 h-4" />} />
              <KpiCard label="Personal femenino" value={`${hub.kpis.femenino_pct}%`} icon={<Venus className="w-4 h-4" />} />
            </div>

            {/* Mapa jerárquico */}
            <section>
              <SectionLabel>Organigrama de la empresa</SectionLabel>
              <button
                type="button"
                onClick={() => navigate(`/tc/organigrama?sede=${sedeId}`)}
                className="group w-full text-left rounded-2xl overflow-hidden border border-[#ef3340]/25 bg-gradient-to-br from-[#4e1012] via-[#74151d] to-[#ef3340]/90 p-5 transition-all hover:shadow-lg hover:shadow-[#ef3340]/15 hover:-translate-y-px"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                    <GitBranch className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-white leading-snug">
                      Mapa jerárquico de {hub.empresa.nombre}
                    </h2>
                    <p className="text-sm text-white/75 mt-1">
                      Consulta la estructura financiera y operativa propia de la empresa.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Tag>{hub.mapa_jerarquico.cargos_configurados} cargo{hub.mapa_jerarquico.cargos_configurados !== 1 ? "s" : ""} configurado{hub.mapa_jerarquico.cargos_configurados !== 1 ? "s" : ""}</Tag>
                      <Tag>Vista por empresa</Tag>
                      <Tag>Asignación de personal</Tag>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white/90 shrink-0 mt-1 transition-colors" />
                </div>
              </button>
            </section>

            {/* Áreas activas */}
            <section>
              <SectionLabel>Áreas activas</SectionLabel>
              {hub.areas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                  Sin áreas con cargos o personal en esta empresa.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {hub.areas.map((area) => (
                    <article
                      key={area.id ?? "sin-area"}
                      className="rounded-2xl border border-border bg-muted/5 overflow-hidden transition-colors hover:border-teal-500/30"
                    >
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
                          {area.cargos.map((cargo) => (
                            <button
                              key={cargo.id}
                              type="button"
                              onClick={() => irDirectorio({ empresa: String(sedeId), cargo: String(cargo.id) })}
                              className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background/60 text-foreground/80 hover:border-teal-500/40 hover:text-teal-400 transition-colors"
                            >
                              {cargo.nombre} · {cargo.personas_count}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
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
  label, value, icon, mono = false,
}: {
  label: string; value: string; icon: React.ReactNode; mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`text-2xl font-bold tabular-nums ${mono ? "font-mono" : ""}`}
        style={mono ? { fontFamily: "'DM Mono', monospace" } : undefined}
      >
        {value}
      </p>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/90">
      {children}
    </span>
  )
}

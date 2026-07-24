import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canConfigTyC, canEditTyC, canImportTyC, canSeeTyCSensible, canUseCapCoordinador } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { PlataformaConfigSheet } from "./components/PlataformaConfigSheet"
import {
  Users, GitBranch, Upload, FileText, TrendingUp, ArrowUpRight,
  CalendarDays, Settings2, GraduationCap, UserX, Building2, UserPlus, Plus, Pencil, FileStack,
} from "lucide-react"

interface Stats {
  total: number
  activos: number
  inactivos: number
  por_empresa?: { id: number; total: number }[]
}

interface Plataforma {
  sede_id: number
  sede_nombre: string
  configurada: boolean
  nombre: string
  logo_url: string
}

export function TyCPage() {
  const navigate      = useNavigate()
  const user          = useAuthStore((s) => s.user)
  const puedeImport     = user ? canImportTyC(user.role, user.app_permissions) : false
  const puedeSensible   = user ? canSeeTyCSensible(user.role, user.app_permissions) : false
  const puedeConfigurar = user ? canConfigTyC(user.role, user.app_permissions) : false
  const puedeEditar     = user ? canEditTyC(user.role, user.app_permissions) : false
  const puedeCapCoord   = user ? canUseCapCoordinador(user.role, user.app_permissions) : false

  const [stats, setStats] = useState<Stats | null>(null)
  const [plataformas, setPlataformas] = useState<Plataforma[]>([])
  const [configSheetSede, setConfigSheetSede] = useState<Plataforma | null>(null)

  const cargarPlataformas = useCallback(() => {
    api.get("/tc/plataformas")
      .then((r) => setPlataformas(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    api.get("/tc/stats")
      .then((r) => setStats({
        total: r.data.total,
        activos: r.data.activos,
        inactivos: r.data.inactivos,
        por_empresa: r.data.por_empresa ?? [],
      }))
      .catch(() => {})
    cargarPlataformas()
  }, [cargarPlataformas])

  const countBySede = new Map((stats?.por_empresa ?? []).map((e) => [e.id, e.total]))
  const configuradas = plataformas.filter((p) => p.configurada)
  const sinConfigurar = plataformas.filter((p) => !p.configurada)

  const activePct = stats ? Math.round((stats.activos / Math.max(stats.total, 1)) * 100) : 0

  return (
    <PageLayout title="T&C — Talento y Cultura" mainClassName="flex-1 overflow-y-auto">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border px-10 pt-10 pb-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 right-0 w-96 h-96 rounded-full bg-teal-500/8 blur-3xl" />

        <div className="max-w-5xl mx-auto flex items-end justify-between gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-3">
              Talento y Cultura · Grupo ZYMO
            </p>
            <p
              className="text-[80px] font-bold leading-none tabular-nums tracking-tighter"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {stats?.total ?? <span className="opacity-20">—</span>}
            </p>
            <p className="text-sm text-muted-foreground mt-2">colaboradores en el grupo</p>
            {stats && (
              <div className="mt-4 w-56 h-[3px] bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-1000"
                  style={{ width: `${activePct}%` }}
                />
              </div>
            )}
          </div>

          {stats && (
            <div className="flex gap-8 mb-3">
              <BigStat value={stats.activos} label="activos" pct={activePct} color="text-emerald-400" />
              <BigStat value={stats.inactivos} label="inactivos" pct={100 - activePct} color="text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* ── Empresas del grupo ─────────────────────────────────────────── */}
      {plataformas.length > 0 && (
        <div className="px-10 pt-8 pb-2 max-w-5xl mx-auto">
          <SectionLabel>Empresas del grupo</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {configuradas.map((p, i) => (
              <EmpresaGrupoCard
                key={p.sede_id}
                nombre={p.nombre}
                logoUrl={p.logo_url}
                colaboradores={countBySede.get(p.sede_id) ?? 0}
                onClick={() => navigate(`/tc/empresa/${p.sede_id}`)}
                onEditar={puedeEditar ? () => setConfigSheetSede(p) : undefined}
                delayMs={i * 70}
              />
            ))}
            {puedeEditar && sinConfigurar.map((p) => (
              <button
                key={p.sede_id}
                type="button"
                onClick={() => setConfigSheetSede(p)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-5 py-6 text-muted-foreground hover:border-teal-500/40 hover:text-teal-400 transition-colors"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs font-semibold">Configurar {p.sede_nombre}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {configSheetSede && (
        <PlataformaConfigSheet
          open={!!configSheetSede}
          onOpenChange={(o) => !o && setConfigSheetSede(null)}
          sedeId={configSheetSede.sede_id}
          sedeNombre={configSheetSede.sede_nombre}
          nombreActual={configSheetSede.nombre}
          logoActual={configSheetSede.logo_url}
          configurada={configSheetSede.configurada}
          onSaved={cargarPlataformas}
        />
      )}

      {/* ── Módulos ───────────────────────────────────────────────────── */}
      <div className="px-10 py-8 max-w-5xl mx-auto space-y-8">

        {/* Fila 1: Directorio + Organigrama + Manuales + Agenda + Capacitaciones */}
        <section>
          <SectionLabel>Personal y estructura</SectionLabel>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <ModuleCard
                icon={<Users className="w-5 h-5" />}
                color="teal"
                title="Directorio"
                description="Busca, filtra y gestiona todos los colaboradores. Perfil individual con historial completo."
                onClick={() => navigate("/tc/directorio")}
                primary
              />
            </div>
            <ModuleCard
              icon={<GitBranch className="w-4 h-4" />}
              color="teal"
              title="Organigrama"
              description="Árbol jerárquico empresa → área → cargo → persona. Vista canvas y lista."
              onClick={() => navigate("/tc/organigrama")}
            />
            <ModuleCard
              icon={<CalendarDays className="w-4 h-4" />}
              color="teal"
              title="Agenda"
              description="Inducciones agendadas por el líder de cada área, con acta de asistencia."
              onClick={() => navigate("/tc/calendario")}
            />
            <ModuleCard
              icon={<GraduationCap className="w-4 h-4" />}
              color="indigo"
              title="Capacitaciones"
              description="Historial de formación, paquetes de inducción y seguimiento por área."
              onClick={() => navigate("/tc/formacion")}
            />
          </div>
          <div className="grid grid-cols-4 gap-3 mt-3">
            <ModuleCard
              icon={<FileText className="w-4 h-4" />}
              color="indigo"
              title="Manuales de funciones"
              description="PDF, Word o Excel por cargo. Fuente para análisis IA del SIG."
              onClick={() => navigate("/tc/manuales")}
            />
            {puedeEditar && (
              <ModuleCard
                icon={<UserX className="w-4 h-4" />}
                color="amber"
                title="Rotación"
                description="Marca activos/inactivos y clasifica retiros en bloque."
                onClick={() => navigate("/tc/rotacion")}
              />
            )}
            <ModuleCard
              icon={<Building2 className="w-4 h-4" />}
              color="indigo"
              title="Clientes"
              description="Consulta la cartera y analistas asignados por sede (solo lectura)."
              onClick={() => navigate("/tc/clientes")}
            />
            <ModuleCard
              icon={<FileStack className="w-4 h-4" />}
              color="amber"
              title="Formatos digitales"
              description="Permisos, días remotos y demás formatos de Gestión Humana, digitalizados."
              onClick={() => navigate("/tc/formatos")}
            />
          </div>
        </section>

        {/* Fila 2: Desarrollo */}
        {(puedeSensible || puedeImport || puedeConfigurar || puedeCapCoord) && (
          <section>
            <SectionLabel>Desarrollo y talento</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              {puedeCapCoord && (
                <ModuleCard
                  icon={<UserPlus className="w-4 h-4" />}
                  color="teal"
                  title="Inducción Nuevo personal"
                  description="Agenda inducciones y reinducciones con varios líderes por día, cada uno con su propio horario."
                  onClick={() => navigate("/tc/nuevo-personal")}
                />
              )}
              {puedeSensible && (
                <ModuleCard
                  icon={<TrendingUp className="w-4 h-4" />}
                  color="teal"
                  title="Indicadores KPI"
                  description="Rotación, capacitación, desempeño e IDP calculados en tiempo real."
                  onClick={() => navigate("/tc/indicadores")}
                />
              )}
              {puedeImport && (
                <ModuleCard
                  icon={<Upload className="w-4 h-4" />}
                  color="amber"
                  title="Importar"
                  description="Carga el export JS del Directorio ZYMO."
                  onClick={() => navigate("/tc/import")}
                  compact
                />
              )}
              {puedeConfigurar && (
                <ModuleCard
                  icon={<Settings2 className="w-4 h-4" />}
                  color="indigo"
                  title="Configuración T&C"
                  description="WhatsApp, SMTP, paquetes de capacitación y líderes de área."
                  onClick={() => navigate("/tc/ajustes")}
                  compact
                />
              )}
            </div>
          </section>
        )}

      </div>
    </PageLayout>
  )
}

// ── Primitivos ────────────────────────────────────────────────────────────────

function BigStat({ value, label, pct, color }: { value: number; label: string; pct: number; color: string }) {
  return (
    <div className="text-right">
      <p className={`text-4xl font-bold tabular-nums leading-none ${color}`} style={{ fontFamily: "'DM Mono', monospace" }}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      <p className={`text-[10px] tabular-nums mt-0.5 ${color} opacity-60`}>{pct}%</p>
    </div>
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

const COLOR_MAP = {
  teal:   { bg: "bg-teal-500/10",   icon: "text-teal-400",   ring: "hover:border-teal-500/30"   },
  indigo: { bg: "bg-indigo-500/10", icon: "text-indigo-400", ring: "hover:border-indigo-500/30" },
  amber:  { bg: "bg-amber-500/10",  icon: "text-amber-400",  ring: "hover:border-amber-500/30"  },
} as const

function EmpresaGrupoCard({
  nombre,
  logoUrl,
  colaboradores,
  onClick,
  onEditar,
  delayMs = 0,
}: {
  nombre: string
  logoUrl: string
  colaboradores: number
  onClick: () => void
  onEditar?: () => void
  delayMs?: number
}) {
  return (
    <div
      className="group relative w-full rounded-2xl border border-border bg-card/80 transition-all duration-200 hover:border-teal-500/35 hover:bg-muted/10 hover:shadow-lg hover:-translate-y-0.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both"
      style={{ animationDelay: `${delayMs}ms`, animationDuration: "450ms" }}
    >
      {onEditar && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEditar() }}
          aria-label={`Editar plataforma ${nombre}`}
          className="absolute right-3 top-3 z-10 p-1.5 rounded-full bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-teal-400 transition-opacity"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      <button type="button" onClick={onClick} className="w-full text-center px-5 py-6">
        <span className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[18px] border border-teal-500/15 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
          {logoUrl ? (
            <img src={logoUrl} alt={`Escudo ${nombre}`} className="h-[82%] w-[82%] object-contain" />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground/40" aria-hidden />
          )}
        </span>
        <h3 className="text-base font-extrabold tracking-tight">{nombre}</h3>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-1 text-[11px] font-semibold text-teal-400">
          <Users className="h-3 w-3" aria-hidden />
          {colaboradores} colaborador{colaboradores !== 1 ? "es" : ""}
        </span>
      </button>
    </div>
  )
}

function ModuleCard({
  icon, color, title, description, onClick, primary = false, compact = false,
}: {
  icon: React.ReactNode
  color: keyof typeof COLOR_MAP
  title: string
  description: string
  onClick: () => void
  primary?: boolean
  compact?: boolean
}) {
  const c = COLOR_MAP[color]
  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left rounded-2xl border border-border bg-muted/5 transition-all duration-200 ${c.ring} hover:bg-muted/10 hover:shadow-lg hover:-translate-y-px ${
        primary ? "p-5" : compact ? "px-4 py-3" : "p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.icon}`}>
          {icon}
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors shrink-0 mt-0.5" />
      </div>
      <p className={`font-semibold leading-snug mt-3 ${primary ? "text-base" : "text-sm"}`}>{title}</p>
      {!compact && (
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      )}
    </button>
  )
}

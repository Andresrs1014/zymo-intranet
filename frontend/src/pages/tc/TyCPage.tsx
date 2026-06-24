import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canImportTyC, canSeeTyCSensible } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  Users, GitBranch, BookOpen, ClipboardList,
  ShieldAlert, Upload, FileText, TrendingUp, ArrowUpRight,
} from "lucide-react"

interface Stats { total: number; activos: number; inactivos: number }

export function TyCPage() {
  const navigate      = useNavigate()
  const user          = useAuthStore((s) => s.user)
  const puedeImport   = user ? canImportTyC(user.role, user.app_permissions) : false
  const puedeSensible = user ? canSeeTyCSensible(user.role, user.app_permissions) : false

  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.get("/tc/stats")
      .then((r) => setStats({ total: r.data.total, activos: r.data.activos, inactivos: r.data.inactivos }))
      .catch(() => {})
  }, [])

  const activePct = stats ? Math.round((stats.activos / Math.max(stats.total, 1)) * 100) : 0

  return (
    <PageLayout title="T&C — Talento y Cultura" mainClassName="flex-1 overflow-y-auto">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border px-8 pt-10 pb-8">
        {/* dot-grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* teal glow */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl" />

        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-2">
          Talento y Cultura · Grupo ZYMO
        </p>

        <div className="flex items-end gap-6 mb-6">
          <div>
            <p
              className="text-[72px] font-bold leading-none tabular-nums tracking-tighter"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {stats?.total ?? <span className="opacity-20">—</span>}
            </p>
            <p className="text-sm text-muted-foreground mt-1">colaboradores en el grupo</p>
          </div>

          {stats && (
            <div className="mb-2 space-y-1.5">
              <Pill color="emerald" value={stats.activos} label="activos" pct={activePct} />
              <Pill color="muted" value={stats.inactivos} label="inactivos" pct={100 - activePct} />
            </div>
          )}
        </div>

        {/* barra activos */}
        {stats && (
          <div className="w-full max-w-xs h-[3px] bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-1000"
              style={{ width: `${activePct}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Módulos ───────────────────────────────────────────────────── */}
      <div className="px-8 py-8 max-w-3xl space-y-8">

        {/* PERSONAL */}
        <section>
          <SectionLabel>Personal</SectionLabel>
          <div className="grid grid-cols-1 gap-3">
            <ModuleCard
              icon={<Users className="w-5 h-5" />}
              color="teal"
              title="Directorio de colaboradores"
              description="Busca, filtra y gestiona todos los empleados del grupo. Acceso completo al perfil individual."
              onClick={() => navigate("/tc/directorio")}
              primary
            />
            {puedeImport && (
              <ModuleCard
                icon={<Upload className="w-4 h-4" />}
                color="amber"
                title="Importar desde archivo"
                description="Carga el export JS del Directorio ZYMO."
                onClick={() => navigate("/tc/import")}
                compact
              />
            )}
          </div>
        </section>

        {/* ESTRUCTURA */}
        <section>
          <SectionLabel>Estructura organizacional</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <ModuleCard
              icon={<GitBranch className="w-4 h-4" />}
              color="teal"
              title="Organigrama"
              description="Árbol jerárquico empresa → área → cargo → persona."
              onClick={() => navigate("/tc/organigrama")}
            />
            <ModuleCard
              icon={<FileText className="w-4 h-4" />}
              color="indigo"
              title="Manuales de funciones"
              description="PDF, Word o Excel por cargo. Fuente para análisis IA del SIG."
              onClick={() => navigate("/tc/manuales")}
            />
          </div>
        </section>

        {/* DESARROLLO */}
        {puedeSensible && (
          <section>
            <SectionLabel>Desarrollo y talento</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <ModuleCard
                icon={<TrendingUp className="w-4 h-4" />}
                color="teal"
                title="Indicadores KPI"
                description="Rotación, capacitación, desempeño, IDP — métricas en tiempo real."
                onClick={() => navigate("/tc/indicadores")}
              />

              {/* Card agrupada: perfil del colaborador */}
              <div className="rounded-2xl border border-border bg-muted/5 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Desde el perfil del colaborador
                </p>
                <div className="space-y-1">
                  {[
                    { icon: <BookOpen className="w-3 h-3" />, label: "Capacitaciones", color: "text-indigo-400" },
                    { icon: <ClipboardList className="w-3 h-3" />, label: "Evaluaciones", color: "text-orange-400" },
                    { icon: <ShieldAlert className="w-3 h-3" />, label: "Sanciones", color: "text-red-400" },
                    { icon: <FileText className="w-3 h-3" />, label: "Novedades", color: "text-violet-400" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => navigate("/tc/directorio")}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/20 transition-colors text-left group"
                    >
                      <span className={item.color}>{item.icon}</span>
                      <span className="text-xs font-medium flex-1">{item.label}</span>
                      <ArrowUpRight className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Abre el perfil de un colaborador en el directorio para registrar.
                </p>
              </div>
            </div>
          </section>
        )}

      </div>
    </PageLayout>
  )
}

// ── Primitivos ────────────────────────────────────────────────────────────────

function Pill({ color, value, label, pct }: { color: string; value: number; label: string; pct: number }) {
  const cls = color === "emerald"
    ? "text-emerald-500"
    : "text-muted-foreground"
  return (
    <div className="flex items-center gap-2">
      <span className={`text-lg font-bold tabular-nums leading-none ${cls}`} style={{ fontFamily: "'DM Mono', monospace" }}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground/50 tabular-nums">{pct}%</span>
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

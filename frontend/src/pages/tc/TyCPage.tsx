import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canImportTyC, canSeeTyCSensible } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  Users, GitBranch, Upload, FileText, TrendingUp, ArrowUpRight,
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

      {/* ── Módulos ───────────────────────────────────────────────────── */}
      <div className="px-10 py-8 max-w-5xl mx-auto space-y-8">

        {/* Fila 1: Directorio (ancho) + Organigrama + Manuales */}
        <section>
          <SectionLabel>Personal y estructura</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
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
              icon={<FileText className="w-4 h-4" />}
              color="indigo"
              title="Manuales de funciones"
              description="PDF, Word o Excel por cargo. Fuente para análisis IA del SIG."
              onClick={() => navigate("/tc/manuales")}
            />
          </div>
        </section>

        {/* Fila 2: Desarrollo */}
        {(puedeSensible || puedeImport) && (
          <section>
            <SectionLabel>Desarrollo y talento</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
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

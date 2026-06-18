import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC, canImportTyC, canSeeTyCSensible } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  Users,
  GitBranch,
  BookOpen,
  ClipboardList,
  ShieldAlert,
  Upload,
  UserPlus,
  ArrowRight,
} from "lucide-react"

interface Stats {
  total: number
  activos: number
  inactivos: number
}

export function TyCPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeEditar   = user ? canEditTyC(user.role, user.app_permissions) : false
  const puedeImport   = user ? canImportTyC(user.role, user.app_permissions) : false
  const puedeSensible = user ? canSeeTyCSensible(user.role, user.app_permissions) : false

  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    Promise.all([
      api.get("/tc/personas", { params: { limit: 1 } }),
      api.get("/tc/personas", { params: { estado: "Activo", limit: 1 } }),
      api.get("/tc/personas", { params: { estado: "Inactivo", limit: 1 } }),
    ]).then(([t, a, i]) => {
      setStats({ total: t.data.total, activos: a.data.total, inactivos: i.data.total })
    }).catch(() => {})
  }, [])

  const activePct = stats ? Math.round((stats.activos / Math.max(stats.total, 1)) * 100) : 0

  return (
    <PageLayout title="T&C — Talento y Cultura" mainClassName="flex-1 overflow-y-auto">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-6 border-b border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Talento y Cultura</h1>
            <p className="text-xs text-muted-foreground">
              Colaboradores · Estructura · Desarrollo — Grupo ZYMO
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            value={stats?.total}
            label="Colaboradores"
            barColor="bg-foreground/20"
            barPct={100}
          />
          <StatCard
            value={stats?.activos}
            label="Activos"
            valueColor="text-emerald-500"
            barColor="bg-emerald-500"
            barPct={activePct}
          />
          <StatCard
            value={stats?.inactivos}
            label="Inactivos"
            barColor="bg-muted-foreground/30"
            barPct={100 - activePct}
          />
        </div>
      </div>

      {/* ── Módulos ───────────────────────────────────────────────── */}
      <div className="px-8 py-7 max-w-2xl space-y-7">

        {/* PERSONAL */}
        <div>
          <GroupHeader accent="bg-blue-500" label="Personal" />
          <FeatureRow
            icon={<Users className="w-4 h-4" />}
            accent="text-blue-500 bg-blue-500/10"
            title="Directorio de colaboradores"
            sub="Buscar, filtrar y gestionar todos los empleados del grupo."
            onClick={() => navigate("/tc/directorio")}
          />
          {puedeEditar && (
            <FeatureRow
              icon={<UserPlus className="w-4 h-4" />}
              accent="text-blue-400 bg-blue-500/10"
              title="Nuevo colaborador"
              sub="Registrar un nuevo empleado en el sistema."
              onClick={() => navigate("/tc/directorio?nuevo=1")}
            />
          )}
          {puedeImport && (
            <FeatureRow
              icon={<Upload className="w-4 h-4" />}
              accent="text-amber-500 bg-amber-500/10"
              title="Importar desde archivo"
              sub="Cargar múltiples colaboradores desde Excel o JSON."
              soon
            />
          )}
        </div>

        {/* ESTRUCTURA */}
        <div>
          <GroupHeader accent="bg-teal-500" label="Estructura organizacional" />
          <FeatureRow
            icon={<GitBranch className="w-4 h-4" />}
            accent="text-teal-500 bg-teal-500/10"
            title="Organigrama"
            sub="Árbol empresa → área → cargo → persona. Asignación de posiciones."
            onClick={() => navigate("/tc/organigrama")}
          />
        </div>

        {/* DESARROLLO — próximamente */}
        <div>
          <GroupHeader accent="bg-indigo-500" label="Desarrollo y talento" soon />
          <div className="opacity-40 pointer-events-none">
            <FeatureRow
              icon={<BookOpen className="w-4 h-4" />}
              accent="text-indigo-500 bg-indigo-500/10"
              title="Capacitaciones"
              sub="Historial de formación, diplomas y calendario de actividades."
              soon
            />
            {puedeSensible && (
              <>
                <FeatureRow
                  icon={<ClipboardList className="w-4 h-4" />}
                  accent="text-orange-500 bg-orange-500/10"
                  title="Evaluaciones de desempeño"
                  sub="Calificaciones y metas individuales por colaborador."
                  soon
                />
                <FeatureRow
                  icon={<ShieldAlert className="w-4 h-4" />}
                  accent="text-red-500 bg-red-500/10"
                  title="Sanciones y novedades"
                  sub="Registro de novedades disciplinarias y permisos."
                  soon
                />
              </>
            )}
          </div>
        </div>

      </div>
    </PageLayout>
  )
}

// ── Componentes internos ──────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  valueColor = "",
  barColor,
  barPct,
}: {
  value: number | undefined
  label: string
  valueColor?: string
  barColor: string
  barPct: number
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 px-4 py-3.5">
      <p className={`text-2xl font-bold tabular-nums tracking-tight ${valueColor}`}>
        {value === undefined ? (
          <span className="opacity-20">—</span>
        ) : value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      <div className="mt-3 h-[3px] bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${Math.max(barPct, 2)}%` }}
        />
      </div>
    </div>
  )
}

function GroupHeader({
  accent,
  label,
  soon,
}: {
  accent: string
  label: string
  soon?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 mb-1.5">
      <div className={`h-3 w-[3px] rounded-full ${accent}`} />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {soon && (
        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          Próximamente
        </span>
      )}
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

function FeatureRow({
  icon,
  accent,
  title,
  sub,
  onClick,
  soon = false,
}: {
  icon: React.ReactNode
  accent: string
  title: string
  sub: string
  onClick?: () => void
  soon?: boolean
}) {
  const clickable = !soon && !!onClick
  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={soon}
      className={`w-full group flex items-center gap-3.5 px-3 py-3 rounded-xl text-left transition-all ${
        clickable ? "hover:bg-muted/25 cursor-pointer" : "cursor-default"
      }`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</p>
      </div>
      {clickable && (
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 transition-all shrink-0" />
      )}
    </button>
  )
}

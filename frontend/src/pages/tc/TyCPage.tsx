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
  ChevronRight,
  UserPlus,
  Building2,
} from "lucide-react"

interface Stats {
  total: number
  activos: number
  inactivos: number
}

export function TyCPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeEditar  = user ? canEditTyC(user.role, user.app_permissions) : false
  const puedeImport  = user ? canImportTyC(user.role, user.app_permissions) : false
  const puedeSensible = user ? canSeeTyCSensible(user.role, user.app_permissions) : false

  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    Promise.all([
      api.get("/tc/personas", { params: { limit: 1 } }),
      api.get("/tc/personas", { params: { estado: "Activo", limit: 1 } }),
      api.get("/tc/personas", { params: { estado: "Inactivo", limit: 1 } }),
    ]).then(([total, activos, inactivos]) => {
      setStats({
        total: total.data.total,
        activos: activos.data.total,
        inactivos: inactivos.data.total,
      })
    }).catch(() => {})
  }, [])

  return (
    <PageLayout title="T&C — Talento y Cultura" mainClassName="flex-1 overflow-y-auto">
      {/* ── Hero / Stats ───────────────────────────────────────────── */}
      <div className="px-6 pt-8 pb-6 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Talento y Cultura</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestión de colaboradores, estructura organizacional y desarrollo del talento.
            </p>
          </div>
          <Building2 className="w-10 h-10 text-muted-foreground/20 shrink-0 mt-1" />
        </div>

        {/* Stats rápidos */}
        <div className="flex items-center gap-6 mt-5">
          <Stat label="Total colaboradores" value={stats?.total} />
          <div className="w-px h-8 bg-border" />
          <Stat label="Activos" value={stats?.activos} accent="emerald" />
          <div className="w-px h-8 bg-border" />
          <Stat label="Inactivos" value={stats?.inactivos} accent="muted" />
        </div>
      </div>

      {/* ── Contenido ──────────────────────────────────────────────── */}
      <div className="px-6 py-8 space-y-10 max-w-4xl">

        {/* BLOQUE A — Personal */}
        <Section title="Personal" description="Directorio de colaboradores y gestión de registros.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NavCard
              icon={<Users className="w-5 h-5" />}
              iconColor="blue"
              title="Directorio"
              description="Ver y buscar todos los colaboradores del grupo ZYMO."
              onClick={() => navigate("/tc/directorio")}
            />
            {puedeEditar && (
              <NavCard
                icon={<UserPlus className="w-5 h-5" />}
                iconColor="violet"
                title="Nuevo colaborador"
                description="Registrar un nuevo colaborador en el sistema."
                onClick={() => navigate("/tc/directorio?nuevo=1")}
              />
            )}
            {puedeImport && (
              <NavCard
                icon={<Upload className="w-5 h-5" />}
                iconColor="amber"
                title="Importar desde Excel"
                description="Cargar múltiples colaboradores desde una plantilla Excel."
                soon
              />
            )}
          </div>
        </Section>

        {/* BLOQUE B — Estructura */}
        <Section title="Estructura organizacional" description="Organigrama y asignación de personas a cargos.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NavCard
              icon={<GitBranch className="w-5 h-5" />}
              iconColor="teal"
              title="Organigrama"
              description="Árbol jerárquico empresa → área → cargo → persona. Asigna colaboradores a posiciones."
              onClick={() => navigate("/tc/organigrama")}
            />
          </div>
        </Section>

        {/* BLOQUE C — Desarrollo */}
        <Section title="Desarrollo y talento" description="Formación, evaluaciones y registros de desarrollo.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NavCard
              icon={<BookOpen className="w-5 h-5" />}
              iconColor="indigo"
              title="Capacitaciones"
              description="Historial de formación, diplomas y calendario de actividades."
              soon
            />
            {puedeSensible && (
              <>
                <NavCard
                  icon={<ClipboardList className="w-5 h-5" />}
                  iconColor="orange"
                  title="Evaluaciones de desempeño"
                  description="Calificaciones y metas individuales de cada colaborador."
                  soon
                />
                <NavCard
                  icon={<ShieldAlert className="w-5 h-5" />}
                  iconColor="red"
                  title="Sanciones"
                  description="Registro de novedades disciplinarias y permisos."
                  soon
                />
              </>
            )}
          </div>
        </Section>

      </div>
    </PageLayout>
  )
}

// ── Componentes internos ──────────────────────────────────────────────────────

function Stat({
  label,
  value,
  accent = "default",
}: {
  label: string
  value: number | undefined
  accent?: "emerald" | "muted" | "default"
}) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-500"
      : accent === "muted"
      ? "text-muted-foreground"
      : ""

  return (
    <div>
      <p className={`text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value === undefined ? <span className="opacity-30">—</span> : value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  )
}

const ICON_COLORS: Record<string, string> = {
  blue:   "bg-blue-500/10 text-blue-500",
  violet: "bg-violet-500/10 text-violet-500",
  amber:  "bg-amber-500/10 text-amber-500",
  teal:   "bg-teal-500/10 text-teal-500",
  indigo: "bg-indigo-500/10 text-indigo-500",
  orange: "bg-orange-500/10 text-orange-500",
  red:    "bg-red-500/10 text-red-500",
}

function NavCard({
  icon,
  iconColor,
  title,
  description,
  onClick,
  soon = false,
}: {
  icon: React.ReactNode
  iconColor: string
  title: string
  description: string
  onClick?: () => void
  soon?: boolean
}) {
  const isClickable = !soon && onClick

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={soon}
      className={`
        w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-all
        ${isClickable
          ? "border-border hover:border-primary/40 hover:bg-muted/30 cursor-pointer group"
          : "border-border/50 opacity-60 cursor-default"
        }
      `}
    >
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_COLORS[iconColor] ?? "bg-muted text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {soon && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              Próximamente
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      {isClickable && (
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground mt-1 shrink-0 transition-colors" />
      )}
    </button>
  )
}

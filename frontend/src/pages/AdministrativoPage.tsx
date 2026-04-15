import { NavLink } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { useAuthStore } from "@/store/authStore"
import { useSolicitudes } from "@/hooks/useOC"
import { canApproveOC, canConfigureOC } from "@/lib/permissions"

export function AdministrativoPage() {
  const user = useAuthStore((s) => s.user)
  const canApprove = user ? canApproveOC(user.role) : false
  const canConfigure = user ? canConfigureOC(user.role) : false

  const { data: pendientes = [] } = useSolicitudes(
    canApprove ? { estado: "pendiente_aprobacion" } : undefined,
  )
  const pendientesCount = canApprove ? pendientes.length : 0

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Administrativo" />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Section header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-6 w-1 rounded-full bg-brand-blue" />
              <h2 className="text-xl font-bold text-gray-900">Compras</h2>
            </div>
            <p className="pl-4 text-sm text-gray-500">
              Gestión de órdenes de compra y automatización del proceso de adquisición.
            </p>
          </div>

          {/* Primary action — Solicitudes */}
          <PrimaryCard
            to="/oc/solicitudes"
            icon={<IconSolicitudes />}
            label="Solicitudes de Compra"
            description="Crea y gestiona solicitudes de compra. Adjunta cotizaciones, sube archivos y da seguimiento a cada orden en tiempo real."
          />

          {/* Secondary actions */}
          {(canApprove || canConfigure) && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {canApprove && (
                <SecondaryCard
                  to="/oc/aprobacion"
                  icon={<IconAprobaciones />}
                  label="Aprobaciones"
                  description="Revisa y aprueba solicitudes pendientes."
                  badge={pendientesCount}
                />
              )}

              {canApprove && (
                <SecondaryCard
                  to="/oc/kpis"
                  icon={<IconKPIs />}
                  label="KPIs"
                  description="Indicadores de desempeño del proceso."
                />
              )}

              {canConfigure && (
                <SecondaryCard
                  to="/oc/configuracion"
                  icon={<IconConfig />}
                  label="Configuración"
                  description="Plantillas de correo y ajustes del módulo."
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ── Primary card (Solicitudes) ────────────────────────────────────────────────

interface PrimaryCardProps {
  to: string
  icon: React.ReactNode
  label: string
  description: string
}

function PrimaryCard({ to, icon, label, description }: PrimaryCardProps) {
  return (
    <NavLink
      to={to}
      className="group flex items-center gap-6 w-full rounded-2xl bg-brand-blue px-8 py-7 shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-105 active:brightness-95"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition-colors duration-200 group-hover:bg-white/25">
        <span className="w-7 h-7">{icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold text-white leading-snug">{label}</p>
        <p className="mt-1 text-sm text-white/70 leading-relaxed">{description}</p>
      </div>

      <div className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-brand-yellow text-brand-blue transition-transform duration-200 group-hover:translate-x-1">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
        </svg>
      </div>
    </NavLink>
  )
}

// ── Secondary cards ───────────────────────────────────────────────────────────

interface SecondaryCardProps {
  to: string
  icon: React.ReactNode
  label: string
  description: string
  badge?: number
}

function SecondaryCard({ to, icon, label, description, badge }: SecondaryCardProps) {
  return (
    <NavLink
      to={to}
      className="group flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-150 hover:border-brand-blue/30 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/8 text-brand-blue transition-colors duration-150 group-hover:bg-brand-blue/15">
          <span className="w-5 h-5">{icon}</span>
        </div>
        {badge != null && badge > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-400 px-2 text-xs font-bold text-white">
            {badge}
          </span>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </NavLink>
  )
}

// ── Iconos ────────────────────────────────────────────────────────────────────

function IconSolicitudes() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
    </svg>
  )
}

function IconAprobaciones() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
    </svg>
  )
}

function IconKPIs() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9a1.5 1.5 0 0 0 3 0v-9A1.5 1.5 0 0 0 9.5 6ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 10Z" />
    </svg>
  )
}

function IconConfig() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .205 1.251l-1.18 2.044a1 1 0 0 1-1.186.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.205-1.251l1.18-2.044a1 1 0 0 1 1.186-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
    </svg>
  )
}

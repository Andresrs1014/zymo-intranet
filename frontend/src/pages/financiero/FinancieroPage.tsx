import { NavLink } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { useSolicitudesFinanciero } from "@/hooks/useFinanciero"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"

export function FinancieroPage() {
  const { data: solicitudesFinanciero } = useSolicitudesFinanciero()
  const sinFactura = solicitudesFinanciero?.filter((s) => !s.factura_id).length ?? 0
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === "admin"

  return (
    <PageLayout title="Financiero">
          {/* Section header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="h-6 w-1 rounded-full bg-brand-blue" />
                <h2 className="text-xl font-bold text-foreground">Gestión Financiera</h2>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <NavLink to="/financiero/configuracion" className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                    </svg>
                    Configuración
                  </NavLink>
                </Button>
              )}
            </div>
            <p className="pl-4 text-sm text-muted-foreground">
              Contabilidad — Gestión de facturas de proveedores
            </p>
          </div>

          {/* Card primaria — Facturas de Proveedores */}
          <PrimaryCard
            to="/financiero/facturas"
            icon={<IconFacturas />}
            label="Facturas de Proveedores"
            description="Carga y valida las facturas contra las órdenes de compra aprobadas"
            badge={sinFactura > 0 ? sinFactura : undefined}
          />
    </PageLayout>
  )
}

// ── Primary card ──────────────────────────────────────────────────────────────

function PrimaryCard({
  to,
  icon,
  label,
  description,
  badge,
}: {
  to: string
  icon: React.ReactNode
  label: string
  description: string
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      className="group flex items-center gap-6 w-full rounded-2xl bg-card border border-border px-8 py-7 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 active:scale-[0.99]"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors duration-200 group-hover:bg-primary/15">
        <span className="w-7 h-7">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-lg font-bold text-foreground leading-snug">{label}</p>
          {badge !== undefined && badge > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground min-w-[1.25rem]">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary transition-transform duration-200 group-hover:translate-x-1 group-hover:bg-primary/20">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
        </svg>
      </div>
    </NavLink>
  )
}

// ── Icono ─────────────────────────────────────────────────────────────────────

function IconFacturas() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
    </svg>
  )
}

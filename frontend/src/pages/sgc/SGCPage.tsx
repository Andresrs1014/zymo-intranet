import { NavLink } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"

export function SGCPage() {
  return (
    <PageLayout title="SGC">
          {/* Section header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-6 w-1 rounded-full bg-brand-blue" />
              <h2 className="text-xl font-bold text-foreground">Sistema de Gestión de Calidad</h2>
            </div>
            <p className="pl-4 text-sm text-muted-foreground">
              Administración y control del catálogo de proveedores de la organización.
            </p>
          </div>

          {/* Primary action */}
          <PrimaryCard
            to="/sgc/proveedores"
            icon={<IconProveedores />}
            label="Proveedores"
            description="Crea, edita y administra el catálogo de proveedores. Los proveedores activos estarán disponibles en OC Automatizaciones."
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
}: {
  to: string
  icon: React.ReactNode
  label: string
  description: string
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
        <p className="text-lg font-bold text-foreground leading-snug">{label}</p>
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

function IconProveedores() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07ZM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5Z" />
    </svg>
  )
}

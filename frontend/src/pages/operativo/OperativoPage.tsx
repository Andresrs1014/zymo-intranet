import { NavLink, Link } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"

// URL del sistema BRP — eventualmente se reemplazará por ruta interna
const BRP_URL = "https://brp.zymointranet.com"

export function OperativoPage() {
  return (
    <PageLayout title="Operativo">
          {/* Section header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-6 w-1 rounded-full bg-brand-blue" />
              <h2 className="text-xl font-bold text-foreground">Operaciones</h2>
            </div>
            <p className="pl-4 text-sm text-muted-foreground">
              Gestión de solicitudes de compra y herramientas del área operativa.
            </p>
          </div>

          {/* Card primaria — Mis Solicitudes */}
          <PrimaryCard
            to="/operativo/mis-solicitudes"
            icon={<IconSolicitudes />}
            label="Mis Solicitudes"
            description="Consulta el estado de tus solicitudes de compra y confirma la recepción de los pedidos que ya llegaron a la plataforma."
          />

          {/* Cards secundarias */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InternalCard
              to="/operativo/paquetes"
              icon={<IconPaquetes />}
              label="Paquetes de Compras"
              description="Crea plantillas de solicitudes frecuentes y despáchalas todas en un solo clic."
            />
            <ExternalCard
              href={BRP_URL}
              icon={<IconBRP />}
              label="BRP"
              description="Sistema de gestión operativa. Acceso directo al portal BRP de ZYMO."
            />
          </div>
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

// ── Internal card (páginas internas) ─────────────────────────────────────────

function InternalCard({
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
    <Link
      to={to}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-150 hover:border-brand-blue/30 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/8 text-brand-blue transition-colors duration-150 group-hover:bg-brand-blue/15">
          <span className="w-5 h-5">{icon}</span>
        </div>
        <svg className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-brand-blue/40 transition-colors" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </Link>
  )
}

// ── External card (BRP y futuros sistemas externos) ───────────────────────────

function ExternalCard({
  href,
  icon,
  label,
  description,
}: {
  href: string
  icon: React.ReactNode
  label: string
  description: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-150 hover:border-brand-blue/30 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/8 text-brand-blue transition-colors duration-150 group-hover:bg-brand-blue/15">
          <span className="w-5 h-5">{icon}</span>
        </div>
        {/* Indicador de enlace externo */}
        <svg className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-brand-blue/40 transition-colors" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5ZM10 2.75a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0V4.56l-5.22 5.22a.75.75 0 1 1-1.06-1.06l5.22-5.22h-4.69a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </a>
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

function IconPaquetes() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" />
    </svg>
  )
}

function IconBRP() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
    </svg>
  )
}

import { Link, useLocation } from "react-router-dom"
import { ArrowLeft, Building2, Mail, MessageCircle, ShieldCheck, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const LINKS = [
  { to: "/admin/configuracion/usuarios", label: "Usuarios", icon: Users },
  { to: "/admin/configuracion/roles", label: "Roles y permisos", icon: ShieldCheck },
  { to: "/admin/configuracion/areas", label: "Áreas y sedes", icon: Building2 },
  { to: "/admin/configuracion/smtp", label: "SMTP corporativo", icon: Mail },
  { to: "/admin/configuracion/whatsapp", label: "WhatsApp corporativo", icon: MessageCircle },
] as const

export function AdminConfigNav() {
  const { pathname } = useLocation()

  return (
    <div className="mb-6">
      <Link
        to="/admin/configuracion"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 transition hover:text-zinc-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Configuración de la intranet
      </Link>
      <nav aria-label="Configuración de la intranet" className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 w-fit">
        {LINKS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

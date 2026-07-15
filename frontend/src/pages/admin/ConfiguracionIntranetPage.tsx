import { useNavigate } from "react-router-dom"
import { Users, ShieldCheck, Building2, Mail, ChevronRight, LockKeyhole } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { BlurFade } from "@/components/ui/blur-fade"

interface ConfigCard {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  accent: string
}

const CARDS: ConfigCard[] = [
  {
    to: "/admin/configuracion/usuarios",
    icon: <Users className="h-5 w-5" />,
    title: "Usuarios",
    description: "Cuentas del portal, archivar/reactivar, herramientas asignadas por persona.",
    accent: "#2563eb",
  },
  {
    to: "/admin/configuracion/roles",
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Roles y permisos",
    description: "Qué módulo ve cada rol. Cambios exigen que el usuario vuelva a iniciar sesión.",
    accent: "#c41e3a",
  },
  {
    to: "/admin/configuracion/areas",
    icon: <Building2 className="h-5 w-5" />,
    title: "Áreas y sedes",
    description: "Catálogo maestro de áreas/sedes que alimenta los selects de toda la intranet.",
    accent: "#0f766e",
  },
  {
    to: "/admin/configuracion/smtp",
    icon: <Mail className="h-5 w-5" />,
    title: "SMTP corporativo",
    description: "Cuenta compartida para enviar alertas por correo desde Tickets, T&C y Tareas.",
    accent: "#9333ea",
  },
]

export function ConfiguracionIntranetPage() {
  const navigate = useNavigate()

  return (
    <PageLayout title="Configuración de la intranet">
      <div className="mx-auto max-w-4xl">
        <BlurFade duration={0.35}>
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
              <LockKeyhole className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Solo administradores</h2>
              <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-600">
                Acá se configura lo <strong>general</strong> de la intranet: quién existe, qué rol tiene y de
                dónde salen los catálogos maestros (áreas, sedes). Cada herramienta — Zymo Ally, Gestión de
                Tareas, Helix — mantiene su propia configuración interna por separado.
              </p>
            </div>
          </div>
        </BlurFade>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card, i) => (
            <BlurFade key={card.to} duration={0.35} delay={0.08 + i * 0.06}>
              <button
                type="button"
                onClick={() => navigate(card.to)}
                className="group flex h-full w-full flex-col items-start rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-white transition-transform group-hover:scale-105"
                  style={{ background: card.accent }}
                >
                  {card.icon}
                </span>
                <h3 className="flex items-center gap-1 text-[15px] font-bold text-zinc-900">
                  {card.title}
                  <ChevronRight className="h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{card.description}</p>
              </button>
            </BlurFade>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}

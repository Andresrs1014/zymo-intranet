import type { ReactNode } from "react"

import { PageLayout } from "@/components/layout/PageLayout"
import { AppCard } from "@/components/apps/AppCard"
import { ComprasVistaPrevia } from "@/components/layout/ComprasVistaPrevia"
import { FinancieraVistaPrevia } from "@/components/layout/FinancieraVistaPrevia"
import { TareasVistaPrevia } from "@/components/layout/TareasVistaPrevia"
import { getAppsForRole } from "@/lib/roles"
import { canManageDevTasks, canSubmitDevTasks } from "@/lib/permissions"
import { useAuthStore } from "@/store/authStore"

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{titulo}</h3>
      {children}
    </section>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const perms = user?.app_permissions ?? []
  const admin = user?.role === "admin"
  const verCompras = admin || perms.includes("mod_oc_ver")
  const verFinanciera = admin || perms.includes("mod_financiero")
  const tools = user?.user_tools ?? []
  const verTareas = canSubmitDevTasks(tools) || canManageDevTasks(tools)
  const conResumen = verCompras || verFinanciera || verTareas
  // ponytail: las aplicaciones externas solo salen si la persona no tiene ningún resumen que mostrar
  const externas = user && !conResumen ? getAppsForRole(user.role, perms) : []

  return (
    <PageLayout title="Dashboard">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">
          Bienvenido{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h1>
        {conResumen && <p className="mt-0.5 text-sm text-muted-foreground">Lo pendiente en tus módulos</p>}
      </div>

      {conResumen ? (
        <div className="flex max-w-7xl flex-col gap-8">
          {verCompras && <Seccion titulo="Compras"><ComprasVistaPrevia /></Seccion>}
          {verFinanciera && <Seccion titulo="Financiero"><FinancieraVistaPrevia /></Seccion>}
          {verTareas && <Seccion titulo="Gestión de tareas"><TareasVistaPrevia /></Seccion>}
        </div>
      ) : externas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay aplicaciones externas asignadas a tu rol. Un administrador puede añadir permisos en{" "}
          <span className="font-medium text-foreground">Configuración → Roles</span>.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {externas.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </PageLayout>
  )
}

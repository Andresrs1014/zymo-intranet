import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { PageLayout } from "@/components/layout/PageLayout"
import { AppCard } from "@/components/apps/AppCard"
import { ComprasVistaPrevia } from "@/components/layout/ComprasVistaPrevia"
import { FinancieraVistaPrevia } from "@/components/layout/FinancieraVistaPrevia"
import { TareasVistaPrevia } from "@/components/layout/TareasVistaPrevia"
import { ProcedimientosVistaPrevia } from "@/components/layout/ProcedimientosVistaPrevia"
import { getAppsForRole } from "@/lib/roles"
import { canManageDevTasks, canSeeSIG, canSeeSigLider, canSubmitDevTasks } from "@/lib/permissions"
import { useAuthStore } from "@/store/authStore"

function Seccion({ titulo, plegable, abierta, children }: { titulo: string; plegable: boolean; abierta: boolean; children: ReactNode }) {
  if (!plegable) {
    return (
      <section>
        <h3 className="mb-3 text-base font-semibold text-foreground">{titulo}</h3>
        {children}
      </section>
    )
  }
  return (
    <details open={abierta} className="group rounded-xl border border-border bg-white/60 open:bg-transparent">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        {titulo}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const perms = user?.app_permissions ?? []
  const admin = user?.role === "admin"
  const verCompras = admin || perms.includes("mod_oc_ver")
  const verFinanciera = admin || perms.includes("mod_financiero")
  const tools = user?.user_tools ?? []
  const verTareas = admin || canSubmitDevTasks(tools) || canManageDevTasks(tools)
  // SIG: quien tiene el módulo completo ve todos los procedimientos; el líder, solo los de su carpeta
  const verSigCompleto = !!user && canSeeSIG(user.role, perms)
  const verSigLider = !!user && !verSigCompleto && canSeeSigLider(user.role, perms)
  const verSig = verSigCompleto || verSigLider
  const conResumen = verCompras || verFinanciera || verTareas || verSig
  // 3 módulos: cada uno se despliega; 1 o 2: se muestran abiertos y en grande, con quién pidió y hace cuánto
  const plegable = [verCompras, verFinanciera, verTareas, verSig].filter(Boolean).length >= 3
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
        <div className={`flex max-w-7xl flex-col ${plegable ? "gap-3" : "gap-8"}`}>
          {verCompras && <Seccion titulo="Compras" plegable={plegable} abierta><ComprasVistaPrevia amplio /></Seccion>}
          {verFinanciera && <Seccion titulo="Financiero" plegable={plegable} abierta={false}><FinancieraVistaPrevia amplio /></Seccion>}
          {verSig && <Seccion titulo="Procedimientos" plegable={plegable} abierta><ProcedimientosVistaPrevia base={verSigLider ? "/sig-area" : "/sig"} /></Seccion>}
          {verTareas && <Seccion titulo="Gestión de tareas" plegable={plegable} abierta={false}><TareasVistaPrevia amplio /></Seccion>}
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

import { Link } from "react-router-dom"
import { CheckSquare, Home, MoreHorizontal, ShoppingCart, Smile, Ticket, type LucideIcon } from "lucide-react"
import { useSolicitudes } from "@/hooks/useOC"
import { useTickets } from "@/hooks/useTickets"
import { useTareas } from "@/components/layout/TareasVistaPrevia"
import { useSidebar } from "@/components/ui/sidebar"
import { MovilBarraInferior, type MovilNavItem } from "@/components/movil/Movil"
import { canApproveOC, canManageDevTasks, canSeeOC, canSeeSAC, canSeeTickets, canSubmitDevTasks } from "@/lib/permissions"
import { formatFechaRelativa } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/authStore"

function useAccesos() {
  const user = useAuthStore((s) => s.user)
  const perms = user?.app_permissions
  const tools = user?.user_tools ?? []
  return {
    user,
    compras: !!user && canSeeOC(user.role, user.area, perms),
    aprueba: !!user && canApproveOC(user.role, perms),
    tareas: !!user && (user.role === "admin" || canSubmitDevTasks(tools) || canManageDevTasks(tools)),
    tickets: !!user && canSeeTickets(user.role, perms),
    sac: !!user && canSeeSAC(user.role, perms),
  }
}

const MODULOS: { clave: "compras" | "tareas" | "tickets" | "sac"; titulo: string; detalle: string; a: string; icono: LucideIcon; tinte: string }[] = [
  { clave: "compras", titulo: "Compras", detalle: "Solicitudes y OC", a: "/oc/solicitudes", icono: ShoppingCart, tinte: "bg-[#FDECEE] text-[#C3182A]" },
  { clave: "tareas", titulo: "Tareas", detalle: "Mi trabajo y tablero", a: "/tareas-v2", icono: CheckSquare, tinte: "bg-[#DBEAFE] text-[#1D4ED8]" },
  { clave: "tickets", titulo: "Tickets", detalle: "PQR de clientes", a: "/zymoally/tickets", icono: Ticket, tinte: "bg-[#FEF3C7] text-[#B45309]" },
  { clave: "sac", titulo: "SAC", detalle: "Fidelización y visitas", a: "/zymoally/sac", icono: Smile, tinte: "bg-[#DCFCE7] text-[#15803D]" },
]

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 font-mono text-[11px] font-medium uppercase tracking-wider text-[#71717A] first:mt-0">{children}</h2>
}

/** Inicio en el teléfono: lo pendiente, los módulos y lo más reciente — todo con datos reales. */
export function InicioMovil() {
  const a = useAccesos()
  const porAprobar = useSolicitudes({ estado: "pendiente_aprobacion" }, 1, { enabled: a.aprueba })
  const tareas = useTareas("mias", `responsableId=${a.user?.id ?? 0}`, { enabled: a.tareas && !!a.user })
  const tickets = useTickets({ asignadoAMi: true }, { enabled: a.tickets })
  const ticketsAbiertos = (tickets.data ?? []).filter((t) => !t.closedAt)

  const pendientes = [
    a.aprueba && { clave: "aprobar", n: porAprobar.data?.total, etiqueta: "Por aprobar", a: "/oc/aprobacion", clase: "bg-[#FDECEE] text-[#C3182A]" },
    a.tareas && { clave: "tareas", n: tareas.data?.length, etiqueta: "Mis tareas", a: "/tareas-v2", clase: "bg-[#DBEAFE] text-[#1D4ED8]" },
    a.tickets && { clave: "tickets", n: tickets.data ? ticketsAbiertos.length : undefined, etiqueta: "Tickets", a: "/zymoally/tickets", clase: "bg-[#FEF3C7] text-[#B45309]" },
  ].filter(Boolean) as { clave: string; n?: number; etiqueta: string; a: string; clase: string }[]

  const recientes = [
    ...(porAprobar.data?.items ?? []).map((s) => ({
      clave: `oc-${s.id}`, fecha: s.fecha_solicitud, a: `/oc/solicitudes/${s.id}`, punto: "bg-[#C3182A]",
      titulo: `${s.consecutivo_os} espera tu aprobación`, detalle: `Compras · ${s.descripcion}`,
    })),
    ...(tareas.data ?? []).map((t) => ({
      clave: `t-${t.id}`, fecha: t.createdAt, a: "/tareas-v2", punto: "bg-[#1D4ED8]",
      titulo: t.titulo, detalle: `Tareas · ${t.subidoPorNombre}`,
    })),
    ...ticketsAbiertos.map((t) => ({
      clave: `k-${t.id}`, fecha: t.createdAt, a: "/zymoally/tickets", punto: "bg-[#B45309]",
      titulo: `${t.code} · ${t.client ?? t.type}`, detalle: `Tickets · ${t.status}`,
    })),
  ]
    .sort((x, y) => (y.fecha ?? "").localeCompare(x.fecha ?? ""))
    .slice(0, 5)

  const modulos = MODULOS.filter((m) => a[m.clave])

  return (
    <div className="md:hidden">
      {pendientes.length > 0 && (
        <>
          <Etiqueta>Pendiente por ti</Etiqueta>
          <div className="grid grid-cols-3 gap-2.5">
            {pendientes.map((p) => (
              <Link key={p.clave} to={p.a} className={cn("flex min-h-[84px] flex-col justify-between rounded-xl px-3 py-3 transition-transform active:scale-[0.98] motion-reduce:transition-none", p.clase)}>
                <span className="font-mono text-[26px] font-medium leading-none">{p.n ?? "–"}</span>
                <span className="text-[13px] font-semibold">{p.etiqueta}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {modulos.length > 0 && (
        <>
          <Etiqueta>Módulos</Etiqueta>
          <div className="grid grid-cols-2 gap-2.5">
            {modulos.map((m) => (
              <Link key={m.clave} to={m.a} className="flex min-h-[104px] flex-col gap-2 rounded-xl border border-[#E4E4E7] bg-white p-3.5 transition-transform active:scale-[0.98] motion-reduce:transition-none">
                <span className={cn("flex size-10 items-center justify-center rounded-lg", m.tinte)}>
                  <m.icono className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-[15px] font-bold text-[#18181B]">{m.titulo}</span>
                  <span className="block text-xs text-[#71717A]">{m.detalle}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {recientes.length > 0 && (
        <>
          <Etiqueta>Lo más reciente</Etiqueta>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {recientes.map((r) => (
              <li key={r.clave}>
                <Link to={r.a} className="flex min-h-14 items-start gap-3 rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-3">
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", r.punto)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#18181B]">{r.titulo}</span>
                    <span className="block truncate text-xs text-[#71717A]">{r.detalle}</span>
                  </span>
                  {r.fecha && <span className="shrink-0 text-[11px] text-[#71717A]">{formatFechaRelativa(r.fecha)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** Saludo y fecha para la barra superior del inicio. */
export function saludoInicio(nombre: string | null | undefined, sede: string | null | undefined) {
  const hoy = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })
  return {
    titulo: `Hola${nombre ? `, ${nombre.split(" ")[0]}` : ""}`,
    subtitulo: `${hoy.charAt(0).toUpperCase()}${hoy.slice(1)}${sede ? ` · Sede ${sede}` : ""}`,
  }
}

/** Barra inferior del inicio: Inicio, hasta tres módulos con permiso y "Más" (abre el menú). */
export function InicioBarraInferior() {
  const a = useAccesos()
  const { toggleSidebar } = useSidebar()
  const items: MovilNavItem[] = [
    { clave: "inicio", etiqueta: "Inicio", icono: Home, activo: true, a: "/dashboard" },
    ...MODULOS.filter((m) => a[m.clave]).slice(0, 3).map((m) => ({ clave: m.clave, etiqueta: m.titulo, icono: m.icono, a: m.a })),
    { clave: "mas", etiqueta: "Más", icono: MoreHorizontal, onClick: toggleSidebar },
  ]
  return <MovilBarraInferior items={items} />
}

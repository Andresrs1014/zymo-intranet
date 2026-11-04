import { Link, useLocation } from "react-router-dom"
import { BarChart3, CheckCheck, List, MoreHorizontal } from "lucide-react"
import { useSolicitudes } from "@/hooks/useOC"
import { useSidebar } from "@/components/ui/sidebar"
import { MovilBarraInferior, type MovilNavItem } from "@/components/movil/Movil"
import { canApproveOC } from "@/lib/permissions"
import { formatFechaRelativa } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/authStore"
import type { SolicitudOC } from "@/types/oc"

/** Chips de estado con la paleta del diseño móvil (mismas etiquetas que el escritorio). */
const ESTADO_MOVIL: Record<string, { etiqueta: string; clase: string }> = {
  nueva: { etiqueta: "Nueva", clase: "bg-[#EDE9FE] text-[#6D28D9]" },
  en_cotizacion: { etiqueta: "En cotización", clase: "bg-[#DBEAFE] text-[#1D4ED8]" },
  pendiente_aprobacion: { etiqueta: "Cotización lista", clase: "bg-[#FEF3C7] text-[#B45309]" },
  aprobada: { etiqueta: "Aprobada", clase: "bg-[#DCFCE7] text-[#15803D]" },
  rechazada: { etiqueta: "Rechazada", clase: "bg-[#FDECEE] text-[#C3182A]" },
  en_correccion: { etiqueta: "En corrección", clase: "bg-[#FEF3C7] text-[#B45309]" },
  oc_enviada: { etiqueta: "OC Enviada", clase: "bg-[#DBEAFE] text-[#1D4ED8]" },
  oc_en_plataforma: { etiqueta: "En plataforma", clase: "bg-[#EDE9FE] text-[#6D28D9]" },
  entregada: { etiqueta: "Entregada", clase: "bg-[#DCFCE7] text-[#15803D]" },
  cerrada: { etiqueta: "Cerrada", clase: "bg-[#F4F4F5] text-[#71717A]" },
}

export function EstadoChipMovil({ estado }: { estado: string }) {
  const e = ESTADO_MOVIL[estado] ?? { etiqueta: estado, clase: "bg-[#F4F4F5] text-[#71717A]" }
  return <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold", e.clase)}>{e.etiqueta}</span>
}

const PRIORIDAD_CLASE: Record<string, string> = { Alta: "text-[#C3182A]", Media: "text-[#B45309]", Baja: "text-[#15803D]" }

/** Tarjeta de solicitud para el teléfono (reemplaza la fila de la tabla). */
export function SolicitudCardMovil({ solicitud: s }: { solicitud: SolicitudOC }) {
  return (
    <Link
      to={`/oc/solicitudes/${s.id}`}
      className="block rounded-xl border border-[#E4E4E7] bg-white px-4 py-3.5 transition-colors active:bg-[#F4F4F5]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[13px] font-medium text-[#71717A]">{s.consecutivo_os}</span>
        <EstadoChipMovil estado={s.estado} />
      </div>
      <p className="m-0 mt-1 line-clamp-2 text-[15px] font-bold text-[#18181B]">{s.descripcion}</p>
      <p className="m-0 mt-0.5 truncate text-[13px] text-[#71717A]">
        {[s.area_solicitante, s.solicitante_nombre].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-semibold", PRIORIDAD_CLASE[s.nivel_prioridad] ?? "text-[#71717A]")}>
          Prioridad {s.nivel_prioridad.toLowerCase()} · Cant. <span className="font-mono">{s.cantidad}</span>
        </span>
        <span className="shrink-0 text-[#71717A]">{formatFechaRelativa(s.fecha_solicitud)}</span>
      </div>
    </Link>
  )
}

/** Barra inferior de Compras: Solicitudes, Aprobar (si aprueba), KPI y Más. */
export function ComprasBarraInferior() {
  const { pathname } = useLocation()
  const { toggleSidebar } = useSidebar()
  const user = useAuthStore((s) => s.user)
  const aprueba = !!user && canApproveOC(user.role, user.app_permissions)
  const { data } = useSolicitudes({ estado: "pendiente_aprobacion" }, 1, { enabled: aprueba })

  const items: MovilNavItem[] = [
    { clave: "sol", etiqueta: "Solicitudes", icono: List, a: "/oc/solicitudes", activo: pathname.startsWith("/oc/solicitudes") },
    ...(aprueba
      ? [{ clave: "apr", etiqueta: "Aprobar", icono: CheckCheck, a: "/oc/aprobacion", activo: pathname.startsWith("/oc/aprobacion"), insignia: data?.total }]
      : []),
    { clave: "kpi", etiqueta: "KPI", icono: BarChart3, a: "/oc/kpis", activo: pathname.startsWith("/oc/kpis") },
    { clave: "mas", etiqueta: "Más", icono: MoreHorizontal, onClick: toggleSidebar },
  ]
  return <MovilBarraInferior items={items} />
}

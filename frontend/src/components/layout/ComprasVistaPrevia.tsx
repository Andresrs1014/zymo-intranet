import { UserCheck, ClipboardCheck } from "lucide-react"

import { useSolicitudes } from "@/hooks/useOC"
import { canApproveOC } from "@/lib/permissions"
import { useAuthStore } from "@/store/authStore"
import type { EstadoOC } from "@/types/oc"
import { CHIP_PRIORIDAD, CuadroVistaPrevia, hace, type FilaPrevia } from "./CuadroVistaPrevia"

const ORDEN = ["alta", "media", "baja"]

function Cuadro({ titulo, icon, estado, amplio }: { titulo: string; icon: React.ReactNode; estado: EstadoOC; amplio: boolean }) {
  const { data, isLoading, isError } = useSolicitudes({ estado })
  // las más urgentes primero (de las que trae la página actual)
  const filas = [...(data?.items ?? [])]
    .sort((a, b) => ORDEN.indexOf(a.nivel_prioridad.toLowerCase()) - ORDEN.indexOf(b.nivel_prioridad.toLowerCase()))
    .map((s): FilaPrevia => ({
      key: s.id,
      chip: { texto: s.nivel_prioridad, clase: CHIP_PRIORIDAD[s.nivel_prioridad.toLowerCase()] ?? CHIP_PRIORIDAD.baja },
      texto: s.descripcion,
      datos: [["Solicitante", s.solicitante_nombre], ["Área", s.area_solicitante], ["Unidades", String(s.cantidad)], ["Solicitada", hace(s.fecha_solicitud)]],
      aparte: amplio ? s.consecutivo_os : s.solicitante_nombre,
      aparteTitulo: `Solicitó ${s.solicitante_nombre}`,
      to: `/oc/solicitudes/${s.id}`,
    }))
  return <CuadroVistaPrevia titulo={titulo} icon={icon} total={data?.total} filas={filas} cargando={isLoading} error={isError} amplio={amplio} verTodo="/oc/solicitudes" />
}

/** Vista previa de Compras en el inicio: solicitudes por asignar y, para quien aprueba, las que esperan aprobación. */
export function ComprasVistaPrevia({ amplio = false }: { amplio?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const aprueba = user ? canApproveOC(user.role, user.app_permissions) : false
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Cuadro titulo="Por asignar" icon={<UserCheck className="size-4" aria-hidden="true" />} estado="nueva" amplio={amplio} />
      {aprueba && <Cuadro titulo="Por aprobar" icon={<ClipboardCheck className="size-4" aria-hidden="true" />} estado="pendiente_aprobacion" amplio={amplio} />}
    </div>
  )
}

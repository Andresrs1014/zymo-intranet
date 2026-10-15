import { FileX2, FileSearch, TriangleAlert } from "lucide-react"

import { useSolicitudesFinanciero } from "@/hooks/useFinanciero"
import type { SolicitudConFactura } from "@/types/financiero"
import { CuadroVistaPrevia, hace, type FilaPrevia } from "./CuadroVistaPrevia"

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })

const fila = (s: SolicitudConFactura): FilaPrevia => ({
  key: s.solicitud_id,
  texto: `${s.numero_oc ?? s.consecutivo_os ?? "OC"} · ${s.proveedor_nombre ?? s.descripcion ?? "Sin proveedor"}`,
  datos: [["Solicitante", s.solicitante_nombre], ["Área", s.area_solicitante], ["Compra", s.empresa_compra_nombre], ["Hace", hace(s.fecha_recibido ?? s.fecha_en_plataforma)]],
  aparte: (s.valor_factura ?? s.valor_aprobado) != null ? pesos.format((s.valor_factura ?? s.valor_aprobado) as number) : undefined,
  aparteTitulo: s.solicitante_nombre ? `Solicitó ${s.solicitante_nombre}` : undefined,
  to: `/financiero/facturas/${s.solicitud_id}`,
})

/** Vista previa de Financiero en el inicio: las mismas tres colas que la pantalla de facturas, solo lectura. */
export function FinancieraVistaPrevia({ amplio = false }: { amplio?: boolean }) {
  const { data = [], isLoading, isError } = useSolicitudesFinanciero()
  const grupos = [
    { titulo: "Sin factura", icon: <FileX2 className="size-4" aria-hidden="true" />, items: data.filter((s) => !s.factura_id), vacio: "Todas las OC tienen factura." },
    { titulo: "Por validar", icon: <FileSearch className="size-4" aria-hidden="true" />, items: data.filter((s) => s.factura_estado === "pendiente"), vacio: "No hay facturas esperando validación." },
    { titulo: "Con diferencias", icon: <TriangleAlert className="size-4" aria-hidden="true" />, items: data.filter((s) => s.factura_estado === "con_diferencias"), vacio: "Sin diferencias abiertas." },
  ]
  return (
    <div className={`grid gap-3 md:grid-cols-2 ${amplio ? "xl:grid-cols-3" : "2xl:grid-cols-3"}`}>
      {grupos.map((g) => (
        <CuadroVistaPrevia key={g.titulo} titulo={g.titulo} icon={g.icon} total={isLoading ? undefined : g.items.length} filas={g.items.map(fila)} cargando={isLoading} error={isError} vacio={g.vacio} amplio={amplio} verTodo="/financiero/facturas" />
      ))}
    </div>
  )
}

export type EstadoOC =
  | "nueva"
  | "en_cotizacion"
  | "pendiente_aprobacion"
  | "aprobada"
  | "rechazada"
  | "oc_enviada"
  | "entregada"
  | "cerrada"

export interface SolicitudOC {
  id: string
  consecutivo_os: string
  descripcion: string
  categoria: string | null
  grupo_articulos: string | null
  cantidad: number
  nivel_prioridad: string
  solicitante_nombre: string
  solicitante_email: string | null
  area_solicitante: string | null
  sede: string | null
  cliente: string | null
  condicion: string | null
  observaciones_solicitante: string | null
  placa_ficha: string | null
  fecha_proximo_mantenimiento: string | null
  estado: EstadoOC
  auxiliar_id: number | null
  evidencia_url: string | null
  plataforma: string | null
  numero_remision: string | null
  observaciones_compras: string | null
  fecha_estimada_entrega: string | null
  fecha_confirmada_entrega: string | null
  numero_factura: string | null
  aval_compra: string | null
  observacion_contabilidad: string | null
  fecha_recibida_factura: string | null
  fecha_solicitud: string
  fecha_cotizacion: string | null
  fecha_aprobacion: string | null
  fecha_envio_oc: string | null
  fecha_recibido: string | null
  created_at: string
  updated_at: string
}

export interface CotizacionProveedor {
  id: string
  solicitud_id: string
  proveedor_nombre: string
  proveedor_email: string | null
  numero_cotizacion_proveedor: string | null
  valor_unitario: number
  valor_total: number
  fecha_vigencia: string | null
  observaciones: string | null
  pdf_path: string | null
  extraccion_automatica: boolean
  aprobada: boolean | null
  valor_aprobado: number | null
  aprobado_por_id: number | null
  observaciones_aprobacion: string | null
  created_at: string
}

export interface OrdenCompra {
  id: string
  solicitud_id: string
  cotizacion_id: string
  numero_oc: string
  pdf_path: string | null
  enviada_proveedor: boolean
  enviada_coordinador: boolean
  email_proveedor: string | null
  created_at: string
}

export interface Proveedor {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  nit: string | null
  categoria: string | null
  activo: boolean
  created_at: string
}

export interface ConteoItem {
  label: string
  count: number
}

export interface KPIData {
  total_solicitudes: number
  por_estado: ConteoItem[]
  por_plataforma: ConteoItem[]
  por_prioridad: ConteoItem[]
  por_area: ConteoItem[]
  valor_total_aprobado: number
  total_ordenes_generadas: number
  top_proveedores: ConteoItem[]
  tiempo_promedio_cotizacion_dias: number
  solicitudes_recientes: {
    id: string
    consecutivo_os: string
    descripcion: string
    estado: string
    nivel_prioridad: string
    plataforma: string | null
    fecha_solicitud: string
  }[]
}

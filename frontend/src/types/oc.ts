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
  estado: EstadoOC
  auxiliar_id: number | null
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

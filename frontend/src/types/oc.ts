export type EstadoOC =
  | "nueva"
  | "en_cotizacion"
  | "pendiente_aprobacion"
  | "aprobada"
  | "rechazada"
  | "cancelada"
  | "en_correccion"
  | "oc_enviada"
  | "oc_en_plataforma"
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
  tipo_solicitud: "compra" | "mantenimiento"
  tipo_mantenimiento: string | null
  clasificacion_mantenimiento: string | null
  fecha_proximo_mantenimiento: string | null
  origen_solicitud_id: string | null
  archivada: boolean
  tiene_proforma: boolean
  proforma_path: string | null
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
  fotos_producto: string[] | null
  fecha_solicitud: string
  fecha_asignacion: string | null
  fecha_cotizacion: string | null
  fecha_aprobacion: string | null
  fecha_envio_oc: string | null
  fecha_en_plataforma: string | null
  fecha_recibido: string | null
  fecha_cerrado: string | null
  created_at: string
  updated_at: string
}

/** Respuesta de GET /api/oc/solicitudes (listado paginado). */
export interface SolicitudesListResponse {
  items: SolicitudOC[]
  total: number
}

export interface ItemCotizacion {
  num?: number
  descripcion: string
  referencia?: string
  cantidad?: number
  valor_unitario?: number
  valor_total?: number
}

export interface CotizacionProveedor {
  id: string
  solicitud_id: string
  proveedor_nombre: string
  proveedor_nit: string | null
  proveedor_email: string | null
  numero_cotizacion_proveedor: string | null
  valor_unitario: number
  valor_antes_iva: number | null
  valor_iva: number | null
  valor_total: number
  fecha_estimada_entrega: string | null
  forma_pago: string | null
  plazo_entrega: string | null
  garantia: string | null
  anticipo: string | null
  pago_saldo: string | null
  observaciones: string | null
  pdf_path: string | null
  extraccion_automatica: boolean
  aprobada: boolean | null
  valor_aprobado: number | null
  valor_aprobado_original: number | null
  aprobado_por_id: number | null
  observaciones_aprobacion: string | null
  items: ItemCotizacion[] | null
  created_at: string
}

export interface HistorialEntrada {
  id: string
  estado_anterior: string | null
  estado_nuevo: string
  usuario_nombre: string | null
  notas: string | null
  fecha: string
  es_reproceso?: boolean
  tipo_accion?: string | null
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

export interface MesItem {
  mes: string           // "2026-04"
  label: string         // "Abr 2026"
  solicitudes: number
  valor_aprobado: number
}

export interface UsuarioBasico {
  id: number
  full_name: string
  email: string
  area: string | null
  role: string
}

export interface KPIData {
  total_solicitudes: number
  por_estado: ConteoItem[]
  por_plataforma: ConteoItem[]
  por_prioridad: ConteoItem[]
  por_area: ConteoItem[]
  valor_total_aprobado: number
  valor_total_sin_iva: number
  valor_iva_acumulado: number
  total_ordenes_generadas: number
  top_proveedores: ConteoItem[]
  /** Promedio días desde fecha_solicitud hasta fecha_asignacion (solo solicitudes ya asignadas en el filtro). */
  tiempo_promedio_asignacion_dias: number
  muestras_asignacion: number
  /** Promedio días desde entrada a en_correccion hasta la siguiente transición (solo ciclos cerrados). */
  tiempo_promedio_correccion_solicitante_dias: number
  ciclos_correccion_resueltos: number
  tiempo_promedio_cotizacion_dias: number
  por_mes: MesItem[]
  solicitudes_recientes: {
    id: string
    consecutivo_os: string
    descripcion: string
    estado: string
    nivel_prioridad: string
    plataforma: string | null
    fecha_solicitud: string
  }[]
  reprocesos_total: number
  tiempo_promedio_reproceso_dias: number
  correcciones_directivo: number
  rechazos_solicitud: number
  rechazos_cotizacion: number
  /** Presente en backends recientes; si falta, el frontend puede sintetizarlo con `resolverReporteTiemposKpis`. */
  reporte_tiempos?: {
    texto_para_informe: string
    metricas: {
      clave: string
      etiqueta: string
      subtitulo: string
      valor: number
      unidad: string
      ayuda: string
    }[]
    generado_en_utc: string
    nota_metodologia: string
    sugerencia_agentes: string
  }
}

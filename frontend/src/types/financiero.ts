import type { EstadoOC } from "./oc"

export type EstadoFactura = "pendiente" | "validada" | "con_diferencias"

export interface SolicitudConFactura {
  solicitud_id: string
  consecutivo_os: string | null
  descripcion: string | null
  solicitante_nombre: string | null
  area_solicitante: string | null
  plataforma: string | null
  /** Razón social desde config de plataforma (empresa que compra). */
  empresa_compra_nombre: string | null
  /** Condición indicada por el operativo en la solicitud (ej. términos de pago / condición comercial). */
  condicion: string | null
  estado: EstadoOC
  fecha_en_plataforma: string | null
  fecha_recibido: string | null
  // Anticipo / proforma — seguimiento
  tiene_proforma: boolean | null
  proforma_path: string | null
  forma_pago: string | null
  // Cotización aprobada
  cotizacion_id: string | null
  proveedor_nombre: string | null
  aprobado_por_nombre: string | null
  valor_aprobado: number | null
  valor_antes_iva: number | null
  valor_iva: number | null
  // Orden de compra
  orden_id: string | null
  numero_oc: string | null
  // Factura
  factura_id: string | null
  factura_estado: EstadoFactura | null
  numero_factura: string | null
  valor_factura: number | null
  fecha_factura: string | null
  /** Notas abiertas durante el ciclo de compra (anticipo/proforma, antes de validar factura). */
  observaciones_seguimiento: string | null
  seguimiento_updated_at: string | null
}

export interface Factura {
  id: string
  solicitud_id: string
  cotizacion_id: string
  orden_id: string | null
  numero_factura: string | null
  valor_factura: number | null
  fecha_factura: string | null
  nit_proveedor: string | null
  nombre_proveedor: string | null
  fecha_recibida_factura: string | null
  aval_compra: string | null
  fecha_confirmada_entrega: string | null
  valor_aprobado_oc: number | null
  pdf_path: string | null
  extraccion_automatica: boolean
  estado: EstadoFactura
  observaciones: string | null
  registrado_por_id: number | null
  created_at: string
  updated_at: string
}

/** Cotizaciones de la solicitud — listado lectura para Financiero. */
export interface CotizacionFinancieroLista {
  id: string
  solicitud_id: string
  proveedor_nombre: string
  proveedor_nit: string | null
  numero_cotizacion_proveedor: string | null
  aprobada: boolean | null
  valor_total: number
  valor_aprobado: number | null
  tiene_adjunto: boolean
  created_at: string
}

export interface ValidacionFactura {
  id: string
  factura_id: string
  campo: string
  valor_esperado: string | null
  valor_encontrado: string | null
  cumple: boolean
  observacion: string | null
  created_at: string
}

export interface FacturaUpdate {
  numero_factura?: string
  valor_factura?: number
  fecha_factura?: string
  nit_proveedor?: string
  nombre_proveedor?: string
  fecha_recibida_factura?: string
  aval_compra?: string
  fecha_confirmada_entrega?: string
  estado?: EstadoFactura
  observaciones?: string
}

// ── Configuración financiera ──────────────────────────────────────────────────

export interface TipoGasto {
  id: number
  nombre: string
  activo: boolean
}

export interface CuentaContable {
  id: number
  numero_cuenta: string
  nombre_cuenta: string
  tipo_gasto_id: number | null
  tipo_gasto_nombre: string | null
  activo: boolean
}

export interface FacturaCuenta {
  id: number
  factura_id: string
  cuenta_id: number
  numero_cuenta: string
  nombre_cuenta: string
  tipo_gasto_nombre: string | null
}

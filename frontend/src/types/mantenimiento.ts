// Enums
export type EstadoMantenimiento =
  | "solicitud"
  | "evaluacion"
  | "programado"
  | "ejecucion"
  | "completado"
  | "cerrado"
  | "cancelado"

export type ClasificacionMantenimiento = "preventivo" | "correctivo"
export type ModalidadMantenimiento = "interno" | "externo"

// Modelo principal
export interface SolicitudMantenimiento {
  id:                          number
  consecutivo:                 string
  titulo:                      string
  descripcion:                 string
  tipo_mantenimiento:          string
  clasificacion:               ClasificacionMantenimiento
  modalidad:                   ModalidadMantenimiento
  fecha_proxima_mantenimiento: string | null
  estado:                      EstadoMantenimiento
  fecha_programada:            string | null
  notas_evaluacion:            string | null
  solicitante_id:              number
  solicitante_nombre:          string | null
  asignado_id:                 number | null
  asignado_nombre:             string | null
  empresa_nombre:              string | null
  created_at:                  string
  updated_at:                  string
}

export interface SolicitudesMantenimientoListResponse {
  items:  SolicitudMantenimiento[]
  total:  number
  page:   number
  pages:  number
}

export interface TipoMantenimientoConfig {
  id:     number
  nombre: string
  activo: boolean
  orden:  number
}

export interface HistorialMantenimientoEntrada {
  id:              number
  estado_anterior: EstadoMantenimiento | null
  estado_nuevo:    EstadoMantenimiento
  nota:            string | null
  usuario_id:      number
  usuario_nombre:  string
  fecha:           string
}

export interface OCVinculada {
  id:              string
  consecutivo_os:  string
  descripcion:     string
  estado:          string
  nivel_prioridad: string
  fecha_solicitud: string
}

// Payloads
export interface CrearMantenimientoPayload {
  titulo:                      string
  descripcion:                 string
  tipo_mantenimiento:          string
  clasificacion:               ClasificacionMantenimiento
  modalidad:                   ModalidadMantenimiento
  fecha_proxima_mantenimiento: string | null
}

export interface CambiarEstadoMantenimientoPayload {
  estado_nuevo: EstadoMantenimiento
  nota?:        string
}

export interface CrearOCVinculadaPayload {
  descripcion:               string
  categoria?:                string
  grupo_articulos?:          string
  nivel_prioridad:           string
  sede?:                     string
  observaciones_solicitante?: string
}

export interface MantenimientoFilters {
  estado?:        EstadoMantenimiento | ""
  clasificacion?: ClasificacionMantenimiento | ""
  modalidad?:     ModalidadMantenimiento | ""
  q?:             string
}

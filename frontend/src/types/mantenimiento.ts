// Enums
export type EstadoMantenimiento =
  | "solicitud" | "programado" | "ejecucion" | "completado" | "cancelado"
  | "evaluacion" | "cerrado"  // legacy — migrados en BD

export type ClasificacionMantenimiento = "preventivo" | "correctivo"
export type ModalidadMantenimiento     = "interno" | "externo"
export type OrigenMantenimiento        = "intranet" | "qr" | "whatsapp" | "telefonico_retroactivo"
export type PrioridadMantenimiento     = "baja" | "media" | "alta" | "urgente"

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
  // Campos Fase 1
  origen:              OrigenMantenimiento
  prioridad:           PrioridadMantenimiento
  monto_estimado:      number | null
  monto_real:          number | null
  evidencia_url:       string | null
  activo_qr_id:        number | null
  requiere_aprobacion: boolean
  aprobaciones_count:  number
  created_at:          string
  updated_at:          string
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

export interface Aprobacion {
  id:               number
  solicitud_id:     number
  aprobador_nombre: string
  rol_aprobador:    "dir_administrativa" | "gerencia_operaciones" | "gerencia_general"
  aprobado:         boolean
  nota:             string | null
  fecha:            string
}

export interface MobileOut {
  solicitud_id:       number
  consecutivo:        string
  titulo:             string
  descripcion:        string
  estado:             string
  asignado_nombre:    string | null
  solicitante_nombre: string | null
}

export interface MobileSolicitudResumen {
  solicitud_id:     number
  consecutivo:      string
  titulo:           string
  estado:           string
  prioridad:        string
  fecha_programada: string | null
}

export interface MobileHubOut {
  auxiliar_nombre: string | null
  ancla_id:        number
  activas:         MobileSolicitudResumen[]
  recientes:       MobileSolicitudResumen[]
}

export interface MobileDetalleOut extends MobileOut {
  prioridad:          string
  tipo_mantenimiento: string
  fecha_programada:   string | null
  monto_estimado:     number | null
  evidencia_url:      string | null
  ocs:                OCVinculada[]
}

export interface CrearOCMobilePayload {
  descripcion:               string
  categoria?:                string
  nivel_prioridad:           string
  observaciones_solicitante?: string
}

export interface KpisMes {
  total:            number
  cerradas:         number
  en_curso:         number
  canceladas:       number
  informales:       number
  gasto_total:      number
  gasto_preventivo: number
  gasto_correctivo: number
  gasto_interno:    number
  gasto_externo:    number
}

export interface KpisOut {
  mes_actual:            KpisMes
  por_origen:            Record<string, number>
  pendientes_aprobacion: number
}

export interface AccesoMovilOut {
  url_portal:          string | null
  url_qr:              string
  url_jwt?:            string | null
  whatsapp_numero:     string | null
  mensaje_whatsapp:    string
  expira?:             boolean
}

export interface PortalSession {
  user_id:           number
  full_name:         string
  email:             string
  role:              string
  app_permissions:   string[]
  url_portal:        string
  can_manage:        boolean
  can_operate:       boolean
  can_approve:       boolean
  can_see_tablero:   boolean
  is_auxiliar:       boolean
}

export interface AuxiliarPortalOut {
  user_id:      number
  full_name:    string
  email:        string
  url_portal:   string
  portal_token: string
}

export interface MntNotificacionesConfig {
  whatsapp_numero_default: string
}

// Payloads
export interface CrearMantenimientoPayload {
  titulo:                      string
  descripcion:                 string
  tipo_mantenimiento:          string
  clasificacion:               ClasificacionMantenimiento
  modalidad:                   ModalidadMantenimiento
  fecha_proxima_mantenimiento: string | null
  origen?:                     OrigenMantenimiento
  prioridad?:                  PrioridadMantenimiento
  monto_estimado?:             number | null
  activo_qr_id?:               number | null
}

export interface CrearRetroactivoPayload {
  titulo:             string
  descripcion:        string
  tipo_mantenimiento: string
  clasificacion:      ClasificacionMantenimiento
  modalidad:          ModalidadMantenimiento
  nota_cierre:        string
  monto_real?:        number | null
  evidencia_url?:     string | null
  asignado_id?:       number | null
}

export interface SubirEvidenciaPayload {
  evidencia_url: string
  monto_real?:   number | null
  nota?:         string
}

export interface AprobacionPayload {
  rol_aprobador: "dir_administrativa" | "gerencia_operaciones" | "gerencia_general"
  nota?:         string
}

export interface CambiarEstadoMantenimientoPayload {
  estado_nuevo: EstadoMantenimiento
  nota?:        string
}

export interface CrearOCVinculadaPayload {
  descripcion:                string
  categoria?:                 string
  grupo_articulos?:           string
  nivel_prioridad:            string
  sede?:                      string
  observaciones_solicitante?: string
}

export interface MantenimientoFilters {
  estado?:        EstadoMantenimiento | ""
  clasificacion?: ClasificacionMantenimiento | ""
  modalidad?:     ModalidadMantenimiento | ""
  q?:             string
}

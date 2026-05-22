// Helix Zymo — shared TypeScript types

export type HelixEstado = "Backlog" | "Planificado" | "En curso" | "Revision" | "Terminado"
export type HelixPrioridad = "Alta" | "Media" | "Baja"

export interface HelixSubproyecto {
  id: number
  nombre: string
  objetivo?: string
  cliente?: string
  inversionEst: number
  retornoEsp: number
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface HelixComentario {
  id: number
  actividadId: number
  autorId: number
  autorNombre: string
  texto: string
  canal: "web" | "whatsapp"
  createdAt: string
}

export interface HelixEvidencia {
  id: number
  actividadId: number
  nombre: string
  tipoArchivo: string
  tamanio: number
  ruta: string
  createdAt: string
}

export interface HelixActividad {
  id: number
  subproyectoId: number
  responsableId: number
  responsableNombre: string
  responsableInitials: string
  responsableColor: string
  nombre: string
  estado: HelixEstado
  prioridad: HelixPrioridad
  fechaInicio: string
  fechaFin: string
  avance: number
  puntos: number
  costoInversion: number
  costoOptimizacion: number
  costoEjecucion: number
  bloqueada: boolean
  dependenciaId?: number
  completadaEn?: string
  comentarios?: HelixComentario[]
  evidencias?: HelixEvidencia[]
  createdAt: string
  updatedAt: string
}

export interface HelixROI {
  id: number
  nombre: string
  inversionEst: number
  retornoEsp: number
  roi: number
  margen: number
  clasificacion: "Alto potencial" | "Potencial favorable" | "Retorno controlado" | "Revisar alcance"
  totalActividades: number
  avancePromedio: number
  actividadesTerminadas: number
}

export interface HelixUsuario {
  id: number
  full_name: string
  email: string
  initials?: string
  color?: string
}

export interface HelixEncuesta {
  id: number
  nombre: string
  rol: string
  satisfaccion: number
  facilidad: number
  utilidad: number
  nps: number
  comentario?: string
  createdAt: string
}

export interface HelixAlerta {
  id: number
  subproyectoId: number
  cambio: string
  actividadId?: number
  actividadNombre?: string
  destinatarios: string[]
  createdAt: string
}

// Form types
export type HelixActividadForm = Omit<HelixActividad, "id" | "createdAt" | "updatedAt" | "comentarios" | "evidencias">
export type HelixSubproyectoForm = Omit<HelixSubproyecto, "id" | "activo" | "createdAt" | "updatedAt">

// Dashboard types
export interface HelixDashboardMetricas {
  total: number
  completadas: number
  enProgreso: number
  vencidas: number
  bloqueadas: number
  puntosTotal: number
  puntosCompletados: number
  avanceGlobal: number
}

export interface HelixEstadoCount {
  estado: string
  count: number
}

export interface HelixProximoHito {
  id: number
  nombre: string
  responsableNombre: string
  fechaFin: string
  avance: number
  subproyectoNombre: string
  diasRestantes: number
}

export interface HelixActividadBloqueada {
  id: number
  nombre: string
  responsableNombre: string
  responsableInitials: string
  responsableColor: string
  subproyectoNombre: string
  avance: number
  fechaFin: string
}

export interface HelixCargaResponsable {
  responsableId: number
  responsableNombre: string
  responsableInitials: string
  responsableColor: string
  total: number
  completadas: number
  enProgreso: number
  avancePromedio: number
}

export interface HelixInsignia {
  tipo: "cumplimiento" | "velocidad" | "calidad" | "colaboracion"
  titulo: string
  descripcion: string
  valor: number
  obtenida: boolean
}

export interface HelixEstadisticasResponsable {
  responsableId: number
  responsableNombre: string
  total: number
  completadas: number
  avancePromedio: number
  puntosCompletados: number
}

export interface HelixDashboardData {
  metricas: HelixDashboardMetricas
  distribucionEstados: HelixEstadoCount[]
  proximosHitos: HelixProximoHito[]
  bloqueadas: HelixActividadBloqueada[]
  cargaPorResponsable: HelixCargaResponsable[]
  insignias: HelixInsignia[]
  estadisticasPorResponsable: HelixEstadisticasResponsable[]
}

export interface HelixFlujoSubproyecto {
  id: number
  nombre: string
  actividades: Array<{
    id: number
    nombre: string
    estado: string
    avance: number
    responsableNombre: string
  }>
}

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

// Form types
export type HelixActividadForm = Omit<HelixActividad, "id" | "createdAt" | "updatedAt" | "comentarios" | "evidencias">
export type HelixSubproyectoForm = Omit<HelixSubproyecto, "id" | "activo" | "createdAt" | "updatedAt">

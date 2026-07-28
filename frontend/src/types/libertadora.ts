export type LibProducto = "CREA PATRIMONIO PJ" | "CREA PATRIMONIO PN" | "CREA AHORRO" | "ARL COLMENA" | "PORTAFOLIO"
export type LibEstadoProspecto = "CERRADO" | "INTERESADO" | "EN_PROCESO" | "NO_INTERESADO" | "CERRADO_NEG"
export type LibPrioridad = "ALTA" | "MEDIA" | "BAJA"
export type LibTrimestre = "Q1" | "Q2" | "Q3" | "Q4"
export type LibModalidad = "Presencial" | "Microsoft Teams" | "Zoom" | "WhatsApp" | "Telefónica"
export type LibEstadoCita = "pending" | "confirmed" | "cancelled"

export interface LibProspecto {
  id: number
  empresa: string
  producto: LibProducto
  gestion: string | null
  estado: LibEstadoProspecto
  monto: number
  prioridad: LibPrioridad
  accion: string | null
  fecha: string | null
  trimestre: LibTrimestre | null
  tipo: "PJ" | "PN" | null
  createdAt: string
  updatedAt: string
}

export type LibProspectoInput = Omit<LibProspecto, "id" | "createdAt" | "updatedAt">

export interface LibCita {
  id: number
  cliente: string
  fecha: string
  hora: string
  modalidad: LibModalidad
  producto: string
  estado: LibEstadoCita
  notas: string | null
  createdAt: string
  updatedAt: string
}

export type LibCitaInput = Omit<LibCita, "id" | "createdAt" | "updatedAt">

export interface LibMeta {
  id: number
  metaMensual: number | null
  metaAnual: number | null
  metaCierres: number | null
  metaCitas: number | null
  updatedAt?: string
}

// Ported 1:1 de kpis() en app.js del prototipo original — mismas 8 métricas.
export interface LibKpis {
  tot: number
  ci: number
  ii: number
  ep: number
  ni: number
  mo: number
  po: number
  conv: number
}

export interface LibPartnerUser {
  id: string
  email: string
  nombre: string | null
  active: boolean
  createdAt: string
  lastLoginAt: string | null
}

export const LIB_PRODUCTOS: LibProducto[] = ["CREA PATRIMONIO PJ", "CREA PATRIMONIO PN", "CREA AHORRO", "ARL COLMENA", "PORTAFOLIO"]
export const LIB_ESTADOS: { value: LibEstadoProspecto; label: string }[] = [
  { value: "CERRADO", label: "Cerrado" },
  { value: "INTERESADO", label: "Interesado" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "NO_INTERESADO", label: "No interesado" },
  { value: "CERRADO_NEG", label: "Sin éxito" },
]
export const LIB_PRIORIDADES: LibPrioridad[] = ["ALTA", "MEDIA", "BAJA"]

// Constantes de dominio del módulo T&C — fuente única de verdad.
// Importar desde aquí en lugar de hardcodear strings en componentes.

export const TC_ESTADOS        = ["Activo", "Inactivo"] as const
export const TC_GENEROS        = ["Masculino", "Femenino", "Otro"] as const
export const TC_CONTRATOS      = [
  "Término indefinido",
  "Término fijo",
  "Obra o labor",
  "Aprendizaje SENA",
  "Prestación de servicios",
] as const
export const TC_SALIDAS        = [
  "Renuncia voluntaria",
  "Terminación con justa causa",
  "Terminación sin justa causa",
  "Vencimiento de contrato",
  "Mutuo acuerdo",
] as const
export const TC_CAP_ESTADOS    = ["Completado", "Pendiente", "Cancelado"] as const
export const TC_SANCION_TIPOS  = [
  "Llamado de atención",
  "Amonestación escrita",
  "Sanción disciplinaria",
  "Suspensión",
] as const

export const TC_NOVEDAD_TIPOS  = [
  "Incapacidad médica",
  "Incapacidad laboral",
  "Permiso remunerado",
  "Permiso no remunerado",
  "Licencia de maternidad",
  "Licencia de paternidad",
  "Ausencia injustificada",
  "Calamidad doméstica",
  "Otro",
] as const

export const TC_NOVEDAD_ESTADOS = ["Pendiente", "Aprobado", "Rechazado"] as const

// Paleta de colores para empresas/sedes — se asigna por índice de llegada.
// Agrega entradas si el grupo ZYMO crece más de 5 sedes.
export const TC_EMPRESA_PALETTE = [
  { badge: "bg-blue-500/10 text-blue-400",    text: "text-blue-400"    },
  { badge: "bg-violet-500/10 text-violet-400", text: "text-violet-400"  },
  { badge: "bg-amber-500/10 text-amber-500",   text: "text-amber-500"   },
  { badge: "bg-emerald-500/10 text-emerald-400", text: "text-emerald-400" },
  { badge: "bg-rose-500/10 text-rose-400",     text: "text-rose-400"    },
] as const

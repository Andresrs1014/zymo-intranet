// Única fuente de verdad para estos dos catálogos en el frontend de Helix —
// evita repetir el mismo array a mano en cada diálogo (TaskDialog, WorkPlanDialog...).
export const HELIX_ESTADOS = ["Backlog", "Planificado", "En curso", "Revision", "Terminado"] as const
export const HELIX_PRIORIDADES = ["Alta", "Media", "Baja"] as const

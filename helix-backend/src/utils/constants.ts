export const COLUMNS = ["Backlog", "Planificado", "En curso", "Revision", "Terminado"] as const;
export const PRIORITIES = ["Alta", "Media", "Baja"] as const;
export const STATUSES = COLUMNS;

export type Column = typeof COLUMNS[number];
export type Priority = typeof PRIORITIES[number];

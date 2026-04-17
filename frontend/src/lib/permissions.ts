// Single source of truth for role-based access control
// All route guards and sidebar visibility should import from here.

// ── OC Automatizaciones ───────────────────────────────────────────────────────

export const ROLES_OC_VIEWER = new Set(["admin", "administrativo", "directivo", "compras"])
export const ROLES_OC_APPROVER = new Set(["admin", "administrativo", "directivo"])
export const ROLES_OC_CONFIG = new Set(["admin"])

export function canSeeOC(role: string, area?: string | null): boolean {
  return ROLES_OC_VIEWER.has(role) || area === "Compras"
}

export function canApproveOC(role: string): boolean {
  return ROLES_OC_APPROVER.has(role)
}

export function canConfigureOC(role: string): boolean {
  return ROLES_OC_CONFIG.has(role)
}

// ── Operativo ─────────────────────────────────────────────────────────────────
// Gate principal: área "Operaciones". Los roles operativo/operaciones están en el
// set pero se asignan manualmente — no hay seed automático.

export const ROLES_OPERATIVO = new Set(["admin", "operativo", "operaciones"])

export function canSeeOperativo(role: string, area?: string | null): boolean {
  return area === "Operaciones" || ROLES_OPERATIVO.has(role)
}

// ── SGC — Sistema de Gestión de Calidad ───────────────────────────────────────
// Cualquier rol que el admin nombre "calidad" o área "Gestión de Calidad"
// tiene acceso. Se puede ampliar desde el panel de admin sin cambiar código.

export const ROLES_SGC = new Set(["admin", "calidad"])

export function canSeeSGC(role: string, area?: string | null): boolean {
  return ROLES_SGC.has(role) || area === "Gestión de Calidad"
}

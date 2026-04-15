// Single source of truth for role-based access control
// All route guards and sidebar visibility should import from here.

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

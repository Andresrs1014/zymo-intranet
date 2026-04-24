// Control de acceso basado en roles.
// Cada función acepta opcionalmente `appPerms` (role.app_permissions de la BD)
// como override dinámico; los Sets hardcoded son el fallback por defecto.

// ── OC Automatizaciones ───────────────────────────────────────────────────────

const ROLES_OC_VIEWER  = new Set(["admin", "administrativo", "directivo", "compras"])
const ROLES_OC_APPROVER = new Set(["admin", "administrativo", "directivo"])
const ROLES_OC_CONFIG   = new Set(["admin"])

export function canSeeOC(role: string, area?: string | null, appPerms?: string[]): boolean {
  return ROLES_OC_VIEWER.has(role) || area === "Compras" || appPerms?.includes("mod_oc_ver") === true
}

export function canApproveOC(role: string, appPerms?: string[]): boolean {
  return ROLES_OC_APPROVER.has(role) || appPerms?.includes("mod_oc_aprobar") === true
}

export function canConfigureOC(role: string, appPerms?: string[]): boolean {
  return ROLES_OC_CONFIG.has(role) || appPerms?.includes("mod_oc_config") === true
}

// ── Módulo Operativo ──────────────────────────────────────────────────────────

const ROLES_OPERATIVO = new Set(["admin", "operativo", "operaciones"])

export function canSeeOperativo(role: string, area?: string | null, appPerms?: string[]): boolean {
  return ROLES_OPERATIVO.has(role) || area === "Operaciones" || appPerms?.includes("mod_operativo") === true
}

// ── SGC — Sistema de Gestión de Calidad ───────────────────────────────────────

const ROLES_SGC = new Set(["admin", "calidad"])

export function canSeeSGC(role: string, area?: string | null, appPerms?: string[]): boolean {
  return ROLES_SGC.has(role) || area === "Gestión de Calidad" || appPerms?.includes("mod_sgc") === true
}

// ── Financiero ────────────────────────────────────────────────────────────────

const ROLES_FINANCIERO = new Set(["admin", "financiero"])

export function canSeeFinanciero(role: string, area?: string | null, appPerms?: string[]): boolean {
  return ROLES_FINANCIERO.has(role) || area === "contabilidad" || appPerms?.includes("mod_financiero") === true
}

// ── Gerencial ─────────────────────────────────────────────────────────────────

const ROLES_GERENCIAL = new Set(["admin", "gerente"])

export function canSeeGerencial(role: string, appPerms?: string[]): boolean {
  return ROLES_GERENCIAL.has(role) || appPerms?.includes("mod_gerencial") === true
}

// Acceso por permisos del rol (`app_permissions` desde /auth/me) + admin.
// Compatibilidad: áreas históricas (Compras, Operaciones, etc.) hasta migrar todo a la BD.

function hasPerm(appPerms: string[] | undefined, id: string): boolean {
  return appPerms?.includes(id) === true
}

export function canSeeOC(role: string, area?: string | null, appPerms?: string[]): boolean {
  if (role === "admin") return true
  if (hasPerm(appPerms, "mod_oc_ver")) return true
  if (hasPerm(appPerms, "mod_oc_config")) return true
  if (area === "Compras") return true
  return false
}

export function canApproveOC(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_oc_aprobar")
}

export function canConfigureOC(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_oc_config")
}

export function canSeeOperativo(role: string, area?: string | null, appPerms?: string[]): boolean {
  if (role === "admin") return true
  if (hasPerm(appPerms, "mod_operativo")) return true
  if (area === "Operaciones") return true
  return false
}

export function canSeeSGC(role: string, area?: string | null, appPerms?: string[]): boolean {
  if (role === "admin") return true
  if (hasPerm(appPerms, "mod_sgc")) return true
  if (area === "Gestión de Calidad") return true
  return false
}

export function canSeeFinanciero(role: string, area?: string | null, appPerms?: string[]): boolean {
  if (role === "admin") return true
  if (hasPerm(appPerms, "mod_financiero")) return true
  if (area === "contabilidad") return true
  return false
}

export function canSeeGerencial(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_gerencial")
}

export function canSeeIT(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_it")
}

export function canSeeSIG(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_sig")
}

/** Agente flotante estilo compras (no ZYMO): quien ve OC puede usarlo. */
export function canUseAgenteAdministrativo(
  role: string,
  area?: string | null,
  appPerms?: string[],
): boolean {
  if (role === "admin") return true
  return canSeeOC(role, area, appPerms)
}

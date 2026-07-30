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
  // Líder con permiso de Agenda (capacitaciones) entra a Operativo aunque no tenga mod_operativo.
  if (canUseAgenda(role, appPerms)) return true
  return false
}

export function canSeeOperClientes(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_oper_clientes")
}

export function canSeeGestionTickets(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_operativo_tickets")
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

export function canSeeExtraccionIA(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_extraccion_ia")
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

/** Panel de IA (gerencial ZYMO o agente administrativo / OC). */
export function canUseAgentePanel(
  role: string,
  area?: string | null,
  appPerms?: string[],
): boolean {
  return canSeeGerencial(role, appPerms) || canUseAgenteAdministrativo(role, area, appPerms)
}

// ── Herramientas de usuario ────────────────────────────────────────────────────

export function hasUserTool(userTools: string[] | undefined, key: string): boolean {
  return userTools?.includes(key) === true
}

/**
 * Puede registrar tareas si tiene tool_task_submit_dev.
 */
export function canSubmitDevTasks(userTools: string[]): boolean {
  return userTools.includes("tool_task_submit_dev")
}

/**
 * Puede gestionar si tiene tool_task_manage_dev.
 */
export function canManageDevTasks(userTools: string[]): boolean {
  return userTools.includes("tool_task_manage_dev")
}

/**
 * Puede co-gestionar si es co_gestor en al menos un equipo.
 * Se determina verificando los miembros del equipo que retorna el backend.
 */
export function isCoGestor(members: Array<{ user_id: number; role: string }>, userId: number): boolean {
  return members.some((m) => m.user_id === userId && m.role === "co_gestor")
}

export function canSeeHelix(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_helix")
}

export function canSeeLibertadora(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_libertadora")
}

export function canSeeTickets(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tickets")
}

export function canConfigTickets(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tickets_config")
}

export function canSeeSAC(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_sac")
}

export function canConfigSAC(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_sac_config")
}

export function canSeeTyC(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tc")
}

export function canEditTyC(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tc_editar")
}

export function canSeeTyCSensible(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tc_sensible")
}

export function canImportTyC(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tc_importar")
}

export function canConfigTyC(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return canEditTyC(role, appPerms) || canSeeTyCSensible(role, appPerms)
}

// Independiente de mod_tc — un líder de área puede no tener acceso al resto de T&C.
export function canUseAgenda(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tc_agenda")
}

// Permiso adicional sobre T&C completo — a diferencia de mod_tc_agenda (líderes,
// independiente de T&C), este solo tiene sentido para coordinador con T&C completo.
export function canUseCapCoordinador(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tc_cap_coordinador")
}

// Independiente de mod_tc — mismo patrón que mod_tc_agenda: el líder evalúa a
// su gente sin necesitar acceso al resto de T&C.
export function canUseEvaluacionesDesempeno(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tc_evaluaciones")
}

// Independiente de mod_tc — mismo patrón que mod_tc_agenda: el jefe aprueba
// permisos/novedades de su gente a cargo sin necesitar acceso al resto de T&C.
export function canUseAprobaciones(role: string, appPerms?: string[]): boolean {
  if (role === "admin") return true
  return hasPerm(appPerms, "mod_tc_aprobaciones")
}

// Reportes de Desarrollo — módulo exclusivo de admin (decisión definitiva,
// 2026-07-24). El backend también lo exige (sig-backend/routers/reportes-desarrollo.ts).
export function canSeeReportesDesarrollo(role: string, _appPerms?: string[]): boolean {
  return role === "admin"
}

export function canWriteReportesDesarrollo(role: string, _appPerms?: string[]): boolean {
  return role === "admin"
}

export function canSeeMantenimiento(
  role: string,
  appPerms?: string[]
): boolean {
  if (role === "admin") return true
  if (role === "directivo") return true
  if (role === "auxiliar_mantenimiento") return true
  return hasPerm(appPerms, "mod_mantenimiento")
}

/** Rutas /mantenimiento/* — equipo de mantenimiento o hub administrativo (OC). */
export function canAccessMantenimiento(
  role: string,
  area?: string | null,
  appPerms?: string[],
): boolean {
  return canSeeMantenimiento(role, appPerms) || canSeeOC(role, area, appPerms)
}

export function canManageMantenimiento(
  role: string,
  appPerms?: string[]
): boolean {
  if (role === "auxiliar_mantenimiento") return false
  if (role === "admin") return true
  if (hasPerm(appPerms, "mod_mantenimiento")) return true
  return false
}

/** Acciones de campo: en camino, evidencia, OC desde celular. */
export function canOperateMantenimientoCampo(
  role: string,
  appPerms?: string[],
): boolean {
  if (role === "auxiliar_mantenimiento") return true
  return canManageMantenimiento(role, appPerms)
}

/** Solo admin y directivo pueden ver todos — auxiliar ve los suyos */
export function canSeeAllMantenimientos(role: string): boolean {
  return role === "admin" || role === "directivo"
}

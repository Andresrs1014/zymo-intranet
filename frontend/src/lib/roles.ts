export interface AppDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: "modulo" | "app_externa"
  url?: string
}

// ── Módulos internos de la intranet ───────────────────────────────────────────
export const INTERNAL_MODULES: AppDefinition[] = [
  {
    id: "mod_oc_ver",
    category: "modulo",
    icon: "🏢",
    name: "OC — Ver solicitudes",
    description: "Acceso a solicitudes, cotizaciones y órdenes de compra",
  },
  {
    id: "mod_oc_aprobar",
    category: "modulo",
    icon: "✅",
    name: "OC — Aprobar cotizaciones",
    description: "Aprobar o rechazar cotizaciones de proveedores",
  },
  {
    id: "mod_oc_config",
    category: "modulo",
    icon: "⚙️",
    name: "OC — Configuración SMTP",
    description: "Configurar correos, plataformas y listas del formulario",
  },
  {
    id: "mod_operativo",
    category: "modulo",
    icon: "🚛",
    name: "Módulo Operativo",
    description: "Crear solicitudes de compra y consultar su estado",
  },
  {
    id: "mod_sgc",
    category: "modulo",
    icon: "📋",
    name: "SGC — Proveedores",
    description: "Gestión del catálogo de proveedores",
  },
  {
    id: "mod_financiero",
    category: "modulo",
    icon: "💰",
    name: "Módulo Financiero",
    description: "Gestión de facturas y validación contra la OC",
  },
  {
    id: "mod_it",
    category: "modulo",
    icon: "💻",
    name: "Módulo IT",
    description: "Herramientas del área de tecnología",
  },
  {
    id: "mod_sig",
    category: "modulo",
    icon: "🌐",
    name: "Módulo SIG",
    description: "Sistema Integrado de Gestión",
  },
]

// ── Aplicaciones externas ─────────────────────────────────────────────────────
export const EXTERNAL_APPS: AppDefinition[] = [
  {
    id: "matriz",
    category: "app_externa",
    icon: "📋",
    name: "Matriz",
    description: "Gestión de proyectos y priorización de tareas",
    url: "https://matriz.zymointranet.com",
  },
  {
    id: "crm",
    category: "app_externa",
    icon: "💼",
    name: "CRM Tarifas",
    description: "Gestión de clientes y tarifas comerciales",
    url: "https://crm.zymointranet.com",
  },
]

// Lista completa usada en RolesPage para mostrar todos los permisos configurables
export const ALL_APPS: AppDefinition[] = [...INTERNAL_MODULES, ...EXTERNAL_APPS]

// Apps externas visibles en el Dashboard según permisos del rol
export function getAppsForRole(role: string, permissions: string[]): AppDefinition[] {
  if (role === "admin") return EXTERNAL_APPS
  return EXTERNAL_APPS.filter((app) => permissions.includes(app.id))
}

export function getRoleLabel(role: string): string {
  return role
}

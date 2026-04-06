export interface AppDefinition {
  id: string
  name: string
  description: string
  url: string
  icon: string
}

export const ALL_APPS: AppDefinition[] = [
  {
    id: "matriz",
    name: "Matriz",
    description: "Gestión de proyectos y priorización de tareas",
    url: "https://matriz.zymointranet.com",
    icon: "📋",
  },
  {
    id: "crm",
    name: "CRM Tarifas",
    description: "Gestión de clientes y tarifas comerciales",
    url: "https://crm.zymointranet.com",
    icon: "💼",
  },
  {
    id: "oc",
    name: "OC Automatizaciones",
    description: "Automatización de órdenes de compra",
    url: "https://oc.zymointranet.com",
    icon: "⚡",
  },
  {
    id: "capacitaciones",
    name: "Portal Capacitaciones",
    description: "Programas de formación y desarrollo",
    url: "https://capacitaciones.zymointranet.com",
    icon: "🎓",
  },
]

// admin siempre ve todo. Para el resto, permissions viene del backend (role.app_permissions).
export function getAppsForRole(role: string, permissions: string[]): AppDefinition[] {
  if (role === "admin") return ALL_APPS
  return ALL_APPS.filter((app) => permissions.includes(app.id))
}

export function getRoleLabel(role: string): string {
  return role
}

import type { UserRole } from "@/types/auth"

export interface AppDefinition {
  id: string
  name: string
  description: string
  url: string
  icon: string           // emoji o identificador de ícono
  allowedRoles: UserRole[]
}

// "admin" siempre tiene acceso a todo — se aplica en getAppsForRole()
export const ALL_APPS: AppDefinition[] = [
  {
    id: "matriz",
    name: "Matriz",
    description: "Gestión de proyectos y priorización de tareas",
    url: "https://matriz.zymointranet.com",
    icon: "📋",
    allowedRoles: ["directivo", "talento_cultura", "comercial", "operativo", "empleado"],
  },
  {
    id: "crm",
    name: "CRM Tarifas",
    description: "Gestión de clientes y tarifas comerciales",
    url: "https://crm.zymointranet.com",
    icon: "💼",
    allowedRoles: ["comercial"],
  },
  {
    id: "oc",
    name: "OC Automatizaciones",
    description: "Automatización de órdenes de compra",
    url: "https://oc.zymointranet.com",
    icon: "⚡",
    allowedRoles: ["talento_cultura"],
  },
  {
    id: "capacitaciones",
    name: "Portal Capacitaciones",
    description: "Programas de formación y desarrollo",
    url: "https://capacitaciones.zymointranet.com",
    icon: "🎓",
    allowedRoles: ["talento_cultura"],
  },
]

export function getAppsForRole(role: UserRole): AppDefinition[] {
  if (role === "admin") return ALL_APPS
  return ALL_APPS.filter((app) => app.allowedRoles.includes(role))
}

export const ROLE_LABELS: Record<string, string> = {
  admin:          "Administrador",
  directivo:      "Directivo",
  talento_cultura:"Talento y Cultura",
  comercial:      "Comercial",
  operativo:      "Operativo",
  empleado:       "Empleado",
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

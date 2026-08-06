export interface AppDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: "modulo" | "app_externa"
  url?: string
  /** Endpoint de la intranet que emite un sso_token de corta duración para esta app */
  sso_endpoint?: string
}

/**
 * Permisos de módulo (`app_permissions` en PostgreSQL `role`).
 * Se asignan en /admin/configuracion/roles.
 *
 * Acceso granular por usuario (ej. Gestión de Tareas) usa `user_tools`
 * en AdminPage → Herramientas, no este catálogo.
 */
export interface ModulePermissionGroup {
  title: string
  subtitle: string
  modules: AppDefinition[]
}

export const INTERNAL_MODULE_GROUPS: ModulePermissionGroup[] = [
  {
    title: "Órdenes de compra",
    subtitle: "Solicitudes, aprobaciones y configuración OC",
    modules: [
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
    ],
  },
  {
    title: "Operativo",
    subtitle: "Compras operativas y cartera de clientes",
    modules: [
      {
        id: "mod_operativo",
        category: "modulo",
        icon: "🚛",
        name: "Módulo Operativo",
        description: "Crear solicitudes de compra y consultar su estado",
      },
      {
        id: "mod_oper_clientes",
        category: "modulo",
        icon: "🏢",
        name: "Operativo — Cartera de clientes",
        description: "Importar clientes corporativos y asignar analistas por sede",
      },
      {
        id: "mod_operativo_tickets",
        category: "modulo",
        icon: "🎫",
        name: "Operativo — Gestionar mis tickets",
        description: "Gestionar los tickets de ZymoAlly asignados como supervisor, analista o coordinador",
      },
    ],
  },
  {
    title: "Talento y Cultura (T&C)",
    subtitle: "Directorio, organigrama, formación e indicadores",
    modules: [
      {
        id: "mod_tc",
        category: "modulo",
        icon: "👥",
        name: "T&C — Ver módulo",
        description: "Directorio, organigrama, manuales y clientes (lectura)",
      },
      {
        id: "mod_tc_editar",
        category: "modulo",
        icon: "✏️",
        name: "T&C — Editar",
        description: "Crear y editar personas, cargos y configuración operativa",
      },
      {
        id: "mod_tc_sensible",
        category: "modulo",
        icon: "🔒",
        name: "T&C — Datos sensibles",
        description: "Evaluaciones, sanciones, novedades e indicadores KPI",
      },
      {
        id: "mod_tc_importar",
        category: "modulo",
        icon: "📥",
        name: "T&C — Importar directorio",
        description: "Importación masiva JSON del directorio legacy",
      },
      {
        id: "mod_tc_cap_coordinador",
        category: "modulo",
        icon: "🎓",
        name: "T&C — Coordinador de capacitación (nuevo personal)",
        description: "Agendar inducciones/reinducciones de nuevo personal con varios líderes por día. Requiere T&C completo (mod_tc + mod_tc_editar) además de este permiso",
      },
    ],
  },
  {
    title: "Capacitaciones (Agenda)",
    subtitle: "Independiente de T&C — aparece dentro de Operativo para el líder, y dentro de T&C para quien ya tiene acceso completo",
    modules: [
      {
        id: "mod_tc_agenda",
        category: "modulo",
        icon: "📅",
        name: "Capacitaciones — Líder de área",
        description: "Agendar inducciones para el área propia, elegir asistentes y marcar asistencia. Accede desde Operativo → Capacitaciones",
      },
    ],
  },
  {
    title: "Evaluación de Desempeño",
    subtitle: "Independiente de T&C — aparece dentro de Operativo para el líder, y dentro de T&C para quien ya tiene acceso completo",
    modules: [
      {
        id: "mod_tc_evaluaciones",
        category: "modulo",
        icon: "📝",
        name: "Evaluación de desempeño — Líder de área",
        description: "Evaluar el desempeño semestral de los colaboradores del área propia. La rúbrica (Líderes u Operativo) se resuelve sola según si la persona tiene gente a cargo",
      },
    ],
  },
  {
    title: "Aprobaciones (Formatos digitales)",
    subtitle: "Independiente de T&C — aparece dentro de Operativo para el jefe, y dentro de T&C para quien ya tiene acceso completo",
    modules: [
      {
        id: "mod_tc_aprobaciones",
        category: "modulo",
        icon: "✅",
        name: "Aprobaciones — Jefe directo",
        description: "Aceptar o rechazar permisos/novedades enviados por formato digital (Formato de Ausentismo) por la gente a cargo propia. Al aprobar se carga la firma del jefe y se avisa por correo a T&C",
      },
    ],
  },
  {
    title: "ZymoAlly — Tickets (PQR)",
    subtitle: "Gestión de tickets y maestros del formulario",
    modules: [
      {
        id: "mod_tickets",
        category: "modulo",
        icon: "🎫",
        name: "Tickets — Ver y operar",
        description: "Acceso al módulo de tickets PQR",
      },
      {
        id: "mod_tickets_config",
        category: "modulo",
        icon: "⚙️",
        name: "Tickets — Configurar listas",
        description: "Editar maestros del formulario y sincronizar datos del directorio",
      },
      {
        id: "mod_tickets_gerencia",
        category: "modulo",
        icon: "📊",
        name: "Tickets — Vista gerencial (todos + score)",
        description: "Ver TODOS los tickets con su score de gestión (estilo OP.GG) y validar/cerrar los que estén pendientes de validación, en Operativo → Gestionar tickets",
      },
    ],
  },
  {
    title: "ZymoAlly — SAC",
    subtitle: "Servicio al cliente, encuestas y experiencia",
    modules: [
      {
        id: "mod_sac",
        category: "modulo",
        icon: "💬",
        name: "SAC — Ver módulo",
        description: "Acceso al dominio SAC en ZymoAlly",
      },
      {
        id: "mod_sac_config",
        category: "modulo",
        icon: "⚙️",
        name: "SAC — Configurar formularios",
        description: "Editar listas de opciones de encuestas y visitas",
      },
    ],
  },
  {
    title: "Otros módulos",
    subtitle: "Calidad, finanzas, gerencia, mantenimiento e IA",
    modules: [
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
        id: "mod_gerencial",
        category: "modulo",
        icon: "📊",
        name: "Módulo Gerencial",
        description: "Panel gerencial, tareas y reportes del agente ZYMO",
      },
      {
        id: "mod_mantenimiento",
        category: "modulo",
        icon: "🔧",
        name: "Mantenimiento",
        description: "Solicitudes de mantenimiento, tablero y operación de campo",
      },
      {
        id: "mod_sig",
        category: "modulo",
        icon: "🌐",
        name: "Módulo SIG",
        description: "Sistema Integrado de Gestión — procedimientos e instructivos",
      },
      {
        id: "mod_helix",
        category: "modulo",
        icon: "🧬",
        name: "Helix Zymo",
        description: "Tablero de planeación de proyectos y actividades del equipo",
      },
      {
        id: "mod_extraccion_ia",
        category: "modulo",
        icon: "🤖",
        name: "Motor IA — Extracción",
        description: "Panel de revisión de candidatos, sinónimos y métricas del motor",
      },
      {
        id: "mod_it",
        category: "modulo",
        icon: "💻",
        name: "Módulo IT",
        description: "Reservado — sin pantalla en la intranet aún",
      },
    ],
  },
]

/** Lista plana para badges y búsqueda por id */
export const INTERNAL_MODULES: AppDefinition[] = INTERNAL_MODULE_GROUPS.flatMap(
  (g) => g.modules,
)

// ── Aplicaciones externas ─────────────────────────────────────────────────────
export const EXTERNAL_APPS: AppDefinition[] = [
  {
    id: "brp",
    category: "app_externa",
    icon: "🚢",
    name: "BRP",
    description: "Portal BRP",
    url: "https://brp.zymointranet.com",
  },
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
    sso_endpoint: "/api/auth/sso-token-crm",
  },
]

export const ALL_APPS: AppDefinition[] = [...INTERNAL_MODULES, ...EXTERNAL_APPS]

export function getAppsForRole(role: string, permissions: string[]): AppDefinition[] {
  if (role === "admin") return EXTERNAL_APPS
  return EXTERNAL_APPS.filter((app) => permissions.includes(app.id))
}

export function getRoleLabel(role: string): string {
  return role
}

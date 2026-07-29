// Ported from ZymoAlly app.js (defaultPqrConfig, líneas 15-36)

export const PQR_LIST_TYPES = [
  "platforms",
  "generators",
  "phones",
  "emails",
  "impacts",
  "types",
  "statuses",
  "priorities",
  "channels",
  "managementCriteria",
] as const

export type PqrListType = (typeof PQR_LIST_TYPES)[number]

export const defaultPqrConfig: Record<PqrListType, string[]> = {
  platforms: ["CEDI principal", "Operacion transporte", "Ultima milla", "Almacenamiento"],
  generators: ["Usuario que genera ticket"],
  phones: ["+57 300 000 0000"],
  emails: ["servicio@cliente.com"],
  impacts: ["Bajo", "Medio", "Alto", "Critico"],
  types: [
    "Peticion", "Queja", "Reclamo", "Solicitud", "Felicitacion", "Hallazgo operativo",
    "Novedad de proceso", "Faltante o inconsistencia", "Mantenimiento de instalaciones",
    "Capacitación de personal", "Corrección de procedimiento", "OKR",
  ],
  statuses: ["Abierto", "En analisis", "En gestion", "Escalado", "Cerrado"],
  priorities: ["Baja", "Media", "Alta", "Critica"],
  channels: ["WhatsApp", "Correo", "Llamada", "Visita de experiencia", "Mesa de ayuda"],
  managementCriteria: ["Contencion inicial", "Causa raiz", "Plan de accion", "Validacion cliente", "Cierre documentado"],
}

// El motor de alertas/dashboard/score (pqrMetrics.ts, scoreMetrics.ts, formatters.ts)
// matchea estos valores literales por regex, no por id — un ticket guarda el
// `value` de la opción elegida (inmutable tras crearse, solo el `label` se puede
// renombrar). Si se BORRA uno de estos valores y se reemplaza por otro texto,
// esa detección deja de funcionar en silencio para los tickets nuevos. Ver
// memoria project_zymoally ("Análisis de lógica ported").
export const PROTECTED_LIST_VALUES: Partial<Record<PqrListType, string[]>> = {
  statuses: ["Cerrado", "Escalado"],
  priorities: ["Critica", "Alta"],
  impacts: ["Critico", "Alto", "Medio"],
}

export const defaultAreaPrefixes: { area: string; prefix: string }[] = [
  { area: "Servicio al cliente", prefix: "PQR" },
  { area: "Operaciones logisticas", prefix: "OPS" },
  { area: "Comercial", prefix: "COM" },
  { area: "Transporte", prefix: "TRA" },
]

// Ported from choice-list buttons hardcodeados en index.html (Fidelización, Experiencia, Reporte de visita)
export const SAC_LIST_TYPES = ["surveyValueChoices", "surveyIssues", "experienceFitChoices", "experienceClarityChoices", "visitOutcomes"] as const

export type SacListType = (typeof SAC_LIST_TYPES)[number]

// value = data-attribute original (usado en lógica, ej. issue !== "Ninguno"); label = texto visible del botón
export const defaultSacConfig: Record<SacListType, { value: string; label: string }[]> = {
  surveyValueChoices: [
    { value: "Calidad del servicio", label: "Calidad del servicio" },
    { value: "Velocidad de entrega", label: "Velocidad de entrega" },
    { value: "Atención y comunicación", label: "Atención y comunicación" },
    { value: "Precio y condiciones", label: "Precio y condiciones comerciales" },
    { value: "Cumplimiento de plazos", label: "Cumplimiento de plazos pactados" },
    { value: "Tecnología y rastreo", label: "Tecnología y rastreo de carga" },
  ],
  surveyIssues: [
    { value: "Ninguno", label: "Ninguno, todo excelente" },
    { value: "Demoras en entrega", label: "Demoras en entrega" },
    { value: "Fallas en comunicación", label: "Fallas en comunicación" },
    { value: "Producto o carga", label: "Problemas con producto o carga" },
    { value: "Facturación", label: "Facturación o condiciones" },
    { value: "Otro", label: "Otro inconveniente" },
  ],
  experienceFitChoices: [
    { value: "Si, se adaptan completamente", label: "Si, se adaptan completamente" },
    { value: "Se adaptan parcialmente", label: "Se adaptan parcialmente" },
    { value: "Requieren ajustes adicionales", label: "Requieren ajustes adicionales" },
    { value: "No se adaptan a la necesidad actual", label: "No se adaptan a la necesidad actual" },
  ],
  experienceClarityChoices: [
    { value: "Si, fueron claros y veraces", label: "Si, fueron claros y veraces" },
    { value: "Fueron claros, con puntos por precisar", label: "Fueron claros, con puntos por precisar" },
    { value: "Requieren mayor soporte tecnico", label: "Requieren mayor soporte tecnico" },
    { value: "No fueron suficientemente claros", label: "No fueron suficientemente claros" },
  ],
  visitOutcomes: [
    { value: "Seguimiento requerido", label: "Seguimiento requerido" },
    { value: "Cliente satisfecho", label: "Cliente satisfecho" },
    { value: "Requiere propuesta", label: "Requiere propuesta" },
    { value: "Riesgo de servicio", label: "Riesgo de servicio" },
    { value: "Cierre de hallazgo", label: "Cierre de hallazgo" },
  ],
}

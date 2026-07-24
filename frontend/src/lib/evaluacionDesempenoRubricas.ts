// Rúbricas oficiales de T&C — Evaluación de desempeño, semestre 1-2026.
// Fuente: docs/formatos/FORMATO EVALUACION DE DESEMPEÑO {LIDERES,OPERATIVO}.xlsm
// Mismo esquema en ambas: 6 competencias ponderadas 20/20/20/20/10/10, cada
// ítem calificado 1-5. Solo cambia el texto de las preguntas.

export interface RubricaItem {
  texto: string
}
export interface RubricaCategoria {
  nombre: string
  peso: number
  items: RubricaItem[]
}

export const NIVELES_DESEMPENO = [
  { valor: 5, nombre: "Sobresaliente" },
  { valor: 4, nombre: "Satisfactorio" },
  { valor: 3, nombre: "Necesita Mejorar" },
  { valor: 2, nombre: "Bajo" },
  { valor: 1, nombre: "No satisfactorio" },
] as const

export const RUBRICA_LIDERES: RubricaCategoria[] = [
  {
    nombre: "A. Gestión y Cumplimiento de Procesos",
    peso: 0.2,
    items: [
      { texto: "Promueve y asegura la aplicación consistente de los procedimientos, protocolos y estándares establecidos, realizando seguimiento permanente para garantizar su cumplimiento y la mejora continua de los procesos." },
      { texto: "Informa de manera oportuna a la alta dirección sobre los avances, resultados, riesgos y oportunidades de su área, presentando información clara, confiable y orientada al cumplimiento de objetivos." },
      { texto: "Mantiene y fomenta condiciones óptimas de orden, organización y seguridad en su área, impulsando una cultura de calidad y cumplimiento de los estándares corporativos." },
      { texto: "Conoce, aplica y promueve activamente las políticas, reglamentos y lineamientos institucionales, fortaleciendo en su equipo la cultura de cumplimiento, responsabilidad social y prevención de riesgos." },
      { texto: "Identifica oportunamente incumplimientos en los procesos bajo su responsabilidad y establece acciones correctivas efectivas para garantizar el cumplimiento normativo." },
    ],
  },
  {
    nombre: "B. Implementación OKR y Cumplimiento KPI'S",
    peso: 0.2,
    items: [
      { texto: "Propone mejoras o nuevas ideas orientadas a optimizar procesos del área (tiempos, costos, eficiencia)." },
      { texto: "Asegura la gestión del área mediante el estricto cumplimiento y la entrega a tiempo de los KPI establecidos." },
      { texto: "Fomenta una cultura de confianza e innovación, impulsando a sus liderados a crear soluciones y proponer OKR ambiciosos orientados a la optimización de procesos y la mejora continua." },
    ],
  },
  {
    nombre: "C. Liderazgo y Gestión de Personas",
    peso: 0.2,
    items: [
      { texto: "Desarrolla el potencial de su equipo mediante retroalimentación constante, acompañamiento y acciones orientadas al crecimiento personal y profesional." },
      { texto: "Promueve un ambiente de trabajo colaborativo, inclusivo y orientado a resultados, fortaleciendo la motivación del equipo y gestionando los conflictos de manera objetiva, respetuosa y oportuna." },
      { texto: "Toma decisiones oportunas y fundamentadas, asumiendo responsabilidad por los resultados del área e impulsando la mejora continua." },
    ],
  },
  {
    nombre: "D. Principios y Valores",
    peso: 0.2,
    items: [
      { texto: "Demuestra coherencia y liderazgo ejemplar al cumplir y promover de manera estricta las políticas corporativas y el código de ética de la compañía." },
      { texto: "Promueve la política de servicio al cliente, fortaleciendo relaciones de confianza, respeto y colaboración, orientadas a un ambiente positivo y al logro de resultados." },
      { texto: "Gestiona con responsabilidad y eficiencia los recursos y presupuestos asignados, garantizando su adecuada administración, confidencialidad y alineación estratégica." },
    ],
  },
  {
    nombre: "E. Autocuidado y Bienestar del Equipo",
    peso: 0.1,
    items: [
      { texto: "Lidera el cumplimiento de Seguridad y Salud en el Trabajo, garantizando el uso adecuado de EPP y la corrección oportuna de novedades." },
      { texto: "Identifica y gestiona proactivamente condiciones y actos inseguros, implementando acciones preventivas y reportando oportunamente para evitar incidentes." },
      { texto: "Fomenta una cultura de bienestar integral en su equipo, promoviendo la participación activa en iniciativas de salud física y mental, pausas activas y demás programas orientados al fortalecimiento de la calidad de vida laboral." },
    ],
  },
  {
    nombre: "F. Objetivos BASC y prevención de riesgos LAFT",
    peso: 0.1,
    items: [
      { texto: "Lidera con el ejemplo en la aplicación de los controles de su área, garantizando el cumplimiento de las medidas de prevención de lavado de activos y financiación del terrorismo." },
      { texto: "Garantiza la participación de su equipo en las capacitaciones BASC y verifica la aplicación efectiva de los conocimientos adquiridos en las operaciones del área." },
      { texto: "Reporta de manera oportuna incidentes, novedades o situaciones sospechosas relacionadas con la prevención del riesgo LAFT." },
      { texto: "Lidera la implementación de los planes de acción y mejora derivados de auditorías BASC, asegurando el cierre efectivo de hallazgos en los tiempos establecidos." },
    ],
  },
]

export const RUBRICA_OPERATIVO: RubricaCategoria[] = [
  {
    nombre: "A. Cumplimiento en los procesos",
    peso: 0.2,
    items: [
      { texto: "Sigue correctamente los procedimientos operativos establecidos para su cargo, sin omitir pasos que afecten las operaciones." },
      { texto: "Comunica de manera oportuna y clara las novedades, fallas o dificultades presentadas durante su turno de trabajo." },
      { texto: "Mantiene ordenado, limpio y en condiciones óptimas su puesto de trabajo, herramientas y equipos asignados." },
      { texto: "Conoce y cumple el reglamento interno, las políticas de convivencia y las normas de prevención de acoso laboral y cuidado ambiental." },
      { texto: "Cumple con los horarios, turnos y compromisos de asistencia establecidos, notificando con anticipación cualquier ausencia." },
    ],
  },
  {
    nombre: "B. Cumplimiento de metas y resultados",
    peso: 0.2,
    items: [
      { texto: "Ejecuta las tareas asignadas dentro de los tiempos y estándares de calidad establecidos según procedimientos." },
      { texto: "Alcanza o supera las metas establecidas para su área durante el periodo evaluado." },
      { texto: "Identifica y reporta oportunamente errores o reprocesos, tomando acciones correctivas básicas cuando está a su alcance." },
    ],
  },
  {
    nombre: "C. Habilidades Técnicas",
    peso: 0.2,
    items: [
      { texto: "Maneja con seguridad y eficiencia los equipos, maquinaria, vehículos o herramientas propias de su cargo, reportando necesidades o novedades presentadas." },
      { texto: "Aplica correctamente las técnicas y métodos de trabajo aprendidos en capacitaciones o inducciones para ejecutar sus funciones." },
      { texto: "Resuelve situaciones operativas del día a día con criterio práctico, minimizando tiempos y uso inadecuado de recursos." },
    ],
  },
  {
    nombre: "D. Principios y Valores",
    peso: 0.2,
    items: [
      { texto: "Actúa con honestidad, responsabilidad y transparencia en el desarrollo de sus funciones diarias." },
      { texto: "Mantiene relaciones respetuosas y colaborativas con compañeros, supervisores y clientes o usuarios del servicio." },
      { texto: "Cuida los bienes, insumos y recursos de la empresa, evitando desperdicios y reportando pérdidas o daños de manera inmediata." },
    ],
  },
  {
    nombre: "E. Autocuidado",
    peso: 0.1,
    items: [
      { texto: "Utiliza correctamente los EPP requeridos para su cargo y cumple con las normas ergonómicas de su puesto de trabajo." },
      { texto: "Reporta de manera oportuna y precisa las condiciones o actos inseguros que se presentan en el desarrollo de sus funciones." },
      { texto: "Promueve hábitos saludables, incorpora pausas activas y participa en las actividades de bienestar programadas." },
    ],
  },
  {
    nombre: "F. Objetivos BASC, requisitos legales y prevención de riesgos LAFT",
    peso: 0.1,
    items: [
      { texto: "Aplica los controles establecidos para prevenir actividades sospechosas de lavado de activos en sus funciones." },
      { texto: "Participa activamente en capacitaciones, auditorías y simulacros asociados a BASC." },
      { texto: "Reporta de manera oportuna incidentes, novedades o situaciones sospechosas relacionadas con la prevención del riesgo LAFT." },
      { texto: "Evita compartir datos sensibles sin autorización." },
    ],
  },
]

export function rubricaDe(tipo: "operativo" | "lideres"): RubricaCategoria[] {
  return tipo === "lideres" ? RUBRICA_LIDERES : RUBRICA_OPERATIVO
}

export function resultadoDe(puntaje: number): string {
  if (puntaje >= 4.1) return "Sobresaliente"
  if (puntaje >= 3.53) return "Satisfactorio"
  if (puntaje >= 2.53) return "Necesita Mejorar"
  if (puntaje >= 1.53) return "Bajo"
  return "No satisfactorio"
}

export const RESULTADO_COLOR: Record<string, string> = {
  "Sobresaliente": "text-emerald-400 bg-emerald-500/10",
  "Satisfactorio": "text-teal-400 bg-teal-500/10",
  "Necesita Mejorar": "text-amber-400 bg-amber-500/10",
  "Bajo": "text-orange-400 bg-orange-500/10",
  "No satisfactorio": "text-rose-400 bg-rose-500/10",
}

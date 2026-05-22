# ¿Para qué sirve Helix Zymo?

## Definición

Helix Zymo es una herramienta de gestión de proyectos diseñada específicamente para Zymo. Su nombre viene de la estructura del ADN: cada proyecto es una cadena de actividades, responsables, evidencias y aprendizajes que evolucionan con control y trazabilidad.

No es una plantilla genérica. Es un tablero único de verdad operativa y ejecutiva: si una actividad no tiene responsable, avance, costo o evidencia, no está lista para una decisión gerencial confiable.

---

## ¿Qué problema resuelve?

Actualmente los equipos saltan entre múltiples herramientas para gestionar proyectos: planillas de Excel para tareas, WhatsApp para seguimiento, correo para reportes, y herramientas externas para Gantt o Scrum. Helix Zymo concentra todo en un solo lugar.

---

## ¿Qué puede hacer?

### 1. Gestionar actividades (Scrum)
- Crear actividades con nombre, responsable, subproyecto, fechas de inicio y fin, prioridad, puntos de complejidad y estado.
- Mover actividades entre columnas: **Backlog → Planificado → En curso → Revisión → Terminado**.
- Marcar actividades como **bloqueadas** e indicar dependencias entre ellas.
- Registrar el **porcentaje de avance** de cada actividad.
- Agregar **comentarios** de seguimiento: acuerdos, bloqueos, decisiones.
- Adjuntar **evidencias** (archivos, imágenes, documentos) directamente a cada actividad.
- Capturar **observaciones recibidas por WhatsApp** y asociarlas a la actividad correspondiente.

### 2. Ver el proyecto en Gantt
- Visualización temporal de todas las actividades con su duración, avance y dependencias.
- Navegar por la línea de tiempo y saltar al día de hoy.
- Ver qué actividades se solapan, cuáles están vencidas y cuáles dependen de otras.

### 3. Panel de control ejecutivo (Dashboard)
- **KPIs principales**: tareas totales, completadas, vencidas, bloqueadas, puntos entregados, porcentaje de avance.
- **Salud del sprint**: distribución de estados y próximos hitos.
- **Bloqueos y dependencias**: listado de actividades que frenan el avance del equipo.
- **Carga por responsable**: cuántas tareas y puntos tiene cada persona.
- **Flujograma por subproyecto**: visualización del flujo de actividades agrupadas por área.
- **Dashboard estadístico**: promedio, mediana y desviación estándar de avance y costos.
- **Análisis IA**: diagnóstico automático de riesgos, prioridades y recomendaciones basado en el estado actual.
- **Insignias de cumplimiento**: reconocimiento visual por responsable según tareas terminadas a tiempo.

### 4. Control de costos por actividad
Cada actividad permite registrar tres tipos de costo:
- **Costo de inversión**: recursos iniciales requeridos.
- **Costo de optimización**: mejoras o ajustes durante la ejecución.
- **Costo de ejecución**: gasto operativo directo.

Con estos datos el sistema calcula automáticamente:
- Costo total de la actividad.
- Costo ejecutado según el porcentaje de avance.
- Saldo pendiente por ejecutar.
- Tasa de ejecución presupuestal.

### 5. ROI y análisis financiero por subproyecto
Cada subproyecto tiene inversión estimada y retorno esperado. Con esto Helix calcula:
- **ROI** (retorno sobre inversión).
- **Margen** esperado.
- **Predicción** del subproyecto según avance actual, bloqueos y vencimientos.
- Clasificación: Alto potencial / Potencial favorable / Retorno controlado / Revisar alcance.

### 6. Estados y reportes gerenciales
- Genera automáticamente un **informe de estado** listo para comité, cliente o correo semanal.
- Semáforo general del proyecto.
- Listado de **seguimientos sugeridos** con responsable y prioridad.
- Vista de **ROI y predicción** por subproyecto.
- Botones para copiar el estado, enviarlo por correo o prepararlo para WhatsApp.

### 7. Alertas por correo y WhatsApp
- **Alertas manuales**: el usuario genera mensajes listos para enviar a cada responsable con el estado de sus tareas, motivo, avance, fecha e impacto al cliente.
- **Alertas automáticas**: el sistema detecta actividades vencidas, próximas a vencer (≤2 días), bloqueadas, de alta prioridad con bajo avance (<60%) o con actualizaciones recientes.
- Los mensajes de WhatsApp se generan con el número del responsable pre-cargado, listos para enviar desde el navegador.

### 8. Configuración operativa
- CRUD de **responsables**: nombre, correo, teléfono WhatsApp, color de identificación.
- CRUD de **subproyectos**: nombre, objetivo o cliente, inversión estimada, retorno esperado.
- Registro de **alertas enviadas** con historial de las últimas 30.

### 9. Soporte e instructivos
- **Chat IA de gestión**: asistente que responde preguntas sobre uso de la herramienta, interpretación de estados, priorización y carga de evidencias.
- Descarga de instructivos: guía de usuario y guía gerencial.
- Carga de instructivos propios (PDF, Word, TXT, Markdown) para el equipo.
- **Encuesta de satisfacción** con métricas de NPS, facilidad de uso, utilidad y comentarios.

---

## ¿Para quién es?

| Perfil | Uso principal |
|---|---|
| **Usuario operativo** | Registra avances, adjunta evidencias, captura observaciones, actualiza estados |
| **Líder de proyecto** | Monitorea el equipo, detecta bloqueos, gestiona prioridades, envía alertas |
| **Gerencia** | Lee el semáforo, toma decisiones sobre ROI, revisa costos y riesgos en vista gerencial |

---

## ¿Qué la diferencia de otras herramientas?

| Funcionalidad | Helix Zymo | Jira / Trello / Asana |
|---|---|---|
| Scrum + Gantt integrado | ✅ | Parcial (herramientas separadas) |
| Control de costos por tarea | ✅ | ❌ |
| ROI por subproyecto | ✅ | ❌ |
| Alertas por WhatsApp listas | ✅ | ❌ |
| Análisis IA integrado | ✅ | Limitado / de pago |
| Observaciones desde WhatsApp | ✅ | ❌ |
| Insignias por cumplimiento | ✅ | Limitado |
| Diseñada para Zymo | ✅ | ❌ (genérica) |
| Sin costo de licencia | ✅ | De pago |

---

## Estado actual

La versión prototipo funciona como aplicación web estática con datos en `localStorage` del navegador. La evolución prevista es integrarla como **herramienta dentro de la intranet de Zymo**, con:

- Base de datos propia persistente.
- Control de acceso por usuario (la herramienta se asigna).
- Integración con el sistema de correo de la intranet.
- Almacenamiento de evidencias en el servidor.
- Historial y trazabilidad completa para agentes IA.

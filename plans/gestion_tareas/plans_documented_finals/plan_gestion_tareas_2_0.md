# Plan de Implementación: Gestión de Tareas 2.0 (Estilo Helix Zymo)

> **Origen del Plan:** [implementation_plan.md](file:///C:/Users/andres.quintero/.gemini/antigravity-cli/brain/eb176099-efbe-4d05-bb89-d95963967076/implementation_plan.md)

Reimplementar el módulo de Gestión de Tareas en una arquitectura independiente de microservicios (Node.js + TS + Prisma + Postgres), aplicando las directrices visuales de `design-tokens.json` y conectándolo directamente con el agente **ZYMO Core** para la automatización y traducción de registros de tareas a lenguaje gerencial.


---

## User Review Required

> [!IMPORTANT]
> **Reubicación de la herramienta en la Intranet:** 
> Proponemos mover "Gestión de Tareas" desde la sección genérica **"Mis herramientas"** a una nueva sección destacada de alto nivel en el sidebar, o agruparla bajo un menú unificado de **"Gestión y Planeación"** junto a Helix Zymo. Esto refuerza el carácter ejecutivo de la herramienta 2.0.
>
> **Estrategia de Conexión del Agente ZYMO Core:**
> Cada registro técnico guardado en el módulo activará una llamada interna asíncrona hacia el agente ZYMO Core para generar la traducción gerencial (`descripcion_gerencial`) y evaluar el impacto del ROI.

---

## Open Questions

> [!WARNING]
> ¿Se prefiere que el agente ZYMO Core intente extraer datos de commits de Git de forma automática para pre-llenar las tareas de los desarrolladores, o que se mantenga el registro manual en formulario y que el agente actúe únicamente como traductor y evaluador del registro manual?

---

## Proposed Changes

### 1. Backend (`task-backend` y `task-db`)

#### [NEW] `task-backend/src/services/zymoAgentService.ts`
* Crea la integración HTTP con el agente principal ZYMO Core en el backend FastAPI.
* Envía los registros de tareas creados por los desarrolladores para su análisis.
* Recibe y parsea las traducciones (`descripcion_gerencial`) y el `impacto` calculado.

#### [NEW] `task-backend/prisma/schema.prisma`
* Define el esquema relacional dedicado de 8 tablas en PostgreSQL, agregando los campos:
  * `descripcionGerencial` (String) para la traducción del agente.
  * `impacto` (String) para el cálculo de ROI del agente.
  * `version` (Int) para optimizar la concurrencia (bloqueo optimista).

#### [NEW] `task-backend/src/jobs/escalationScheduler.ts`
* Automatiza la revisión de tareas bloqueadas mediante `node-cron`.
* Si una tarea lleva más de 2 días bloqueada, ZYMO Core dispara una alerta de escalamiento hacia WhatsApp/Email al manager.

---

### 2. Frontend (`frontend/src/`)

#### [MODIFY] `frontend/src/styles/task-theme.css`
* Migra los estilos del módulo utilizando exactamente la paleta de colores, degradados y bordes de `plans/helix-zymo/design-tokens.json`:
  * **Acentos principales:** `#ef3340` (rojo marca) y `#4e5968`.
  * **Estilo AI:** Grados de color `#00a8c8` (teal) y `#7c5cff` (violeta) para destacar la traducción del agente.
  * **Tipografía:** Montserrat como fuente base para alinearse con Helix Zymo.

#### [MODIFY] `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`
* Rediseño completo para incorporar:
  * El nuevo chat directo de asistencia con ZYMO Core.
  * Tablas y tarjetas que muestren el contraste entre la "Descripción Técnica" y la "Descripción Gerencial (Generada por ZYMO)".
  * El módulo de ROI acumulado del equipo calculado por el agente.

#### [MODIFY] `frontend/src/components/layout/Sidebar.tsx`
* Dependiendo de la decisión del usuario, reubica la herramienta en la sección unificada de planeación o bajo su propia pestaña premium.

---

## Verification Plan

### Pruebas Automatizadas
* Ejecutar scripts de integración en backend Node para simular la recepción de una tarea técnica y validar que el llamado a ZYMO Core retorna la traducción y el impacto gerencial.
* Pruebas de integración del middleware de autenticación por token JWT compartido.

### Pruebas Manuales
* Simular en la UI la creación de una tarea como desarrollador (ej: Andrés) y verificar que en el panel de supervisión de Andrea Reyes se renderiza automáticamente la descripción gerencial e impacto del ROI con los estilos premium de Helix.
* Validar que el scheduler detecta y escala tareas bloqueadas.

# Zymo Ally · SAC — Fase 2 (Portal público de encuestas + panel interno)

## Contexto

F1 (Shell + Tickets, ver `docs/superpowers/specs/2026-07-10-zymoally-tickets-portal-f1-design.md`) ya está en producción. Este documento cubre **F2** del roadmap acordado: **F1 → F2 (este) → F3 SMTP → F4 Alertas/SLA → F5 Config**.

El backend de SAC (`zymoally-backend/src/routers/sac/`) ya existe completo y probado: `surveys.ts`, `experience.ts`, `visits.ts`, `sacDashboard.ts`, `sacAlertas.ts`, `sacConfig.ts`, más las rutas públicas `routers/public/survey.ts`. El formulario público de encuestas (React/Vite/Tailwind) ya fue diseñado, construido y probado end-to-end con agent-browser, pero solo existe en el sandbox (`C:\Users\andres.quintero\Documents\ZymoAlly-Sandbox\survey-frontend\`) — spec original: `docs/superpowers/specs/2026-07-07-zymoally-survey-frontend-design.md`.

## Decisión de arquitectura — un solo frontend, sin contenedor nuevo

`docker-compose.yml` tiene exactamente **un** servicio de frontend (`frontend`, nginx + React, puerto 81 externo). El `survey-frontend` standalone del sandbox (su propio Dockerfile/nginx/puerto 8081) fue una decisión de **desarrollo aislado**, no de arquitectura de producción — el spec original de 2026-07-07 ya decía explícitamente: *"mover a la intranet real será copiar la carpeta `src/`, no rediseñar"*, y el mecanismo de acceso siempre fue el mismo patrón de magic-link que `/m/:token` (Mantenimiento), con URL destino `${PUBLIC_APP_URL}/e/:surveyType?t=:token`.

F2 completa exactamente eso: **fusiona** el formulario público dentro del único `frontend/` real, como ruta pública sin login — cero infraestructura Docker/nginx nueva.

## Parte 1 — Portal público de encuestas (`/e/:surveyType`)

**Componentes a portar** desde `ZymoAlly-Sandbox/survey-frontend/src/` a `frontend/src/pages/survey/` (mismo nombre, adaptando imports a los alias/tokens de `frontend/` real — colores, fuentes y logo ya son los de producción por diseño, ver spec 2026-07-07): `SurveyShell`, `ProgressIndicator`, `NpsScale`, `ScaleButtons`, `ChoiceList`, `QuestionHeading`, `WizardNav`, `FormField`, `ThankYouScreen`, `ClientSurveyWizard` (7 pasos), `ExperienceSurveyWizard` (8 pasos).

**Ruta:** `/e/:surveyType` en `App.tsx`, **antes** de `<PrivateRoute>` — sin guard, sin `useAuthStore`, mismo patrón que `/m/:token`. `surveyType` es `"client"` o `"experience"`, el token va en `?t=`.

**Backend:** ya expuesto, sin cambios de nginx. Las rutas `/public/survey/config`, `/public/survey/client`, `/public/survey/experience` cuelgan de `zymoally-backend` y ya son alcanzables vía el proxy `/zymoally-api/` (agregado en F1) → `/zymoally-api/public/survey/...`.

**Cliente API:** el formulario público necesita su propio wrapper axios sin interceptor de JWT de intranet (es un flujo sin sesión, el único auth es el token del magic-link en el body/headers específicos que ya maneja cada wizard) — no reusar `zymoallyApi.ts` (ese sí inyecta el JWT de sesión de intranet, no aplica aquí).

**Fuera de alcance de esta parte:** cualquier cambio visual — el diseño ya fue aprobado en la fase anterior, se porta tal cual.

**Pendiente operativo (no es código, es config del servidor):** `PUBLIC_APP_URL` en el `.env` de `zymoally-backend` en el servidor debe pasar de `localhost:8080` al dominio real de la intranet — si no, el link que genera "Enviar encuesta" (Parte 2) no funciona en producción. Se avisa en el reporte final del plan, igual que el backfill de F1.

## Parte 2 — Zymo Ally · SAC (panel interno)

**Ubicación:** nueva entrada en el sidebar, **"Zymo Ally · SAC"**, debajo de "Zymo Ally · Tickets" (posición ya reservada en el spec de F1). Ruta `/zymoally/sac`, guard `SacRoute` (mismo patrón que `TicketsRoute`), permiso nuevo `mod_sac` → `canSeeSac(role, appPerms)` en `permissions.ts`, mismo patrón que `canSeeTickets`.

**Shell:** clon estructural de `TicketsShell`/`TicketsSidebar`/`TicketsTopbar` (mismo stack: Tailwind + Radix + React Query, cero animaciones nuevas). Navegación interna por vista: **Dashboard** / **Registros**.

**Dashboard:** consume `GET /api/sac/dashboard`. Aplica la misma Regla del Vestido Rojo que Tickets: un protagonista (riesgos/detractores — `clientMetrics.riesgos`), resto de KPIs neutrales. Gráficas de barra simples (`charts.clientBar`, `charts.commercialBar`) con el mismo componente `Bar` ya usado en Tickets — sin librería de charts nueva. Las pirámides `clientPie`/`commercialPie` se muestran como lista de barras horizontales (Promotor/Neutral/Detractor, Alto valor/Seguimiento/Riesgo), no como gráfico circular — mismo principio de "sin complejidad visual nueva". Incluye la sección `aiAnalysis`/`strategies` como texto, igual que Tickets muestra `aiAnalysis`.

**Registros:** tabla única con filtros (tipo: cliente/comercial/visita, estado, buscar), consumiendo el array `records` de `GET /api/sac/dashboard` (ya trae `recordType`, `recordGroup`, `date` mezclando las 3 tablas). Click en una fila abre un Drawer de **solo lectura** con el detalle completo de esa respuesta — las encuestas ya contestadas no se editan (a diferencia de Tickets, acá no hay campos de gestión que cambiar).

**"+ Reporte de visita":** botón en el topbar (igual posición que "+ Nuevo ticket"), abre un Dialog con el formulario interno (fiel a `VisitBody` del backend): cliente (requerido), contacto, resultado, próxima fecha, 4 escalas 0-5 (calidad, ánimo del cliente, oportunidad, urgencia), observaciones, plan de acción → `POST /api/sac/visits`. Con la misma disciplina de validación/error que se corrigió en Tickets F1 (botón deshabilitado si faltan campos requeridos, error visible si falla el POST — no repetir el gap que tuvo que arreglarse ahí).

**"Enviar encuesta":** segundo botón en el topbar, abre un Dialog simple — selector Fidelización/Experiencia → `POST /api/sac/surveys/magic-link` → muestra el link generado con botones **Copiar**, **WhatsApp** (`https://wa.me/?text=...`) y **Correo** (`mailto:?body=...`), mismo patrón de compartir que tenía el ZymoAlly original (sin guardar destinatario — el backend no lo trackea, ver hallazgo de la investigación: el magic-link es JWT autocontenido, sin registro de a quién se envió).

## Reglas de layout aplicadas (heredadas de F1, mismo criterio)

Zona de trabajo primaria = tabla de Registros o Dashboard + los dos botones de acción; zona de contexto = topbar; navegación = sidebar interno, más quieto. Sin profundidad/transiciones/fondos decorativos — funcionalidad primero, igual que se decidió para Tickets.

## Fuera de alcance de F2

- **F3** — SMTP de toda la intranet (infraestructura aparte).
- **F4** — Fix del motor de alertas/SLA. `sacAlertas.ts` usa el mismo patrón de regex sobre texto configurable que ya se identificó como frágil en Tickets (`pqrAlerts`). F2 **no consume `GET /api/sac/alertas`** — el Dashboard de esta fase se limita a `GET /api/sac/dashboard` (KPIs + gráficas + `aiAnalysis`/`strategies`), igual alcance que tuvo el Dashboard de Tickets en F1. Una vista de alertas dedicada, si hace falta, se evalúa junto con el fix de F4.
- **F5** — Panel de administración de `ZymoConfigList` (las 5 choice-lists de SAC: `surveyValueChoices`, `surveyIssues`, `experienceFitChoices`, `experienceClarityChoices`, `visitOutcomes`). Sigue siendo la última fase.
- Editar o eliminar una encuesta ya respondida — no existe ese caso de uso, las respuestas del cliente son inmutables por diseño.

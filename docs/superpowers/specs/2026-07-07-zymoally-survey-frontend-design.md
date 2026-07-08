# ZymoAlly — Frontend público de encuestas SAC (Fidelización + Diseñando la Experiencia)

**Fecha:** 2026-07-07
**Alcance de esta fase:** solo las 2 encuestas públicas (Fidelización de clientes NPS y Diseñando la Experiencia). No incluye: PQR/Tickets, Reporte de visita, panel de configuración de listas SAC, ni el trigger UI dentro del dashboard interno (eso llega en una fase posterior).

## Contexto

`ZymoAlly` original (`C:\Proyectos-indexar\ZymoAlly`) no tenía backend ni link público — todo vivía en `localStorage` y la misma página HTML servía de formulario y de panel interno a la vez. Se está reconstruyendo como módulo nativo de la intranet. El backend (Node/Prisma, dominio SAC) ya existe y está probado end-to-end en el sandbox (`C:\Users\andres.quintero\Documents\ZymoAlly-Sandbox`), incluyendo el sistema de configuración de opciones de formulario (`ZymoConfigList` / `SAC_LIST_TYPES`, ver `project_zymoally` en memoria). Esta fase construye la página pública que el cliente final ve al abrir el link de la encuesta.

## Mecanismo de acceso — magic-link

Se reutiliza el patrón ya existente en Mantenimiento (`POST /solicitudes/{id}/magic-link` → JWT `scope=mnt_mobile` → ruta pública `/m/:token`, documentado en `CLAUDE.md`), en vez de inventar uno nuevo.

- **`POST /api/sac/surveys/magic-link`** (staff, requiere `requireSacAccess`) — body `{ surveyType: "client" | "experience", label?: string }`. Genera JWT HS256 con `{ scope: "survey_client", surveyType }`, TTL 30 días (encuestas no son sensibles al tiempo como una visita de mantenimiento). Responde `{ token, url }` donde `url` apunta a `${PUBLIC_APP_URL}/e/:surveyType?t=:token`.
- **Rutas públicas nuevas**, montadas ANTES de `app.use("/api", authenticate)` en `app.ts`:
  - `GET /public/survey/config` — sin auth. Devuelve las 4 listas configurables relevantes al cliente (`surveyValueChoices`, `surveyIssues`, `experienceFitChoices`, `experienceClarityChoices`). Son solo etiquetas, no hay dato sensible que proteger.
  - `POST /public/survey/client` y `POST /public/survey/experience` — requieren el token del magic-link vía `Authorization: Bearer`, validado por un middleware nuevo `requireSurveyScope` que solo verifica `scope === "survey_client"` y que el `surveyType` del token coincida con la ruta (no valida `role`/`app_permissions`, igual que `mobile.py` en el backend Python valida solo el scope).
- El staff-side "botón para mandar la encuesta" (dónde vive exactamente en el dashboard interno) queda **fuera de alcance** de esta fase — por ahora el link se genera y se comparte manualmente (curl/Postman) para pruebas; la integración UI del botón es la fase siguiente.

## Dirección visual (aprobada vía brainstorming + visual companion)

Todo usa los tokens reales de producción del frontend (`frontend/tailwind.config.js`, `frontend/src/index.css`), no colores inventados — así el port a React no requiere volver a tomar decisiones de color.

- **Paleta:** blanco + rojo únicamente. Nada de azul/amarillo/arcoíris (descartado explícitamente).
  - Rojo primario aclarado: `#d43a56` (2 tonos más claro que el `--primary` de producción `hsl(348 76% 43%)` ≈ `#c31c3c`, ajuste pedido para que no se vea tan oscuro contra el panel negro de desktop).
  - Rojo oscuro complementario (gradientes/hover): `#a8172f`.
  - Acento rosa claro derivado del rojo: `#fce9ed` (mismo rol que `--accent` en producción).
  - Panel oscuro desktop: gradiente radial `#4a1420 → #241014 → #180c0e` (negro suavizado, no negro puro).
  - Tipografía: DM Sans (texto) + DM Mono (números/progreso), igual que el resto de la intranet.
  - Logo real: `frontend/public/brand/zymo_logo.png`.

- **Desktop = "recompensa"** (split-screen, ≥ `lg` breakpoint de Tailwind):
  - Panel izquierdo oscuro con textura de puntos sutil, logo en blanco, badge ("Su voz construye la ruta"), titular + copy de contexto, fila de estadísticas (`+1,200 respuestas este trimestre`, `48h tiempo de respuesta`).
  - Panel derecho blanco con el formulario: indicador de progreso tipo anillo (`conic-gradient`) + "PREGUNTA N DE 7/8", pregunta, controles, botón alineado a la derecha.

- **Mobile = "alivio"** (< `lg`, layout de una columna):
  - Header con banda de degradado rojo (`#d43a56 → #a8172f`) conteniendo logo + promesa ("Solo te tomará 2 minutos · Confidencial"), con un borde inferior curvo (`border-radius` tipo "wave") hacia el cuerpo blanco.
  - Progreso en puntos discretos (dots), no barra con porcentaje.
  - Microcopy tranquilizador bajo cada pregunta cuando aplique ("No hay respuestas correctas o incorrectas").
  - Controles más grandes (`aspect-ratio:1`, `border-radius` mayor) que la versión desktop — prioriza que sea fácil tocar, no denso.
  - Nota de confidencialidad al pie.

- **Mecanismo técnico:** una sola página responsive con breakpoints CSS (Tailwind `lg:`), no dos rutas ni detección de dispositivo por JS — el ancho de viewport decide el layout.

- **Pantalla de agradecimiento:** mensaje de gracias + categoría (Promotor/Neutral/Detractor para Fidelización). Se eliminan los botones "Enviar WhatsApp/Correo/Copiar enlace" que tenía el original — esos eran para que el staff volviera a compartir el link, no algo que el cliente final necesite ver.

## Flujo de contenido

Fiel a `app.js` (ya auditado campo por campo contra el backend en conversación previa):

**Fidelización de clientes (7 pasos):** NPS (0-10) → satisfacción (escala 1-5) → entregas (escala 1-5) → atención (escala 1-5) → aspecto que más valora (choice-list configurable) + inconveniente opcional (choice-list configurable) → comentario libre (opcional, máx 500) → datos de contacto opcionales (empresa, cargo, correo, teléfono) → enviar.

**Diseñando la Experiencia (8 pasos):** ajuste de soluciones (choice-list configurable) → valor futuro (escala 1-5) → claridad de información (choice-list configurable) → expectativas superadas (texto libre opcional) → acción concreta para hoy (texto libre opcional) → satisfacción profesional (escala 1-5, `face-grid`) → ajuste de la reunión (escala 1-5) → datos de contacto + comentario de liderazgo → enviar.

Las choice-lists se cargan desde `GET /public/survey/config` (ya no hardcodeadas) — si el equipo de SAC cambia las opciones desde el backend, el formulario público las refleja sin deploy.

## Stack de implementación

Se construye directamente como React 19 + Vite + TypeScript + Tailwind (mismo stack que `frontend/`, no HTML plano) dentro del sandbox, para eliminar el riesgo de fidelidad al portar — mover a la intranet real será copiar la carpeta `src/`, no rediseñar. Estructura mínima: `SurveyLayout`, `ProgressIndicator`, `NpsScale`, `ScaleButtons`, `ChoiceList`, `ThankYouScreen`, y dos wizards (`ClientSurveyWizard`, `ExperienceSurveyWizard`) que consumen esos componentes compartidos.

## Fuera de alcance (explícito)

- Botón/UI de "mandar encuesta" dentro del dashboard interno de SAC.
- Reporte de visita y su formulario (no es cliente-facing, es interno).
- Panel de administración de las listas de configuración (ya existe el backend, falta la UI).
- Migrar esto a la intranet real (`C:\zymo-intranet`) sin validación previa del usuario — se construye y prueba primero en el sandbox.

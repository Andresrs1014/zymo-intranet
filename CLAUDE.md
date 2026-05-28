# CLAUDE.md - ZYMO Intranet

Este archivo es leido automaticamente por Claude Code al iniciar cada sesion en este proyecto. No requiere instruccion explicita.

---

## Stack del proyecto

| Capa | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite + TailwindCSS + Zustand + TanStack Query + Axios |
| Backend principal | Python + FastAPI + SQLModel + SQLite/PostgreSQL + JWT (HS256) + puerto 8001 |
| task-backend | Node.js + Express + TypeScript + Prisma + PostgreSQL:5434 + puerto 3002 |
| helix-backend | Node.js + Express + TypeScript + Prisma + PostgreSQL:5433 + puerto 3001 |
| Frontend puerto | 81 (Nginx) |
| Infra | Docker Compose + Nginx reverse proxy + Ubuntu 24.04 |
| Dominio | zymointranet.com via Cloudflare Tunnel |
| CI/CD | Webhooks |
| Fuentes UI | DM Sans + DM Mono (Google Fonts) |

---

## Skills activas — aplicar en cada sesion sin instruccion explicita

### find-skills
Ejecutar antes de implementar cualquier solucion compleja o control de seguridad:
```
npx skills find [query]
```
Queries prioritarios para este proyecto:
- `npx skills find owasp top 10`
- `npx skills find jwt hardening`
- `npx skills find docker security`
- `npx skills find xss csrf protection`
- `npx skills find secrets management`
- `npx skills find nginx security headers`

### frontend-design
Obligatorio antes de escribir cualquier componente UI. Direccion estetica de ZYMO:
- Tono: industrial / utilitario refinado
- Fuentes: DM Sans (cuerpo) + DM Mono (datos). No sustituir.
- Paleta: base oscura dominante, acentos de accion saturados
- Micro-animaciones en momentos clave: carga, transicion de estado, feedback
- Prohibido: Inter, Roboto, Arial, gradientes purpura, layouts SaaS genericos
- Cada modulo debe tener caracter visual propio

### web-design-guidelines
Auditar antes de cada commit que incluya cambios de UI:
```
Revisa src/components/[modulo]/ contra las web-design-guidelines
```
Reporte en formato `archivo:linea`.

### agent-browser
Pruebas E2E de flujos criticos antes de despliegues:
```bash
agent-browser open https://zymointranet.com
agent-browser snapshot -i
agent-browser screenshot --annotate
```
Flujos obligatorios: login/logout, creacion tareas Helix, flujo OC completo, navegacion entre modulos.
Usar `--session [rol]` para aislar por rol: admin, gerente, operador.

### mcp-builder
Para integraciones con agentes IA. MCPs prioritarios de ZYMO:
- `mcp-zymo-bodega`   → scanning, validacion SAP, packing/picking
- `mcp-zymo-oc`       → creacion, aprobacion y email de Ordenes de Compra
- `mcp-zymo-helix`    → tareas y sprints para ZYMO_CEREBRO_CORE
- `mcp-zymo-reportes` → generacion PDF/Excel para agentes administrativos

Lenguaje: Python/FastMCP. Transporte: streamable HTTP en produccion.

---

## Reglas criticas (resumen ejecutivo)

- Nunca hardcodear secretos, tokens, NITs ni datos sensibles.
- Todo cambio debe ser Docker-ready antes de cerrar.
- No romper flujos existentes sin justificacion documentada.
- Buscar skill con `find-skills` antes de implementar seguridad manualmente.
- `frontend-design` es obligatorio en todo componente nuevo.
- `web-design-guidelines` es obligatorio antes de commit de UI.
- `agent-browser` es obligatorio para flujos criticos antes de despliegue.

## Definicion de Done
Un cambio esta listo solo si:
- Build pasa en el modulo afectado.
- No rompe endpoints existentes sin documentacion.
- Cumple criterios de seguridad.
- Es desplegable en Docker sin pasos ocultos.
- UI auditada con `web-design-guidelines`.
- Flujos criticos probados con `agent-browser`.
- `docs` actualizado si cambio comportamiento o seguridad.

---

## Documentacion de referencia
- `docs/ADMIN_DB_PLAN.md`
- `Master_plan/ZYMO_MASTER_PLAN_v2.md`
- `docs/superpowers/specs/`
- `plans/helix_zymo/PLAN_IMPLEMENTACION_INTRANET.md`

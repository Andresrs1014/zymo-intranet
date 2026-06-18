# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Comandos esenciales

### Despliegue completo
```bash
docker compose up --build -d          # Build y levanta todos los servicios
docker compose logs -f sig-backend    # Seguir logs de un servicio específico
docker compose restart sig-backend    # Reiniciar un servicio sin rebuild
```

### Frontend (React 19 + Vite)
```bash
cd frontend
npm run dev          # Dev server (puerto 5173)
npm run build        # Build de producción
npx tsc --noEmit     # Verificar TypeScript sin compilar — OBLIGATORIO antes de commit
```

### Backend Python (FastAPI)
```bash
cd backend
uvicorn app.main:app --reload --port 8001   # Dev server
python -m app.agents.worker                 # Worker de agentes en background
```

### Node backends (sig-backend / helix-backend / task-backend)
```bash
cd sig-backend        # o helix-backend / task-backend
npm run dev           # Dev con hot-reload (ts-node / nodemon)
npm run build         # Compilar TS → dist/
npx tsc --noEmit      # Verificar TypeScript — OBLIGATORIO antes de commit

# Prisma
npx prisma migrate dev --name <nombre>   # Nueva migración (solo en dev)
npx prisma migrate deploy                # Aplicar migraciones (producción, en CMD del Dockerfile)
npx prisma generate                      # Regenerar cliente (tras cambios en schema.prisma)
npx prisma studio                        # UI para inspeccionar la BD en dev
```

### Checks críticos pre-commit (código de servidor)
```
1. npx tsc --noEmit   — sin errores TS (TS6133 rompe Docker build)
2. docker compose up --build -d   — build limpio sin errores
3. Ningún import no usado, ninguna variable declarada sin uso
```

---

## Arquitectura de servicios

### Mapa de puertos y bases de datos

| Servicio | Puerto externo | Puerto interno | BD | Puerto BD |
|---|---|---|---|---|
| `backend` (Python/FastAPI) | 8001 | 8001 | SQLite / PostgreSQL | — |
| `frontend` (React/Nginx) | 81 | 80 | — | — |
| `zymo-worker` | — | — | (comparte backend_data) | — |
| `helix-backend` | 3001 | 3001 | `helix-db` | 5433 |
| `task-backend` | 3002 | 3002 | `task-db` | 5434 |
| `sig-backend` | 3004 | 3003 | `sig-db` | 5436 |

### JWT compartido
El backend Python emite el JWT (HS256) con claims `{id, role, sede, area, email}`. **Todos los backends Node** validan ese mismo token usando `SECRET_KEY` de `./backend/.env`. El campo `app_permissions` **no está en el JWT** — se resuelve en el frontend vía `GET /auth/me` después del login.

### Patrón de módulo nuevo
Para agregar un módulo (ej. "Gestión Humana"):
1. **`lib/permissions.ts`** — añadir `canSeeGH(role, perms)` siguiendo el patrón `hasPerm()`
2. **`App.tsx`** — añadir `GHRoute` component + rutas `/gh/*`
3. **`Sidebar.tsx`** — añadir entrada condicionada a `canSeeGH()`
4. **Backend Node** — clonar estructura de `sig-backend` (middleware/auth.ts ya tiene el patrón JWT)
5. **`docker-compose.yml`** — nuevo servicio + BD siguiendo el bloque sig-backend/sig-db

### Middleware de autenticación Node (patrón sig-backend)
`sig-backend/src/middleware/auth.ts` es la plantilla. Define:
- `authenticate` — valida JWT HS256
- `requireSigAccess` — verifica `role === 'admin' | 'gerente'` o `app_permissions.includes('mod_sig')`
- `getUserId(user)` — extrae el `id` numérico del claim `id` o `sub`

Clonar y adaptar para cada nuevo backend Node.

---

## Módulos del frontend

### Rutas y páginas

| Ruta | Módulo | Guard |
|---|---|---|
| `/dashboard` | Panel principal | `PrivateRoute` |
| `/administrativo`, `/oc/*` | Órdenes de Compra | `OCRoute` (`mod_oc_ver`) |
| `/operativo/*` | Módulo operativo | `OperativoRoute` (`mod_operativo`) |
| `/sgc/*` | Gestión de Calidad | `SGCRoute` (`mod_sgc`) |
| `/financiero/*` | Financiero | `FinancieroRoute` (`mod_financiero`) |
| `/gerencial` | Gerencial | `GerencialRoute` (`mod_gerencial`) |
| `/sig/*` | SIG (procedimientos + análisis IA) | `SigRoute` (`mod_sig`) |
| `/planeacion/helix` | Helix (sprints/tareas) | `HelixRoute` (`mod_helix`) |
| `/tareas-v2` | Gestión de tareas dev | `PrivateRoute` + `user_tools` |
| `/mantenimiento/*` | Mantenimiento | `MantenimientoRoute` |
| `/admin/*` | Administración | `AdminRoute` (role=admin) |

### Agente flotante (`AgentLayer`)
`AgentFloatingWindow` se renderiza globalmente sobre todas las rutas. Muestra el agente `"zymo"` (gerencial) o `"administrativo"` (OC) según permisos. El store `agentPanelStore` controla si está flotante o docked.

### Token guard
`useTokenGuard` en `App.tsx` limpia la sesión si el JWT expiró, chequeando `visibilitychange` y `focus` — no hay logout automático por timer.

---

## SIG — Sistema Integrado de Gestión (`sig-backend`)

### Routers
- `procedimientos.ts` — CRUD de procedimientos, versionado, commit de documentos, flujogramas MMD
- `instructivos.ts` — instructivos con extracción de texto servidor-side; `POST /:id/reextract` para re-procesar `.doc` con antiword
- `analisis.ts` — análisis IA (NetVault/LightRAG); store de jobs con estados `running|done|error|cancelled`
- `commits.ts` — historial de versiones de archivos adjuntos a procedimientos

### Extracción de texto (`services/textExtraction.ts`)
| Formato | Herramienta |
|---|---|
| `.docx` | `mammoth` (convierte a Markdown) |
| `.pdf` | `pdf-parse` |
| `.doc` | `antiword -m UTF-8.txt` (requiere `apk add antiword` en Alpine) |
| `.md`, `.txt` | `fs.readFile` directo |

### Análisis IA — cancelación de jobs
Los `AbortController` se guardan en el Map `_jobControllers` a nivel de módulo en `SigAnalisisPanel.tsx`. La función exportada `cancelAnalysisJob(id)` permite que cualquier componente cancele un job sin pasar por el store (que no puede guardar objetos no serializables).

---

## Backend Python (`backend/`)

### Routers clave
- `auth.py` — JWT, registro, `/auth/me` (devuelve `app_permissions` + `user_tools`)
- `roles.py` — gestión de roles con `app_permissions: list[str]` editable
- `netvault.py` — proxy hacia LightRAG/NetVault para indexación y análisis IA. Punto de inyección de contexto organizacional futuro (~línea 561)
- `oc/` — flujo completo de órdenes de compra
- `agentes.py` — endpoints del agente ZYMO conversacional
- `zymo.py` — workers y orquestación de agentes

### Modelo de permisos
`Role.app_permissions: list[str]` en PostgreSQL. Los permisos siguen el patrón `mod_<modulo>_<accion>` (ej. `mod_oc_aprobar`, `mod_sig`, `mod_gh_admin`). El admin siempre bypasa los permisos vía `if role === "admin" return true`.

---

## Estética ZYMO (obligatorio en componentes UI)

- **Fuentes:** DM Sans (cuerpo) + DM Mono (datos numéricos/código). No sustituir.
- **Paleta:** base oscura dominante, acentos de acción saturados. Sin gradientes púrpura.
- **Micro-animaciones:** en carga, transición de estado y feedback de acciones.
- **Prohibido:** Inter, Roboto, Arial, layouts SaaS genéricos.
- Cada módulo debe tener carácter visual propio — no copiar el layout de otro módulo.

---

## Skills activas (aplicar sin instrucción explícita)

### find-skills — antes de implementar seguridad
```
npx skills find owasp top 10
npx skills find jwt hardening
npx skills find xss csrf protection
npx skills find secrets management
```

### frontend-design — antes de cualquier componente UI
Revisar dirección estética del módulo activo contra las reglas de estética ZYMO arriba.

### web-design-guidelines — antes de commit con cambios UI
```
Revisa src/components/[modulo]/ contra las web-design-guidelines
```
Reporte en formato `archivo:linea`.

### agent-browser — flujos críticos antes de despliegue
```bash
agent-browser open https://zymointranet.com --session admin
```
Flujos obligatorios: login/logout, flujo OC completo, análisis SIG, navegación entre módulos.

### mcp-builder — integraciones con agentes IA
MCPs activos: `mcp-zymo-bodega`, `mcp-zymo-oc`, `mcp-zymo-helix`, `mcp-zymo-reportes`.
Patrón: Python/FastMCP, transporte streamable HTTP.

---

## Definición de Done

Un cambio está listo solo si:
- `npx tsc --noEmit` sin errores en todos los módulos tocados
- `docker compose up --build -d` pasa sin errores
- No rompe endpoints existentes sin documentación
- Es desplegable en Docker sin pasos ocultos
- UI auditada con `web-design-guidelines`
- Flujos críticos probados con `agent-browser`
- `docs` actualizado si cambió comportamiento o seguridad

---

## Documentación de referencia
- `docs/ADMIN_DB_PLAN.md`
- `Master_plan/ZYMO_MASTER_PLAN_v2.md`
- `docs/superpowers/specs/`
- `plans/helix_zymo/PLAN_IMPLEMENTACION_INTRANET.md`
- `C:\Users\andres.quintero\OneDrive - IMC CARGO INTERNATIONAL SAS\Documentos\Diagramas\GH_DIRECTORIO_PLAN\` — plan técnico y ejecutivo del módulo GH (Gestión Humana)

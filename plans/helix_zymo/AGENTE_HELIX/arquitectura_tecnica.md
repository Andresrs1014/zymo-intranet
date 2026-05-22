# Arquitectura Técnica — Helix Zymo

> Fuente directa: `helix-backend/src/app.ts` + `docker-compose.yml` + `frontend/src/lib/helixApi.ts`
> Ver también: [[roles_y_permisos]] | [[endpoints_api]]

---

## Diagrama de arquitectura

```
USUARIO (browser)
        │
        ▼
frontend (React + Vite)     ← zymointranet.com  (puerto 80/443 nginx)
        │
        ├──► /api/*          → FastAPI backend      (puerto 8001 interno)
        │                       Python + SQLModel + PostgreSQL
        │
        └──► /api/* (helix) → helix-backend         (puerto 3001 externo)
                               Node.js + Express + Prisma
                                        │
                                        ▼
                               helix-db (PostgreSQL)  (puerto 5433 interno)
```

---

## Contenedores Docker

| Servicio | Imagen | Puerto | Perfil |
|---|---|---|---|
| `backend` | Python FastAPI | 8001 (interno) | siempre activo |
| `frontend` | Nginx + React build | 80/443 | siempre activo |
| `helix-backend` | Node.js 20 Alpine | 3001 (externo) | `--profile helix` |
| `helix-db` | PostgreSQL 15 Alpine | 5433 (interno) | `--profile helix` |

**Comando para levantar Helix:**
```bash
docker compose --profile helix up -d
```

---

## helix-backend (Node.js)

**Stack:**
- Runtime: Node.js 20 (Alpine)
- Framework: Express 4
- ORM: Prisma 5 con PostgreSQL
- Validación: Zod 3
- Auth: jsonwebtoken (verifica JWT del FastAPI)
- Lenguaje: TypeScript 5

**Estructura:**
```
helix-backend/src/
├── app.ts              # Express app + middleware + routers
├── config/
│   ├── env.ts          # Variables de entorno tipadas
│   └── prisma.ts       # Cliente Prisma singleton
├── middleware/
│   └── auth.ts         # Verificación JWT compartido
├── routers/            # Express routers por recurso
│   ├── actividades.ts
│   ├── subproyectos.ts
│   ├── comentarios.ts
│   ├── usuarios.ts
│   ├── dashboard.ts
│   └── ai.ts
└── services/
    ├── dashboardService.ts
    ├── roiService.ts
    ├── alertaService.ts
    └── aiService.ts
```

---

## helix-db (PostgreSQL)

**Credenciales internas:**
- Host: `helix-db` (nombre del servicio Docker)
- Puerto: `5432` (interno) / `5433` (expuesto en host durante desarrollo)
- Base de datos: `helixdb`
- Usuario: `helix`

**Modelos Prisma:**
- `HelixSubproyecto` — proyectos/iniciativas
- `HelixActividad` — unidades de trabajo con estados
- `HelixComentario` — comentarios por actividad
- `HelixEvidencia` — archivos adjuntos
- `HelixEncuesta` — encuestas NPS
- `HelixAlerta` — historial de notificaciones
- `HelixAIConversacion` — historial del chat IA

---

## Frontend (React)

**Stack:**
- React 18 + TypeScript + Vite
- Tailwind CSS + Helix design tokens (helix.css)
- State: Zustand (auth store) + React hooks locales
- DnD: @dnd-kit/core (Scrum Board)
- HTTP: Axios (helixApi) con JWT automático

**Módulo Helix en el frontend:**
```
frontend/src/
├── pages/planeacion/helix/HelixPage.tsx     # Router de vistas
├── components/planeacion/helix/
│   ├── HelixShell.tsx / HelixSidebar.tsx / HelixTopbar.tsx
│   ├── board/       # Scrum Board + TaskCard + KanbanColumn
│   ├── gantt/       # GanttView + GanttScale + GanttChart
│   ├── dashboard/   # DashboardView + 7 paneles
│   ├── settings/    # SettingsView + SubprojectsPanel + ResponsiblesPanel
│   └── dialogs/     # TaskDialog
├── hooks/
│   ├── useHelixActividades.ts
│   ├── useHelixSubproyectos.ts
│   ├── useHelixUsuarios.ts
│   ├── useHelixDashboard.ts
│   └── useHelixFilters.ts
├── lib/helixApi.ts  # Axios → helix-backend:3001
├── types/helix.ts   # Todos los tipos TypeScript
└── styles/helix.css # Design tokens
```

---

## Variables de entorno requeridas

**helix-backend (.env o docker-compose):**
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://helix:<password>@helix-db:5432/helixdb
JWT_SECRET=<mismo que backend FastAPI>
INTRANET_API_URL=http://backend:8001
INTERNAL_KEY=<clave para llamadas internas>
CORS_ORIGIN=https://zymointranet.com
```

**frontend (.env.production):**
```
VITE_HELIX_API_URL=http://zymointranet.com:3001
```

---

*Última actualización: 2026-05-22 | Fuente: `docker-compose.yml` + `helix-backend/src/app.ts` + `frontend/src/lib/helixApi.ts`*

# Estado de Implementación — ZYMO Intranet

Última actualización: 2026-04-02

---

## ✅ Backend (completo)

### Archivos implementados
| Archivo | Estado |
|---------|--------|
| `app/config.py` | ✅ Settings con pydantic-settings, token 480 min |
| `app/database.py` | ✅ Engine SQLite, sesión, create_db_and_tables |
| `app/models/user.py` | ✅ User con sede, area, last_login_at, soft delete |
| `app/models/role.py` | ✅ Tabla dinámica de roles |
| `app/core/security.py` | ✅ hash, verify, create_access_token, decode_token |
| `app/core/deps.py` | ✅ get_current_user, require_admin, require_any_role |
| `app/routers/auth.py` | ✅ /token, /me, /register, CRUD usuarios |
| `app/routers/users.py` | ✅ Router adicional |
| `app/main.py` | ✅ FastAPI + CORS + lifespan + /health |
| `run.py` | ✅ `python run.py` levanta uvicorn en 0.0.0.0:8001 |
| `requirements.txt` | ✅ Incluye email-validator (requerido por EmailStr) |

### Usuario admin de prueba (dev)
- Email: `admin@zymo.com`
- Password: `admin1234`
- Sede: IMCCARGO / Área: IT

---

## ✅ Frontend (completo)

### Archivos implementados
| Archivo | Estado |
|---------|--------|
| `src/index.css` | ✅ Barlow (Google Fonts) + Tailwind directives |
| `src/main.tsx` | ✅ QueryClientProvider wrapping |
| `src/App.tsx` | ✅ React Router v7 + PrivateRoute / PublicRoute |
| `src/types/auth.ts` | ✅ User, TokenResponse, UserRole |
| `src/store/authStore.ts` | ✅ Zustand + persist ("zymo-auth") |
| `src/lib/api.ts` | ✅ Axios + interceptores Bearer + redirect 401 |
| `src/hooks/useAuth.ts` | ✅ useLogin, useMe, useLogout |
| `src/lib/roles.ts` | ✅ ALL_APPS, getAppsForRole, ROLE_LABELS |
| `src/pages/LoginPage.tsx` | ✅ Split-screen branding + formulario |
| `src/pages/DashboardPage.tsx` | ✅ Grid de AppCards filtrado por rol |
| `src/components/layout/Sidebar.tsx` | ✅ Azul #003087, logo Z, info usuario, logout |
| `src/components/layout/TopBar.tsx` | ✅ Título + avatar con inicial |
| `src/components/apps/AppCard.tsx` | ✅ Hover animado, abre en nueva pestaña |
| `tailwind.config.js` | ✅ brand.blue/yellow/red/white + Barlow |
| `vite.config.ts` | ✅ Alias @ → src/ |

### Trampas conocidas
- `useLogin()` espera `{ email, password }` — NO `{ username, password }`. El hook internamente mapea a URLSearchParams para el endpoint OAuth2 de FastAPI.
- `getAppsForRole("admin")` devuelve `ALL_APPS` completo sin filtrar.

---

## ✅ Docker (completo)

### Archivos
| Archivo | Descripción |
|---------|-------------|
| `docker-compose.yml` | Backend puerto 8001, frontend puerto 81, volumen `backend_data` para SQLite |
| `backend/Dockerfile` | Python 3.12-slim + uvicorn ← **este es el real** |
| `backend/.dockerignore` | Excluye venv, __pycache__, .env, data, .git |
| `frontend/Dockerfile` | Multi-stage: Node 22 build → nginx:alpine |
| `frontend/nginx.conf` | SPA routing + cache 1y assets + gzip |
| `frontend/.dockerignore` | Excluye node_modules, dist, .env, .git |
| `frontend/.env.production` | `VITE_API_URL=http://zymointranet.com:8001` |

> ⚠️ `backend/app/Dockerfile` existe vacío por error — ignorar. El Dockerfile real está en `backend/Dockerfile`.

### Levantar
```bash
cd E:/zymo-intranet
docker compose up --build
```

---

## ⬜ Pendiente antes de producción

1. **`frontend/.env.production`** — Actualizar `VITE_API_URL` con la IP/dominio real del servidor
2. **`backend/app/main.py`** — Actualizar `allow_origins` con el dominio real del frontend
3. **`backend/.env`** — Generar `SECRET_KEY` nuevo y seguro (no usar el de dev)
4. Deploy en servidor + configurar subdominio `zymointranet.com`
5. CI/CD con GitHub Actions
6. Panel de administración de usuarios (listar, registrar, editar, desactivar) — solo admin

---

## ⬜ Módulos post-MVP (no implementar antes del 7 de abril)

- KPIs para directivos
- Módulo Empleados (Talento y Cultura)
- Inventario de activos
- SIG — gestión de documentos
- Integración de tokens JWT con apps externas
- Refresh tokens

## Importante leer el dia de hoy 6 de abril

Vamos a implementar, de una vez, los roles, para que muestre unas cosas a unos y otras cosas a otros. 

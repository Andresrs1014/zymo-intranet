# ZYMO Intranet — Arquitectura y Contexto

## Descripción General
Portal intranet corporativo para Grupo ZYMO (IMCCARGO Internacional, LOGIMAT Zona Franca, IMC Depósito). Centraliza el acceso a todas las aplicaciones internas con control de roles por área.

## Stack Tecnológico
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** FastAPI + SQLModel
- **Base de datos:** SQLite (migrable a PostgreSQL)
- **Auth:** JWT (mismo patrón que Matriz)
- **Deploy:** Docker + Docker Compose
- **CI/CD:** GitHub Actions + webhook en servidor Ubuntu

## Identidad Visual
- **Colores primarios:** Azul corporativo (#003087), Blanco (#FFFFFF), Amarillo (#FFD700)
- **Empresas del grupo:** IMCCARGO, LOGIMAT, IMC Depósito
- **Logo:** ZYMO (rojo #E31E24)
- **Fuente:** Barlow (consistente con otras apps del grupo)

## Roles y Acceso

### ADMIN
- Acceso total a todos los módulos y apps
- Gestión de usuarios y roles
- Configuración del sistema

### DIRECTIVO
- Dashboard con KPIs e indicadores
- Consulta de procesos y procedimientos
- Vinculado a correos corporativos
- Acceso a Matriz
- Apps específicas para directivos (a definir)

### TALENTO Y CULTURA
- Matriz
- OC Automatizaciones
- Portal Capacitaciones
- Módulo Empleados

### COMERCIAL
- Matriz
- CRM Tarifas

### OPERATIVO
- Matriz (proyectos de mejora)

## Apps Integradas (Phase 1)
Todas las apps abren en nueva pestaña. Integración profunda de tokens en fases posteriores.

| App                   | URL                             | Roles con acceso         |
| --------------------- | ------------------------------- | ------------------------ |
| Matriz                | matriz.zymointranet.com         | Todos                    |
| CRM Tarifas           | crm.zymointranet.com            | Admin, Comercial         |
| OC Automatizaciones   | oc.zymointranet.com             | Admin, Talento y Cultura |
| Portal Capacitaciones | capacitaciones.zymointranet.com | Admin, Talento y Cultura |

## Estructura del Proyecto

`zymo-intranet/` 

`├── backend/` 

`│   ├── app/` 

`│   │   ├── main.py` 

`│   │   ├── config.py` 

`│   │   ├── models/` 

`│   │   │   ├── user.py` 

`│   │   │   └── role.py` 

`│   │   ├── routers/` 

`│   │   │   ├── auth.py` 

`│   │   │   └── users.py` 

`│   │   └── core/` 

`│   │       ├── security.py` 

`│   │       └── deps.py` 

`│   ├── Dockerfile` 

`│   ├── requirements.txt` 

`│   └── .dockerignore` 

`├── frontend/` 

`│   ├── src/` 

`│   │   ├── components/` 

`│   │   │   ├── layout/` 

`│   │   │   │   ├── Sidebar.tsx` 

`│   │   │   │   └── TopBar.tsx` 

`│   │   │   └── apps/` 

`│   │   │       └── AppCard.tsx` 

`│   │   ├── pages/` 

`│   │   │   ├── LoginPage.tsx` 

`│   │   │   ├── DashboardPage.tsx` 

`│   │   │   └── LandingPage.tsx` 

`│   │   ├── store/` 

`│   │   │   └── authStore.ts` 

`│   │   └── lib/` 

`│   │       ├── roles.ts` 

`│   │       └── api.ts` 

`│   ├── Dockerfile` 

`│   ├── nginx.conf` 

`│   └── vite.config.ts` 

`├── docker-compose.yml` 

`├── .env.example` 

`└── README.md`
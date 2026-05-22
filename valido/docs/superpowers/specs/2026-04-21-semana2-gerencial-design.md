# Diseño — Semana 2: Módulo Gerencial + Mejoras del Sistema
> Fecha: 2026-04-21 | Branch: master | Spec aprobada por: Andrés

---

## Contexto

Implementación de la Semana 2 del ZYMO Master Plan v2.1. La Semana 1 dejó completo:
infraestructura base, RAG, Agente Administrativo, frontend flotante, ZYMO Core + worker.
El backend del módulo gerencial (`gerencial.py` + `gerencial_database.py`) fue creado en
Semana 1 pero no está activo — le falta registrar el router y crear las tablas al startup.

**Fuera de alcance (pospuesto):** Perplexity API — noticias IA para el gerente.

---

## 1. Backend Gerencial

### 1.1 Activar el módulo

- Registrar `gerencial_router` en `main.py` (junto a los otros routers)
- Llamar `create_gerencial_tables()` en el evento `startup` de FastAPI

### 1.2 Base de datos — SQLite ahora, PostgreSQL después

La variable de entorno `GERENCIAL_DATABASE_URL` determina el motor:

```
# Desarrollo / pruebas (SQLite — sin configuración)
GERENCIAL_DATABASE_URL=sqlite:///./data/gerencial.db

# Producción futura (PostgreSQL)
GERENCIAL_DATABASE_URL=postgresql+asyncpg://user:password@host:5432/gerencial
```

El `gerencial_database.py` ya maneja el fallback automáticamente.

### 1.3 Documentación de migración futura a PostgreSQL

> **MIGRACIÓN A POSTGRESQL — APLICA A TODOS LOS SCHEMAS**
>
> Cuando se migre `gerencial` a PostgreSQL, el mismo proceso aplica para todos los schemas
> del sistema. Orden recomendado de migración:
>
> 1. `gerencial` (piloto — este módulo)
> 2. `agents` → cambiar `AGENTS_DATABASE_URL`
> 3. `oc` → cambiar `OC_DATABASE_URL`
> 4. `intranet` → cambiar `DATABASE_URL`
>
> Para cada schema: solo cambiar la variable de entorno correspondiente y correr
> `create_tables()` del módulo. Las tablas se crean en PostgreSQL automáticamente.
> No se requiere migración de datos si se empieza desde cero en el nuevo motor.

Este bloque de documentación se incluye como comentario en `gerencial_database.py`
y como sección en el markdown de configuración del servidor.

---

## 2. Frontend — Módulo Gerencial

### 2.1 Ruta y protección

- **Ruta:** `/gerencial`
- **Guard:** `PrivateRoute` (cualquier usuario autenticado puede acceder a la ruta)
- Tabs 1 y 2 solo se renderizan si el rol es `gerente` o `admin` — para los demás roles esos tabs no existen
- Registro en `App.tsx` con `PrivateRoute`

### 2.2 Estructura de tabs

Una sola página `GerencialPage.tsx` con tabs según el rol:

| Tab | Nombre en UI | Roles que lo ven |
|-----|-------------|------------------|
| 1 | Panel Gerente | gerente, admin |
| 2 | Directora Planeación y Desarrollo | gerente, admin |
| 3 | Desarrollo e Innovación & Planeación y Consultoría | todos los autenticados |

**Tab activo al entrar (por rol):**
- `gerente` / `admin` → Tab 1 (Panel Gerente)
- Cualquier otro rol autenticado → Tab 3 (Desarrollo e Innovación) — único tab visible para ellos

### 2.3 Tab 1 — Panel Gerente

**Fuente de datos:** `GET /api/gerencial/kpis` + `GET /api/gerencial/actividad` + `GET /api/zymo/reportes`

**Componentes:**
- KPIs en tiempo real: total OC activas, OC por estado, tareas dev completadas/en_progreso/bloqueadas
- Badge de reportes ZYMO no leídos visible en el tab: `Panel Gerente (N)` donde N = reportes `leido: false`
- Feed de actividad reciente de todas las áreas (tareas dev + acciones Agente Admin)
- Tabla de órdenes directas activas con estado
- Formulario para crear nueva orden directa (destinatario, título, descripción)

### 2.4 Tab 2 — Directora Planeación y Desarrollo

**Fuente de datos:** `GET /api/gerencial/tareas-dev` con filtros

**Componentes:**
- Lista de tareas con estado, etiqueta, plataforma, tiempo y descripción gerencial generada por ZYMO
- Filtros: por estado, etiqueta, plataforma
- 4 gráficas con **Recharts** (nueva dependencia):
  1. Barras — tareas completadas por semana (velocidad del equipo)
  2. Pie — distribución por etiqueta
  3. Barras apiladas — tiempo invertido por plataforma
  4. Barras agrupadas — completadas vs. en_progreso vs. bloqueadas
- Alerta visual si hay tareas en estado `bloqueada`

### 2.5 Tab 3 — Desarrollo e Innovación & Planeación y Consultoría

**Fuente de datos:** `POST /api/gerencial/tareas-dev` + `GET /api/gerencial/tareas-dev`

**Componentes:**
- Formulario "¿Qué hice hoy?" con campos:
  - `fecha` (editable — permite registrar días anteriores, default hoy)
  - `hora_inicio` / `hora_cierre` (manuales — sin auto-fill, el usuario registra tareas ya completadas)
  - `tiempo_total` (calculado automáticamente, solo lectura)
  - `etiqueta` (select: Desarrollos / Actualizaciones / Auditorías / Implementación OKR / Tareas diarias)
  - `descripcion_tecnica` (textarea)
  - `plataforma` (select: Logimat1 / Logimat2 / IMCCARGO / IMCDEPÓSITO / Transversal)
  - `estado` (select: completada / en_progreso / bloqueada)
  - `titulo`
- Nota bajo el formulario: *"ZYMO genera automáticamente la descripción gerencial y el impacto estimado"*
- Historial personal de tareas registradas (tabla con paginación)
- Métricas personales: horas totales por etiqueta, tareas esta semana

**Nombres en archivos/componentes:**
- Componente: `DesarrolloInnovacionTab.tsx` (NO `AndresTab` ni `DevTab`)
- Componente: `DirectoraPlaneacionTab.tsx` (NO `AndreaTab`)
- Constantes y variables internas siguen la misma convención

---

## 3. Memoria Persistente

**Tabla:** `agent_memory` (ya existe en `agents.db`)

**Flujo:**
1. Al recibir un request de chat (`/api/agentes/administrativo/chat` o `/api/zymo/chat`)
2. Backend lee `agent_memory` WHERE `user_id = current_user.id`
3. Serializa las memorias como bloque de texto
4. Inyecta al inicio del system prompt de Gemini:

```
[MEMORIA DE SESIONES ANTERIORES]
- preferencia_reporte: resúmenes cortos, máximo 5 puntos
- contexto_ultimo_login: 2 alertas activas, 3 pendientes aprobación
```

5. Al final de cada respuesta: actualiza `contexto_ultimo_login` con el estado actual del área

**Regla crítica:** Si hay conflicto entre memoria y dato real de BD → **gana la BD siempre**.

**Análisis de costo de tokens** (ver Sección 6 del markdown del servidor para detalle completo):
- La memoria agrega ~100-300 tokens por request
- Representa < 1% del presupuesto diario de 1M tokens por key
- El costo real a vigilar es el worker ZYMO (corre 24/7 con rondas automáticas)

---

## 4. Piloto con Sonia — RAG

**No requiere desarrollo nuevo.** El RAG (LightRAG) y la tool `buscar_documento()` ya están implementados.

**Lo que se agrega:**
- Endpoint `GET /api/agentes/documentos/estado` — muestra documentos indexados y fecha de última indexación

**Proceso de activación** (operacional, documentado en el markdown del servidor):
1. Copiar documentos de la empresa al volumen Docker: `/app/data/agent_docs/`
2. `POST /api/agentes/documentos/indexar`
3. Verificar con `GET /api/agentes/documentos/estado`

---

## 5. PWA + Touch Events

### 5.1 PWA — Instalable en móvil

**Archivos nuevos:**
- `frontend/public/manifest.json` — nombre, íconos, colores
- `frontend/public/sw.js` — Service Worker básico (solo para trigger de instalación, sin cache offline)
- Meta tags en `frontend/index.html`

**Alcance:** Solo hace la app instalable (banner "Agregar a pantalla de inicio" en Chrome/Safari móvil). Sin modo offline, sin cache de datos.

### 5.2 Touch events en agente flotante

**Archivo:** `frontend/src/components/agent/AgentFloatingWindow.tsx`

**Cambio:** Agregar `onTouchStart`, `onTouchMove`, `onTouchEnd` espejando la lógica de drag con mouse existente. El agente flotante funciona arrastrable tanto en desktop (mouse) como en móvil (touch).

---

## 6. Nombres de componentes y archivos (convención)

| Concepto | Nombre en archivos/componentes | NO usar |
|----------|-------------------------------|---------|
| Vista de Andrés | `DesarrolloInnovacionTab` | `AndresTab`, `DevTab`, `AndresVista` |
| Vista de Andrea | `DirectoraPlaneacionTab` | `AndreaTab`, `AndreaVista`, `DirectorTab` |
| Módulo completo | `GerencialPage` | `GerenciaPage`, `ManagerPage` |
| Guard de ruta | `GerencialRoute` | `ManagerRoute`, `GerenteRoute` |

---

## 7. Dependencias nuevas

| Paquete | Motivo | Dónde |
|---------|--------|-------|
| `recharts` | Gráficas en Tab de Directora Planeación | frontend |

---

## Orden de implementación

1. Backend: registrar router gerencial + crear tablas al startup
2. Backend: endpoint `GET /api/agentes/documentos/estado`
3. Backend: inyección de memoria persistente en chat endpoints
4. Frontend: `GerencialPage` + `GerencialRoute` en `App.tsx`
5. Frontend: Tab 1 — Panel Gerente (KPIs + actividad + órdenes + badge)
6. Frontend: Tab 2 — Directora Planeación y Desarrollo (lista + gráficas)
7. Frontend: Tab 3 — Desarrollo e Innovación (formulario + historial + métricas)
8. PWA: manifest + service worker + meta tags
9. Touch events: `AgentFloatingWindow.tsx`
10. Markdown del servidor: guía completa de configuración + análisis de tokens

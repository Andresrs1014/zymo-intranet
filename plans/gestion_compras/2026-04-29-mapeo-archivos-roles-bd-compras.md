# Mapeo de archivos: roles, bases de datos y módulo de compras (OC)

Documento de referencia para saber **qué archivos tocan** cada uno de estos tres ámbitos en la intranet ZYMO y **qué función cumplen**. Las rutas son relativas a la raíz del repositorio (`zymo-intranet`).

---

## 1. Roles

Los roles definen **nombre canónico** (`Role.name` / `User.role`), **etiqueta**, **descripción** y **permisos de aplicación** (`app_permissions`). El backend resuelve autorización con `app.core.permissions`; el frontend replica reglas de navegación en `lib/permissions.ts` y enrutas protegidas.

| Archivo                                           | Función                                                                                                                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/app/models/role.py`                      | Modelo SQLModel de la tabla `role` (id, name, label, description, app_permissions JSON, created_at).                                                                              |
| `backend/app/models/user.py`                      | Campo `role` (string) enlazado por nombre a una fila en `role`; sin FK explícita pero semánticamente acoplado.                                                                    |
| `backend/app/routers/roles.py`                    | API REST `/roles`: listar, crear, actualizar y **eliminar** roles (admin). Al borrar, reasigna usuarios al rol `empleado`.                                                        |
| `backend/app/routers/users.py`                    | CRUD de usuarios; permite asignar `role` al crear/editar; endpoint auxiliar de listado con `require_compras` para selección de auxiliares OC.                                     |
| `backend/app/routers/auth.py`                     | Login, registro y **`/auth/me`**: devuelve `role` y `app_permissions` efectivos leyendo la fila `Role` que coincida con `User.role`.                                              |
| `backend/app/core/permissions.py`                 | `user_has_permission`, `user_has_any_permission`, `role_names_with_permission`; admin bypass; reglas legacy por `User.area` durante la migración.                                 |
| `backend/app/core/deps.py`                        | Dependencias FastAPI: `require_admin`, `require_permission(...)`, atajos `require_compras`, `require_financiero`, `require_gerencial`, `require_sgc`, `require_oc_config_access`. |
| `backend/app/main.py`                             | `_DEFAULT_ROLES`, `_seed_roles()`: plantilla y semilla de roles al arrancar; migraciones ligeras de columnas en `role`.                                                           |
| `frontend/src/pages/RolesPage.tsx`                | UI de administración de roles (CRUD y permisos por módulo/app).                                                                                                                   |
| `frontend/src/hooks/useRoles.ts`                  | Queries y mutations React Query contra `/roles`.                                                                                                                                  |
| `frontend/src/lib/roles.ts`                       | Definiciones de apps/módulos visibles (`INTERNAL_MODULES`, `EXTERNAL_APPS`) y función `getAppsForRole` para el dashboard.                                                         |
| `frontend/src/lib/permissions.ts`                 | Guards de UI: `canSeeOC`, `canApproveOC`, `canConfigureOC`, y equivalentes para otros dominios usando `role` + `app_permissions` (+ compat. por área).                            |
| `frontend/src/types/auth.ts`                      | Tipos del usuario autenticado, incluyendo `role` y `app_permissions`.                                                                                                             |
| `frontend/src/store/authStore.ts`                 | Estado global que guarda usuario (rol y permisos) tras login / refresh de `/auth/me`.                                                                                             |
| `frontend/src/components/admin/UserFormModal.tsx` | Formulario de usuario: dropdown de roles desde `useRoles()`.                                                                                                                      |
| `frontend/src/pages/AdminPage.tsx`                | Entrada a administración (solo admins vía rutas/layout).                                                                                                                          |
| `frontend/src/components/layout/Sidebar.tsx`      | Muestra u oculta entradas de menú según permisos (p. ej. Administrativo/Oc).                                                                                                      |
| `frontend/src/components/layout/TopBar.tsx`       | Acceso rápido a configuración de roles (`/admin/configuracion/roles`) y uso de etiqueta de rol (`getRoleLabel`).                                                                  |
| `frontend/src/App.tsx`                            | `AdminRoute` (solo `role === "admin"`); `OCRoute` usa `canSeeOC(...)`; otras rutas por módulo con el mismo patrón.                                                                |
| `frontend/src/pages/DashboardPage.tsx`            | Tarjetas de apps visibles según `getAppsForRole(user.role, user.app_permissions)`.                                                                                                |

**Permisos OC típicos en roles** (definidos en semilla y editables en UI): `mod_oc_ver`, `mod_oc_aprobar`, `mod_oc_config` — ver `main.py` → `_DEFAULT_ROLES`.

---

## 2. Bases de datos

El backend usa **varios motores SQLite/PostgreSQL** según variable de entorno; cada módulo tiene su archivo de conexión y creación de tablas. Referencia de variables: `backend/.env.example`.

| Archivo | Función |
|---------|---------|
| `backend/app/config.py` | `Settings`: URLs `database_url`, `oc_database_url`, `sgc_database_url`, `financiero_database_url`, `agents_database_url`, `gerencial_database_url`, etc. |
| `backend/.env.example` | Documentación de nombres de variables y valores por defecto (p. ej. `data/intranet.db`, `data/oc.db`). |
| `backend/app/database.py` | **Intranet core**: motor `get_engine()`, `get_db()`, `create_db_and_tables()` para tablas `user`, `role`, `area`, `sede`. |
| `backend/app/oc_database.py` | **Módulo OC (compras)**: motor `get_oc_engine()`, `get_oc_db()`, `create_oc_tables()` para solicitudes, cotizaciones, órdenes, proveedores OC, config, historial, paquetes; índices y migraciones DDL embebidas. |
| `backend/app/sgc_database.py` | **SGC**: catálogo de proveedores (`sgc_proveedores`) y sesión `get_sgc_db`. |
| `backend/app/financiero_database.py` | **Financiero**: facturas, validaciones, tipos de gasto, cuentas, seguimiento; `get_financiero_db`. |
| `backend/app/agent_database.py` | **Agentes**: sesiones y tablas auxiliares del asistente; `get_agents_db`. |
| `backend/app/gerencial_database.py` | **Gerencial**: tareas/órdenes gerenciales (PostgreSQL piloto); motor y modelos en el mismo módulo; `create_gerencial_tables`. |
| `backend/app/main.py` | **Orquestación al arranque**: `create_db_and_tables`, `create_oc_tables`, `create_sgc_tables`, `create_financiero_tables`, `create_agent_tables`, `create_gerencial_tables`; funciones `_migrate_db`, `_migrate_oc_db`, `_migrate_oc_cotizaciones`, etc. |
| `backend/app/models/user.py` | Tabla `user` (intranet.db). |
| `backend/app/models/role.py` | Tabla `role` (intranet.db). |
| `backend/app/models/area.py` | Tabla `area` (intranet.db). |
| `backend/app/models/sede.py` | Tabla `sede` (intranet.db). |
| `backend/app/models/oc.py` | Entidades del dominio OC mapeadas a tablas en **oc.db** (`oc_solicitudes`, `oc_cotizaciones`, etc.). |
| `backend/app/models/sgc.py` | `ProveedorSGC` → **sgc.db**. |
| `backend/app/models/financiero.py` | Entidades **financiero.db**. |

Cualquier router que importe `get_db` vs `get_oc_db` vs `get_sgc_db` indica qué base usa esa ruta.

---

## 3. Módulo de compras (orden de compra / OC)

El módulo de compras en código corresponde al prefijo API **`/api/oc`** y a las pantallas bajo **`/oc/...`** y flujos relacionados en **Operativo** (solicitudes del colaborador). Autorización principal: permisos `mod_oc_ver`, `mod_oc_aprobar`, `mod_oc_config` y dependencia `require_compras`.

### Backend — API y lógica

| Archivo | Función |
|---------|---------|
| `backend/app/routers/oc/router.py` | Agrega todos los sub-routers bajo `/api/oc`. |
| `backend/app/routers/oc/solicitudes.py` | Ciclo de vida de solicitudes: listados, detalle, estados, asignación a auxiliar, campos de gestión compras, \"mis solicitudes\", etc. |
| `backend/app/routers/oc/cotizaciones.py` | Cotizaciones de proveedores, PDF, aprobación/rechazo/corrección (requiere `mod_oc_aprobar` donde aplica). |
| `backend/app/routers/oc/documentos.py` | Subidas/descargas (proformas, documentos); permisos compras vs solicitante donde corresponde. |
| `backend/app/routers/oc/config.py` | Configuración del módulo OC (correos, plantillas, pruebas): `require_oc_config_access` o equivalente. |
| `backend/app/routers/oc/kpis.py` | Métricas y reportes KPI del flujo OC. |
| `backend/app/routers/oc/paquetes.py` | Agrupación de solicitudes en paquetes. |
| `backend/app/routers/oc/shared.py` | Endpoint de apoyo (p. ej. listado `usuarios-compras` para asignaciones). |
| `backend/app/routers/oc/proveedores.py` | Lista proveedores para selectores OC leyendo **SGC** (`get_sgc_db`), no catálogo CRUD aquí. |
| `backend/app/routers/oc/webhook.py` | Entrada automatizada tipo Power Automate/Forms (**autenticación por secreto/header**, no flujo JWT de usuario). |
| `backend/app/models/oc.py` | Modelos de datos: solicitudes, cotizaciones, órdenes, proveedores OC, configuración, historial, paquetes. |
| `backend/app/oc_database.py` | Persistencia física del módulo en **oc.db**. |
| `backend/app/services/email_service.py` | Plantillas y envío de correos del flujo de compras (notificaciones a compras, solicitantes, aprobaciones). |
| `backend/app/agents/tools/oc_tools.py` | Herramientas del agente para consultar datos del módulo OC. |
| `backend/app/agents/administrativo.py` | Prompt del agente contextualizado con área administrativa/compras (no API HTTP del módulo). |
| `backend/app/routers/gerencial.py` | Cruza con OC en vistas de tareas cuando el usuario tiene `mod_oc_aprobar` además del módulo gerencial. |

### Frontend — pantallas y datos

| Archivo | Función |
|---------|---------|
| `frontend/src/hooks/useOC.ts` | Hooks React Query: solicitudes, cotizaciones, órdenes, KPIs, mutaciones; capa principal de llamadas a `/api/oc/...`. |
| `frontend/src/types/oc.ts` | Tipos TypeScript alineados con respuestas del API OC. |
| `frontend/src/pages/AdministrativoPage.tsx` | Hub del área administrativa: enlaces a solicitudes, aprobación, KPIs, configuración OC. |
| `frontend/src/pages/oc/SolicitudesPage.tsx` | Listado de solicitudes (vista compras/administrativo). |
| `frontend/src/pages/oc/SolicitudDetallePage.tsx` | Detalle de solicitud, cotizaciones, órdenes, documentos. |
| `frontend/src/pages/oc/CotizacionFormPage.tsx` | Formulario de cotización por proveedor. |
| `frontend/src/pages/oc/AprobacionPage.tsx` | Cola de aprobaciones pendientes. |
| `frontend/src/pages/oc/KPIPage.tsx` | Dashboard de indicadores OC. |
| `frontend/src/pages/oc/OcConfigPage.tsx` | Pantalla de configuración (correos, tests). |
| `frontend/src/pages/operativo/NuevaSolicitudPage.tsx` | Crear solicitud (flujo colaborador). |
| `frontend/src/pages/operativo/MisSolicitudesPage.tsx` | Listado \"mis solicitudes\" del usuario. |
| `frontend/src/pages/operativo/MiSolicitudDetallePage.tsx` | Detalle de solicitud del solicitante (solapa con vistas OC parciales). |
| `frontend/src/pages/operativo/PaquetesPage.tsx` | UI de paquetes de solicitudes (operativo). |
| `frontend/src/App.tsx` | Rutas `/oc/*` bajo `OCRoute`; rutas operativos que consumen mismo API OC. |

---

## Resumen rápido

| Ámbito | Dónde está la “verdad” principal |
|--------|-----------------------------------|
| **Roles y permisos** | Tabla `role` + campo `user.role` en **intranet.db**; validación server en `permissions.py` y `deps.py`; UX en `permissions.ts` y rutas en `App.tsx`. |
| **Persistencia** | Un archivo `*_database.py` por dominio + `main.py` para arranque y migraciones ligeras. |
| **Compras (OC)** | Datos en **oc.db** vía `oc_database.py` y `models/oc.py`; HTTP bajo `/api/oc/*`; UI en `pages/oc/*` + hooks `useOC.ts`. |

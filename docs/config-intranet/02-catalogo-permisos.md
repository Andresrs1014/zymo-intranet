# Catálogo de permisos

**Fuente de verdad UI:** `frontend/src/lib/roles.ts`  
**Guards frontend:** `frontend/src/lib/permissions.ts`  
**Seeds default:** `backend/app/main.py` → `_DEFAULT_ROLES`

> **Importante:** el permiso T&C es `mod_tc`, **no** `mod_tyc` (obsoleto en CLAUDE.md y docs viejos).

---

## Permisos por módulo (app_permissions)

### Órdenes de compra

| ID | Función |
|----|---------|
| `mod_oc_ver` | Ver solicitudes, cotizaciones, OC |
| `mod_oc_aprobar` | Aprobar/rechazar cotizaciones |
| `mod_oc_config` | Config SMTP y listas OC |

### Operativo

| ID | Función |
|----|---------|
| `mod_operativo` | Módulo operativo |
| `mod_oper_clientes` | Cartera clientes (CRUD en `/operativo/clientes`) |

### Talento y Cultura (T&C)

| ID | Función |
|----|---------|
| `mod_tc` | Ver módulo `/tc/*` |
| `mod_tc_editar` | Crear/editar personas, cargos, eventos |
| `mod_tc_sensible` | Evaluaciones, sanciones, novedades, indicadores |
| `mod_tc_importar` | Import JSON directorio |

**Seed `talento_cultura`:** `mod_tc`, `mod_tc_editar`, `mod_tc_importar` — **sin** `mod_tc_sensible`.

### ZymoAlly — Tickets

| ID | Función |
|----|---------|
| `mod_tickets` | Acceso módulo tickets |
| `mod_tickets_config` | Editar maestros + sync directorio |

### ZymoAlly — SAC

| ID | Función |
|----|---------|
| `mod_sac` | Acceso dominio SAC (API) |
| `mod_sac_config` | Config formularios SAC |

*Frontend SAC: sin rutas aún. Helpers `canSeeSAC` / `canConfigSAC` en `permissions.ts` desde 2026-07-15.*

### Otros módulos

| ID | Función |
|----|---------|
| `mod_sgc` | SGC proveedores |
| `mod_financiero` | Financiero |
| `mod_gerencial` | Gerencial + agente ZYMO |
| `mod_mantenimiento` | Mantenimiento |
| `mod_sig` | SIG |
| `mod_helix` | Helix |
| `mod_extraccion_ia` | Motor IA extracción |
| `mod_it` | Reservado — **sin UI** |

### Apps externas (Dashboard)

| ID | App |
|----|-----|
| `matriz` | Matriz |
| `crm` | CRM Tarifas (SSO) |
| `brp` | BRP |

---

## user_tools (por usuario, no por rol)

| Key | Label |
|-----|-------|
| `tool_task_submit_dev` | Gestión de Tareas — Colaborador |
| `tool_task_manage_dev` | Gestión de Tareas — Gestor |

Definidos en `AdminPage.tsx` → `TOOLS`. No aparecen en RolesPage.

---

## Roles seed (main.py)

| Rol | app_permissions default |
|-----|-------------------------|
| `admin` | `[]` (bypass en código) |
| `directivo` | matriz, mod_oc_ver, mod_oc_aprobar |
| `talento_cultura` | matriz, mod_tc, mod_tc_editar, mod_tc_importar |
| `comercial` | matriz, crm |
| `operativo` | matriz, mod_operativo |
| `empleado` | matriz |
| `calidad` | mod_sgc, matriz |
| `gerente` | mod_gerencial, matriz |
| `administrativo` | mod_oc_ver, mod_oc_aprobar, mod_oc_config, matriz |
| `compras` | mod_oc_ver, matriz |
| `financiero` | mod_financiero, matriz |
| `auxiliar_mantenimiento` | mod_mantenimiento |

---

## JWT (desde 2026-07-15)

Al login (`POST /auth/token`), el payload incluye:

```json
{
  "sub": "email@...",
  "role": "talento_cultura",
  "sede": "...",
  "area": "...",
  "id": 123,
  "app_permissions": ["mod_tc", "mod_tc_editar", ...]
}
```

**Consumidores Node que leen `app_permissions` del JWT:**
- `zymoally-backend/src/middleware/auth.ts`
- `sig-backend/src/middleware/auth.ts`

**Backend Python:** sigue resolviendo permisos desde BD (`role.app_permissions`), no del JWT.

**Re-login obligatorio** tras editar permisos de un rol en RolesPage.

---

## Bypass especiales en Node

`zymoally-backend` y `sig-backend`: `role === "admin"` o `role === "gerente"` → acceso aunque falte el permiso en JWT.

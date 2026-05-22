# Roles y Permisos — Helix Zymo

> Fuente directa: `helix-backend/src/middleware/auth.ts` + `helix-backend/src/routers/usuarios.ts`
> Ver también: [[flujo_trabajo]] | [[arquitectura_tecnica]]

---

## Modelo de autenticación

Helix NO tiene su propio sistema de usuarios. Reutiliza los usuarios de la intranet ZYMO.

**Flujo:**
1. Usuario inicia sesión en `zymointranet.com` → FastAPI genera JWT firmado con `JWT_SECRET`
2. El frontend envía ese mismo JWT en cada request a `helix-backend`
3. `helix-backend` verifica el JWT con el **mismo `JWT_SECRET`** que usa FastAPI
4. El payload del JWT contiene: `{ id, email, nombre, rol, ... }`

**Resultado:** Un solo login da acceso a todo — intranet + Helix.

---

## Roles del sistema

Los roles vienen del JWT de la intranet:

| Rol | Acceso a Helix | Descripción |
|---|---|---|
| `admin` | Total | Puede ver y editar todo |
| `directivo` | Total | Mismos permisos que admin en Helix |
| `user` | Lectura + escritura propia | Puede crear y editar sus propias actividades |

**Nota:** Helix no tiene roles propios — hereda los de la intranet. Actualmente todos los usuarios autenticados con JWT válido tienen el mismo nivel de acceso al helix-backend.

---

## ¿Quién puede hacer qué?

| Acción | Quién |
|---|---|
| Ver tablero y actividades | Cualquier usuario autenticado |
| Crear/editar actividad | Cualquier usuario autenticado |
| Eliminar actividad | Cualquier usuario autenticado |
| Crear/editar subproyecto | Cualquier usuario autenticado |
| Ver dashboard y métricas | Cualquier usuario autenticado |
| Ver lista de usuarios para asignar | Cualquier usuario autenticado |
| Chatear con el agente IA | Cualquier usuario autenticado |

**En la práctica:** El área de Desarrollo maneja el módulo Helix. El acceso está controlado por quién tiene el link y sesión activa en la intranet.

---

## Endpoint de usuarios

```
GET /api/usuarios
→ HelixUsuario[]
```

Este endpoint en helix-backend llama internamente a `GET /api/users` del backend FastAPI usando la misma JWT del usuario. Devuelve la lista de usuarios de la intranet para el selector de responsable en TaskDialog y ResponsiblesPanel.

---

## Seguridad

- Todos los endpoints bajo `/api/*` en helix-backend requieren JWT válido (middleware `authenticate`)
- Solo el endpoint `/health` es público
- CORS configurado con `CORS_ORIGIN` del `.env` — en producción solo acepta `zymointranet.com`
- Los tokens expiran según la configuración del FastAPI (misma expiración que la intranet)

---

*Última actualización: 2026-05-22 | Fuente: `helix-backend/src/middleware/auth.ts` + `helix-backend/src/config/env.ts`*

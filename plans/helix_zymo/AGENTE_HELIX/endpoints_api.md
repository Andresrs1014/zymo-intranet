# Endpoints API — Helix Zymo

> Fuente directa: `helix-backend/src/app.ts` + todos los archivos en `helix-backend/src/routers/`
> Ver también: [[arquitectura_tecnica]] | [[actividades_y_estados]] | [[subproyectos]]

---

## Base URL

```
Desarrollo: http://localhost:3001
Producción: http://zymointranet.com:3001
```

Todos los endpoints bajo `/api/*` requieren header:
```
Authorization: Bearer <JWT de la intranet>
```

---

## Subproyectos

```
GET    /api/subproyectos
       → HelixSubproyecto[]

POST   /api/subproyectos
       Body: { nombre*, objetivo?, cliente?, inversionEst?, retornoEsp? }
       → HelixSubproyecto

PUT    /api/subproyectos/:id
       Body: { nombre?, objetivo?, cliente?, inversionEst?, retornoEsp?, activo? }
       → HelixSubproyecto

DELETE /api/subproyectos/:id
       → { message: "Subproyecto eliminado" }
       Error 409 si tiene actividades asociadas
```

---

## Actividades

```
GET    /api/actividades
       Query: { subproyectoId?, estado?, responsableId?, bloqueada? }
       → HelixActividad[]

POST   /api/actividades
       Body: { subproyectoId*, responsableId*, nombre*, estado?, prioridad?,
               fechaInicio*, fechaFin*, avance?, puntos?, costoInversion?,
               costoOptimizacion?, costoEjecucion?, bloqueada?, dependenciaId? }
       → HelixActividad

GET    /api/actividades/:id
       → HelixActividad (con comentarios y evidencias incluidas)

PUT    /api/actividades/:id
       Body: mismos campos del POST, todos opcionales
       → HelixActividad

DELETE /api/actividades/:id
       → { message: "Actividad eliminada" }

PATCH  /api/actividades/:id/estado
       Body: { estado: "Backlog" | "Planificado" | "En curso" | "Revision" | "Terminado" }
       → HelixActividad

PATCH  /api/actividades/:id/avance
       Body: { avance: 0-100 }
       → HelixActividad
```

---

## Comentarios

```
GET    /api/actividades/:id/comentarios
       → HelixComentario[]

POST   /api/actividades/:id/comentarios
       Body: { texto*, canal? }
       → HelixComentario
       (autorId y autorNombre se toman del JWT automáticamente)
```

---

## Dashboard

```
GET    /api/dashboard
       Query: { subproyectoId? }
       → HelixDashboardData {
           metricas, distribucionEstados, proximosHitos,
           bloqueadas, cargaPorResponsable, insignias,
           estadisticasPorResponsable
         }

GET    /api/dashboard/flujo
       Query: { subproyectoId? }
       → { subproyectos: Array<{ id, nombre, actividades: [...] }> }
```

---

## Usuarios

```
GET    /api/usuarios
       → HelixUsuario[]
       (llama internamente al backend FastAPI — lista de usuarios de la intranet)
```

---

## AI / Chat

```
POST   /api/ai/chat
       Body: { message: string, conversacionId?: number }
       → { respuesta: string, conversacionId: number }

GET    /api/ai/conversacion
       → { mensajes: Array<{ role, content, ts }> }
```

---

## Salud del servicio

```
GET    /health       (sin autenticación)
       → { status: "ok", service: "helix-backend" }
```

---

## Códigos de error comunes

| Código | Significado |
|---|---|
| 400 | Datos inválidos (validación Zod falló) |
| 401 | JWT ausente o inválido |
| 403 | Sin permisos (INTERNAL_KEY incorrecta en /api/ai) |
| 404 | Recurso no encontrado |
| 409 | Conflicto (ej: eliminar subproyecto con actividades) |
| 500 | Error interno del servidor |

---

*Última actualización: 2026-05-22 | Fuente: `helix-backend/src/routers/*.ts` + `helix-backend/src/app.ts`*

# Actividades y Estados — Helix Zymo

> Fuente directa: `helix-backend/src/routers/actividades.ts` + `frontend/src/types/helix.ts`
> Ver también: [[flujo_trabajo]] | [[reglas_de_negocio]] | [[metricas_y_kpis]]

---

## ¿Qué es una actividad?

Una actividad es la unidad mínima de trabajo en Helix. Pertenece a un subproyecto, tiene un responsable, fechas de inicio y fin, y progresa a través de 5 estados. Es equivalente a un "ticket" o "tarea de sprint".

---

## Los 5 estados posibles

```
Backlog → Planificado → En curso → Revision → Terminado
```

| Estado | Significado | Color UI |
|---|---|---|
| `Backlog` | Identificada pero no planificada | Gris #6b7280 |
| `Planificado` | Programada con fecha y responsable | Azul #3b82f6 |
| `En curso` | En ejecución activa | Amarillo #f59e0b |
| `Revision` | Lista para revisión/aprobación | Violeta #8b5cf6 |
| `Terminado` | Completada y cerrada | Verde #1f9d6a |

**Endpoint de cambio de estado:**
```
PATCH /api/actividades/:id/estado
Body: { estado: "Backlog" | "Planificado" | "En curso" | "Revision" | "Terminado" }
```

---

## Campos de una actividad

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | Identificador único auto-incremental |
| `subproyectoId` | number | Subproyecto al que pertenece (obligatorio) |
| `responsableId` | number | ID del usuario de la intranet (obligatorio) |
| `responsableNombre` | string | Nombre completo (desnormalizado) |
| `responsableInitials` | string | Iniciales para el avatar (max 3 chars) |
| `responsableColor` | string | Color hex del avatar (default #5461c8) |
| `nombre` | string | Título de la actividad (max 100 chars, obligatorio) |
| `estado` | enum | Uno de los 5 estados (default: Backlog) |
| `prioridad` | enum | Alta / Media / Baja (default: Media) |
| `fechaInicio` | ISO date | Fecha de inicio planificada (obligatorio) |
| `fechaFin` | ISO date | Fecha de entrega planificada (obligatorio) |
| `avance` | integer 0-100 | Porcentaje de completitud (default: 0) |
| `puntos` | integer 1-21 | Story points (default: 3) |
| `costoInversion` | float | Costo de inversión en COP |
| `costoOptimizacion` | float | Ahorro esperado en COP |
| `costoEjecucion` | float | Costo real de ejecución en COP |
| `bloqueada` | boolean | Si tiene impedimentos activos (default: false) |
| `dependenciaId` | number? | ID de actividad que debe completarse primero |

---

## Reglas de prioridad

- **Alta:** Urgente, impacto alto — aparece con chip rojo
- **Media:** Normal — chip amarillo
- **Baja:** Puede esperar — chip gris

La prioridad la asigna el gestor. El sistema no la cambia automáticamente.

---

## Condición "bloqueada"

Una actividad marcada como `bloqueada: true`:
- Aparece con borde rojo en el tablero Scrum
- Aparece en el panel de bloqueos del Dashboard
- Genera alerta automática si lleva más de 2 días bloqueada
- El campo `dependenciaId` puede indicar de qué otra actividad depende

---

## Avance (%)

- Se actualiza manualmente via `PATCH /api/actividades/:id/avance` o editando la actividad
- Cuando llega a 100%, se recomienda cambiar estado a `Terminado`
- El sistema NO cambia estado automáticamente por avance — es manual

---

*Última actualización: 2026-05-22 | Fuente: `helix-backend/src/routers/actividades.ts` (schema zod) + `prisma/schema.prisma`*

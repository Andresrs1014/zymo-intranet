# Métricas y KPIs — Helix Zymo

> Fuente directa: `helix-backend/src/services/dashboardService.ts`
> Ver también: [[roi_y_valor]] | [[alertas_y_notificaciones]] | [[reglas_de_negocio]]

---

## Métricas principales (MetricsGrid)

El dashboard calcula en tiempo real desde `GET /api/dashboard`:

| Métrica | Fórmula | Alerta si... |
|---|---|---|
| Total actividades | COUNT(*) | — |
| Completadas | COUNT(estado = "Terminado") | < 30% del total |
| En progreso | COUNT(estado = "En curso") | — |
| Vencidas | COUNT(fechaFin < hoy AND estado != "Terminado") | > 0 |
| Bloqueadas | COUNT(bloqueada = true) | > 0 |
| Puntos completados | SUM(puntos WHERE estado = "Terminado") / SUM(puntos) | — |
| Avance global | AVG(avance) de todas las actividades | < 40% en sprint avanzado |

---

## Distribución de estados (SprintHealth)

Barra horizontal proporcional mostrando cuántas actividades hay en cada estado:

```
Backlog [■■■] Planificado [■■] En curso [■■■■] Revision [■] Terminado [■■■■■]
```

Útil para detectar cuellos de botella (ej: demasiadas actividades en Revision sin cerrarse).

---

## Próximos hitos (SprintHealth)

Actividades que vencen en los próximos 7 días y no están Terminadas:
- Badge verde: > 5 días restantes
- Badge naranja: 3-5 días restantes
- Badge rojo: ≤ 2 días restantes (urgente)

---

## Carga por responsable (WorkloadPanel)

Para cada responsable con actividades activas:
- Total asignadas
- Completadas
- En progreso
- Avance promedio de sus actividades

**Uso gerencial:** Identificar si hay un responsable con carga desproporcionada o con bajo avance.

---

## Insignias de cumplimiento (BadgesPanel)

4 insignias calculadas automáticamente:

| Insignia | Condición para obtenerla |
|---|---|
| Tasa de completitud | ≥ 70% de actividades Terminadas |
| Actividades en tiempo | ≥ 80% de activas sin vencer |
| Avance promedio | Avance global ≥ 60% |
| Sin bloqueos | 0 actividades bloqueadas |

Las insignias son visuales — no desbloquean funciones, son motivacionales.

---

## Estadísticas por responsable (StatisticsPanel)

Tabla comparativa del equipo:
- Responsable
- Total actividades asignadas
- Completadas
- Avance promedio
- Puntos completados

Ordenado por completadas (desc) — el más productivo arriba.

---

## Panel de flujo (FlowPanel)

Accordion que muestra actividades agrupadas por subproyecto con:
- Estado con chip de color
- Barra de avance
- Nombre del responsable

Endpoint: `GET /api/dashboard/flujo`

---

## Cómo filtrar el dashboard

Todos los endpoints del dashboard aceptan `?subproyectoId=N` para filtrar por subproyecto específico. Si se omite, se muestran todas las actividades del equipo.

---

## Frecuencia de actualización

El dashboard NO se actualiza automáticamente — tiene un botón "Actualizar" manual. Los datos se mantienen vigentes mientras la sesión está activa. Para producción se recomienda refetch cada 5 minutos.

---

*Última actualización: 2026-05-22 | Fuente: `dashboardService.ts` + `dashboard/` components*

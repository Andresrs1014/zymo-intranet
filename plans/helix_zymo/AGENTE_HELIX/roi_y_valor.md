# ROI y Valor de Negocio — Helix Zymo

> Fuente directa: `helix-backend/src/services/roiService.ts` (placeholder — implementación en T11)
> Ver también: [[subproyectos]] | [[metricas_y_kpis]] | [[reglas_de_negocio]]

---

## ¿Por qué medir ROI en proyectos de desarrollo?

El área de Desarrollo e Innovación de Grupo ZYMO justifica sus iniciativas con retorno medible. Helix captura los costos reales de cada actividad y los compara con el retorno esperado declarado al crear el subproyecto.

---

## Fórmulas de cálculo

```
ROI (%) = (retornoEsp - inversionEst) / inversionEst × 100

Margen = retornoEsp / inversionEst

Costo total ejecutado = SUM(costoInversion + costoEjecucion) por todas las actividades del subproyecto

Costo optimización total = SUM(costoOptimizacion) — ahorro generado
```

---

## Clasificación de subproyectos

| ROI | Clasificación | Interpretación |
|---|---|---|
| > 50% | Alto potencial | Excelente rentabilidad, priorizar |
| 20–50% | Potencial favorable | Buen retorno, continuar |
| 0–20% | Retorno controlado | Rentable pero bajo, evaluar |
| ≤ 0% | Revisar alcance | No rentable, reevaluar o cancelar |

---

## Campos de costo en actividades

Cada actividad tiene 3 campos de costo (todos en COP):

| Campo | Significado |
|---|---|
| `costoInversion` | Lo que cuesta desarrollar/implementar esta actividad |
| `costoOptimizacion` | Ahorro o beneficio económico que genera |
| `costoEjecucion` | Costo operativo real de ejecutarla |

**Ejemplo:** Una actividad de automatización de reportes:
- `costoInversion` = 500.000 (tiempo del desarrollador)
- `costoOptimizacion` = 2.000.000 (tiempo ahorrado mensualmente × 12 meses)
- `costoEjecucion` = 50.000 (infraestructura)

---

## Vista Estados/Reports (T11 — pendiente)

La vista de Estados mostrará:
- **StatusReport:** Resumen narrativo listo para comité — texto generado por el backend con el estado actual del proyecto
- **FollowupList:** Lista de seguimientos sugeridos basada en actividades vencidas y bloqueadas
- **RoiGrid:** Tabla de ROI por subproyecto con clasificación y comparativo

---

## ROI en el Dashboard

El panel de valor muestra por subproyecto:
- Inversión estimada vs. costo ejecutado real
- Retorno esperado
- ROI calculado y clasificación
- Avance promedio de actividades (proxy de qué tan cerca está de materializarse el retorno)

---

## Predicción (futuro)

En versiones futuras, el `roiService.ts` calculará una predicción de retorno basada en:
- Velocidad actual del equipo (puntos/semana)
- Actividades restantes para completar el subproyecto
- Fecha estimada de completitud

---

*Última actualización: 2026-05-22 | Fuente: `helix-backend/src/services/roiService.ts` (placeholder) + `frontend/src/types/helix.ts` (HelixROI interface)*

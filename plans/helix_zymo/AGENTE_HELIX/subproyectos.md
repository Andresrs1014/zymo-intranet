# Subproyectos — Helix Zymo

> Este nodo explica qué es un subproyecto, cómo se gestiona y cómo hablar de él.
> Ver también: [[flujo_trabajo]] | [[roi_y_valor]] | [[actividades_y_estados]]

---

## ¿Qué es un subproyecto?

Un subproyecto es una iniciativa completa del área de Desarrollo. Tiene nombre, un objetivo de negocio, un cliente (interno o externo) y un presupuesto. Agrupa todas las actividades necesarias para completarla.

**Ejemplos reales del área:**
- "Helix Zymo" — módulo de gestión de proyectos para la intranet
- "Modernización módulo OC" — mejora del proceso de compras
- "Automatización reportes financieros" — eliminación de reportes manuales
- "Formación equipo en nuevas herramientas" — capacitaciones internas

---

## Cómo habla el agente de subproyectos

### Al resumir el estado de un subproyecto
```
Subproyecto: "Helix Zymo"

Objetivo: Módulo de gestión de proyectos integrado a la intranet
Cliente: Área de Desarrollo (uso interno)
Estado general: 71% completado

Actividades: 14 total | 10 terminadas | 3 en curso | 1 en backlog
Próxima fecha límite: "T11 Vista Estados" — vence 25 mayo (en 3 días)
ROI estimado: 179% — Potencial favorable ✅
```

---

### Al listar todos los subproyectos activos
```
Subproyectos activos (3):

1. Helix Zymo — 71% completado — 3 actividades en curso
2. Modernización módulo OC — 45% — 2 actividades vencidas ⚠️
3. Automatización reportes — 90% — casi terminado ✅
```

---

## Cómo se organiza internamente

- Un subproyecto puede tener **cualquier número de actividades**
- Cada actividad pertenece a **un solo subproyecto**
- Cuando todas las actividades de un subproyecto están Terminadas, el subproyecto está "completado" (no hay un estado explícito — es implícito)
- Se puede filtrar todo el dashboard por subproyecto para ver solo ese contexto

---

## Señales de salud de un subproyecto

| Señal | Qué significa |
|---|---|
| > 70% actividades Terminadas | Subproyecto avanzado, cerca del cierre |
| Actividades con alta prioridad vencidas | Riesgo de no entrega |
| ROI < 0% | Revisar si el alcance sigue siendo correcto |
| Sin actividades "En curso" | Trabajo parado, nadie está avanzando |
| Solo actividades en Backlog | El subproyecto no ha empezado realmente |

---

## Lo que el agente le dice a Andrea sobre subproyectos

Cuando Andrea pregunta por la salud de un subproyecto, el agente combina:
1. % de completitud (actividades Terminadas / total)
2. Actividades con alerta (vencidas, bloqueadas)
3. Próximas fechas críticas
4. ROI estimado vs. avance real
5. Quién está trabajando en él ahora mismo

---

*Última actualización: 2026-05-22 | Fuente: uso real del módulo Helix + `subproyectos.ts` router*
